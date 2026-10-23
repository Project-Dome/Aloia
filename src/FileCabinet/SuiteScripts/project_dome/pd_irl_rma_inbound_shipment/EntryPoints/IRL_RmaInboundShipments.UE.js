/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author Dome
 * @description EP1 (TECH-SPEC section 5): adiciona a subaba "Inbound Shipments Vinculados" ao
 * Return Authorization, nos modos VIEW e EDIT.
 */
define([
    'N/log',
    '../UseCases/ListLinkedInboundShipments',
], function (log, ListLinkedInboundShipments) {

    function beforeLoad(context) {
        var isViewOrEdit = context.type === context.UserEventType.VIEW
            || context.type === context.UserEventType.EDIT;

        if (!isViewOrEdit) return;

        ListLinkedInboundShipments.execute({
            record: context.newRecord,
            form: context.form,
        });
    }

    return {
        beforeLoad: beforeLoad,
    };
});