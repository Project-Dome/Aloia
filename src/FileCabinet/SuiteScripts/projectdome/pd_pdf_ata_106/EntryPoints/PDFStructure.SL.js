/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * Author: Lucas Monaco (+ ajustes de segmentação)
 */
define(['N/record', 'N/log', 'N/render', 'N/format', 'N/file', 'N/runtime', 'N/search', 'N/query', 'N/url'],
    function (record, log, render, format, file, runtime, search, query, nsUrl) {

        // Campo de fornecedor em linha
        var COL_VENDOR_ON_LINE = 'custcol_aae_vendor_purchase_order';
        // Campo de status em linha (select). Usaremos o VALUE (ID interno), não o texto.
        var COL_STATUS_ON_LINE = 'custcol_pd_aae_status_item';

        // Grupo de status
        var GROUP_NEW = 'new';      // somente ID interno = '1'
        var GROUP_OTHERS = 'others';  // IDs 2..5 (New Surplus, Used, Repaired, Overhauled)

        var SYSTEM_NOTE_TYPE_CREATE = '1';

        // Fonte manuscrita (TTF/OTF no File Cabinet, marcada como "Available Without Login").
        // Se o arquivo não existir, cai no fallback Times italic.
        var SIGNATURE_FONT_PATH = 'SuiteScripts/projectdome/pd_pdf_ata_106/Fonts/GreatVibes-Regular.ttf';
        var NAME_PARTICLES = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'];
        var SIGNATURE_COLOR = '#1a44a8';

        // Retorna o criador da transação (SystemNote "Create") + nome de exibição.
        // BUILTIN.DF evita depender de permissão no registro Employee.
        function getRecordCreator(recordId) {
            log.debug({title: 'getRecordCreator CALLED', details: {recordId: recordId}});
            if (!recordId) return null;
            try {
                var sql = "SELECT SystemNote.Name AS employeeid, BUILTIN.DF(SystemNote.Name) AS creatorname, " +
                    "SystemNote.Type AS notetype, SystemNote.Date AS notedate FROM SystemNote " +
                    "WHERE SystemNote.RecordID = ? AND SystemNote.RecordTypeID = -30 " +
                    "ORDER BY SystemNote.Date ASC";

                var results = query.runSuiteQL({query: sql, params: [recordId]}).asMappedResults();
                if (!results || !results.length) return null;

                var chosen = null;
                for (var i = 0; i < results.length; i++) {
                    if (String(results[i].notetype) === SYSTEM_NOTE_TYPE_CREATE) {
                        chosen = results[i];
                        break;
                    }
                }
                // Fallback: sem linha "Create" explícita — usa a nota mais antiga.
                if (!chosen) chosen = results[0];

                var creator = {id: chosen.employeeid, displayName: chosen.creatorname || ''};
                log.debug({title: 'SystemNote Chosen Creator', details: {recordId: recordId, creator: creator}});
                return creator;
            } catch (e) {
                log.error('Erro ao buscar criador via SystemNote', e);
                return null;
            }
        }

        // "Nome + último sobrenome", ignorando partículas (da, de, dos...).
        function formatSignatureName(first, last, fallback) {
            function clean(s) {
                return String(s || '').replace(/\s+/g, ' ').trim().split(' ').filter(function (p) {
                    return p && NAME_PARTICLES.indexOf(p.toLowerCase()) === -1;
                });
            }
            var firstParts = clean(first);
            var lastParts = clean(last);
            if (!firstParts.length) {
                var all = clean(fallback);
                firstParts = all.slice(0, 1);
                lastParts = all.slice(1);
            }
            var out = [];
            if (firstParts.length) out.push(firstParts[0]);
            if (lastParts.length) out.push(lastParts[lastParts.length - 1]);
            return out.join(' ');
        }

        function readSignerName(userId, fallbackDisplayName) {
            var first = '', last = '', display = fallbackDisplayName || '';
            try {
                var r = query.runSuiteQL({
                    query: 'SELECT firstname, lastname, entityid FROM employee WHERE id = ?',
                    params: [userId]
                }).asMappedResults()[0];
                if (r) {
                    first = r.firstname || '';
                    last = r.lastname || '';
                    display = display || r.entityid || '';
                }
            } catch (e) {
                // Sem permissão no Employee: segue com o nome de exibição do SystemNote.
                log.audit('readSignerName - usando fallback do SystemNote', e.message);
            }
            var name = formatSignatureName(first, last, display);
            log.debug({title: 'readSignerName RESULT', details: {userId: userId, name: name}});
            return name;
        }

        function getSignatureFontLink() {
            try {
                var f = file.load({id: SIGNATURE_FONT_PATH});
                if (!f.url) return '';
                if (!f.isOnline) log.audit('Fonte sem "Available Without Login" — o BFO pode não conseguir baixar', SIGNATURE_FONT_PATH);
                // O BFO baixa a fonte via HTTP: precisa de URL absoluta (a relativa cai no fallback silenciosamente)
                var domain = nsUrl.resolveDomain({hostType: nsUrl.HostType.APPLICATION});
                var fontUrl = ('https://' + domain + f.url).replace(/&/g, '&amp;');
                log.debug('Signature font URL', fontUrl);
                return '<link name="SignatureFont" type="font" subtype="truetype" src="' + fontUrl +
                    '" src-bold="' + fontUrl + '" bytes="2" />';
            } catch (e) {
                log.audit('Fonte de assinatura não encontrada, usando fallback', e.message);
                return '';
            }
        }

        function buildSignatureHtml(name, fontLink) {
            var style = fontLink
                ? 'font-family: SignatureFont; font-size: 22pt;'
                : 'font-family: Times; font-style: italic; font-size: 16pt;';
                style += ' color: ' + SIGNATURE_COLOR + ';';
            return '<span style="' + style + '">' + escapeXml(name) + '</span>';
        }

        function getVendorName(vendorId) {
            if (!vendorId) return '';
            try {
                var vRec = record.load({type: record.Type.VENDOR, id: vendorId});
                return vRec.getValue({fieldId: 'companyname'}) || '';
            } catch (e) {
                return '';
            }
        }

        function getSubsidiaryData(subsidiaryId) {
            if (!subsidiaryId) return {name: '', address: ''};
            try {
                var s = record.load({type: record.Type.SUBSIDIARY, id: subsidiaryId});
                return {
                    name: s.getText({fieldId: 'name'}) || '',
                    address: (s.getValue({fieldId: 'mainaddress_text'}) || '')
                };
            } catch (e) {
                return {name: '', address: ''};
            }
        }

        function getAckFromCreatedFrom(invoice) {
            var createdFromId = invoice.getValue({fieldId: 'createdfrom'}) || '';
            if (!createdFromId) return '';
            try {
                var result = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: createdFromId,
                    columns: ['tranid']
                });
                return result.tranid || '';
            } catch (e) {
                return '';
            }
        }

        // Monta o "plano" de geração: grupos por (vendorId, grupoStatus)
        function planGroups(invoice) {
            var lineCount = invoice.getLineCount({sublistId: 'item'}) || 0;
            var groupsMap = {}; // key: vendorId||'' + '|' + group  -> { vendorId, group, vendorName, count }
            for (var i = 0; i < lineCount; i++) {
                var vendorId = invoice.getSublistValue({sublistId: 'item', fieldId: COL_VENDOR_ON_LINE, line: i}) || '';
                var statusVal = String(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: COL_STATUS_ON_LINE,
                    line: i
                }) || '').trim();
                var group = (statusVal === '1') ? GROUP_NEW : GROUP_OTHERS; // 1 = New; resto = others

                var key = String(vendorId) + '|' + group;
                if (!groupsMap[key]) {
                    groupsMap[key] = {
                        vendorId: vendorId ? String(vendorId) : '',
                        group: group,
                        vendorName: getVendorName(vendorId),
                        count: 0
                    };
                }
                groupsMap[key].count++;
            }
            // Se não houver linhas, ainda devolve um grupo vazio (opcional). Aqui, retornamos apenas existentes.
            return Object.keys(groupsMap).map(function (k) {
                return groupsMap[k];
            });
        }

        // Coleta linhas filtradas por vendorId + group (new/others)
        function collectLines(invoice, vendorIdFilter, groupFilter) {
            var lineCount = invoice.getLineCount({sublistId: 'item'}) || 0;
            var rows = [];

            for (var i = 0; i < lineCount; i++) {
                var vendorOnLine = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: COL_VENDOR_ON_LINE,
                    line: i
                }) || '';

                var partNumberCustomer = invoice.getSublistText({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbercustomer',
                    line: i
                }) || '';

                var statusVal = String(invoice.getSublistValue({
                    sublistId: 'item', fieldId: COL_STATUS_ON_LINE, line: i
                }) || '').trim();

                var group = (statusVal === '1') ? GROUP_NEW : GROUP_OTHERS;

                // Filtra por vendor
                if (vendorIdFilter && String(vendorOnLine) !== String(vendorIdFilter)) continue;
                // Filtra por grupo de status
                if (groupFilter && group !== groupFilter) continue;

                var description = invoice.getSublistValue({sublistId: 'item', fieldId: 'description', line: i}) || '';
                var quantity = invoice.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});
                var statusTxt = invoice.getSublistText({sublistId: 'item', fieldId: COL_STATUS_ON_LINE, line: i}) || '';
                var manufId = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_aae_manufacturer',
                    line: i
                }) || invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_manufacturer',
                    line: i
                }) || "";
                var manufName = '';
                if (manufId) {
                    try {
                        var mRec = record.load({type: record.Type.VENDOR, id: manufId});
                        manufName = mRec.getValue({fieldId: 'companyname'}) || '';
                    } catch (e) {
                    }
                }
                var partNumber = invoice.getSublistText({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbervendor',
                    line: i
                }) || '';

                var conversionFactor = Number(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_measurement_conversion',
                    line: i
                })) || 1;

                // Seriais
                try {

                    const inventoryDetailField = invoice.getSublistField({
                        sublistId: "item",
                        fieldId: "inventorydetail",
                        line: i
                    });

                    if (inventoryDetailField) {

                        var invDet = invoice.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: i
                        });

                        var assCount = invDet.getLineCount({sublistId: 'inventoryassignment'}) || 0;

                        if (assCount === 0) {

                            rows.push({
                                description: description,
                                quantity: quantity * conversionFactor,
                                statusText: statusTxt,
                                statusVal: statusVal,
                                manufacturerName: manufName,
                                partNumber: partNumber,
                                partNumberCustomer: partNumberCustomer,
                                serialText: "N/A"
                            });

                        } else {

                            for (var a = 0; a < assCount; a++) {

                                var issueInvNumId = invDet.getSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    line: a
                                });

                                if (issueInvNumId) {

                                    var lotQuantity = invDet.getSublistValue({
                                        sublistId: 'inventoryassignment',
                                        fieldId: 'quantity',
                                        line: a
                                    });

                                    var sn = search.lookupFields({
                                        type: record.Type.INVENTORY_NUMBER,
                                        id: issueInvNumId,
                                        columns: ['inventorynumber']
                                    });

                                    if (sn && sn.inventorynumber) rows.push({
                                        description: description,
                                        quantity: lotQuantity * conversionFactor,
                                        statusText: statusTxt,
                                        statusVal: statusVal,
                                        manufacturerName: manufName,
                                        partNumber: partNumber,
                                        partNumberCustomer: partNumberCustomer,
                                        serialText: escapeXml(sn.inventorynumber)
                                    });

                                }
                            }
                        }

                    } else {
                        rows.push({
                            description: description,
                            quantity: quantity * conversionFactor,
                            statusText: statusTxt,
                            statusVal: statusVal,
                            manufacturerName: manufName,
                            partNumber: partNumber,
                            partNumberCustomer: partNumberCustomer,
                            serialText: "N/A"
                        });
                    }

                } catch (e) {

                    log.error({
                        title: "ERROR IN - collectLines",
                        details: {
                            stack: e.stack,
                            message: e.message
                        }
                    });

                }
            }

            return rows;
        }

        function buildItemRowsXml(rows) {
            if (!rows.length) {
                return (
                    '<tr class="data-row">' +
                    '<td class="center-cell">1</td>' +
                    '<td></td><td></td><td class="center-cell"></td><td class="center-cell"></td><td class="center-cell"></td>' +
                    '</tr>'
                );
            }
            var xml = '';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var desc = String(r.description || '').replace(/(?:\r\n|\r|\n)/g, '<br/>');
                xml += ''
                    + '<tr class="data-row">'
                    + '<td class="center-cell">' + (i + 1) + '</td>'
                    + '<td>' + escapeXml(desc) + '</td>'
                    + '<td>' + escapeXml(r.manufacturerName || '') + '<br/>' + escapeXml(r.partNumberCustomer || '') + '</td>'
                    + '<td class="center-cell" style="white-space: nowrap;">' + escapeXml(formatQuantity(r.quantity)) + '</td>'
                    + '<td class="center-cell">' + (r.serialText || '') + '</td>'
                    + '<td class="center-cell">' + escapeXml(r.statusText || '') + '</td>'
                    + '</tr>';
            }
            return xml;
        }

        function renderPdf(context, invoice, vendorIdFilter, groupFilter) {
            var sellerContract = invoice.getValue({fieldId: 'tranid'}) || '';
            var codPo = invoice.getValue({fieldId: 'otherrefnum'}) || '';
            var rawDate = invoice.getValue({fieldId: 'trandate'});
            var dateStr = rawDate ? format.format({value: rawDate, type: format.Type.DATE}) : '';
            var subsidiaryId = invoice.getValue({fieldId: 'subsidiary'}) || '';
            var remarks = invoice.getValue({fieldId: 'custbody_pd_remarks'}) || '';
            var lastCertAg = invoice.getValue({fieldId: 'custbody_pd_lastcerifiedagency'}) || '';

            var subs = getSubsidiaryData(subsidiaryId);
            var ack = getAckFromCreatedFrom(invoice);

            // Assinador = criador da transação (SystemNote). Não depende de quem gera o PDF.
            var creator = getRecordCreator(invoice.id);
            var creatorId = (creator && creator.id) || runtime.getCurrentUser().id;
            var fallbackName = creator ? creator.displayName : runtime.getCurrentUser().name;
            var employeeName = readSignerName(creatorId, fallbackName);
            var hasSigner = !!employeeName;
            var signatureFontLink = getSignatureFontLink();
            log.debug({
                title: 'renderPdf - assinador resolvido',
                details: {invoiceId: invoice.id, creatorId: creatorId, employeeName: employeeName, customFont: !!signatureFontLink}
            });

            // Linhas do grupo atual (vendor + status)
            var rows = collectLines(invoice, vendorIdFilter, groupFilter);

            // 13B: nome do fornecedor quando filtrado; vazio se sem fornecedor
            var obtainedFromName = vendorIdFilter ? getVendorName(vendorIdFilter) : '';

            // Assinaturas: esquerda só para NEW; direita só para OTHERS
            var showPart15 = (groupFilter === GROUP_NEW) && rows.length > 0; // 15/16/17
            var showPart19 = (groupFilter === GROUP_OTHERS) && rows.length > 0; // 19/20/21

            var trPartsNameDate = (!hasSigner || !showPart15) ? '<tr style="background-color: #d3d3d3; padding: 0;">' : '<tr style="padding: 0;">';
            var trPartsNameDate2 = (!hasSigner || !showPart19) ? '<tr style="background-color: #d3d3d3; padding: 0;">' : '<tr style="padding: 0;">';

            var tdPartsNameDate = (!hasSigner || !showPart15) ? '<td colspan="1" style="border: 1px solid black; padding: 0;background-color: #d3d3d3;">'
                : '<td colspan="1" style="border: 1px solid black; padding: 0;">';
            var tdPartsNameDate2 = (!hasSigner || !showPart19) ? '<td colspan="1" style="border: 1px solid black; padding: 0;background-color: #d3d3d3;">'
                : '<td colspan="1" style="border: 1px solid black; padding: 0;">';

            var correctSideName = (showPart15 && hasSigner)
                ? '<td style="border: none; padding: 4px; width: 56%;">16. Name: <br/>' + escapeXml(employeeName) + '</td>'
                : '<td style="border: none; padding: 4px; width: 56%;">16. Name: <br/></td>';

            var correctSideDate = (showPart15 && hasSigner)
                ? '<td style="border: none; padding: 4px; width: 40%; text-align: right;">17. Date: <br/>' + escapeXml(dateStr) + '</td>'
                : '<td style="border: none; padding: 4px; width: 40%; text-align: right;">17. Date: <br/></td>';

            var correctSideName2 = (showPart19 && hasSigner)
                ? '<td style="border: none; padding: 4px; width: 56%;">20. Name: <br/>' + escapeXml(employeeName) + '</td>'
                : '<td style="border: none; padding: 4px; width: 56%;">20. Name: <br/></td>';

            var correctSideDate2 = (showPart19 && hasSigner)
                ? '<td style="border: none; padding: 4px; width: 40%; text-align: right;">21. Date: <br/>' + escapeXml(dateStr) + '</td>'
                : '<td style="border: none; padding: 4px; width: 40%; text-align: right;">21. Date: <br/></td>';

            var tdNoSignature = (!hasSigner || !showPart15)
                ? '<td colspan="1" style=" background-color: #d3d3d3; border: 1px solid black; padding: 0; vertical-align: top;">'
                : '<td colspan="1" style="border: 1px solid black; padding: 0; vertical-align: top;">';

            var tdNoSignatureUsed = (!hasSigner || !showPart19)
                ? '<td colspan="1" style=" background-color: #d3d3d3; border: 1px solid black; padding: 0; vertical-align: top;">'
                : '<td colspan="1" style="border: 1px solid black; padding: 0; vertical-align: top;">';

            var noSignature = "<div style='background-color:#d3d3d3; width: 100%; height: 30px; padding: 0; margin: 0; border: none;'>&nbsp;</div>";
            var newPartsSignature = (showPart15 && hasSigner) ? buildSignatureHtml(employeeName, signatureFontLink) : noSignature;
            var usedPartsSignature = (showPart19 && hasSigner) ? buildSignatureHtml(employeeName, signatureFontLink) : noSignature;

            var itemRowsXml = buildItemRowsXml(rows);

            var pdfContent =
                '<?xml version="1.0"?>' +
                '<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">' +
                '<pdf><head>' +
                signatureFontLink +
                '  <style type="text/css">' +
                '    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 20px; }' +
                '    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }' +
                '    td { border: 1px solid #000; padding: 4px; vertical-align: top; font-size: 9pt; }' +
                '    .title-header { font-weight: bold; text-align: center; font-size: 12pt; border:none; padding-top: 12px; }' +
                '    .small-header { text-align: right; font-size: 9pt; border:none; padding-top: 14px; }' +
                '    .with-bold { font-weight: bold; font-size: 8pt; }' +
                '    .seller-info-table { font-size: 8pt; }' +
                '    .section-label { width: 50%; text-align: center; vertical-align: middle; }' +
                '    .section-label-span { font-weight: bold; font-size: 12pt; display: block; margin-top: 5px; margin-left: 150px; }' +
                '    .section-label-spans { font-weight: bold; font-size: 12pt; display: block; margin-top: 5px; margin-left: 70px; }' +
                '    .field-label-other { font-size: 8pt; }' +
                '    .field-span-others { font-size: 8pt; }' +
                '    .address-text { font-size: 9pt; margin-left: 10px; display: inline-block; }' +
                '    .data-row { height: 40px; }' +
                '    .data-row-remarks { height: 60px; }' +
                '    .small-header-remarks { font-size: 8pt; font-weight: normal; }' +
                '    .verification-row { height: 80px; }' +
                '    .table-header { text-align: center; font-size: 8pt; }' +
                '    .center-cell { text-align: center; }' +
                '  </style>' +
                '</head><body>' +

                // Cabeçalho
                '  <table>' +
                '    <tr>' +
                '      <td class="title-header" style="width: 60%;">PART OR MATERIAL CERTIFICATION FORM</td>' +
                '      <td class="small-header" style="width: 25%;">ATA SPECIFICATION 106</td>' +
                '    </tr>' +
                '  </table>' +

                // Seller + Ref
                '  <table>' +
                '    <tr>' +
                '      <td class="section-label" colspan="2" style="width: 70%;">' +
                '        <span class="seller-info-table">2. Seller\'s Name:</span><br/>' +
                '        <span class="section-label-span">Aloia Aerospace Inc.</span>' +
                '      </td>' +
                '      <td class="section-label" style="width: 30%;">' +
                '        <span class="seller-info-table">3. Reference #:</span><br/>' +
                '        <span class="section-label-spans">' + escapeXml(sellerContract) + '</span>' +
                '      </td>' +
                '    </tr>' +
                '  </table>' +

                // Organização / Address / 5A / 5B
                '  <table>' +
                '    <tr>' +
                '      <td class="field-label-other" style="width: 50%;">' +
                '        <span class="field-span-others">4. Organization:</span><br/>' +
                '        <span class="address-text">' + escapeXml(subs.name) + '</span><br/><br/>' +
                '        <span class="field-span-others">Address:</span><br/>' +
                '        <span class="address-text">' + escapeXml(subs.address).replace(/\n/g, '<br/>') + '</span><br/>' +
                '        <span class="address-text">Ph: 786-213-5814,</span><br/>' +
                '        <span class="address-text">sales@aloiaaerospace.com</span>' +
                '      </td>' +
                '      <td class="field-label-other" style="width: 50%;">' +
                '        <span class="field-span-others">Phone#:</span> 786-213-5814<br/><br/>' +
                '        <span class="field-span-others">Fax#:</span><br/><br/>' +
                '        <span class="field-span-others">SITA/Wire Code:</span><br/><br/>' +
                '        <span class="field-span-others">Status:</span>' +
                '      </td>' +
                '    </tr>' +
                '    <tr>' +
                '      <td class="field-label-other"><span class="field-span-others">5A. Seller\'s Contract #:</span> ' + escapeXml(ack) + '</td>' +
                '      <td class="field-label-other"><span class="field-span-others">5B. Customer\'s PO #:</span> ' + escapeXml(codPo) + '</td>' +
                '    </tr>' +
                '  </table>' +

                // Tabela de itens (somente deste grupo)
                '  <table>' +
                '    <tr>' +
                '      <td class="table-header" style="width: 8%;">6.Item</td>' +
                '      <td class="table-header" style="width: 25%;">7.Description</td>' +
                '      <td class="table-header" style="width: 25%;">8.Manufacturer &amp; Part Number</td>' +
                '      <td class="table-header" style="width: 8%;">10.Qty</td>' +
                '      <td class="table-header" style="width: 12%;">11.Lot/Serial #</td>' +
                '      <td class="table-header" style="width: 12%;">12.Status</td>' +
                '    </tr>' +
                buildItemRowsXml(rows) +
                '  </table>' +

                // Remarks / Obtained From / Last Cert Agency
                '  <table>' +
                '    <tr class="data-row-remarks">' +
                '      <td class="small-header-remarks" style="width: 100%;" colspan="2">13A. Remarks: To the best of our knowledge, the above referenced part(s) or material was/were not obtained from any US Government or Military Source and was/were not subjected to severe stress or heat or immersed in salt water (as in major engine failure, accident, incident or fire).' + escapeXml(remarks) + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '      <td class="small-header-remarks" style="width: 50%;">13B. Obtained From:<br/><br/><span class="with-bold">' + escapeXml(obtainedFromName) + '</span></td>' +
                '      <td class="small-header-remarks" style="width: 50%;">13C. Last Certificated Agency:<br/><br/>' + escapeXml(lastCertAg) + '</td>' +
                '    </tr>' +
                '  </table>' +

                // Verificações / Assinaturas
                '  <table>' +
                '    <tr class="verification-row">' +
                '      <td class="field-label" style="width: 44%;">14. New Parts/Material Verification:<br/><br/>THE FOLLOWING SIGNATURE ATTESTS THAT THE PART(S) OR MATERIAL(S) IDENTIFIED ABOVE WAS (WERE) MANUFACTURED BY A FAA PRODUCTION APPROVAL HOLDER (PAH), OR TO AN INDUSTRY COMMERCIAL STANDARD.</td>' +
                '      <td class="field-label" style="width: 56%;">18. Used, Repaired, Overhauled or New Surplus Parts Verification:<br/><br/>THE FOLLOWING SIGNATURE ATTESTS THAT THE DOCUMENTATION SPECIFIED ABOVE OR ATTACHED IS ACCURATE WITH REGARD TO THE ITEM(S) DESCRIBED.</td>' +
                '    </tr>' +
                '  </table>' +

                // 15 / 19 (assinaturas) com cinza condicionado
                '  <table style="border-collapse: collapse;">' +
                '    <tr>' +
                (tdNoSignature +
                    '<table style="border-collapse: collapse; width: 100%;">' +
                    '  <tr>' +
                    '    <td style="border: none; padding: 4px; width: 50%;">15. Signature:<br/>' + newPartsSignature + '</td>' +
                    '  </tr>' +
                    '</table></td>') +
                (tdNoSignatureUsed +
                    '<table style="border-collapse: collapse; width: 100%;">' +
                    '  <tr>' +
                    '    <td style="border: none; padding: 4px; width: 50%;">19. Signature:<br/>' + usedPartsSignature + '</td>' +
                    '  </tr>' +
                    '</table></td>') +
                '    </tr>' +
                '  </table>' +

                // 16/17 e 20/21 (Name/Date) com cinza condicionado (com quebra de linha no Date)
                '<table style="border-collapse: collapse;">' +
                '  <tr>' +
                (tdPartsNameDate +
                    '<table style="border-collapse: collapse; width: 100%;">' +
                    trPartsNameDate + correctSideName + correctSideDate +
                    '  </tr></table></td>') +
                (tdPartsNameDate2 +
                    '<table style="border-collapse: collapse; width: 100%;">' +
                    trPartsNameDate2 + correctSideName2 + correctSideDate2 +
                    '  </tr></table></td>') +
                '  </tr>' +
                '</table>' +

                '<div class="notice"><strong>NOTICE:</strong> The above signature binds the seller and the SIGNER to the accuracy of the information provided in the FORM. Should the information provided in this Form contain inaccuracies or misrepresentations, the signer and SELLER may be liable for damages and be subject to criminal prosecution under state and federal law.</div>' +

                '</body></pdf>';

            var pdfFile = render.xmlToPdf({xmlString: pdfContent});

            // Nome do arquivo
            var name = 'ATA106';
            if (vendorIdFilter) {
                var vname = getVendorName(vendorIdFilter);
                if (vname) name += '_' + vname.replace(/[^\w\-]+/g, '_');
            }
            name += (groupFilter === GROUP_NEW ? '_NEW' : '_OTHERS');
            name += '.pdf';

            // Download forçado
            context.response.setHeader({name: 'Content-Type', value: 'application/pdf'});
            context.response.setHeader({name: 'Content-Disposition', value: 'inline; filename="' + name + '"'});
            context.response.writeFile(pdfFile, true);
        }

        function escapeXml(s) {
            return String(s || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        }

        // Round Half Up (ex.: 86.4362 -> 86.44 / 86.4321 -> 86.43). toPrecision(15) remove ruído de ponto flutuante antes do Math.round.
        function roundHalfUp(value, decimals) {
            var num = Number(value);
            if (isNaN(num)) return value;
            var factor = Math.pow(10, decimals);
            return Math.round(Number((num * factor).toPrecision(15))) / factor;
        }

        function formatQuantity(value) {
            if (value === '' || value === null || value === undefined) return '';
            return roundHalfUp(value, 2).toFixed(2);
        }

        function onRequest(context) {
            if (context.request.method !== 'GET') return;

            var invoiceId = context.request.parameters.invoiceId;
            var action = context.request.parameters.action || '';
            var vendorId = context.request.parameters.vendorId || '';   // filtro fornecedor
            var group = context.request.parameters.group || '';      // 'new' | 'others'

            if (!invoiceId) {
                context.response.write('Missing invoiceId');
                return;
            }

            var invoice = record.load({type: record.Type.INVOICE, id: invoiceId, isDynamic: false});

            if (action === 'planGroups') {
                var plan = planGroups(invoice);
                context.response.setHeader({name: 'Content-Type', value: 'application/json; charset=utf-8'});
                context.response.write(JSON.stringify({groups: plan}));
                return;
            }

            // Gera PDF para (vendor, group)
            // Se group não vier, por segurança consideramos 'new' (mas o client sempre envia)
            var groupFilter = group === GROUP_OTHERS ? GROUP_OTHERS : GROUP_NEW;
            renderPdf(context, invoice, vendorId || '', groupFilter);
        }

        return {onRequest: onRequest};
    });