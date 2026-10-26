/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @author Dome
 * @description EP3 (TECH-SPEC section 7): Client Script anexado ao Suitelet do EP2
 * (IRL_CreateInboundShipment.ST.js). Ao selecionar o RMA no form de criacao, preenche
 * automaticamente o campo Location com o location nativo do RMA (regra de negocio 2 do EP2 -
 * Location herdado), mantendo-o desabilitado para edicao manual (ja e DISABLED pelo form - ver
 * RenderCreateInboundShipmentForm.js).
 *
 * Decisao de arquitetura: operacao de leitura unica e trivial (um field lookup), sem regra de
 * negocio a orquestrar - nao justifica UseCase/Model proprios (ver usecase-architecture: "scripts
 * simples de operacao unica podem usar apenas o EntryPoint com NetsuiteTools diretamente"). A
 * leitura usa N/search.lookupFields diretamente (ao inves de reaproveitar
 * ReturnAuthorizationModel.getLocationByRmaId, que roda sobre pd-cnts-search.util/search.create -
 * server-side search pensada para paginacao, com log.audit a cada chamada), porque lookupFields e
 * a API leve e oficialmente suportada em Client Script para "buscar um campo de outro record por
 * id", sem o overhead de um search object completo a cada fieldChanged. O internal id do record
 * (TYPE) e do campo (FIELDS.location) ainda vem de ReturnAuthorizationModel - fonte unica desses
 * identificadores (MANIFEST) - apenas a chamada de busca em si e feita direto, nao via Model.
 */
define([
    'N/search',
    'N/log',
    '../Models/ReturnAuthorization.model',
    '../Constants/createInboundShipmentForm.constants',
], function (search, log, ReturnAuthorizationModel, formConstants) {

    function fieldChanged(context) {
        if (context.fieldId !== formConstants.FIELDS.rma.id) return;

        var currentRecord = context.currentRecord;
        var rmaId = currentRecord.getValue({ fieldId: formConstants.FIELDS.rma.id });

        var locationId = rmaId ? getRmaLocationId(rmaId) : '';

        currentRecord.setValue({
            fieldId: formConstants.FIELDS.location.id,
            value: locationId || '',
            ignoreFieldChange: true,
        });
    }

    function getRmaLocationId(rmaId) {
        try {
            var lookup = search.lookupFields({
                type: ReturnAuthorizationModel.TYPE,
                id: rmaId,
                columns: [ReturnAuthorizationModel.FIELDS.location.name],
            });

            var location = lookup && lookup[ReturnAuthorizationModel.FIELDS.location.name];
            return (location && location[0] && location[0].value) || '';
        } catch (e) {
            log.error({
                title: 'IRL_CreateInboundShipment.CS | getRmaLocationId - falha ao buscar location do RMA',
                details: e,
            });
            return '';
        }
    }

    return {
        fieldChanged: fieldChanged,
    };
});
