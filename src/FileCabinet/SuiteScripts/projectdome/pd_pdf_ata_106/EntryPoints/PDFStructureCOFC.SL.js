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

        // ---------------------------------------------------------------------------------
        // Estimativa de layout (pra esticar a moldura da tabela até o rodapé sem quebrar página).
        // Valores calibrados a partir dos PDFs gerados (Letter, padding 0.45in, fontes atuais).
        // A estimativa é conservadora: se errar, sobra um pouco de espaço embaixo, mas não quebra.
        // Se ainda quebrar em algum caso, aumente SAFETY_PT; se sobrar espaço demais, diminua.
        // ---------------------------------------------------------------------------------
        var PAGE_USABLE_PT = 792 - (0.45 * 72 * 2); // 727.2pt (Letter 11in - padding top/bottom)
        var HEADER_BASE_PT = 150;   // título + caixa nº + cabeçalhos das tabelas + meta row
        var ADDR_LINE_PT = 12.4;    // 8pt * 155%
        var ADDR_CHARS = 55;        // caracteres por linha na coluna de endereço
        var FOOTER_PT = 115;        // declaração + bloco de assinatura
        var ROW_PAD_PT = 4.5;       // padding vertical da linha de item
        var ROW_LINE_PT = 9;        // altura de cada linha de texto (7.5pt)
        var DESC_CHARS = 27;        // caracteres por linha na coluna Description
        var PART_CHARS = 18;        // caracteres por linha na coluna Part No.
        var SAFETY_PT = 15;         // margem de segurança

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
                var so = record.load({type: record.Type.SALES_ORDER, id: createdFromId});
                return so.getValue({fieldId: 'transactionnumber'}) || '';
            } catch (e) {
                return '';
            }
        }

        /**
         * Busca, via SuiteQL, os candidatos a número de certificado nas linhas de Item Receipt
         * do MESMO item da linha da invoice. O certificado é uma propriedade do lote recebido
         * (Item Receipt), não da invoice — por isso não dá pra ler ele da própria linha da
         * invoice, que não tem esse dado por lote. Filtrar por item (em vez de pela Sales Order
         * inteira) evita misturar certificados de outros itens/fornecedores da mesma invoice.
         *
         * Retorna os candidatos crus (cetno, quantity, statusitem) — o casamento com o lote
         * certo é feito depois, em matchCertNumber(), por quantidade + status.
         */
        function getCertNumbersByItem(itemId) {
            if (!itemId) return [];
            try {
                // 'inventorydetail' foi removido do SELECT: é um campo de subrecord marcado
                // como interno pra channel SEARCH (o mesmo motor usado pelo SuiteQL), então
                // não pode ser selecionado — dá NOT_EXPOSED. Nunca foi usado no matching mesmo.
                var sql =
                    "SELECT " +
                    "irline.custcol_pd_numero_do_certificado AS cetno, " +
                    "irline.quantity AS quantity, " +
                    "irline.custcol_pd_aae_status_item AS statusitem " +
                    "FROM itemReceiptItem AS irline " +
                    "WHERE irline.item = ?";

                var resultSet = query.runSuiteQL({query: sql, params: [itemId]});
                return resultSet.asMappedResults();
            } catch (e) {
                log.error({
                    title: 'Erro ao buscar Cert No via SuiteQL (por item)',
                    details: {itemId: itemId, message: e.message}
                });
                return [];
            }
        }

        /**
         * Encontra, dentro dos candidatos trazidos pra este item, o que bate em quantidade e
         * status com o lote sendo montado no PDF — e remove esse candidato da lista (splice)
         * pra não aplicar o mesmo certificado em dois lotes diferentes que tenham, por
         * coincidência, a mesma quantidade.
         */
        function matchCertNumber(candidates, lotQuantity, statusVal) {
            if (!candidates || !candidates.length) return '';

            for (var c = 0; c < candidates.length; c++) {
                var candidate = candidates[c];
                var quantityMatches = Number(candidate.quantity) === Number(lotQuantity);
                var statusMatches = String(candidate.statusitem || '') === String(statusVal || '');

                if (quantityMatches && statusMatches) {
                    candidates.splice(c, 1);
                    return candidate.cetno || '';
                }
            }

            // Fallback: não achou casando quantidade + status — tenta só por quantidade.
            for (var c2 = 0; c2 < candidates.length; c2++) {
                if (Number(candidates[c2].quantity) === Number(lotQuantity)) {
                    var cetno = candidates[c2].cetno || '';
                    candidates.splice(c2, 1);
                    return cetno;
                }
            }

            return '';
        }

        /**
         * Busca, por item, o certificado de cada lote efetivamente recebido nos Item Receipts.
         * O lote (inventoryassignment do subrecord inventorydetail) não é exposto nem via
         * SuiteQL nem via N/search — por isso a única forma de saber qual lote cada linha de
         * IR recebeu é carregando o registro inteiro e lendo o subrecord diretamente.
         *
         * Retorna um candidato por lote: { lotText, cetno, statusitem, relatedSo, tranDate }.
         * O casamento com o lote da invoice é feito depois, em matchCertByLot(), pela
         * identidade do lote (texto exato), com prioridade pra SO relacionada.
         */
        function getLotCertCandidates(itemId) {
            if (!itemId) return [];
            var candidates = [];
            try {
                var irIds = [];
                search.create({
                    type: search.Type.ITEM_RECEIPT,
                    filters: [
                        ['item', 'anyof', itemId],
                        'AND',
                        ['mainline', 'is', 'F']
                    ],
                    columns: ['internalid']
                }).run().each(function (result) {
                    var id = result.getValue({name: 'internalid'});
                    if (irIds.indexOf(id) === -1) irIds.push(id);
                    return true;
                });

                for (var r = 0; r < irIds.length; r++) {
                    try {
                        var ir = record.load({type: record.Type.ITEM_RECEIPT, id: irIds[r], isDynamic: false});
                        var relatedSo = ir.getValue({fieldId: 'custbody_related_so'}) || '';
                        var tranDate = ir.getValue({fieldId: 'trandate'});
                        var lineCount = ir.getLineCount({sublistId: 'item'}) || 0;

                        for (var l = 0; l < lineCount; l++) {
                            if (String(ir.getSublistValue({sublistId: 'item', fieldId: 'item', line: l})) !== String(itemId)) continue;

                            var cetno = ir.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pd_numero_do_certificado',
                                line: l
                            }) || '';
                            var statusitem = ir.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pd_aae_status_item',
                                line: l
                            }) || '';

                            var invDetField = ir.getSublistField({sublistId: 'item', fieldId: 'inventorydetail', line: l});
                            if (!invDetField) continue;

                            var invDet = ir.getSublistSubrecord({sublistId: 'item', fieldId: 'inventorydetail', line: l});
                            var assCount = invDet.getLineCount({sublistId: 'inventoryassignment'}) || 0;

                            for (var a = 0; a < assCount; a++) {
                                // 'receiptinventorynumber' é usado ao criar um lote novo no recebimento;
                                // 'issueinventorynumber' cobre o caso de selecionar um lote já existente.
                                var lotText = invDet.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'receiptinventorynumber',
                                    line: a
                                }) || invDet.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    line: a
                                }) || '';

                                if (!lotText) continue;

                                candidates.push({
                                    lotText: lotText,
                                    cetno: cetno,
                                    statusitem: statusitem,
                                    relatedSo: relatedSo,
                                    tranDate: tranDate
                                });
                            }
                        }
                    } catch (irErr) {
                        log.error({
                            title: 'Erro ao carregar Item Receipt para match por lote',
                            details: {irId: irIds[r], message: irErr.message}
                        });
                    }
                }
            } catch (e) {
                log.error({
                    title: 'Erro ao buscar Item Receipts por item (match por lote)',
                    details: {itemId: itemId, message: e.message}
                });
            }
            return candidates;
        }

        /**
         * Casa o lote da invoice (texto exato do número do lote) com os candidatos trazidos
         * por getLotCertCandidates(). Prioriza o Item Receipt cujo custbody_related_so bate
         * com a Sales Order de origem da invoice (createdfrom); sem essa correspondência,
         * usa o recebimento mais recente daquele lote.
         */
        function matchCertByLot(candidates, lotText, invoiceSoId) {
            if (!candidates || !candidates.length || !lotText) return '';

            var sameLot = candidates.filter(function (c) {
                return String(c.lotText) === String(lotText);
            });
            if (!sameLot.length) return '';

            if (invoiceSoId) {
                var bySo = sameLot.filter(function (c) {
                    return c.relatedSo && String(c.relatedSo) === String(invoiceSoId);
                });
                if (bySo.length) return bySo[0].cetno || '';
            }

            sameLot.sort(function (x, y) {
                return new Date(y.tranDate) - new Date(x.tranDate);
            });
            return sameLot[0].cetno || '';
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

            // SO de origem da invoice — usada pra priorizar, no match por lote, o Item
            // Receipt cujo custbody_related_so corresponde a esta mesma SO.
            var invoiceSoId = invoice.getValue({fieldId: 'createdfrom'}) || '';

            for (var i = 0; i < lineCount; i++) {

                var vendorOnLine = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: COL_VENDOR_ON_LINE,
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
                var quantity = invoice.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i}) || '';
                var statusTxt = invoice.getSublistText({sublistId: 'item', fieldId: COL_STATUS_ON_LINE, line: i}) || '';
                var manufId = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_aae_manufacturer',
                    line: i
                }) || '';

                var conversionFactor = Number(invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_measurement_conversion',
                    line: i
                })) || 1;

                var manufacturerName = '';
                if (manufId) {
                    try {
                        var mRec = record.load({type: record.Type.VENDOR, id: manufId});
                        manufacturerName = mRec.getValue({fieldId: 'companyname'}) || '';
                    } catch (e) {
                    }
                }

                var partNumber = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbercustomer_display',
                    line: i
                }) || '';
                var vendorPartNumber = invoice.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_partnumbervendor',
                    line: i
                }) || '';
                var poNumber = invoice.getSublistText({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_purchaseorder',
                    line: i
                }) || '';

                var itemId = invoice.getSublistValue({sublistId: 'item', fieldId: 'item', line: i}) || '';

                try {

                    var inventoryDetailField = invoice.getSublistField({
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

                            // Sem lote de fato atribuído nesta linha: mantém o fallback por
                            // quantidade/status (não há identidade de lote pra casar).
                            rows.push({
                                partNumber: partNumber,
                                vendorPartNumber: vendorPartNumber,
                                description: description,
                                quantity: quantity * conversionFactor,
                                statusText: statusTxt,
                                statusVal: statusVal,
                                manufacturerName: manufacturerName,
                                serialText: '', // sem inventory assignment, não há lote/série a exibir
                                lotText: "",
                                poNumber: poNumber,
                                certNumber: matchCertNumber(getCertNumbersByItem(itemId), quantity, statusVal)
                            });

                        } else {

                            // Candidatos a certificado por lote pra este item — casados pela
                            // identidade do lote (não por quantidade), um lookup por linha.
                            var lotCandidates = getLotCertCandidates(itemId);

                            for (var a = 0; a < assCount; a++) {

                                var serialNum = invDet.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    line: a
                                }) || '';

                                var lotQuantity = Number(invDet.getSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    line: a
                                }));

                                if (serialNum) rows.push({
                                    partNumber: partNumber,
                                    vendorPartNumber: vendorPartNumber,
                                    description: description,
                                    quantity: lotQuantity * conversionFactor,
                                    statusText: statusTxt,
                                    statusVal: statusVal,
                                    manufacturerName: manufacturerName,
                                    serialText: serialNum,
                                    lotText: "",
                                    poNumber: poNumber,
                                    certNumber: matchCertByLot(lotCandidates, serialNum, invoiceSoId)
                                });

                            }

                        }

                    } else {

                        rows.push({
                            partNumber: partNumber,
                            vendorPartNumber: vendorPartNumber,
                            description: description,
                            quantity: quantity * conversionFactor,
                            statusText: statusTxt,
                            statusVal: statusVal,
                            manufacturerName: manufacturerName,
                            serialText: '',
                            lotText: "",
                            poNumber: poNumber,
                            certNumber: matchCertNumber(getCertNumbersByItem(itemId), quantity, statusVal)
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

        // Columns: Part No. | Description | Cond | Qty | Lot/Serial # | Cert No | PO Number (7 colunas)
        // Sem linhas vazias de preenchimento: quem estica a moldura até o rodapé é o spacer
        // calculado em estimateSpacerPt().
        function buildItemRowsXml(rows, codPo) {
            var xml = '';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                // Escape text first, then inject <br/> as literal markup (not escaped)
                var descEscaped = escapeXml(String(r.description || '').replace(/(?:\r\n|\r|\n)/g, '\n'));
                var descHtml = descEscaped.replace(/\n/g, '<br/>');
                xml += ''
                    + '<tr>'
                    + '<td class="col-left">' + escapeXml(r.partNumber || '') + '</td>'
                    + '<td class="col-left">' + descHtml + '</td>'
                    + '<td class="col-center">' + escapeXml(r.statusText || '') + '</td>'
                    + '<td class="col-center" style="white-space: nowrap;">' + escapeXml(formatQuantity(r.quantity)) + '</td>'
                    + '<td class="col-center">' + escapeXml(r.serialText || '') + '</td>'
                    + '<td class="col-center">' + escapeXml(r.certNumber || '') + '</td>'  // Cert No
                    + '<td class="col-center">' + escapeXml(codPo) + '</td>'  // PO Number
                    + '</tr>';
            }
            return xml;
        }

        // Quantas linhas um texto ocupa numa coluna com ~charsPerLine caracteres por linha.
        function wrappedLines(text, charsPerLine) {
            var total = 0;
            String(text || '').split(/\r\n|\r|\n/).forEach(function (l) {
                total += Math.max(1, Math.ceil(l.length / charsPerLine));
            });
            return total;
        }

        // Estima o espaço livre na página 1 entre a última linha de item e o rodapé (em pt).
        function estimateSpacerPt(rows, billAddress, shipAddress) {
            var addrLines = Math.max(
                wrappedLines(billAddress, ADDR_CHARS),
                wrappedLines(shipAddress, ADDR_CHARS),
                3
            );
            var used = HEADER_BASE_PT + addrLines * ADDR_LINE_PT + FOOTER_PT + SAFETY_PT;

            for (var i = 0; i < rows.length; i++) {
                var lines = Math.max(
                    wrappedLines(rows[i].description, DESC_CHARS),
                    wrappedLines(rows[i].partNumber, PART_CHARS),
                    1
                );
                used += ROW_PAD_PT + lines * ROW_LINE_PT;
            }

            var free = PAGE_USABLE_PT - used;
            // Se não cabe tudo numa página, o spacer não ajuda: a tabela quebra naturalmente
            // e o rodapé (tablefooter) fica no fim da tabela.
            return free > 0 ? Math.floor(free) : 0;
        }

        function renderPdf(context, invoice, vendorIdFilter, groupFilter) {
            var sellerContract = invoice.getValue({fieldId: 'tranid'}) || '';
            var codPo = invoice.getValue({fieldId: 'otherrefnum'}) || '';
            var rawDate = invoice.getValue({fieldId: 'trandate'});
            var dateStr = rawDate ? format.format({value: rawDate, type: format.Type.DATE}) : '';
            var rawShipDate = invoice.getValue({fieldId: 'shipdate'});
            var shipDate = rawShipDate ? format.format({value: rawShipDate, type: format.Type.DATE}) : '';
            var billAddress = invoice.getValue({fieldId: 'billaddress'}) || '';
            var shipAddress = invoice.getValue({fieldId: 'shipaddress'}) || '';
            var awb = invoice.getValue({fieldId: 'custbody_pd_awb'}) || '';

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

            // Linhas do grupo atual (vendor + status) — o certificado de cada lote é
            // buscado por item dentro de collectLines (ver getLotCertCandidates/matchCertByLot,
            // com fallback por quantidade/status pra itens sem lote).
            var rows = collectLines(invoice, vendorIdFilter, groupFilter);

            // Altura do spacer calculada pelo conteúdo (antes era 280px fixos + 15 linhas vazias,
            // o que estourava a página e empurrava o rodapé sozinho pra página 2).
            var spacerPt = estimateSpacerPt(rows, billAddress, shipAddress);
            log.debug({title: 'renderPdf - spacer estimado (pt)', details: {rows: rows.length, spacerPt: spacerPt}});

            var spacerRow = spacerPt > 0
                ? '<tr><td colspan="7" style="height: ' + spacerPt + 'pt; padding: 0px; border: 0px;"></td></tr>'
                : '';

            // Assinatura: mostra apenas se há assinador e linhas neste grupo
            var showSignature = hasSigner && rows.length > 0;

            var signatureCell = showSignature
                ? buildSignatureHtml(employeeName, signatureFontLink)
                : '';

            var signedNameCell = showSignature ? escapeXml(employeeName) : '';

            var pdfContent =
                '<?xml version="1.0"?>' +
                '<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">' +
                '<pdf>' +
                '<head>' +
                signatureFontLink +
                '  <style type="text/css">' +
                '    * { font-family: Arial, sans-serif; }' +
                '    table { font-size: 8pt; table-layout: fixed; }' +
                '    td    { font-size: 8pt; padding: 3px 5px; vertical-align: top; }' +
                '    th    { font-size: 8pt; font-weight: bold; padding: 4px 6px; vertical-align: middle; }' +

                // Header title block
                '    .coc-company { font-size: 14pt; font-weight: bold; font-style: italic; }' +
                '    .coc-title   { font-size: 13pt; font-weight: bold; }' +

                // Top-right number box
                '    table.num-box { width: 100%; border-collapse: collapse; border: 1.5px solid #000000; }' +
                '    table.num-box td { font-size: 9pt; padding: 3px 7px; border: 0px; }' +
                '    .num-label    { font-size: 7pt; text-align: right; letter-spacing: 1px; }' +
                '    .num-value    { font-size: 13pt; font-weight: bold; }' +
                '    .num-original { font-size: 9pt; font-weight: bold; text-align: center;' +
                '                    border-top: 1px solid #000000 !important; padding: 2px 7px !important; }' +

                // Address block
                '    table.addr-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.addr-table th { background-color: #ffffff; color: #000000; border-bottom: 1px solid #000000;' +
                '                          font-size: 8pt; text-align: left; padding: 3px 6px; }' +
                '    table.addr-table td { font-size: 8pt; padding: 6px 8px; line-height: 155%; vertical-align: top; }' +
                '    .addr-divider { border-left: 1px solid #000000; }' +

                // Meta row
                '    table.meta-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.meta-table th { background-color: #ffffff; color: #000000;' +
                '                          border: 1px solid #000000; font-size: 8pt;' +
                '                          text-align: center; padding: 4px 6px; }' +
                '    table.meta-table td { font-size: 8pt; text-align: center;' +
                '                          border: 1px solid #000000; padding: 5px 6px; }' +

                // Items table
                '    table.item-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 6px; }' +
                '    table.item-table th { background-color: #ffffff; color: #000000;' +
                '                          border: 0px; border-bottom: 1px solid #000000; font-size: 8pt;' +
                '                          text-align: center; padding: 2px 5px; }' +
                '    table.item-table td { font-size: 7.5pt; border: 0px;' +
                '                          padding: 2px 5px; vertical-align: top; }' +
                '    .col-left   { text-align: left; }' +
                '    .col-center { text-align: center; }' +
                '    .col-right  { text-align: right; }' +

                // Certification statement
                '    table.cert-table { width: 100%; border-collapse: collapse;' +
                '                       border: 1px solid #000000; margin-top: 6px; }' +
                '    table.cert-table td { font-size: 8pt; padding: 8px 10px; line-height: 155%; }' +

                // Signature block
                '    table.sign-table { width: 100%; border-collapse: collapse;' +
                '                       border: 1px solid #000000; margin-top: 0px; }' +
                '    table.sign-table td { font-size: 8pt; padding: 6px 10px; vertical-align: top; }' +
                '    .sign-divider { border-left: 1px solid #000000; }' +
                '    .sign-label   { font-size: 7pt; color: #333333; }' +
                '  </style>' +
                '</head>' +

                '<body padding="0.45in 0.55in 0.45in 0.55in" size="Letter">' +

                // 1. PAGE HEADER — company name + title + number box
                '<table style="width: 100%; border-collapse: collapse; border: 0px;">' +
                '  <tr>' +
                '    <td style="width: 65%; vertical-align: bottom; padding: 0px;">' +
                '      <span class="coc-company">Aloia Aerospace Inc.</span><br/>' +
                '      <span class="coc-title">CERTIFICATE OF CONFORMITY</span>' +
                '    </td>' +
                '    <td style="width: 35%; vertical-align: top; padding: 0px 0px 0px 10px;">' +
                '      <table style="width: 100%; border: 0px; border-collapse: collapse;">' +
                '        <tr><td style="padding: 0px; text-align: right;">' +
                '          <span style="font-size: 8pt; font-weight: bold; letter-spacing: 2px;">SITA</span>' +
                '        </td></tr>' +
                '        <tr><td style="padding: 3px 0px 0px 0px;">' +
                '          <table class="num-box">' +
                '            <tr>' +
                '              <td class="num-label">No:</td>' +
                '              <td class="num-value">&nbsp;' + escapeXml(sellerContract) + '</td>' +
                '            </tr>' +
                '            <tr><td colspan="2" class="num-original">ORIGINAL</td></tr>' +
                '          </table>' +
                '        </td></tr>' +
                '      </table>' +
                '    </td>' +
                '  </tr>' +
                '</table>' +

                // 2. BILL TO / SHIP TO
                '<table class="addr-table">' +
                '  <tr>' +
                '    <th style="width: 50%;">Bill To:</th>' +
                '    <th style="width: 50%;" class="addr-divider">Ship To:</th>' +
                '  </tr>' +
                '  <tr>' +
                '    <td style="width: 50%; min-height: 60px;">' + escapeXml(billAddress).replace(/\n/g, '<br/>') + '</td>' +
                '    <td style="width: 50%; min-height: 60px;" class="addr-divider">' + escapeXml(shipAddress).replace(/\n/g, '<br/>') + '</td>' +
                '  </tr>' +
                '</table>' +

                // 3. META ROW — Customer PO / Ship Date / AWB
                '<table class="meta-table">' +
                '  <tr>' +
                '    <th style="width: 33%;">Customer PO</th>' +
                '    <th style="width: 34%;">Ship Date</th>' +
                '    <th style="width: 33%;">Airway Bill Number</th>' +
                '  </tr>' +
                '  <tr>' +
                '    <td style="width: 33%;">' + escapeXml(codPo) + '</td>' +
                '    <td style="width: 34%;">' + escapeXml(shipDate) + '</td>' +
                '    <td style="width: 33%;">' + escapeXml(awb) + '</td>' +
                '  </tr>' +
                '</table>' +

                // 4. ITEMS TABLE
                '<table class="item-table">' +

                '  <tr>' +
                '    <th style="width: 18%;" class="col-left">Part No.</th>' +
                '    <th style="width: 26%;" class="col-left">Description</th>' +
                '    <th style="width: 6%;"  class="col-center">Cond</th>' +
                '    <th style="width: 7%;"  class="col-center">Qty</th>' +
                '    <th style="width: 17%;" class="col-center">Lot/Serial #</th>' +
                '    <th style="width: 12%;" class="col-center">Cert No</th>' +
                '    <th style="width: 14%;" class="col-center">PO Number</th>' +
                '  </tr>' +

                buildItemRowsXml(rows, codPo) +

                spacerRow +

                // 5+6. CERT STATEMENT + SIGNATURE — no fim da tabela via tablefooter
                '<tablefooter>' +
                '  <tr>' +
                '    <td colspan="7" style="border: 0px; padding: 0px;">' +

                '      <table class="cert-table">' +
                '        <tr>' +
                '          <td>' +
                '            <b>We hereby certify that the parts in this shipment conform with applicable specifications' +
                '            and that documentation and/or data is on file and available for examination.</b>' +
                '          </td>' +
                '        </tr>' +
                '      </table>' +

                '      <table class="sign-table">' +
                '        <tr>' +
                '          <td style="width: 50%; vertical-align: bottom; padding: 10px 10px 6px 10px;">' +
                // Tabela aninhada: o BFO empilha linhas de tabela de forma confiável dentro do tablefooter
                '            <table style="width: 100%; border-collapse: collapse;">' +
                '              <tr><td style="padding: 0;"><span class="sign-label">Signed:</span></td></tr>' +
                '              <tr><td style="padding: 2px 0 0 0; border-bottom: 1px solid #000000; color: #1a44a8; height: 30px; vertical-align: bottom;">' + (signatureCell || '&nbsp;') + '</td></tr>' +
                '              <tr><td style="padding: 3px 0 0 0; font-size: 9pt;">' + (signedNameCell || '&nbsp;') + '</td></tr>' +
                '              <tr><td style="padding: 2px 0 0 0; font-size: 7.5pt;">For and on behalf of Aloia Aerospace Inc.</td></tr>' +
                '            </table>' +
                '          </td>' +
                '          <td style="width: 50%; vertical-align: bottom; padding: 10px 10px 6px 10px;" class="sign-divider">' +
                '            <span style="font-size: 7.5pt;">Inspectors Stamp</span>' +
                '          </td>' +
                '        </tr>' +
                '      </table>' +

                '    </td>' +
                '  </tr>' +
                '</tablefooter>' +

                '</table>' +

                '</body></pdf>';

            var pdfFile = render.xmlToPdf({xmlString: pdfContent});

            // Nome do arquivo
            var name = 'CofC';
            if (vendorIdFilter) {
                var vname = getVendorName(vendorIdFilter);
                if (vname) name += '_' + vname.replace(/[^\w\-]+/g, '_');
            }
            name += (groupFilter === GROUP_NEW ? '_NEW' : '_OTHERS');
            name += '.pdf';

            // Download
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

            var groupFilter = group === GROUP_OTHERS ? GROUP_OTHERS : GROUP_NEW;
            renderPdf(context, invoice, vendorId || '', groupFilter);
        }

        return {onRequest: onRequest};
    });