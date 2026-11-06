/**
 * @author Isaac Façanha de Carvalho
 */
 var __CUSTOM_ERRORS = {
    MISSING_REQUIRED_DATA_ATTRIBUTE: { 
        get: function(parameters) {
            var _additionalInfo = (parameters.additionalInfo == null ? 'None' : parameters.additionalInfo);
            
            return {
                code: 'MISSING_REQUIRED_DATA_ATTRIBUTE', 
                message: (
                        'Missing "'+ parameters.attributeName +'" attibute in "'+ parameters.objectName +'"! '
                    +   'Additional Info: ' + JSON.stringify(_additionalInfo)
                )
            }
        }
    },
    MISSING_REQUIRED_FUNCTION_PARAMETER: { 
        get: function(parameterName) {
            return {
                code: 'MISSING_REQUIRED_FUNCTION_PARAMETER', 
                message: 'Function parameter "'+ parameterName +'" can not be null empty or undefined!'
            }
        }
    },
    INVALID_TYPE: {
        get: function(parameters) {
            var _value = (parameters.value == null ? 'undefined/null' : parameters.value);
            var _additionalInfo = (parameters.additionalInfo == null ? 'None' : parameters.additionalInfo);

            return {
                code: 'INVALID_DATA_TYPE',
                message: (
                        'Invalid data type! Expected Type: '+ parameters.expectedType +' | Received Type: ' + type(parameters.value) + '. '
                    +   'Additional Info: ' + JSON.stringify(_additionalInfo) + '. '
                    +   'Value: ' + JSON.stringify(_value)
                )
            }
        }
    },
    RESOURCE_ALREADY_EXISTS: {
        get: function(message) {
            return {
                code: 'RESOURCE_ALREADY_EXISTS',
                message: message
            }
        }
    },
    API_REQUEST_ERROR: {
        get: function(parameters) {
            return {
                code: 'API_REQUEST_ERROR',
                message: 'Error on api request! Details: ' + JSON.stringify(parameters)
            };
        }
    },
    MISSING_FUNCTION_RESPONSE: {
        get: function(parameters) {
            return {
                code: 'MISSING_FUNCTION_RESPONSE',
                message: 'The function named "'+ parameters.functionName +'" response can not be null/undefined or empty!'
            };
        }
    }
}

function validateObject(object, objectName, attributesConfig) {
    if(object == null) {
        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, objectName);
    }

    validateAttributes(object, objectName, attributesConfig);

    function validateAttributes(object, objectName, attributesConfig) {
        for(var attrName in attributesConfig) {
            var _attrConfig = attributesConfig[attrName];
            var _attrValue = object[attrName];

            var _attrCustomName = (objectName + '.' + attrName);
    
            if(_attrConfig != null) {
                if(_attrConfig.isRequired) {
                    if(isNullOrEmpty(_attrValue)) {
                        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                            attributeName: attrName,
                            objectName: objectName
                        });
                    }
                }
    
                if(_attrConfig.type != null) {
                    if(!isNullOrEmpty(_attrValue)) {
                        if(type(_attrValue).noneOf(_attrConfig.type.split('|'))) {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                expectedType: _attrConfig.type,
                                value: _attrValue,
                                additionalInfo: {
                                    attributeName: attrName,
                                    objectName: objectName,
                                    object: object
                                }
                            });
                        }

                        if(_attrConfig.type == 'numeric') {
                            if(Number.isNaN(_attrValue)) {
                                raiseException({
                                    code: 'NOT_A_VALID_NUMBER',
                                    message: (
                                        '"'+ _attrValue +'" is not a valid number!'
                                    )
                                });
                            }

                            if(!isNullOrEmpty(_attrConfig.minValue)) {
                                raiseException({
                                    code: 'The minimum accepted value for "'+ _attrCustomName +'" is: ' + _attrConfig.minValue
                                });
                            }
                        }

                        if(_attrConfig.acceptedOptions != null) {
                            if(type(_attrConfig.acceptedOptions) != 'array') {
                                raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                    value: _attrConfig.acceptedOptions,
                                    expectedType: 'array',
                                    additionalInfo: {
                                        attributeName: 'acceptedOptions',
                                        attributeConfig: _attrConfig
                                    }
                                });
                            }

                            if(_attrConfig.acceptedOptions.indexOf(_attrValue) < 0) {
                                raiseException({
                                    code: 'INVALID_VALUE',
                                    message: ('"' + _attrCustomName + '" attribute does not accept the value "'+ _attrValue +'". Accepted values are: ' + _attrConfig.acceptedOptions.join(', '))
                                })
                            }
                        }
                    }
                }
            }

            if(_attrValue != null) {
                if(!isNullOrEmpty(_attrConfig.attributes)) {
                    if(type(_attrValue) == 'array') {
                        _attrValue.forEach(function(attrItem, attrItemIndex) {
                            _attrCustomName += '['+ attrItemIndex +']';
                            
                            validateAttributes(attrItem, _attrCustomName, _attrConfig.attributes);
                        });
                    } else {
                        validateAttributes(_attrValue, _attrCustomName, _attrConfig.attributes);
                    }
                }
            }
        }
    }
}

function getExceptionMessage(exception) {
    var _exceptionMessage = null;

    if(typeof(console) != 'undefined' && typeof(console.log) == 'function') {
        console.log(exception);
    }
    
    if(isClient()) {
        return (
            typeof(exception) == 'object'
            ?   (
                        !isNullOrEmpty(exception.message)
                    ?   exception.message
                    :   JSON.stringify(exception.message)
                )
            : exception
        );
    }

    require(
        [
            'N/log'
        ],
        function(log) {
            if(typeof(exception) == 'object') {
                if(!isNullOrEmpty(exception.message)) {
                    _exceptionMessage = exception.message;

                    log.error({ title: 'Exception Raised', details: exception });

                    if(!isNullOrEmpty(exception.stack)) {
                        log.error({ title: 'Exception Stack', details: exception.stack });
                    }
                } else {
                    _exceptionMessage = JSON.stringify(exception);
                }
            } else {
                _exceptionMessage = exception.toString();
            }
        }
    )

    return _exceptionMessage;
}

function raiseException(error, errorParams, notifyEmail) {
    throw buildException(error, errorParams, notifyEmail);
}

function isClient() {
    return (
        typeof(window) != 'undefined'
        && window != null 
        && window.location != null
    );
}

function buildException(error, errorParams, notifyEmail) {
    var _exception = null;
    var _error = error;

    if(typeof(_error.get) == 'function') {
        _error = _error.get(errorParams);
    }

    if(isClient()) {
        return _error.message;
    }

    require(
        [
            'N/error'
        ],
        function(error) {
            _exception = error.create({
                message: _error.message,
                name: ('ICE_' + _error.code),
                notifyOff: (notifyEmail != true)
            });
        }
    )

    return _exception;
}