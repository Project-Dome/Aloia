/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([
        "N/ui/dialog",
        "../modules/pd_cvs_utils.module",
        "../modules/pd_cvs_search.module"
    ],

    function(dialog, utilsModule, searchModule) {

        let lineSnapshot = {};

        function lineInit(scriptContext) {
            const { currentRecord, sublistId } = scriptContext;
            if (sublistId !== "item") return;

            const lineNum = currentRecord.getCurrentSublistIndex({ sublistId: "item" });
            lineSnapshot[lineNum] = { dirty: false };
        }

        function fieldChanged(scriptContext) {

            try {

                const { currentRecord, fieldId, sublistId } = scriptContext;

                if (sublistId !== "item") return;

                const getVal = (field) => currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: field });
                const setVal = (field, value) => currentRecord.setCurrentSublistValue({ sublistId: "item", fieldId: field, value });

                if (fieldId === "quantity" || fieldId === "amount") {
                    const lineNum = currentRecord.getCurrentSublistIndex({ sublistId: "item" });
                    if (!lineSnapshot[lineNum]) lineSnapshot[lineNum] = {};
                    lineSnapshot[lineNum].dirty = true;
                }

                const updateMCR = () => {

                    const item = getVal("item");
                    const uomSales = getVal("custcol_aae_sales_units");

                    if(!item || !uomSales) setVal("custcol_aae_measurement_conversion", null);

                    let mcr = searchModule.getSalesConversion(item, uomSales);

                    console.log(mcr)

                    if(!mcr) mcr = 1;

                    setVal("custcol_aae_measurement_conversion", mcr);

                }

                const updateInvenotoryQuantity = () => {

                    const mcr = getVal("custcol_aae_measurement_conversion");
                    const quantitySales = getVal("custcol_aee_quantity_sales");

                    if(!mcr || !quantitySales) return;

                    let invQuantity  =  Number(quantitySales) / Number(mcr);
                    // let invQuantity  =  Number(mcr) / Number(quantitySales);

                    setVal("quantity", invQuantity);

                }

                const updateAmount = () => {

                    const quantitySales = getVal("custcol_aee_quantity_sales");
                    const unitPriceSales = getVal("custcol_pd_unit_price_sales");

                    if(!unitPriceSales || !quantitySales) return;

                    let invAmount = Number(unitPriceSales) * Number(quantitySales);

                    setVal("amount", invAmount);

                    const quantityInventory = getVal("quantity");

                    if(!quantityInventory) return;

                    const inventoryUnitPrice = invAmount / quantityInventory;

                    setVal("rate", inventoryUnitPrice);


                }

                switch (fieldId) {
                    case "item":
                    case "custcol_aae_sales_units":
                        updateMCR();
                        break;
                    case "custcol_aae_measurement_conversion":
                        updateInvenotoryQuantity();
                        break;
                    case "custcol_aee_quantity_sales":
                        updateInvenotoryQuantity();
                        updateAmount();
                        break;
                    case "custcol_pd_unit_price_sales":
                        updateAmount();
                        break;

                }

            } catch (e) {

                console.error({ title: 'ERROR IN - fieldChanged', details: { stack: e.stack, message: e.message } });

            }
        }

        function validateLine(scriptContext) {
            try {
                const { currentRecord, sublistId } = scriptContext;
                if (sublistId !== "item") return true;

                const lineNum = currentRecord.getCurrentSublistIndex({ sublistId: "item" });
                const snapshot = lineSnapshot[lineNum] || {};

                const item = currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: "item" });

                if(!item) return true;

                const quantity = currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" });

                const quantityIsNotOne = Number(quantity) !== 1;
                const wasEdited = !!snapshot.dirty;

                delete lineSnapshot[lineNum];

                if (!quantityIsNotOne && !wasEdited) return true;

                const quantityAloia = currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" });
                const uomInventory = currentRecord.getCurrentSublistText({ sublistId: "item", fieldId: "units" });
                const itemText = currentRecord.getCurrentSublistText({ sublistId: "item", fieldId: "item" });
                const quantityPdf = currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: "custcol_aee_quantity_sales" });
                const uomPdf = currentRecord.getCurrentSublistText({ sublistId: "item", fieldId: "custcol_aae_sales_units" });
                const amount = currentRecord.getCurrentSublistValue({ sublistId: "item", fieldId: "amount" });

                const amountFormatted = Number(amount).toFixed(2);

                const message = `I'm selling <b>(${quantityAloia}) [${uomInventory}]</b> of <b>[${itemText}]</b>, to fulfill customer's order of <b>(${quantityPdf}) [${uomPdf}]</b>, for a total amount of <b>[$${amountFormatted}]</b>.`

                return dialog.confirm({
                    title: "Confirmação de Venda",
                    message: message
                }).then(function (result) {
                    return result;
                });

            } catch (e) {
                console.error({
                    title: "ERROR IN - validateLine",
                    details: { stack: e.stack, message: e.message }
                });
                return true;
            }
        }

        return {
            lineInit: lineInit,
            fieldChanged: fieldChanged,
            validateLine: validateLine
        };

    });