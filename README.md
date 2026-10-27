# CareerBridge — Google sign-in, resume submission, and Sheets register

This is a starter project built with HTML, Bootstrap, Firebase Authentication/Firestore, and Google Apps Script. It is **not production-ready until the setup and security checks below are completed**.

## Features in this version
- Applicant-first home page and searchable public job listings from Firestore.
- Admin-only job management panel to add, edit, and delete opportunities (authorised email: `lisaprajval@gmail.com`).
- Google account sign-in through Firebase Authentication.
- Applicant form for name, email (from verified Google account), phone, education, preferred location, target role/skills, optional JPG/PNG applicant photo (max 2 MB, with preview), consent, and PDF resume (max 5 MB).
- Companion Google Apps Script validates the Firebase ID token, saves the PDF and optional applicant photo to a private Drive folder, and appends applicant details plus private file IDs to a Google Sheet. Each successful submission receives a server-generated Application Registration Number (for example, `CB-20261027-0001`), saved in the Applicants sheet and shown to the applicant after submission.
- The sheet does not make the resume public; authorised staff must open the file from the private Drive folder.

## 1. Configure Firebase
1. Open Firebase Console and select project `careerbridge-f3623` (or your own project).
2. Authentication → Sign-in method → enable **Google**. Choose a support email and save.
3. Authentication → Settings → Authorized domains: add `localhost` for local testing and your exact GitHub Pages domain after hosting (for example `yourname.github.io`).
4. Project settings → General → Your apps → Web app: copy your configuration into `firebaseConfig` in `app.js`. Do not leave `PASTE_...` values.
5. Firestore Database → Rules: open `firestore.rules` and publish the updated rules. These allow public job browsing but restrict adding, editing, and deleting jobs to the verified Google account `lisaprajval@gmail.com`. **If your admin Google email is different, change it in both `app.js` (`ADMIN_EMAIL`) and `firestore.rules` (`jobAdmin()`), then publish the rules.**
6. Sign in on the website with that exact Google account. The **Manage job opportunities** panel appears above the applicant form. Fill in the job details and click **Save job opportunity**. To change/remove an existing listing, use Edit/Delete in the panel. Other signed-in users and applicants cannot manage job postings.

## 2. Create the Google Sheet and private Drive folder
1. In Google Drive, create a spreadsheet called `CareerBridge Applicants`.
2. Create a Drive folder called `CareerBridge Private Resumes`. Keep its sharing restricted to your consultancy staff. Do **not** set it to “Anyone with the link.”
3. Copy the spreadsheet ID from its URL (the part between `/d/` and `/edit`) and the folder ID from its URL.

## 3. Deploy the Apps Script endpoint
1. Visit `https://script.google.com` while signed into the Google account that owns the Sheet and Drive folder. Create a new project.
2. Replace the sample code in `Code.gs` with the `Code.gs` file included in this folder.
3. In Apps Script → Project Settings → Script Properties, add:
   - `FIREBASE_API_KEY` = the Web API key from Firebase project settings
   - `SPREADSHEET_ID` = your spreadsheet ID
   - `DRIVE_FOLDER_ID` = your private resume folder ID
4. In Apps Script, choose **Deploy → New deployment → Web app**. Execute as **Me**. Set access to **Anyone** so signed-in applicants can submit from the website; the script verifies each Firebase ID token before saving. Deploy and copy the Web app URL ending in `/exec`.
5. Paste that URL into `SHEETS_WEB_APP_URL` in `app.js`.
6. When updating an already-deployed Apps Script, choose **Deploy → Manage deployments → Edit** (pencil icon), select **New version**, and click **Deploy**. Keep the existing `/exec` URL if editing the existing deployment. This is required for the photo upload and Application Registration Number code in `Code.gs` to run.
7. Upload the updated `index.html`, `styles.css`, `app.js`, `Code.gs`, and `README.md` to your GitHub repository. In Apps Script, update `Code.gs` from this ZIP and deploy a new version as described above.
8. Test with a throwaway applicant account, a dummy JPG/PNG photo, and a dummy PDF first. Confirm a row appears in the sheet and the PDF is in the private Drive folder. Confirm the file is not publicly shared.

**Important:** Google Apps Script deployments and browser cross-origin behaviour can vary by account and deployment settings. If submission returns a network/CORS error, do not make the Drive folder public. Use the browser Console error and we can adjust the integration (for example, route submissions through a small authenticated backend).

## 4. Test locally
- Open the folder in VS Code and use the Live Server extension to open `index.html` through `http://localhost:...`.
- Test Google sign-in, job search, then submit a dummy profile and PDF.
- Do not use real applicant data until you have tested permissions and privacy end-to-end.

## 5. Publish on GitHub Pages
1. Create a GitHub repository. Keep it private during development if possible.
2. Upload the contents of this folder to the repository root.
3. Repository Settings → Pages → deploy from your main branch and root folder.
4. Add the resulting exact host to Firebase Authentication → Authorized domains.
5. Test Google sign-in and the Apps Script submission on the hosted URL.

## Privacy and production checklist
- Keep the Drive resume folder private and share it only with authorised staff.
- Give applicants a clear privacy notice, purpose, retention period, and contact for removal requests.
- Do not collect identity documents or unnecessary sensitive information.
- Add employer verification and admin controls before publishing real vacancies.
- Add spam/rate limiting, duplicate application checks, and an applicant deletion process.
- Do not store passwords, private keys, service-account credentials, or Google OAuth client secrets in frontend JavaScript or GitHub.
- The Firebase Web API key is part of normal web-app configuration, but configure Firebase API restrictions and never treat it as an authorization secret.
