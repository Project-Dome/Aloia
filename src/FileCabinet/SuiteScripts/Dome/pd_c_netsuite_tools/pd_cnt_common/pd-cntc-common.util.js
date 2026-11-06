/**
 * @author Isaac Façanha de Carvalho
 */
var __MONTHS_MAP = {
    0: { pt_br: { name: 'Janeiro', abbreviation: 'Jan', number: 1 } },
    1: { pt_br: { name: 'Fevereiro', abbreviation: 'Fev', number: 2 } },
    2: { pt_br: { name: 'Março', abbreviation: 'Mar', number: 3 } },
    3: { pt_br: { name: 'Abril', abbreviation: 'Abr', number: 4 } },
    4: { pt_br: { name: 'Maio', abbreviation: 'Mai', number: 5 } },
    5: { pt_br: { name: 'Junho', abbreviation: 'Jun', number: 6 } },
    6: { pt_br: { name: 'Julho', abbreviation: 'Jul', number: 7 } },
    7: { pt_br: { name: 'Agosto', abbreviation: 'Ago', number: 8 } },
    8: { pt_br: { name: 'Setembro', abbreviation: 'Set', number: 9 } },
    9: { pt_br: { name: 'Outubro', abbreviation: 'Out', number: 10 } },
    10: { pt_br: { name: 'Novembro', abbreviation: 'Nov', number: 11 } },
    11: { pt_br: { name: 'Dezembro', abbreviation: 'Dez', number: 12 } }
}
var __WEEKDAYS = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
}
var __CACHE_STORAGE = {};

function getUUID(referenceValue){
    var _referenceValue = parseInt(referenceValue) || new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (_referenceValue + Math.random()*16)%16 | 0;
        _referenceValue = Math.floor(_referenceValue/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

function createPopup(options) {
    var _child = window.open(options.url, options.title, buildWindowOptions(options));
    
    window.customPopup = _child;

    if(options.actions != null) {
        for(var actionName in options.actions) {
            window[actionName] = options.actions[actionName];
        }
    }

    function buildWindowOptions(options) {
        const DEFAULT_OPTIONS = {
            width: 900,
            height: 500,
            top: 100,
            left: 100
        };

        options = merge(DEFAULT_OPTIONS, options);

        return [
            'width=' + options.width,
            'height=' + options.height,
            'top=' + options.top,
            'left=' + options.left
        ].join(',');
    }

    function merge(defaultObject, mainObject) {
        var _newObject = cloneObject(defaultObject);

        for(var attrName in mainObject) {
            _newObject[attrName] = mainObject[attrName];
        }

        return _newObject;
    }
}

function batchHandler(items, size, callback) {
    if(items != null) {
        if(type(items) != 'array') {
            throw 'Batch items must be an array! Received object = [type: '+ type(items) +'][json: '+ JSON.stringify(items) +']';
        }

        var _batchData = [];

        for(var itemIndex=0; itemIndex < items.length ; itemIndex++) {
            var _sendBatch = (itemIndex > 0 && (itemIndex % size) == 0);
            
            if(_sendBatch) {
                callback(_batchData);
                _batchData = [];
            }

            items[itemIndex].index = itemIndex;

            _batchData.push(items[itemIndex]);
        }

        if(_batchData.length > 0) {
            callback(_batchData);
        }
    }
}

function getUrlParams(url) {
    var _parameters = {};
    var _urlArray = url.split('?');

    if(_urlArray == null || _urlArray.length <= 0) {
        return _parameters;
    }

    _urlArray.pop().split('&').forEach(function(parameters) {
        var _parameterArray = parameters.split('=');

        if(_parameterArray.length == 2) {
            _parameters[_parameterArray[0]] = _parameterArray[1];
        }
    });

    return _parameters;
}

function buildUrlParameters(parameters) {
    var _urlParameters = [];

    for(var paramName in parameters) {
        _urlParameters.push(
            paramName + '=' + ifNullOrEmpty(parameters[paramName], '')
        );
    }

    return _urlParameters.join('&');
}

function getUrlEncodedBodyFromObject(object) {
    var _urlEncodedBody = null;

    if(!isNullOrEmpty(object) && type(object) == 'object') {
        var _urlEncodedBodyArray = [];

        for(var attrName in object) {
            _urlEncodedBodyArray.push(
                attrName + '=' + encodeURIComponent(object[attrName])
            );
        }

        _urlEncodedBody = _urlEncodedBodyArray.join('&');
    }

    return _urlEncodedBody;
}

function getFileParts(fileName) {
    var _fileParts = null;

    if(!isNullOrEmpty(fileName)) {
        var _fileNameArray = fileName.split('/').pop().split('.');
        var _fileExtension = _fileNameArray.pop();
        var _fileName = _fileNameArray.join('.');

        if(isNullOrEmpty(_fileName)) {
            _fileName = _fileExtension;
            _fileExtension = null;
        }

        _fileParts = {
            fullName: fileName,
            name: _fileName,
            extension: _fileExtension
        };
    }

    return _fileParts;
}

function isNullOrEmpty(value) {
    var _isNullOrEmpty = (value == null);

    if(!_isNullOrEmpty) {
        var _dataType = type(value);

        switch(_dataType) {
            case 'object': 
                { 
                    _isNullOrEmpty = Object.keys(value).length <= 0;
                } break;
            case 'array': 
                {
                    _isNullOrEmpty = value.length <= 0;
                } break;
            default:
                {
                    _isNullOrEmpty = (value.toString().replace(/\s+/g, '') == '')
                }
        }
    }

    return _isNullOrEmpty;
}

function ifNullOrEmpty(value, valueIfNullOrEmpty) {
    return (
            isNullOrEmpty(value)
        ?   valueIfNullOrEmpty
        :   value
    );
}

function type(value) {
    var _type = typeof(value);

    if(value == null) {
        _type = 'undefined';
    }

    if(_type == 'object') {
        if(Array.isArray(value)) {
            _type = 'array';
        } else {
            if(value.constructor.name == 'Date') {
                _type = 'date';
            } else {
                if(_type === true || _type === false) {
                    _type = 'boolean';
                }
            }
        }
    }

    return _type;
}

function parseBoolean(value) {

    if(value != null) {
        var _stringValue = value.toString().toLowerCase().trim();
        var _isTrue = (
                _stringValue == 'true'
            ||  _stringValue == 't'
            ||  _stringValue == '1'
        );
        var _isFalse = (
                _stringValue == 'false'
            ||  _stringValue == 'f'
            ||  _stringValue == '0'
        );

        if(_isTrue) {
            value = true;
        } else if(_isFalse) {
            value = false;
        }
    }

    return value;
}

function withCache(cacheKey, dataAction, dataActionParameters) {
    var _data = __CACHE_STORAGE[cacheKey];

    if(_data == null) {
        _data = dataAction(dataActionParameters);
        __CACHE_STORAGE[cacheKey] = _data;
    }

    return _data;
}

function clearCache() {
    for(var cacheKey in __CACHE_STORAGE) {
        delete __CACHE_STORAGE[cacheKey];
        __CACHE_STORAGE[cacheKey] = undefined;
    }
}

function arrayToDict(array, dictAttributeKey) {
    var _dict = {};


    if(isNullOrEmpty(dictAttributeKey)) {
        throw new Error('Missing required function parameter "dictAttributeKey".');
    }

    if(array != null) {
        array.forEach(function(arrayItem, arrayIndex) {
            var _key = null;

            if(typeof(dictAttributeKey) == 'function') {
                _key = dictAttributeKey(arrayItem, arrayIndex, array);
            } else {
                _key = arrayItem[dictAttributeKey];
            }

            _dict[_key] = arrayItem;
        });
    }

    return _dict;
}

Date.getWorkingDays = function(options) {
    validateOptions(options);

    options.notWorkingWeekDays = getNotWorkingDays(options);

    var _daysCount = options.endDate.diff({ type: 'day', dateToCompare: options.startDate, includeStartDate: true });

    if(_daysCount <= 7) {
        return getWorkingDaysManually(options);
    }

    var _startDayInfo = options.startDate.info();
    var _endDayInfo = options.endDate.info();
    var _firstSaturday = _startDayInfo.week.lastDay;
    var _lastSunday = _endDayInfo.week.firstDay;
    var _saturdayIsNotWorkingDay = (options.notWorkingWeekDays.indexOf(__WEEKDAYS.saturday) >= 0);
    var _sundayIsNotWorkingDay = (options.notWorkingWeekDays.indexOf(__WEEKDAYS.sunday) >= 0);

    _daysCount = (_firstSaturday.diff({ type: 'day', dateToCompare: _lastSunday, includeStartDate: true }));

    if(_saturdayIsNotWorkingDay) {
        _daysCount -= 1;
    }

    if(_sundayIsNotWorkingDay) {
        _daysCount -= 1;
    }
    
    var _weeksCount = Math.floor(_daysCount / 7);
    var _weekDaysToRemoveCount = (options.notWorkingWeekDays.length);
    var _holidaysWithinCount = getHolidaysWithinCount(options, _firstSaturday, _lastSunday);
    
    _daysCount -= (_weekDaysToRemoveCount * _weeksCount);
    _daysCount -= _holidaysWithinCount;

    _daysCount += getDaysOutsideControlledInterval(options, _firstSaturday, _lastSunday);

    return _daysCount;

    function getDaysOutsideControlledInterval(options, firstSaturday, lastSunday) {
        var _firstDaysOptions = cloneObject(options);
        var _lastDaysOptions = cloneObject(options);

        _firstDaysOptions.startDate = options.startDate;
        _firstDaysOptions.endDate = firstSaturday.add('day', -1);

        _lastDaysOptions.startDate = lastSunday.add('day', 1);
        _lastDaysOptions.endDate = options.endDate;

        parseHolidays(_firstDaysOptions);
        parseHolidays(_lastDaysOptions);

        return (
                getWorkingDaysManually(_firstDaysOptions)
            +   getWorkingDaysManually(_lastDaysOptions)
        );

        function parseHolidays(options) {
            if(!isNullOrEmpty(options.holidays)) {
                options.holidays = options.holidays.map(function(holidayDate) {
                    return new Date(holidayDate);
                });
            }
        }
    }

    function getWorkingDaysManually(options) {
        var _manualDaysCount = 0;
        var _startDate = options.startDate.clone();
        var _endDate = options.endDate.clone();

        while(_startDate <= _endDate) {
            var _weekDay = _startDate.getDay();
            var _isNotWorkingDay = options.notWorkingWeekDays.indexOf(_weekDay) >= 0;

            if(!_isNotWorkingDay) {
                _manualDaysCount += 1;
            }

            _startDate = _startDate.add('day', 1);
        }

        _manualDaysCount -= getHolidaysWithinCount(options, options.startDate, options.endDate);

        return _manualDaysCount;
    }

    function getHolidaysWithinCount(options, startDate, endDate) {
        var _holidaysCount = 0;

        if(options.holidays == null) {
            return _holidaysCount;
        }

        options.holidays.forEach(function(holidayDate) {
            if(holidayDate >= startDate && holidayDate <= endDate) {
                var _weekDay = holidayDate.getDay();
                var _isNotWorkingDay = options.notWorkingWeekDays.indexOf(_weekDay) >= 0;

                if(!_isNotWorkingDay) {
                    _holidaysCount += 1;
                }                    
            }
        });

        return _holidaysCount;
    }

    function getNotWorkingDays(options) {
        return (
                options.notWorkingWeekDays != null
            ?   options.notWorkingWeekDays
            :   [__WEEKDAYS.saturday, __WEEKDAYS.sunday]
        );
    }

    function validateOptions(options) {
        if(options == null) {
            throw 'Missing options parameter!'
        }

        if(isNullOrEmpty(options.startDate)) {
            throw 'Missing options.startDate attribute!'
        } else {
            if(type(options.startDate) != 'date') {
                throw 'options.startDate attribute must be of type "Date"!'
            }
        }

        if(isNullOrEmpty(options.endDate)) {
            throw 'Missing options.startDate attribute!'
        } else {
            if(type(options.endDate) != 'date') {
                throw 'options.startDate attribute must be of type "Date"!'
            }
        }
    }
}

Date.prototype.truncate = function(datePart, truncateTime) {
    AVAILABLE_DATE_PARTS = ['day', 'month', 'year'];

    if(datePart.noneOf(AVAILABLE_DATE_PARTS)) {
        throw new Error('Invalid date part "'+ datePart +'". Available date parts are: ' + AVAILABLE_DATE_PARTS.join(', '));
    }

    var _dateParts = this.getParts();
    var _responseDate = null;

    if(truncateTime != false) {
        _dateParts.miliseconds = 0;
        _dateParts.seconds = 0;
        _dateParts.minutes = 0;
        _dateParts.hours = 0;
    }    

    switch(datePart) {
        case 'month': 
            { 
                _dateParts.day = 1;
            } break;
        case 'year': 
            { 
                _dateParts.day = 1;
                _dateParts.month = 0;
            } break;
    }

    return Date.__fromPartsObject__(_dateParts);
}

Date.prototype.add = function(datePart, additionalPartValue) {
    AVAILABLE_DATE_PARTS = ['milisecond', 'second', 'minute', 'hour', 'day', 'month', 'year'];

    if(datePart.noneOf(AVAILABLE_DATE_PARTS)) {
        throw new Error('Invalid date part "'+ datePart +'". Available date parts are: ' + AVAILABLE_DATE_PARTS.join(', '));
    }
    
    var _currentDate = this;
    var _dateParts = _currentDate.getParts();
    var _newdate = null;

    switch(datePart) {
        case 'milisecond': { _dateParts.miliseconds += additionalPartValue; } break;
        case 'second': { _dateParts.seconds += additionalPartValue; } break;
        case 'minute': { _dateParts.minutes += additionalPartValue; } break;
        case 'hour': { _dateParts.hours += additionalPartValue; } break;
        case 'day': { _dateParts.day += additionalPartValue; } break;
        case 'month': { _dateParts.month += additionalPartValue; } break;
        case 'year': { _dateParts.year += additionalPartValue; } break;
    }

    var _newdate = Date.__fromPartsObject__(_dateParts);

    if(datePart.anyOf(['month', 'year'])) {
        var _referenceDate = _currentDate.truncate('month', false);
        var _referenceMonthParts = _referenceDate.getParts()
        
        if(datePart == 'month') {
            _referenceMonthParts.month += additionalPartValue;
        } else {
            _referenceMonthParts.year += additionalPartValue;
        }        

        var _expectedReferenceDate = Date.__fromPartsObject__(_referenceMonthParts);
        
        if (_expectedReferenceDate.getMonth() < _newdate.getMonth()) {
            _newdate = new Date(
                _newdate.getFullYear(),
                _newdate.getMonth(),
                0,
                _newdate.getHours(),
                _newdate.getMinutes(),
                _newdate.getSeconds(),
                _newdate.getMilliseconds()
            );
        }
    }

    if(datePart.anyOf(['month', 'year', 'day'])) {
        if(_currentDate.getHours() != _newdate.getHours()) {
            _newdate = _newdate.add(
                'hour', 
                _currentDate.getHours() - _newdate.getHours()
            );
        }
    }

    return _newdate;
}

Date.prototype.getParts = function() {
    return {
        year: this.getFullYear(),
        month: this.getMonth(),
        day: this.getDate(),
        hours: this.getHours(),
        minutes: this.getMinutes(),
        seconds: this.getSeconds(),
        miliseconds: this.getMilliseconds()
    };
}

Date.prototype.getFormatParts = function () {
    var _currentDate = this;

    var _month = (_currentDate.getMonth() + 1).toString();
    var _day = _currentDate.getDate().toString();

    var _hours = _currentDate.getHours().toString();
    var _minutes = _currentDate.getMinutes().toString();
    var _seconds = _currentDate.getSeconds().toString();

    return {
        year: _currentDate.getFullYear().toString(),
        month: '0'.repeat(2 - _month.length) + _month,
        day: '0'.repeat(2 - _day.length) + _day,
        hours: '0'.repeat(2 - _hours.length) + _hours,
        minutes: '0'.repeat(2 - _minutes.length) + _minutes,
        seconds: '0'.repeat(2 - _seconds.length) + _seconds,
        miliseconds: _currentDate.getMilliseconds().toString()
    };
}

Date.prototype.format = function(options, deprecatedSeparator, deprecatedShowTime) {
    if(type(options) == 'string') {
        options = {
            type: options,
            separator: deprecatedSeparator,
            showTime: deprecatedShowTime
        }
    }

    validateOptions(options);

    var _currentDate = this;
    var _dateParts = _currentDate.getFormatParts();
    var _formatConfigOptions = {
        'pt-br': { separator: '/', map: { 0: _dateParts.day, 1: _dateParts.month, 2: _dateParts.year } },
        'en-us': { separator: '/', map: { 0: _dateParts.month, 1: _dateParts.day, 2: _dateParts.year } },
        'iso': { separator: '-', map: { 0: _dateParts.year, 1: _dateParts.month, 2: _dateParts.day } }
    };
    var _formatConfig = _formatConfigOptions[options.type];
    var _formatedDate = [_formatConfig.map[0], _formatConfig.map[1], _formatConfig.map[2]].join(_formatConfig.separator);

    if(options.showTime) {
        _formatedDate += (' ' + _dateParts.hours + ':' + _dateParts.minutes);
    }

    return _formatedDate;

    function validateOptions(options) {
        var _allowedFormatTypes = ["pt-br", "en-us", "iso"];

        if(options == null) {
            throw new Error('Missing "options" parameter!');
        }

        if(isNullOrEmpty(options.type)) {
            throw new Error('Missing "options.type" attribute!');
        } else {
            options.type = options.type.toLowerCase().trim();

            if(options.type.noneOf(_allowedFormatTypes)) {
                throw new Error('Invalid attribute "options.type". Allowed types are: ' + _allowedFormatTypes.join(', '));
            }
        }
    }
}

Date.prototype.diff = function(options) {
    var _currentDate = this;
    var _diffResult = null;

    validateOptions(options);

    var _greaterDate = null;
    var _lowerDate = null;

    if(_currentDate > options.dateToCompare) {
        _greaterDate = _currentDate;
        _lowerDate = options.dateToCompare;
    } else {
        _greaterDate = options.dateToCompare;
        _lowerDate = _currentDate;
    }

    var _diffInMiliseconds = (_greaterDate - _lowerDate);
    var _diffInSeconds = (_diffInMiliseconds / 1000);
    var _diffInMinutes = (_diffInSeconds / 60);
    var _diffInHours = (_diffInMinutes / 60);
    var _diffInDays = (_diffInHours / 24);

    switch(options.type) {
        case 'milisecond':
            {
                _diffResult = _diffInMiliseconds;
            } break;
        case 'minute':
            {
                _diffResult = _diffInMinutes;
            } break;
        case 'second':
            {
                _diffResult = _diffInSeconds;
            } break;
        case 'hour':
            {
                _diffResult = _diffInHours;
            } break;
        case 'day':
            {
                if(options.excludeWeekends == true) {
                    _diffResult = Date.getWorkingDays({ startDate: _lowerDate, endDate: _greaterDate });
                } else {                    
                    _diffResult = _diffInDays;

                    if(options.includeStartDate == true) {
                        _diffResult += 1;
                    }
                }
            } break;
        case 'month': 
            {
                var _firstDateYear = _lowerDate.getFullYear();
                var _firstDateMonth = _lowerDate.getMonth();
                var _secondDateYear = _greaterDate.getFullYear();
                var _secondDateMonth = _greaterDate.getMonth();

                if(_firstDateYear == _secondDateYear) {
                    return _secondDateMonth - _firstDateMonth;
                } else {
                    const _firstYearMonthsCount = (11 - _firstDateMonth);
                    const _lastYearMonthsCount = _secondDateMonth + 1;
                    const _yearDiff = _secondDateYear - _firstDateYear;
                    const _yearsBetweenMonthsCount = (_yearDiff - 1) * 12;
                    
                    return (
                            _firstYearMonthsCount
                        +   _lastYearMonthsCount
                        +   _yearsBetweenMonthsCount
                    );
                }

            } break;
    }

    return Math.floor(_diffResult);

    function validateOptions(options) {
        if(options == null) {
            throw new Error('Missing "options" parameter!');
        }

        if(options.dateToCompare == null) {
            throw new Error('Missing "options.dateToCompare" parameter!');
        } else {
            var _dateToCompareType = type(options.dateToCompare);

            if(_dateToCompareType != 'date') {
                throw new Error('Invalida parameter "options.dateToCompare". It must be a date. (Given value/type: '+ options.dateToCompare +'/'+ _dateToCompareType +')');
            }
        }

        if(isNullOrEmpty(options.type)) {
            throw new Error('Missing "options.type" parameter!');
        } else {
            var _acceptedTypes = ['milisecond', 'minute', 'second', 'hour', 'day', 'month'];
            var _typeType = type(options.type);

            if(_typeType != 'string') {
                throw new Error('Invalida parameter "options.type". It must be a string. (Given value/type: '+ options.type +'/'+ _typeType +')');
            } else {
                if(options.type.noneOf(_acceptedTypes)) {
                    throw new Error('Invalid type "'+ options.type +'". Accepted types are: ' + _acceptedTypes.join(', '));
                }
            }
        }
    }
}

Date.prototype.info = function() {
    var _date = this;
    var _monthInfo = __MONTHS_MAP[_date.getMonth()];
    var _info = {
        month: {
            daysFromStart: null,
            daysToEnd: null,
            daysCount: null,
            lastDay: null,
            name: _monthInfo.pt_br.name,
            abbreviation: _monthInfo.pt_br.abbreviation,
            number: _monthInfo.pt_br.number
        },
        week: {
            firstDay: _date.add('day', -_date.getDay()),
            lastDay: _date.add('day', 6 - _date.getDay())
        }
    };

    var _lastDay = new Date(
        _date.getFullYear(),
        _date.getMonth() + 1,
        0,
        _date.getHours(),
        _date.getMinutes(),
        _date.getSeconds(),
        _date.getMilliseconds()
    );
    var _firstDay = _date.truncate('month', false);

    _info.month.lastDay = _lastDay;
    _info.month.daysCount = _lastDay.getDate();
    _info.month.daysFromStart = _date.diff({ dateToCompare: _firstDay, type: 'day' });
    _info.month.daysToEnd = _lastDay.diff({ dateToCompare: _date, type: 'day' });

    var _lastDayHoursDiff = _lastDay.diff({ dateToCompare: _date, type: 'hour' });
    var _firstDayDiff = _date.diff({ dateToCompare: _firstDay, type: 'hour' })

    if(_lastDayHoursDiff % 24 > 20) {
        _info.month.daysToEnd += 1;
    }

    if(_firstDayDiff % 24 > 20) {
        _info.month.daysFromStart += 1;
    }

    return _info;
}

Date.prototype.clone = function(options) {
    if(options == null) {
        options = {};
    }

    var _currentDate = this;
    var _options = {
        year: options.year != null ? options.year : _currentDate.getFullYear(),
        month: options.month != null ? options.month : _currentDate.getMonth(),
        day: options.day != null ? options.day : _currentDate.getDate(),
        hours: options.hours != null ? options.hours : _currentDate.getHours(),
        minutes: options.minutes != null ? options.minutes : _currentDate.getMinutes(),
        seconds: options.seconds != null ? options.seconds : _currentDate.getSeconds(),
        miliSeconds: options.miliSeconds != null ? options.miliSeconds : _currentDate.getMilliseconds(),
    };

    return new Date(
        _options.year,
        _options.month,
        _options.day,
        _options.hours,
        _options.minutes,
        _options.seconds,
        _options.miliSeconds
    );
}

Date.prototype.isEqual = function(dateToCompare) {
    if(dateToCompare == null || typeof(dateToCompare.getTime) != 'function') {
        return null;
    }

    return this.getTime() == dateToCompare.getTime();
}

Date.prototype.isAfter = function(dateToCompare) {
    if(dateToCompare == null || typeof(dateToCompare.getTime) != 'function') {
        return null;
    }

    return this.getTime() > dateToCompare.getTime();
}

Date.prototype.isBefore = function(dateToCompare) {
    if(dateToCompare == null || typeof(dateToCompare.getTime) != 'function') {
        return null;
    }

    return this.getTime() < dateToCompare.getTime();
}

Date.prototype.isNotEqual = function(dateToCompare) {
    return !this.isEqual(dateToCompare);
}

Date.prototype.isBeforeOrEqual = function(dateToCompare) {
    return this.isBefore(dateToCompare) || this.isEqual(dateToCompare);
}

Date.prototype.isAfterOrEqual = function(dateToCompare) {
    return this.isAfter(dateToCompare) || this.isEqual(dateToCompare);
}

Date.__fromPartsObject__ = function(dateParts) {
    return new Date(
        dateParts.year, 
        dateParts.month, 
        dateParts.day, 
        dateParts.hours, 
        dateParts.minutes, 
        dateParts.seconds, 
        dateParts.miliseconds
    );
}

Date.fromTimeZoneString = function(dateTimeZoneString) {
    var _dateTime = null;

    if(!isNullOrEmpty(dateTimeZoneString)) {
        var _dateArray = dateTimeZoneString.split('T');

        if(_dateArray.length != 2) {
            throw new Error("Invalid date string: " + dateTimeZoneString);
        }

        _dateTime = (
            _dateArray[0]
            + ' '
            + _dateArray[1].split('.')[0]
        ).toDate({ type: 'iso' })
    }

    return _dateTime;
}

if(String.prototype.contains == null) {
    String.prototype.contains = function(value) {
        return this.indexOf(value) >= 0;
    }
}

if(String.prototype.repeat == null) {
    String.prototype.repeat = function(repeatCount) {
        var _stringToRepeat = this;
        var _repeatedString = '';

        while(repeatCount > 0) {
            _repeatedString += _stringToRepeat;

            repeatCount--;
        }

        return _repeatedString;
    }
}

if(String.prototype.startsWith == null) {
    String.prototype.startsWith = function(value, isCaseSensitive) {
        var _currentString = this;
        
        if(isCaseSensitive != true) {
            _currentString = _currentString.toLocaleLowerCase();
        }

        return _currentString.indexOf(value) == 0;
    }
}

if(String.prototype.endsWith == null) {
    String.prototype.endsWith = function(value) {
        var _currentString = this;
        var _endsWith = false;

        if(!isNullOrEmpty(value)) {
            var _valueString = value.toString();
            var _valueLength = _valueString.length;
            var _currentStringLength = _currentString.length;

            if(_valueLength <= _currentStringLength) {
                var _comparison = _currentString.substring(_currentStringLength - _valueLength, _currentStringLength);

                _endsWith = (_comparison == _valueString);
            }            
        }

        return _endsWith;
    }
}

String.prototype.encodeHtml = function() {
    var _buffer = [];
    var _text = this;
        
    for (var i=_text.length-1;i>=0;i--) {
        _buffer.unshift(['&#', _text[i].charCodeAt(), ';'].join(''));
    }
    
    return _buffer.join('');
}

String.prototype.replaceSpecialCharacters = function() {
    var _text = this;
    var _specialCharacters = 'áàãâäéèêëíìîïóòôõöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ'.split('');
    var _specialCharactersReplacements = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'.split('');

    _specialCharacters.forEach(function(character, characterIndex) {
        _text = _text.replace(new RegExp(character, 'g'), _specialCharactersReplacements[characterIndex]);
    });
    
    return _text;
}

String.prototype.onlyNumbers = function() {
    return this.replace(/[^0-9]/g, '');
}

String.prototype.ifEmpty = function(valueIfEmpty) {
    return (this.trim() == '' ? valueIfEmpty : this);
}

String.prototype.anyOf = function(arrayToCompare) {
    var _textToFind = this;
    var _isAnyOf = false;
    
    if(type(arrayToCompare) != 'array') {
        throw new Error('Invalid "arrayToCompare" parameter! It is required and must be an array!');
    }

    for(var itemIndex in arrayToCompare) {
        if(arrayToCompare[itemIndex] == _textToFind) {
            _isAnyOf = true; break;
        }
    }

    return _isAnyOf;
}

String.prototype.noneOf = function(arrayToCompare) {
    return !this.anyOf(arrayToCompare);
}

String.prototype.toDate = function(options) {
    validateOptions(options);

    var _stringDate = this;

    var _typesMap = {
        'pt-br': { separator: '/', index: { day: 0, month: 1, year: 2 } },
        'en-us': { separator: '/', index: { day: 1, month: 0, year: 2 } },
        'iso': { separator: '-', index: { day: 2, month: 1, year: 0 } }
    };

    var _dateTypeMap = _typesMap[options.type];
    var _dateArray = _stringDate.split(_dateTypeMap.separator);

    if(_dateArray.length != 3) {
        throw new Error('String date "'+ _stringDate +'" is not a "'+ options.type +'" valid date!');
    }

    return Date.__fromPartsObject__(
        toDateParts(_dateArray, _dateTypeMap.index)
    );
    
    function toDateParts(dateArray, dateIndex) {
        var _year = parseFloat(removeTimePart(dateArray[dateIndex.year]));
        var _month = parseFloat(dateArray[dateIndex.month]) - 1;
        var _day = parseFloat(removeTimePart(dateArray[dateIndex.day]));

        var _hours = 0;
        var _minutes = 0;
        var _seconds = 0;
        var _miliseconds = 0;

        var _lastDatePart = _dateArray[2];
        var _lastDatePartArray = _lastDatePart.replace(/\s+/g, ' ').trim().split(' ');
        
        if(_lastDatePartArray.length == 2) {
            var _timeString = _lastDatePartArray[1];
            var _timeArray = _timeString.split(':');

            if(_timeArray.length != 3) {
                throw new Error('Invalid time string: ' + _timeString);
            }

            _hours = parseFloat(_timeArray[0].onlyNumbers().ifEmpty('0'));
            _minutes = parseFloat(_timeArray[1].onlyNumbers().ifEmpty('0'));
            _seconds = parseFloat(_timeArray[2].onlyNumbers().ifEmpty('0'));
        }

        return {
            year: _year,
            month: _month,
            day: _day,
            hours: _hours,
            minutes: _minutes,
            seconds: _seconds,
            miliseconds: _miliseconds
        };

        function removeTimePart(datePartString) {
            return datePartString.replace(/\s+/g, ' ').trim().split(' ')
        }
    }    

    function validateOptions(options) {
        var _allowedFormatTypes = ["pt-br", "en-us", "iso"];

        if(options == null) {
            throw new Error('Missing "options" parameter!');
        }

        if(isNullOrEmpty(options.type)) {
            throw new Error('Missing "options.type" attribute!');
        } else {
            options.type = options.type.toLowerCase().trim();

            if(options.type.noneOf(_allowedFormatTypes)) {
                throw new Error('Invalid attribute "options.type". Allowed types are: ' + _allowedFormatTypes.join(', '));
            }
        }
    }
}

String.prototype.splitText = function(separator, ignoreTextWithinDoubleQuote) {
    var _currentText = this;

    if(ignoreTextWithinDoubleQuote == true) {
        return _currentText.split(RegExp(separator + "(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"));
    } else {
        return _currentText.split(separator);
    }
}

String.prototype.capitalize = function() {
    return this.toLocaleLowerCase().replace(/\b\w/g, function(letter){ return letter.toUpperCase() });
}

String.prototype.toFloat = function() {
    return parseFloat(this);
};

if(Number.isNaN == null) {
    Number.isNaN = function(number) {
        return parseFloat(number).toString().toLowerCase().trim() == 'nan';
    }
}

Number.ifNaN = function(number, valueIfNaN) {
    return (
            Number.isNaN(number)
        ?   valueIfNaN
        :   number
    );
}

Number.prototype.round = function(fractionDigits) {
    var _value = this;

    if(Number.isNaN(_value)) {
        return _value;
    }

    if(isNullOrEmpty(fractionDigits)) {
        fractionDigits = 2;
    }

    if(typeof(fractionDigits) != 'number') {
        throw new Error('fractionDigits parameter must be of type number!');
    }

    return parseFloat(_value.toFixed(fractionDigits));
}

Number.prototype.format = function(prefix) {
    var _value = parseFloat(this).toFixed(2);

    _value = _value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    _value = _value.replace('.', ';').replace(/\,/g, '.').replace(';', ',');

    var _valueArray = _value.split(',');

    if(_valueArray.length == 1) {
        _value += ',00';
    } else {
        if(_valueArray[1].length == 1) {
            _value += '0';
        }
    }

    if(prefix != null) {
        _value = (prefix + _value);
    }

    return _value;
}

Number.prototype.toTime = function(options) {
    var _number = this;
    var _options = readOptions(options);
    var _hours = Math.floor(_number).toFixed(0);
    var _minutes = ((_number - _hours) * 60).toFixed(0);

    var _hoursCharactersCount = (_hours.length);
    var _minutesCharactersCount = (_minutes.length);
    
    if(_hoursCharactersCount <= 2) {
        _hours = '0'.repeat(2 - _hoursCharactersCount) + _hours;
    }

    if(_minutesCharactersCount <= 2) {
        _minutes = '0'.repeat(2 - _minutesCharactersCount) + _minutes;
    }
    
    return (_hours + ':' + _minutes);

    function readOptions(options) {
        options = options || {};
        options.sourceType = options.sourceType || 'hours';
    }
}

function cloneObject(object) {
    return JSON.parse(JSON.stringify(object));
}