require('dotenv').config();

const puppeteer = require('puppeteer');
const fs        = require('fs').promises;  // For saving JSON
const path      = require('path');

const { scrapeApplicantTab }          = require('./components/applicant');
const { scrapeWorksheetTab }          = require('./components/worksheet');
const { scrapeDocumentsTab }          = require('./components/document');
const { scrapeApprovalConditionsTab } = require('./components/approval');
const { scrapeMessagesTab }           = require('./components/messages');
const utils                           = require('./components/utils');
const uploadToSheet                   = require('./components/uploadToGoogleSheet');
const { loginAndHandleMFA }           = require('./components/LoginAndHandleMFA');

const jumpDeal = ["43157219","43046673","42946526"];

// ---------------------- CONFIG ----------------------
const INPUT_FILE    = 'status-data.json';
const OUTPUT_FILE   = 'final-deal-data.json';
const SLOW_MO       = 100;
const WAIT_TIME     = 3000;


const dataPath      = path.join(__dirname, INPUT_FILE);
const output_path   = path.join(__dirname, OUTPUT_FILE);
const GOOGLE_SHEET_ID = process.env.DEALERTRACK_GOOGLE_SHEET_ID;

// ---------------- CHECK ALREADY SCRAPED DATA ---------------

// option to start scraper froma starting deal number and end deal number
// Parse optional --start and --end from CLI
const args          = process.argv.slice(2);
const startArg      = args.find(arg => arg.startsWith('--start='));
const endArg        = args.find(arg => arg.startsWith('--end='));
const START_INDEX   = startArg ? parseInt(startArg.split('=')[1], 10) : 0;
const END_INDEX     = endArg ? parseInt(endArg.split('=')[1], 10) : null;

// ---------------------- MAIN FUNCTION ----------------------

(async () => {
    const loginurl = 'https://auth.dealertrack.ca/idp/startSSO.ping?PartnerSpId=prod_dtc_sp_pingfed';
    const username = process.env.DEALERTRACK_USERNAME;
    const password = process.env.DEALERTRACK_PASSWORD;

    let fresh = true; 

    // Load already scraped deals (with valid tab_details)
    // This block check for the fully completed deals with all the tabs data 
    let completedDealTabIds = new Set();

    try {
        const existingData = await fs.readFile(OUTPUT_FILE, 'utf8');
        const parsed = JSON.parse(existingData);
        let total_tabs = 0;
        for (const deal of parsed) {
            for (const tab of deal.tabs || []) {
                total_tabs++;
                const tabDetails = tab.details?.tab_details;

                if (tabDetails && typeof tabDetails === 'object') {
                    const allSectionsInvalid = ['Applicant', 'Worksheet', 'Documents', 'Approval Conditions', 'Messages'].every(section => {
                        const val = tabDetails[section];

                        return (
                            val === undefined ||                               // Missing
                            typeof val === 'string' ||                         // String like "tab not available"
                            (typeof val === 'object' && val.error)             // Object with an error key
                        );
                    });

                    // If not all are invalid, then at least one is valid → consider tab complete
                    if (!allSectionsInvalid) {
                        completedDealTabIds.add(tab.id);
                    }
                }
            }
        }

        fresh = false;
        console.log(`📦 Skipping ${completedDealTabIds.size} fully scraped tab(s) out of total ${total_tabs}.`);
    } catch (e) {
        console.warn('⚠️ Could not read existing final-deal-data.json. Starting fresh...');
    }


    try{
        const browser   = await puppeteer.launch({ 
            headless:           false,  // Change it to true if you dont want to see wats happening in the browser window
            args:               ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport:    null,
            slowMo:             SLOW_MO,    // slow down to watch action
        //    devtools:           false,  // this enables us to inspect in browser when needed
            timeout:            0,      // no limit for browser launch
            protocolTimeout:    120000  // increase protocol timeout to 2 minutes
        });
        const page      = await browser.newPage();

        page.on('framenavigated', frame => {
            console.log('Navigated to:', frame.url());
          });
        
        // await page.goto(loginurl, { waitUntil: 'networkidle2' });

        // await page.screenshot({ path: 'initail-dashboard.png' });

        // await page.type('#username', username);
        // await page.type('#password', password);

        // await Promise.all([
        //     page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        //     //page.keyboard.press( 'Enter' )
        //     page.click('#signOnButton')
        // ]);

        await loginAndHandleMFA(page, { loginurl, username, password });

        await page.screenshot({ path: 'after-login-click.png' });

        // Wait after login, in case of redirect/transition
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await page.waitForFunction(
            () => window.location.href.includes('default1.aspx'),
            { timeout: 20000 }
          );
          

        page.frames().forEach(frame => {
            console.log(`Frame: ${frame.name()} - ${frame.url()}`);
        });


        if (page.url().includes('default1.aspx')) {
            console.log('Successfully reached the Dealertrack dashboard!');
            await page.screenshot({ path: 'final-dashboard.png' });
        
            // 🟡 Wait for frames to load
            await new Promise(resolve => setTimeout(resolve, 3000)); // Give frames time to initialize
        
            // 🧭 Identify all frames
            const frames = page.frames();
        
            let navFrame = frames.find(f => f.name() === 'nav');
            let mainFrame = frames.find(f => f.name() === 'main');
        
            if (!navFrame || !mainFrame) {
                throw new Error('Could not find nav or main frames.');
            }
        
            // 🟩 Click "Status" inside nav frame
            try {
                await navFrame.waitForSelector('#Status', { visible: true, timeout: 10000 });
                await navFrame.click('#Status');
                console.log('Clicked the "Status" link inside nav frame.');
            } catch (err) {
                console.error('Could not click "Status" in nav frame:', err);
                return;
            }
        
            // 🕒 Wait for the main frame to update
            try {
                // Wait for a known element or page URL inside the main frame
                await mainFrame.waitForFunction(() => {
                    return location.href.includes('StatusList_v3.aspx');
                }, { timeout: 15000 });
        
                // OR wait for a known selector inside Status page
                await mainFrame.waitForSelector('body', { timeout: 15000 });
        
                console.log('Status page loaded in main frame!');
        
                // 🖼 Take screenshot of main frame
                // const mainFrameContent = await mainFrame.content();
                
        
                // Scrap the status page content
                try {

                    // function to paginate and scrap the deal data to generate a json map

                    //let rowData = await utils.scrapeStatusPageWithPagination(page, INPUT_FILE);

                    // Skip pagination and load json map directely to rowData constant

                    let jsonString;

                    try {
                    //     if (fresh === true) {
                    //         jsonString = await fs.readFile(dataPath, 'utf8');
                    //         console.log("fresh start");
                    //     } else {
                    //         jsonString = await fs.readFile(OUTPUT_FILE, 'utf8');
                    //         console.log("updating missed data start");
                    //     }

                    //     rowData = JSON.parse(jsonString);


                        try {
                            jsonString = await fs.readFile(dataPath, 'utf8');
                            rowData = JSON.parse(jsonString);
                            console.log(`✅ Loaded ${rowData.length} deals from ${INPUT_FILE}`);
                        } catch (err) {
                            console.warn(`⚠️ ${INPUT_FILE} not found. Scraping fresh status data...`);
                            
                            rowData = await utils.scrapeStatusPageWithPagination(page, INPUT_FILE);

                            if (!rowData.length) {
                                throw new Error('❌ No deals found. Status page scraping failed.');
                            }

                            console.log(`✅ Fresh status data scraped: ${rowData.length} deals`);
                        }

                        //console.log(`✅ Loaded ${rowData.length} rows from existing ${fresh ? INPUT_FILE : OUTPUT_FILE}`);


                    } catch (err) {
                        console.warn(`⚠️ ${fresh ? INPUT_FILE : OUTPUT_FILE} not found or failed to load. Scraping fresh data...`);
                        rowData = await utils.scrapeStatusPageWithPagination(page, INPUT_FILE);
                    }

                    const selectedDeals = rowData
                    .slice(START_INDEX, END_INDEX || rowData.length)
                    .filter(deal => {
                        // Filter out if all its tabs are already scraped
                        const tabs = deal.tabs || [];
                        return tabs.some(tab => !completedDealTabIds.has(tab.id));
                    });
                    var count = 1 ;

                    console.log(`📊 Total deals in status-data.json: ${rowData.length}`);
                    console.log(`📊 Deals still needing scrape: ${selectedDeals.length}`);
                    console.log(`📊 Completed tabs so far: ${completedDealTabIds.size}`);


                    for (const deal of selectedDeals) {
                        console.log(`Processing deal ${count} of ${selectedDeals.length}`);
                        count++;
                        //for (const deal of rowData) {

                        // ✅ Ensure logged in before processing   

                        const reloginPerformed = await utils.ensureLoggedIn(page);
                        if (reloginPerformed) {
                            // refresh frame references
                            const frames = page.frames();
                            navFrame = frames.find(f => f.name() === 'nav');
                            mainFrame = frames.find(f => f.name() === 'main');

                            if (!navFrame || !mainFrame) {
                                throw new Error('❌ Could not find nav or main frames after re-login.');
                            }

                            // Navigate to Status page again
                            try {
                                await navFrame.waitForSelector('#Status', { visible: true, timeout: 10000 });
                                await navFrame.click('#Status');
                                console.log('🔁 Clicked Status link after re-login.');

                                await mainFrame.waitForFunction(() => location.href.includes('StatusList_v3.aspx'), { timeout: 15000 });
                                await mainFrame.waitForSelector('#divView3_datagrid', { timeout: 15000 });
                            } catch (err) {
                                console.error('❌ Failed to reload Status page after login:', err.message);
                                throw err;
                            }
                        }

                        console.log(`📄 Processing Deal: ${deal.Deal}`);

                        //scrap only specific record
        
                       //if(deal.Deal != "44485650"){
                        // if( !jumpDeal.includes(deal.Deal) ){
                        //     console.log(`📄 Jumping Deal: ${deal.Deal}`);
                        //     continue;
                        // }
                        const dealNumber = deal.Deal;

                        try {
                            await utils.searchDeal(mainFrame, deal.Deal);

                            for (const tab of deal.tabs) {
                                console.log(`  → Fetching tab details for ${tab.id}`);

                                // scrap only specific record
                                // if( tab.id != "44485650TDC2"){
                                //     console.log(`📄 Jumping tab: ${tab.id}`);
                                //     continue;
                                // }

                                const lenderName = tab.details.Lender;

                                try {
                                    await utils.clickTabById(mainFrame, tab.id, page);

                                    await new Promise(resolve => setTimeout(resolve, 2000));

                                    const tabFrame = await utils.getMainFrame(page);

                                    const tabDetails = await extractTabDetails(tabFrame, page, dealNumber, lenderName);

                                    tab.details.tab_details = tabDetails;

                                    console.log(`    ✅ Tab ${tab.id} scraped.`);

                                    ({ navFrame, mainFrame } = await utils.reloadStatusPage(page));


                                } catch (tabError) {
                                    console.error(`    ❌ Failed to scrape tab ${tab.id} for deal ${deal.Deal}:`, tabError.message);
                                    tab.details.tab_details = { error: tabError.message };

                                    ({ navFrame, mainFrame } = await utils.reloadStatusPage(page));
                                }
                            }

                            // to prevent losing data in case of crash parallely save data to json file. 

                            try {
                                // const existingJson = await fs.readFile(OUTPUT_FILE, 'utf8').catch(() => '[]');
                                // const existingDeals = JSON.parse(existingJson);
                                // existingDeals.push(deal);
                                // await fs.writeFile(OUTPUT_FILE, JSON.stringify(existingDeals, null, 2), 'utf8');
                                // console.log(`💾 Deal ${deal.Deal} saved to final-deal-data.json`);
                                
                                // this function update the final-deal-data.json preserving the uniquness in deals
                                await saveOrUpdateDeal(deal, OUTPUT_FILE);


                                // to upload single deal to google sheet 
                                // await uploadToSheet(GOOGLE_SHEET_ID, [deal]);

                            } catch (err) {
                                console.error(`❌ Failed to save deal ${deal.Deal}:`, err.message);
                            }

                            await clearFilter(mainFrame);
                        
                        } catch (dealError) {
                          console.error(`❌ Error processing deal ${deal.Deal}:`, dealError.message);
                        }
                    }

                    //await fs.writeFile(OUTPUT_FILE, JSON.stringify(rowData, null, 2), 'utf8');
                    //keep the “final write” for safety, also run it through the same deduplication:
                    
                    // await fs.writeFile(
                    // OUTPUT_FILE,
                    // JSON.stringify(
                    //     Array.from(new Map(rowData.map(d => [d.Deal, d])).values()), 
                    //     null, 
                    //     2
                    // ),
                    // 'utf8'
                    // );

                    // try {
                    //     const existingJson = await fs.readFile(OUTPUT_FILE, 'utf8').catch(() => '[]');
                    //     const existingDeals = JSON.parse(existingJson);

                    //     const dealMap = new Map(existingDeals.map(d => [d.Deal, d]));

                    //     // Merge scraped rowData (some updated, some untouched)
                    //     for (const deal of rowData) {
                    //         dealMap.set(deal.Deal, deal);
                    //     }

                    //     const mergedDeals = Array.from(dealMap.values());
                    //     await fs.writeFile(OUTPUT_FILE, JSON.stringify(mergedDeals, null, 2), 'utf8');
                    //     console.log(`✅ Final merged dataset saved: ${mergedDeals.length} deals`);
                    // } catch (err) {
                    //     console.error(`❌ Failed to write final dataset:`, err.message);
                    // }

                    console.log(`✅ Scraping completed and saved to ${OUTPUT_FILE}`);

                    uploadToSheet(GOOGLE_SHEET_ID, 'Deals');

                } catch (error) {
                    console.error('Error while extracting data:', error);
                }                

        
            } catch (err) {
                console.error('Failed to detect Status page in main frame:', err);
            }
        }

        await browser.close();
    } catch (error){
        console.error('login failed', error);
    }
})();

//----------------------Functions------------------------

async function extractTabDetails(frame, page, dealNumber, lenderName) {
    console.log("Extract tab details function accessed");
    const result = {};

    const safeScrape = async (label, fn) => {
        try {
            return await fn();
        } catch (err) {
            console.warn(` ⚠️ ${label} tab not found or failed: ${err.message} `);
            return `${label} tab not available`;
        }
    };
  
    result['Applicant']           = await safeScrape('Applicant',           () => scrapeApplicantTab(frame));
    result['Worksheet']           = await safeScrape('Worksheet',           () => scrapeWorksheetTab(frame));
    result['Documents']           = await safeScrape('Documents',           () => scrapeDocumentsTab(frame, page, dealNumber, lenderName));
    result['Approval Conditions'] = await safeScrape('Approval Conditions', () => scrapeApprovalConditionsTab(frame));
    result['Messages']            = await safeScrape('Messages',            () => scrapeMessagesTab(frame));
  
    return result;
  }
  
  async function clearFilter(frame) {
    try {
      const filterButton = await frame.$('#btnEnableFil');
      if (filterButton) {
        await filterButton.click();
        console.log('🔄 Filter button clicked, waiting for data grid...');
        
        // Wait for the main data grid to reload after filter is cleared
        await frame.waitForSelector('#divView3_datagrid', { timeout: 15000 });
        console.log('✅ Filter cleared and data grid loaded.');
      } else {
        console.log('ℹ️ Filter button not found — may already be cleared.');
      }
    } catch (error) {
      console.error('❌ Error clearing filter:', error.message);
    }
  }

  async function saveOrUpdateDeal(deal, outputFile) {
    try {
        const existingJson = await fs.readFile(outputFile, 'utf8').catch(() => '[]');
        const existingDeals = JSON.parse(existingJson);

        // Convert array into a map (Deal ID → deal object)
        const dealMap = new Map(existingDeals.map(d => [d.Deal, d]));

        // Update or insert the current deal
        dealMap.set(deal.Deal, deal);

        // Convert back to array
        const updatedDeals = Array.from(dealMap.values());

        await fs.writeFile(outputFile, JSON.stringify(updatedDeals, null, 2), 'utf8');
        console.log(`💾 Deal ${deal.Deal} saved/updated in ${outputFile}`);
    } catch (err) {
        console.error(`❌ Failed to save deal ${deal.Deal}:`, err.message);
    }
  }