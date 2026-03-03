// ──────────────────────────────────────────────
// Brunsviga — Dienstplan & Eventplanung
// Vanilla JS · localStorage + GitHub Gist Sync
// ──────────────────────────────────────────────

const STORE_KEY      = 'brunsviga_data';
const GIST_TOKEN_KEY = 'brunsviga_gist_token';
const GIST_ID_KEY    = 'brunsviga_gist_id';
const GIST_FILE      = 'brunsviga-data.json';

const ROLES = [
  'Leitung', 'Barkeeper', 'Service', 'Kasse', 'Technik',
  'Bühne', 'Security', 'Springer', 'Extern',
  'Veranstalter', 'Eintreffen Technik', 'Einlass', 'Show',
  'Krank', 'Frei', 'Schule',
];
const ABSENCE_ROLES  = new Set(['Krank', 'Frei', 'Schule']);
const ABSENCE_COLORS = { Krank: '#c0392b', Frei: '#27ae60', Schule: '#2980b9' };
const EVENT_TYPES = [
  'Konzert', 'Comedy', 'Theater', 'Kabarett', 'Party',
  'Lesung', 'Workshop', 'Probe', 'Privat', 'Sonstiges'
];

const STAFF_COLORS = [
  '#e94560', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#16a085',
];

// ── State ─────────────────────────────────────

let data = {
  lastModified: 0,
  staff:  [],   // { id, name, role, phone, notes, active }
  events: [],   // { id, title, date, start, end, type, notes, requiredStaff[], assignedStaff[] }
  shifts: [],   // { id, staffId, eventId|null, date, start, end, role, notes }
};

let editingId  = null;
let gistTimer  = null;
let rosterView = 'week';   // 'day' | 'week' | 'month'
let rosterDate = isoDate(new Date());

// ── Security: HTML escaping (XSS prevention) ──

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── ID generator ──────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Persistence ───────────────────────────────

function save() {
  data.lastModified = Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  scheduleGistSync();
}

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidSchema(parsed)) data = parsed;
      else console.warn('Lokale Daten haben ungültiges Format — ignoriert.');
    } catch(e) {
      console.error('Lokale Daten konnten nicht gelesen werden:', e);
      setSyncStatus('error', 'Lokale Daten beschädigt');
    }
  }
  // Seed nur beim echten Erststart (events noch leer)
  if (data.events.length === 0) {
    if (typeof getSeedEvents === 'function') data.events = getSeedEvents();
    if (typeof getSeedStaff  === 'function') data.staff  = getSeedStaff();
    if (typeof getSeedShifts === 'function') data.shifts = getSeedShifts();
    if (data.events.length > 0 || data.staff.length > 0) {
      data.lastModified = Date.now();
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    }
  }
}

// ── Schema-Validierung (Gist + lokale Daten) ──

function isValidSchema(obj) {
  return obj && typeof obj === 'object'
    && Array.isArray(obj.staff)
    && Array.isArray(obj.events)
    && Array.isArray(obj.shifts);
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

function isoDate(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}
function isoToday()      { return isoDate(new Date()); }
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(t)   { return t || '—'; }
function staffName(id)   { const s = data.staff.find(x => x.id === id);  return s ? s.name : '?'; }

function weekDays() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return isoDate(d);
  });
}

// ── DASHBOARD ─────────────────────────────────

function renderDashboard() {
  const today    = isoToday();
  const upcoming = data.events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  document.getElementById('stat-staff').textContent         = data.staff.filter(s => s.active !== false).length;
  document.getElementById('stat-events').textContent        = data.events.length;
  document.getElementById('stat-upcoming').textContent      = upcoming.length;
  document.getElementById('stat-shifts-today').textContent  = data.shifts.filter(s => s.date === today).length;

  const ul = document.getElementById('upcoming-events');
  if (upcoming.length === 0) {
    ul.innerHTML = '<div class="empty-state">Keine bevorstehenden Events.</div>';
  } else {
    ul.innerHTML = upcoming.map(ev => {
      const assigned = (ev.assignedStaff || []).length;
      const required = (ev.requiredStaff  || []).reduce((s, r) => s + r.count, 0);
      const sc = assigned >= required ? 'badge-green' : assigned > 0 ? 'badge-amber' : 'badge-red';
      const st = assigned >= required ? 'Besetzt' : assigned > 0 ? 'Teilbesetzt' : 'Offen';
      const veranst = ev.veranstalter ? ` · ${esc(ev.veranstalter)}` : '';
      const technik = data.shifts
        .filter(s => s.date === ev.date && (s.role === 'Technik' || s.role === 'Eintreffen Technik'))
        .map(s => staffName(s.staffId)).filter(n => n !== '?');
      const techStr = technik.length ? ` · 🔧 ${technik.join(', ')}` : '';
      return `<div class="item item-clickable" data-id="${esc(ev.id)}"
          onclick="openAssignModal(this.dataset.id)"
          onmouseenter="showEvTooltip(event,this.dataset.id)"
          onmouseleave="hideTooltip()">
        <div class="item-info">
          <div class="item-title">${esc(ev.title)}</div>
          <div class="item-meta">${esc(formatDate(ev.date))} · ${esc(formatTime(ev.start))}–${esc(formatTime(ev.end))} · ${esc(ev.type || '')}${veranst}${techStr}</div>
        </div>
        <span class="badge ${sc}">${st}</span>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" data-id="${esc(ev.id)}"
            onclick="event.stopPropagation();openEventModal(this.dataset.id)">✏</button>
        </div>
      </div>`;
    }).join('');
  }

  renderWeekStrip();
}

function renderWeekStrip() {
  const today = isoToday();
  document.getElementById('week-strip').innerHTML = weekDays().map(iso => {
    const dayEvents = data.events.filter(e => e.date === iso);
    const d = new Date(iso + 'T00:00:00');
    const evHTML = dayEvents.map(ev =>
      `<div class="day-event" title="${esc(ev.title)}" data-id="${esc(ev.id)}" onclick="openEventModal(this.dataset.id)">${esc(ev.title)}</div>`
    ).join('') || '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">—</div>';
    return `<div class="day-col ${iso === today ? 'today' : ''}">
      <div class="day-header">${d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
      <div class="day-date">${d.getDate()}</div>
      ${evHTML}
    </div>`;
  }).join('');
}

// ── PERSONAL ──────────────────────────────────

function renderStaff() {
  const list   = document.getElementById('staff-list');
  const active = data.staff.filter(s => s.active !== false);
  const inactive = data.staff.filter(s => s.active === false);
  if (data.staff.length === 0) {
    list.innerHTML = '<div class="empty-state">Noch kein Personal angelegt.</div>';
    return;
  }
  const today2 = isoToday();
  list.innerHTML = [...active, ...inactive].map(s => {
    const off = s.active === false;
    const nextShift = data.shifts
      .filter(sh => sh.staffId === s.id && sh.date >= today2 && !ABSENCE_ROLES.has(sh.role))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start||'').localeCompare(b.start||''))[0];
    const nextStr = nextShift
      ? `Nächste Schicht: ${esc(formatDate(nextShift.date))} ${esc(nextShift.start||'')}${nextShift.role ? ` · ${esc(nextShift.role)}` : ''}`
      : 'Keine Schichten geplant';
    return `<div class="item" style="${off ? 'opacity:0.5' : ''}">
      <div class="item-info">
        <div class="item-title">${esc(s.name)} ${off ? '<span class="badge badge-gray">Inaktiv</span>' : ''}</div>
        <div class="item-meta">${esc(s.role || '—')}${s.phone ? ' · ' + esc(s.phone) : ''}</div>
        <div class="item-meta" style="color:#666">${nextStr}</div>
        ${s.notes ? `<div class="item-meta">${esc(s.notes)}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" data-id="${esc(s.id)}" onclick="openStaffModal(this.dataset.id)">Bearbeiten</button>
        <button class="btn btn-danger btn-sm" data-id="${esc(s.id)}" onclick="deleteStaff(this.dataset.id)">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openStaffModal(id) {
  editingId = id || null;
  const s = id ? data.staff.find(x => x.id === id) : null;
  document.getElementById('staff-modal-title').textContent = s ? 'Personal bearbeiten' : 'Neues Personal';
  document.getElementById('sf-name').value   = s ? s.name        : '';
  document.getElementById('sf-phone').value  = s ? (s.phone || '') : '';
  document.getElementById('sf-notes').value  = s ? (s.notes || '') : '';
  document.getElementById('sf-role').value   = s ? (s.role  || ROLES[0]) : ROLES[0];
  document.getElementById('sf-active').checked = s ? (s.active !== false) : true;
  document.getElementById('staff-modal').classList.add('open');
}

function saveStaffModal() {
  const name = document.getElementById('sf-name').value.trim();
  if (!name) { alert('Name ist erforderlich.'); return; }
  const entry = {
    name,
    role:   document.getElementById('sf-role').value,
    phone:  document.getElementById('sf-phone').value.trim(),
    notes:  document.getElementById('sf-notes').value.trim(),
    active: document.getElementById('sf-active').checked,
  };
  if (editingId) {
    const idx = data.staff.findIndex(x => x.id === editingId);
    data.staff[idx] = { ...data.staff[idx], ...entry };
  } else {
    data.staff.push({ id: uid(), ...entry });
  }
  save(); closeModal('staff-modal'); renderAll();
}

function deleteStaff(id) {
  const s = data.staff.find(x => x.id === id);
  if (!confirm(`"${s ? s.name : 'Person'}" wirklich löschen?\n\nAlle Schichten dieser Person werden ebenfalls entfernt.`)) return;
  data.staff  = data.staff.filter(s => s.id !== id);
  data.shifts = data.shifts.filter(s => s.staffId !== id);
  data.events.forEach(ev => {
    ev.assignedStaff = (ev.assignedStaff || []).filter(sid => sid !== id);
  });
  save(); renderAll();
}

// ── EVENTS ────────────────────────────────────

function renderEvents() {
  const list   = document.getElementById('events-list');
  const today  = isoToday();
  const filter = document.getElementById('events-filter').value;
  let evs = [...data.events].sort((a, b) => a.date.localeCompare(b.date));
  if (filter === 'upcoming') evs = evs.filter(e => e.date >= today);
  else if (filter === 'past') evs = evs.filter(e => e.date < today);

  if (evs.length === 0) {
    list.innerHTML = '<div class="empty-state">Keine Events vorhanden.</div>';
    return;
  }
  list.innerHTML = evs.map(ev => {
    const assigned = (ev.assignedStaff || []).length;
    const required = (ev.requiredStaff  || []).reduce((s, r) => s + r.count, 0);
    const sc = assigned >= required ? 'badge-green' : assigned > 0 ? 'badge-amber' : 'badge-red';
    const st = assigned >= required ? 'Besetzt' : `${assigned}/${required}`;
    const veranst = ev.veranstalter ? `<span style="color:#888;font-size:0.75rem"> · ${esc(ev.veranstalter)}</span>` : '';
    return `<div class="item" data-id="${esc(ev.id)}"
        onmouseenter="showEvTooltip(event,this.dataset.id)"
        onmouseleave="hideTooltip()">
      <div class="item-info">
        <div class="item-title">${esc(ev.title)}${veranst}</div>
        <div class="item-meta">${esc(formatDate(ev.date))} · ${esc(formatTime(ev.start))}–${esc(formatTime(ev.end))} · <span class="badge badge-blue">${esc(ev.type || 'Sonstiges')}</span></div>
        ${ev.notes ? `<div class="item-meta">${esc(ev.notes)}</div>` : ''}
      </div>
      <span class="badge ${sc}">${st} Personal</span>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" data-id="${esc(ev.id)}" onclick="openAssignModal(this.dataset.id)">Besetzung</button>
        <button class="btn btn-ghost btn-sm"     data-id="${esc(ev.id)}" onclick="openEventModal(this.dataset.id)">Bearbeiten</button>
        <button class="btn btn-danger btn-sm"    data-id="${esc(ev.id)}" onclick="deleteEvent(this.dataset.id)">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openEventModal(id) {
  editingId = id || null;
  const ev = id ? data.events.find(x => x.id === id) : null;
  document.getElementById('event-modal-title').textContent = ev ? 'Event bearbeiten' : 'Neues Event';
  document.getElementById('ef-title').value      = ev ? ev.title              : '';
  document.getElementById('ef-date').value       = ev ? ev.date               : isoToday();
  document.getElementById('ef-start').value      = ev ? (ev.start || '')      : '20:00';
  document.getElementById('ef-end').value        = ev ? (ev.end   || '')      : '23:00';
  document.getElementById('ef-notes').value      = ev ? (ev.notes || '')      : '';
  document.getElementById('ef-type').value       = ev ? (ev.type  || EVENT_TYPES[0]) : EVENT_TYPES[0];
  document.getElementById('ef-veranstalter').value = ev ? (ev.veranstalter || '') : '';
  renderRequiredStaffRows(ev ? (ev.requiredStaff || []) : []);
  document.getElementById('event-modal').classList.add('open');
}

function renderRequiredStaffRows(rows) {
  document.getElementById('required-staff-rows').innerHTML = rows.map((r, i) =>
    buildRequiredStaffRow(r.role, r.count, i)
  ).join('');
}

function buildRequiredStaffRow(role = '', count = 1, i = Date.now()) {
  const opts = ROLES.map(r => `<option value="${esc(r)}" ${r === role ? 'selected' : ''}>${esc(r)}</option>`).join('');
  return `<div class="form-row required-staff-row" data-idx="${i}">
    <div class="form-group" style="flex:2"><select class="rs-role">${opts}</select></div>
    <div class="form-group" style="flex:1"><input type="number" class="rs-count" min="1" max="20" value="${esc(count)}" /></div>
    <button class="btn btn-ghost btn-sm" style="align-self:flex-end;margin-bottom:12px"
      onclick="this.closest('.required-staff-row').remove()">✕</button>
  </div>`;
}

function addRequiredStaffRow() {
  const div = document.createElement('div');
  div.innerHTML = buildRequiredStaffRow();
  document.getElementById('required-staff-rows').appendChild(div.firstElementChild);
}

function saveEventModal() {
  const title = document.getElementById('ef-title').value.trim();
  if (!title) { alert('Titel ist erforderlich.'); return; }
  const rows = [...document.querySelectorAll('.required-staff-row')].map(row => ({
    role:  row.querySelector('.rs-role').value,
    count: parseInt(row.querySelector('.rs-count').value) || 1,
  }));
  const evData = {
    title,
    date:          document.getElementById('ef-date').value,
    start:         document.getElementById('ef-start').value,
    end:           document.getElementById('ef-end').value,
    type:          document.getElementById('ef-type').value,
    notes:         document.getElementById('ef-notes').value.trim(),
    veranstalter:  document.getElementById('ef-veranstalter').value.trim(),
    requiredStaff: rows,
  };
  if (editingId) {
    const idx = data.events.findIndex(x => x.id === editingId);
    data.events[idx] = { ...data.events[idx], ...evData };
  } else {
    data.events.push({ id: uid(), ...evData, assignedStaff: [] });
  }
  save(); closeModal('event-modal'); renderAll();
}

function deleteEvent(id) {
  const ev = data.events.find(x => x.id === id);
  if (!confirm(`"${ev ? ev.title : 'Event'}" wirklich löschen?\n\nVerknüpfte Schichten werden ebenfalls entfernt.`)) return;
  data.events = data.events.filter(e => e.id !== id);
  data.shifts = data.shifts.filter(s => s.eventId !== id);
  save(); renderAll();
}

// ── BESETZUNG ─────────────────────────────────

function openAssignModal(eventId) {
  const ev = data.events.find(x => x.id === eventId);
  if (!ev) return;
  editingId = eventId;
  document.getElementById('assign-event-name').textContent =
    `${ev.title} — ${formatDate(ev.date)}`;

  const req = ev.requiredStaff || [];
  const summary = document.getElementById('assign-required-summary');
  if (req.length > 0) {
    summary.textContent = 'Benötigt: ' + req.map(r => `${r.count}× ${r.role}`).join(', ');
  } else {
    summary.textContent = '';
  }

  const activeStaff = data.staff.filter(s => s.active !== false);
  const container   = document.getElementById('assign-staff-list');
  if (activeStaff.length === 0) {
    container.innerHTML = '<div class="empty-state">Noch kein aktives Personal angelegt.</div>';
  } else {
    container.innerHTML = activeStaff.map(s => {
      const checked = (ev.assignedStaff || []).includes(s.id);
      return `<div class="item">
        <input type="checkbox" id="asgn-${esc(s.id)}" value="${esc(s.id)}"
          ${checked ? 'checked' : ''} style="width:auto;margin-right:8px">
        <label for="asgn-${esc(s.id)}" class="item-info" style="cursor:pointer">
          <div class="item-title">${esc(s.name)}</div>
          <div class="item-meta">${esc(s.role || '—')}</div>
        </label>
      </div>`;
    }).join('');
  }
  document.getElementById('assign-modal').classList.add('open');
}

function saveAssignModal() {
  const ev = data.events.find(x => x.id === editingId);
  if (!ev) return;
  ev.assignedStaff = [...document.querySelectorAll('#assign-staff-list input[type=checkbox]:checked')]
    .map(cb => cb.value);
  save(); closeModal('assign-modal'); renderAll();
}

// ── DIENSTPLAN ────────────────────────────────

function staffColor(id) {
  const idx = data.staff.findIndex(s => s.id === id);
  return STAFF_COLORS[Math.max(0, idx) % STAFF_COLORS.length];
}

function shiftColor(shift) {
  if (ABSENCE_ROLES.has(shift.role)) return ABSENCE_COLORS[shift.role] || '#888';
  return staffColor(shift.staffId);
}

function weekStart(iso) {
  const d   = new Date(iso + 'T00:00:00');
  const dow = d.getDay();                    // 0=So … 6=Sa
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));  // zurück auf Montag
  return d;
}

function setRosterView(view) {
  rosterView = view;
  document.querySelectorAll('.view-btn').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-ghost', !active);
  });
  renderRoster();
}

function rosterNav(dir) {
  const d = new Date(rosterDate + 'T00:00:00');
  if      (rosterView === 'day')   d.setDate(d.getDate() + dir);
  else if (rosterView === 'week')  d.setDate(d.getDate() + dir * 7);
  else                             d.setMonth(d.getMonth() + dir);
  rosterDate = isoDate(d);
  renderRoster();
}

function rosterNavToday() {
  rosterDate = isoToday();
  renderRoster();
}

function renderRoster() {
  // Nav label
  const d = new Date(rosterDate + 'T00:00:00');
  const el = document.getElementById('roster-nav-label');
  if (el) {
    if (rosterView === 'day') {
      el.textContent = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    } else if (rosterView === 'week') {
      const mon = weekStart(rosterDate);
      const sun = new Date(mon.getTime() + 6 * 86400000);
      el.textContent = `${mon.getDate()}.${mon.getMonth()+1}. – ${sun.getDate()}.${sun.getMonth()+1}.${sun.getFullYear()}`;
    } else {
      el.textContent = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    }
  }
  if      (rosterView === 'day')   renderRosterDay();
  else if (rosterView === 'week')  renderRosterWeek();
  else                             renderRosterMonth();
}

function renderRosterDay() {
  const shifts    = data.shifts
    .filter(s => s.date === rosterDate)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const dayEvents = data.events.filter(e => e.date === rosterDate);
  const container = document.getElementById('roster-content');

  let html = '';
  // Events des Tages als Info-Header
  if (dayEvents.length > 0) {
    html += '<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px">';
    dayEvents.forEach(ev => {
      const veranst = ev.veranstalter ? ` · ${esc(ev.veranstalter)}` : '';
      html += `<div class="item" style="flex:1;min-width:200px;cursor:pointer"
          data-id="${esc(ev.id)}"
          onclick="openAssignModal(this.dataset.id)"
          onmouseenter="showEvTooltip(event,this.dataset.id)"
          onmouseleave="hideTooltip()">
        <div class="item-info">
          <div class="item-title">${esc(ev.title)}</div>
          <div class="item-meta">${esc(formatTime(ev.start))} Einlass · ${esc(formatTime(ev.end))} Ende · ${esc(ev.type||'')}${veranst}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-id="${esc(ev.id)}"
          onclick="event.stopPropagation();openEventModal(this.dataset.id)">✏</button>
      </div>`;
    });
    html += '</div>';
  }

  if (shifts.length === 0) {
    html += '<div class="empty-state">Keine Schichten für diesen Tag.</div>';
    container.innerHTML = html;
    return;
  }
  // Fallback-Event für Schichten ohne eventId (erster Event des Tages)
  const fallbackEv = dayEvents[0] || null;
  html += `<table class="roster-table">
    <thead><tr>
      <th>Name</th><th>Rolle</th><th>Uhrzeit</th><th>Veranstaltung</th><th>Notiz</th><th></th>
    </tr></thead>
    <tbody>${shifts.map(s => {
      const ev    = s.eventId ? data.events.find(x => x.id === s.eventId) : fallbackEv;
      const color = staffColor(s.staffId);
      return `<tr>
        <td><strong style="color:${esc(color)}">${esc(staffName(s.staffId))}</strong></td>
        <td><span class="badge badge-blue">${esc(s.role || '—')}</span></td>
        <td>${esc(formatTime(s.start))} – ${esc(formatTime(s.end))}</td>
        <td>${ev ? esc(ev.title) : '—'}</td>
        <td>${esc(s.notes || '')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-id="${esc(s.id)}" onclick="openShiftModal(this.dataset.id)">✏</button>
          <button class="btn btn-danger btn-sm" data-id="${esc(s.id)}" onclick="deleteShift(this.dataset.id)">✕</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  container.innerHTML = html;
}

function renderRosterWeek() {
  const mon    = weekStart(rosterDate);
  const today  = isoToday();
  const days   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon.getTime() + i * 86400000);
    return isoDate(d);
  });
  const active = data.staff.filter(s => s.active !== false);
  const container = document.getElementById('roster-content');
  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state">Kein Personal angelegt.</div>';
    return;
  }
  let html = '<div class="week-grid">';
  // Header
  html += '<div class="week-cell-header"></div>';
  days.forEach(iso => {
    const d = new Date(iso + 'T00:00:00');
    const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    html += `<div class="week-cell-header${iso === today ? ' today' : ''}">${esc(label)}</div>`;
  });
  // Veranstaltungs-Zeile
  html += '<div class="week-staff-label" style="color:#d5bfff;font-weight:700;border-left:3px solid #8b68e0;background:rgba(83,52,131,0.3)">📅 Veranstaltung</div>';
  days.forEach(iso => {
    const dayEvs = data.events.filter(e => e.date === iso);
    html += `<div class="week-cell${iso === today ? ' today' : ''}" style="background:rgba(83,52,131,0.1)">`;
    if (dayEvs.length === 0) {
      html += '<div style="font-size:0.65rem;color:#444;text-align:center;padding:4px">—</div>';
    }
    dayEvs.forEach(ev => {
      const veranstStr = ev.veranstalter ? ` · ${esc(ev.veranstalter)}` : '';
      html += `<div class="week-event-row" data-id="${esc(ev.id)}"
          onclick="openAssignModal(this.dataset.id)"
          onmouseenter="showEvTooltip(event,this.dataset.id)"
          onmouseleave="hideTooltip()">${esc(ev.title)}${veranstStr}</div>`;
    });
    html += '</div>';
  });
  // Rows per staff
  active.forEach(staff => {
    const color = staffColor(staff.id);
    html += `<div class="week-staff-label" style="border-left:3px solid ${esc(color)}">${esc(staff.name)}</div>`;
    days.forEach(iso => {
      const dayShifts = data.shifts.filter(s => s.staffId === staff.id && s.date === iso);
      html += `<div class="week-cell${iso === today ? ' today' : ''}">`;
      dayShifts.forEach(shift => {
        const sc     = shiftColor(shift);
        const isAbs  = ABSENCE_ROLES.has(shift.role);
        const label  = isAbs ? esc(shift.role) : `${esc(shift.start)}–${esc(shift.end)}`;
        html += `<div class="shift-pill" style="background:${esc(sc)}"
            data-id="${esc(shift.id)}"
            onmouseenter="showShiftTooltip(event,this.dataset.id)"
            onmouseleave="hideTooltip()">${label}</div>`;
      });
      html += '</div>';
    });
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderRosterMonth() {
  const d        = new Date(rosterDate + 'T00:00:00');
  const year     = d.getFullYear();
  const month    = d.getMonth();
  const today    = isoToday();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const container = document.getElementById('roster-content');

  let html = '<div class="month-view">';
  ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(n => {
    html += `<div class="month-weekday-header">${n}</div>`;
  });
  for (let i = 0; i < startPad; i++) html += '<div class="month-day-cell other-month"></div>';
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const iso    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = iso === today;
    const dayShifts = data.shifts.filter(s => s.date === iso);
    const dayEvs    = data.events.filter(e => e.date === iso);
    html += `<div class="month-day-cell${isToday ? ' today' : ''}" data-iso="${esc(iso)}" onclick="rosterDate=this.dataset.iso;setRosterView('day')">`;
    html += `<div class="month-day-num">${day}</div>`;
    dayEvs.forEach(ev => {
      html += `<div class="month-event-label" data-id="${esc(ev.id)}"
          onclick="event.stopPropagation();openAssignModal(this.dataset.id)"
          onmouseenter="showEvTooltip(event,this.dataset.id)"
          onmouseleave="hideTooltip()">${esc(ev.title)}</div>`;
    });
    dayShifts.forEach(shift => {
      const color  = shiftColor(shift);
      const name   = staffName(shift.staffId);
      const isAbs  = ABSENCE_ROLES.has(shift.role);
      const label  = isAbs ? `${name.split(' ')[0]} · ${shift.role}` : `${name.split(' ')[0]} ${shift.start}`;
      html += `<div class="month-shift-dot" style="background:${esc(color)}"
          data-id="${esc(shift.id)}"
          onmouseenter="showShiftTooltip(event,this.dataset.id)"
          onmouseleave="hideTooltip()">${esc(label)}</div>`;
    });
    html += '</div>';
  }
  const used = startPad + lastDay.getDate();
  const endPad = used % 7 === 0 ? 0 : 7 - (used % 7);
  for (let i = 0; i < endPad; i++) html += '<div class="month-day-cell other-month"></div>';
  html += '</div>';
  container.innerHTML = html;
}

function openShiftModal(id) {
  editingId = id || null;
  const s = id ? data.shifts.find(x => x.id === id) : null;
  document.getElementById('shift-modal-title').textContent = s ? 'Schicht bearbeiten' : 'Neue Schicht';
  document.getElementById('shf-date').value  = s ? s.date         : (rosterDate || isoToday());
  document.getElementById('shf-start').value = s ? (s.start || '') : '18:00';
  document.getElementById('shf-end').value   = s ? (s.end   || '') : '23:00';
  document.getElementById('shf-notes').value = s ? (s.notes || '') : '';
  document.getElementById('shf-role').value  = s ? (s.role  || ROLES[0]) : ROLES[0];

  const activeStaff = data.staff.filter(x => x.active !== false);
  document.getElementById('shf-staff').innerHTML =
    '<option value="">— Personal wählen —</option>' +
    activeStaff.map(p =>
      `<option value="${esc(p.id)}" ${s && s.staffId === p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.role || '—')})</option>`
    ).join('');

  updateShiftEventDropdown(document.getElementById('shf-date').value, s ? s.eventId : null);
  document.getElementById('shift-modal').classList.add('open');
}

function updateShiftEventDropdown(dateVal, selectedEventId) {
  const dayEvents = data.events.filter(e => e.date === dateVal);
  document.getElementById('shf-event').innerHTML =
    '<option value="">— Kein Event —</option>' +
    dayEvents.map(e =>
      `<option value="${esc(e.id)}" ${e.id === selectedEventId ? 'selected' : ''}>${esc(e.title)}</option>`
    ).join('');
}

function saveShiftModal() {
  const staffId = document.getElementById('shf-staff').value;
  if (!staffId) { alert('Bitte Personal wählen.'); return; }
  const shiftData = {
    staffId,
    date:    document.getElementById('shf-date').value,
    start:   document.getElementById('shf-start').value,
    end:     document.getElementById('shf-end').value,
    role:    document.getElementById('shf-role').value,
    eventId: document.getElementById('shf-event').value || null,
    notes:   document.getElementById('shf-notes').value.trim(),
  };
  if (editingId) {
    const idx = data.shifts.findIndex(x => x.id === editingId);
    data.shifts[idx] = { ...data.shifts[idx], ...shiftData };
  } else {
    data.shifts.push({ id: uid(), ...shiftData });
  }
  save(); closeModal('shift-modal'); renderRoster();
}

function deleteShift(id) {
  const s = data.shifts.find(x => x.id === id);
  const name = s ? staffName(s.staffId) : 'Schicht';
  const date = s ? ` am ${formatDate(s.date)}` : '';
  if (!confirm(`Schicht von "${name}"${date} wirklich löschen?`)) return;
  data.shifts = data.shifts.filter(s => s.id !== id);
  save(); renderRoster();
}

// ── Modal helpers ─────────────────────────────

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editingId = null;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    editingId = null;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('shf-date');
  if (dateInput) {
    dateInput.addEventListener('change', () =>
      updateShiftEventDropdown(dateInput.value, null)
    );
  }
});

// ── Render all ────────────────────────────────

function renderAll() {
  renderDashboard();
  renderStaff();
  renderEvents();
  renderRoster();
}

// ── CSV Export ────────────────────────────────

function escCSV(val) {
  const str = String(val == null ? '' : val);
  // Prevent formula injection in Excel/Calc
  const safe = str.match(/^[=+@\-]/) ? "'" + str : str;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function exportRosterCSV() {
  const rows = [['Datum', 'Name', 'Rolle', 'Von', 'Bis', 'Event', 'Notiz']];
  data.shifts
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
    .forEach(s => {
      const ev = s.eventId ? data.events.find(x => x.id === s.eventId) : null;
      rows.push([s.date, staffName(s.staffId), s.role || '', s.start || '', s.end || '',
        ev ? ev.title : '', s.notes || '']);
    });
  downloadBlob(
    '\uFEFF' + rows.map(r => r.map(escCSV).join(';')).join('\n'),
    `brunsviga-dienstplan-${isoToday()}.csv`,
    'text/csv;charset=utf-8'
  );
}

function downloadBlob(content, filename, type) {
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([content], { type })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── JSON Vollbackup ───────────────────────────

function downloadJSONBackup() {
  downloadBlob(
    JSON.stringify(data, null, 2),
    `brunsviga-backup-${isoToday()}.json`,
    'application/json'
  );
}

function restoreFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!isValidSchema(imported)) { alert('Ungültige Backup-Datei.'); return; }
        if (!confirm(`Backup vom ${new Date(imported.lastModified || 0).toLocaleString('de-DE')} laden?\n\nAktuelle Daten werden überschrieben.`)) return;
        data = imported;
        save();
        renderAll();
        alert('✓ Backup erfolgreich geladen.');
      } catch(err) {
        alert('Fehler beim Lesen der Backup-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── CSV Import (Personal / Events) ───────────

function parseCSV(text) {
  return text.trim().split('\n').map(line =>
    line.split(';').map(cell => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
  );
}

function importStaffCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const rows = parseCSV(evt.target.result);
        const header = rows[0].map(h => h.toLowerCase().trim());
        const iName  = header.indexOf('name');
        if (iName === -1) { alert('Spalte "Name" nicht gefunden.'); return; }
        const iRole  = header.indexOf('rolle');
        const iPhone = header.indexOf('telefon');
        const iNotes = header.indexOf('notizen');
        const iActive = header.indexOf('aktiv');
        let added = 0, updated = 0;
        rows.slice(1).forEach(row => {
          if (!row[iName] || !row[iName].trim()) return;
          const name = row[iName].trim();
          const entry = {
            name,
            role:   iRole   >= 0 ? (row[iRole]   || '').trim() : '',
            phone:  iPhone  >= 0 ? (row[iPhone]  || '').trim() : '',
            notes:  iNotes  >= 0 ? (row[iNotes]  || '').trim() : '',
            active: iActive >= 0 ? row[iActive].trim().toLowerCase() !== 'nein' : true,
          };
          const existing = data.staff.find(s => s.name.toLowerCase() === name.toLowerCase());
          if (existing) { Object.assign(existing, entry); updated++; }
          else           { data.staff.push({ id: uid(), ...entry }); added++; }
        });
        save(); renderAll(); closeModal('settings-modal');
        alert(`✓ Personal importiert: ${added} neu, ${updated} aktualisiert.`);
      } catch(err) { alert('Fehler beim Import: ' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
  };
  input.click();
}

function importEventsCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const rows = parseCSV(evt.target.result);
        const header = rows[0].map(h => h.toLowerCase().trim());
        const iTitle = header.indexOf('titel');
        if (iTitle === -1) { alert('Spalte "Titel" nicht gefunden.'); return; }
        const iDate  = header.indexOf('datum');
        const iStart = header.indexOf('beginn');
        const iEnd   = header.indexOf('ende');
        const iType  = header.indexOf('typ');
        const iNotes = header.indexOf('notizen');
        let added = 0, skipped = 0;
        rows.slice(1).forEach(row => {
          const title = (row[iTitle] || '').trim();
          const date  = (iDate  >= 0 ? row[iDate]  : '').trim();
          if (!title || !date) { skipped++; return; }
          const existing = data.events.find(e => e.title === title && e.date === date);
          if (existing) { skipped++; return; }
          data.events.push({
            id: uid(), title, date,
            start:          iStart >= 0 ? (row[iStart] || '').trim() : '',
            end:            iEnd   >= 0 ? (row[iEnd]   || '').trim() : '',
            type:           iType  >= 0 ? (row[iType]  || '').trim() : 'Sonstiges',
            notes:          iNotes >= 0 ? (row[iNotes] || '').trim() : '',
            requiredStaff:  [],
            assignedStaff:  [],
          });
          added++;
        });
        save(); renderAll(); closeModal('settings-modal');
        alert(`✓ Events importiert: ${added} neu, ${skipped} übersprungen (doppelt oder kein Datum).`);
      } catch(err) { alert('Fehler beim Import: ' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
  };
  input.click();
}

function downloadStaffTemplate() {
  downloadBlob(
    'Name;Rolle;Telefon;Notizen;Aktiv\nMax Mustermann;Service;+49 170 1234567;Nur freitags;Ja\n',
    'brunsviga-personal-vorlage.csv', 'text/csv;charset=utf-8'
  );
}

function downloadEventsTemplate() {
  downloadBlob(
    'Titel;Datum;Beginn;Ende;Typ;Notizen\nAbendveranstaltung;2026-04-01;20:00;23:00;Comedy;Zusatzinfos hier\n',
    'brunsviga-events-vorlage.csv', 'text/csv;charset=utf-8'
  );
}

// ── GitHub Gist Sync ───────────────────────────

function setSyncStatus(status, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const cfg = {
    idle:    { icon: '☁', color: '#555' },
    syncing: { icon: '↑', color: '#f39c12' },
    synced:  { icon: '✓', color: '#2ecc71' },
    error:   { icon: '✗', color: '#e74c3c' },
  }[status] || { icon: '?', color: '#888' };
  el.textContent = '';
  const span = document.createElement('span');
  span.style.cssText = `color:${cfg.color};font-size:0.82rem`;
  span.textContent   = `${cfg.icon} ${msg || ''}`;
  el.appendChild(span);
}

async function pushToGist() {
  const token  = localStorage.getItem(GIST_TOKEN_KEY);
  let   gistId = localStorage.getItem(GIST_ID_KEY);
  if (!token) return;
  setSyncStatus('syncing', 'Speichere…');
  const payload = { files: { [GIST_FILE]: { content: JSON.stringify(data, null, 2) } } };
  if (!gistId) { payload.description = 'Brunsviga Dienstplan Backup'; payload.public = false; }
  try {
    const r = await fetch(
      gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists',
      { method: gistId ? 'PATCH' : 'POST',
        headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!gistId) {
      localStorage.setItem(GIST_ID_KEY, j.id);
      const el = document.getElementById('cfg-gist-id');
      if (el) el.value = j.id;
    }
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    setSyncStatus('synced', 'Gesichert ' + t);
  } catch(e) {
    setSyncStatus('error', 'Sync fehlgeschlagen');
    console.error('Gist push failed', e);
  }
}

function scheduleGistSync() {
  if (!localStorage.getItem(GIST_TOKEN_KEY)) return;
  if (gistTimer) clearTimeout(gistTimer);
  gistTimer = setTimeout(pushToGist, 2000);
}

async function pullFromGist() {
  const token  = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  if (!token || !gistId) return;
  setSyncStatus('syncing', 'Lade…');
  try {
    const r = await fetch(`https://api.github.com/gists/${gistId}`,
      { headers: { Authorization: 'token ' + token } }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j    = await r.json();
    const file = j.files[GIST_FILE];
    if (!file) throw new Error('Datei nicht gefunden');
    const remote = JSON.parse(file.content);
    if (!isValidSchema(remote)) throw new Error('Ungültiges Datenformat im Gist');
    if ((remote.lastModified || 0) > (data.lastModified || 0)) {
      data = remote;
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      renderAll();
    }
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    setSyncStatus('synced', 'Geladen ' + t);
  } catch(e) {
    setSyncStatus('error', 'Ladefehler');
    console.error('Gist pull failed', e);
  }
}

// ── Versionshistorie ──────────────────────────

async function loadVersionHistory() {
  const token  = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  const el     = document.getElementById('version-list');
  if (!token || !gistId) {
    el.innerHTML = '<div style="color:#888;font-size:0.85rem">Cloud-Backup muss zuerst eingerichtet sein.</div>';
    return;
  }
  el.innerHTML = '<div style="color:#888;font-size:0.85rem">Lade Versionen…</div>';
  try {
    const r = await fetch(`https://api.github.com/gists/${gistId}`,
      { headers: { Authorization: 'token ' + token } }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const history = (j.history || []).slice(0, 20);
    if (history.length === 0) {
      el.innerHTML = '<div style="color:#888;font-size:0.85rem">Noch keine Versionen vorhanden.</div>';
      return;
    }
    el.innerHTML = history.map((v, i) => {
      const ts = new Date(v.committed_at).toLocaleString('de-DE');
      const added   = v.change_status ? v.change_status.additions : '';
      const deleted = v.change_status ? v.change_status.deletions : '';
      const label   = i === 0 ? ' <span style="color:var(--green);font-size:0.75rem">(aktuell)</span>' : '';
      return `<div class="item" style="padding:10px 12px">
        <div class="item-info">
          <div class="item-title" style="font-size:0.88rem">${esc(ts)}${label}</div>
          ${(added || deleted) ? `<div class="item-meta">+${added || 0} / -${deleted || 0} Zeichen</div>` : ''}
        </div>
        ${i > 0 ? `<button class="btn btn-ghost btn-sm" data-version="${esc(v.version)}" data-ts="${esc(ts)}"
          onclick="restoreVersion(this.dataset.version, this.dataset.ts)">Wiederherstellen</button>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:0.85rem">Fehler: ${esc(e.message)}</div>`;
  }
}

async function restoreVersion(version, label) {
  if (!confirm(`Version vom ${label} wiederherstellen?\n\nAktuelle Daten werden überschrieben — aber zuerst wird das aktuelle Backup gespeichert.`)) return;
  const token  = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  try {
    // Erst aktuelle Version sichern
    await pushToGist();
    const r = await fetch(`https://api.github.com/gists/${gistId}/${version}`,
      { headers: { Authorization: 'token ' + token } }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j    = await r.json();
    const file = j.files[GIST_FILE];
    if (!file) throw new Error('Datei nicht gefunden in dieser Version');
    const restored = JSON.parse(file.content);
    if (!isValidSchema(restored)) throw new Error('Ungültiges Datenformat');
    data = restored;
    save();   // Speichert und pusht wieder zu Gist
    renderAll();
    closeModal('settings-modal');
    alert(`✓ Version vom ${label} erfolgreich wiederhergestellt.`);
  } catch(e) {
    alert('Fehler beim Wiederherstellen: ' + e.message);
  }
}

// ── Einstellungen ─────────────────────────────

function openSettingsModal() {
  document.getElementById('cfg-token').value   = localStorage.getItem(GIST_TOKEN_KEY) || '';
  document.getElementById('cfg-gist-id').value = localStorage.getItem(GIST_ID_KEY)    || '';
  document.getElementById('version-list').innerHTML = '';
  document.getElementById('settings-modal').classList.add('open');
}

function saveSettings() {
  const token  = document.getElementById('cfg-token').value.trim();
  const gistId = document.getElementById('cfg-gist-id').value.trim();
  if (token)  localStorage.setItem(GIST_TOKEN_KEY, token);
  else        localStorage.removeItem(GIST_TOKEN_KEY);
  if (gistId) localStorage.setItem(GIST_ID_KEY, gistId);
  else        localStorage.removeItem(GIST_ID_KEY);
  closeModal('settings-modal');
  if (token) pushToGist();
}

function clearSettings() {
  if (!confirm('Gist-Verbindung trennen? Lokale Daten bleiben erhalten.')) return;
  localStorage.removeItem(GIST_TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  document.getElementById('cfg-token').value   = '';
  document.getElementById('cfg-gist-id').value = '';
  setSyncStatus('idle', '');
}

// ── Tooltip ───────────────────────────────────

function showEvTooltip(mouseEvent, evId) {
  const ev = data.events.find(x => x.id === evId);
  if (!ev) return;
  const names    = (ev.assignedStaff || []).map(id => staffName(id)).filter(n => n !== '?');
  const required = (ev.requiredStaff || []).map(r => `${r.count}× ${r.role}`).join(', ');
  const dayShifts = data.shifts
    .filter(s => s.date === ev.date && !ABSENCE_ROLES.has(s.role))
    .sort((a, b) => (a.start||'').localeCompare(b.start||''));
  const technik = dayShifts
    .filter(s => s.role === 'Technik' || s.role === 'Eintreffen Technik')
    .map(s => staffName(s.staffId)).filter(n => n !== '?');
  const absences = data.shifts
    .filter(s => s.date === ev.date && ABSENCE_ROLES.has(s.role))
    .map(s => `${staffName(s.staffId)} (${s.role})`);
  const t = document.getElementById('ev-tooltip');
  t.innerHTML =
    `<div class="tt-title">${esc(ev.title)}</div>` +
    `<div class="tt-meta">${esc(formatDate(ev.date))}</div>` +
    `<div class="tt-meta">${esc(formatTime(ev.start))} – ${esc(formatTime(ev.end))} · ${esc(ev.type || '')}</div>` +
    (ev.veranstalter ? `<div class="tt-meta">🏢 ${esc(ev.veranstalter)}</div>` : '') +
    (technik.length  ? `<div class="tt-meta" style="color:#f39c12">🔧 Technik: ${esc(technik.join(', '))}</div>` : '') +
    (ev.notes        ? `<div class="tt-note">${esc(ev.notes)}</div>` : '') +
    (required        ? `<div class="tt-note">Benötigt: ${esc(required)}</div>` : '') +
    (names.length    ? `<div class="tt-note">✓ Besetzt: ${esc(names.join(', '))}</div>` : '') +
    (dayShifts.length ? `<div class="tt-note"><strong>Dienstplan:</strong><br>` +
      dayShifts.map(s => {
        const c = staffColor(s.staffId);
        return `<span style="color:${esc(c)}">${esc(staffName(s.staffId))}</span>` +
          `: ${esc(s.start||'—')}–${esc(s.end||'—')}${s.role ? ` · ${esc(s.role)}` : ''}`;
      }).join('<br>') + '</div>' : '') +
    (absences.length ? `<div class="tt-note" style="color:#888">Abwesend: ${esc(absences.join(', '))}</div>` : '');
  positionTooltip(mouseEvent, t);
  t.style.display = 'block';
}

function showShiftTooltip(mouseEvent, shiftId) {
  const s = data.shifts.find(x => x.id === shiftId);
  if (!s) return;
  const ev     = s.eventId ? data.events.find(x => x.id === s.eventId) : null;
  const isAbs  = ABSENCE_ROLES.has(s.role);
  const color  = staffColor(s.staffId);
  const t      = document.getElementById('ev-tooltip');
  t.innerHTML  =
    `<div class="tt-title" style="color:${esc(color)}">${esc(staffName(s.staffId))}</div>` +
    (isAbs
      ? `<div class="tt-meta" style="color:${esc(ABSENCE_COLORS[s.role]||'#888')}">${esc(s.role)}</div>` +
        `<div class="tt-meta">${esc(formatDate(s.date))}</div>`
      : `<div class="tt-meta">${esc(formatDate(s.date))} · ${esc(s.start||'—')}–${esc(s.end||'—')}</div>` +
        (s.role ? `<div class="tt-meta">Rolle: ${esc(s.role)}</div>` : '')) +
    (ev ? `<div class="tt-note">📅 ${esc(ev.title)}</div>` : '') +
    (s.notes ? `<div class="tt-note">${esc(s.notes)}</div>` : '');
  positionTooltip(mouseEvent, t);
  t.style.display = 'block';
}

function positionTooltip(e, t) {
  const x = Math.min(e.clientX + 14, window.innerWidth  - 300);
  const y = Math.min(e.clientY + 14, window.innerHeight - 220);
  t.style.left = x + 'px';
  t.style.top  = y + 'px';
}

function hideTooltip() {
  const t = document.getElementById('ev-tooltip');
  if (t) t.style.display = 'none';
}

document.addEventListener('mousemove', e => {
  const t = document.getElementById('ev-tooltip');
  if (t && t.style.display !== 'none') positionTooltip(e, t);
});

// ── Select-Optionen einmalig befüllen ─────────

function populateStaticSelects() {
  const roleOpts  = ROLES.map(r       => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  const typeOpts  = EVENT_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  document.getElementById('sf-role').innerHTML  = roleOpts;
  document.getElementById('ef-type').innerHTML  = typeOpts;
  document.getElementById('shf-role').innerHTML = roleOpts;
}

// ── Init ──────────────────────────────────────

async function init() {
  populateStaticSelects();
  load();
  initTabs();
  renderAll();
  if (localStorage.getItem(GIST_TOKEN_KEY)) {
    await pullFromGist();
  } else {
    setSyncStatus('idle', '');
  }
}

init();
