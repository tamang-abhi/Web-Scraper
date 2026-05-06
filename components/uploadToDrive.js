// const fs            = require('fs');
// const path          = require('path');
// const { google }    = require('googleapis');

// //const ROOT_FOLDER_ID = '1g5PhUx1kdINiBUG8gwFGSe66ncCcj9HQ';
// //const ROOT_FOLDER_ID = '1EimHXzbRKI74-U1GH1JZ3GGYf0N8zr2T';
// //const ROOT_FOLDER_ID = '0AKr8lYwji_WYUk9PVA';
// const ROOT_FOLDER_ID = '194t5GrOlBxOqxhljVkIokUh_LqlJCvCw';


// async function uploadToDrive(filePath, fileName, dealNumber, lenderName) {
//     const auth = new google.auth.GoogleAuth({
//         //keyFile: __dirname + '/../config/credentials.json', // relative path
//         keyFile: __dirname + '/../config/toronto-auto-group-80a2c74d540d.json', // relative path
//         scopes: ['https://www.googleapis.com/auth/drive.file'],
//     });

//     const drive = google.drive({ version: 'v3', auth });


//     // Step 1: Ensure "deal.Deal" folder exists
//     const dealFolderName = `deal.${dealNumber}`;
//     const dealFolderId = await findOrCreateFolder(drive, dealFolderName, ROOT_FOLDER_ID);

//     // Step 2: Ensure "Lender" folder exists inside "deal.Deal"
//     const lenderFolderId = await findOrCreateFolder(drive, lenderName, dealFolderId);

//     // Step 3: Upload file to lender folder
//     const res = await drive.files.create({
//         requestBody: {
//             name: fileName,
//             mimeType: 'application/pdf',
//             parents: [lenderFolderId],
//         },
//         media: {
//             mimeType: 'application/pdf',
//             body: fs.createReadStream(filePath),
//         },
//         supportsAllDrives: true,
//     });

//     // Make file public
//     await drive.permissions.create({
//         fileId: res.data.id,
//         requestBody: { role: 'reader', type: 'anyone' },
//     });

//     return `https://drive.google.com/uc?id=${res.data.id}`;
// }

// // Helper to find or create a folder
// async function findOrCreateFolder(drive, folderName, parentId) {
//     // Try to find folder
//     const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
//     const res = await drive.files.list({ q: query });

//     if (res.data.files.length > 0) {
//         return res.data.files[0].id;
//     }

//     // Create folder if not found
//     const createRes = await drive.files.create({
//         requestBody: {
//             name: folderName,
//             mimeType: 'application/vnd.google-apps.folder',
//             parents: [parentId],
//         },
//         supportsAllDrives: true,
//     });

//     return createRes.data.id;
// }


// uploadToDrive.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT_FOLDER_ID = '194t5GrOlBxOqxhljVkIokUh_LqlJCvCw'; // replace if needed
const KEYFILE = path.join(__dirname, '../config/toronto-auto-group-80a2c74d540d.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// in-memory cache to avoid repeated lookups during a single run
const folderCache = new Map(); // key: `${parentId}::${name}` -> id

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: SCOPES,
  });
  return google.drive({ version: 'v3', auth });
}

function normalizeName(n) {
  if (!n && n !== 0) return '';
  return String(n).trim();
}

async function findFolder(drive, folderName, parentId) {
  const key = `${parentId}::${folderName}`;
  if (folderCache.has(key)) return folderCache.get(key);

  const qName = folderName.replace(/'/g, "\\'"); // escape single quotes for the query
  const q = `mimeType='application/vnd.google-apps.folder' and name='${qName}' and '${parentId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 10,
  });

  if (res.data.files && res.data.files.length > 0) {
    const id = res.data.files[0].id;
    folderCache.set(key, id);
    return id;
  }
  return null;
}

async function createFolder(drive, folderName, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  const id = res.data.id;
  // cache
  folderCache.set(`${parentId}::${folderName}`, id);
  return id;
}

async function findOrCreateFolder(drive, folderName, parentId) {
  folderName = normalizeName(folderName);
  if (!folderName) throw new Error('Invalid folderName');
  if (!parentId) throw new Error('Invalid parentId');

  // 1) try find
  let id = await findFolder(drive, folderName, parentId);
  console.log('ID found '+id);
  if (id) return id;

  // 2) not found → create
  try {
    id = await createFolder(drive, folderName, parentId);
    return id;
  } catch (err) {
    // If another process created the folder in parallel, try to find again
    console.warn('createFolder failed - retrying find:', err.message);
    id = await findFolder(drive, folderName, parentId);
    if (id) return id;
    // rethrow
    throw err;
  }
}

async function uploadToDrive(filePath, fileName, dealNumber, lenderName) {
  const drive = await getDriveClient();

  // normalize
  const dealFolderName = normalizeName(`deal.${dealNumber}`);
  const lenderFolderName = normalizeName(lenderName || 'Unknown Lender');

  // Step A: ensure deal folder exists under ROOT_FOLDER_ID
  //console.log('dealFolderName_'+dealFolderName);
  //console.log('lenderFolderName_'+lenderFolderName);
  //console.log('root_folder_ID_'+ROOT_FOLDER_ID);

  const dealFolderId = await findOrCreateFolder(drive, dealFolderName, ROOT_FOLDER_ID);
  //console.log('dealFolderId_'+dealFolderId);

  // Step B: ensure lender folder exists under deal folder
  const lenderFolderId = await findOrCreateFolder(drive, lenderFolderName, dealFolderId);
  //console.log('lenderFolderId_'+lenderFolderId);

  // Upload the file
  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(filePath),
  };

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [lenderFolderId],
    },
    media,
    fields: 'id, name',
    supportsAllDrives: true,
  });

  const fileId = res.data.id;

  // Make it readable by anyone (optional)
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (permErr) {
    console.warn('Could not set public permission:', permErr.message);
  }

  return `https://drive.google.com/uc?id=${fileId}`;
}


module.exports = uploadToDrive;