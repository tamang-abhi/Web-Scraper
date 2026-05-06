





module.exports = async function uploadToSheet(spreadsheetId, dealsArray) {
    // Instead of reading from JSON file:
    // const rawData = JSON.parse(fs.readFileSync(JSON_DATA_PATH));
    
    const rawData = Array.isArray(dealsArray) ? dealsArray : [dealsArray];

    // 👇 The rest of your data-building logic here, using rawData...
}