/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/log',
        'N/record',
        'N/search',
        'N/format',
        'N/runtime',
        'N/query',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],

    function (
        log,
        record,
        search,
        format,
        runtime,
        query,

        search_util,
        record_util
    ) {

        const TYPE = 'salesorder';

        const FIELDS = {
            internalId: { name: 'internalid' },
            buyer: { name: 'custbody_aae_buyer' },
            status: { name: 'status' }
        };

        const EMPLOYEE_FIELDS = {
            buyerFlag: 'custentity_pd_pow_buyer',
            onLeave: 'custentity_pd_pow_aae_onleave',
            shiftStart: 'custentity_pd_pow_shift_start',
            shiftEnd: 'custentity_pd_pow_shift_end',
            lastSOAssignment: 'custentity_pd_last_so_assignment',
            timezone: 'custentity_pd_pow_timezone'
        };

        const URGENCY_AOG = '2';

        // ─────────────────────────────────────────────
        // PUBLIC
        // ─────────────────────────────────────────────

        function readData(options) {
            try {
                let _salesOrderData = record_util.handler(options).data({ fields: FIELDS });
                log.debug({ title: 'readData - salesOrderData', details: _salesOrderData });
                return _salesOrderData;
            } catch (error) {
                log.error({ title: 'readData - Error processing', details: error });
            }
        }

        function assignBuyerToSO(idSalesOrder) {
            try {
                // Read SO urgency
                let _soUrgency = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: idSalesOrder,
                    columns: ['custbody_aae_urgency_order']
                });

                let _urgencyRaw = _soUrgency && _soUrgency.custbody_aae_urgency_order;
                let _urgencyValue = null;
                if (Array.isArray(_urgencyRaw) && _urgencyRaw.length > 0) {
                    _urgencyValue = _urgencyRaw[0].value ? String(_urgencyRaw[0].value) : String(_urgencyRaw[0]);
                } else if (_urgencyRaw) {
                    _urgencyValue = String(_urgencyRaw);
                }

                let _isAOG = (_urgencyValue === URGENCY_AOG);

                log.debug('assignBuyerToSO - urgency', {
                    soId: idSalesOrder,
                    urgencyValue: _urgencyValue,
                    isAOG: _isAOG
                });

                // Load all eligible buyers (active, not on leave)
                let _allEligible = getEligibleBuyers();

                if (!_allEligible || _allEligible.length === 0) {
                    log.debug({
                        title: 'assignBuyerToSO - No eligible buyers',
                        details: `No eligible buyers found for Sales Order ${idSalesOrder}`
                    });
                    return null;
                }

                // Build pool depending on urgency
                let _pool = _isAOG
                    ? prepareAOGPool(_allEligible)
                    : prepareRoutinePool(_allEligible);

                if (!_pool || _pool.length === 0) {
                    log.debug({
                        title: 'assignBuyerToSO - No buyers after rules',
                        details: { soId: idSalesOrder, isAOG: _isAOG }
                    });
                    return null;
                }

                assignBuyerToLine(idSalesOrder, _pool, _isAOG);

                log.debug({
                    title: 'assignBuyerToSO - Distribution complete',
                    details: `Sales Order ${idSalesOrder} - lines distributed`
                });

                return true;

            } catch (error) {
                log.error({ title: 'assignBuyerToSO - Error processing', details: error });
                return null;
            }
        }

        // ─────────────────────────────────────────────
        // ELIGIBLE BUYERS — base list (no shift filter)
        // ─────────────────────────────────────────────

        function getEligibleBuyers() {
            try {
                let _employeeSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        [EMPLOYEE_FIELDS.buyerFlag, 'is', 'T'],
                        'AND',
                        [EMPLOYEE_FIELDS.onLeave, 'is', 'F'],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        'internalid',
                        'entityid',
                        EMPLOYEE_FIELDS.shiftStart,
                        EMPLOYEE_FIELDS.shiftEnd,
                        EMPLOYEE_FIELDS.lastSOAssignment,
                        EMPLOYEE_FIELDS.timezone
                    ]
                });

                let _allBuyers = [];
                let _timezoneMap = getTimezoneOlsonMap();

                _employeeSearch.run().each(function (result) {
                    let _id = result.getValue('internalid');
                    let _name = result.getValue('entityid');
                    let _shiftStart = result.getValue(EMPLOYEE_FIELDS.shiftStart) || '';
                    let _shiftEnd = result.getValue(EMPLOYEE_FIELDS.shiftEnd) || '';

                    let _lastSOAssignmentRaw = result.getValue(EMPLOYEE_FIELDS.lastSOAssignment) || '';
                    let _lastSOAssignment = null;
                    if (_lastSOAssignmentRaw) {
                        try {
                            let _parsed = format.parse({ value: _lastSOAssignmentRaw, type: format.Type.DATETIMETZ });
                            _lastSOAssignment = (_parsed instanceof Date) ? _parsed.toISOString() : null;
                        } catch (e) {
                            _lastSOAssignment = null;
                        }
                    }

                    let _startMin = parseTimeToMinutes(_shiftStart);
                    let _endMin = parseTimeToMinutes(_shiftEnd);
                    let _timezoneKey = parseInt(result.getValue(EMPLOYEE_FIELDS.timezone), 10) || null;

                    if (!_timezoneKey) {
                        _timezoneKey = parseInt(runtime.getCurrentUser().getPreference({ name: 'TIMEZONE' }), 10) || null;
                    }

                    let _timezoneId = _timezoneKey ? (_timezoneMap[_timezoneKey] || null) : null;

                    _allBuyers.push({
                        id: _id,
                        name: _name,
                        lastSOAssignment: _lastSOAssignment,
                        shiftStartMin: _startMin,
                        shiftEndMin: _endMin,
                        timezoneId: _timezoneId
                    });

                    return true;
                });

                log.debug({
                    title: 'getEligibleBuyers - buyers loaded',
                    details: { total: _allBuyers.length }
                });

                return _allBuyers;

            } catch (error) {
                log.error({ title: 'getEligibleBuyers - Error processing', details: error });
                return [];
            }
        }

        // ─────────────────────────────────────────────
        // AOG POOL
        // Filter: in shift + no AOG without PO in last 60min
        // Pick: oldest lastAOGAssignment
        // ─────────────────────────────────────────────

        function prepareAOGPool(buyers) {
            try {
                // 1. Filter by shift
                let _inShift = buyers.filter(function (b) {
                    if (b.shiftStartMin === null || b.shiftEndMin === null) return true;
                    let _nowMin = getNowMinutesInTimezone(b.timezoneId);
                    return isNowInShift(_nowMin, b.shiftStartMin, b.shiftEndMin);
                });

                log.debug('prepareAOGPool - in shift', { count: _inShift.length });

                if (_inShift.length === 0) return [];

                // 2. Remove blocked (AOG without PO in last 60min)
                let _sixtyMinAgo = new Date(new Date().getTime() - 60 * 60 * 1000);

                let _filtered = [];
                let _blockedCount = 0;

                for (let i = 0; i < _inShift.length; i++) {
                    let _buyer = _inShift[i];
                    let _blocked = isBuyerBlockedForAOG(_buyer.id, _sixtyMinAgo);

                    log.debug('prepareAOGPool - buyer check', {
                        buyerId: _buyer.id,
                        buyerName: _buyer.name,
                        blocked: _blocked
                    });

                    if (_blocked) {
                        _blockedCount++;
                    } else {
                        _filtered.push(_buyer);
                    }
                }

                // Fallback: if all blocked, use full in-shift list
                if (_blockedCount === _inShift.length) {
                    log.debug('prepareAOGPool - all blocked, fallback to full in-shift list', {
                        total: _inShift.length
                    });
                    return _inShift.map(function (b) {
                        return Object.assign({}, b, { lastAOGAssignment: getLastAOGAssignmentForBuyer(b.id) });
                    });
                }

                // 3. Enrich with lastAOGAssignment for pick
                let _enriched = _filtered.map(function (b) {
                    return Object.assign({}, b, { lastAOGAssignment: getLastAOGAssignmentForBuyer(b.id) });
                });

                log.debug('prepareAOGPool - result', {
                    totalInShift: _inShift.length,
                    blocked: _blockedCount,
                    available: _enriched.length
                });

                return _enriched;

            } catch (error) {
                log.error('prepareAOGPool - error', error);
                return buyers || [];
            }
        }

        function isBuyerBlockedForAOG(employeeId, sixtyMinAgo) {
            try {
                let _soSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [
                        ['custcol_pd_buyer_purchorder_initial', 'anyof', employeeId],
                        'AND',
                        ['custcol_aae_purchaseorder', 'anyof', '@NONE@'],
                        'AND',
                        ['custcol_pd_pow_po_processed', 'is', 'F'],
                        'AND',
                        ['custcol_pd_cso_dont_create_purchreq', 'is', 'F'],
                        'AND',
                        ['custbody_aae_urgency_order', 'anyof', URGENCY_AOG],
                        'AND',
                        [['custcol_aae_line_status', 'anyof', '@NONE@'], 'OR', ['custcol_aae_line_status', 'anyof', '4']],
                        'AND',
                        ['mainline', 'is', 'F']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'tranid' }),
                        search.createColumn({ name: 'line' }),
                        search.createColumn({ name: 'custcol_pd_buyer_purchorder_initial' }),
                        search.createColumn({ name: 'custcol_pd_pow_assignment_timestamp' })
                    ]
                });

                let _pendingAOGs = [];
                _soSearch.run().each(function (r) {
                    let _rawTs = r.getValue('custcol_pd_pow_assignment_timestamp');
                    let _withinWindow = false;
                    if (_rawTs) {
                        try {
                            let _parsed = format.parse({ value: _rawTs, type: format.Type.DATETIMETZ });
                            _withinWindow = (_parsed instanceof Date && _parsed.getTime() >= sixtyMinAgo.getTime());
                        } catch (e) { /* ignore */ }
                    }
                    if (_withinWindow) {
                        _pendingAOGs.push({
                            soId: r.getValue('internalid'),
                            soNumber: r.getValue('tranid'),
                            lineId: r.getValue('line'),
                            buyerName: r.getText('custcol_pd_buyer_purchorder_initial'),
                            assignmentTimestamp: _rawTs
                        });
                    }
                    return true;
                });

                let _blocked = (_pendingAOGs.length > 0);

                log.debug('isBuyerBlockedForAOG', {
                    employeeId: employeeId,
                    blocked: _blocked,
                    pendingAOGs: _pendingAOGs
                });

                return _blocked;

            } catch (error) {
                log.error('isBuyerBlockedForAOG - error', error);
                return false;
            }
        }

        function getLastAOGAssignmentForBuyer(employeeId) {
            try {
                let _results = query.runSuiteQL({
                    query: `
                        SELECT TO_CHAR(MAX(tl.custcol_pd_pow_assignment_timestamp), 'YYYY-MM-DD HH24:MI:SS') AS last_aog_ts
                        FROM transactionline tl
                        INNER JOIN transaction t ON t.id = tl.transaction
                        WHERE t.type = 'SalesOrd'
                        AND tl.mainline = 'F'
                        AND tl.custcol_pd_buyer_purchorder_initial = ?
                        AND t.custbody_aae_urgency_order = ?
                        AND tl.custcol_pd_pow_assignment_timestamp IS NOT NULL
                    `,
                    params: [employeeId, parseInt(URGENCY_AOG, 10)]
                }).asMappedResults();

                if (!_results || _results.length === 0 || !_results[0].last_aog_ts) return null;

                let _iso = _results[0].last_aog_ts.replace(' ', 'T') + 'Z';
                let _date = new Date(_iso);
                return isNaN(_date.getTime()) ? null : _date.toISOString();

            } catch (error) {
                log.error('getLastAOGAssignmentForBuyer - error', error);
                return null;
            }
        }

        function pickBuyerForAOG(buyers) {
            try {
                if (!buyers || buyers.length === 0) return null;

                // Sort by lastAOGAssignment ascending (oldest first, null = never = highest priority)
                let _sorted = buyers.slice().sort(function (a, b) {
                    if (!a.lastAOGAssignment && !b.lastAOGAssignment) return 0;
                    if (!a.lastAOGAssignment) return -1;
                    if (!b.lastAOGAssignment) return 1;
                    return new Date(a.lastAOGAssignment).getTime() - new Date(b.lastAOGAssignment).getTime();
                });

                let _oldestTime = _sorted[0].lastAOGAssignment
                    ? new Date(_sorted[0].lastAOGAssignment).getTime()
                    : null;

                let _candidates = _sorted.filter(function (b) {
                    if (!_oldestTime && !b.lastAOGAssignment) return true;
                    return b.lastAOGAssignment && new Date(b.lastAOGAssignment).getTime() === _oldestTime;
                });

                let _idx = Math.floor(Math.random() * _candidates.length);

                log.debug('pickBuyerForAOG - chosen', {
                    candidates: _candidates.map(function (b) {
                        return { id: b.id, name: b.name, lastAOGAssignment: b.lastAOGAssignment };
                    }),
                    chosen: _candidates[_idx]
                });

                return _candidates[_idx];

            } catch (error) {
                log.error('pickBuyerForAOG - error', error);
                return null;
            }
        }

        // ─────────────────────────────────────────────
        // ROUTINE / CRITICAL POOL
        // No shift filter. Queue = lines assigned in last 2h without PO.
        // Pick: smallest queue → oldest lastSOAssignment → random
        // ─────────────────────────────────────────────

        function prepareRoutinePool(buyers) {
            try {
                let _twoHoursAgo = new Date(new Date().getTime() - 2 * 60 * 60 * 1000);

                let _enriched = buyers.map(function (b) {
                    let _queueCount = getBuyerQueueCount(b.id, _twoHoursAgo);
                    return Object.assign({}, b, { queueCount: _queueCount });
                });

                log.debug('prepareRoutinePool - queue counts', {
                    buyers: _enriched.map(function (b) {
                        return { id: b.id, name: b.name, queueCount: b.queueCount };
                    })
                });

                return _enriched;

            } catch (error) {
                log.error('prepareRoutinePool - error', error);
                return buyers || [];
            }
        }

        function getBuyerQueueCount(employeeId, twoHoursAgo) {
            try {
                let _twoHoursAgoStr = twoHoursAgo.toISOString().replace('T', ' ').substring(0, 19);

                let _results = query.runSuiteQL({
                    query: `
                        SELECT COUNT(*) AS cnt
                        FROM transactionline tl
                        INNER JOIN transaction t ON t.id = tl.transaction
                        WHERE t.type = 'SalesOrd'
                        AND tl.mainline = 'F'
                        AND tl.custcol_pd_buyer_purchorder_initial = ?
                        AND tl.custcol_aae_purchaseorder IS NULL
                        AND (tl.custcol_pd_pow_po_processed = 'F' OR tl.custcol_pd_pow_po_processed IS NULL)
                        AND (tl.custcol_pd_cso_dont_create_purchreq = 'F' OR tl.custcol_pd_cso_dont_create_purchreq IS NULL)
                        AND (tl.custcol_aae_line_status IS NULL OR tl.custcol_aae_line_status = 4)
                        AND tl.custcol_pd_pow_assignment_timestamp >= TO_TIMESTAMP(?, 'YYYY-MM-DD HH24:MI:SS')
                    `,
                    params: [employeeId, _twoHoursAgoStr]
                }).asMappedResults();

                let _count = (_results && _results.length > 0) ? (parseInt(_results[0].cnt, 10) || 0) : 0;

                log.debug('getBuyerQueueCount', { employeeId: employeeId, count: _count });

                return _count;

            } catch (error) {
                log.error('getBuyerQueueCount - error', error);
                return 0;
            }
        }

        function pickBuyerForRoutine(buyers) {
            try {
                if (!buyers || buyers.length === 0) return null;

                // 1st: smallest queue
                let _minQueue = Number.MAX_SAFE_INTEGER;
                buyers.forEach(function (b) {
                    if (b.queueCount < _minQueue) _minQueue = b.queueCount;
                });

                let _byQueue = buyers.filter(function (b) {
                    return b.queueCount === _minQueue;
                });

                // 2nd: oldest lastSOAssignment
                let _sorted = _byQueue.slice().sort(function (a, b) {
                    if (!a.lastSOAssignment && !b.lastSOAssignment) return 0;
                    if (!a.lastSOAssignment) return -1;
                    if (!b.lastSOAssignment) return 1;
                    return new Date(a.lastSOAssignment).getTime() - new Date(b.lastSOAssignment).getTime();
                });

                let _oldestTime = _sorted[0].lastSOAssignment
                    ? new Date(_sorted[0].lastSOAssignment).getTime()
                    : null;

                let _candidates = _sorted.filter(function (b) {
                    if (!_oldestTime && !b.lastSOAssignment) return true;
                    return b.lastSOAssignment && new Date(b.lastSOAssignment).getTime() === _oldestTime;
                });

                // 3rd: random
                let _idx = Math.floor(Math.random() * _candidates.length);

                log.debug('pickBuyerForRoutine - chosen', {
                    minQueue: _minQueue,
                    candidates: _candidates.map(function (b) {
                        return { id: b.id, name: b.name, queueCount: b.queueCount, lastSOAssignment: b.lastSOAssignment };
                    }),
                    chosen: _candidates[_idx]
                });

                return _candidates[_idx];

            } catch (error) {
                log.error('pickBuyerForRoutine - error', error);
                return null;
            }
        }

        // ─────────────────────────────────────────────
        // ASSIGN BUYER TO LINE
        // ─────────────────────────────────────────────

        function assignBuyerToLine(idSalesOrder, buyers, isAOG) {
            try {
                if (!idSalesOrder || !buyers || buyers.length === 0) return;

                let _salesOrderRec = record.load({
                    type: record.Type.SALES_ORDER,
                    id: idSalesOrder,
                    isDynamic: true
                });

                let _lineCount = _salesOrderRec.getLineCount({ sublistId: 'item' });
                if (!_lineCount || _lineCount === 0) return;

                let _buyerPool = buyers.map(function (b) { return Object.assign({}, b); });
                let _assignedBuyerIdsList = [];
                let _nowBase = new Date().getTime();
                let _offset = 0;

                for (let i = 0; i < _lineCount; i++) {

                    // Skip: do not create PO
                    let _skipLine = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'custcol_pd_cso_dont_create_purchreq', line: i
                    });
                    if (_skipLine === true || _skipLine === 'T') continue;

                    // Skip: line status not open
                    let _lineStatus = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'custcol_aae_line_status', line: i
                    });
                    if (_lineStatus && String(_lineStatus) !== '4') continue;

                    // Skip: zero quantity
                    let _quantity = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'quantity', line: i
                    });
                    if (!_quantity || parseFloat(_quantity) === 0) continue;

                    // Skip: PO already linked
                    let _linkedPO = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'custcol_aae_purchaseorder', line: i
                    });
                    let _createPO = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'createpo', line: i
                    });
                    if (_linkedPO || _createPO === true || _createPO === 'T') continue;

                    // Skip: buyer already assigned
                    let _existingBuyer = _salesOrderRec.getSublistValue({
                        sublistId: 'item', fieldId: 'custcol_pd_buyer_purchorder_initial', line: i
                    });
                    if (_existingBuyer) continue;

                    // Pick buyer
                    let _chosenBuyer = isAOG
                        ? pickBuyerForAOG(_buyerPool)
                        : pickBuyerForRoutine(_buyerPool);

                    if (!_chosenBuyer) continue;

                    // Set buyer and timestamp using dynamic mode
                    let _assignmentTime = new Date(_nowBase + _offset);

                    _salesOrderRec.selectLine({ sublistId: 'item', line: i });

                    _salesOrderRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_buyer_purchorder_initial',
                        value: _chosenBuyer.id
                    });

                    _salesOrderRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_assignment_timestamp',
                        value: _assignmentTime
                    });

                    _salesOrderRec.commitLine({ sublistId: 'item' });

                    // Update pool state
                    let _buyerInPool = _buyerPool.find(function (b) { return b.id === _chosenBuyer.id; });
                    if (_buyerInPool) {
                        let _isoStr = _assignmentTime.toISOString();
                        _buyerInPool.lastSOAssignment = _isoStr;
                        if (isAOG) {
                            _buyerInPool.lastAOGAssignment = _isoStr;
                        } else {
                            _buyerInPool.queueCount = (_buyerInPool.queueCount || 0) + 1;
                        }
                        _offset += 1000;
                    }

                    _assignedBuyerIdsList.push(_chosenBuyer.id);

                    log.debug({
                        title: 'assignBuyerToLine - Line assigned',
                        details: { line: i, buyerId: _chosenBuyer.id, isAOG: isAOG }
                    });
                }

                if (_assignedBuyerIdsList.length === 0) {
                    log.debug({
                        title: 'assignBuyerToLine - No lines to save',
                        details: { salesOrderId: idSalesOrder }
                    });
                    return;
                }

                try {
                    _salesOrderRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                } catch (saveError) {
                    log.error({
                        title: 'assignBuyerToLine - Save failed',
                        details: { salesOrderId: idSalesOrder, error: saveError.message || saveError }
                    });
                    return;
                }

                // Update lastSOAssignment on employee records
                let _uniqueBuyerIds = _assignedBuyerIdsList.filter(function (id, idx, arr) {
                    return arr.indexOf(id) === idx;
                });

                _uniqueBuyerIds.forEach(function (buyerId) {
                    let _poolEntry = _buyerPool.find(function (b) { return b.id === buyerId; });
                    let _timestamp = (_poolEntry && _poolEntry.lastSOAssignment)
                        ? new Date(_poolEntry.lastSOAssignment)
                        : new Date();
                    updateEmployeeLastSOAssignment(buyerId, _timestamp);
                });

                log.debug({
                    title: 'assignBuyerToLine - Complete',
                    details: { salesOrderId: idSalesOrder, buyersAssigned: _uniqueBuyerIds }
                });

            } catch (error) {
                log.error({ title: 'assignBuyerToLine - Error processing', details: error });
            }
        }

        // ─────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────

        function updateEmployeeLastSOAssignment(employeeId, timestamp) {
            try {
                if (!employeeId) return;
                let _timestamp = (timestamp instanceof Date) ? timestamp : new Date();

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: { custentity_pd_last_so_assignment: _timestamp },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });

                log.debug({
                    title: 'updateEmployeeLastSOAssignment - updated',
                    details: { employeeId: employeeId, lastAssignment: _timestamp }
                });

            } catch (error) {
                log.error({ title: 'updateEmployeeLastSOAssignment - Error processing', details: error });
            }
        }

        function parseTimeToMinutes(timeString) {
            try {
                if (!timeString) return null;
                let _cleanTime = ('' + timeString).trim();
                let _meridian = null;

                if (_cleanTime.toUpperCase().includes('AM') || _cleanTime.toUpperCase().includes('PM')) {
                    _meridian = _cleanTime.toUpperCase().includes('PM') ? 'PM' : 'AM';
                    _cleanTime = _cleanTime.replace(/AM|PM/i, '').trim();
                }

                let _timeParts = _cleanTime.split(':');
                let _hours = parseInt(_timeParts[0], 10) || 0;
                let _minutes = parseInt(_timeParts[1], 10) || 0;

                if (_meridian) {
                    if (_meridian === 'PM' && _hours < 12) _hours += 12;
                    if (_meridian === 'AM' && _hours === 12) _hours = 0;
                }

                return _hours * 60 + _minutes;

            } catch (error) {
                log.error({ title: 'parseTimeToMinutes - Error processing', details: error });
                return null;
            }
        }

        function isNowInShift(nowMin, startMin, endMin) {
            try {
                if (startMin === null || endMin === null) return true;
                if (startMin <= endMin) {
                    return nowMin >= startMin && nowMin <= endMin;
                } else {
                    return nowMin >= startMin || nowMin <= endMin;
                }
            } catch (error) {
                log.error({ title: 'isNowInShift - Error processing', details: error });
                return false;
            }
        }

        function getNowMinutesInTimezone(timezoneId) {
            try {
                let _tz = timezoneId
                    ? timezoneId
                    : runtime.getCurrentUser().getPreference({ name: 'TIMEZONE' });

                let _nowFormatted = format.format({
                    value: new Date(),
                    type: format.Type.DATETIME,
                    timezone: _tz
                });

                let _parts = _nowFormatted.split(' ');
                return parseTimeToMinutes(_parts[1] + ' ' + _parts[2]);

            } catch (e) {
                log.error('getNowMinutesInTimezone error', e);
                let _now = new Date();
                return _now.getHours() * 60 + _now.getMinutes();
            }
        }

        function getTimezoneOlsonMap() {
            try {
                let _results = query.runSuiteQL({
                    query: 'SELECT uniquekey, id FROM timezone'
                }).asMappedResults();

                let _map = {};
                _results.forEach(function (row) { _map[row.uniquekey] = row.id; });

                log.debug({ title: 'getTimezoneOlsonMap - built', details: { total: _results.length } });
                return _map;

            } catch (error) {
                log.error({ title: 'getTimezoneOlsonMap - Error processing', details: error });
                return {};
            }
        }

        // ─────────────────────────────────────────────
        // EXPORTS
        // ─────────────────────────────────────────────

        return {
            readData: readData,
            assignBuyerToSO: assignBuyerToSO,
            assignBuyerToLine: assignBuyerToLine,
            getEligibleBuyers: getEligibleBuyers
        };
    }
);