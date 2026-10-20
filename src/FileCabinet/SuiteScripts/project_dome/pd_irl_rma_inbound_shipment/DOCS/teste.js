/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/ui/serverWidget', 'N/log'], function (search, serverWidget, log) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var form = context.form;
        var shipmentId = context.newRecord.id;

        var sublist = form.addSublist({
            id: 'custpage_pd_irl_links',
            type: serverWidget.SublistType.LIST,
            label: 'RMAs Vinculadas'
        });

        sublist.addField({ id: 'custpage_rma', type: serverWidget.FieldType.TEXT, label: 'RMA' });
        sublist.addField({ id: 'custpage_qty', type: serverWidget.FieldType.INTEGER, label: 'Quantidade' });

        var results = search.create({
            type: 'customrecord_pd_irl_rma_link',
            filters: [['custrecord_pd_irl_shipment', 'anyof', shipmentId]],
            columns: ['custrecord_pd_irl_rma', 'custrecord_pd_irl_qty']
        }).run().getRange({ start: 0, end: 100 });

        results.forEach(function (res, i) {
            var rmaText = res.getText('custrecord_pd_irl_rma');
            var rmaValue = res.getValue('custrecord_pd_irl_rma');
            var qty = res.getValue('custrecord_pd_irl_qty');

            log.debug('pd_irl linha ' + i, JSON.stringify({ rmaText: rmaText, rmaValue: rmaValue, qty: qty }));

            sublist.setSublistValue({ id: 'custpage_rma', line: i, value: rmaText || rmaValue || '(vazio)' });
            sublist.setSublistValue({ id: 'custpage_qty', line: i, value: qty || '' });
        });
    }

    return { beforeLoad: beforeLoad };
});
