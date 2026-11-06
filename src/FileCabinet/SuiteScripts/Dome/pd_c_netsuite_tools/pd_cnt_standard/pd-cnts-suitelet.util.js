/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
 define(
    [
        'N/log',
        'N/util',
        'N/runtime',
        'N/record',
        'N/file',
        
        './pd-cnts-search.util',
        './pd-cnts-record.util',
        './pd-cnts-file.util',

        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(log, util, runtime, record, file, search_util, record_util, file_util) {
        function build(options) {
            validateOptions(options);

            var _html = buildHTML(options);

            options.context.response.write(_html);

            function validateOptions(options) {
                if(options == null) {
                    throw buildSuiteletUtilException('Missing "options" parameter');
                }

                if(isNullOrEmpty(options.context)) {
                    throw buildSuiteletUtilException('Missing "options.context" parameter');
                }

                if(isNullOrEmpty(options.title)) {
                    throw buildSuiteletUtilException('Missing "options.title" parameter');
                }

                if(isNullOrEmpty(options.statics)) {
                    throw buildSuiteletUtilException('Missing "options.statics" parameter');
                }

                if(isNullOrEmpty(options.statics.html)) {
                    throw buildSuiteletUtilException('Missing "options.statics.html" parameter');
                }
            }
        }

        function buildHTML(options) {
            var _staticFiles = getStaticFiles(options);
            
            var _html = (
                [
                    '<!DOCTYPE html>',
                    '<html>',
                        '<head>',
                            '<title>'+ options.title +'</title>',
                            buildCssSection(_staticFiles.css),
                            '<style>',
                                'i.fa { margin-right: 5px; }',
                                '.button { cursor: pointer; }',
                                '.hidden { visibility: hidden; display: none; }',
                            '</style>',
                        '</head>',
                        '<body style="overflow-x: hidden; margin:20px;">',
                            '<div class="container-fluid">',
                                '<div class="row">',
                                    '<div class="col-sm-12">',
                                        buildHtmlSection(_staticFiles.html),
                                    '</div>',
                                '</div>',
                                builParametersSection(options.parameters),
                                buildJsSection(_staticFiles.js),
                            '</div>',
                        '</body>',
                    '</html>'
                ]
            );

            return _html.join('');

            function builParametersSection(parameters) {
                if(isNullOrEmpty(parameters)) {
                    parameters = {};
                }

                var _currentUser = runtime.getCurrentUser();

                if(isNullOrEmpty(parameters.currentUserId)) {
                    parameters.currentUserId = _currentUser.id;
                }

                if(isNullOrEmpty(parameters.currentUserEmail)) {
                    parameters.currentUserEmail = _currentUser.email;
                }

                if(isNullOrEmpty(parameters.currentUserName)) {
                    parameters.currentUserName = _currentUser.name;
                }

                return (
                    [
                        '<script type="text/javascript">',
                            'const SUITELET_PARAMETERS =' + JSON.stringify(parameters),
                        '</script>'
                    ].join('')
                )
            }
            
            function buildHtmlSection(htmlList) {
                return htmlList.map(function(htmlItem) {
                    return file.load({ id: htmlItem.id }).getContents();
                }).join('');
            }

            function buildJsSection(jsList) {
                return jsList.map(function(jsItem) {
                    var _jsArray = (
                        [
                            '<script src="'+ jsItem.link +'"',
                        ]
                    );

                    complementStaticTagAttribute(_jsArray, jsItem);

                    _jsArray.push('></script>')

                    return _jsArray.join(' ');
                }).join('');
            }

            function buildCssSection(cssList) {
                return cssList.map(function(cssItem) {
                    var _cssArray = (
                        [
                            '<link rel="stylesheet" href="'+ cssItem.link +'"',
                        ]
                    );

                    complementStaticTagAttribute(_cssArray, cssItem);

                    _cssArray.push('>');

                    return _cssArray.join(' ');
                }).join('');
            }

            function complementStaticTagAttribute(staticTagArray, staticData) {
                if(staticData.integrity != null) {
                    staticTagArray.push('integrity="'+ staticData.integrity +'"')
                }

                if(staticData.crossorigin != null) {
                    staticTagArray.push('crossorigin="'+ staticData.crossorigin +'"')
                }
            }
        }

        function getStaticFiles(options) {
            var _staticFiles = {
                html: [],
                css: [
                    { link: 'https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css', integrity: 'sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T', crossorigin: 'anonymous' },
                    { link: 'https://use.fontawesome.com/releases/v5.6.3/css/all.css', integrity: 'sha384-UHRtZLI+pbxtHCWp1t77Bi1L4ZtiqrqD80Kn4Z8NTSRyMA2Fd33n5dQ8lWUE00s/', crossorigin: 'anonymous' },
                    { name: 'pd-cntst-bootstrap-table.min.css' },
                    { name: 'pd-cntst-bootstrap-table-fixed-columns.min.css' },
                    { name: 'pd-cntst-bootstrap-datepicker.min.css' },
                    { name: 'pd-cntst-custom-ui-datepicker.css' },
                    { name: 'pd-cntst-common.css' }
                ],
                js: [
                    { link: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js', integrity: 'sha512-bLT0Qm9VnAYZDflyKcBaQ2gg0hSYNQrJ8RilYldYQ1FxQYoCLtUjuuRuZo+fjqhx/qtq/1itJ0C2ejDxltZVFg==', crossorigin: 'anonymous' },
                    { link: 'https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js', integrity: 'sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1', crossorigin: 'anonymous' },
                    { link: 'https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js', integrity: 'sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM', crossorigin: 'anonymous' },
                    { link: 'https://cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js', integrity: 'sha512-pHVGpX7F/27yZ0ISY+VVjyULApbDlD0/X0rgGbTqCE7WFW5MezNTWG/dnhtbBuICzsd0WQPgpE4REBLv+UqChw==', crossorigin: 'anonymous' },
                    { name: 'pd-cntst-form.js' },
                    { name: 'pd-cntst-bootstrap-table.min.js' },
                    { name: 'pd-cntst-bootstrap-table-fixed-columns.min.js' },
                    { name: 'pd-cntst-bootstrap-datepicker.min.js' },
                    { name: 'pd-cntst-bootstrap-datepicker.pt-br.min.js' },
                    { name: 'pd-cntst-bootstrap-modal.js' },
                    { name: 'pd-cntst-bootstrap-autocomplete.js' },
                    { name: 'pd-cntc-common.util.js' },
                    { name: 'pd-cntc-common-validation.util.js' },
                    { name: 'pd-cntst-restlet.util.js' },
                    { name: 'pd-cntst-autocomplete-handler.js' },
                    { name: 'pd-cntst-file.util.js' },
                    { name: 'pd-cntst-custom-ui-datepicker.js' },
                    { name: 'pd-cntst-bootstrap-table-handler.js' }
                ]
            };
            var _allowedStaticKeys = Object.keys(_staticFiles);

            for(staticKey in options.statics) {
                if(staticKey.noneOf(_allowedStaticKeys)) {
                    throw buildSuiteletUtilException('The static key "'+ staticKey +'" is not allowed. Allowed static keys are: ' + _allowedStaticKeys.join(', '));
                }

                var _staticsValue = options.statics[staticKey];
                var _staticsValueType = type(_staticsValue);
                var _acceptedValueTypes = ['string', 'array'];

                if(_staticsValueType.noneOf(_acceptedValueTypes)) {
                    throw buildSuiteletUtilException('The given value for the option "options.statics.'+ staticKey +'" is not valid! Valid value types are: ' + _acceptedValueTypes.join(', '))
                }

                if(_staticsValueType != 'array') {
                    _staticsValue = [_staticsValue];
                }

                _staticsValue.forEach(function(staticItem) {
                    var _fileData = {};
                    var _fileItemType = type(staticItem);

                    switch(_fileItemType) {
                        case 'object':
                            {
                                _fileData = staticItem;
                            } break;
                        case 'string':
                            {
                                _fileData = { name: staticItem }
                            } break;
                        default:
                            {
                                throw buildSuiteletUtilException("Static file configuration does not accept objects of type: " + _fileItemType);
                            }
                    }

                    _staticFiles[staticKey].push(_fileData);
                });                
            }

            setFilesData(_staticFiles);

            return _staticFiles;
        }

        function setFilesData(staticFiles) {
            var _columns = {
                name: { name: 'name' },
                link: { name: 'url' },
                lasModified: { name: 'modified', sort: 'ASC' }
            };

            var _joinedStaticFiles = joinStaticFiles(staticFiles);
            var _filesMap = {};

            var _query = search_util
                .where(search_util.query(_columns.name, 'isnotempty'));
            var _subQuery = null;
            
            _joinedStaticFiles.forEach(function(staticFile) {
                if(!isNullOrEmpty(staticFile.link)) {
                    return;
                }

                var _condition = search_util.query(_columns.name, 'is', staticFile.name);

                if(_subQuery == null) {
                    _subQuery = search_util.where(_condition)
                } else {
                    _subQuery.or(_condition);
                }                    

                _filesMap[staticFile.name] = { index: staticFile.index, type: staticFile.type };
            });

            _query.and(_subQuery);

            search_util.each({
                type: 'file',
                columns: _columns,
                query: _query,
                each: function(fileLine) {
                    var _fileName = fileLine.name.toLowerCase().trim();
                    var _fileMap = _filesMap[_fileName];

                    if(_fileMap == null) {
                        throw buildSuiteletUtilException('The search is returning an unexpected file. File: ' + fileLine.name);
                    }

                    _fileMap.found = true;

                    staticFiles[_fileMap.type][_fileMap.index] = util.extend(
                        staticFiles[_fileMap.type][_fileMap.index],
                        fileLine
                    );
                }
            });

            validateRequestedFiles(_filesMap);

            function validateRequestedFiles(filesMap) {
                for(fileName in filesMap) {
                    var _fileMap = filesMap[fileName];

                    if(_fileMap.found != true) {
                        throw buildSuiteletUtilException('The file with the following name was not found: ' + fileName);
                    }
                }
            }

            function joinStaticFiles(staticFiles) {
                return mapJoin(staticFiles.html, 'html')
                        .concat(mapJoin(staticFiles.css, 'css'))
                        .concat(mapJoin(staticFiles.js, 'js'));

                function mapJoin(fileArray, fileType) {
                    return fileArray
                        .map(function(fileData, fileIndex) {
                            return {
                                name: ifNullOrEmpty(fileData.name, '').toLowerCase().trim(),
                                type: fileType,
                                index: fileIndex,
                                link: fileData.link
                            }
                        })
                }
            }
        }

        function buildSuiteletUtilException(message) {
            return buildException({
                code: 'SUITELET_UTIL_EXCEPTION',
                message: message
            });
        }

        function apiHandler(options) {
            var _responseData = {
                status: 200,
                message: 'Success'
            };

            validateOptions(options);

            var _request = options.context.request;
            var _response = options.context.response;

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
                var _method = _request.method;
                var _methodLowerCase = _method.toLowerCase();
                var _methodHandler = options[_methodLowerCase];

                if(_methodHandler == null) {
                    throw 'Method not allowed. [Method: '+ _method +']';
                }
                
                _responseData.data = _methodHandler({
                    data: readData(_request.body),
                    parameters: _request.parameters,
                    headers: _request.headers
                });
            } catch(apiException) {
                _responseData.status = 400;
                _responseData.message = getExceptionMessage(apiException)
            }

            _response.addHeader('Content-Type', 'application/json');
            _response.write(JSON.stringify(_responseData));

            function readData(requestBody) {
                if(isNullOrEmpty(requestBody)) {
                    return;
                }

                try {
                    return JSON.parse(requestBody);
                } catch(jsonParseException) {}

                return requestBody;
            }

            function validateOptions(options) {
                if(options == null) {
                    throw buildException({
                        code: 'MISSING_API_OPTIONS',
                        message: 'Missing "options" parameters!'
                    });
                }

                if(options.context == null) {
                    throw buildException({
                        code: 'MISSING_CONTEXT',
                        message: 'Missing "options.context" parameters!'
                    });
                }

                var _hasAnyMethod = (typeof(options.post || options.get || options.put || options.patch || options.delete) == 'function');

                if(!_hasAnyMethod) {
                    throw buildException({
                        code: 'NO_METHOD_IMPLEMENTATION_FOUND',
                        message: 'No method implementation found. Available methods are: post, get, put, patch, delete'
                    });
                }
            }
        }

        return {
            build: build,
            api: apiHandler
        };
    }
)