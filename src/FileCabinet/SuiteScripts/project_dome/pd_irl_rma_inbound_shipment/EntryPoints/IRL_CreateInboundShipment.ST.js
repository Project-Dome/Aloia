/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Dome
 * @description EP2 (TECH-SPEC section 6): tela de criacao de Inbound Shipment vinculado a um RMA.
 * GET renderiza o formulario (RMA + Location); POST cria o inboundshipment (sem linhas) e o
 * vinculo em customrecord_pd_irl_rma_link, depois redireciona para o Inbound Shipment criado.
 */
define([
    'N/log',
    'N/http',
    '../UseCases/RenderCreateInboundShipmentForm',
    '../UseCases/CreateInboundShipmentForRma',
    '../Models/InboundShipment.model',
    '../Constants/createInboundShipmentForm.constants',
], function (log, http, RenderCreateInboundShipmentForm, CreateInboundShipmentForRma, InboundShipmentModel, formConstants) {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            handleGet(context);
            return;
        }

        handlePost(context);
    }

    function handleGet(context) {
        var form = RenderCreateInboundShipmentForm.execute();
        context.response.writePage(form);
    }

    function handlePost(context) {
        var rmaId = context.request.parameters[formConstants.FIELDS.rma.id];
        var billOfLading = context.request.parameters[formConstants.FIELDS.billOfLading.id];
        var expectedShippingDate = context.request.parameters[formConstants.FIELDS.expectedShippingDate.id];
        var expectedDeliveryDate = context.request.parameters[formConstants.FIELDS.expectedDeliveryDate.id];
        var memo = context.request.parameters[formConstants.FIELDS.memo.id];

        try {
            var result = CreateInboundShipmentForRma.execute({
                rmaId: rmaId,
                billOfLading: billOfLading,
                expectedShippingDate: expectedShippingDate,
                expectedDeliveryDate: expectedDeliveryDate,
                memo: memo,
            });
            redirectToShipment(context, result.shipmentId);
        } catch (e) {
            log.error({ title: 'IRL_CreateInboundShipment.ST | handlePost - falha ao criar shipment', details: e });
            renderError(context, e);
        }
    }

    function redirectToShipment(context, shipmentId) {
        context.response.sendRedirect({
            type: http.RedirectType.RECORD,
            identifier: InboundShipmentModel.TYPE,
            id: shipmentId,
        });
    }

    function renderError(context, err) {
        var message = (err && err.message) || 'Nao foi possivel criar o Inbound Shipment.';
        context.response.write(
            '<html><body><p>' + message + '</p></body></html>'
        );
    }

    return {
        onRequest: onRequest,
    };
});
