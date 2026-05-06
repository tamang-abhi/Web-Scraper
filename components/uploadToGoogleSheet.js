require('dotenv').config();
console.log('Loaded Spreadsheet ID:', process.env.DEALERTRACK_GOOGLE_SHEET_ID);

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '../config/toronto-auto-group-80a2c74d540d.json');
const JSON_DATA_PATH = path.join(__dirname, '../final-deal-data.json');

const applicantsSheetGID = process.env.GID_APPLICANTS;
const worksheetGID       = process.env.GID_WORKSHEET;
const documentsGID       = process.env.GID_DOCUMENTS;
const approvalsGID       = process.env.GID_APPROVALS;
const messagesGID        = process.env.GID_MESSAGES;

function safeValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return typeof val === 'string' ? val : String(val);
}

async function uploadToGoogleSheets(spreadsheetId) {
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const rawData = JSON.parse(fs.readFileSync(JSON_DATA_PATH));

    const dealsSheet = [['Deal', 'Name', 'Created By', 'Modified', 'Tab ID', 'Lender', 'Status', 'Deal#', 'Ref. #', 'Applicant Name', 'Product', 'Tab Modified', 'Applicant Link', 'Worksheet Link', 'Documents Link', 'Approval Conditions Link', 'Messages Link']];
    const applicantsSheet = [];
    const documentsSheet = [];
    const approvalsSheet = [];
    const messagesSheet = [['Deal', 'TAB_ID', 'Message #', 'Message', 'Sent', 'From']];
    const worksheetSheet = [];

    const applicantHeadersList = [];
    const applicantHeadersSet = new Set();
    const applicantRows = [];
    const worksheetHeadersSet = new Set();
    const worksheetRows = [];
    const documentHeadersSet = new Set();
    const documentsRows = [];
    const approvalHeadersSet = new Set();
    const approvalsRows = [];

    const applicantRowMap = {};
    const worksheetRowMap = {};
    const documentRowMap = {};
    const approvalRowMap = {};
    const messageRowMap = {};

    for (const deal of rawData) {
        const dealNum = deal.Deal || '';
        const name = deal.Name || '';
        const createdBy = deal.created_by || '';
        const modified = deal.modified || '';

        (deal.tabs || []).forEach((tab, index) => {
            const tabId = tab.id || `TAB_${dealNum}_${index + 1}`;
            const d = tab.details || {};
            const tabDetails = d.tab_details || {};

            if (tabDetails.Applicant && typeof tabDetails.Applicant === 'object' && !tabDetails.Applicant.error) {
                Object.entries(tabDetails.Applicant).forEach(([applicantKey, applicantObj]) => {
                    const row = {
                        Deal: dealNum,
                        TabId: tabId,
                        Applicant: applicantKey
                    };
                    Object.entries(applicantObj).forEach(([section, fields]) => {
                        if (typeof fields === 'object') {
                            if (section === 'Assets and Liabilities') {
                                Object.entries(fields).forEach(([subSection, subFields]) => {
                                    if (typeof subFields === 'object') {
                                        Object.entries(subFields).forEach(([field, value]) => {
                                            const key = `${section}.${subSection}.${field}`;
                                            if (!applicantHeadersSet.has(key)) {
                                                applicantHeadersSet.add(key);
                                                applicantHeadersList.push(key);
                                            }
                                            row[key] = value;
                                        });
                                    }
                                });
                            } else {
                                Object.entries(fields).forEach(([field, value]) => {
                                    const key = `${section}.${field}`;
                                    if (!applicantHeadersSet.has(key)) {
                                        applicantHeadersSet.add(key);
                                        applicantHeadersList.push(key);
                                    }
                                    row[key] = value;
                                });
                            }
                        }
                    });
                    applicantRowMap[tabId] = applicantRows.length;
                    applicantRows.push(row);
                });
            }

            if (tabDetails.Worksheet && typeof tabDetails.Worksheet === 'object') {
                const row = {
                    Deal: dealNum,
                    TAB_ID: tabId
                };
                Object.entries(tabDetails.Worksheet).forEach(([section, fields]) => {
                    if (typeof fields === 'object') {
                        Object.entries(fields).forEach(([field, value]) => {
                            const key = `${section}.${field}`;
                            if (!worksheetHeadersSet.has(key)) {
                                worksheetHeadersSet.add(key);
                            }
                            row[key] = value;
                        });
                    }
                });
                worksheetRowMap[tabId] = worksheetRows.length;
                worksheetRows.push(row);
            }

            if (tabDetails.Documents && typeof tabDetails.Documents === 'object') {
                const row = {
                    Deal: dealNum,
                    TAB_ID: tabId
                };
                Object.entries(tabDetails.Documents).forEach(([section, fields]) => {
                    if (typeof fields === 'object') {
                        Object.entries(fields).forEach(([field, val]) => {
                            const key = `${section}.${field}`;
                            if (!documentHeadersSet.has(key)) {
                                documentHeadersSet.add(key);
                            }
                            row[key] = val;
                        });
                    }
                });
                documentRowMap[tabId] = documentsRows.length;
                documentsRows.push(row);
            }

            if (tabDetails['Approval Conditions'] && typeof tabDetails['Approval Conditions'] === 'object') {
                const row = {
                    Deal: dealNum,
                    TAB_ID: tabId
                };
                Object.entries(tabDetails['Approval Conditions']).forEach(([section, fields]) => {
                    if (typeof fields === 'object') {
                        Object.entries(fields).forEach(([field, value]) => {
                            const key = `${section}.${field}`;
                            if (!approvalHeadersSet.has(key)) {
                                approvalHeadersSet.add(key);
                            }
                            row[key] = value;
                        });
                    }
                });
                approvalRowMap[tabId] = approvalsRows.length;
                approvalsRows.push(row);
            }

            if (tabDetails.Messages && Array.isArray(tabDetails.Messages)) {
                tabDetails.Messages.forEach((msg, i) => {
                    if (!messageRowMap[tabId]) {
                        messageRowMap[tabId] = messagesSheet.length;
                    }
                    messagesSheet.push([
                        dealNum,
                        tabId,
                        i + 1,
                        safeValue(msg.Message),
                        safeValue(msg.Sent),
                        safeValue(msg.From)
                    ]);
                });
            }

            dealsSheet.push([
                dealNum,
                name,
                createdBy,
                modified,
                tabId,
                d.Lender || '',
                d.Status || '',
                d['Deal#'] || '',
                d['Ref. #'] || '',
                d['Applicant Name'] || '',
                d.Product || '',
                d.Modified || '',
                applicantRowMap[tabId] !== undefined ? { formulaValue: `=HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${applicantsSheetGID}&range=B${applicantRowMap[tabId] + 2}", "${tabId}")` } : '',
                worksheetRowMap[tabId] !== undefined ? { formulaValue: `=HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${worksheetGID}&range=B${worksheetRowMap[tabId] + 2}", "${tabId}")` } : '',
                documentRowMap[tabId] !== undefined ? { formulaValue: `=HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${documentsGID}&range=B${documentRowMap[tabId] + 2}", "${tabId}")` } : '',
                approvalRowMap[tabId] !== undefined ? { formulaValue: `=HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${approvalsGID}&range=B${approvalRowMap[tabId] + 2}", "${tabId}")` } : '',
                messageRowMap[tabId] !== undefined ? { formulaValue: `=HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${messagesGID}&range=B${messageRowMap[tabId] + 1}", "${tabId}")` } : ''
            ]);
        });
    }

    const applicantHeaders = ['Deal', 'TAB_ID', 'Applicant #', ...applicantHeadersList];
    applicantsSheet.push(applicantHeaders);
    for (const rowObj of applicantRows) {
        const row = [
            rowObj.Deal,
            rowObj.TabId,
            rowObj.Applicant,
            ...applicantHeadersList.map(h => safeValue(rowObj[h] || ''))
        ];
        applicantsSheet.push(row);
    }

    const worksheetHeadersList = ['Deal', 'TAB_ID', ...[...worksheetHeadersSet]];
    worksheetSheet.push(worksheetHeadersList);
    for (const rowObj of worksheetRows) {
        const row = [
            rowObj.Deal,
            rowObj.TAB_ID,
            ...worksheetHeadersList.slice(2).map(h => safeValue(rowObj[h] || ''))
        ];
        worksheetSheet.push(row);
    }

    const documentHeadersList = ['Deal', 'TAB_ID', ...[...documentHeadersSet]];
    documentsSheet.push(documentHeadersList);
    for (const rowObj of documentsRows) {
        const row = [
            rowObj.Deal,
            rowObj.TAB_ID,
            ...documentHeadersList.slice(2).map(h => safeValue(rowObj[h] || ''))
        ];
        documentsSheet.push(row);
    }

    const approvalHeadersList = ['Deal', 'TAB_ID', ...[...approvalHeadersSet]];
    approvalsSheet.push(approvalHeadersList);
    for (const rowObj of approvalsRows) {
        const row = [
            rowObj.Deal,
            rowObj.TAB_ID,
            ...approvalHeadersList.slice(2).map(h => safeValue(rowObj[h] || ''))
        ];
        approvalsSheet.push(row);
    }

    const writeSheet = async (title, values) => {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${title}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: values.map(row => row.map(cell => typeof cell === 'object' && cell.formulaValue ? cell.formulaValue : cell))
            }
        });
    };

    const clearThenWriteSheet = async (title, values) => {
        const range = `${title}!A1:Z1000`; // Adjust to wider range if your data may exceed 1000 rows/columns

        // Step 1: Clear the existing range
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
        });

        // Step 2: Write new values
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${title}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: values.map(row =>
                    row.map(cell => (typeof cell === 'object' && cell.formulaValue ? cell.formulaValue : cell))
                ),
            },
        });
    };

    await clearThenWriteSheet('Deals', dealsSheet);
    await clearThenWriteSheet('Applicants', applicantsSheet);
    await clearThenWriteSheet('Documents', documentsSheet);
    await clearThenWriteSheet('Approvals', approvalsSheet);
    await clearThenWriteSheet('Messages', messagesSheet);
    await clearThenWriteSheet('Worksheet', worksheetSheet);

    console.log('✅ All data uploaded to Google Sheets.');
}

if (require.main === module) {
    const spreadsheetId = process.env.DEALERTRACK_GOOGLE_SHEET_ID; // 🔁 Replace this with your actual Sheet ID
    if (!spreadsheetId) {
        throw new Error('❌ Missing DEALERTRACK_GOOGLE_SHEET_ID in .env file');
    }
    uploadToGoogleSheets(spreadsheetId).catch(console.error);
}

module.exports = uploadToGoogleSheets;
