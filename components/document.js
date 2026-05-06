const fs = require('fs');
const path = require('path');
const axios = require('axios');
const uploadToDrive = require('./uploadToDrive');

const PDF_SAVE_PATH = path.join(__dirname, '../pdfs');

async function downloadAndUploadPDF(pdfUrl, cookies, dealNumber, lenderName, documentName) {
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    try {
        const response = await axios.get(pdfUrl, {
            headers: { Cookie: cookieHeader },
            responseType: 'arraybuffer',
        });

        const fileName = `document_${documentName}.pdf`;
        const filePath = path.join(PDF_SAVE_PATH, fileName);
        fs.writeFileSync(filePath, response.data);

        const driveLink = await uploadToDrive(filePath, fileName, dealNumber, lenderName);

        fs.unlinkSync(filePath);
        return driveLink;
    } catch (error) {
        console.error("❌ Failed to download/upload PDF:", pdfUrl, error.message);
        return null;
    }
}

async function scrapeDocumentsTab(frame, page, dealNumber, lenderName) {
    console.log("✅ scrapeDocumentsTab function accessed");

    const button = await frame.$('#ctl22_btnDOCUMENTS');
    if (!button) throw new Error('Button #ctl22_btnDOCUMENTS not found');
    await button.click();
    await frame.waitForSelector('#ctl22_pnlDOCUMENTS', { visible: true, timeout: 10000 });

    const applicantPDFLinks = await frame.$$eval(
        'input[type="submit"][onclick*="Application_OnCEMConsentFormButtonClick"]',
        (buttons) =>
            buttons
                .map((button, index) => {
                    if (button.disabled) return null; // 🚫 Skip disabled buttons

                    const onclick = button.getAttribute('onclick');
                    const match = onclick.match(
                        /Application_OnCEMConsentFormButtonClick\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\)/
                    );
                    if (!match) return null;

                    const [, language, email, programCategory, numberOfConsumer] = match;

                    return {
                        index,
                        email,
                        pdfUrl: `https://www.dealertrack.ca/DTCanada/Core/Application/Application_CEM_ConsentForm.aspx?language=en-CA&email=${encodeURIComponent(
                            email
                        )}&programcategory=${programCategory}&numberofconsumer=${numberOfConsumer}`,
                    };
                })
                .filter(Boolean) // ✅ Keep only valid and enabled buttons
    );


    // Download and upload each PDF
    const cookies = await page.cookies();

    const uploadedApplicantDocs = await Promise.all(applicantPDFLinks.map(async ({ index, email, pdfUrl }) => {
        let documentName = "Applicant_"+index+"_concent_for_commercial_electronic_messages";
        const link = await downloadAndUploadPDF(pdfUrl, cookies, dealNumber, lenderName, documentName);
        return { index, email, link };
    }));


    // Step 1: Download PDFs BEFORE evaluating in browser context
   // const cookies = await page.cookies();

    const documentPDFLink = await downloadAndUploadPDF(
        "https://www.dealertrack.ca/DTCanada/Core/Application/Application_ConsentForm.aspx?language=en-CA",
        cookies,
        dealNumber,
        lenderName,
        'Concent_Form'
    );
    const quebecPDFLink = await downloadAndUploadPDF(
        "https://www.dealertrack.ca/DTCanada/Core/Application/Application_Consent_QuebecResident.aspx?language=en-CA",
        cookies,
        dealNumber,
        lenderName,
        'Concent_For_QC_residents'
    );


    // Extract Lender Consent document URL and download it
    const lenderConsentUrl = await frame.evaluate(() => {
        const button = document.querySelector('[id$="btnLenderSpecific"]');
        if (!button) return null;

        const onclickAttr = button.getAttribute('onclick');
        const match = onclickAttr?.match(/Application_OnLenderConsentFormButtonClick\('([^']+)',\s*'([^']+)'\)/);
        if (!match) return null;

        const [_, languageSelectId, languageDocPairs] = match;
        const select = document.getElementById(languageSelectId);
        if (!select) return null;

        const selectedLang = select.value; // e.g., "en-CA" or "fr-CA"
        const langMap = Object.fromEntries(languageDocPairs.split('||').map(pair => {
            const [lang, docId] = pair.split(':');
            return [lang.trim(), docId.trim()];
        }));

        const docId = langMap[selectedLang];
        if (!docId) return null;

        return `https://www.dealertrack.ca/DTCanada/Core/Application/Application_print_one.aspx?DocID=${docId}&type=F&DocTypeID=undefined&language=en-CA&printAll=undefined`;
    });


    let lenderConsentLink = null;
    if (lenderConsentUrl) {
        lenderConsentLink = await downloadAndUploadPDF(
            lenderConsentUrl,
            cookies,
            dealNumber,
            lenderName,
            'Lender_Specific_Consent'
        );
    }

    // Extract Applicant Credit App document URL and download it
    const applicantCreditAppUrl = await frame.evaluate(() => {
        const button = document.querySelector('[id$="btnApplicantCreditApp"]');
        if (!button) return null;

        const onclickAttr = button.getAttribute('onclick');
        const match = onclickAttr?.match(/Application_OnLenderConsentFormButtonClick\('([^']+)',\s*'([^']+)'\)/);
        if (!match) return null;

        const [_, languageSelectId, languageDocPairs] = match;
        const select = document.getElementById(languageSelectId);
        if (!select) return null;

        const selectedLang = select.value; // e.g., "en-CA" or "fr-CA"
        const langMap = Object.fromEntries(languageDocPairs.split('||').map(pair => {
            const [lang, docId] = pair.split(':');
            return [lang.trim(), docId.trim()];
        }));

        const docId = langMap[selectedLang];
        if (!docId) return null;

        return `https://www.dealertrack.ca/DTCanada/Core/Application/Application_print_one.aspx?DocID=${docId}&type=F&DocTypeID=undefined&language=${selectedLang}&printAll=undefined`;
    });

    let applicantCreditAppLink = null;
    if (applicantCreditAppUrl) {
        applicantCreditAppLink = await downloadAndUploadPDF(
            applicantCreditAppUrl,
            cookies,
            dealNumber,
            lenderName,
            'Applicant_Credit_Application'
        );
    }

    const supplementalUrl = await frame.evaluate(() => {
        const button = document.querySelector('[id$="ctl08"]'); // or use full ID
        if (!button) return null;

        const onclickAttr = button.getAttribute('onclick');
        if (!onclickAttr) return null;

        // Extract the DocID and language using RegEx
        const docIdMatch = onclickAttr.match(/onPDFViewRequest\('(\d+)'/);
        const langMatch = onclickAttr.match(/,\s*([^,]+)\);/);

        if (!docIdMatch || !langMatch) return null;

        const docId = docIdMatch[1];
        //const language = langMatch[1].replace(/['"]/g, '');

        return `https://www.dealertrack.ca/DTCanada/Core/Application/Application_print_one.aspx?DocID=${docId}&type=P&DocTypeID=5&language=en-CA&printAll=undefined&copies=undefined`;
    });

    let supplementalNoticeLink = null;
    if (supplementalUrl) {
        supplementalNoticeLink = await downloadAndUploadPDF(supplementalUrl, cookies, dealNumber, lenderName, 'Supplemental_Decline_Notice');
    }


    // Step 2: Scrape the rest of the content from the page
    const scrapedData = await frame.evaluate((uploadedDocs) => {
        const getCheckboxValue = (suffix) => {
            const checkbox = document.querySelector(`[id$="${suffix}"]`);
            return checkbox ? checkbox.checked : null;
        };

        const getText = (suffix) => {
            const text = document.querySelector(`[id$="${suffix}"]`);
            return text ? text.innerText.trim() : '';
        };

        const getYesNoValue = (suffixYes, suffixNo) => {
            const yesBox = document.querySelector(`[id$="${suffixYes}"]`);
            const noBox = document.querySelector(`[id$="${suffixNo}"]`);
            if (yesBox?.checked) return "YES";
            if (noBox?.checked) return "NO";
            return null;
        };

        const ConcentToLaw25 = {
            checked: getCheckboxValue('ctl00_chkBViewed'),
            text: getText('ctl00_lblBViewed'),
        };

        const AutoDecisioningConsent = {
            Cncent: getText('ctl00_lblCosentDesc'),
        };

        const ConsentOfMakingOffer = {
            text1: getText('ctl00_lblTPDSConsent'),
            checked1: getYesNoValue('ctl00_chkTPDSYesNo_0', 'ctl00_chkTPDSYesNo_1'),
            text2: getText('ctl00_lblTraderEMConsent'),
            checked2: getYesNoValue('ctl00_chkTraderEMYesNo_0', 'ctl00_chkTraderEMYesNo_1'),
        };

        const ConcentToReceiveElectronicMessages = {};
        let index = 0;
        while (true) {
            const nameEl = document.querySelector(`[id$="ctl00_lblApplicant${index}"]`);
            if (!nameEl) break;

            const name = nameEl.innerText.trim();
            const yesBox = document.querySelector(`[id$="ctl00_rdoApplicantCEMConsentYesNo${index}_0"]`);
            const noBox = document.querySelector(`[id$="ctl00_rdoApplicantCEMConsentYesNo${index}_1"]`);

            let value = null;
            if (yesBox?.checked) value = "Yes";
            else if (noBox?.checked) value = "No";

            const uploadedDoc = uploadedDocs.find(d => d.index === index);

            ConcentToReceiveElectronicMessages[`applicant${index + 1}`] = {
                name,
                value,
                document: uploadedDoc ? uploadedDoc.link : null
            };
            index++;
        }

        const ConcentToCreditInvestigation = {
            Concent: getCheckboxValue('ctl22_ctl22_ctl00_chkViewed'),
        };

        return {
            Concent_To_Credit_Investigation: ConcentToCreditInvestigation,
            Concent_To_Law_25: ConcentToLaw25,
            Auto_Decisioning_Consent: AutoDecisioningConsent,
            Consent_Of_Making_Offer: ConsentOfMakingOffer,
            Concent_To_Receive_Electronic_Messages: ConcentToReceiveElectronicMessages
        };
    }, uploadedApplicantDocs);

    // Step 3: Inject external values (PDF links) into the result
    scrapedData.Concent_To_Credit_Investigation.ConcentFormPDF = documentPDFLink;
    scrapedData.Concent_To_Credit_Investigation.QOREsidenceConcentForm = quebecPDFLink;
    scrapedData.Concent_To_Credit_Investigation.LenderSpecificConsent = lenderConsentLink;
    scrapedData.Concent_To_Credit_Investigation.ApplicantCreditApplication = applicantCreditAppLink;
    scrapedData.Documents = {
        SupplementalDeclineNotice: supplementalNoticeLink
    };
    return scrapedData;
}

module.exports = { scrapeDocumentsTab };
