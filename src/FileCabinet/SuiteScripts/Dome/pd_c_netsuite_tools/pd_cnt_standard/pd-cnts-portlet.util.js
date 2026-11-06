/**
 * @NApiVersion 2.x
 * @NModuleScope
 * @author Isaac Façanha de Carvalho
 */
 define(
    [
        'N/log',
        'N/util',
        'N/file',
        
        './pd-cnts-search.util.js',
        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(log, util, file, search_util) {
        function build(options) {
            validateOptions(options);

            const _portlet = options.params.portlet;
            /*const _htmlField = _portlet.addField({
                id: 'custpage_html',
                type: 'inlinehtml',
                label: 'HTML'
            });*/

            _portlet.title = options.title;
            _portlet.html = (
                [
                    '<div class="container">',
                        '<iframe class="portlet-iframe" frameBorder="0" src="'+ options.suiteletURL +'"></iframe>',
                    '</div>',
                    '<style>',
                    '.container { height: '+ (options.height || '100px') +' }',
                    '.portlet-iframe {',
                        'position: absolute;',
                        'top: 0;',
                        'left: 0;',
                        'bottom: 0;',
                        'right: 0;',
                        'width: 100%;',
                        'height: 100%;',
                        'overflow:hidden;',
                    '}',
                    '</style>'
                ].join('')
            );

            function validateOptions(options) {
                if(options == null) {
                    throw buildPortletUtilException('Missing "options" parameter');
                }

                if(isNullOrEmpty(options.params)) {
                    throw buildPortletUtilException('Missing "options.params" parameter');
                }

                if(isNullOrEmpty(options.title)) {
                    throw buildPortletUtilException('Missing "options.title" parameter');
                }

                if(isNullOrEmpty(options.suiteletURL)) {
                    throw buildPortletUtilException('Missing "options.suiteletURL" parameter');
                }
            }
        }

        function buildPortletUtilException(message) {
            return buildException({
                code: 'SUITELET_UTIL_EXCEPTION',
                message: message
            });
        }

        return {
            build: build
        };
    }
)