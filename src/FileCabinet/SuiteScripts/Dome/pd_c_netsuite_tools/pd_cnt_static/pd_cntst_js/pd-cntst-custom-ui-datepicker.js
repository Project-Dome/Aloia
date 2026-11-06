(function($) {
    const WEEKDAYS = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
    }

    const DEFAULT_TRANSLATION = {
        weeks: {
            sunday: { name: 'Domingo', abbreviation: 'Dom' },
            monday: { name: 'Segunda', abbreviation: 'Seg' },
            tuesday: { name: 'Terça', abbreviation: 'Ter' },
            wednesday: { name: 'Quarta', abbreviation: 'Qua' },
            thursday: { name: 'Quinta', abbreviation: 'Qui' },
            friday: { name: 'Sexta', abbreviation: 'Sex' },
            saturday: { name: 'Sábado', abbreviation: 'Sáb' }
        },
        months: {
            0: { name: 'Janeiro', abbreviation: 'Jan' },
            1: { name: 'Fevereiro', abbreviation: 'Fev' },
            2: { name: 'Março', abbreviation: 'Mar' },
            3: { name: 'Abril', abbreviation: 'Abr' },
            4: { name: 'Maio', abbreviation: 'Mai' },
            5: { name: 'Junho', abbreviation: 'Jun' },
            6: { name: 'Julho', abbreviation: 'Jul' },
            7: { name: 'Agosto', abbreviation: 'Ago' },
            8: { name: 'Setembro', abbreviation: 'Set' },
            9: { name: 'Outubro', abbreviation: 'Out' },
            10: { name: 'Novembro', abbreviation: 'Nov' },
            11: { name: 'Dezembro', abbreviation: 'Dez' }
        }
    };

    if($.fn.datePicker != null) {
        return;
    }

    $.fn.datePicker = function(options) {
        const _element = $(this);
        const _elementTag = this[0].nodeName;

        if(options == null) {
            options = {};
        }

        setupOptionsFromElement(options, _element);

        switch(_elementTag) {
            case 'DIV':
                {
                    return buildInline(_element, options);
                };
            default:
                {
                    throw `Not datepicker implementation for element of this type: ${_elementTag}`
                }
        }
    }

    function setupOptionsFromElement(options, element) {
        let _optionsMap = {
            'on-day-click': 'onDayClick'
        };

        for(let optionKey in _optionsMap) {
            const _elementOption = element.data(optionKey);
            const _optionName = _optionsMap[optionKey];

            if(!isNullOrEmpty(_elementOption)) {
                options[_optionName] = _elementOption;
            }
        }
    }

    function buildInline(element, options) {
        const _config = getConfig(options);
        const _calendarHtml = buildCalendarHtml(_config, options);

        element.data('config', _config);
        element.css({ width: '250px' });
        element.html(_calendarHtml);

        setupEvents(element, options, _config.referenceDate);
    }

    function setupEvents(element, options, referenceDate) {
        element.find('.button-last-month, .button-next-month').on('click', function() {
            const _caller = $(this);

            if(_caller.is('.button-last-month')) {
                buildInline(element, $.extend(options, { referenceDate: referenceDate.add('month', -1) }));
            }

            if(_caller.is('.button-next-month')) {
                buildInline(element, $.extend(options, { referenceDate: referenceDate.add('month', 1) }));
            }
        });

        element.find('td.day').on('click', function() {
            const _data = $(this).data();
            const _dayClickData = {
                referenceDate: referenceDate,
                data: _data
            };

            _data.date = new Date(_data.date);

            if(!isNullOrEmpty(options?.onDayClick)) {
                if(typeof(options?.onDayClick) == 'function') {
                    options?.onDayClick(_dayClickData, element);

                    return;
                }
                
                window[options.onDayClick](_dayClickData, element);
            }
        });
    }

    function buildCalendarHtml(config, options) {
        const _translation = DEFAULT_TRANSLATION;
        const _year = config.firstDay.getFullYear();
        const _month = config.firstDay.getMonth();
        const _monthName = _translation.months[_month].name;
        
        return (
            [
                `<table class="table table-date-picker table-borderless" style="margin-bottom: 0px;">`,
                    `<thead>`,
                        `<tr>`,
                            `<th scope="col" colspan="1" class="text-center button button-last-month"><span class="fa fa-chevron-left text-secondary"></span></th>`,
                            `<th scope="col" colspan="5" class="text-center">${_monthName}<span class="text-muted">/</span>${_year}</th>`,
                            `<th scope="col" colspan="1" class="text-center button button-next-month"><span class="fa fa-chevron-right text-secondary"></span></th>`,
                        `</tr>`,
                    `</thead>`,
                    `<tbody>`,
                        `<tr>`,
                            `<td class="weekday text-center">${_translation.weeks.sunday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.monday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.tuesday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.wednesday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.thursday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.friday.abbreviation}</td>`,
                            `<td class="weekday text-center">${_translation.weeks.saturday.abbreviation}</td>`,
                        `</tr>`,
                        buildWeeksHtml(config.weeks, options),
                    `</tbody>`,
                `</table>`
            ].join('')
        );

        function buildWeeksHtml(weeks, options) {
            let _weeks = [];

            for(let weekNumber in weeks) {
                let _week = weeks[weekNumber];
                let _weekDays = [];

                for(let weekDay in _week) {
                    let _weekData = _week[weekDay];
                    let _day = _weekData.date.getDate().toString();
                    let _month = (_weekData.date.getMonth() + 1).toString();
                    let _additionalClass = [];

                    _day = ('0'.repeat(2 - _day.length) + _day);

                    if(_weekData.isToday) {
                        _additionalClass.push('today text-info');
                    }

                    if(_weekData.onLastMonth) {
                        _additionalClass.push('last-month');
                    }

                    if(_weekData.onNextMonth) {
                        _additionalClass.push('next-month');
                    }

                    if(_weekData.isWeekend) {
                        _additionalClass.push('weekend text-warning');
                    }

                    _weekDays.push(
                        `<td class="day text-center ${_additionalClass.join(' ')}" data-day="${parseInt(_day)}" data-month="${_month}" data-date="${_weekData.date.toISOString()}">
                            <span class="date rounded">${_day}</span>
                        </td>`
                    );
                }
                
                _weeks.push(`<tr data-week-number="${weekNumber}">${_weekDays.join('')}</tr>`);
            }

            return _weeks.join('');
        }
    }

    function getConfig(options) {
        const _today = new Date().truncate('day');

        let _weeks = {};
        let _weeksCount = 6;
        let _referenceDate = (options?.referenceDate || new Date()).truncate('day');
        let _referenceDateInfo = _referenceDate.info();
        let _firstDay = _referenceDate.truncate('month');
        let _lastDay = _referenceDateInfo.month.lastDay;
        let _startWeekDay = _firstDay.getDay();
        
        let _weekNumber = 0;
        let _firstWeekDay = (_startWeekDay == 0 ? _firstDay : _firstDay.add('day', -_startWeekDay));

        while(_weekNumber < _weeksCount) {
            _firstWeekDay = (_weekNumber == 0 ? _firstWeekDay : _firstWeekDay.add('day', 7));

            _weeks[_weekNumber] = buildWeek(
                _firstWeekDay,
                _firstDay,
                _lastDay,
                _today
            );

            _weekNumber ++;
        }

        return {
            weeks: _weeks,
            firstDay: _firstDay,
            lastDay: _lastDay,
            referenceDate: _referenceDate
        };

        function buildWeek(firstWeekDay, firstMonthDay, lastMonthDay, today) {
            const _week = {};

            for(let weekName in WEEKDAYS) {
                let _weekDay = WEEKDAYS[weekName];
                let _date = firstWeekDay.add('day', _weekDay);
                let _isLastMonth = _date.getTime() < firstMonthDay.getTime();
                let _isNextMonth = _date.getTime() > lastMonthDay.getTime();

                _week[_weekDay] = {
                    date: _date,
                    weekDay: _weekDay,
                    isWeekend: _weekDay == 0 || _weekDay == 6,
                    isToday: _date.getTime() == today.getTime(),
                    onLastMonth: _isLastMonth,
                    onNextMonth: _isNextMonth,
                    onCurrentMonth: !_isLastMonth && !_isNextMonth
                };
            }

            return _week;
        }
    }
}(jQuery));

$(document).ready(function() {
    const _bodyElement = $('body');

    buildDatePickerElements(_bodyElement);
    buildDatePickerInputs(_bodyElement);
});

function buildDatePickerInputs(container) {
    container.find('input.date-picker').each(function() {
        const _inputElement = $(this);
        const _inputParent = _inputElement.parent();
        const _inputDatePicker = $('<div class="input-date-picker dropdown-menu"></div>');
        
        _inputParent.append(_inputDatePicker)
        _inputElement.attr('data-reference', 'parent');
        _inputElement.mask('00/00/0000');
        _inputElement.dropdown({
            display: 'dynamic',
            flip: false
        });

        _inputDatePicker.datePicker({
            onDayClick: onDayClick
        });

        _inputParent.on('show.bs.dropdown', function() {
            const _inputCurrentDate = readCurrentDate(_inputElement);

            if(_inputCurrentDate == null) {
                return;
            }

            const _datePickerConfig = _inputDatePicker.data('config');
    
            if(_datePickerConfig.firstDay > _inputCurrentDate || _datePickerConfig.lastDay < _inputCurrentDate) {
                _inputDatePicker.datePicker({
                    onDayClick: onDayClick,
                    referenceDate: _inputCurrentDate
                });
            }
        })
    });

    function onDayClick(eventData, calendarElement) {
        var _inputElement = calendarElement.parent().find('input.date-picker');

        _inputElement
            .val(eventData.data.date.format({ type: 'pt-br' }))
            .trigger('change');
        _inputElement
            .parent()
            .find('.input-date-picker.dropdown-menu.show')
            .removeClass('show');
    }

    function readCurrentDate(inputElement) {
        const _inputStringDate = inputElement.val();

        if(!_inputStringDate.isValidDate()) {
            return;
        }
        
        return _inputStringDate.toDate({ type: 'pt-br' });
    }
}

function buildDatePickerElements(container) {
    container.find('.date-picker:not(input)').each(function() {
        $(this).datePicker();
    });
}

$('body').on('keyup', function(event) {
    if(event?.originalEvent?.keyCode == '27') {
        $('.input-date-picker.dropdown-menu.show').removeClass('show');
    }
});

$(document).on('click', function (event) {
    const _openedInputDatePickerSelector = '.input-date-picker.dropdown-menu.show';
    const _targetElement = $(event.target);
    const _hideOpenedInputDatePicker = (
            !_targetElement.is(_openedInputDatePickerSelector)
        &&  !_targetElement.closest(_openedInputDatePickerSelector).length > 0
        &&  !(_targetElement.is('.button-last-month') || _targetElement.is('.button-next-month'))
        &&  !(_targetElement.parent().is('.button-last-month') || _targetElement.parent().is('.button-next-month'))
    );

    if (_hideOpenedInputDatePicker) {
        $(_openedInputDatePickerSelector).removeClass('show');
    }
});