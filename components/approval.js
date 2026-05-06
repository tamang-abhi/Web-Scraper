async function scrapeApprovalConditionsTab(frame) {
    console.log("scrapeApprovalConditionsTab function accessed");

    // Click tab
    const button = await frame.$('#ctl22_btnAPPROVALCONDITIONS');
    if (!button) throw new Error('Button #ctl22_btnAPPROVALCONDITIONS not found');
    await button.click();
    await frame.waitForSelector('#ctl22_pnlAPPROVALCONDITIONS', { visible: true, timeout: 10000 });

    const data = await frame.evaluate(() => {
        const getStatus = () => {
            const el = document.querySelector('[id$="_lblStatus"]');
            if (!el) {
                console.warn('Status element not found');
                return '';
            }
            const innerSpan = el.querySelector('span');
            return innerSpan ? innerSpan.innerText.trim() : el.innerText.trim();
        };

        const getByLabelIdEndsWith = (suffix) => {
            const el = document.querySelector(`[id$="${suffix}"]`);
            return el ? el.innerText.trim() : '';
        };

        const deal = {
            Status: getStatus(),
            ContractType: getByLabelIdEndsWith('_lblContractType'),
            lender: getByLabelIdEndsWith('_lblLender'),
            LenderReference: getByLabelIdEndsWith('_lblLenderRefNo'),
            DealerName: getByLabelIdEndsWith('_lblDealerName'),
            CustomerName: getByLabelIdEndsWith('_lblCustomerName'),
            CoAplicantName: getByLabelIdEndsWith('_lblCoApplicantName'),
            LastmodifiedOn: getByLabelIdEndsWith('_lblLastModified')
        };

        const vehicleInformation = {
            Condition: getByLabelIdEndsWith('_lblCondition'),
            VIN: getByLabelIdEndsWith('_lblVIN'),
            Model: getByLabelIdEndsWith('_lblModel'),
            Odometer: getByLabelIdEndsWith('_lblOdometer')
        };

        const lenderInformation = {
            AmountFinanced: getByLabelIdEndsWith('_lblAmtFinanced'),
            PaymentFrequency: getByLabelIdEndsWith('_lblPaymentFrequency'),
            TermOfBorrowing: getByLabelIdEndsWith('_lblTermOfBorrowing'),
            Amortization: getByLabelIdEndsWith('_lblAmortizationPeriod'),
            LenderComments: getByLabelIdEndsWith('_lblLenderComments'),
            AnnualInterestRate: getByLabelIdEndsWith('_lblAnnualInterestRate'),
            ResidualValue: getByLabelIdEndsWith('_lblResidualValue'),
            Installmentpayment: getByLabelIdEndsWith('_lblInstallmentPayment')
        };

        const conditions = {
            Conditions: getByLabelIdEndsWith('_divConditionsText')
        };

        return { deal, vehicleInformation, lenderInformation, conditions };
    });

    return data;
}

module.exports = { scrapeApprovalConditionsTab };
