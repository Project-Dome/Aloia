/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/log',
        'N/record',
        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(log, ns_record, error) {
        const DEFAULT_TIMEOUT_IN_SECONDS = 0.5;

        function recordHandler(record) {
            return new handler(record);
        }

        function handler(record) {
            if(record == null) {
                raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'record');
            }

            this.record = record;

            this.afterSave = function(afterSaveAction) {
                if(typeof(afterSaveAction) != 'function') {
                    throw buildException(__CUSTOM_ERRORS.INVALID_TYPE, {
                        expectedType: 'function',
                        value: afterSaveAction
                    });
                }

                this.afterSaveAction = afterSaveAction;
            }

            this.removeLine = function(options) {
                var _record = this.record;
                
                _record.removeLine({
                    sublistId: options.sublistId,
                    line: options.index
                });
            }

            this.clearLines = function(options) {
                validateOptions(options);

                var _record = this.record;
                var _sublistItemsCount = _record.getLineCount({
                    sublistId: options.sublistId
                });

                while(_sublistItemsCount > 0) {
                    _record.removeLine({
                        sublistId: options.sublistId,
                        line: 0
                    });

                    _sublistItemsCount--;
                }
                
                return this;

                function validateOptions(options) {
                    if(isNullOrEmpty(options.sublistId)) {
                        throw buildException({
                            code: 'MISSING_SUBLIST_ID',
                            message: 'Missing options.sublistId parameter!'
                        });
                    }
                }
            }

            this.set = function(data) {
                if(data == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'data');
                }

                if(type(data) != 'object') {
                    raiseException(__CUSTOM_ERRORS.INVALID_TYPE, { value: data, expectedType: 'object' });
                }

                log.audit({ title: 'Setting Record - ' + this.record.type + '(id: '+ this.record.id +')', details: data });

                sublists = data.sublists;
                delete data.sublists;

                setRecordFields(this.record, data);
                setRecordSublists(this.record, sublists);

                return this;
            }

            this.clientSet = function(data) {
                if(data == null) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'data');
                }

                if(type(data) != 'object') {
                    raiseException(__CUSTOM_ERRORS.INVALID_TYPE, { value: data, expectedType: 'object' });
                }

                var _sublists = data.sublists;
                delete data.sublists;

                console.info('Start Setting Record [type = '+ this.record.type +'][id = '+ this.record.id +']['+ new Date().toString() +']', data);

                manageBodyFields({
                    record: this.record,
                    data: data,
                    onComplete: function() {
                        manageSublists({
                            record: this.record,
                            sublists: _sublists,
                            onComplete: function() {
                                console.info('End Setting Record [type = '+ this.record.type +'][id = '+ this.record.id +']['+ new Date().toString() +']');
                            }
                        });
                    }
                });

                return this;

                function manageSublists(sublistManagementOptions) {
                    var _setupQueue = [];

                    for(var sublistId in sublistManagementOptions.sublists) {
                        var _sublistData = sublistManagementOptions.sublists[sublistId];
    
                        if(_sublistData === undefined || _sublistData.length == 0) {
                            continue;
                        }

                        _setupQueue.push({ sublistId: sublistId, lines: _sublistData });
                    }

                    manageQueue({
                        name: 'Sublist Queue',
                        record: sublistManagementOptions.record,
                        queue: _setupQueue,
                        handler: sublistHandler,
                        nextIndex: 0,
                        onComplete: function() {
                            if(sublistManagementOptions.onComplete != null) {
                                sublistManagementOptions.onComplete(sublistManagementOptions);
                            }
                        },
                        timeoutInSeconds: 0.3
                    });

                    function sublistHandler(sublistOptions, onSublistHandlerComplete) {
                        var _sublistData = sublistOptions.queue[sublistOptions.nextIndex];

                        if(type(_sublistData.lines) != 'array') {
                            raiseException(__CUSTOM_ERRORS.INVALID_TYPE, 
                                { 
                                    value: _sublistData.lines, 
                                    expectedType: 'array',
                                    additionalInfo: {
                                        recordType: sublistOptions.record.type,
                                        recordId: sublistOptions.record.id,
                                        sublistId: _sublistData.sublistId
                                    }
                                }
                            );
                        }

                        manageQueue({
                            name: 'Sublist Line Queue',
                            record: sublistOptions.record,
                            queue: _sublistData.lines,
                            sublistId: _sublistData.sublistId,
                            handler: sublistLinesHandler,
                            nextIndex: 0,
                            onComplete: function() {
                                onSublistHandlerComplete(sublistOptions);
                            },
                            timeoutInSeconds: 0.3
                        });
                    }

                    function sublistLinesHandler(sublistLineOptions, onSublistLinesHandlerComplete) {
                        var _lineSelectionTimeoutInSeconds = 0.5;
                        var _sublistLineData = sublistLineOptions.queue[sublistLineOptions.nextIndex];

                        setTimeout(function() {
                            selectLine(sublistLineOptions, _sublistLineData);
                            manageSublistLineData(sublistLineOptions, onSublistLinesHandlerComplete);
                        }, 1000 * _lineSelectionTimeoutInSeconds);

                        function manageSublistLineData(sublistLineOptions, onSublistLinesHandlerComplete) {
                            var _sublistLineData = sublistLineOptions.queue[sublistLineOptions.nextIndex];
                            var _setupQueue = [];

                            for(var fieldId in _sublistLineData) {
                                if(fieldId == 'index') {
                                    continue;
                                }
    
                                var _value = _sublistLineData[fieldId];
            
                                if(_value === undefined) {
                                    continue;
                                }
    
                                _setupQueue.push({ sublistId: sublistLineOptions.sublistId, fieldId: fieldId, value: _value });
                            }
    
                            var _commitTimeoutInSeconds = 0.5;

                            manageQueue({
                                name: 'Sublist Line Field Queue',
                                record: sublistLineOptions.record,
                                queue: _setupQueue,
                                handler: sublistFieldHandler,
                                nextIndex: 0,
                                onComplete: function() {
                                    setTimeout(function() {
                                        sublistLineOptions.record.commitLine({ sublistId: sublistLineOptions.sublistId });
                                        onSublistLinesHandlerComplete();
                                    }, 1000 * _commitTimeoutInSeconds);
                                },
                                timeoutInSeconds: DEFAULT_TIMEOUT_IN_SECONDS
                            });
                        }

                        function selectLine(selectLineOptions, lineData) {
                            var _isEdition = !isNullOrEmpty(lineData.index);

                            if(_isEdition) {
                                selectLineOptions.record.selectLine({ sublistId: selectLineOptions.sublistId, line: lineData.index });
                                return;
                            }

                            selectLineOptions.record.selectNewLine({ sublistId: selectLineOptions.sublistId });
                        }

                        function sublistFieldHandler(sublistFieldOptions, onSublistFieldHandlerComplete) {
                            var _lineFieldData = sublistFieldOptions.queue[sublistFieldOptions.nextIndex];

                            record.setCurrentSublistValue({ 
                                sublistId: _lineFieldData.sublistId,
                                fieldId: _lineFieldData.fieldId,
                                value: _lineFieldData.value
                            });

                            console.info('Setting Sublist Field Data [sublist id = '+ _lineFieldData.sublistId +'][field id = '+ _lineFieldData.fieldId +']['+ new Date().toString() +']', _lineFieldData);

                            onSublistFieldHandlerComplete();
                        }
                    }
                }

                function manageBodyFields(bodyFieldsManagementOptions) {
                    var _setupQueue = [];

                    for(var fieldId in bodyFieldsManagementOptions.data) {
                        var _value = bodyFieldsManagementOptions.data[fieldId];
    
                        if(_value === undefined) {
                            continue;
                        }

                        _setupQueue.push({ fieldId: fieldId, value: _value });
                    }

                    manageQueue({
                        name: 'Body Field Queue',
                        record: bodyFieldsManagementOptions.record,
                        queue: _setupQueue,
                        handler: bodyFieldHandler,
                        nextIndex: 0,
                        onComplete: function() {
                            bodyFieldsManagementOptions.onComplete(bodyFieldsManagementOptions)
                        },
                        timeoutInSeconds: bodyFieldsManagementOptions.timeoutInSeconds || DEFAULT_TIMEOUT_IN_SECONDS
                    });

                    function bodyFieldHandler(bodyFieldOptions, onBodyFieldHandlerComplete) {
                        var _data = bodyFieldOptions.queue[bodyFieldOptions.nextIndex];

                        if(type(_data.value) == 'object') {
                            if(!isNullOrEmpty(_data.value.name)) {
                                bodyFieldOptions.record.setText({
                                    fieldId: _data.fieldId,
                                    text: _data.value.name
                                });
                            } else if(!isNullOrEmpty(_data.value.id)) {
                                bodyFieldOptions.record.setValue({
                                    fieldId: _data.fieldId,
                                    value: _data.value.id
                                });
                            }
                        } else {
                            bodyFieldOptions.record.setValue({
                                fieldId: _data.fieldId,
                                value: _data.value
                            });
                        }

                        console.info('Setting Field Data [field id = '+ _data.fieldId +']', _data);

                        onBodyFieldHandlerComplete();
                    }
                }

                function manageQueue(queueManagementOptions) {
                    if(queueManagementOptions.nextIndex == 0) {
                        console.info('Starting ['+ queueManagementOptions.name +']['+ new Date().toDateString() +']');
                    }

                    if(queueManagementOptions.nextIndex == 0) {
                        console.info('Running Step '+ (queueManagementOptions.nextIndex + 1) +' ['+ queueManagementOptions.name +']['+ new Date().toString() +']');
                    }

                    if(queueManagementOptions.nextIndex >= queueManagementOptions.queue.length) {
                        console.info('Completing ['+ queueManagementOptions.name +']['+ new Date().toString() +']');

                        queueManagementOptions.onComplete(queueManagementOptions);
                        return;
                    }

                    manageQueueProcessing(queueManagementOptions);

                    function manageQueueProcessing(manageQueueProcessingOptions) {
                        setTimeout(function() {
                            manageQueueProcessingOptions.handler(manageQueueProcessingOptions, function() {
                                manageQueueProcessingOptions.nextIndex += 1;
    
                                manageQueue(manageQueueProcessingOptions);
                            });                            
                        }, 1000 * manageQueueProcessingOptions.timeoutInSeconds)
                    }
                }
            }

            this.setCurrentLine = function(options) {
                validateObject(options, 'options', {
                    sublistId: { type: 'string', isRequired: true },
                    data: { type: 'object', isRequired: true }
                });

                setLineData(this.record, options.sublistId, null, options.data, options.delayInSeconds);
            }

            this.transform = function(transformRecordType, isDynamic) {
                var _recordId = ifNullOrEmpty(this.record.id, this.id);

                if(isNullOrEmpty(_recordId)) {
                    throw buildException({
                        code: 'MISSING_ID_FOR_RECORD_TRANSFORMATION',
                        message: '"'+ this.record.type +'" can not be transformed into "'+ transformRecordType +'" before it is saved!'
                    });
                }

                var _transformationRecord = ns_record.transform({
                    fromType: this.record.type,
                    fromId: _recordId,
                    toType: transformRecordType,
                    isDynamic: (isDynamic == null ? true : isDynamic)
                });

                return new handler(_transformationRecord);
            }

            this.save = function(options) {
                this.id = this.record.save(options);

                if(this.afterSaveAction != null) {
                    this.afterSaveAction();
                }

                return this.id;
            }

            this.data = function(dataMap) {
                var _record = this.record;
                var _data = {
                    id: _record.id,
                    type: this.record.type
                };

                if(dataMap != null) {
                    validateObject(dataMap, 'dataMap', {
                        fields: { type: 'object' },
                        sublists: { 
                            type: 'object'
                        }
                    });

                    if(dataMap.fields) {
                        setFields(_record, _data, dataMap);
                    }

                    if(dataMap.sublists) {
                        setSublists(_record, _data, dataMap);
                    }
                }

                _data.metadata = getMetadata(_record, dataMap, _data);

                return _data;

                function getMetadata(record, dataMap, recordData) {
                    var _metadata = {};

                    if(dataMap.fields) {
                        for(var attrName in dataMap.fields) {
                            _metadata[attrName] = record.getField({ fieldId: dataMap.fields[attrName].name });
                        }
                    }

                    if(dataMap.sublists) {
                        for(var attrName in dataMap.sublists) {
                            var _sublistConfig = dataMap.sublists[attrName];
                            
                            _metadata[attrName] = {};

                            if(isNullOrEmpty(recordData[attrName])) {
                                continue;
                            }

                            for(var fieldAttrName in _sublistConfig.fields) {
                                _metadata[attrName][fieldAttrName] = record.getSublistField({
                                    sublistId: _sublistConfig.name,
                                    fieldId: _sublistConfig.fields[fieldAttrName].name,
                                    line: 0
                                })
                            }
                        }
                    }

                    return _metadata;
                }

                function setSublists(record, data, dataMap) {
                    for(var sublistAttrName in dataMap.sublists) {
                        data[sublistAttrName] = [];

                        var _sublistMap = dataMap.sublists[sublistAttrName];
                        var _sublistId = _sublistMap.name;

                        if(isNullOrEmpty(_sublistId)) {
                            raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                objectName: sublistAttrName,
                                attributeName: 'name',
                                additionalInfo: dataMap
                            });
                        }

                        var _sublistItemsCount = record.getLineCount({
                            sublistId: _sublistId.toString()
                        });
                        
                        for(lineIndex=0 ; lineIndex < _sublistItemsCount ; lineIndex++) {
                            var _lineData = {};

                            for(columnAttr in _sublistMap.fields) {
                                var _columnMap = _sublistMap.fields[columnAttr];

                                if(isNullOrEmpty(_columnMap.name)) {
                                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                        attributeName: 'name',
                                        objectName: ('dataMap.'+ sublistAttrName +'.fields.' + columnAttr + '.name'),
                                        additionalInfo: dataMap
                                    });
                                }
                                
                                var _columnValue = record.getSublistValue({
                                    sublistId: _sublistId,
                                    fieldId: _columnMap.name,
                                    line: lineIndex
                                });

                                switch(_columnMap.type) {
                                    case 'select': 
                                    case 'list': 
                                        {
                                            _columnValue = {
                                                id: _columnValue
                                            };
        
                                            try { 
                                                /* Try catch to stop breaking when netsuite can not find getText function */
                                                _columnValue.name = record.getSublistText({
                                                    sublistId: _sublistId,
                                                    fieldId: _columnMap.name,
                                                    line: lineIndex
                                                });
                                            } catch(getTextException){
                                                try { 
                                                    /* Try catch to stop breaking when netsuite can not find getText function */
                                                    _columnValue.name = record.getSublistValue({
                                                        sublistId: _sublistId,
                                                        fieldId: _columnMap.name + 'display',
                                                        line: lineIndex
                                                    });
                                                } catch(getTextException){}
                                            }
                                        } break;
                                    case 'float':
                                    case 'numeric':
                                    case 'currency':
                                        {
                                            _columnValue = Number.ifNaN(parseFloat(_columnValue), 0);
                                        } break;
                                }

                                _lineData[columnAttr] = _columnValue;
                            }

                            if(_sublistMap.subrecords != null) {
                                if(record.isDynamic) {
                                    record.selectLine({
                                        sublistId: _sublistId,
                                        line: lineIndex
                                    });
                                }

                                for(var subrecordAttrName in _sublistMap.subrecords) {
                                    var _subRecordData = {};
                                    var _subRecordMap = _sublistMap.subrecords[subrecordAttrName];
                                    var _subRecord = null;

                                    if(record.isDynamic) {
                                        _subRecord = record.getCurrentSublistSubrecord({
                                            sublistId: _sublistId,
                                            fieldId: _subRecordMap.name
                                        });
                                    } else {
                                        _subRecord = record.getSublistSubrecord({
                                            sublistId: _sublistId,
                                            fieldId: _subRecordMap.name,
                                            line: lineIndex
                                        });
                                    }

                                    _lineData[subrecordAttrName] = _subRecordData;

                                    setFields(_subRecord, _subRecordData, _subRecordMap);
                                }
                            }

                            if(typeof(_sublistMap.each) == 'function') {
                                _sublistMap.each(_lineData, data, lineIndex);
                            }

                            data[sublistAttrName].push(_lineData);
                        }
                    }
                }

                function setFields(record, data, dataMap) {
                    for(var attrName in dataMap.fields) {
                        /* Id attribute is already set on the beginning of data setting */
                        if(attrName == 'id') {
                            continue;
                        }

                        var _fieldMap = dataMap.fields[attrName];

                        if(isNullOrEmpty(_fieldMap.name)) {
                            raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                                attributeName: 'name',
                                objectName: ('dataMap.fields.' + attrName + '.name'),
                                additionalInfo: dataMap
                            });
                        }

                        var _value = record.getValue(_fieldMap.name);
                        var _textHandler = function() {
                            return record.getText(_fieldMap.name)
                        };

                        data[attrName] = adaptValue(_fieldMap.type, _value, _textHandler);
                    }
                }
            }

            this.currentLine = function(options) {
                validateObject(options, 'options', {
                    sublistId: { type: 'string', isRequired: true },
                    fields: { type: 'object', isRequired: true }
                });

                var _currentLineData = {};
                var _record = this.record;

                for(var fieldName in options.fields) {
                    var _fieldConfig = options.fields[fieldName];
                    var _value = _record.getCurrentSublistValue({ 
                        sublistId: options.sublistId,
                        fieldId: _fieldConfig.name
                    });

                    var _textHandler = function() {
                        return _record.getCurrentSublistText({ 
                            sublistId: options.sublistId,
                            fieldId: _fieldConfig.name
                        });
                    }

                    _currentLineData[fieldName] = adaptValue(_fieldConfig.type, _value, _textHandler, options.acceptNullValues);
                }                
                
                return _currentLineData;
            }

            this.getFields = function(options) {
                var _record = this.record;
                var _fieldsData = {
                    body: [],
                    sublists: {}
                };

                if(options.readBody == true) {
                    _record.getFields().forEach(function(fieldId) {
                        var _field = _record.getField({ fieldId: fieldId });

                        if(options.readOnlyCustomSegments == true) {
                            if(fieldId.startsWith('cseg')) {
                                _fieldsData.body.push(_field);
                            }

                            return;
                        }

                        _fieldsData.body.push(_field);
                    });
                }

                if(!isNullOrEmpty(options.sublists)) {
                    for(var sublistName in options.sublists) {
                        var _sublistMap = options.sublists[sublistName];

                        _fieldsData.sublists[sublistName] = [];

                        if(isNullOrEmpty(_sublistMap.name)) {
                            throw 'Missing sublist name! [Action: Getting sublist fields][Sublist map name: '+ sublistName +']';
                        }

                        _record.getSublistFields({ sublistId: _sublistMap.name }).forEach(function(sublistFieldId) {
                            var _sublistField = _record.getSublistField({ sublistId: _sublistMap.name, fieldId: sublistFieldId, line: 0 });

                            if(options.readOnlyCustomSegments == true) {
                                if(sublistFieldId.startsWith('cseg')) {
                                    _fieldsData.sublists[sublistName].push(_sublistField);
                                }
    
                                return;
                            }

                            _fieldsData.sublists[sublistName].push(_sublistField);
                        });
                    }                       
                }

                return _fieldsData;
            }
            
            function adaptValue(type, value, textHandler, acceptNullValues) {
                var _value = null;

                switch(type) {
                    case 'json':
                        {
                            try { 
                                _value = JSON.parse(_value);
                            } catch(jsonParsingExceptino){}
                        } break;
                    case 'select': 
                    case 'list': 
                        {
                            _value = {
                                id: value
                            };

                            try { 
                                _value.name = textHandler();
                            } catch(getTextException){}
                        } break;
                    case 'float':
                    case 'numeric':
                    case 'currency':
                        {
                            if(acceptNullValues != true) {
                                _value = Number.ifNaN(parseFloat(value), 0);
                            } else {
                                _value = Number.ifNaN(parseFloat(value), null);
                            }
                        } break;
                    default: 
                        {
                            _value = value;
                        };
                }

                return _value;
            }

            function setRecordFields(record, fields) {
                for(var fieldName in fields) {
                    var _value = fields[fieldName];

                    if(_value === undefined) {
                        continue;
                    }

                    if(type(_value) == 'object') {
                        if(!isNullOrEmpty(_value.name)) {
                            record.setText({
                                fieldId: fieldName,
                                text: _value.name
                            });
                        } else if(!isNullOrEmpty(_value.id)) {
                            record.setValue({
                                fieldId: fieldName,
                                value: _value.id
                            });
                        }
                    } else {
                        record.setValue({
                            fieldId: fieldName,
                            value: _value
                        });
                    }
                }
            }

            function setRecordSublists(record, sublists) {
                if(sublists != null) {
                    if(type(sublists) != 'object') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, { value: sublists, expectedType: 'object' });
                    }

                    for(var sublistId in sublists) {
                        var _sublistData = sublists[sublistId];

                        setSublistData(record, sublistId, _sublistData)
                    }
                }

                function getSublistLineMap(record, sublistId) {
                    var _sublistMap = {};

                    sublistData = new handler(record).data(
                        {   
                            sublists: {
                                list: {
                                    name: sublistId,
                                    fields: { 
                                        line: { name: 'line' } 
                                    }
                                }    
                            }
                        }
                    ).list.forEach(function(sublistLineData, sublistLineIndex) {
                        var _mapKey = (
                            isNullOrEmpty(sublistLineData.line)
                            ?   'newline' + sublistLineIndex
                            : sublistLineData.line
                        )

                        _sublistMap[_mapKey] = { index: sublistLineIndex };
                    });

                    return _sublistMap;
                }

                function setSublistData(record, sublistId, sublistData) {
                    if(type(sublistData) != 'array') {
                        raiseException(__CUSTOM_ERRORS.INVALID_TYPE, 
                            { 
                                value: sublistData, 
                                expectedType: 'array',
                                additionalInfo: {
                                    recordType: record.type,
                                    recordId: record.id,
                                    sublistId: sublistId
                                }
                            }
                        );
                    }

                    var _sublistData = getSublistLineMap(record, sublistId);

                    if(record.isDynamic) {
                        record.cancelLine({ sublistId: sublistId });
                    }

                    for(var lineIndex in sublistData) {
                        var _lineData = sublistData[lineIndex];
                        var _isLineEdition = (
                            !isNullOrEmpty(_lineData.line) 
                            || !isNullOrEmpty(_lineData.index)
                        );

                        var _lineIndex = lineIndex;

                        if(_lineData.remove == true || _lineData.delete == true) {
                            if(isNullOrEmpty(_lineData.index)) {
                                throw buildException({
                                    code: 'MISSING_LINE_INDEX',
                                    message: 'Missing index of the line that you want to remove!'
                                });
                            }

                            log.audit({
                                title: 'Removing Line #' + _lineData.index,
                                details: _lineData
                            });

                            record.removeLine({
                                sublistId: sublistId,
                                line: _lineData.index
                            });

                            continue;
                        }

                        if(_isLineEdition) {
                            if(_sublistData[_lineData.line] == null) {
                                if(isNullOrEmpty(_lineData.index)) {
                                    throw buildException({
                                        code: 'SUBLIST_LINE_NOT_FOUND',
                                        message: 'Sublist "'+ sublistId +'" has no line "'+ _lineData.line +'" to be updated!'
                                    });
                                }
                            }

                            _lineIndex = ifNullOrEmpty(
                                _sublistData[_lineData.line], { index: _lineData.index }
                            ).index;

                            if(record.isDynamic) {
                                record.selectLine({ sublistId: sublistId, line: _lineIndex });
                            }
                        } else {
                            if(record.isDynamic) {
                                record.selectNewLine({ sublistId: sublistId });
                            } else {
                                record.insertLine({ 
                                    sublistId: sublistId,
                                    line: lineIndex
                                });
                            }                            
                        }

                        setLineData(record, sublistId, _lineIndex, _lineData);

                        if(record.isDynamic) {
                            record.commitLine({ sublistId: sublistId });
                        }
                    }
                }
            }
        }

        function setLineData(record, sublistId, lineIndex, lineData, delayInSeconds) {
            if(type(lineData) != 'object') {
                raiseException(__CUSTOM_ERRORS.INVALID_TYPE, 
                    { 
                        value: lineData, 
                        expectedType: 'object',
                        additionalInfo: {
                            recordType: record.type,
                            recordId: record.id,
                            sublistId: sublistId,
                            lineIndex: lineIndex
                        }
                    }
                );
            }

            const _runWithDelay = (delayInSeconds != null && typeof(setTimeout) == 'function');
            const _delayQueue = [];

            for(var fieldId in lineData) {
                if(_runWithDelay) {
                    _delayQueue.push(fieldId);
                    continue;
                }

                manageFieldSet(record, lineData, sublistId, fieldId, lineIndex);
            }

            if(_delayQueue.length > 0) {
                manageDelayedSet(record, lineData, sublistId, lineIndex, _delayQueue, delayInSeconds);
            }

            function manageDelayedSet(record, lineData, sublistId, lineIndex, delayQueue, delayInSeconds) {
                manageFieldSetWithDelay(record, lineData, sublistId, lineIndex, 0, delayQueue, delayInSeconds);

                function manageFieldSetWithDelay(record, lineData, sublistId, lineIndex, fieldIndex, delayQueue, delayInSeconds) {
                    setTimeout(function() {
                        if(fieldIndex >= delayQueue.length) {
                            return;
                        }

                        const _fieldId = delayQueue[fieldIndex];
                        const _nextFieldIndex = (fieldIndex + 1);

                        manageFieldSet(record, lineData, sublistId, _fieldId, lineIndex);
                        manageFieldSetWithDelay(record, lineData, sublistId, lineIndex, _nextFieldIndex, delayQueue, delayInSeconds);
                    }, delayInSeconds * 1000);
                }
            }

            function manageFieldSet(record, lineData, sublistId, fieldId, lineIndex) {
                var _value = lineData[fieldId];

                if(_value === undefined) {
                    return;
                }

                if(fieldId == 'subrecord') {
                    var _subRecordData = lineData['subrecord'];

                    var _subRecord = null;

                    if(record.isDynamic) {
                        _subRecord = record.getCurrentSublistSubrecord({
                            sublistId: sublistId,
                            fieldId: _subRecordData.name
                        });
                    } else {
                        _subRecord = record.getSublistSubrecord({
                            sublistId: sublistId,
                            fieldId: _subRecordData.name,
                            line: lineIndex
                        });
                    }

                    setRecordFields(_subRecord, _subRecordData.data);
                } else {
                    if(record.isDynamic) {
                        record.setCurrentSublistValue({ 
                            sublistId: sublistId,
                            fieldId: fieldId,
                            value: ifNullOrEmpty(_value, null)
                        });
                    } else {
                        record.setSublistValue({
                            sublistId: sublistId,
                            fieldId: fieldId,
                            line: lineIndex,
                            value: ifNullOrEmpty(_value, null)
                        });
                    }
                }
            }
        }

        function buildUrl(options) {
            switch(options.operation) {
                case 'create':
                    {
                        return buildNewRecordUrl(options);
                    } break;
            }
            
            function buildNewRecordUrl(options) {
                const _defaultRecordUrl  = '/app/common/custom/custrecordentry.nl?';
                const _record = ns_record.create({ type: options.record.type });

                return (
                        _defaultRecordUrl 
                    +   _record.getValue('entryformquerystring')
                    +   '&' 
                    +   buildUrlParameters(options.parameters)

                );
            }
        }

        return {
            buildUrl: buildUrl,
            handler: recordHandler
        };
    }
)