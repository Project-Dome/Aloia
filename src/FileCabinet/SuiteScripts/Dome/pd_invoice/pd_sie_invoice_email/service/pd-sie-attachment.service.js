/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Project Dome
 *
 * Service: gera os PDFs anexados ao e-mail chamando os Suitelets legados
 * DIRETO via require() (sem HTTP — https.get batia no login do NetSuite e
 * estourava cota). Os 4 Suitelets exportam generatePdf()/getGroupPlan().
 *
 * Dependências de outros projetos (caminho absoluto):
 *   /SuiteScripts/Dome/pd_invoice/pd_pdf_transaction/  (Invoice / Packing List)
 *   /SuiteScripts/Dome/pd_invoice/pd_pdf_ata_106/      (ATA-106 / COFC)
 */
define(
    [
        'N/log',
        '/SuiteScripts/Dome/pd_invoice/pd_pdf_transaction/suitelet/pd_pdf_invoice_sl',
        '/SuiteScripts/Dome/pd_invoice/pd_pdf_transaction/suitelet/pd_pdf_packing_list_sl',
        '/SuiteScripts/Dome/pd_invoice/pd_pdf_ata_106/suitelet/PDFStructure.SL',
        '/SuiteScripts/Dome/pd_invoice/pd_pdf_ata_106/suitelet/PDFStructureCOFC.SL',
        './pd-sie-invoice.service'
    ],
    function (log, invoiceSl, packingListSl, ata106Sl, cofcSl, invoiceService) {

        /**
         * TODO — CONFIRMAR: getGroupPlan retorna >=1 grupo pra qualquer invoice
         * com linha de item. Packing List não tem regra de disponibilidade no
         * Suitelet original; hoje = "tem linha de item".
         */
        function getAvailableDocuments(invoiceId) {
            return {
                ata106Groups: safeGroupPlan(ata106Sl, invoiceId, 'ATA-106'),
                cofcGroups: safeGroupPlan(cofcSl, invoiceId, 'COFC'),
                hasPackingList: invoiceService.hasItemLines(invoiceId)
            };
        }

        function safeGroupPlan(pdfModule, invoiceId, label) {
            try {
                return pdfModule.getGroupPlan(invoiceId) || [];
            } catch (e) {
                log.error({ title: 'pd_sie - erro no getGroupPlan ' + label, details: e.message });
                return [];
            }
        }

        function buildAttachments(invoiceId) {
            var attachments = [invoiceSl.generatePdf(invoiceId)];
            var docs = getAvailableDocuments(invoiceId);

            if (docs.hasPackingList) {
                attachments.push(packingListSl.generatePdf(invoiceId));
            }

            docs.ata106Groups.forEach(function (g) {
                attachments.push(ata106Sl.generatePdf(invoiceId, g.vendorId, g.group).file);
            });

            docs.cofcGroups.forEach(function (g) {
                attachments.push(cofcSl.generatePdf(invoiceId, g.vendorId, g.group).file);
            });

            return attachments;
        }

        return {
            getAvailableDocuments: getAvailableDocuments,
            buildAttachments: buildAttachments
        };
    }
);
