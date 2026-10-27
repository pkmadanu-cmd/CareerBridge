CareerBridge Resume Filename Fix

This update fixes header normalization in Code.gs so that headings such as "Résumé File Name" are matched with "Resume File Name" correctly.

Installation:
1. Back up your current Code.gs.
2. Open your existing CareerBridge Apps Script project.
3. Replace only Code.gs with the Code.gs in this ZIP and save.
4. Deploy > Manage deployments > Edit your existing web app > select New version > Deploy.
5. Keep the current web app URL, access settings, and Script Properties unchanged.
6. Submit one new test application with a PDF resume and refresh the existing Applicants sheet.

Do not change Firebase, SPREADSHEET_ID, or DRIVE_FOLDER_ID. Existing rows are not automatically repaired; this fix is for new submissions.
