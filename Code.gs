/** CareerBridge Google Apps Script endpoint.
 * Set Script Properties: FIREBASE_API_KEY, SPREADSHEET_ID, DRIVE_FOLDER_ID.
 * Validates Firebase ID tokens, keeps uploaded Drive files private, and assigns an application number.
 */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('FIREBASE_API_KEY');
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    const folderId = props.getProperty('DRIVE_FOLDER_ID');
    if (!apiKey || !spreadsheetId) throw new Error('Apps Script setup is incomplete.');
    if (!body.idToken) throw new Error('Please sign in with Google first.');
    const verification = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({idToken: body.idToken}), muteHttpExceptions: true
    });
    if (verification.getResponseCode() !== 200) throw new Error('Your sign-in could not be verified. Please sign in again.');
    const verified = JSON.parse(verification.getContentText());
    const account = verified.users && verified.users[0];
    if (!account || !account.localId) throw new Error('Account verification failed.');
    // Applicants can only read records belonging to the Google account they signed in with.
    if (body.action === 'listMyApplications') {
      return json_({success:true, applications:getMyApplications_(spreadsheetId, account)});
    }
    if (body.consent !== true || !folderId) throw new Error('Sign-in, consent, and Drive setup are required.');
    if (String(account.email || '').toLowerCase() !== String(body.email || '').toLowerCase()) throw new Error('Account verification failed.');
    const fullName = clean_(body.fullName, 120), phone = clean_(body.phone, 30), education = clean_(body.education, 160);
    const location = clean_(body.preferredLocation, 120), skills = clean_(body.skillsAndTargetRole, 500);
    if (!fullName || !phone || !education || !location || !skills) throw new Error('Please complete all required applicant fields.');
    if (body.resumeMimeType !== 'application/pdf' || !body.resumeBase64) throw new Error('A PDF resume is required.');
    const bytes = Utilities.base64Decode(body.resumeBase64);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Resume must be 5 MB or smaller.');
    const blob = Utilities.newBlob(bytes, 'application/pdf', safeFileName_(body.resumeName || 'resume.pdf'));
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob); // Private by default; do not enable public link sharing.

    // Optional applicant photo; accept only JPEG/PNG and keep it private in the same folder.
    let photoFileName = '', photoFileId = '';
    if (body.photoBase64) {
      const photoMime = String(body.photoMimeType || '');
      if (photoMime !== 'image/jpeg' && photoMime !== 'image/png') throw new Error('Applicant photo must be JPG or PNG.');
      const photoBytes = Utilities.base64Decode(body.photoBase64);
      if (photoBytes.length > 2 * 1024 * 1024) throw new Error('Applicant photo must be 2 MB or smaller.');
      const fallbackExt = photoMime === 'image/png' ? '.png' : '.jpg';
      const photoBlob = Utilities.newBlob(photoBytes, photoMime, safeFileName_(body.photoName || ('applicant-photo' + fallbackExt)));
      const photoFile = folder.createFile(photoBlob); // Private by default.
      photoFileName = photoFile.getName();
      photoFileId = photoFile.getId();
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName('Applicants') || spreadsheet.insertSheet('Applicants');
    const baseHeaders = ['Submitted At','Firebase UID','Full Name','Email','Phone','Education','Preferred Location','Skills / Target Role','Resume File Name','Private Drive File ID','Review Status','Applicant Photo File Name','Private Photo File ID','Application Registration No.'];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(baseHeaders);
    } else {
      // Repair older sheets safely: add any missing expected headers at the end.
      // Existing columns and saved rows are never moved, cleared, or overwritten.
      let headerWidth = Math.max(sheet.getLastColumn(), 1);
      let existingHeaders = sheet.getRange(1, 1, 1, headerWidth).getDisplayValues()[0].map(function(v) { return normalizeHeader_(v); });
      baseHeaders.forEach(function(header) {
        if (existingHeaders.indexOf(normalizeHeader_(header)) === -1) {
          headerWidth += 1;
          sheet.getRange(1, headerWidth).setValue(header);
          existingHeaders.push(header);
        }
      });
    }
    // Reload the final header row after adding any missing columns.
    let lastColumn = sheet.getLastColumn();
    let existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(v) { return normalizeHeader_(v); });
    let registrationColumn = existingHeaders.indexOf(normalizeHeader_('Application Registration No.')) + 1;
    if (registrationColumn === 0) throw new Error('Could not prepare the Application Registration No. column.');

    // Lock the number allocation and row append to avoid duplicate numbers during simultaneous submissions.
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    let registrationNumber;
    try {
      const now = new Date();
      const timezone = Session.getScriptTimeZone() || 'Asia/Kolkata';
      const datePart = Utilities.formatDate(now, timezone, 'yyyyMMdd');
      const prefix = 'CB-' + datePart + '-';
      const lastRow = sheet.getLastRow();
      let maxSequence = 0;
      if (lastRow >= 2) {
        const values = sheet.getRange(2, registrationColumn, lastRow - 1, 1).getDisplayValues();
        values.forEach(function(row) {
          const value = String(row[0] || '');
          if (value.indexOf(prefix) === 0) {
            const n = parseInt(value.substring(prefix.length), 10);
            if (!isNaN(n) && n > maxSequence) maxSequence = n;
          }
        });
      }
      registrationNumber = prefix + String(maxSequence + 1).padStart(4, '0');
      const row = new Array(Math.max(sheet.getLastColumn(), registrationColumn)).fill('');
      const set = function(header, value) { const idx = existingHeaders.indexOf(normalizeHeader_(header)); if (idx >= 0) row[idx] = value; };
      set('Submitted At', now); set('Firebase UID', account.localId); set('Full Name', fullName);
      set('Email', account.email); set('Phone', phone); set('Education', education);
      set('Preferred Location', location); set('Skills / Target Role', skills);
      set('Resume File Name', file.getName());
      set('Private Drive File ID', file.getId());
      if (existingHeaders.indexOf(normalizeHeader_('Resume File Name')) < 0) {
        throw new Error('Resume File Name column could not be found after preparing the sheet headers.');
      }
      set('Review Status', 'New'); set('Applicant Photo File Name', photoFileName); set('Private Photo File ID', photoFileId);
      row[registrationColumn - 1] = registrationNumber;
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return json_({success:true, message:'Applicant profile received.', registrationNumber:registrationNumber});
  } catch (err) {
    return json_({success:false, message:String(err && err.message || 'Submission failed.')});
  }
}
function normalizeHeader_(value) {
  // Compare headings regardless of accents, case, extra spaces, or punctuation.
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function clean_(value, max) { return String(value || '').trim().slice(0, max); }
function safeFileName_(name) { return String(name || 'resume.pdf').replace(/[\\/:*?"<>|#%{}~&]/g, '_').slice(0, 100); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }


/** Returns safe application summaries for the authenticated applicant only. */
function getMyApplications_(spreadsheetId, account) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName('Applicants');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(v) { return normalizeHeader_(v); });
  const index = function(name) { return headers.indexOf(normalizeHeader_(name)); };
  const emailCol = index('Email'), uidCol = index('Firebase UID');
  if (emailCol < 0 && uidCol < 0) return [];
  const email = String(account.email || '').toLowerCase();
  const uid = String(account.localId || '');
  const pick = function(row, name) { const i = index(name); return i < 0 ? '' : row[i]; };
  const formatDate = function(value) {
    if (!value) return '';
    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm');
    }
    return String(value);
  };
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const rowEmail = emailCol < 0 ? '' : String(row[emailCol] || '').toLowerCase();
    const rowUid = uidCol < 0 ? '' : String(row[uidCol] || '');
    if (!((uid && rowUid && uid === rowUid) || (email && rowEmail && email === rowEmail))) continue;
    out.push({
      registrationNumber: String(pick(row, 'Application Registration No.') || ''),
      submittedAt: formatDate(pick(row, 'Submitted At')),
      fullName: String(pick(row, 'Full Name') || ''),
      education: String(pick(row, 'Education') || ''),
      preferredLocation: String(pick(row, 'Preferred Location') || ''),
      skills: String(pick(row, 'Skills / Target Role') || ''),
      reviewStatus: String(pick(row, 'Review Status') || 'Submitted'),
      resumeName: String(pick(row, 'Resume File Name') || '')
    });
  }
  out.sort(function(a, b) { return b.submittedAt.localeCompare(a.submittedAt); });
  return out;
}
