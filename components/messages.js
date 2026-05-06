async function scrapeMessagesTab(frame){
    console.log("scrapeMessagesTab function accessed");
    // Click the tab button
    const button = await frame.$('#ctl22_btnMESSAGES');
    if (!button) throw new Error('Button #ctl22_btnMESSAGES not found');
    await button.click();
    await frame.waitForSelector('#ctl22_pnlMESSAGES', { visible: true, timeout: 10000 });

    const data = await frame.evaluate( ()=> {
        const result = [];
        const updatePanel = document.querySelector('[id$="ctl00_UpdatePanel1"]');
        if (!updatePanel) return result;                  

        const rows = updatePanel.querySelectorAll('table tr');

        rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if(tds.length >= 6) {
                result.push({
                    Message:    tds[2].innerText.trim(),
                    Action:     tds[3].innerText.trim(),
                    Sent:       tds[4].innerText.trim(),
                    From:       tds[5].innerText.trim(),
                });
            }
        });

        return result;
    });

    return data;
}

module.exports = { scrapeMessagesTab };