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

    if($.fn.calendar != null) {
        return;
    }

    $.fn.calendar = function(options) {
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
                    throw `Not calendar implementation for element of this type: ${_elementTag}`
                }
        }
    }

    function setupOptionsFromElement(options, element) {
        let _optionsMap = {
            'on-ready': 'onCalendarReady'
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

        element.html(_calendarHtml);

        setupEvents(element, options, _config.referenceDate);

        if(options?.onCalendarReady) {
            window[options?.onCalendarReady](element, _config);
        }
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
    }

    function buildCalendarHtml(config, options) {
        const _translation = DEFAULT_TRANSLATION;
        const _year = config.firstDay.getFullYear();
        const _month = config.firstDay.getMonth();
        const _monthName = _translation.months[_month].name;
        
        return (
            [
                '<div>',
                    `<h5 class="text-info" style="margin-bottom: 20px">${_monthName}<span class="text-muted">/</span>${_year}</h5>`,
                    `<table class="table table-calendar table-bordered" style="height: 540px; margin-bottom: 0px;">`,
                        `<thead>`,
                            `<tr>`,
                                `<th class="weekday text-center">${_translation.weeks.sunday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.monday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.tuesday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.wednesday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.thursday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.friday.abbreviation}</th>`,
                                `<th class="weekday text-center">${_translation.weeks.saturday.abbreviation}</th>`,
                            `</tr>`,
                        `</thead>`,
                        `<tbody>`,
                            buildWeeksHtml(config.weeks, options),
                        `</tbody>`,
                    `</table>`,
                '</div>'
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
                        [
                            `<td class="day ${_additionalClass.join(' ')}" data-day="${_day}" data-month="${_month}">`,
                                `<span class="date">${_day}</span>`,
                                `<div class="value text-center text-muted"></div>`,
                            `</td>`
                        ].join('')
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
    buildCalendarElements($('body'))
})

function buildCalendarElements(container) {
    container.find('.calendar').each(function() {
        $(this).calendar();
    });
}