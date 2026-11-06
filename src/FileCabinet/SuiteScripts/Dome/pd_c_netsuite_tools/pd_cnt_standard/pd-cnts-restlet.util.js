/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/log',
        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function() {
        function apiHandler(options) {
            var _response = {
                status: 200,
                message: 'Success'
            };

            validateOptions(options);

            log.audit({
                title: 'API Resource Options',
                details: options
            });

            if(options.data) {
                log.audit({
                    title: 'API Data',
                    details: options.data
                });
            }

            if(options.parameters) {
                log.audit({
                    title: 'API Parameters',
                    details: options.parameters
                });
            }            

            try {
                var _responseData = options.handler(
                        options.parameters != null
                    ?   options.parameters
                    :   options.data
                );

                if(_responseData != null) {
                    _response.data = _responseData;
                }
            } catch(apiException) {
                _response.status = 400;
                _response.message = getExceptionMessage(apiException)
            }

            return _response;

            function validateOptions(options) {
                if(options == null) {
                    throw buildException({
                        code: 'MISSING_API_OPTIONS',
                        message: 'Missing "options" parameters!'
                    });
                }

                if(options.handler == null) {
                    throw buildException({
                        code: 'MISSING_API_HANDLER',
                        message: 'Missing "options.handler" parameters!'
                    });
                } else if(typeof(options.handler) != 'function') {
                    throw buildException({
                        code: 'INVALID_API_HANDLER',
                        message: 'Invalid "options.handler" parameters! Expecting callback function.'
                    });
                }

                if(isNullOrEmpty(options.parameters) && isNullOrEmpty(options.data)) {
                    log.audit({ title: 'Warning', details: 'No "options.parameters" or "options.data". If it is unecessary on this request, just ignore this warning!' });
                }
            }
        }

        return {
            api: apiHandler
        }
    }
)