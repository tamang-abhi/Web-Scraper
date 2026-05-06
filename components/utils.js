require('dotenv').config();

// ---------------------- FUNCTIONS ----------------------

const fs        = require('fs').promises;

async function scrapeStatusPageWithPagination(page, INPUT_FILE) {
  const rawData = [];

  while (true) {
    const mainFrame = await getMainFrame(page);
    if (!mainFrame) throw new Error('❌ Main frame with Status page not found');

    await mainFrame.waitForSelector('#divView3_datagridbody > tr', { visible: true, timeout: 20000 });
    console.log('✅ Table rows detected. Scraping data...');

    const pageData = await mainFrame.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#divView3_datagridbody > tr'));
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        const spans = Array.from(cells[7]?.querySelectorAll('span') || []);
        const tabs = spans.map(span => {
          const id = span.id || '';
          const btTitleHTML = span.getAttribute('bt-xtitle') || '';
          const parser = new DOMParser();
          const doc = parser.parseFromString(btTitleHTML, 'text/html');
          const tableRows = doc.querySelectorAll('table tr');
          const details = {};
          for (let i = 1; i < tableRows.length; i++) {
            const th = tableRows[i].querySelector('th');
            const td = tableRows[i].querySelector('td');
            if (th && td) {
              const key = th.innerText.trim().replace(/[:\s]+$/, '');
              const value = td.innerText.trim();
              details[key] = value;
            }
          }
          return { id, details };
        });

        return {
          Deal: cells[2]?.innerText.trim() || '',
          Name: cells[3]?.innerText.trim() || '',
          modified: cells[4]?.innerText.trim() || '',
          created_by: cells[5]?.innerText.trim() || '',
          tabs
        };
      });
    });

    rawData.push(...pageData);
    console.log(`✅ Scraped ${pageData.length} rows. Total: ${rawData.length}`);

    // Check and click Next
    const hasNext = await mainFrame.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.paging'));
      return links.some(link => link.textContent.trim().startsWith('Next'));
    });

    if (hasNext) {
      console.log('🔄 Clicking Next...');

      await mainFrame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a.paging'));
        const nextLink = links.find(link => link.textContent.trim().startsWith('Next'));
        if (nextLink) nextLink.click();
      });

      // Wait for the table to reload (use some reliable selector or function)
      await mainFrame.waitForFunction(() => {
        const rows = document.querySelectorAll('#divView3_datagridbody > tr');
        return rows.length > 0;
      }, { timeout: 20000 });

      await new Promise(r => setTimeout(r, 1000));  // small buffer
    } else {
      console.log('🏁 No more Next link. Finished scraping all pages.');
      break;
    }
  }

  await fs.writeFile(INPUT_FILE, JSON.stringify(rawData, null, 2), 'utf8');
  console.log(`✅ All pages scraped. Data saved to ${INPUT_FILE}`);
  return rawData;
}


async function reloadStatusPage(page) {
  const frames = page.frames();
  const navFrame = frames.find(f => f.name() === 'nav');
  const mainFrame = frames.find(f => f.name() === 'main');

  if (!navFrame || !mainFrame) {
    throw new Error('❌ Could not find nav or main frames during reload.');
  }

  try {
    await navFrame.waitForSelector('#Status', { visible: true, timeout: 10000 });
    await navFrame.click('#Status');
    console.log('✅ Clicked the "Status" link inside nav frame.');

    await mainFrame.waitForSelector('#divView3_datagrid', { timeout: 15000 });
    console.log('✅ Status page reloaded.');
    return { navFrame, mainFrame };
  } catch (err) {
    throw new Error(`❌ Failed to reload Status page: ${err.message}`);
  }
}


async function clickStatusInNavFrame(page) {
  try {
    // Get all frames and find the 'nav' frame
    const navFrame = page.frames().find(f => f.name() === 'nav');
    const mainFrame = page.frames().find(f => f.name() === 'main');
    if (!navFrame) throw new Error('Navigation frame not found');

    // Wait for the #Status link and click it
    await navFrame.waitForSelector('#Status', { visible: true, timeout: 10000 });
    await navFrame.click('#Status');

    await mainFrame.waitForSelector('#divView3_datagrid', { timeout: 15000 });

    console.log('✅ Clicked the "Status" link inside nav frame.');
  } catch (err) {
    console.error('❌ Could not click "Status" in nav frame:', err.message);
    throw err; // rethrow if you want to handle retry logic upstream
  }
}

async function navigateToStatusPage(page) {
  // Your login and navigation logic to reach the mainFrame
  await page.goto('https://www.dealertrack.ca/DTCanada/Status/StatusList_v3.aspx', { waitUntil: 'networkidle0' });
  console.log('📍 Arrived at Status Page');
}

async function navigateToStatusList(page) {
  try {
    // Get the main frame where the content loads
    const mainFrameElement = await page.waitForSelector('frame[name="main"]', { timeout: 10000 });
    const mainFrame = await mainFrameElement.contentFrame();

    if (!mainFrame) throw new Error('Main frame not found');

    // Navigate the frame to the Status List
    await mainFrame.evaluate(() => {
      window.location.href = '/DTCanada/Status/StatusList_v3.aspx';
    });

    // Wait for the Status List to appear inside the frame
    await mainFrame.waitForSelector('#divView3_datagrid', { timeout: 15000 });

    return mainFrame; // Optionally return the updated frame if needed
  } catch (error) {
    console.error('❌ Failed to navigate back to Status List:', error.message);
    throw error;
  }
}
  
async function getMainFrame(page) {
  const mainFrame = page.frames().find(f => f.name() === 'main');
  if (!mainFrame) throw new Error('❌ Main frame not found!');
  return mainFrame;
}
  
async function searchDeal(frame, dealNumber) {
  //console.log("Search deal function accessed");
  await frame.waitForSelector('#tbSearchCriteria', { visible: true });

  // Clear and enter deal number
  await frame.evaluate(() => document.querySelector('#tbSearchCriteria').value = '');
  await frame.type('#tbSearchCriteria', dealNumber);

  //console.log("Deal number entered");

  // Click search and wait for data grid to update instead of navigation
  await frame.click('#btnSearch');

  //console.log("search deal button clicked");

  // Wait for table update — increase timeout if needed
  await frame.waitForSelector('#divView3_datagrid tr', { timeout: 10000 });
}

async function clickTabById(frame, tabId, page) {
  // Step 1: Click the tab image
  frame = await getMainFrame(page);
  //await frame.waitForSelector(`#${tabId}`, { visible: true, timeout: 10000 });
  await frame.waitForSelector(`#statusListData`, { visible: true, timeout: 10000 });
  const result = await frame.evaluate((id) => {
    if (!window.CSS || typeof window.CSS.escape !== 'function') {
      window.CSS = {
        escape: (value) =>
          value.replace(/[^a-zA-Z0-9\-_]/g, (char) =>
            '\\' + char.charCodeAt(0).toString(16)
          ),
      };
    }

    // const escapedId = window.CSS.escape(id);
    // const span = document.querySelector(`#${escapedId}`);
    const span = document.querySelector(`[id="${id}"]`);
    if (!span) return 'Span not found';

    const img = span.nextElementSibling;
    if (!img || img.tagName.toLowerCase() !== 'img') {
      return 'Tab icon not found next to span';
    }

    img.click();
    return 'success';
  }, tabId);

  if (result !== 'success') {
    throw new Error(result);
  }

  console.log("🟢 Tab clicked successfully. Watching for modal...");

  try {
    // Step 2: Wait up to 10 seconds for the modal iframe to appear
    const iframeSelector = 'iframe#DTC\\$ModalPopup\\$Frame';

    const modalFrameHandle = await frame.waitForSelector(iframeSelector, {
      timeout: 10000,
    });

    if (modalFrameHandle) {
      const modalFrame = await modalFrameHandle.contentFrame();

      if (modalFrame) {
        console.log('⚠️ Modal iframe detected. Waiting for #dontSwitch...');

        await modalFrame.waitForSelector('#dontSwitch', {
          visible: true,
          timeout: 8000,
        });

        await modalFrame.click('#dontSwitch');
        console.log('✅ Clicked #dontSwitch in modal alert');

        // Optional: wait for the main frame to update after modal click
        await page.waitForSelector('#ctl22_btnAPPLICANT', {
          visible: true,
          timeout: 10000,
        });

      } else {
        console.warn('⚠️ Found iframe, but could not access its content.');
      }
    } else {
      console.log("ℹ️ No modal iframe appeared within timeout.");
    }

  } catch (err) {
    console.log("ℹ️ No modal alert detected or iframe load failed:", err.message);
  }
}
  
  async function safeReturnToMain(page, frame) {
    try {
      await page.goBack({ waitUntil: 'networkidle2' });
      await frame.waitForSelector('#divView3_datagrid');
    } catch (e) {
      console.warn('⚠️ Failed to go back, refreshing page');
      await page.reload({ waitUntil: 'networkidle2' });
    }
  }


async function isLoggedOut(page) {
  const url = page.url();
  return url.includes('login.canada.fcc') || url.includes('auth.dealertrack.ca/idp');
}

async function ensureLoggedIn(page) {
  const wasLoggedOut = await isLoggedOut(page);
  if (wasLoggedOut) {
    console.warn('⚠️ Session expired. Re-logging in...');

    await page.goto('https://auth.dealertrack.ca/idp/startSSO.ping?PartnerSpId=prod_dtc_sp_pingfed', { waitUntil: 'networkidle2' });

    await page.type('#username', process.env.DEALERTRACK_USERNAME);
    await page.type('#password', process.env.DEALERTRACK_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('#signOnButton'),
    ]);

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Re-logged in successfully.');
    return true;
  }
  return false;
}

  module.exports = {
    safeReturnToMain,
    clickTabById,
    searchDeal,
    getMainFrame,
    navigateToStatusList,
    navigateToStatusPage,
    scrapeStatusPageWithPagination,
    clickStatusInNavFrame,
    ensureLoggedIn,
    reloadStatusPage,
  };