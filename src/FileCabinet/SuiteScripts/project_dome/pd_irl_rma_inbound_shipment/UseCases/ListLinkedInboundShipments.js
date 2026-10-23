/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description Use case (EP1 - TECH-SPEC section 5): monta a subaba "Inbound Shipments
 * Vinculados" no Return Authorization, listando os vinculos registrados em
 * customrecord_pd_irl_rma_link. Uma linha por vinculo encontrado (premissa: RMA de item unico -
 * ver TECH-SPEC secao 4).
 */
define([
    'N/log',
    'N/ui/serverWidget',
    '../Models/ReturnAuthorization.model',
    '../Models/RmaLink.model',
    '../Models/TransactionChain.model',
    '../Constants/rmaLinkSublist.constants',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util',
], function (log, serverWidget, ReturnAuthorizationModel, RmaLinkModel, TransactionChainModel, sublistConstants) {

    function execute(params) {
        var record = params.record;
        var form = params.form;

        var rmaId = record.id;
        if (isNullOrEmpty(rmaId)) {
            log.error({ title: 'ListLinkedInboundShipments | execute - RMA sem internal id', details: record });
            return;
        }

        var links = RmaLinkModel.getByRma(rmaId);
        var headerData = ReturnAuthorizationModel.readData(record);
        var partNumber = getFirstItemPartNumber(headerData);
        var vendorName = resolveVendorName(headerData.createdFrom);

        var sublist = buildSublist(form);

        (links || []).forEach(function (link, index) {
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.tranId.id, line: index, value: headerData.tranId || '' });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.customer.id, line: index, value: getSelectName(headerData.customer) });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.poCustomer.id, line: index, value: headerData.poCustomer || '' });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.salesRep.id, line: index, value: getSelectName(headerData.salesRep) });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.partNumber.id, line: index, value: partNumber });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.vendor.id, line: index, value: vendorName });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.location.id, line: index, value: getSelectName(headerData.location) });
            sublist.setSublistValue({ fieldId: sublistConstants.COLUMNS.invoice.id, line: index, value: getSelectName(headerData.createdFrom) });
        });

        log.audit({
            title: 'ListLinkedInboundShipments | execute - success',
            details: JSON.stringify({ rmaId: rmaId, linksFound: (links || []).length }),
        });
    }

    function buildSublist(form) {
        form.addSubtab({
            id: sublistConstants.SUBTAB.id,
            label: sublistConstants.SUBTAB.label,
        });

        var sublist = form.addSublist({
            id: sublistConstants.SUBLIST.id,
            type: serverWidget.SublistType.LIST,
            label: sublistConstants.SUBLIST.label,
            tab: sublistConstants.SUBTAB.id,
        });

        Object.keys(sublistConstants.COLUMNS).forEach(function (key) {
            var column = sublistConstants.COLUMNS[key];
            sublist.addField({
                id: column.id,
                type: serverWidget.FieldType.TEXT,
                label: column.label,
            }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        });

        return sublist;
    }

    function getFirstItemPartNumber(headerData) {
        if (isNullOrEmpty(headerData.items)) return '';
        return headerData.items[0].partNumberCustomer || '';
    }

    function getSelectName(selectValue) {
        return (selectValue && selectValue.name) || '';
    }

    /**
     * Vendor: cadeia RMA -> Invoice (createdfrom) -> Sales Order (createdfrom) -> Purchase Order
     * -> Vendor. Risco tecnico documentado no TECH-SPEC (secao 3) - a viabilidade dessa cadeia de
     * joins ainda nao foi validada contra a conta real. Implementado defensivamente: qualquer
     * falha na cadeia retorna Vendor vazio em vez de quebrar a subaba inteira.
     */
    function resolveVendorName(invoiceSelect) {
        try {
            var invoiceId = invoiceSelect && invoiceSelect.id;
            if (isNullOrEmpty(invoiceId)) return '';

            var salesOrder = TransactionChainModel.getCreatedFromId(invoiceId);
            var salesOrderId = salesOrder && salesOrder.createdFrom && salesOrder.createdFrom.id;
            if (isNullOrEmpty(salesOrderId)) return '';

            var purchaseOrder = TransactionChainModel.getPurchaseOrderByCreatedFrom(salesOrderId);
            return (purchaseOrder && purchaseOrder.vendor && purchaseOrder.vendor.name) || '';
        } catch (e) {
            log.error({ title: 'ListLinkedInboundShipments | resolveVendorName - falha na cadeia de joins', details: e });
            return '';
        }
    }

    return { execute: execute };
});