/* =========================================
   State
   ========================================= */
let todos = JSON.parse(localStorage.getItem('priorme_todos')) || [];
let currentView  = 'week';
let currentFilter = 'all';
let currentSort  = 'date-asc';
let sortKey = 'date';   // 'date' | 'name' | 'priority'
let sortDir = {};       // per-key direction: 'asc' | 'desc'
sortDir['date']     = 'asc';
sortDir['name']     = 'asc';
sortDir['priority'] = 'desc'; // high→low default
let selectedPriority = 'normal';
let isEditing    = false;
let detailTaskId = null;
let currentDate  = new Date();
currentDate.setHours(0, 0, 0, 0);

/* =========================================
   Priority Config
   ========================================= */
const PRIORITY_ORDER = { urgent: 5, important: 4, normal: 3, nice: 2, someday: 1 };
const PRIORITY_LABELS = {
    someday: 'Someday', nice: 'Nice to Have', normal: 'Normal',
    important: 'Important', urgent: 'URGENT!'
};

/* =========================================
   Init
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    // Build month DOW header
    const dowRow = document.getElementById('monthDowRow');
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
        const el = document.createElement('div');
        el.className = 'month-dow';
        el.textContent = d;
        dowRow.appendChild(el);
    });

    // Handle logo fallback
    const logo = document.querySelector('.brand-logo');
    const fb   = document.getElementById('brandIconFb');
    if (logo) {
        logo.addEventListener('error', () => {
            logo.style.display = 'none';
            if (fb) fb.style.display = 'flex';
        });
    }

    // Restore saved theme
    if (localStorage.getItem('priorme_theme') === 'light') {
        document.body.classList.add('light');
        updateThemeIcon(true);
    }

    switchMainView('week');
    updateSortUI();
});

/* =========================================
   Theme Toggle
   ========================================= */
function toggleTheme() {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('priorme_theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
}

/* =========================================
   Sidebar (hamburger)
   ========================================= */
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

/* =========================================
   View Switching
   ========================================= */
function switchMainView(view) {
    currentView = view;
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    document.querySelectorAll('.nav-btn[data-view]').forEach(b =>
        b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view-toggle-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.v === view));

    renderCurrentView();
}

function renderCurrentView() {
    updateTopbarTitle();
    if (currentView === 'day')   renderDayView();
    if (currentView === 'week')  renderWeekView();
    if (currentView === 'month') renderMonthView();
    if (currentView === 'list')  renderListView();
    save();
}

/* =========================================
   Navigation
   ========================================= */
function navigatePrev() {
    if (currentView === 'day')   currentDate.setDate(currentDate.getDate() - 1);
    if (currentView === 'week')  currentDate.setDate(currentDate.getDate() - 7);
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
    if (currentView === 'list')  return;
    renderCurrentView();
}

function navigateNext() {
    if (currentView === 'day')   currentDate.setDate(currentDate.getDate() + 1);
    if (currentView === 'week')  currentDate.setDate(currentDate.getDate() + 7);
    if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
    if (currentView === 'list')  return;
    renderCurrentView();
}

function goToToday() {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    renderCurrentView();
}

function updateTopbarTitle() {
    const el = document.getElementById('topbarTitle');
    if (currentView === 'day') {
        const isToday = isSameDay(currentDate, new Date());
        el.textContent = isToday
            ? 'Today — ' + currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else if (currentView === 'week') {
        const { start, end } = getWeekRange(currentDate);
        el.textContent = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            + ' – ' + end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (currentView === 'month') {
        el.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
        el.textContent = 'All Tasks';
    }
}

/* =========================================
   DAY VIEW
   ========================================= */
function renderDayView() {
    const header   = document.getElementById('dayViewHeader');
    const timeline = document.getElementById('dayTimeline');
    timeline.innerHTML = '';

    const ROW_H = 60; // must match --row-h CSS variable
    const TIME_COL = 56; // must match --time-col

    const dayTasks     = getFilteredTodos().filter(t => t.date && isSameDay(new Date(t.date + 'T00:00:00'), currentDate));
    const timedTasks   = dayTasks.filter(t => t.type === 'event' ? t.startTime : t.deadlineTime);
    const untimedTasks = dayTasks.filter(t => t.type === 'event' ? !t.startTime : !t.deadlineTime);

    header.innerHTML = `<i class="fas fa-tasks" style="margin-right:6px"></i>${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''} on this day`;

    // All-day section
    if (untimedTasks.length > 0) {
        const sec = document.createElement('div');
        sec.className = 'no-time-section';
        const lbl = document.createElement('div');
        lbl.className = 'no-time-label';
        lbl.textContent = 'All day / No time set';
        sec.appendChild(lbl);
        untimedTasks.forEach(t => sec.appendChild(makeChip(t)));
        timeline.appendChild(sec);
    }

    // Create the absolutely-positioned inner container
    const inner = document.createElement('div');
    inner.className = 'timeline-inner';
    inner.style.height = `${24 * ROW_H}px`;
    timeline.appendChild(inner);

    // Draw 24 hour rows (background grid + click targets)
    for (let h = 0; h < 24; h++) {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        row.style.top  = `${h * ROW_H}px`;

        // Time label
        const lbl = document.createElement('div');
        lbl.className = 'time-label';
        lbl.style.cssText = `width:${TIME_COL}px;min-width:${TIME_COL}px;font-size:10px;color:var(--text-muted);padding:7px 8px 0 0;text-align:right;user-select:none;flex-shrink:0;`;
        lbl.textContent = formatHour(h);
        row.appendChild(lbl);

        // Clickable slot
        const slot = document.createElement('div');
        slot.className = 'timeline-slot';
        slot.style.cssText = `flex:1;height:100%;`;
        slot.addEventListener('click', () => openPopupWithDateTime(toDateInputVal(currentDate), `${pad(h)}:00`, ''));
        row.appendChild(slot);

        inner.appendChild(row);
    }

    // Draw event/task blocks absolutely
    timedTasks.forEach(t => {
        const isEvent = t.type === 'event';
        const timeRef = isEvent ? t.startTime : t.deadlineTime;
        const [sh, sm] = timeRef.split(':').map(Number);
        const startFrac = sh + sm / 60;

        let durationH = 0.5; // tasks are half-hour tall by default
        if (isEvent && t.endTime) {
            const [eh, em] = t.endTime.split(':').map(Number);
            durationH = Math.max(0.25, (eh + em / 60) - startFrac);
        }

        const top    = startFrac * ROW_H;
        const height = durationH * ROW_H;

        const block = document.createElement('div');
        block.className = `event-block-abs p-${t.priority || 'normal'} ${t.completed ? 'completed-chip' : ''}`;
        block.style.top    = `${top}px`;
        block.style.height = `${height}px`;

        if (isEvent) {
            block.innerHTML = `<div class="ebl-time"><i class="fas fa-calendar-check" style="font-size:9px;margin-right:4px"></i>${formatTime(t.startTime)}${t.endTime ? ' – ' + formatTime(t.endTime) : ''}</div><div class="ebl-title">${escapeHtml(t.text)}</div>`;
        } else {
            block.innerHTML = `<div class="ebl-time"><i class="fas fa-check-square" style="font-size:9px;margin-right:4px"></i>${formatTime(t.deadlineTime)}</div><div class="ebl-title">${escapeHtml(t.text)}</div>`;
        }

        block.addEventListener('click', () => openDetail(t.id));
        inner.appendChild(block);
    });

    // Scroll to current hour if today
    if (isSameDay(currentDate, new Date())) {
        const h = new Date().getHours();
        setTimeout(() => timeline.scrollTo({ top: Math.max(0, h * ROW_H - 80), behavior: 'smooth' }), 80);
    }
}

/* =========================================
   WEEK VIEW — Aligned grid with absolute event blocks
   ========================================= */
function renderWeekView() {
    const ROW_H = 60;
    const { start } = getWeekRange(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
    });

    /* --- Header Row --- */
    const headerRow = document.getElementById('weekHeaderRow');
    headerRow.innerHTML = '';
    headerRow.style.gridTemplateColumns = `var(--time-col) repeat(7, 1fr)`;

    const spacer = document.createElement('div');
    spacer.className = 'week-header-spacer';
    headerRow.appendChild(spacer);

    weekDays.forEach(d => {
        const isToday = isSameDay(d, new Date());
        const cell = document.createElement('div');
        cell.className = 'week-day-head' + (isToday ? ' wdh-today' : '');
        cell.innerHTML = `
            <div class="wdh-dow">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="wdh-num">${d.getDate()}</div>`;
        headerRow.appendChild(cell);
    });

    /* --- Body: time column + 7 day columns side by side --- */
    const weekScroll = document.getElementById('weekScroll');
    // Replace weekGrid with a flex row containing time col + day cols
    const weekGrid = document.getElementById('weekGrid');
    weekGrid.innerHTML = '';
    weekGrid.style.gridTemplateColumns = '';
    weekGrid.style.display = 'flex';
    weekGrid.style.flex = '1';

    const filteredTodos = getFilteredTodos();
    const TOTAL_H = 24 * ROW_H;

    /* --- All-day strip (above the timed grid) --- */
    // We build this as a separate sticky row above weekGrid
    // Reuse weekGrid parent for all-day + timed sections
    weekGrid.style.flexDirection = 'column';

    // All-day row
    const allDayStrip = document.createElement('div');
    allDayStrip.style.cssText = `display:flex; border-bottom:2px solid var(--border); flex-shrink:0;`;

    const allDayLabel = document.createElement('div');
    allDayLabel.style.cssText = `width:var(--time-col);min-width:var(--time-col);font-size:9px;color:var(--text-muted);padding:5px 6px 0 0;text-align:right;border-right:1px solid var(--border);flex-shrink:0;`;
    allDayLabel.textContent = 'all day';
    allDayStrip.appendChild(allDayLabel);

    weekDays.forEach(d => {
        const col = document.createElement('div');
        col.style.cssText = `flex:1;min-width:0;border-right:1px solid var(--border);padding:3px;display:flex;flex-direction:column;gap:2px;min-height:32px;cursor:pointer;`;
        col.className = isSameDay(d, new Date()) ? 'wdc-today' : '';

        filteredTodos
            .filter(t => t.date && !(t.type === 'event' ? t.startTime : t.deadlineTime) && isSameDay(new Date(t.date + 'T00:00:00'), d))
            .forEach(t => col.appendChild(makeChip(t)));

        col.addEventListener('click', e => {
            if (e.target === col) openPopupWithDateTime(toDateInputVal(d), '', '', 'task');
        });
        allDayStrip.appendChild(col);
    });
    weekGrid.appendChild(allDayStrip);

    // Timed section: time col + day columns with absolute blocks
    const timedRow = document.createElement('div');
    timedRow.style.cssText = `display:flex; flex:1; position:relative;`;

    // Time labels column
    const timeCol = document.createElement('div');
    timeCol.style.cssText = `width:var(--time-col);min-width:var(--time-col);flex-shrink:0;position:relative;height:${TOTAL_H}px;border-right:1px solid var(--border);`;

    for (let h = 0; h < 24; h++) {
        const lbl = document.createElement('div');
        lbl.style.cssText = `position:absolute;top:${h * ROW_H}px;right:6px;font-size:10px;color:var(--text-muted);line-height:1;padding-top:4px;`;
        lbl.textContent = h === 0 ? '' : formatHour(h);
        timeCol.appendChild(lbl);

        // Horizontal grid line
        const line = document.createElement('div');
        line.style.cssText = `position:absolute;top:${h * ROW_H}px;left:0;right:0;border-top:1px solid var(--border);width:100%;`;
        timeCol.appendChild(line);
    }
    timedRow.appendChild(timeCol);

    // One column per day
    weekDays.forEach(d => {
        const isToday = isSameDay(d, new Date());
        const dayCol = document.createElement('div');
        dayCol.style.cssText = `flex:1;min-width:0;position:relative;height:${TOTAL_H}px;border-right:1px solid var(--border);${isToday ? 'background:rgba(79,110,247,0.03);' : ''}`;

        // Hour grid lines + click slots
        for (let h = 0; h < 24; h++) {
            const slot = document.createElement('div');
            slot.style.cssText = `position:absolute;top:${h * ROW_H}px;left:0;right:0;height:${ROW_H}px;border-top:1px solid var(--border);cursor:pointer;box-sizing:border-box;`;
            slot.addEventListener('click', () => openPopupWithDateTime(toDateInputVal(d), `${pad(h)}:00`, `${pad(h+1)}:00`, 'event'));
            slot.addEventListener('mouseenter', () => slot.style.background = 'rgba(79,110,247,0.04)');
            slot.addEventListener('mouseleave', () => slot.style.background = '');
            dayCol.appendChild(slot);
        }

        // Timed tasks/events as absolute blocks
        filteredTodos
            .filter(t => t.date && (t.type === 'event' ? t.startTime : t.deadlineTime) && isSameDay(new Date(t.date + 'T00:00:00'), d))
            .forEach(t => {
                const isEvent = t.type === 'event';
                const timeRef = isEvent ? t.startTime : t.deadlineTime;
                const [sh, sm] = timeRef.split(':').map(Number);
                const startFrac = sh + sm / 60;
                let durationH = 0.5;
                if (isEvent && t.endTime) {
                    const [eh, em] = t.endTime.split(':').map(Number);
                    durationH = Math.max(0.25, (eh + em / 60) - startFrac);
                }

                const block = document.createElement('div');
                block.className = `event-block-abs p-${t.priority || 'normal'} ${t.completed ? 'completed-chip' : ''}`;
                block.style.left   = '2px';
                block.style.right  = '2px';
                block.style.top    = `${startFrac * ROW_H}px`;
                block.style.height = `${durationH * ROW_H}px`;

                if (isEvent) {
                    block.innerHTML = `<div class="ebl-time"><i class="fas fa-calendar-check" style="font-size:9px;margin-right:3px"></i>${formatTime(t.startTime)}${t.endTime ? '–' + formatTime(t.endTime) : ''}</div><div class="ebl-title">${escapeHtml(t.text)}</div>`;
                } else {
                    block.innerHTML = `<div class="ebl-time"><i class="fas fa-check-square" style="font-size:9px;margin-right:3px"></i>${formatTime(t.deadlineTime)}</div><div class="ebl-title">${escapeHtml(t.text)}</div>`;
                }

                block.addEventListener('click', e => { e.stopPropagation(); openDetail(t.id); });
                dayCol.appendChild(block);
            });

        timedRow.appendChild(dayCol);
    });

    weekGrid.appendChild(timedRow);

    // Scroll to current hour if in current week
    const now = new Date();
    if (weekDays.some(d => isSameDay(d, now))) {
        setTimeout(() => weekScroll.scrollTo({ top: Math.max(0, now.getHours() * ROW_H - 80), behavior: 'smooth' }), 80);
    }
}

/* =========================================
   MONTH VIEW
   ========================================= */
function renderMonthView() {
    const grid  = document.getElementById('monthGrid');
    grid.innerHTML = '';

    const year     = currentDate.getFullYear();
    const month    = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const filtered    = getFilteredTodos();
    const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        let date, isOther = false;
        if (i < firstDay) {
            date = new Date(year, month - 1, daysInPrev - firstDay + i + 1);
            isOther = true;
        } else if (i >= firstDay + daysInMonth) {
            date = new Date(year, month + 1, i - firstDay - daysInMonth + 1);
            isOther = true;
        } else {
            date = new Date(year, month, i - firstDay + 1);
        }

        const cell = document.createElement('div');
        cell.className = 'month-cell'
            + (isOther ? ' mc-other' : '')
            + (isSameDay(date, new Date()) ? ' mc-today' : '');

        const numEl = document.createElement('div');
        numEl.className = 'mc-date-num';
        numEl.textContent = date.getDate();
        cell.appendChild(numEl);

        const dayTasks = filtered.filter(t => t.date && isSameDay(new Date(t.date + 'T00:00:00'), date));
        const maxShow  = 3;

        dayTasks.slice(0, maxShow).forEach(t => {
            const chip = document.createElement('div');
            chip.className = `month-chip p-${t.priority || 'normal'} ${t.completed ? 'completed-chip' : ''}`;
            const timeLabel = t.startTime ? formatTime(t.startTime) + ' ' : '';
            chip.textContent = timeLabel + t.text;
            chip.addEventListener('click', e => { e.stopPropagation(); openDetail(t.id); });
            cell.appendChild(chip);
        });

        if (dayTasks.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'month-more';
            more.textContent = `+${dayTasks.length - maxShow} more`;
            cell.appendChild(more);
        }

        cell.addEventListener('click', e => {
            if (e.target === cell || e.target === numEl) {
                openPopupWithDateTime(toDateInputVal(date), '', '');
            }
        });

        grid.appendChild(cell);
    }
}

/* =========================================
   LIST VIEW
   ========================================= */
function renderListView() {
    const listEl  = document.getElementById('taskList');
    const emptyEl = document.getElementById('listEmpty');
    listEl.innerHTML = '';

    let filtered = getFilteredTodos();

    filtered.sort((a, b) => {
        const dir = sortDir[sortKey] === 'asc' ? 1 : -1;
        if (sortKey === 'date')     return compareDates(a, b, dir);
        if (sortKey === 'name')     return a.text.localeCompare(b.text) * dir;
        if (sortKey === 'priority') return ((PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0)) * dir;
        return 0;
    });

    if (filtered.length === 0) { emptyEl.classList.add('show'); return; }
    emptyEl.classList.remove('show');

    filtered.forEach(t => {
        const li = document.createElement('li');
        const isEvent = t.type === 'event';
        li.className = `task-item p-${t.priority || 'normal'} ${t.completed ? 'completed' : ''}`;

        const dateStr  = t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        let timeStr = '';
        if (isEvent && t.startTime) timeStr = formatTime(t.startTime) + (t.endTime ? ' – ' + formatTime(t.endTime) : '');
        else if (!isEvent && t.deadlineTime) timeStr = formatTime(t.deadlineTime);
        const isOverdue = !t.completed && t.date && new Date(t.date + 'T00:00:00') < new Date().setHours(0,0,0,0);

        li.innerHTML = `
            <div class="task-checkbox ${isEvent ? 'event-checkbox' : ''} ${t.completed ? 'checked' : ''}" onclick="${isEvent ? '' : `toggleComplete('${t.id}'); event.stopPropagation()`}">
                ${isEvent ? '<i class="fas fa-calendar-check" style="font-size:10px"></i>' : (t.completed ? '<i class="fas fa-check"></i>' : '')}
            </div>
            <div class="task-body">
                <div class="task-name">
                    ${escapeHtml(t.text)}
                    <span class="type-badge type-${isEvent ? 'event' : 'task'}" style="margin-left:6px;vertical-align:middle">${isEvent ? 'Event' : 'Task'}</span>
                </div>
                <div class="task-meta">
                    <span class="${isOverdue ? 'overdue' : ''}">
                        <i class="far fa-calendar"></i> ${dateStr}
                        ${timeStr ? `<i class="far fa-clock" style="margin-left:6px"></i> ${timeStr}` : ''}
                        ${isOverdue ? ' · Overdue' : ''}
                    </span>
                    ${t.location ? `<span><i class="fas fa-location-dot" style="margin-right:3px;opacity:.6"></i>${escapeHtml(t.location)}</span>` : ''}
                    <span class="priority-badge p-${t.priority || 'normal'}">${PRIORITY_LABELS[t.priority] || 'Normal'}</span>
                </div>
                ${t.desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(t.desc)}</div>` : ''}
            </div>
            <div class="task-actions">
                <button class="act-btn"     onclick="openEditPopup('${t.id}'); event.stopPropagation()" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="act-btn del" onclick="deleteTodo('${t.id}');    event.stopPropagation()" title="Delete"><i class="fas fa-trash"></i></button>
            </div>`;

        li.addEventListener('click', () => openDetail(t.id));
        listEl.appendChild(li);
    });
}

/* =========================================
   Task/Event Chip Builder (Day & Week all-day row)
   ========================================= */
function makeChip(todo) {
    const chip = document.createElement('div');
    const isEvent = todo.type === 'event';
    chip.className = `task-chip p-${todo.priority || 'normal'} ${todo.completed ? 'completed-chip' : ''}`;
    chip.style.display = 'flex';

    if (isEvent) {
        // Static calendar icon for events
        const icon = document.createElement('i');
        icon.className = 'fas fa-calendar-check chip-type-icon';
        icon.style.cssText = 'font-size:10px;flex-shrink:0;opacity:0.75;margin-right:1px;';
        chip.appendChild(icon);
    } else {
        // Interactive check circle for tasks
        const chk = makeCheckEl(todo);
        chip.appendChild(chk);
    }

    // Time label for tasks with deadlineTime
    if (!isEvent && todo.deadlineTime) {
        const timeEl = document.createElement('span');
        timeEl.className = 'chip-time';
        timeEl.textContent = formatTime(todo.deadlineTime);
        chip.appendChild(timeEl);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'chip-label';
    labelEl.textContent = todo.text;
    chip.appendChild(labelEl);

    chip.addEventListener('click', e => {
        if (!e.target.closest('.chip-check')) openDetail(todo.id);
    });
    return chip;
}

function makeCheckEl(todo) {
    const chk = document.createElement('div');
    chk.className = 'chip-check';
    chk.innerHTML = '<i class="fas fa-check"></i>';
    chk.addEventListener('click', e => { e.stopPropagation(); toggleComplete(todo.id); });
    return chk;
}

/* =========================================
   Detail Popup
   ========================================= */
function openDetail(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    detailTaskId = id;

    const isEvent = t.type === 'event';
    const dateStr = t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : 'No date';
    const isOverdue = !t.completed && t.date && new Date(t.date + 'T00:00:00') < new Date().setHours(0,0,0,0);

    let timeStr = '';
    if (isEvent && t.startTime) timeStr = formatTime(t.startTime) + (t.endTime ? ' – ' + formatTime(t.endTime) : '');
    else if (!isEvent && t.deadlineTime) timeStr = formatTime(t.deadlineTime);

    document.getElementById('detailTitle').textContent = isEvent ? 'Event Details' : 'Task Details';
    document.getElementById('detailBody').innerHTML = `
        <div class="detail-title">${escapeHtml(t.text)}</div>
        <div style="margin-top:4px;margin-bottom:10px;">
            <span class="type-badge type-${isEvent ? 'event' : 'task'}">${isEvent ? '⬤ Event' : '☐ Task'}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
            <div><i class="far fa-calendar" style="width:16px;margin-right:7px;opacity:.6"></i>${dateStr}${isOverdue ? ' <span style="color:var(--p-urgent);font-size:11px">· Overdue</span>' : ''}</div>
            ${timeStr ? `<div><i class="far fa-clock" style="width:16px;margin-right:7px;opacity:.6"></i>${timeStr}</div>` : ''}
            ${t.location ? `<div><i class="fas fa-location-dot" style="width:16px;margin-right:7px;opacity:.6"></i>${escapeHtml(t.location)}</div>` : ''}
            <div><i class="fas fa-flag" style="width:16px;margin-right:7px;opacity:.6"></i><span class="priority-badge p-${t.priority || 'normal'}">${PRIORITY_LABELS[t.priority] || 'Normal'}</span></div>
            <div><i class="fas fa-circle-half-stroke" style="width:16px;margin-right:7px;opacity:.6"></i>${t.completed ? 'Completed ✓' : 'Ongoing'}</div>
            ${t.desc ? `<div style="margin-top:6px;padding:10px;background:var(--surface2);border-radius:8px;line-height:1.6;white-space:pre-wrap;font-size:13px;">${escapeHtml(t.desc)}</div>` : ''}
        </div>`;
    document.getElementById('taskDetail').classList.add('active');
}

function closeDetail() {
    document.getElementById('taskDetail').classList.remove('active');
    detailTaskId = null;
}

function editFromDetail() { const id = detailTaskId; closeDetail(); openEditPopup(id); }

function deleteFromDetail() {
    if (confirm('Delete this task?')) { deleteTodo(detailTaskId); closeDetail(); }
}

/* =========================================
   Filter & Sort
   ========================================= */
function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.nav-btn.filter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === filter));
    renderCurrentView();
}

function setSortKey(key) {
    if (sortKey === key) {
        // Toggle direction if same key clicked again
        sortDir[key] = sortDir[key] === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey = key;
    }
    updateSortUI();
    renderListView();
}

function updateSortUI() {
    const dirIcons = {
        date:     { asc: 'fa-arrow-up-short-wide',   desc: 'fa-arrow-down-short-wide' },
        name:     { asc: 'fa-arrow-down-a-z',         desc: 'fa-arrow-up-z-a' },
        priority: { asc: 'fa-arrow-up-wide-short',    desc: 'fa-arrow-down-wide-short' }
    };
    document.querySelectorAll('.sort-seg').forEach(btn => {
        const k = btn.dataset.sortKey;
        btn.classList.toggle('active', k === sortKey);
        const icon = btn.querySelector('.sort-dir-icon');
        if (icon) {
            const dir = sortDir[k] || 'asc';
            icon.className = `fas ${dirIcons[k][dir]} sort-dir-icon`;
        }
    });
}

function handleSort(val) { /* legacy – no-op */ }

function getFilteredTodos() {
    return todos.filter(t => {
        if (currentFilter === 'active')    return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });
}

/* =========================================
   CRUD
   ========================================= */
function toggleComplete(id) {
    const t = todos.find(x => x.id === id);
    if (t) { t.completed = !t.completed; renderCurrentView(); }
}

function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    renderCurrentView();
}

/* =========================================
   Form / Modal
   ========================================= */
let currentItemType = 'task'; // 'task' | 'event'

function selectType(type) {
    currentItemType = type;
    document.getElementById('itemType').value = type;

    const isEvent = type === 'event';

    // Toggle button styles
    document.getElementById('typeBtnTask').classList.toggle('active', !isEvent);
    document.getElementById('typeBtnEvent').classList.toggle('active', isEvent);
    document.getElementById('typeBtnEvent').classList.toggle('event-active', isEvent);

    // Show/hide fields
    document.getElementById('taskTimeGroup').style.display  = isEvent ? 'none' : '';
    document.getElementById('eventTimeGroup').style.display = isEvent ? '' : 'none';
    document.getElementById('locationGroup').style.display  = isEvent ? '' : 'none';

    // Update labels & placeholder
    document.getElementById('labelName').textContent  = isEvent ? 'Event Name' : 'Task Name';
    document.getElementById('labelDate').textContent  = isEvent ? 'Date' : 'Deadline Date';
    document.getElementById('taskName').placeholder   = isEvent ? 'What is this event?' : 'What needs to be done?';

    // Update popup title
    if (!isEditing) {
        document.getElementById('popupTitle').textContent = isEvent ? 'New Event' : 'New Task';
    }
}

function openPopupWithDateTime(dateVal, startTime, endTime, type = 'task') {
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskDueDate').value = dateVal || toDateInputVal(new Date());
    document.getElementById('taskStartTime').value = startTime || '';
    document.getElementById('taskEndTime').value   = endTime   || '';
    document.getElementById('taskDeadlineTime').value = '';
    document.getElementById('taskLocation').value  = '';
    document.getElementById('taskDesc').value      = '';
    selectPriority('normal');
    isEditing = false;

    // Show type toggle
    document.getElementById('typeToggle').style.display = '';
    document.getElementById('nameError').style.display  = 'none';
    document.getElementById('startTimeError').style.display = 'none';
    document.getElementById('endTimeError').style.display   = 'none';

    selectType(type);
    document.getElementById('taskPopup').classList.add('active');
    setTimeout(() => document.getElementById('taskName').focus(), 80);
}

function openPopup(type = 'task') {
    openPopupWithDateTime(toDateInputVal(new Date()), '', '', type);
}

function openEditPopup(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;

    isEditing = true;
    const type = t.type || 'task';

    document.getElementById('popupTitle').textContent = type === 'event' ? 'Edit Event' : 'Edit Task';
    document.getElementById('taskId').value           = t.id;
    document.getElementById('taskName').value         = t.text;
    document.getElementById('taskDueDate').value      = t.date      || '';
    document.getElementById('taskStartTime').value    = t.startTime || '';
    document.getElementById('taskEndTime').value      = t.endTime   || '';
    document.getElementById('taskDeadlineTime').value = t.deadlineTime || '';
    document.getElementById('taskLocation').value     = t.location  || '';
    document.getElementById('taskDesc').value         = t.desc      || '';
    selectPriority(t.priority || 'normal');

    // Hide type toggle when editing
    document.getElementById('typeToggle').style.display = 'none';
    document.getElementById('nameError').style.display  = 'none';
    document.getElementById('startTimeError').style.display = 'none';
    document.getElementById('endTimeError').style.display   = 'none';

    // Still apply field visibility
    currentItemType = type;
    document.getElementById('itemType').value = type;
    const isEvent = type === 'event';
    document.getElementById('taskTimeGroup').style.display  = isEvent ? 'none' : '';
    document.getElementById('eventTimeGroup').style.display = isEvent ? '' : 'none';
    document.getElementById('locationGroup').style.display  = isEvent ? '' : 'none';

    document.getElementById('taskPopup').classList.add('active');
    setTimeout(() => document.getElementById('taskName').focus(), 80);
}

function closePopup() { document.getElementById('taskPopup').classList.remove('active'); }

function selectPriority(p) {
    selectedPriority = p;
    document.querySelectorAll('.prio-opt').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.priority === p));
    document.getElementById('taskPriority').value = p;
}

function handleFormSubmit(e) {
    e.preventDefault();
    const text     = document.getElementById('taskName').value.trim();
    const date     = document.getElementById('taskDueDate').value;
    const type     = document.getElementById('itemType').value || 'task';
    const priority = document.getElementById('taskPriority').value || 'normal';
    const desc     = document.getElementById('taskDesc').value.trim();
    const location = document.getElementById('taskLocation').value.trim();

    let startTime = '', endTime = '', deadlineTime = '';
    let valid = true;

    if (!text) {
        document.getElementById('nameError').style.display = 'block';
        valid = false;
    } else {
        document.getElementById('nameError').style.display = 'none';
    }

    if (type === 'event') {
        startTime = document.getElementById('taskStartTime').value;
        endTime   = document.getElementById('taskEndTime').value;
        if (!startTime) { document.getElementById('startTimeError').style.display = 'block'; valid = false; }
        else document.getElementById('startTimeError').style.display = 'none';
        if (!endTime)   { document.getElementById('endTimeError').style.display = 'block'; valid = false; }
        else document.getElementById('endTimeError').style.display = 'none';
    } else {
        deadlineTime = document.getElementById('taskDeadlineTime').value;
        document.getElementById('startTimeError').style.display = 'none';
        document.getElementById('endTimeError').style.display   = 'none';
    }

    if (!valid) return;

    if (isEditing) {
        const idx = todos.findIndex(t => t.id === document.getElementById('taskId').value);
        if (idx > -1) todos[idx] = { ...todos[idx], text, date, type, startTime, endTime, deadlineTime, priority, desc, location };
    } else {
        todos.push({ id: crypto.randomUUID(), text, date, type, startTime, endTime, deadlineTime, priority, desc, location, completed: false });
    }

    closePopup();
    renderCurrentView();
}

/* =========================================
   Persistence
   ========================================= */
function save() { localStorage.setItem('priorme_todos', JSON.stringify(todos)); }

/* =========================================
   Helpers
   ========================================= */
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
}

function getWeekRange(date) {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
}

function timeToHour(timeStr) {
    if (!timeStr) return -1;
    return parseInt(timeStr.split(':')[0], 10);
}

function formatHour(h) {
    return `${pad(h)}:00`;
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    return `${pad(h)}:${pad(m)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function toDateInputVal(date) {
    // Use local year/month/day — NOT toISOString() which converts to UTC
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    return `${y}-${m}-${d}`;
}

function compareDates(a, b, dir) {
    const da = a.date ? new Date(a.date).getTime() : Infinity;
    const db = b.date ? new Date(b.date).getTime() : Infinity;
    return (da - db) * dir;
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// Backdrop clicks close modals
document.getElementById('taskPopup').addEventListener('click', function(e) { if (e.target === this) closePopup(); });
document.getElementById('taskDetail').addEventListener('click', function(e) { if (e.target === this) closeDetail(); });