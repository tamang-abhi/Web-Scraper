async function scrapeApplicantTab(frame){
    console.log("scrapeApplicantTab function accessed");
    // Click the tab button
    const button = await frame.$('#ctl22_btnAPPLICANT');
    if (!button) {
      console.warn('⚠️ Applicant tab button not found, skipping...');
      return { error: 'Applicant tab not found' };
    }
    await button.click();
    
    await frame.waitForSelector('#ctl22_pnlAPPLICANT', { visible: true, timeout: 10000 });

    console.log("Applicant section loaded");
    
    // Evaluate to collect applicant button IDs
    const applicantButtonIds = await frame.evaluate(() => {
      const panel = document.getElementById('ctl22_pnlAPPLICANT');
      if (!panel) return [];
      const outerTable = panel.querySelector('table');
      if (!outerTable) return [];
      
      const firstInnerTable = outerTable.querySelector('table');
      if (!firstInnerTable) return [];

      const tdList = Array.from(firstInnerTable.querySelectorAll('tr:first-child td'));
      const uniqueIds = new Set();

      tdList.forEach(td => {
        // pick only <a> with id matching APP\d+
        const btn = Array.from(td.querySelectorAll('a')).find(a => /btnAPP\d+/.test(a.id));
        if (btn && btn.id) {
          uniqueIds.add(btn.id);
        }
      });

      return Array.from(uniqueIds);

    });

    console.log(`Found applicant buttons: ${applicantButtonIds.join(', ')}`);

    const results = {};

    for (let i = 0; i < applicantButtonIds.length; i++) {
      const btnId = applicantButtonIds[i];
      const appNum = i + 1;
      const panelId = `#ctl22_pnlAPP${appNum}`;

      // finding and clicking the applicant buutton
      if (i > 0) {
        console.log(`Switching to Applicant_${appNum}`);
        console.log(`The button id about to be clicked is ${btnId}`);
        const btn = await frame.$(`#${btnId}`);
        if (!btn) {
          console.warn(`⚠️ Button ${btnId} not found, skipping Applicant_${appNum}`);
          results[`Applicant_${appNum}`] = { error: `Button ${btnId} not found` };
          continue;
        }
        await btn.click();
        await frame.waitForSelector(panelId, { visible: true, timeout: 10000 });
      }

      console.log(`Scraping Applicant_${appNum}`);

      // Extract data for this applicant

      const data = await frame.evaluate((appNum) => {

        const recomputeNumberPart = (appNum) => {
          let panel = document.getElementById(`ctl22_pnlAPP${appNum}`);
          if (!panel) return 0;

          // Find the input with id like ctl22_ctl??_ctl00_chkPrimary
          const input = panel.querySelector('input[id*="_chkPrimary"]');
          if (!input) return 0;

          const id = input.id;
          const match = id.match(/ctl22_ctl(\d+)_ctl00_chkPrimary/);
          if (!match) return 0;

          return parseInt(match[1], 10);
        };

        let numberPart = recomputeNumberPart(appNum);
        if (!numberPart) {
          return { error: 'Could not determine number part for this applicant' };
        }

        const getInputValue = id => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const getSelectValue = id => {
            const el = document.getElementById(id);
            return el ? el.options[el.selectedIndex]?.text.trim() : '';
        };

        const getDateOfBirth = () => {
            const mm = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_MM');
            const dd = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_DD');
            const yyyy = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_YYYY');
            return `${mm}/${dd}/${yyyy}`;
        };

        const getDurationValue = (yId, mId) => {
          const y = getInputValue(yId);
          const m = getInputValue(mId);
          if(y || m){
            return `${y} years ${m} months`;
          }else{
            return '0';
          }
        }

        const getTelephoneWithExt = (phoneId, extId) => {
          const phoneNo = getInputValue(phoneId);
          const Ext = getInputValue(extId);

          if(Ext){
            return `${Ext} - ${phoneNo}`;
          }else{
            return phoneNo;
          }
        }

        let personalInformation = {
            Salutation:               getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlSalutation'),
            Suffix:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlSuffix'),
            Gender:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlGender'),
            FirstName:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtFirstName'),
            MiddleName:               getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtMiddleName'),
            LastName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtLastName'),
            SIN:                      getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtSIN'),
            MaritalStatus:            getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlMaritalStatus'),
            Phone:                    getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtPhone'),
            MobilePhone:              getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtMobilePhone'),
            Email:                    getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtEmail'),
            DateOfBirth:              getDateOfBirth(),
            RelationToPrimary:        getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlRelation'),
            LanguageOfCorrespondence: getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlLanguage')
        };

        numberPart += 1; // further incrementing the id number to match the id of form fields

        let currentAddress = {
          PostalCode:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtPostalCode'),
          AddressType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlAddressType'),
          StreetName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetName'),
          City:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtCity'),
          SuitNo:                     getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtSuiteNumber'),
          StreetType:                 getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStreetType'),
          Province:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlProvince'),
          AddressNo:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetNumber'),
          Direction:                  getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlDirection'),
          Duration:                   getDurationValue('ctl22_ctl'+numberPart+'_ctl00_CDurationCurrentAddress_Y','ctl22_ctl'+numberPart+'_ctl00_CDurationCurrentAddress_M'),
        }

        numberPart += 1;

        let previousAddress = {
          PostalCode:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtPostalCode'),
          AddressType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlAddressType'),
          StreetName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetName'),
          City:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtCity'),
          SuitNo:                     getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtSuiteNumber'),
          StreetType:                 getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStreetType'),
          Province:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlProvince'),
          AddressNo:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetNumber'),
          Direction:                  getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlDirection'),
          Duration:                   getDurationValue('ctl22_ctl'+numberPart+'_ctl00_CDurationPreviousAddress_Y','ctl22_ctl'+numberPart+'_ctl00_CDurationPreviousAddress_M')
        }

        numberPart += 1;

        let homeMortgageDetails = {
          Home:                       getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlHome'),
          MortgageAmount:             getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtMortgageAmount'),
          MonthalyPayment:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtMonthlyPayment'),
          MarketValue:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtmarketValue'),
          Landlord:                   getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtMortgageHolder')
        }

        numberPart += 1;

        let currentEmployment = {
          Type:                       getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlTypeCurEmp'),
          AddressType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlAddressTypeCurEmp'),
          Direction:                  getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlDirectionCurEmp'),
          Employer:                   getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtEmployerCurEmp'),
          SuitNo:                     getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtSuiteNumberCurEmp'),
          City:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00__txtCityCurEmp'),
          Status:                     getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStatusCurEmp'),
          AddressNo:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetNumberCurEmp'),
          Province:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00__ddlProvinceCurEmp'),
          Occupation:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOccupationCurEmp'),
          StreetName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetNameCurEmp'),
          PostalCode:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtPostalCodeCurEmp'),
          Duration:                   getDurationValue('ctl22_ctl'+numberPart+'_ctl00_CDurationCurrentEmployerAddress_Y','ctl22_ctl'+numberPart+'_ctl00_CDurationCurrentEmployerAddress_M'),
          StreetType:                 getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStreetTypeCurEmp'),
          Telephone:                  getTelephoneWithExt('ctl22_ctl'+numberPart+'_ctl00_txtTelephoneCurEmp','ctl22_ctl'+numberPart+'_ctl00_txtExtensionCurEmp'),
        }

        numberPart += 1;

        let previousEmployement = {
          Type:                       getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlType'),
          AddressType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlAddressType'),
          Direction:                  getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlDirection'),
          Employer:                   getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtEmployer'),
          SuitNo:                     getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtSuiteNumber'),
          City:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtCity'),
          Status:                     getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStatus'),
          AddressNo:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetNumber'),
          Province:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlProvince'),
          Occupation:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOccupation'),
          StreetName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtStreetName'),
          PostalCode:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtPostalCode'),
          Duration:                   getDurationValue('ctl22_ctl'+numberPart+'_ctl00_CDurationPreviousEmployerAddress_Y','ctl22_ctl'+numberPart+'_ctl00_CDurationPreviousEmployerAddress_M'),
          StreetType:                 getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlStreetType'),
          Telephone:                  getTelephoneWithExt('ctl22_ctl'+numberPart+'_ctl00_txtTelephone','ctl22_ctl'+numberPart+'_ctl00_txtExtension'),        
        }

        numberPart += 1;

        let incomeDetails = {
          GrossIncome:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtGrossIncome'),
          OtherIncomeType:            getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherIncomeType'),
          per:                        getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlIncomeBasis'),
          OtherIncome:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherIncome'),
          per:                        getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherIncomeBasis'),
          Description:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherDescription'),
          AnnualTotal:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtAnnualTotal'),
        }

        numberPart += 1;

        let financialSummary = {
          Bank:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankName'),
          Phone:                      getTelephoneWithExt('ctl22_ctl'+numberPart+'_ctl00_txtBankPhone','ctl22_ctl'+numberPart+'_ctl00_txtBankPhoneExt'),
          ContactName:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankContactName'),
          Fax:                        getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankFax'),
          FinancialStatementsAvailableYearEnding: getDurationValue('ctl22_ctl'+numberPart+'_ctl00_txtStmtYear','ctl22_ctl'+numberPart+'_ctl00_txtStmtMonth'),
          BankName:                   getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankInfo'),
          BankNumber:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankNumber'),
          AccountType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlAccountType'),
          AccountNumber:              getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtAccountNumber'),
          BranchNumber:               getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBranchNumber'),
          AddressType:                getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlBankAddressType'),
          Direction:                  getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlBankDirection'),
          SuitNo:                     getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankSuiteNumber'),
          City:                       getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankCity'),
          AddressNo:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankStreetNo'),
          Province:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlBankProvince'),
          StreetName:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankStreetName'),
          PostalCode:                 getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtBankPostalCode'),
          StreetType:                 getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlBankStreetType')
        }

        numberPart += 1;

        let AssetsAndLiabilities = {
          Assets: {
            Type_1:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherAssetsType1'),
            Description_1:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherAssetDescription1'),
            Value_1:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherAssetsValue1'),
            Type_2:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherAssetsType2'),
            Description_2:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherAssetDescription2'),
            Value_2:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherAssetsValue2'),
          },
          Liabilities: {
            Type_1:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherLiablitiesType1'),
            Description_1:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitesDescription1'),
            MonthalyPayment_1:        getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesMonthlyPay1'),
            Balance:                  getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesBalance1'),
            Type_2:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherLiablitiesType2'),
            Description_2:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitesDescription2'),
            MonthalyPayment_2:        getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesMonthlyPay2'),
            Balance_2:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesBalance2'),
            Type_3:                   getSelectValue('ctl22_ctl'+numberPart+'_ctl00_ddlOtherLiablitiesType3'),
            Description_3:            getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitesDescription3'),
            MonthalyPayment_3:        getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesMonthlyPay3'),
            Balance_3:                getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtOtherLiabilitiesBalance3'),
          }
        }

        return {
          "Personal Information"    : personalInformation,
          "Current Address"         : currentAddress,
          "Previous Address"        : previousAddress,
          "Home\Mortgage Details"   : homeMortgageDetails,
          "Current Employment"      : currentEmployment,
          "Previous Employment"     : previousEmployement,
          "Income Details"          : incomeDetails, 
          "Financial Summary"       : financialSummary,
          "Assets and Liabilities"  : AssetsAndLiabilities,
        };

      }, appNum);

      results[`Applicant_${appNum}`] = data;

    }

    //console.log("✅All Applicant data scraped:", results);
    return results;
} 


module.exports = { scrapeApplicantTab };