/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Project Dome
 *
 * pd_sie — Send Invoices by Email (Aloia Aerospace)
 *
 * Entry point: só roteia. GET serve a tela (ui/), POST despacha a action
 * pro use_case correspondente. Regra de negócio fica em service/.
 *
 * Script parameter (Deployment):
 *   custscript_pd_sie_override_email -> se preenchido, todo envio vai pra
 *   esse endereço em vez do Customer Invoice Email. Vazio em produção.
 */
define(
    [
        'N/log',
        '/SuiteScripts/projectdome/pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util',
        '../use_case/pd-sie-list-customers.use_case',
        '../use_case/pd-sie-search-invoices.use_case',
        '../use_case/pd-sie-preview-email.use_case',
        '../use_case/pd-sie-send-invoice-email.use_case',
        '../use_case/pd-sie-load-history.use_case'
    ],
    function (log, suitelet_util, listCustomersUc, searchInvoicesUc, previewEmailUc, sendInvoiceEmailUc, loadHistoryUc) {

        var ACTIONS = {
            listCustomers: listCustomersUc,
            searchInvoices: searchInvoicesUc,
            previewEmail: previewEmailUc,
            sendEmail: sendInvoiceEmailUc,
            loadHistory: loadHistoryUc
        };

        function onRequest(context) {
            if (context.request.method === 'GET') {
                return renderPage(context);
            }
            return handlePost(context);
        }

        function renderPage(context) {
            return suitelet_util.build({
                context: context,
                title: 'Envio de Invoices por E-mail',
                statics: { html: ['pd-sie-invoice-email.html'], js: ['pd-sie-invoice-email.js'] },
                parameters: {}
            });
        }

        function handlePost(context) {
            var resp = { status: 200, message: 'Success', data: [] };

            try {
                var body = JSON.parse(context.request.body);
                var useCase = ACTIONS[body.action];

                if (!useCase) {
                    throw new Error('Ação desconhecida: ' + body.action);
                }

                resp.data = useCase.execute(body);
            } catch (e) {
                log.error({ title: 'pd_sie - erro no POST', details: e.message + '\n' + e.stack });
                resp.status = 500;
                resp.message = e.message;
            }

            context.response.addHeader({ name: 'Content-Type', value: 'application/json' });
            context.response.write(JSON.stringify(resp));
        }

        return { onRequest: onRequest };
    }
);
