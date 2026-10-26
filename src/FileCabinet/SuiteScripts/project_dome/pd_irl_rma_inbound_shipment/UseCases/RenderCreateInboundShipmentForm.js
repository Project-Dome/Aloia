/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description Use case (EP2 GET - TECH-SPEC section 6): monta o formulario de criacao de Inbound
 * Shipment vinculado a um RMA.
 * - Campo RMA: lista apenas RMAs ainda sem vinculo registrado em customrecord_pd_irl_rma_link
 *   (regra de negocio 1 - RMA unico por Shipment).
 * - Campo Location: desabilitado nesta tela; sera preenchido via Client Script assim que o RMA for
 *   selecionado (EP3 - TECH-SPEC secao 7, anexado via form.clientScriptModulePath). O valor
 *   definitivo gravado no Inbound Shipment vem, de qualquer forma, do RMA selecionado no POST (ver
 *   CreateInboundShipmentForRma) - este campo aqui e so feedback visual.
 * - Campos Bill Of Lading, Expected Shipping Date, Expected Delivery Date e Memo (TECH-SPEC secao 6):
 *   campos nativos opcionais do inboundshipment, espelhando a tela nativa de criacao - sem logica
 *   especial, apenas editaveis (TEXT para Bill Of Lading/Memo, DATE para as duas datas).
 */
define([
    'N/log',
    'N/ui/serverWidget',
    '../Models/ReturnAuthorization.model',
    '../Models/RmaLink.model',
    '../Constants/createInboundShipmentForm.constants',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js',
], function (log, serverWidget, ReturnAuthorizationModel, RmaLinkModel, formConstants) {

    var CLIENT_SCRIPT_MODULE_PATH = '../EntryPoints/IRL_CreateInboundShipment.CS.js';

    function execute() {
        var form = serverWidget.createForm({ title: formConstants.FORM.title });
        form.clientScriptModulePath = CLIENT_SCRIPT_MODULE_PATH;

        addRmaField(form);
        addLocationField(form);
        addBillOfLadingField(form);
        addExpectedShippingDateField(form);
        addExpectedDeliveryDateField(form);
        addMemoField(form);

        form.addSubmitButton({ label: formConstants.FORM.submitLabel });

        return form;
    }

    function addRmaField(form) {
        var field = form.addField({
            id: formConstants.FIELDS.rma.id,
            type: serverWidget.FieldType.SELECT,
            label: formConstants.FIELDS.rma.label,
        });
        field.isMandatory = true;
        field.addSelectOption({ value: '', text: '' });

        var linkedRmaIds = RmaLinkModel.getAllLinkedRmaIds();
        var selectableRmas = ReturnAuthorizationModel.searchSelectableForShipment(linkedRmaIds);

        selectableRmas.forEach(function (rma) {
            field.addSelectOption({ value: rma.id, text: rma.tranId || rma.id });
        });

        log.audit({
            title: 'RenderCreateInboundShipmentForm | addRmaField - success',
            details: JSON.stringify({ linkedExcluded: linkedRmaIds.length, selectable: selectableRmas.length }),
        });
    }

    function addLocationField(form) {
        var field = form.addField({
            id: formConstants.FIELDS.location.id,
            type: serverWidget.FieldType.SELECT,
            label: formConstants.FIELDS.location.label,
            source: 'location',
        });
        field.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
    }

    function addBillOfLadingField(form) {
        form.addField({
            id: formConstants.FIELDS.billOfLading.id,
            type: serverWidget.FieldType.TEXT,
            label: formConstants.FIELDS.billOfLading.label,
        });
    }

    function addExpectedShippingDateField(form) {
        form.addField({
            id: formConstants.FIELDS.expectedShippingDate.id,
            type: serverWidget.FieldType.DATE,
            label: formConstants.FIELDS.expectedShippingDate.label,
        });
    }

    function addExpectedDeliveryDateField(form) {
        form.addField({
            id: formConstants.FIELDS.expectedDeliveryDate.id,
            type: serverWidget.FieldType.DATE,
            label: formConstants.FIELDS.expectedDeliveryDate.label,
        });
    }

    function addMemoField(form) {
        form.addField({
            id: formConstants.FIELDS.memo.id,
            type: serverWidget.FieldType.TEXT,
            label: formConstants.FIELDS.memo.label,
        });
    }

    return { execute: execute };
});
