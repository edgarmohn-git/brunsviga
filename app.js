// ──────────────────────────────────────────────
// Brunsviga — Dienstplan & Eventplanung
// Vanilla JS, localStorage persistence
// ──────────────────────────────────────────────

const STORE_KEY = 'brunsviga_data';

const ROLES = [
  'Leitung', 'Barkeeper', 'Service', 'Kasse', 'Technik',
  'Bühne', 'Security', 'Springer', 'Extern'
];

const EVENT_TYPES = [
  'Konzert', 'Comedy', 'Theater', 'Kabarett', 'Party',
  'Lesung', 'Workshop', 'Probe', 'Privat', 'Sonstiges'
];

// ── State ─────────────────────────────────────

let data = {
  staff: [],       // { id, name, role, phone, notes, active }
  events: [],      // { id, title, date, start, end, type, notes, requiredStaff[], assignedStaff[] }
  shifts: [],      // { id, staffId, eventId|null, date, start, end, role, notes }
};

let editingId = null; // used by modals

// ── Persistence ───────────────────────────────

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { data = JSON.parse(raw); } catch(e) { console.warn('Load failed', e); }
  }
}

// ── ID generator ──────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Tab navigation ────────────────────────────

function initTabs() {
  document.querySelectorAll('nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      renderAll();
    });
  });
}

// ── Helpers ───────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(t) { return t || '—'; }

function staffName(id) {
  const s = data.staff.find(x => x.id === id);
  return s ? s.name : '?';
}

function eventTitle(id) {
  const e = data.events.find(x => x.id === id);
  return e ? e.title : '—';
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function weekDays(startOffset = 0) {
  const days = [];
  const today = new Date();
  for (let i = startOffset; i < startOffset + 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ── DASHBOARD ─────────────────────────────────

function renderDashboard() {
  const today = isoToday();
  const upcoming = data.events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const shiftsToday = data.shifts.filter(s => s.date === today);

  document.getElementById('stat-staff').textContent = data.staff.filter(s => s.active !== false).length;
  document.getElementById('stat-events').textContent = data.events.length;
  document.getElementById('stat-upcoming').textContent = upcoming.length;
  document.getElementById('stat-shifts-today').textContent = shiftsToday.length;

  // Upcoming events list
  const ul = document.getElementById('upcoming-events');
  ul.innerHTML = '';
  if (upcoming.length === 0) {
    ul.innerHTML = '<div class="empty-state">Keine bevorstehenden Events.</div>';
  } else {
    upcoming.forEach(ev => {
      const assigned = ev.assignedStaff ? ev.assignedStaff.length : 0;
      const required = ev.requiredStaff ? ev.requiredStaff.reduce((s, r) => s + r.count, 0) : 0;
      const statusClass = assigned >= required ? 'badge-green' : assigned > 0 ? 'badge-amber' : 'badge-red';
      const statusText = assigned >= required ? 'Besetzt' : assigned > 0 ? 'Teilbesetzt' : 'Offen';
      ul.innerHTML += `
        <div class="item">
          <div class="item-info">
            <div class="item-title">${ev.title}</div>
            <div class="item-meta">${formatDate(ev.date)} · ${formatTime(ev.start)}–${formatTime(ev.end)} · ${ev.type || ''}</div>
          </div>
          <span class="badge ${statusClass}">${statusText}</span>
          <div class="item-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEventModal('${ev.id}')">Details</button>
          </div>
        </div>`;
    });
  }

  // Week strip
  renderWeekStrip();
}

function renderWeekStrip() {
  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';
  const today = isoToday();
  weekDays().forEach(iso => {
    const dayEvents = data.events.filter(e => e.date === iso);
    const isToday = iso === today;
    const d = new Date(iso + 'T00:00:00');
    const dayName = d.toLocaleDateString('de-DE', { weekday: 'short' });
    const dayNum = d.getDate();
    let evHTML = '';
    dayEvents.forEach(ev => {
      evHTML += `<div class="day-event" title="${ev.title}" onclick="openEventModal('${ev.id}')">${ev.title}</div>`;
    });
    strip.innerHTML += `
      <div class="day-col ${isToday ? 'today' : ''}">
        <div class="day-header">${dayName}</div>
        <div class="day-date">${dayNum}</div>
        ${evHTML || '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">—</div>'}
      </div>`;
  });
}

// ── PERSONAL (Staff) ──────────────────────────

function renderStaff() {
  const list = document.getElementById('staff-list');
  list.innerHTML = '';
  const active = data.staff.filter(s => s.active !== false);
  const inactive = data.staff.filter(s => s.active === false);

  if (data.staff.length === 0) {
    list.innerHTML = '<div class="empty-state">Noch kein Personal angelegt.</div>';
    return;
  }

  [...active, ...inactive].forEach(s => {
    const isInactive = s.active === false;
    list.innerHTML += `
      <div class="item" style="${isInactive ? 'opacity:0.5' : ''}">
        <div class="item-info">
          <div class="item-title">${s.name} ${isInactive ? '<span class="badge badge-gray">Inaktiv</span>' : ''}</div>
          <div class="item-meta">${s.role || '—'} ${s.phone ? '· ' + s.phone : ''}</div>
          ${s.notes ? `<div class="item-meta">${s.notes}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" onclick="openStaffModal('${s.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteStaff('${s.id}')">✕</button>
        </div>
      </div>`;
  });
}

function openStaffModal(id) {
  editingId = id || null;
  const s = id ? data.staff.find(x => x.id === id) : null;
  document.getElementById('staff-modal-title').textContent = s ? 'Personal bearbeiten' : 'Neues Personal';
  document.getElementById('sf-name').value = s ? s.name : '';
  document.getElementById('sf-phone').value = s ? (s.phone || '') : '';
  document.getElementById('sf-notes').value = s ? (s.notes || '') : '';

  const roleEl = document.getElementById('sf-role');
  roleEl.innerHTML = ROLES.map(r => `<option value="${r}" ${s && s.role === r ? 'selected' : ''}>${r}</option>`).join('');

  document.getElementById('sf-active').checked = s ? (s.active !== false) : true;
  document.getElementById('staff-modal').classList.add('open');
}

function saveStaffModal() {
  const name = document.getElementById('sf-name').value.trim();
  if (!name) { alert('Name ist erforderlich.'); return; }

  if (editingId) {
    const idx = data.staff.findIndex(x => x.id === editingId);
    data.staff[idx] = {
      ...data.staff[idx],
      name,
      role: document.getElementById('sf-role').value,
      phone: document.getElementById('sf-phone').value.trim(),
      notes: document.getElementById('sf-notes').value.trim(),
      active: document.getElementById('sf-active').checked,
    };
  } else {
    data.staff.push({
      id: uid(), name,
      role: document.getElementById('sf-role').value,
      phone: document.getElementById('sf-phone').value.trim(),
      notes: document.getElementById('sf-notes').value.trim(),
      active: true,
    });
  }
  save();
  closeModal('staff-modal');
  renderAll();
}

function deleteStaff(id) {
  if (!confirm('Person wirklich löschen?')) return;
  data.staff = data.staff.filter(s => s.id !== id);
  data.shifts = data.shifts.filter(s => s.staffId !== id);
  data.events.forEach(ev => {
    ev.assignedStaff = (ev.assignedStaff || []).filter(sid => sid !== id);
  });
  save();
  renderAll();
}

// ── EVENTS ────────────────────────────────────

function renderEvents() {
  const list = document.getElementById('events-list');
  const today = isoToday();
  const filter = document.getElementById('events-filter').value;
  let evs = [...data.events].sort((a, b) => a.date.localeCompare(b.date));

  if (filter === 'upcoming') evs = evs.filter(e => e.date >= today);
  else if (filter === 'past') evs = evs.filter(e => e.date < today);

  list.innerHTML = '';
  if (evs.length === 0) {
    list.innerHTML = '<div class="empty-state">Keine Events vorhanden.</div>';
    return;
  }

  evs.forEach(ev => {
    const assigned = (ev.assignedStaff || []).length;
    const required = (ev.requiredStaff || []).reduce((s, r) => s + r.count, 0);
    const statusClass = assigned >= required ? 'badge-green' : assigned > 0 ? 'badge-amber' : 'badge-red';
    const statusText = assigned >= required ? 'Besetzt' : assigned > 0 ? `${assigned}/${required}` : `0/${required}`;

    list.innerHTML += `
      <div class="item">
        <div class="item-info">
          <div class="item-title">${ev.title}</div>
          <div class="item-meta">${formatDate(ev.date)} · ${formatTime(ev.start)}–${formatTime(ev.end)} · <span class="badge badge-blue">${ev.type || 'Sonstiges'}</span></div>
          ${ev.notes ? `<div class="item-meta">${ev.notes}</div>` : ''}
        </div>
        <span class="badge ${statusClass}">${statusText} Personal</span>
        <div class="item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openAssignModal('${ev.id}')">Besetzung</button>
          <button class="btn btn-ghost btn-sm" onclick="openEventModal('${ev.id}')">Bearbeiten</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEvent('${ev.id}')">✕</button>
        </div>
      </div>`;
  });
}

function openEventModal(id) {
  editingId = id || null;
  const ev = id ? data.events.find(x => x.id === id) : null;
  document.getElementById('event-modal-title').textContent = ev ? 'Event bearbeiten' : 'Neues Event';
  document.getElementById('ef-title').value = ev ? ev.title : '';
  document.getElementById('ef-date').value = ev ? ev.date : isoToday();
  document.getElementById('ef-start').value = ev ? (ev.start || '') : '20:00';
  document.getElementById('ef-end').value = ev ? (ev.end || '') : '23:00';
  document.getElementById('ef-notes').value = ev ? (ev.notes || '') : '';

  const typeEl = document.getElementById('ef-type');
  typeEl.innerHTML = EVENT_TYPES.map(t => `<option value="${t}" ${ev && ev.type === t ? 'selected' : ''}>${t}</option>`).join('');

  // Required staff rows
  renderRequiredStaffRows(ev ? (ev.requiredStaff || []) : []);
  document.getElementById('event-modal').classList.add('open');
}

function renderRequiredStaffRows(rows) {
  const container = document.getElementById('required-staff-rows');
  container.innerHTML = '';
  rows.forEach((r, i) => {
    container.innerHTML += buildRequiredStaffRow(r.role, r.count, i);
  });
}

function buildRequiredStaffRow(role = '', count = 1, i = Date.now()) {
  return `
    <div class="form-row required-staff-row" data-idx="${i}">
      <div class="form-group" style="flex:2">
        <select class="rs-role">
          ${ROLES.map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <input type="number" class="rs-count" min="1" max="20" value="${count}" />
      </div>
      <button class="btn btn-ghost btn-sm" style="align-self:flex-end;margin-bottom:12px"
        onclick="this.closest('.required-staff-row').remove()">✕</button>
    </div>`;
}

function addRequiredStaffRow() {
  const container = document.getElementById('required-staff-rows');
  const div = document.createElement('div');
  div.innerHTML = buildRequiredStaffRow();
  container.appendChild(div.firstElementChild);
}

function saveEventModal() {
  const title = document.getElementById('ef-title').value.trim();
  if (!title) { alert('Titel ist erforderlich.'); return; }

  const rows = [...document.querySelectorAll('.required-staff-row')].map(row => ({
    role: row.querySelector('.rs-role').value,
    count: parseInt(row.querySelector('.rs-count').value) || 1,
  }));

  const evData = {
    title,
    date: document.getElementById('ef-date').value,
    start: document.getElementById('ef-start').value,
    end: document.getElementById('ef-end').value,
    type: document.getElementById('ef-type').value,
    notes: document.getElementById('ef-notes').value.trim(),
    requiredStaff: rows,
  };

  if (editingId) {
    const idx = data.events.findIndex(x => x.id === editingId);
    data.events[idx] = { ...data.events[idx], ...evData };
  } else {
    data.events.push({ id: uid(), ...evData, assignedStaff: [] });
  }
  save();
  closeModal('event-modal');
  renderAll();
}

function deleteEvent(id) {
  if (!confirm('Event wirklich löschen?')) return;
  data.events = data.events.filter(e => e.id !== id);
  data.shifts = data.shifts.filter(s => s.eventId !== id);
  save();
  renderAll();
}

// ── ASSIGN STAFF to EVENT ─────────────────────

function openAssignModal(eventId) {
  const ev = data.events.find(x => x.id === eventId);
  if (!ev) return;
  editingId = eventId;
  document.getElementById('assign-event-name').textContent = `${ev.title} — ${formatDate(ev.date)}`;

  const container = document.getElementById('assign-staff-list');
  container.innerHTML = '';
  const activeStaff = data.staff.filter(s => s.active !== false);

  if (activeStaff.length === 0) {
    container.innerHTML = '<div class="empty-state">Noch kein aktives Personal angelegt.</div>';
  } else {
    activeStaff.forEach(s => {
      const isAssigned = (ev.assignedStaff || []).includes(s.id);
      container.innerHTML += `
        <div class="item">
          <input type="checkbox" id="asgn-${s.id}" value="${s.id}"
            ${isAssigned ? 'checked' : ''} style="width:auto;margin-right:8px">
          <label for="asgn-${s.id}" class="item-info" style="cursor:pointer">
            <div class="item-title">${s.name}</div>
            <div class="item-meta">${s.role || '—'}</div>
          </label>
        </div>`;
    });
  }

  // Show required staff summary
  const req = (ev.requiredStaff || []);
  let reqHTML = '';
  if (req.length > 0) {
    reqHTML = '<div class="item-meta mt8">Benötigt: ' +
      req.map(r => `${r.count}× ${r.role}`).join(', ') + '</div>';
  }
  document.getElementById('assign-required-summary').innerHTML = reqHTML;

  document.getElementById('assign-modal').classList.add('open');
}

function saveAssignModal() {
  const ev = data.events.find(x => x.id === editingId);
  if (!ev) return;
  const checked = [...document.querySelectorAll('#assign-staff-list input[type=checkbox]:checked')]
    .map(cb => cb.value);
  ev.assignedStaff = checked;
  save();
  closeModal('assign-modal');
  renderAll();
}

// ── DIENSTPLAN (Shifts) ───────────────────────

function renderRoster() {
  const filter = document.getElementById('roster-date').value || isoToday();
  const shifts = data.shifts
    .filter(s => s.date === filter)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const tbody = document.getElementById('roster-tbody');
  tbody.innerHTML = '';

  if (shifts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Keine Schichten für diesen Tag.</td></tr>`;
    return;
  }

  shifts.forEach(s => {
    const ev = s.eventId ? data.events.find(x => x.id === s.eventId) : null;
    tbody.innerHTML += `
      <tr>
        <td><strong>${staffName(s.staffId)}</strong></td>
        <td><span class="badge badge-blue">${s.role || '—'}</span></td>
        <td>${formatTime(s.start)} – ${formatTime(s.end)}</td>
        <td>${ev ? ev.title : '—'}</td>
        <td>${s.notes || ''}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openShiftModal('${s.id}')">✏</button>
          <button class="btn btn-danger btn-sm" onclick="deleteShift('${s.id}')">✕</button>
        </td>
      </tr>`;
  });
}

function openShiftModal(id) {
  editingId = id || null;
  const s = id ? data.shifts.find(x => x.id === id) : null;
  document.getElementById('shift-modal-title').textContent = s ? 'Schicht bearbeiten' : 'Neue Schicht';
  document.getElementById('shf-date').value = s ? s.date : (document.getElementById('roster-date').value || isoToday());
  document.getElementById('shf-start').value = s ? (s.start || '') : '18:00';
  document.getElementById('shf-end').value = s ? (s.end || '') : '23:00';
  document.getElementById('shf-notes').value = s ? (s.notes || '') : '';

  const staffEl = document.getElementById('shf-staff');
  const activeStaff = data.staff.filter(x => x.active !== false);
  staffEl.innerHTML = '<option value="">— Personal wählen —</option>' +
    activeStaff.map(p => `<option value="${p.id}" ${s && s.staffId === p.id ? 'selected' : ''}>${p.name} (${p.role || '—'})</option>`).join('');

  const roleEl = document.getElementById('shf-role');
  roleEl.innerHTML = ROLES.map(r => `<option value="${r}" ${s && s.role === r ? 'selected' : ''}>${r}</option>`).join('');

  const evEl = document.getElementById('shf-event');
  const dateVal = document.getElementById('shf-date').value;
  const dayEvents = data.events.filter(e => e.date === dateVal);
  evEl.innerHTML = '<option value="">— Kein Event —</option>' +
    dayEvents.map(e => `<option value="${e.id}" ${s && s.eventId === e.id ? 'selected' : ''}>${e.title}</option>`).join('');

  document.getElementById('shift-modal').classList.add('open');
}

// Update event dropdown when date changes in shift modal
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('shf-date');
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      const evEl = document.getElementById('shf-event');
      const dayEvents = data.events.filter(e => e.date === dateInput.value);
      evEl.innerHTML = '<option value="">— Kein Event —</option>' +
        dayEvents.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
    });
  }
});

function saveShiftModal() {
  const staffId = document.getElementById('shf-staff').value;
  if (!staffId) { alert('Bitte Personal wählen.'); return; }

  const shiftData = {
    staffId,
    date: document.getElementById('shf-date').value,
    start: document.getElementById('shf-start').value,
    end: document.getElementById('shf-end').value,
    role: document.getElementById('shf-role').value,
    eventId: document.getElementById('shf-event').value || null,
    notes: document.getElementById('shf-notes').value.trim(),
  };

  if (editingId) {
    const idx = data.shifts.findIndex(x => x.id === editingId);
    data.shifts[idx] = { ...data.shifts[idx], ...shiftData };
  } else {
    data.shifts.push({ id: uid(), ...shiftData });
  }
  save();
  closeModal('shift-modal');
  renderRoster();
}

function deleteShift(id) {
  if (!confirm('Schicht löschen?')) return;
  data.shifts = data.shifts.filter(s => s.id !== id);
  save();
  renderRoster();
}

// ── Modal helpers ─────────────────────────────

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editingId = null;
}

// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    editingId = null;
  }
});

// ── Render all ────────────────────────────────

function renderAll() {
  renderDashboard();
  renderStaff();
  renderEvents();
  renderRoster();
}

// ── Export (simple CSV) ───────────────────────

function exportRosterCSV() {
  const rows = [['Datum', 'Name', 'Rolle', 'Von', 'Bis', 'Event', 'Notiz']];
  data.shifts
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
    .forEach(s => {
      const ev = s.eventId ? data.events.find(x => x.id === s.eventId) : null;
      rows.push([
        s.date, staffName(s.staffId), s.role || '',
        s.start || '', s.end || '',
        ev ? ev.title : '', s.notes || '',
      ]);
    });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `brunsviga-dienstplan-${isoToday()}.csv`;
  a.click();
}

// ── Init ──────────────────────────────────────

load();
initTabs();
renderAll();
