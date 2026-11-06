function post(options, onSuccess, onError, onComplete) {
    const _options = $.extend(options, { method: 'POST' });

    request(
        _options,
        onSuccess, 
        onError, 
        onComplete
    );
}

function get(options, onSuccess, onError, onComplete) {
    let _options = $.extend(options, { method: 'GET' });

    request(
        _options,
        onSuccess, 
        onError, 
        onComplete
    );
}

function requestDelete(options) {
    request(
        $.extend(options, { method: 'DELETE' })
    );
}

function request(options, onSuccess, onError, onComplete) {
    /** Adapting old parameters */
    if(options.onSuccess == null) {
        options = $.extend({
            onSuccess: onSuccess,
            onError: onError,
            onComplete: onComplete
        }, options);
    }

    if(options.options != null) {
        options = $.extend(options, options.options);

        delete options.options;
    }

    const _url = buildURL(options);
    let _elementsToBlock = null;

    if(options.blockSelector != null) {
        _elementsToBlock = $(options.blockSelector);
        _elementsToBlock.attr('disabled', 'disabled');
    }

    const _requestOptions = {
        url: _url,
        type: options.method,
        contentType: 'application/json; charset=UTF-8',
        async: options.async == null ? true : options.async,
        success: function(responseData) {
            if(responseData.status != null) {
                if(responseData.status == 200) {
                    options.onSuccess(responseData.data);
                } else {
                    if(options.onError != null) {
                        options.onError(responseData.message);
                    }
                }

                return;
            }

            options.onSuccess(responseData);
        },
        error: function(xhr, status, error) {
            if(options.onError == null) {
                console.error('Post Error', {
                    response: xhr.responseText,
                    status: status,
                    error: error
                });

                return;
            }

            options.onError(xhr.responseText || xhr.statusText);
        },
        complete: function() {
            if(_elementsToBlock != null) {
                _elementsToBlock.removeAttr('disabled');
            }

            if(options.onComplete == null) {
                return;
            }

            options.onComplete();
        }
    };

    if(options.method == 'POST') {
        _requestOptions.data = JSON.stringify(options.data);
    }

    if(options.method == 'DELETE' && !isNullOrEmpty(options.data)) { 
        _requestOptions.data = JSON.stringify(options.data);
    }

    $.ajax(_requestOptions);

    function buildURL(options) {
        const _scriptId = options.script || options.restlet?.script;
        const _deploymentId = options.deployment || options.restlet?.deployment;
        let _url = `/app/site/hosting/restlet.nl?script=${_scriptId}&deploy=${_deploymentId}`;

        if(options.parameters != null) {
            for(const parameterName in options.parameters) {
                _url += `&${parameterName}=${ifNullOrEmpty(options.parameters[parameterName], '')}`;
            }
        }

        return _url;
    }
}