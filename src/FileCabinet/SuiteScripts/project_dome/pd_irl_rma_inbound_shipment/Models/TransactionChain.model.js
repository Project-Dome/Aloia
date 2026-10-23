/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Dome
 * @description Model auxiliar para resolver a cadeia de transacoes usada na coluna "Vendor" do
 * EP1: Invoice -> Sales Order (createdfrom) -> Purchase Order -> Vendor.
 *
 * Risco tecnico documentado no TECH-SPEC (secao 3): a viabilidade desses joins encadeados ainda
 * nao foi validada contra a conta real. O Purchase Order nao referencia a Sales Order via join
 * direto nativo - a busca abaixo assume que `createdfrom` do Purchase Order aponta para a Sales
 * Order de origem (padrao comum de Special Order / Dropship), mas isso precisa ser confirmado.
 */
define([
    'N/log',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util',
], function (log, search_util) {

    /**
     * Le o campo createdfrom de uma transacao (ex: Invoice -> Sales Order).
     * @param {string|number} transactionId
     * @returns {{createdFrom: {id, name}}|null}
     */
    function getCreatedFromId(transactionId) {
        if (isNullOrEmpty(transactionId)) return null;

        return search_util.first({
            type: 'transaction',
            columns: {
                createdFrom: { name: 'createdfrom', type: 'select' },
            },
            query: search_util.where(
                search_util.query({ name: 'internalid' }, 'is', transactionId)
            ),
        });
    }

    /**
     * Busca o Purchase Order criado a partir de uma Sales Order e retorna o Vendor dele.
     * @param {string|number} salesOrderId
     * @returns {{id, vendor: {id, name}}|null}
     */
    function getPurchaseOrderByCreatedFrom(salesOrderId) {
        if (isNullOrEmpty(salesOrderId)) return null;

        return search_util.first({
            type: 'purchaseorder',
            columns: {
                vendor: { name: 'entity', type: 'select' },
            },
            query: search_util.where(
                search_util.query({ name: 'createdfrom' }, 'anyof', salesOrderId)
            ),
        });
    }

    return {
        getCreatedFromId: getCreatedFromId,
        getPurchaseOrderByCreatedFrom: getPurchaseOrderByCreatedFrom,
    };
});