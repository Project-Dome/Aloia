var _allData        = [];
var _sortCol         = null;
var _sortDir         = 'asc';
var _currentPage      = 1;
var _pageSize         = 25;
var _selectedIds       = {};   // { invoiceInternalId: true }
var _currentCustomerId  = null;
var _currentCustomerEmail = '';

$(document).ready(function () {
    loadCustomerList();

    $('#customerSelect').on('change', handleCustomerChange);
    $('#btn_search').on('click', handleSearch);
    $('#chkSelectAll').on('change', handleSelectAll);
    $('#btn_preview_email').on('click', handlePreviewEmail);
    $('#btn_send_email').on('click', handleSendEmail);
    $('#btn_export_excel').on('click', exportToExcel);
    $('#btn_export_pdf').on('click', exportToPDF);

    $('#page-size-select').on('change', function () {
        _pageSize = parseInt($(this).val()) || 25;
        _currentPage = 1;
        renderCurrentPage();
    });
    $('#btn-first-page').on('click', function () { goToPage(1); });
    $('#btn-prev-page').on('click',  function () { goToPage(_currentPage - 1); });
    $('#btn-next-page').on('click',  function () { goToPage(_currentPage + 1); });
    $('#btn-last-page').on('click',  function () { goToPage(Math.ceil(_allData.length / _pageSize)); });

    $('#pd-data-table thead th.sortable').on('click', function () {
        var col = $(this).data('col');
        if (_sortCol === col) { _sortDir = _sortDir === 'asc' ? 'desc' : 'asc'; }
        else { _sortCol = col; _sortDir = 'asc'; }
        $('#pd-data-table thead th').removeClass('sort-asc sort-desc');
        $(this).addClass(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        $(this).find('.sort-icon').text(_sortDir === 'asc' ? '↑' : '↓');
        sortData();
        _currentPage = 1;
        renderCurrentPage();
    });
});

// ---------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------
function loadCustomerList() {
    callSuitelet({ action: 'listCustomers' }, function (resp) {
        if (resp.status !== 200) { showErrorModal(resp.message); return; }
        var $sel = $('#customerSelect');
        (resp.data || []).forEach(function (c) {
            $sel.append('<option value="' + c.id + '" data-email="' + escHtml(c.email || '') + '">' + escHtml(c.name) + '</option>');
        });
    });
}

function handleCustomerChange() {
    var $opt = $('#customerSelect option:selected');
    _currentCustomerId = $(this).val();
    _currentCustomerEmail = $opt.data('email') || '';

    $('#customerInvoiceEmail').val(_currentCustomerEmail);
    updateEmailBadge(_currentCustomerEmail);

    $('#btn_search').prop('disabled', !_currentCustomerId);
    resetTable();
    loadHistory(_currentCustomerId);
}

function updateEmailBadge(email) {
    var $badge = $('#emailBadge');
    if (!email) {
        $badge.attr('class', 'email-badge email-badge-empty').text('VAZIO');
        return;
    }
    var isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (isValid) $badge.attr('class', 'email-badge email-badge-valid').text('VALID');
    else $badge.attr('class', 'email-badge email-badge-invalid').text('INVALID');
}

// ---------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------
function handleSearch() {
    if (!_currentCustomerId) return;

    if (!_currentCustomerEmail) {
        showErrorModal('Este cliente não possui o campo Customer Invoice Email preenchido. Preencha o cadastro do cliente antes de enviar invoices.');
    }

    setLoadingState(true);
    _selectedIds = {};

    callSuitelet({ action: 'searchInvoices', customerId: _currentCustomerId }, function (resp) {
        setLoadingState(false);
        if (resp.status !== 200) { showErrorModal(resp.message); return; }
        _allData = resp.data || [];
        _currentPage = 1; _sortCol = null; _sortDir = 'asc';
        $('#pd-data-table thead th').removeClass('sort-asc sort-desc');
        $('#pd-data-table thead th .sort-icon').text('↕');
        $('#tableSubtitle').text(_allData.length ? '— ' + _allData.length + ' em aberto' : '');
        renderCurrentPage();
        updateActionBar();
        $('#export-bar').css('display', _allData.length ? 'flex' : 'none');
    });
}

function resetTable() {
    _allData = [];
    _selectedIds = {};
    $('#tableSubtitle').text('');
    $('#export-bar').hide();
    $('#pd-table-footer').hide();
    $('#pagination-bar').hide();
    $('#pd-data-table tbody').html(
        '<tr><td colspan="9" class="text-center text-muted py-5">' +
        '<i class="fa fa-search fa-2x mb-2 d-block" style="color:var(--pd-accent);"></i>' +
        'Selecione um cliente e clique em Search para visualizar as invoices em aberto.</td></tr>'
    );
    updateActionBar();
}

function setLoadingState(isLoading) {
    var $btn = $('#btn_search');
    var $tbody = $('#pd-data-table tbody');
    if (isLoading) {
        $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Buscando...');
        $tbody.html('<tr><td colspan="9" class="text-center text-muted py-4"><i class="fa fa-spin fa-spinner text-info"></i> Buscando invoices...</td></tr>');
    } else {
        $btn.prop('disabled', false).html('<i class="fa fa-search"></i> Search');
    }
}

// ---------------------------------------------------------------------
// Sort / paginate / render
// ---------------------------------------------------------------------
function sortData() {
    if (!_sortCol) return;
    _allData.sort(function (a, b) {
        var av = a[_sortCol]; var bv = b[_sortCol];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return _sortDir === 'asc' ? -1 : 1;
        if (av > bv) return _sortDir === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderCurrentPage() {
    var total = _allData.length;
    var maxPage = Math.max(1, Math.ceil(total / _pageSize));
    if (_currentPage > maxPage) _currentPage = maxPage;
    var start = (_currentPage - 1) * _pageSize;
    var end = Math.min(start + _pageSize, total);

    populateResultsTable(_allData.slice(start, end));

    if (total === 0) { $('#pagination-bar').hide(); $('#pd-table-footer').hide(); return; }

    $('#pagination-bar').show();
    $('#pagination-info').text('Exibindo ' + (start + 1) + '–' + end + ' de ' + total + ' registro(s)');
    $('#btn-first-page').prop('disabled', _currentPage === 1);
    $('#btn-prev-page').prop('disabled', _currentPage === 1);
    $('#btn-next-page').prop('disabled', _currentPage === maxPage);
    $('#btn-last-page').prop('disabled', _currentPage === maxPage);

    var pagesHtml = '';
    var startPage = Math.max(1, _currentPage - 2);
    var endPage = Math.min(maxPage, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    for (var p = startPage; p <= endPage; p++) {
        pagesHtml += '<button class="btn-page' + (p === _currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    $('#pagination-pages').html(pagesHtml);
    $('#pagination-pages').off('click', '.btn-page').on('click', '.btn-page', function () {
        goToPage(parseInt($(this).data('page')));
    });

    updateFooterTotals();
    if (typeof window.adjustTableHeight === 'function') setTimeout(window.adjustTableHeight, 50);
}

function goToPage(page) {
    var maxPage = Math.max(1, Math.ceil(_allData.length / _pageSize));
    _currentPage = Math.max(1, Math.min(page, maxPage));
    renderCurrentPage();
}

function updateFooterTotals() {
    if (!_allData.length) { $('#pd-table-footer').hide(); return; }
    var totalAll = _allData.reduce(function (sum, r) { return sum + (parseFloat(r.amount) || 0); }, 0);
    $('#footerTotal').text('Total em aberto: ' + formatCurrency(totalAll));
    $('#pd-table-footer').show();
}

function populateResultsTable(data) {
    var $tbody = $('#pd-data-table tbody');
    $tbody.empty();
    if (!data || !data.length) {
        $tbody.html('<tr><td colspan="9" class="text-center text-muted py-4">Nenhuma invoice em aberto para este cliente.</td></tr>');
        return;
    }
    data.forEach(function (row) {
        var checked = _selectedIds[row.id] ? 'checked' : '';
        var statusClass = row.status === 'Overdue' ? 'badge-overdue' : (row.status === 'Paid' ? 'badge-ok' : 'badge-open');
        $tbody.append(
            '<tr class="summary-row' + (checked ? ' row-selected' : '') + '" data-id="' + row.id + '">' +
            '<td><input type="checkbox" class="rowCheck" data-id="' + row.id + '" ' + checked + ' /></td>' +
            '<td><a href="/app/accounting/transactions/custinvc.nl?id=' + row.id + '" target="_blank">' + escHtml(row.tranid) + '</a></td>' +
            '<td>' + escHtml(row.trandate) + '</td>' +
            '<td>' + escHtml(row.duedate) + '</td>' +
            '<td class="td-num">' + formatCurrency(row.amount) + '</td>' +
            '<td><span class="' + statusClass + '">' + escHtml(row.status) + '</span></td>' +
            '<td>' + docBadge(row.hasAta106) + '</td>' +
            '<td>' + docBadge(row.hasCoc) + '</td>' +
            '<td>' + docBadge(row.hasPackingList) + '</td>' +
            '</tr>'
        );
    });
    $('.rowCheck').on('change', handleRowCheck);
}

function docBadge(available) {
    return available ? '<span class="badge-ok">✓ Available</span>' : '<span class="badge-none">— None</span>';
}

// ---------------------------------------------------------------------
// Seleção
// ---------------------------------------------------------------------
function handleRowCheck() {
    var id = $(this).data('id');
    if ($(this).is(':checked')) { _selectedIds[id] = true; $(this).closest('tr').addClass('row-selected'); }
    else { delete _selectedIds[id]; $(this).closest('tr').removeClass('row-selected'); }
    updateActionBar();
}

function handleSelectAll() {
    var checkAll = $(this).is(':checked');
    _allData.forEach(function (row) {
        if (checkAll) _selectedIds[row.id] = true;
        else delete _selectedIds[row.id];
    });
    renderCurrentPage();
    updateActionBar();
}

function updateActionBar() {
    var count = Object.keys(_selectedIds).length;
    $('#selectedCount').text(count + ' invoice(s) selecionada(s)');
    $('#btn_preview_email').prop('disabled', count === 0);
    $('#btn_send_email').prop('disabled', count === 0 || !_currentCustomerEmail);
}

// ---------------------------------------------------------------------
// Preview / Send
// ---------------------------------------------------------------------
function handlePreviewEmail() {
    var ids = Object.keys(_selectedIds);
    if (!ids.length) return;
    callSuitelet({ action: 'previewEmail', customerId: _currentCustomerId, invoiceIds: ids }, function (resp) {
        if (resp.status !== 200) { showErrorModal(resp.message); return; }
        var win = window.open('', '_blank');
        if (win) { win.document.write(resp.data.previewHtml); win.document.close(); }
    });
}

function handleSendEmail() {
    var ids = Object.keys(_selectedIds);
    if (!ids.length) return;

    var confirmMsg = 'Enviar ' + ids.length + ' invoice(s) para ' + _currentCustomerEmail + '?';
    if (window.confirm(confirmMsg)) {
        doSendEmail(ids);
    }
}

function doSendEmail(ids) {
    $('#btn_send_email').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Enviando...');
    callSuitelet({ action: 'sendEmail', customerId: _currentCustomerId, invoiceIds: ids }, function (resp) {
        $('#btn_send_email').html('<i class="fa fa-paper-plane"></i> Send Email');
        if (resp.status !== 200) { showErrorModal(resp.message); updateActionBar(); return; }

        var failed = (resp.data && resp.data.failed) || [];
        if (failed.length) {
            showErrorModal('Envio parcial: ' + (resp.data.sent || []).length + ' invoice(s) enviada(s), ' +
                failed.length + ' falharam (' + failed.map(function (f) { return f.tranid + ': ' + f.error; }).join('; ') + ').');
        } else {
            alert('E-mail enviado com sucesso.');
        }

        _selectedIds = {};
        handleSearch();
        loadHistory(_currentCustomerId);
    });
}

// ---------------------------------------------------------------------
// Communication History
// ---------------------------------------------------------------------
function loadHistory(customerId) {
    if (!customerId) {
        $('#historyBody').html('<div class="history-empty">Filtre um cliente para visualizar o histórico de envios.</div>');
        return;
    }
    callSuitelet({ action: 'loadHistory', customerId: customerId }, function (resp) {
        if (resp.status !== 200) { $('#historyBody').html('<div class="history-empty">Erro ao carregar histórico.</div>'); return; }
        var rows = resp.data || [];
        if (!rows.length) {
            $('#historyBody').html('<div class="history-empty">Nenhum e-mail registrado ainda para este cliente.</div>');
            return;
        }
        var html = rows.map(function (r) {
            return '<div class="history-row"><span>' + escHtml(r.subject) + ' — <strong>' + escHtml(r.tranid) + '</strong></span>' +
                '<span style="color:#888;">' + escHtml(r.date) + '</span></div>';
        }).join('');
        $('#historyBody').html(html);
    });
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------
function exportToExcel() {
    if (!_allData.length) return;
    var rows = [['Invoice #', 'Date', 'Due Date', 'Amount', 'Status', 'ATA-106', 'COC', 'Packing List']];
    _allData.forEach(function (r) {
        rows.push([r.tranid, r.trandate, r.duedate, r.amount, r.status,
            r.hasAta106 ? 'Available' : 'None', r.hasCoc ? 'Available' : 'None', r.hasPackingList ? 'Available' : 'None']);
    });
    var csvContent = rows.map(function (row) {
        return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'invoices-' + (_currentCustomerId || 'export') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportToPDF() {
    if (!_allData.length) return;
    var rowsHtml = _allData.map(function (r) {
        return '<tr><td>' + escHtml(r.tranid) + '</td><td>' + escHtml(r.trandate) + '</td><td>' + escHtml(r.duedate) + '</td>' +
            '<td>' + formatCurrency(r.amount) + '</td><td>' + escHtml(r.status) + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoices</title>' +
        '<style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}' +
        'h1{font-size:16px;color:#1c2b3a;}table{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
        'thead th{background:#1c2b3a;color:#fff;padding:8px;text-align:left;font-size:10px;}' +
        'tbody td{padding:6px 8px;border-bottom:1px solid #eee;font-size:10px;}</style></head><body>' +
        '<h1>Invoices — ' + escHtml(_currentCustomerEmail) + '</h1>' +
        '<table><thead><tr><th>Invoice #</th><th>Date</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody></table></body></html>';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var win = window.open(url, '_blank');
    if (win) setTimeout(function () { win.print(); }, 800);
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function callSuitelet(payload, onSuccess) {
    $.ajax({
        url: window.location.href, type: 'POST', contentType: 'application/json',
        data: JSON.stringify(payload),
        success: function (response) { onSuccess(response); },
        error: function () { showErrorModal('Ocorreu um erro de comunicação com o servidor.'); }
    });
}

function formatCurrency(value) {
    var num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (typeof num !== 'number' || isNaN(num)) num = 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showErrorModal(message) {
    alert(message);
}
