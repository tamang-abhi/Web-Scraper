async function scrapeWorksheetTab(frame){

    console.log("scrapeWorksheetTab function accessed");
    // Click the tab button
    const button = await frame.$('#ctl22_btnWORKSHEET');
    if (!button) throw new Error('Button #ctl22_btnWORKSHEET not found');
    
    await button.click();
    
    await frame.waitForSelector('#ctl22_pnlWORKSHEET', { visible: true, timeout: 10000 });

    console.log('Worksheet section loaded');

    const data = await frame.evaluate(() => {

        const getInputValue = id => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const getSelectValue = id => {
            const el = document.getElementById(id);
            return el ? el.options[el.selectedIndex]?.text.trim() : '';
        };

        // const getDateOfBirth = () => {
        //     const mm = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_MM');
        //     const dd = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_DD');
        //     const yyyy = getInputValue('ctl22_ctl'+numberPart+'_ctl00_txtDateofBirth_YYYY');
        //     return `${mm}/${dd}/${yyyy}`;
        // };

        // const getDurationValue = (yId, mId) => {
        //   const y = getInputValue(yId);
        //   const m = getInputValue(mId);
        //   if(y || m){
        //     return `${y} years ${m} months`;
        //   }else{
        //     return '0';
        //   }
        // }

        // const getTelephoneWithExt = (phoneId, extId) => {
        //   const phoneNo = getInputValue(phoneId);
        //   const Ext = getInputValue(extId);

        //   if(Ext){
        //     return `${Ext} - ${phoneNo}`;
        //   }else{
        //     return phoneNo;
        //   }
        // }

        const getDate = (monthID, dateID, yearID) => {
            const MM    = getInputValue(monthID);
            const DD    = getInputValue(dateID);
            const YYYY  = getInputValue(yearID);

            if(MM || DD || YYYY){
                return `${MM}/${DD}/${YYYY}`;
            }else{
                return 0;
            }
        }

        const getText = (id) => {
            const text = document.getElementById(id);
            return text ? text.innerText.trim(): '';
        }

        let vehicleSelection = {
            VIN:                    getInputValue('ctl22_ctl23_ctl00_btnVINLookup'),
            Stock:                  getInputValue('ctl22_ctl23_ctl00_txtStockNumber'),
            ResidualMonth:          getSelectValue('ctl22_ctl23_ctl00_ddlResidualMonth'),
            Condition:              getSelectValue('ctl22_ctl23_ctl00_ddlVehicleCondition'),
            Year:                   getSelectValue('ctl22_ctl23_ctl00_ddlVehicleYear'),
            Make:                   getSelectValue('ctl22_ctl23_ctl00_ddlVehicleMake'),
            Model:                  getSelectValue('ctl22_ctl23_ctl00_ddlVehicleModel'),
            Series:                 getSelectValue('ctl22_ctl23_ctl00_ddlVehicleSeries'),
            BodyStyle:              getSelectValue('ctl22_ctl23_ctl00_ddlVehicleBodyStyle'),
            Includes:               getSelectValue('ctl22_ctl23_ctl00_ddlVehicleIncludes'),
            CurrentKMs:             getInputValue('ctl22_ctl23_ctl00_txtCurrentKMs'),
        };

        let additionalLenderInformation = {
            LoyalityNumber:         getInputValue('ctl22_ctl24_ctl00_txtAeroplanNumber'),
            MSRP:                   getInputValue('ctl22_ctl24_ctl00_txtMSRP'),
            CashForigenRebate:      getInputValue('ctl22_ctl24_ctl00_txtRebate'),
        };

        let programSelection = {
            Program:                getSelectValue('ctl22_ctl25_ctl00_ddlProgram')
        };

        let decesionDetails = {
            ProgramApproval:        getText('ctl22_ctl26_ctl00_lblProgramApprovalValue'),
            AsLowAs:                getText('ctl22_ctl26_ctl00_lblAnnualInterestRateValue')
        };

        let purchaseDetails = {
            CashPrice:              getInputValue(''),
            DeliveryDate:           getDate('ctl22_ctl26_ctl00_txtDeliveryDate_MM','ctl22_ctl26_ctl00_txtDeliveryDate_DD','ctl22_ctl26_ctl00_txtDeliveryDate_YYYY'),
        };

        let tradeIn = {
            Year:                   getInputValue('ctl22_ctl28_ctl00_txtYear'),
            Make:                   getInputValue('ctl22_ctl28_ctl00_txtMake'),
            Model:                  getInputValue('ctl22_ctl28_ctl00_txtModel'),
            BodyStyle:              getInputValue('ctl22_ctl28_ctl00_txtBodyStyle'),
            Vin:                    getInputValue('ctl22_ctl28_ctl00_txtVIN'),
            Odometer:               getInputValue('ctl22_ctl28_ctl00_txtMileage'),
            Allowance:              getInputValue('ctl22_ctl28_ctl00_txtAllowance')
        };

        let lien = {
            LienAmount:             getInputValue('ctl22_ctl29_ctl00_txtLienAmount'),
            BalanceOwedTo:          getInputValue('ctl22_ctl29_ctl00_txtBalanceOwedTo'),
            NetTradeInAllowance:    getInputValue('ctl22_ctl29_ctl00_txtNetTradeInAllowance')
        };

        let taxes = {
            Province:               getSelectValue('ctl22_ctl29_ctl00_ddlProvince'),
            PST:                    { 
                                        PST:                getSelectValue('ctl22_ctl29_ctl00_ddlPST'), 
                                        ExemptionReason:    getSelectValue('ctl22_ctl29_ctl00_ddlPSTExemption'), 
                                        Amount :            getInputValue('ctl22_ctl29_ctl00_txtPST') 
                                    },
            GSTHST:                 { 
                                        "GST/HST":          getSelectValue('ctl22_ctl29_ctl00_ddlGSTHST'), 
                                        ExemptionReason:    getSelectValue('ctl22_ctl29_ctl00_ddlGSTExemption'), 
                                        Amount:             getInputValue('ctl22_ctl29_ctl00_txtGSTHST') 
                                    },
            FederalLuxuryTax:       getInputValue('ctl22_ctl29_ctl00_txtLuxuryTax')
        };

        let frees = {
            CashDown:               getInputValue('ctl22_ctl30_ctl00_txtCashDownPayment'),
            Rebate:                 getInputValue('ctl22_ctl30_ctl00_txtRebate'),
            InstalationAndDelivery: getInputValue('ctl22_ctl30_ctl00_txtInstallationDelivery'),
            LicenseFee:             getInputValue('ctl22_ctl30_ctl00_txtLicenseFee'),
            DealerAdminFee:         getInputValue('ctl22_ctl30_ctl00_txtDealerAdminFee'),
            LenderAdminFee:         getInputValue('ctl22_ctl30_ctl00_txtLenderAdminFee'),
            OtherTaxable:           getInputValue('ctl22_ctl30_ctl00_txtOtherTaxable'),
            OtherTaxableDescription:getInputValue('ctl22_ctl30_ctl00_txtOtherTaxableDesc'),
            OtherNonTaxable:        getInputValue('ctl22_ctl30_ctl00_txtOtherNonTaxable'),
            OtherNonTaxableDescription:getInputValue('ctl22_ctl30_ctl00_txtOtherNonTaxableDesc'),
            PPSA:                   getInputValue('ctl22_ctl30_ctl00_txtRegistrationFee')
        };

        let aftermarketService = {
            ExtendexServiceContract:getInputValue('ctl22_ctl31_ctl00_txtExtendedWarranty'),
            LifeInsurance:          getInputValue('ctl22_ctl31_ctl00_txtLifeInsurance'),
            "A/H_Insurance":        getInputValue('ctl22_ctl31_ctl00_txtAHInsurance'),
            TaxesOnInsaurance:      getInputValue('ctl22_ctl31_ctl00_txtTaxesOnInsurance')
        };

        let deferralAndPaymentDateOptions = {
            DeferralType:                   getSelectValue('ctl22_ctl32_ctl00_CDeferralHandlingOptionDropDown1'),
            TimeToFirstPayment:             getInputValue('ctl22_ctl32_ctl00_txtDeferralUnitValue')+" Days",
            EndPaymentDate:                 getDate(
                                                'ctl22_ctl32_ctl00_diEndPaymentDate_MM', 
                                                'ctl22_ctl32_ctl00_diEndPaymentDate_DD', 
                                                'ctl22_ctl32_ctl00_diEndPaymentDate_YYYY'
                                            ),
            DateOfAdvance:                  getDate(
                                                'ctl22_ctl32_ctl00_diDateOfAdvance_MM',
                                                'ctl22_ctl32_ctl00_diDateOfAdvance_DD',
                                                'ctl22_ctl32_ctl00_diDateOfAdvance_YYYY'
                                            ),
            MonthalyFirstPaymentDate:       getDate(
                                                'ctl22_ctl32_ctl00_diMonthlyFirstPaymentDay_MM',
                                                'ctl22_ctl32_ctl00_diMonthlyFirstPaymentDay_DD',
                                                'ctl22_ctl32_ctl00_diMonthlyFirstPaymentDay_YYYY'
                                            ),
            NonMOnthalyFirstPaymentDate:    getDate(
                                                'ctl22_ctl32_ctl00_diNonMonthlyFirstPaymentDate_MM',
                                                'ctl22_ctl32_ctl00_diNonMonthlyFirstPaymentDate_DD',
                                                'ctl22_ctl32_ctl00_diNonMonthlyFirstPaymentDate_YYYY'
                                            ),
            DeferredInterest:               getInputValue('ctl22_ctl32_ctl00_txtDeferralInterest')
        };

        let financingTerms = {
            Term:                           getSelectValue('ctl22_ctl33_ctl00_CTermDropDown1'),
            Amortization:                   getSelectValue('ctl22_ctl33_ctl00_CAmortizationPeriodDropDown1'),
            PaymetnFrequency:               getSelectValue('ctl22_ctl33_ctl00_CPaymentFrequencyDropDown1'),
            InterestRate:                   getSelectValue('ctl22_ctl33_ctl00_CInterestRateDropDown1'),
            DealerInterestRate:             getInputValue('ctl22_ctl33_ctl00_txtDealerInterestRate'),
            ActialInterestRate:             getInputValue('ctl22_ctl33_ctl00_txtActualIntrestRate'),
            CostOfborrowing:                getInputValue('ctl22_ctl33_ctl00_txtCostOfBorrowing'),
            BuyDownAmount:                  getInputValue('ctl22_ctl33_ctl00_txtBuyDownAmt'),
            PrincipleOutstandingAtTermEnd:  getInputValue('ctl22_ctl33_ctl00_txtPrincipalOutstanding'),
            PaymentFrequencyAmount:         getInputValue('ctl22_ctl33_ctl00_txtPaymentFrequencyAmt'),
            TotalAmountFinanced:            getInputValue('ctl22_ctl33_ctl00_txtTotalAmtFinanced'),
            TotalMonthalyPayment:           getInputValue('ctl22_ctl33_ctl00_txtTotalMonthlyPayment')
        };

        let dealerAdvice = {
            AmountToFinance:                getInputValue('ctl22_ctl34_ctl00_txtAmountToFinance'),
            RegistrationAndSetUpCost:       getInputValue('ctl22_ctl34_ctl00_txtRegistrationSetupCost'),
            DealerParticipation:            getInputValue('ctl22_ctl34_ctl00_txtDealerParticipation'),
            DealerExtraTotal:               getInputValue('ctl22_ctl34_ctl00_txtDealerExtraTotal'),
            AdvanceToDealer:                getInputValue('ctl22_ctl34_ctl00_txtAdvanceToDealer')
        }

        return {
            vehicleSelection,
            additionalLenderInformation,
            programSelection,
            decesionDetails,
            purchaseDetails,
            tradeIn,
            lien,
            taxes,
            frees,
            aftermarketService,
            deferralAndPaymentDateOptions,
            financingTerms,
            dealerAdvice
        };

    });

    return data;
} 

module.exports = { scrapeWorksheetTab };