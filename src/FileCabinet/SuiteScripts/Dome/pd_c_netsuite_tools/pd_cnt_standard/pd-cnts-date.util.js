/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @author Isaac Façanha de Carvalho
 */
define(
    [
        'N/util',
        'N/log',
        'N/format',
        './pd-cnts-exception.util.js',
        '../pd_cnt_common/pd-cntc-common.util.js'
    ],
    function(util, log, format, exception_util) {
        ACCEPTED_ENVIRONMENTS = ['netsuite', 'timezone'];
        TIMEZONE_CONFIG = {
            'Sao_Paulo': { offset: 3 }
        }

        function now(options) {
            if(options == null) {
                options = {
                    timezoneKey: 'Sao_Paulo',
                    environment: 'netsuite'
                };
            }

            validateOptions(options);

            var _currentDate = new Date();
            var _responseDate = null;

            switch(options.environment) {
                case 'netsuite': { _responseDate = toNetsuiteDate(_currentDate, options.timezoneKey); } break;
                case 'timezone': { _responseDate = toTimezoneDate(_currentDate, options.timezoneKey); } break;
                default: {
                    raiseException({
                        code: 'NOT_IMPLEMENTED_CASE',
                        message: '"options.environment" with the value "'+ options.environment +'" has no handler implementation!'
                    })
                }
            }

            return _responseDate;

            function validateOptions(options) {
                if(isNullOrEmpty(options)) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_FUNCTION_PARAMETER, 'options');
                }

                if(isNullOrEmpty(options.timezoneKey)) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                        attributeName: 'timezoneKey',
                        objectName: 'options',
                        additionalInformation: 'Available timezone keys are: ' + Object.keys(TIMEZONE_CONFIG).join(', ')
                    });
                } else {
                    if(options.timezoneKey.noneOf(Object.keys(TIMEZONE_CONFIG))) {
                        raiseInvalidTimezoneKey(options.timezoneKey);
                    }
                }

                if(isNullOrEmpty(options.environment)) {
                    raiseException(__CUSTOM_ERRORS.MISSING_REQUIRED_DATA_ATTRIBUTE, {
                        attributeName: 'environment',
                        objectName: 'options',
                        additionalInformation: 'Available enviroments are: ' + ACCEPTED_ENVIRONMENTS.join(', ')
                    });
                } else {
                    if(options.environment.noneOf(ACCEPTED_ENVIRONMENTS)) {
                        raiseException({
                            code: 'INVALID_ENVIRONMENT',
                            message: 'Invalid environment: ' + options.environment + '. Available environments are: ' + ACCEPTED_ENVIRONMENTS.join(', ')
                        });
                    }
                }
            }
        }

        function toNetsuiteDate(date, timezoneKey) {
            date = format.parse({ value: date, type: format.Type.DATETIMETZ, timezone: format.Timezone[timezoneKey] });

            return date;
        }

        function toTimezoneDate(date, timezoneKey) {
            var _timezone = TIMEZONE_CONFIG[timezoneKey];

            if(_timezone == null) {
                raiseInvalidTimezoneKey(timezoneKey);
            }
           
            var _timezoneOffset = _timezone.offset;
            var _dateOffset = (date.getTimezoneOffset() / 60);

            date = date.add('hour', (_dateOffset - _timezoneOffset));

            return date;
        }

        function raiseInvalidTimezoneKey(timezoneKey) {
            raiseException({
                code: 'INVALID_TIMEZONE_KEY',
                message: 'Invalid timezone key: ' + timezoneKey + '. Available timezone keys are: ' + Object.keys(TIMEZONE_CONFIG).join(', ')
            });
        }

        function fromTimeZoneString(dateTimeZoneString, onlyDate) {
            var _dateTime = null;

            if(!isNullOrEmpty(dateTimeZoneString)) {
                var _dateArray = dateTimeZoneString.split('T');
        
                if(_dateArray.length != 2) {
                    throw new Error("Invalid date string: " + dateTimeZoneString);
                }

                var _dateString = _dateArray[0];
                var _hourString = _dateArray[1].split('.')[0];

                if(onlyDate) {
                    _hourString = '12:00:00';
                }

                _dateTime = (
                    _dateString
                    + ' '
                    + _hourString
                ).toDate({ type: 'iso' });

                var _hoursOffset = (new Date().getTimezoneOffset()/60);
                

                _dateTime = _dateTime.add(
                    'hour', 
                    -(_hoursOffset)
                );
            }
        
            return _dateTime;
        }

        return {
            now: now,
            toNetsuite: toNetsuiteDate,
            toTimezoneDate: toTimezoneDate,
            fromTimeZoneString: fromTimeZoneString
        }
    }
)