/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/util',
        'N/url',
        'N/log',
        'N/search',
        'N/format',
        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(util, url, log, search, format) {
        function all(options) {
            var _response = [];
            var _page = 1;

            do {
                var _pageResponse = getPaged(util.extend({
                    page: _page,
                    pageSize: 1000,
                    type: options.type,
                    columns: options.columns,
                    query: options.query,
                    each: options.each
                }, options));

                if(_pageResponse.page.data != null) {
                    _response = _response.concat(_pageResponse.page.data);
                }                

                _page ++;
            } while(!_pageResponse.page.isLast && _pageResponse.count > 0);

            return _response;
        }

        function each(options) {
            options.afterValidation = function(options) {
                if(options.each == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                        attributeName: 'each',
                        objectName: 'options',
                        additionalInfo: '"each" attribute must be a function'
                    });
                } else {
                    if(type(options.each) != 'function') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            value: options.each,
                            expectedType: 'function'
                        });
                    }
                }
            }

            execute(options, function(options) {
                var _resultCount = 0;

                options.search.run().each(function(resultItem, resultItemIndex) {
                    var _resultItemData = mapSearchResult(options.search, options.columnsArray, resultItem);
    
                    if(options.each != null && typeof(options.each) == 'function') {
                        options.each(_resultItemData);
                    }

                    _resultCount ++;

                    if(options.limit != null) {
                        return _resultCount <= options.limit;
                    }
    
                    return _resultCount <= 4000;
                });
            });
        }

        function get(options) {
            var _result = [];

            execute(options, function(options) {
                options.search.run().each(function(resultItem, resultItemIndex) {
                    var _resultItemData = mapSearchResult(options.search, options.columnsArray, resultItem);
    
                    if(options.each != null && typeof(options.each) == 'function') {
                        options.each(_resultItemData, resultItemIndex);
                    }
    
                    _result.push(_resultItemData);
    
                    return _result.length < 4000;
                });
            });

            return _result;
        }

        function getPaged(options) {
            var _result = { 
                count: 0,
                page: {
                    number: options.page,
                    isLast: false,
                    isFirst: false,
                    data: [

                    ]
                }
            };

            execute(options, function(options) {
                var _pagedData = options.search.runPaged({
                    pageSize: ifNullOrEmpty(options.pageSize, 1000)
                });

                _result.count = _pagedData.count;
                
                if(_result.count > 0) {
                    var _pageIndex = (options.page -1);
                    var _pageResult = _pagedData.fetch({ index: _pageIndex });

                    _result.page.isFirst = _pageResult.isFirst;
                    _result.page.isLast = _pageResult.isLast;
                    
                    _pageResult.data.forEach(function(resultItem, resultItemIndex) {
                        var _resultItemData = mapSearchResult(options.search, options.columnsArray, resultItem);
        
                        if(options.each != null && typeof(options.each) == 'function') {
                            options.each(_resultItemData, resultItemIndex);
                        }
        
                        _result.page.data.push(_resultItemData);
        
                        return true;
                    });
                } else {
                    _result.page.isLast = true;
                    _result.page.isFirst = true;
                }
            });

            return _result;
        }

        function first(options) {
            var _result = null;

            execute(options, function(options) {
                options.search.run().each(function(resultItem) {
                    var _resultItemData = mapSearchResult(options.search, options.columnsArray, resultItem);
    
                    if(options.map != null && typeof(options.map) == 'function') {
                        options.map(_resultItemData);
                    }
    
                    _result = _resultItemData;
    
                    return false;
                });
            });

            return _result;
        }

        function execute(options, execute) {
            validateOptions(options);

            var _columnsArray = null;
            var _searchColumnsArray = null;
            var _filters = null;

            if(options.columns != null) {
                if(Object.keys(options.columns).length > 0) {
                    _columnsArray = [];
                    _searchColumnsArray = [];

                    for(var columnName in options.columns) {
                        var _currentColumn = options.columns[columnName];
                        
                        _currentColumn.columnName = columnName;

                        if(_currentColumn.onlyFilter != true) {
                            _columnsArray.push(_currentColumn);
                            _searchColumnsArray.push(util.extend({}, _currentColumn));
                        }                        
                    }
                }
            }

            if(options.query != null) {
                _filters = options.query.get();

                if(options.page == null || options.page == 1) {
                    log.audit({ title: 'Filter expression [type: '+ options.type +']', details: _filters });
                } else {
                    log.audit({ title: 'Search Pagination [type: '+ options.type +'][page: '+ options.page +']', details: _filters });
                }
            }

            var _search = null;

            if(!isNullOrEmpty(options.searchId)) {
                _search = search.load({ id: options.searchId });
                _search.columns = _searchColumnsArray;
                _search.filterExpression = _filters;
            } else {
                _search = search.create({
                    type: options.type,
                    filters: _filters,
                    columns: _searchColumnsArray
                });
            }

            if(options.save == true) {
                if(options.page == null || options.page == 1) {
                    var _searchKey = new Date().getTime();

                    _search.title = 'Script search ' + ifNullOrEmpty(options.title, '') + _searchKey
                    _search.id = 'customsearch_' + _searchKey
                    _search.save();
                }
            }

            execute(util.extend({
                search: _search,
                columnsArray: _columnsArray
            }, options));

            function validateOptions(options) {
                if(options == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, "options");
                }

                if(isNullOrEmpty(options.type)) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                        attributeName: 'type',
                        objectName: 'options',
                        additionalInfo: options
                    })
                }

                if(options.columns != null) {
                    if(type(options.columns) != 'object') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            value: options.columns,
                            expectedType: 'object',
                            additionalInfo: options
                        });
                    }
                }

                if(options.query != null) {
                    if(!isWhere(options.query)) {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            value: options.query,
                            expectedType: 'where',
                            additionalInfo: options
                        })
                    }
                }
            }
        }

        function mapSearchResult(search, columnsArray, resultItem) {
            var _mappedResult = {};

            if(columnsArray != null) {
                for(var columnIndex in columnsArray) {
                    var _columnData = columnsArray[columnIndex];
                    var _netsuiteColumn = search.columns[columnIndex];

                    _mappedResult[_columnData.columnName] = valueHandler(resultItem, _netsuiteColumn, _columnData);
                }

                if(!isNullOrEmpty(_mappedResult.id)) {
                    if(search.searchType.anyOf(['transaction', 'item', 'file', 'address', 'aschargedprojectrevenuerule', 'paymentevent'])) {
                        if(_mappedResult.recordType != null && typeof(_mappedResult.recordType) == 'string') {
                            _mappedResult.netsuiteLink = url.resolveRecord({
                                recordType: _mappedResult.recordType,
                                recordId: _mappedResult.id
                            });    
                        }
                    } else {
                        _mappedResult.netsuiteLink = url.resolveRecord({
                            recordType: (
                                    isNullOrEmpty(_mappedResult.recordType)
                                ?   search.searchType
                                :   _mappedResult.recordType
                            ),
                            recordId: _mappedResult.id
                        });
                    }                    
                }
            }

            if(isNullOrEmpty(_mappedResult.id)) {
                _mappedResult.id = resultItem.id;
            }

            return _mappedResult;

            function valueHandler(resultItem, netsuiteColumn, columnData) {
                var _value = resultItem.getValue(netsuiteColumn);
                var _columnType = ifNullOrEmpty(columnData.type, 'undefined').toLowerCase().trim();

                if(!isNullOrEmpty(_value)) {
                    switch(_columnType) {
                        case 'date':
                            {
                                _value = format.parse({ value: _value, type: format.Type.DATE });
                            } break;
                        case 'datetime':
                            {
                                _value = format.parse({ value: _value, type: format.Type.DATETIME });
                            } break;
                        case 'hour':
                        case 'time':
                            {
                                _value = format.parse({ value: _value, type: format.Type.TIME });
                            } break;
                        case 'float':
                        case 'currency':
                        case 'numeric':
                        case 'double':
                            {
                                _value = parseFloat(_value);
                            } break;
                        case 'percent':
                            {
                                _value = parseFloat(_value.replace('%', ''));
                            } break;
                        case 'int':
                        case 'integer':
                            {
                                _value = parseInt(_value);
                            } break;
                        case 'bool':
                        case 'boolean':
                            {
                                if(columnData.name.toLowerCase().trim() == 'mainline') {
                                    _value = (_value == '*' ? true : false);
                                } else {
                                    _value = parseBoolean(_value);
                                }
                            } break;
                        case 'select':
                        case 'record':
                        case 'object':
                        case 'list':
                            {
                                _value = {
                                    id: _value,
                                    name: resultItem.getText(netsuiteColumn)
                                };
                            } break;
                        case 'multiselect':
                        case 'array':
                            {
                                if(type(_value) != 'array') {
                                    _value = _value.split(',')
                                }                                
                            } break;
                        case 'multilist':
                            {
                                if(type(_value) != 'array') {
                                    _value = _value.split(',');
                                    _text = resultItem.getText(netsuiteColumn).split(',');

                                    _value = _value.map(function(valueItem, valueItemIndex) {
                                        return {
                                            id: valueItem,
                                            name: _text[valueItemIndex]
                                        }
                                    });
                                }
                            } break;
                    }   
                }

                return _value;
            }

            return _mappedResult;
        }

        function whereBuilder(query) {
            return new where(query);

            function where(query) {
                validateQuery(query);

                this.expression = null;
                this.query = query;
                this.whereList = [];

                this.and = function (query) {
                    validateQuery(query);

                    query.expression = 'AND';
                    this.whereList.push(query);

                    return this;
                };

                this.or = function (query) {
                    validateQuery(query);

                    query.expression = 'OR';
                    this.whereList.push(query);

                    return this;
                };

                this.get = function () {
                    var _filterExpression = [];

                    if(!isNullOrEmpty(this.query)) {
                        _filterExpression.push(this.query.get())
                    }

                    this.whereList.forEach(function(query) {
                        if(!isNullOrEmpty(query.expression)) {
                            _filterExpression.push(query.expression);
                        }

                        if(isQuery(query)) {
                            _filterExpression.push(query.get());
                        } else {
                            _filterExpression.push(query.get());
                        }
                    });

                    return _filterExpression;
                }

                function validateQuery(query) {
                    if(isNullOrEmpty(query)) {
                        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'query');
                    } else {
                        if(type(query) != 'object') {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                expectedType: 'object',
                                value: query
                            });
                        }
                    }

                    if(!isQuery(query) && !isWhere(query)) {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                            expectedType: 'query/where',
                            value: query
                        });
                    }
                }
            }
        }

        function isQuery(object) {
            return object.__proto__.constructor.name == 'query'
        }

        function isWhere(object) {
            return object.__proto__.constructor.name == 'where'
        }

        function queryBuilder(field, operator, value) {
            return new query(field, operator, value);

            function query(field, operator, value) {
                validateParameters(field, operator, value);

                this.field = field;
                this.operator = operator;
                this.value = (value == undefined ? null : value);

                this.get = function() {
                    var _query = [getFieldName(this.field), this.operator];

                    if(type(this.value) == 'array') {
                        _query = _query.concat(this.value);
                    } else {
                        _query.push(getValue(this.value, this.field))
                    }

                    return _query;
                }

                function getFieldName(fieldData) {
                    var _formulaFields = ['formulatext', 'formulanumeric', 'formuladate'];
                    var _fieldName = fieldData.name;
                    var _fieldKey = _fieldName.toLowerCase().trim();

                    if(_fieldKey.anyOf(_formulaFields)) {
                        _fieldName = getFormulaFilterField(fieldData);
                    } else {
                        if(!isNullOrEmpty(fieldData.join)) {
                            _fieldName = (fieldData.join + '.' + _fieldName);
                        }
                    }

                    return _fieldName;
                }

                function getFormulaFilterField(fieldData) {
                    if(isNullOrEmpty(fieldData.formula)) {
                        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                            attributeName: 'formula',
                            objectName: 'fieldData',
                            additionalInfo: fieldData
                        });
                    }

                    return (
                        fieldData.name + ': ' + fieldData.formula
                    )
                }

                function getValue(value, field) {
                    if(type(value) == 'date') {
                        value = format.format({ type: format.Type.DATE, value: value });
                    } else {
                        if(type(value) == 'boolean') {
                            value = (value ? 'T' : 'F');
                        }
                    }

                    return value;
                }

                function validateParameters(field, operator, value) {
                    if(isNullOrEmpty(field)) {
                        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, "field");
                    } else {
                        if(type(field) != 'object') {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                expectedType: 'object',
                                value: field
                            });
                        } else {
                            if(isNullOrEmpty(field.name)) {
                                raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                    attributeName: 'name',
                                    objectName: 'field',
                                    additionalInfo: field
                                })
                            }
                        }
                    }

                    if(isNullOrEmpty(operator)) {
                        raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, "operator");
                    } else {
                        if(type(operator) != 'string') {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, {
                                expectedType: 'string',
                                value: operator
                            });
                        }
                    }

                    var _operatorKey = operator.toLowerCase().trim();

                    if(_operatorKey.noneOf(['isempty', 'isnotempty'])) {
                        if(isNullOrEmpty(value)) {
                            raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, "value");
                        }
                    }
                }
            }
        }

        return {
            all: all,
            each: each,
            get: get,
            getPaged: getPaged,
            first: first,
            where: whereBuilder,
            query: queryBuilder
        }
    }
)