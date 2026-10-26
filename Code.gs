/** CareerBridge Google Apps Script endpoint.
 * Set Script Properties: FIREBASE_API_KEY, SPREADSHEET_ID, DRIVE_FOLDER_ID.
 * Deploy as a Web app executing as you, accessible to anyone; this endpoint validates
 * every Firebase ID token before writing and keeps uploaded Drive files private.
 */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('FIREBASE_API_KEY');
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    const folderId = props.getProperty('DRIVE_FOLDER_ID');
    if (!apiKey || !spreadsheetId || !folderId) throw new Error('Apps Script setup is incomplete.');
    if (!body.idToken || body.consent !== true) throw new Error('Sign-in and consent are required.');
    const verification = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({idToken: body.idToken}), muteHttpExceptions: true
    });
    if (verification.getResponseCode() !== 200) throw new Error('Your sign-in could not be verified. Please sign in again.');
    const verified = JSON.parse(verification.getContentText());
    const account = verified.users && verified.users[0];
    if (!account || !account.localId || account.email !== body.email) throw new Error('Account verification failed.');
    const fullName = clean_(body.fullName, 120), phone = clean_(body.phone, 30), education = clean_(body.education, 160);
    const location = clean_(body.preferredLocation, 120), skills = clean_(body.skillsAndTargetRole, 500);
    if (!fullName || !phone || !education || !location || !skills) throw new Error('Please complete all required applicant fields.');
    if (body.resumeMimeType !== 'application/pdf' || !body.resumeBase64) throw new Error('A PDF résumé is required.');
    const bytes = Utilities.base64Decode(body.resumeBase64);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Résumé must be 5 MB or smaller.');
    const blob = Utilities.newBlob(bytes, 'application/pdf', safeFileName_(body.resumeName || 'resume.pdf'));
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob); // Private by default; do not enable public link sharing.
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Applicants') || SpreadsheetApp.openById(spreadsheetId).insertSheet('Applicants');
    if (sheet.getLastRow() === 0) sheet.appendRow(['Submitted At','Firebase UID','Full Name','Email','Phone','Education','Preferred Location','Skills / Target Role','Résumé File Name','Private Drive File ID','Review Status']);
    sheet.appendRow([new Date(), account.localId, fullName, account.email, phone, education, location, skills, blob.getName(), file.getId(), 'New']);
    return json_({success:true, message:'Applicant profile received.'});
  } catch (err) {
    return json_({success:false, message:String(err && err.message || 'Submission failed.')});
  }
}
function clean_(value, max) { return String(value || '').trim().slice(0, max); }
function safeFileName_(name) { return String(name || 'resume.pdf').replace(/[\\/:*?"<>|#%{}~&]/g, '_').slice(0, 100); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
