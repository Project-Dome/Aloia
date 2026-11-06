/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/log',
        'N/runtime',
        
        './pd-cnts-exception.util.js'
    ],
    function(log, runtime) {
        function execute(mapReduceService, options) {
            validateMapReduceService(mapReduceService, options);

            var _inputData = mapReduceService.getInputData(options);

            if(_inputData == null) {
                raiseException(__CUSTOM_ERRORS.MISSING_FUNCTION_RESPONSE, {
                    functionName: "mapReduce.getInputData"
                });
            } else {
                if(type(_inputData) != 'array') {
                    raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                        expectedType: 'array',
                        value: _inputData,
                        additionalInfo: 'data returned from function "mapReduce.getInputData"'
                    });
                }
            }

            log.audit({ title: 'Map/Reduce Input Data', details: _inputData });

            var _mapContext = new mapReduceContextSimulator('map');
            var _reduceContext = new mapReduceContextSimulator('reduce');

            if(mapReduceService.map != null) {
                _inputData.forEach(function(inputDataItem, inputDataIndex) {
                    var _value = (typeof(inputDataItem) == 'object' ? JSON.stringify(inputDataItem) : inputDataItem);

                    if(runtime.getCurrentUser().id == 7) {
                        var _startedAt = new Date();
                    }

                    mapReduceService.map({
                        value: _value,
                        key: inputDataIndex,
                        write: _mapContext.write
                    }); 

                    if(runtime.getCurrentUser().id == 7) {
                        log.audit({ title: 'Time Spent', details: _startedAt.diff({ dateToCompare: new Date(), type: 'milisecond' }) + ' miliseconds' });
                    }
                });
            }

            if(mapReduceService.reduce != null) {
                if(mapReduceService.map != null) {
                    for(key in _mapContext.writedData) {
                        mapReduceService.reduce({
                            key: key,
                            values: _mapContext.writedData[key],
                            write: _reduceContext.write
                        });
                    }
                } else {
                    _inputData.forEach(function(inputDataItem, inputaDataIndex) {
                        mapReduceService.reduce({
                            key: inputaDataIndex,
                            values: [JSON.stringify(inputDataItem)],
                            write: _reduceContext.write
                        }); 
                    });
                }
            }

            if(mapReduceService.summarize != null) {
                if(!isNullOrEmpty(_reduceContext.writedData)) {
                    mapReduceService.summarize(new summarizeContextSimulator(_reduceContext.writedData));
                }                
            }

            function summarizeContextSimulator(reduceData) {
                this.reduceData = reduceData;

                var _summarizeContext = this;

                this.output = {
                    iterator: function() {
                        function each(eachFunction) {
                            for(key in _summarizeContext.reduceData) {
                                eachFunction(key, _summarizeContext.reduceData[key]);
                            }
                        }

                        return {
                            each: each
                        }
                    }
                }
            }

            function mapReduceContextSimulator(type) {
                var _currentContext = this;
                
                _currentContext.type = type;
                _currentContext.writedData = {};
                
                this.write = function (parameter) {
                    validateWriting(parameter);

                    if(_currentContext.type == 'map') {
                        writeMap(parameter);
                    } else {
                        writeReduce(parameter);
                    }

                    function writeMap(parameter) {
                        var _value = (typeof(parameter.value) == 'object' ? JSON.stringify(parameter.value) : parameter.value);
                        
                        if(_currentContext.writedData[parameter.key] == null) {
                            _currentContext.writedData[parameter.key] = [];
                        }
    
                        _currentContext.writedData[parameter.key].push(_value);
                    }

                    function writeReduce(parameter) {
                        var _value = (typeof(parameter.value) == 'object' ? JSON.stringify(parameter.value) : parameter.value);

                        _currentContext.writedData[parameter.key] = _value;
                    }

                    function validateWriting(parameter) {
                        if(isNullOrEmpty(parameter.key)) {
                            raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                attributeName: 'key',
                                value: parameter,
                                additionalInfo: 'parameter passed to mapReduceContextSimulator'
                            });
                        }

                        if(isNullOrEmpty(parameter.value)) {
                            raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                attributeName: 'value',
                                value: parameter,
                                additionalInfo: 'parameter passed to mapReduceContextSimulator'
                            });
                        }
                    }
                }
            }

            function validateMapReduceService(mapReduceService) {
                if(mapReduceService == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, "mapReduceService")
                }

                if(mapReduceService.getInputData == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                        attributeName: 'getInputData',
                        objectName: 'mapReduceService'
                    });
                } else {
                    if(type(mapReduceService.getInputData) != 'function') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            expectedType: 'function',
                            value: mapReduceService.getInputData
                        });
                    }
                }

                if(mapReduceService.map == null) {
                    if(mapReduceService.reduce == null) {
                        raiseException({
                            code: 'MISSING_REQUIRED_ATTRIBUTE',
                            message: 'The map-reduce service needs to have at least one of the following functions implemented: map, reduce'
                        });
                    } else {
                        if(type(mapReduceService.reduce) != 'function') {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                expectedType: 'function',
                                value: mapReduceService.reduce
                            });
                        }
                    }
                } else {
                    if(type(mapReduceService.map) != 'function') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            expectedType: 'function',
                            value: mapReduceService.map
                        });
                    }
                }

                if(mapReduceService.summarize != null) {
                    if(type(mapReduceService.summarize) != 'function') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            expectedType: 'function',
                            value: mapReduceService.summarize
                        });
                    }
                }
            }
        }

        function getInputDataHandler(options) {
            try {
                return options.getInputData();
            } catch(getInputDataException) {
                log.error({
                    title: 'Get Input Data Exception',
                    details: getExceptionMessage(getInputDataException)
                });

                throw getInputDataException;
            }            
        }

        function mapHandler(options) {
            try {
                options.map(options.context);
            } catch(mapException) {
                log.error({
                    title: 'Map Exception [key='+ options.context.key +']',
                    details: getExceptionMessage(mapException)
                });

                throw mapException;
            }            
        }

        function reduceHandler(options) {
            try {
                options.reduce(options.context);
            } catch(reduceException) {
                log.error({
                    title: 'Reduce Exception [key='+ options.context.key +']',
                    details: getExceptionMessage(reduceException)
                });

                throw reduceException;
            }            
        }

        function summarizeExecution(summarizeContext) {
            var _mapKeysCount = 0;
            var _reduceKeysCount = 0;

            summarizeContext.mapSummary.keys.iterator().each(function (key){
                _mapKeysCount += 1;
            });

            summarizeContext.reduceSummary.keys.iterator().each(function (key){
                _reduceKeysCount += 1;
            });

            return {
                map: {
                    keysCount: _mapKeysCount,
                    seconds: summarizeContext.mapSummary.seconds
                },
                reduce: {
                    keysCount: _reduceKeysCount,
                    seconds: summarizeContext.reduceSummary.seconds
                }
            };
        }

        function summarizeErrors(summarizeContext) {
            var _mapErrorsCount = 0;
            var _reduceErrorsCount = 0;
            var _hasGetInputDataError = !isNullOrEmpty(summarizeContext.inputSummary.error);

            _mapErrorsCount = manageMapErrors(summarizeContext);
            _reduceErrorsCount = manageReduceErrors(summarizeContext);

            if(_hasGetInputDataError) {
                log.error({
                    title: 'Get Input Data Error',
                    details: summarizeContext.inputSummary.error
                });
            }

            const _errorSummary = {
                mapErrorsCount: _mapErrorsCount,
                reduceErrorsCount: _reduceErrorsCount,
                hasMapError: _mapErrorsCount > 0,
                hasReduceError: _reduceErrorsCount > 0,
                hasGetInputDataError: _hasGetInputDataError
            };

            log.audit({
                title: 'Error Summary',
                details: _errorSummary
            });

            return _errorSummary;

            function manageMapErrors(summarizeContext) {
                var _mapErrorCount = 0;

                summarizeContext.mapSummary.errors.iterator().each(function (key, error, executionNumber) {
                    log.error({
                        title: 'Map Error [key='+ key +'][execution number='+ executionNumber +']',
                        details: error
                    });

                    _mapErrorCount += 1;

                    return true;
                });

                return _mapErrorCount;
            }

            function manageReduceErrors(summarizeContext) {
                var _reduceErrorCount = 0;

                summarizeContext.reduceSummary.errors.iterator().each(function (key, error, executionNumber) {
                    log.error({
                        title: 'Reduce Error [key='+ key +'][execution number='+ executionNumber +']',
                        details: error
                    });

                    _reduceErrorCount += 1;

                    return true;
                });

                return _reduceErrorCount;
            }
        }

        function summarizeManager(options) {
            var _summarizeErrors = summarizeErrors(options.context);
            var _summarizeExecution = summarizeExecution(options.context);

            if(_summarizeErrors.hasGetInputDataError || _summarizeErrors.hasMapError || _summarizeErrors.hasReduceError) {
                if(typeof(options.onError) == 'function') {
                    options.onError({
                        context: options.context,
                        errorsSummary: _summarizeErrors
                    });
                }

                return;
            }

            log.audit({
                title: 'Execution Summary',
                details: _summarizeExecution
            });

            var _summarizeOutput = [];
            
            options.context.output.iterator().each(function(key, value) {
                var _output = JSON.parse(value);
                
                _output.summarizeOutputKey = key;

                if(typeof(options.each) == 'function') {
                    options.each({
                        output: _output,
                        key: key,
                        context: options.context
                    });
                }

                _summarizeOutput.push(_output);

                return true;
            });

            if(typeof(options.onSuccess) == 'function') {
                options.onSuccess({
                    outputList: _summarizeOutput,
                    context: options.context
                });
            }            
        }

        return {
            mapHandler: mapHandler,
            reduceHandler: reduceHandler,
            getInputDataHandler: getInputDataHandler,
            summarizeErrors: summarizeErrors,
            summarizeExecution: summarizeExecution,
            summarizeManager: summarizeManager,
            execute: execute
        }
    }
)