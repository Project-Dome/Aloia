/**
 * @NApiVersion 2.1
 */
define([
        "N/search",
        "N/record",
        "./pd_pdf_search_module",
        "./pd_pdf_const_module"
    ],

    (search, record, searchModule, cts) => {

        const handler = {}

        const ORIGIN_TYPE = {
            RMA_SCRAP: "RMA_SCRAP",
            INVOICE_DIRECT: "INVOICE_DIRECT"
        }

        handler.ORIGIN_TYPE = ORIGIN_TYPE;

        /**
         * Detecta a origem do Credit Memo a partir do record type apontado por createdfrom.
         * Binário confirmado com o usuário: createdfrom do Credit Memo só assume Return
         * Authorization (RMA_SCRAP) ou Invoice (INVOICE_DIRECT) - não há terceiro caminho.
         */
        handler.resolveOriginType = (createdFromId) => {

            if (!createdFromId) return null;

            try {

                const recordType = search.lookupFields({
                    type: search.Type.TRANSACTION,
                    id: createdFromId,
                    columns: ["recordtype"]
                })["recordtype"];

                if (recordType === record.Type.RETURN_AUTHORIZATION) return ORIGIN_TYPE.RMA_SCRAP;
                if (recordType === record.Type.INVOICE) return ORIGIN_TYPE.INVOICE_DIRECT;

                return null;

            } catch (e) {
                log.error({
                    title: "ERROR IN - resolveOriginType",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
                return null;
            }

        }

        handler.manipulateCreditMemoPdf = (creditMemoRecord, originType, returnAuthorizationRecord, invoiceFromRmaRecord) => {

            try {

                // Campo de guarda - paridade intencional com custbody_pd_pdf_invoice_pdf_dc do
                // Invoice (manipulateInvoicePdf). Mesmo padrão de leitura/early-return, sem
                // gravação nova nesse campo em nenhum dos dois fluxos.
                const creditMemoPdfId = creditMemoRecord.getValue({
                    fieldId: cts.CUSTOM_FIELDS.TRANSACTIONS.BODY_FIELDS.CREDIT_MEMO_PDF
                });

                if (creditMemoPdfId) return null;

                const itemLineCount = creditMemoRecord.getLineCount({
                    sublistId: "item"
                });

                const PDFParameters = {}

                PDFParameters["creditMemoNumber"] = creditMemoRecord.getValue({
                    fieldId: "tranid"
                });

                PDFParameters["creditMemoDate"] = creditMemoRecord.getValue({
                    fieldId: "trandate"
                });

                PDFParameters["billTo"] = creditMemoRecord.getText({
                    fieldId: "billaddress"
                });

                PDFParameters["custPo"] = creditMemoRecord.getValue({
                    fieldId: "otherrefnum"
                });

                PDFParameters["orderDate"] = creditMemoRecord.getValue({
                    fieldId: "custbody_aae_cust_po_receipt"
                });

                const customerId = creditMemoRecord.getValue({
                    fieldId: "entity"
                });

                const customerLookup = searchModule.getCustomerLookup(customerId) || {};
                PDFParameters["entitynumber"] = customerLookup.entitynumber;

                PDFParameters["buyer"] = creditMemoRecord.getValue({
                    fieldId: "custbody_pd_customer_buyer"
                });

                PDFParameters["numberOfItens"] = itemLineCount;

                // Sales Order: lido diretamente do próprio Credit Memo via custbody_related_so.
                // Terms, diferente do Invoice, não vem do próprio registro - vem da Sales Order
                // relacionada (o campo terms do Credit Memo não vem populado nessa transação).
                const relatedSalesOrderId = creditMemoRecord.getValue({
                    fieldId: cts.CUSTOM_FIELDS.TRANSACTIONS.BODY_FIELDS.RELATED_SO
                });

                const relatedSalesOrderData = searchModule.getSalesOrderLookup(relatedSalesOrderId) || {};
                PDFParameters["salesOrder"] = `#${relatedSalesOrderData.tranid || ""}`;
                PDFParameters["terms"] = relatedSalesOrderData.terms || "";

                const incontermsSale = creditMemoRecord.getText({
                    fieldId: "custbody_pd_incotermssales_bodyfield"
                });

                const incontermsLocation = creditMemoRecord.getValue({
                    fieldId: "custbody_pd_incoterms_location"
                });

                PDFParameters["delivery"] = incontermsSale + " " + incontermsLocation;

                const shipViaCarrier = creditMemoRecord.getText({fieldId: "custbody_pd_shipvia_carrier"}) || '';
                const shipViaMethod = creditMemoRecord.getText({fieldId: "custbody_pd_ship_method_tran"}) || '';

                PDFParameters["shipVia"] = [shipViaCarrier, shipViaMethod]
                    .filter(v => v)
                    .join(' - ');

                PDFParameters["shipViaAcc"] = creditMemoRecord.getText({
                    fieldId: "custbody_pd_shipvia_so"
                });

                PDFParameters["shipDate"] = creditMemoRecord.getValue({
                    fieldId: "trandate"
                });

                // Mapa item -> quantidade solicitada na linha da RMA (pareamento 1:1 por item,
                // confirmado pelo usuário: não há mais de uma linha do mesmo item no RMA nem no CM).
                const rmaQuantityByItem = buildRmaQuantityByItemMap(returnAuthorizationRecord);

                PDFParameters["creditMemoItems"] = [];

                let subTotal = 0;
                let miscChargeTotal = 0;

                for (let index = 0; index < itemLineCount; index++) {

                    let itemLine = {};

                    itemLine["item"] = index + 1;

                    let itemId = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        line: index
                    });

                    let itemRecordType = searchModule.getItemRecordType(itemId);

                    // Valores (Total Amt / Subtotal / Total): sempre calculados sobre as linhas
                    // do próprio Credit Memo, independente da origem (RMA_SCRAP ou INVOICE_DIRECT).
                    switch (itemRecordType) {
                        case "lotnumberedinventoryitem":
                        case "serializedinventoryitem":
                        case "inventoryitem":
                            subTotal += Number(creditMemoRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "amount",
                                line: index
                            }));
                            break;
                        default:
                            miscChargeTotal += Number(creditMemoRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "amount",
                                line: index
                            }));
                    }

                    itemLine["partNumber"] = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbercustomer_display",
                        line: index
                    });

                    itemLine["description"] = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        line: index
                    });

                    itemLine["quantityremaining"] = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "quantityremaining",
                        line: index
                    });

                    itemLine["condition"] = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_aae_status_item",
                        line: index
                    });

                    let unitPrice = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_unit_price_sales",
                        line: index
                    }) || creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        line: index
                    });

                    itemLine["unitPrice"] = unitPrice;

                    itemLine["UOM"] = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_aae_sales_units",
                        line: index
                    });

                    let partNumberCustomer = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbercustomer_display",
                        line: index
                    });

                    if (!partNumberCustomer) partNumberCustomer = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "item",
                        line: index
                    });

                    itemLine["itemName"] = partNumberCustomer;

                    let partNumberVendor = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_partnumbervendor_display",
                        line: index
                    });

                    if (partNumberVendor && partNumberVendor !== partNumberCustomer) {
                        itemLine["partNumberVendor"] = partNumberVendor;
                    }

                    let manufacturer = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_aae_manufacturer",
                        line: index
                    });

                    if (manufacturer) itemLine["manufacturer"] = manufacturer;

                    let originCountry = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_mir_manufacturer_ctry_ds",
                        line: index
                    });

                    if (originCountry) itemLine["originCountry"] = originCountry;

                    let hsCode = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_harmonizedcode_linefield",
                        line: index
                    });

                    if (hsCode) itemLine["hsCode"] = hsCode;

                    let eccn = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_eccn_linefield",
                        line: index
                    });

                    if (eccn) itemLine["eccn"] = eccn;

                    let manuAdress = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_mir_manufacturer_addr_ls",
                        line: index
                    });

                    if (manuAdress) itemLine["manuAdress"] = manuAdress.replaceAll(/[\r\n]+/g, " ");

                    let customerReference = creditMemoRecord.getValue({
                        fieldId: "custbody_pd_customer_reference_sales"
                    });

                    if (customerReference) itemLine["customerReference"] = customerReference;

                    let hazMat = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_pd_hazmat",
                        line: index
                    });

                    if (hazMat) itemLine["hazMat"] = hazMat;

                    let itemNotes = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_memoline",
                        line: index
                    });

                    if (itemNotes) itemLine["itemNotes"] = itemNotes;

                    let scheduleB = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_pd_schedule_b",
                        line: index
                    });

                    if (scheduleB) itemLine["scheduleB"] = scheduleB;

                    let trace = creditMemoRecord.getSublistText({
                        sublistId: "item",
                        fieldId: "custcol_aae_trace",
                        line: index
                    });

                    if (trace) itemLine["trace"] = trace;

                    const rawQuantity = creditMemoRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        line: index
                    });

                    let conversionFactor = Number(creditMemoRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_measurement_conversion',
                        line: index
                    })) || 1;

                    // Coluna "Shipped":
                    // - RMA_SCRAP: quantidade solicitada na linha correspondente da RMA (pareamento 1:1 por item).
                    // - INVOICE_DIRECT: quantidade da própria linha do Credit Memo (mesma fonte já usada no Invoice).
                    const shippedValue = originType === ORIGIN_TYPE.RMA_SCRAP
                        ? rmaQuantityByItem[itemId]
                        : Number(rawQuantity) * conversionFactor;

                    itemLine["shipped"] = shippedValue;

                    const inventoryData = getInventoryData(index, creditMemoRecord);
                    if (inventoryData) {
                        const inventoryLabel = itemRecordType === "serializedinventoryitem" ? "SERIAL" : "BATCH/LOT";
                        inventoryData.forEach(lot => {
                            itemLine["quantity"] = Number(lot.quantity) * conversionFactor;
                            itemLine["totalAmount"] = Number(lot.quantity) * Number(unitPrice);
                            itemLine["inventoryLabel"] = inventoryLabel;
                            itemLine["shipped"] = shippedValue;

                            const lotManufacturer = lot.manufacturer || manufacturer;
                            if (lotManufacturer) itemLine["manufacturer"] = lotManufacturer;
                            else delete itemLine["manufacturer"];

                            const lotManuAdress = lot.manuAdress || manuAdress;
                            if (lotManuAdress) itemLine["manuAdress"] = lotManuAdress.replaceAll(/[\r\n]+/g, " ");
                            else delete itemLine["manuAdress"];

                            const lotLabel = formatLotLabel(lot.inventoryNumber, lot.manufacturedDate, lot.expirationDate);
                            itemLine["inventoryNumber"] = lotLabel;
                            PDFParameters["creditMemoItems"].push({...itemLine});
                        });
                    } else {

                        itemLine["quantity"] = Number(rawQuantity) * conversionFactor;
                        itemLine["totalAmount"] = Number(rawQuantity) * Number(unitPrice);

                        PDFParameters["creditMemoItems"].push(itemLine);
                    }

                }

                // Nome completo do funcionário selecionado em custbody_pd_authorized_signature -
                // getText já retorna o nome completo de exibição (List/Record Employee), sem
                // necessidade de lookup adicional.
                PDFParameters["authorizedSignatureName"] = creditMemoRecord.getText({
                    fieldId: cts.CUSTOM_FIELDS.TRANSACTIONS.BODY_FIELDS.AUTHORIZED_SIGNATURE
                });

                PDFParameters["specialInstructions"] = buildSpecialInstructions(
                    originType,
                    creditMemoRecord,
                    returnAuthorizationRecord,
                    invoiceFromRmaRecord,
                    PDFParameters["authorizedSignatureName"]
                );

                // Terms and Conditions: fonte única compartilhada com o Invoice - lê o parâmetro
                // já configurado no deployment customdeploy_pd_pdf_print_invoice_sl, em vez de
                // duplicar o texto em um campo próprio do Credit Memo. Decisão confirmada com o
                // usuário: alterar esse parâmetro no Invoice reflete automaticamente no CM.
                PDFParameters["termsCondition"] = getSharedInvoiceTermsCondition();

                PDFParameters["freight"] = creditMemoRecord.getValue({
                    fieldId: "altshippingcost"
                });

                PDFParameters["total"] = creditMemoRecord.getValue({
                    fieldId: "total"
                });

                PDFParameters["creditIn"] = creditMemoRecord.getText({
                    fieldId: "currencysymbol"
                });

                PDFParameters["taxtotal"] = creditMemoRecord.getText({
                    fieldId: "taxtotal"
                });

                PDFParameters["createddate"] = formatDateTimeForPDF(creditMemoRecord.getValue({fieldId: 'createddate'}));

                PDFParameters["subTotal"] = subTotal;
                PDFParameters["miscChargeTotal"] = miscChargeTotal;

                return PDFParameters;

            } catch (e) {
                log.error({
                    title: "ERROR IN - manipulateCreditMemoPdf",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        /**
         * Lê o parâmetro de Terms and Conditions diretamente do deployment do Suitelet do
         * Invoice (customdeploy_pd_pdf_print_invoice_sl / custscript_pd_invoice_terms_condition_ds).
         * Leitura cross-script, somente consulta - não grava nem depende de nenhuma alteração
         * em arquivo do domínio do Invoice. Script parameters de deployment ficam expostos como
         * campos do próprio record "scriptdeployment", carregável pelo scriptid do deployment.
         */
        /**
         * Normaliza o valor lido via record.getValue() no scriptdeployment do Invoice. Esse
         * caminho de leitura (genérico, de campo de record) não é idêntico ao
         * Script.getParameter() usado pelo Invoice - entity-encode HTML e insere uma tag de
         * fechamento </br> solta (que não existe no valor originalmente configurado no
         * deployment). Correção isolada aqui, no Credit Memo - não altera nada no Invoice.
         */
        function normalizeSharedTermsCondition(text) {

            if (!text) return "";

            return text
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&amp;/gi, '&')
                .replace(/<\/br\s*>/gi, '');

        }

        function getSharedInvoiceTermsCondition() {

            try {

                // record.load para type "scriptdeployment" exige o internal ID numérico - o
                // scriptid (ex.: customdeploy_pd_pdf_print_invoice_sl) não é aceito como id.
                // Resolve o internal ID via busca antes de carregar o record.
                const deploymentSearchResults = search.create({
                    type: "scriptdeployment",
                    filters: [["scriptid", "is", cts.CUSTOM_SCRIPT.SUITELET.PRINT_INVOICE.DEPLOY]],
                    columns: ["internalid"]
                }).run().getRange({start: 0, end: 1});

                if (!deploymentSearchResults || !deploymentSearchResults.length) return "";

                const deploymentInternalId = deploymentSearchResults[0].getValue({name: "internalid"});

                if (!deploymentInternalId) return "";

                const invoiceSuiteletDeployment = record.load({
                    type: "scriptdeployment",
                    id: deploymentInternalId
                });

                const rawTermsCondition = invoiceSuiteletDeployment.getValue({
                    fieldId: cts.SCRIPT_PARAMETERS.INVOICE_TERMS_CONDITION
                }) || "";

                return normalizeSharedTermsCondition(rawTermsCondition);

            } catch (e) {
                log.error({
                    title: "ERROR IN - getSharedInvoiceTermsCondition",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
                return "";
            }

        }

        function buildRmaQuantityByItemMap(returnAuthorizationRecord) {

            const map = {};

            if (!returnAuthorizationRecord) return map;

            const rmaLineCount = returnAuthorizationRecord.getLineCount({
                sublistId: "item"
            });

            for (let index = 0; index < rmaLineCount; index++) {

                const itemId = returnAuthorizationRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "item",
                    line: index
                });

                const quantity = returnAuthorizationRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "quantity",
                    line: index
                });

                map[itemId] = quantity;

            }

            return map;

        }

        function buildSpecialInstructions(originType, creditMemoRecord, returnAuthorizationRecord, invoiceFromRmaRecord, authorizedSignatureName) {

            if (originType === ORIGIN_TYPE.RMA_SCRAP) {

                const rmaNumber = returnAuthorizationRecord ? returnAuthorizationRecord.getValue({fieldId: "tranid"}) : "";
                const invoiceNumberFromRma = invoiceFromRmaRecord ? invoiceFromRmaRecord.getValue({fieldId: "tranid"}) : "";

                const returnReason = returnAuthorizationRecord ? returnAuthorizationRecord.getText({
                    fieldId: cts.CUSTOM_FIELDS.RETURN_AUTHORIZATION.BODY_FIELDS.RETURN_REASON
                }) : "";

                return [
                    "This is a credit note DO NOT PAY",
                    `Invoice ${invoiceNumberFromRma} - RMA ${rmaNumber}`,
                    `${returnReason}`,
                    `Authorized Signature: ${authorizedSignatureName}`
                ].join("\n");

            }

            const createdFromId = creditMemoRecord.getValue({fieldId: "createdfrom"});
            const invoiceNumber = searchModule.transactionLookup(createdFromId) || "";

            return [
                "This is a credit note DO NOT PAY",
                `Invoice ${invoiceNumber}`,
                `Authorized Signature: ${authorizedSignatureName}`
            ].join("\n");

        }

        // Returns an array - one object per lot, each with its own dates
        function getInventoryData(index, newRecord) {

            const inventoryDetailField = newRecord.getSublistField({
                sublistId: "item",
                fieldId: "inventorydetail",
                line: index
            });

            if (!inventoryDetailField) return null;

            const inventoryDetailSubrecord = newRecord.getSublistSubrecord({
                sublistId: "item",
                fieldId: "inventorydetail",
                line: index
            });

            const inventoryLineCount = inventoryDetailSubrecord.getLineCount({
                sublistId: "inventoryassignment"
            });

            const lots = [];

            for (let i = 0; i < inventoryLineCount; i++) {

                const lotInternalId = inventoryDetailSubrecord.getSublistValue({
                    sublistId: "inventoryassignment",
                    fieldId: "issueinventorynumber",
                    line: i
                });

                const lotQuantity = inventoryDetailSubrecord.getSublistValue({
                    sublistId: "inventoryassignment",
                    fieldId: "quantity",
                    line: i
                });

                if (lotInternalId) {
                    const lotData = searchModule.getInventoryDetaiLookup(lotInternalId);

                    if (lotData.inventorynumber) {
                        lots.push({
                            inventoryNumber: lotData.inventorynumber,
                            expirationDate: lotData.expirationdate
                                ? new Date(lotData.expirationdate).toISOString()
                                : null,
                            manufacturedDate: lotData.custitemnumber_aln_manufactured_date
                                ? new Date(lotData.custitemnumber_aln_manufactured_date).toISOString()
                                : null,
                            quantity: lotQuantity,
                            manufacturer: lotData.manufacturer,
                            manuAdress: lotData.manuAdress,
                        });
                    }
                }

            }

            return lots.length ? lots : null;

        }

        // Formats a single lot as "LOT-XXXX - DOM: mm/dd/yyyy - DOE: mm/dd/yyyy"
        function formatLotLabel(inventoryNumber, manufacturedDate, expirationDate) {
            const parts = [inventoryNumber || ''];

            if (manufacturedDate) {
                const d = new Date(manufacturedDate);
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                parts.push(`DOM: ${mm}/${dd}/${yyyy}`);
            }

            if (expirationDate) {
                const d = new Date(expirationDate);
                const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(d.getUTCDate()).padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                parts.push(`DOE: ${mm}/${dd}/${yyyy}`);
            }

            return parts.join(' - ');
        }

        function formatDateTimeForPDF(date) {
            if (!date) return '';
            const d = new Date(date);
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const mins = String(d.getUTCMinutes()).padStart(2, '0');
            const secs = String(d.getUTCSeconds()).padStart(2, '0');
            return `${hours}:${mins}:${secs}`;
        }

        return handler;

    });
