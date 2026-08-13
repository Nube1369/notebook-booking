// ============================================
//  DASHBOARD.JS — IT Staff Dashboard (Admin)
//  ✨ Upgraded: Calendar (all statuses) + Export Excel (styled)
// ============================================

const SUPABASE_URL = 'https://nnnqshuptvirjbnesjvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubnFzaHVwdHZpcmpibmVzanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTIzNDIsImV4cCI6MjEwMTU2ODM0Mn0.gtAkjGe-rSrf5fzCwwcYgdLF68mNs5dRVTIODXo0Lag';

// ── Auth credentials (client-side gate) ──────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'pcadmin02';
const SESSION_KEY = 'nb_admin_auth';

// ── Time Slots (Single source of truth) ──────
// ถ้าต้องการเพิ่ม/ลดเวลา แก้ที่นี่ที่เดียวเลย (dashboard.js และ appointment.js)
const DASH_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30',
];

// ── Login Gate ───────────────────────────────
const loginOverlay = document.getElementById('login-overlay');
const loginForm    = document.getElementById('login-form');
const loginUserEl  = document.getElementById('login-user');
const loginPassEl  = document.getElementById('login-pass');
const loginError   = document.getElementById('login-error');
const loginCard    = document.getElementById('login-card');
const btnLoginEl   = document.getElementById('btn-login');

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

// \u2500\u2500 Populate Time Select Options \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Generate <option> from DASH_TIME_SLOTS so there's only one place to edit
function populateTimeSelects() {
  const startSel = document.getElementById('limit-time-start');
  const endSel   = document.getElementById('limit-time-end');
  if (!startSel || !endSel) return;

  DASH_TIME_SLOTS.forEach(t => {
    startSel.appendChild(new Option(t, t));
    const opt = new Option(t, t);
    if (t === '16:30') opt.selected = true;
    endSel.appendChild(opt);
  });
}
populateTimeSelects();

function showDashboard() {
  loginOverlay.classList.add('hidden');
}

function showLoginScreen() {
  loginOverlay.classList.remove('hidden');
}

// Handle login form submit
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const user = loginUserEl.value.trim();
  const pass = loginPassEl.value.trim();

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    loginError.classList.remove('show');
    // Fade out and show dashboard
    loginOverlay.style.transition = 'opacity .4s';
    loginOverlay.style.opacity = '0';
    setTimeout(() => {
      loginOverlay.classList.add('hidden');
      loginOverlay.style.opacity = '';
      fetchAll();
      startAutoRefresh();
    }, 400);
  } else {
    // Wrong credentials — shake + show error
    loginError.classList.add('show');
    loginCard.classList.remove('shake');
    void loginCard.offsetWidth; // force reflow
    loginCard.classList.add('shake');
    loginPassEl.value = '';
    loginPassEl.focus();
    setTimeout(() => loginCard.classList.remove('shake'), 500);
  }
});

// Enter key on username field moves to password
loginUserEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); loginPassEl.focus(); }
});

// ── Check auth on page load ───────────────────
if (isAuthenticated()) {
  showDashboard();
} else {
  showLoginScreen();
  // Don't load data until logged in
  setTimeout(() => loginUserEl.focus(), 300);
}



const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ─────────────────────────────────────
let allBookings = [];
let currentTab = 'pending';
let confirmBookingId = null;
let confirmBookingName = null;
let autoRefreshTimer = null;
let currentView = 'grid';
let calendar = null;

// ── DOM refs ──────────────────────────────────
const grid = document.getElementById('bookings-grid');
const searchInput = document.getElementById('search-input');
const btnRefresh = document.getElementById('btn-refresh');
const refreshIcon = document.getElementById('refresh-icon');
const lastUpdatedEl = document.getElementById('last-updated');
const modalOverlay = document.getElementById('modal-overlay');
const modalNameEl = document.getElementById('modal-name');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');
const toast = document.getElementById('toast');

// Stats
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');
const statScheduled = document.getElementById('stat-scheduled');
const statDelivered = document.getElementById('stat-delivered');
const countPending = document.getElementById('count-pending');
const countCompleted = document.getElementById('count-completed');
const countScheduled = document.getElementById('count-scheduled');
const countDelivered = document.getElementById('count-delivered');

// New UI Refs
const btnExport = document.getElementById('btn-export');
const btnViewGrid = document.getElementById('view-grid');
const btnViewCalendar = document.getElementById('view-calendar');
const calendarViewEl = document.getElementById('calendar-view');
const bookingsGridEl = document.getElementById('bookings-grid');
const calendarEl = document.getElementById('calendar');
const eventPopup = document.getElementById('event-popup');
const eventPopupClose = document.getElementById('event-popup-close');

// Calendar status colors
const STATUS_COLORS = {
  pending:     { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
  in_progress: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  completed:   { bg: '#10b981', border: '#059669', text: '#ffffff' },
  scheduled:   { bg: '#6366f1', border: '#4f46e5', text: '#ffffff' },
  delivered:   { bg: '#14b8a6', border: '#0d9488', text: '#ffffff' },
  cancelled:   { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
};

// ── Delivered Modal refs ─────────────────────
const modalOverlayDelivered = document.getElementById('modal-overlay-delivered');
const modalNameDeliveredEl = document.getElementById('modal-name-delivered');
const btnModalCancelDelivered = document.getElementById('btn-modal-cancel-delivered');
const btnModalConfirmDelivered = document.getElementById('btn-modal-confirm-delivered');
let confirmDeliveredId = null;
let confirmDeliveredName = null;

// ── Tab switching ────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const settingsView = document.getElementById('settings-view');
    if (currentTab === 'settings') {
      document.querySelector('.view-toggle-group').style.display = 'none';
      bookingsGridEl.style.display = 'none';
      calendarViewEl.style.display = 'none';
      settingsView.style.display = 'block';
      document.getElementById('search-input').disabled = true;
      btnRefresh.disabled = true;
      btnExport.disabled = true;
      loadLimits();
    } else {
      document.querySelector('.view-toggle-group').style.display = 'flex';
      settingsView.style.display = 'none';
      document.getElementById('search-input').disabled = false;
      btnRefresh.disabled = false;
      btnExport.disabled = false;
      switchView(currentView);
      renderBookings();
      if (currentView === 'calendar') updateCalendarEvents();
    }
  });
});

// ── Search ────────────────────────────────────
searchInput.addEventListener('input', renderBookings);

// ── Refresh ───────────────────────────────────
btnRefresh.addEventListener('click', fetchAll);

// ── Modal events ─────────────────────────────
btnModalCancel.addEventListener('click', closeModal);
btnModalConfirm.addEventListener('click', confirmDone);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ── Delivered Modal events ────────────────────
btnModalCancelDelivered.addEventListener('click', closeDeliveredModal);
btnModalConfirmDelivered.addEventListener('click', confirmDelivered);
modalOverlayDelivered.addEventListener('click', (e) => { if (e.target === modalOverlayDelivered) closeDeliveredModal(); });

// ── View Mode Toggling ───────────────────────
btnViewGrid.addEventListener('click', () => switchView('grid'));
btnViewCalendar.addEventListener('click', () => switchView('calendar'));

function switchView(view) {
  currentView = view;
  if (view === 'grid') {
    btnViewGrid.classList.add('active');
    btnViewCalendar.classList.remove('active');
    bookingsGridEl.style.display = '';
    calendarViewEl.style.display = 'none';
  } else {
    btnViewCalendar.classList.add('active');
    btnViewGrid.classList.remove('active');
    bookingsGridEl.style.display = 'none';
    calendarViewEl.style.display = 'block';
    if (!calendar) initCalendar();
    else { updateCalendarEvents(); setTimeout(() => calendar.render(), 50); }
  }
}

// ── Export Excel ──────────────────────────────
btnExport.addEventListener('click', exportToExcel);

function exportToExcel() {
  // Export current tab's filtered data (or all if in calendar view)
  const toExport = currentView === 'grid' ? getFiltered() : allBookings;
  if (toExport.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับ Export', 'error');
    return;
  }

  const statusMap = {
    'pending':     'รอดำเนินการ',
    'in_progress': 'กำลังดำเนินการ',
    'completed':   'เสร็จแล้ว',
    'scheduled':   'นัดหมายแล้ว',
    'delivered':   'เสร็จเรียบร้อย',
    'cancelled':   'ยกเลิก'
  };
  const tabMap = {
    'pending':   'รอดำเนินการ',
    'completed': 'เสร็จแล้ว',
    'scheduled': 'นัดหมายแล้ว',
    'delivered': 'เสร็จเรียบร้อย'
  };

  // Build rows
  const excelData = toExport.map((b, i) => ({
    'ลำดับ':                       i + 1,
    'รหัสอ้างอิง':                 b.ref_number || '',
    'ชื่อ-นามสกุล':                b.full_name || '',
    'เบอร์โทร':                    b.phone || '',
    'รหัสเครื่อง (Machine Code)':  b.machine_code || '',
    'สถานะ':                       statusMap[b.status] || b.status || '',
    'วันที่สร้างรายการ':           formatDate(b.created_at),
    'วันที่ทำเสร็จ':               b.completed_at ? formatDate(b.completed_at) : '',
    'วันที่กดนัดหมาย':             b.scheduled_at ? formatDate(b.scheduled_at) : '',
    'วันที่ส่งมอบ':                b.delivered_at ? formatDate(b.delivered_at) : '',
    'เครื่องปริ้น (ชั้น)':         b.printer_floors ? b.printer_floors.join(', ') : '',
    'รายการ Backup':               b.backup_items   ? b.backup_items.join(', ')   : '',
    'หมายเหตุ Backup':             b.backup_notes || '',
    'วันที่นัดหมาย (รับเครื่อง)':    b.appointment_date ? formatApptDate(b.appointment_date) : '',
    'เวลานัดหมาย (รับเครื่อง)':    b.appointment_time || ''
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);

  // Column widths
  ws['!cols'] = [
    {wch:6},{wch:20},{wch:28},{wch:14},{wch:22},{wch:16},
    {wch:22},{wch:22},{wch:22},{wch:22},{wch:22},{wch:28},{wch:28},{wch:24},{wch:14}
  ];

  // Freeze top row (header)
  ws['!freeze'] = { xSplit:0, ySplit:1, topLeftCell:'A2', activePane:'bottomLeft' };

  const wb = XLSX.utils.book_new();
  const sheetName = currentView === 'grid' ? (tabMap[currentTab] || 'ทั้งหมด') : 'ทั้งหมด';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Summary sheet
  const summaryRows = [
    { 'หัวข้อ': 'รายงาน IT Notebook Booking',  'ข้อมูล': '' },
    { 'หัวข้อ': 'Export โดย',                   'ข้อมูล': 'Admin' },
    { 'หัวข้อ': 'วันที่ Export',                 'ข้อมูล': new Date().toLocaleString('th-TH') },
    { 'หัวข้อ': '─────────────────────',         'ข้อมูล': '' },
    { 'หัวข้อ': 'รวมทั้งหมด',                   'ข้อมูล': allBookings.length },
    { 'หัวข้อ': 'รอดำเนินการ',                  'ข้อมูล': allBookings.filter(b => b.status==='pending'||b.status==='in_progress').length },
    { 'หัวข้อ': 'เสร็จแล้ว',                    'ข้อมูล': allBookings.filter(b => b.status==='completed').length },
    { 'หัวข้อ': 'นัดหมายแล้ว',                  'ข้อมูล': allBookings.filter(b => b.status==='scheduled').length },
    { 'หัวข้อ': '─────────────────────',         'ข้อมูล': '' },
    { 'หัวข้อ': 'จำนวนที่ Export (sheet นี้)',   'ข้อมูล': toExport.length },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:32},{wch:24}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุป');

  const dateStr = new Date().toISOString().split('T')[0];
  const label = currentView === 'grid' ? `_${currentTab}` : '_all';
  XLSX.writeFile(wb, `IT_Notebook_Bookings${label}_${dateStr}.xlsx`);
  showToast(`📊 Export สำเร็จ! ${toExport.length} รายการ`, 'success');
}

// ── Calendar Initialization ───────────────────
function initCalendar() {
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    locale: 'th',
    buttonText: {
      today:  'วันนี้',
      month:  'เดือน',
      week:   'สัปดาห์',
      day:    'วัน',
      list:   'รายการ'
    },
    height: 720,
    events: getCalendarEvents(),
    eventClick: handleEventClick,
    eventDidMount: (info) => {
      const ep = info.event.extendedProps;
      const statusLabel = {pending:'รอดำเนินการ',in_progress:'กำลังดำเนินการ',completed:'เสร็จแล้ว',scheduled:'นัดหมายแล้ว'}[ep.status] || ep.status;
      info.el.title = `${info.event.title}\nสถานะ: ${statusLabel}\nอ้างอิง: ${ep.ref}\nเบอร์: ${ep.phone}`;
    },
    dayMaxEvents: 3,
    moreLinkContent: (args) => `+${args.num} รายการ`,
  });
  calendar.render();
}

function updateCalendarEvents() {
  if (!calendar) return;
  calendar.removeAllEvents();
  calendar.addEventSource(getCalendarEvents());
}

function getCalendarEvents() {
  // Filter by current tab
  let source = allBookings;
  if (currentTab === 'pending')   source = allBookings.filter(b => b.status === 'pending' || b.status === 'in_progress');
  if (currentTab === 'completed') source = allBookings.filter(b => b.status === 'completed');
  if (currentTab === 'scheduled') source = allBookings.filter(b => b.status === 'scheduled');
  if (currentTab === 'delivered') source = allBookings.filter(b => b.status === 'delivered');

  const statusLabels = {
    pending: 'รอดำเนินการ', in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จแล้ว', scheduled: 'นัดหมายแล้ว',
    delivered: 'เสร็จเรียบร้อย',
  };

  return source.map(b => {
    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
    // Use appointment_date for scheduled; created_at date for others
    const useAppt = b.status === 'scheduled' && b.appointment_date;
    let startStr;
    if (useAppt) {
      startStr = b.appointment_time ? `${b.appointment_date}T${b.appointment_time}:00` : b.appointment_date;
    } else {
      startStr = b.created_at ? b.created_at.split('T')[0] : null;
    }
    if (!startStr) return null;

    return {
      id: String(b.id),
      title: b.full_name,
      start: startStr,
      allDay: !(useAppt && b.appointment_time),
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: {
        ref: b.ref_number, phone: b.phone,
        machine: b.machine_code, status: b.status,
        statusLabel: statusLabels[b.status] || b.status,
        apptDate: b.appointment_date, apptTime: b.appointment_time,
        backupItems: b.backup_items, floors: b.printer_floors,
        notes: b.backup_notes, createdAt: b.created_at,
      }
    };
  }).filter(Boolean);
}

// ── Calendar Event Click Popup ────────────────
function handleEventClick(info) {
  const ep = info.event.extendedProps;
  const colors = STATUS_COLORS[ep.status] || STATUS_COLORS.pending;
  const statusEmojis = { pending:'⏳', in_progress:'🔄', completed:'✅', scheduled:'📅', delivered:'🏁' };
  const emo = statusEmojis[ep.status] || '📋';

  document.getElementById('ep-name').textContent    = info.event.title;
  document.getElementById('ep-ref').textContent     = '#' + ep.ref;
  const epStatus = document.getElementById('ep-status');
  epStatus.textContent = emo + ' ' + ep.statusLabel;
  epStatus.style.background = colors.bg;
  epStatus.style.color = colors.text;
  document.getElementById('ep-phone').textContent   = ep.phone || '—';
  document.getElementById('ep-machine').textContent = ep.machine || '—';
  document.getElementById('ep-created').textContent = formatDate(ep.createdAt);

  const apptRow = document.getElementById('ep-appt-row');
  if (ep.apptDate) {
    document.getElementById('ep-appt').textContent = formatApptDate(ep.apptDate) + (ep.apptTime ? ' เวลา ' + ep.apptTime + ' น.' : '');
    apptRow.style.display = '';
  } else { apptRow.style.display = 'none'; }

  const notesRow = document.getElementById('ep-notes-row');
  if (ep.notes) {
    document.getElementById('ep-notes').textContent = ep.notes;
    notesRow.style.display = '';
  } else { notesRow.style.display = 'none'; }

  const popup = document.getElementById('event-popup');
  const rect = info.el.getBoundingClientRect();
  let left = rect.left + window.scrollX;
  let top  = rect.bottom + window.scrollY + 8;
  if (left + 320 > window.innerWidth) left = window.innerWidth - 336;
  if (left < 8) left = 8;
  popup.style.left = left + 'px';
  popup.style.top  = top + 'px';
  popup.classList.add('show');
  info.jsEvent.stopPropagation();
}

// Close popup on outside click
document.addEventListener('click', (e) => {
  const popup = document.getElementById('event-popup');
  if (popup && !popup.contains(e.target)) popup.classList.remove('show');
});
if (eventPopupClose) eventPopupClose.addEventListener('click', () => eventPopup.classList.remove('show'));

// ── Helpers ───────────────────────────────────
function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatApptDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Fetch all bookings ───────────────────────
async function fetchAll() {
  refreshIcon.classList.add('spin');
  btnRefresh.disabled = true;

  try {
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allBookings = data || [];
    
    updateStats();
    renderBookings();
    updateCalendarEvents(); // update calendar if active

    lastUpdatedEl.textContent = 'อัปเดตล่าสุด: ' + new Date().toLocaleTimeString('th-TH');

  } catch (err) {
    console.error(err);
    showToast('โหลดข้อมูลล้มเหลว: ' + (err.message || 'ไม่ทราบสาเหตุ'), 'error');
    grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>โหลดข้อมูลไม่ได้</h3><p>${err.message}</p></div>`;
  } finally {
    refreshIcon.classList.remove('spin');
    btnRefresh.disabled = false;
  }
}

// ── Update stats ─────────────────────────────
function updateStats() {
  const total = allBookings.length;
  const pending = allBookings.filter(b => b.status === 'pending' || b.status === 'in_progress').length;
  const completed = allBookings.filter(b => b.status === 'completed').length;
  const scheduled = allBookings.filter(b => b.status === 'scheduled').length;
  const delivered = allBookings.filter(b => b.status === 'delivered').length;

  animateNumber(statTotal, total);
  animateNumber(statPending, pending);
  animateNumber(statCompleted, completed);
  animateNumber(statScheduled, scheduled);
  animateNumber(statDelivered, delivered);

  countPending.textContent = pending;
  countCompleted.textContent = completed;
  countScheduled.textContent = scheduled;
  countDelivered.textContent = delivered;
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) { el.textContent = target; return; }
  const diff = target - current;
  const steps = 12;
  let step = 0;
  const timer = setInterval(() => {
    step++;
    el.textContent = Math.round(current + (diff * step / steps));
    if (step >= steps) { el.textContent = target; clearInterval(timer); }
  }, 25);
}

// ── Filter bookings ───────────────────────────
function getFiltered() {
  const search = searchInput.value.toLowerCase().trim();
  return allBookings.filter(b => {
    if (currentTab === 'pending' && b.status !== 'pending' && b.status !== 'in_progress') return false;
    if (currentTab === 'completed' && b.status !== 'completed') return false;
    if (currentTab === 'scheduled' && b.status !== 'scheduled') return false;
    if (currentTab === 'delivered' && b.status !== 'delivered') return false;
    if (search) {
      return (
        b.full_name?.toLowerCase().includes(search) ||
        b.ref_number?.toLowerCase().includes(search) ||
        b.phone?.includes(search)
      );
    }
    return true;
  });
}

// ── Render bookings ───────────────────────────
function renderBookings() {
  const filtered = getFiltered();

  if (filtered.length === 0) {
    const msgs = {
      pending: { icon: '🎉', title: 'ไม่มีรายการที่รอดำเนินการ', sub: 'ทุกการจองได้รับการดูแลแล้ว' },
      completed: { icon: '📭', title: 'ยังไม่มีรายการที่เสร็จแล้ว', sub: 'เมื่อดำเนินการเสร็จ กด "เสร็จแล้ว" ในแท็บแรก' },
      scheduled: { icon: '📅', title: 'ยังไม่มีนัดหมาย', sub: 'นัดหมายจะแสดงที่นี่หลังจากกำหนดเวลาในหน้า "นัดหมาย"' },
      delivered: { icon: '🏁', title: 'ยังไม่มีรายการที่เสร็จเรียบร้อย', sub: 'เมื่อคืนเครื่องแล้ว กด "คืนงานเสร็จ" ในแท็บ "นัดหมายแล้ว"' },
    };
    const m = msgs[currentTab] || msgs.pending;
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${m.icon}</span>
        <h3>${m.title}</h3>
        <p>${m.sub}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderCard).join('');

  // Attach done button events
  grid.querySelectorAll('.btn-done').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id, btn.dataset.name));
  });
  // Attach delivered button events
  grid.querySelectorAll('.btn-delivered').forEach(btn => {
    btn.addEventListener('click', () => openDeliveredModal(btn.dataset.id, btn.dataset.name));
  });
}

function renderCard(b) {
  const statusLabels = {
    pending: '<span class="status-badge status-badge--pending"><span class="status-dot"></span>รอดำเนินการ</span>',
    in_progress: '<span class="status-badge status-badge--in_progress"><span class="status-dot"></span>กำลังดำเนินการ</span>',
    completed: '<span class="status-badge status-badge--completed"><span class="status-dot"></span>เสร็จแล้ว</span>',
    scheduled: '<span class="status-badge status-badge--scheduled"><span class="status-dot"></span>นัดหมายแล้ว</span>',
    delivered: '<span class="status-badge status-badge--delivered"><span class="status-dot"></span>เสร็จเรียบร้อย</span>',
  };

  const floorTags = (b.printer_floors || [])
    .map(f => `<span class="tag tag--floor">🖨️ ชั้น ${f}</span>`).join('');
  const backupTags = (b.backup_items || [])
    .map(item => `<span class="tag tag--backup">💾 ${item}</span>`).join('');
  const notesHtml = b.backup_notes
    ? `<div class="card-notes">📝 ${b.backup_notes}</div>` : '';

  let footer = '';
  if (b.status === 'pending' || b.status === 'in_progress') {
    footer = `
      <button class="btn-done" data-id="${b.id}" data-name="${escapeHtml(b.full_name)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        เสร็จแล้ว
      </button>`;
  } else if (b.status === 'completed') {
    footer = `
      <a class="btn-appt" href="appointment.html?name=${encodeURIComponent(b.full_name)}">
        📅 นัดหมาย
      </a>`;
  } else if (b.status === 'scheduled') {
    footer = `
      <div class="appt-info-badge">
        📅 ${formatApptDate(b.appointment_date)} เวลา ${b.appointment_time} น.
      </div>
      <button class="btn-delivered" data-id="${b.id}" data-name="${escapeHtml(b.full_name)}">
        🏁 คืนงานเสร็จ
      </button>`;
  } else if (b.status === 'delivered') {
    footer = `
      <div class="appt-info-badge" style="background:#f0fdfa;color:#0f766e;">
        🏁 เสร็จเรียบร้อยแล้ว
      </div>`;
  }

  return `
    <div class="booking-card">
      <div class="card-top">
        <div class="card-meta">
          <div class="card-ref">#${b.ref_number}</div>
          <div class="card-date">${formatDate(b.created_at)}</div>
        </div>
        ${statusLabels[b.status] || ''}
      </div>
      <div class="card-name">👤 ${escapeHtml(b.full_name)}</div>
      <div class="card-info">
        <div class="card-row">📞 <strong>${b.phone}</strong></div>
        <div class="card-row">💻 รหัสเครื่อง: <span class="card-machine">${escapeHtml(b.machine_code)}</span></div>
      </div>
      ${(floorTags || backupTags) ? `<div class="card-tags">${floorTags}${backupTags}</div>` : ''}
      ${notesHtml}
      <div class="card-footer">${footer}</div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal ─────────────────────────────────────
function openModal(id, name) {
  confirmBookingId = id;
  confirmBookingName = name;
  modalNameEl.textContent = name;
  modalOverlay.classList.add('show');
}

function closeModal() {
  modalOverlay.classList.remove('show');
  confirmBookingId = null;
  confirmBookingName = null;
}

async function confirmDone() {
  if (!confirmBookingId) return;
  const origText = btnModalConfirm.textContent;
  btnModalConfirm.disabled = true;
  btnModalConfirm.textContent = 'กำลังบันทึก...';

  try {
    // Convert id to number since BIGSERIAL is integer
    const numericId = Number(confirmBookingId);

    const { data, error } = await db
      .from('bookings')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', numericId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      console.warn('⚠️ No rows updated! RLS might be blocking the update.');
      showToast('⚠️ อัปเดตไม่สำเร็จ — RLS อาจบล็อกอยู่ กรุณารัน fix_rls.sql ใน Supabase SQL Editor', 'error');
      return;
    }

    closeModal();
    showToast('✅ มาร์คว่าเสร็จแล้วสำเร็จ!', 'success');
    
    // Switch to completed tab automatically
    currentTab = 'completed';
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      if (b.dataset.tab === 'completed') b.classList.add('active');
    });

    await fetchAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + (err.message || JSON.stringify(err)), 'error');
  } finally {
    btnModalConfirm.disabled = false;
    btnModalConfirm.textContent = origText;
  }
}

// ── Delivered Modal ──────────────────────────
function openDeliveredModal(id, name) {
  confirmDeliveredId = id;
  confirmDeliveredName = name;
  modalNameDeliveredEl.textContent = name;
  modalOverlayDelivered.classList.add('show');
}

function closeDeliveredModal() {
  modalOverlayDelivered.classList.remove('show');
  confirmDeliveredId = null;
  confirmDeliveredName = null;
}

async function confirmDelivered() {
  if (!confirmDeliveredId) return;
  const origText = btnModalConfirmDelivered.textContent;
  btnModalConfirmDelivered.disabled = true;
  btnModalConfirmDelivered.textContent = 'กำลังบันทึก...';

  try {
    const numericId = Number(confirmDeliveredId);
    const { data, error } = await db
      .from('bookings')
      .update({ 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', numericId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      showToast('⚠️ อัปเดตไม่สำเร็จ — RLS อาจบล็อกอยู่', 'error');
      return;
    }

    closeDeliveredModal();
    showToast('🏁 มาร์คว่าเสร็จเรียบร้อยสำเร็จ!', 'success');

    // Switch to delivered tab
    currentTab = 'delivered';
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      if (b.dataset.tab === 'delivered') b.classList.add('active');
    });

    await fetchAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + (err.message || JSON.stringify(err)), 'error');
  } finally {
    btnModalConfirmDelivered.disabled = false;
    btnModalConfirmDelivered.textContent = origText;
  }
}

// ── Toast ──────────────────────────────────────
function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ── Slot Limits (Settings) ────────────────────
const settingsForm = document.getElementById('settings-form');
const limitsTbody = document.getElementById('limits-tbody');

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dateVal = document.getElementById('limit-date').value;
  const timeStartStr = document.getElementById('limit-time-start').value;
  const timeEndStr = document.getElementById('limit-time-end').value;
  const capVal = document.getElementById('limit-capacity').value;
  
  const options = Array.from(document.getElementById('limit-time-start').options).map(o => o.value);
  const startIndex = options.indexOf(timeStartStr);
  const endIndex = options.indexOf(timeEndStr);
  
  if (startIndex > endIndex) {
    showToast('เวลาเริ่มต้นต้องไม่เกินเวลาสิ้นสุด', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-save-limit');
  const origText = btn.textContent;
  btn.textContent = '⏳ กำลังบันทึก...';
  btn.disabled = true;

  try {
    const slotsToUpdate = options.slice(startIndex, endIndex + 1);
    
    // Upsert each slot
    for (const slot of slotsToUpdate) {
      const { error } = await db.from('slot_limits').upsert({
        slot_date: dateVal,
        slot_time: slot,
        max_capacity: parseInt(capVal, 10)
      }, { onConflict: 'slot_date, slot_time' });

      if (error) throw error;
    }

    showToast('บันทึกการตั้งค่าเรียบร้อย', 'success');
    loadLimits();
  } catch (err) {
    console.error(err);
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
});

async function loadLimits() {
  limitsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">กำลังโหลด...</td></tr>';
  try {
    let query = db.from('slot_limits').select('*').order('slot_date', { ascending: true }).order('slot_time', { ascending: true });
    
    const filterDate = document.getElementById('filter-limit-date')?.value;
    if (filterDate) {
      query = query.eq('slot_date', filterDate);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (!data || data.length === 0) {
      limitsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748b;">ยังไม่มีการตั้งค่าจำกัดคิว</td></tr>';
      if(document.getElementById('chk-all-limits')) document.getElementById('chk-all-limits').checked = false;
      if(window.updateSelectedLimitsCount) window.updateSelectedLimitsCount();
      return;
    }
    
    // Fetch bookings to count
    const limitDates = [...new Set(data.map(d => d.slot_date))];
    const { data: bookings, error: bErr } = await db
      .from('bookings')
      .select('appointment_date, appointment_time')
      .in('appointment_date', limitDates)
      .in('status', ['scheduled', 'delivered']);
    
    if (bErr) throw bErr;

    // Count bookings per date & time
    const countMap = {};
    bookings.forEach(b => {
      const key = b.appointment_date + '_' + b.appointment_time;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    limitsTbody.innerHTML = data.map(item => {
      const bookedCount = countMap[item.slot_date + '_' + item.slot_time] || 0;
      const dateDisplay = new Date(item.slot_date + 'T00:00:00').toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
      return `
      <tr>
        <td style="text-align: center;"><input type="checkbox" class="chk-limit" value="${item.id}" onchange="updateSelectedLimitsCount()"></td>
        <td>${dateDisplay}</td>
        <td>${item.slot_time} น.</td>
        <td>
          <input type="number" min="1" value="${item.max_capacity}" 
                 onchange="updateLimitCapacity('${item.id}', this.value)" 
                 class="limit-inline-input"> คน
        </td>
        <td><strong style="color: ${bookedCount >= item.max_capacity ? '#ef4444' : '#10b981'}">${bookedCount}</strong> / ${item.max_capacity}</td>
        <td style="text-align:right;">
          <button class="btn-delete-limit" onclick="deleteLimit('${item.id}')">ลบ</button>
        </td>
      </tr>
      `;
    }).join('');
    
    if(document.getElementById('chk-all-limits')) document.getElementById('chk-all-limits').checked = false;
    if(window.updateSelectedLimitsCount) window.updateSelectedLimitsCount();
    
  } catch (err) {
    console.error(err);
    limitsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:#ef4444;">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>';
  }
}

window.updateLimitCapacity = async function(id, newVal) {
  try {
    const val = parseInt(newVal, 10);
    if (isNaN(val) || val < 1) return loadLimits();
    const { error } = await db.from('slot_limits').update({ max_capacity: val }).eq('id', id);
    if (error) throw error;
    showToast('อัปเดตจำนวนคิวเรียบร้อย', 'success');
    loadLimits();
  } catch(err) {
    console.error(err);
    showToast('เกิดข้อผิดพลาดในการอัปเดต', 'error');
    loadLimits();
  }
};

window.deleteLimit = async function(id) {
  if (!confirm('ยืนยันการลบการตั้งค่านี้?')) return;
  try {
    const { error } = await db.from('slot_limits').delete().eq('id', id);
    if (error) throw error;
    showToast('ลบการตั้งค่าเรียบร้อย', 'success');
    loadLimits();
  } catch (err) {
    console.error(err);
    showToast('ลบข้อมูลไม่สำเร็จ', 'error');
  }
};



// ── Auto-refresh every 30s ────────────────────
function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(fetchAll, 30000);
}

// ── Logout ────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('ต้องการออกจากระบบใช่ไหม?')) {
    clearInterval(autoRefreshTimer);
    sessionStorage.removeItem(SESSION_KEY);
    // Reset form
    loginUserEl.value = '';
    loginPassEl.value = '';
    loginError.classList.remove('show');
    showLoginScreen();
    setTimeout(() => loginUserEl.focus(), 300);
  }
});

// ── Bulk Delete Limits ────────────────────────
const chkAllLimits = document.getElementById('chk-all-limits');
const btnDeleteSelected = document.getElementById('btn-delete-selected-limits');
const selectedCountEl = document.getElementById('selected-limits-count');

if (chkAllLimits) {
  chkAllLimits.addEventListener('change', (e) => {
    document.querySelectorAll('.chk-limit').forEach(chk => chk.checked = e.target.checked);
    if(window.updateSelectedLimitsCount) window.updateSelectedLimitsCount();
  });
}

window.updateSelectedLimitsCount = function() {
  if (!btnDeleteSelected) return;
  const count = document.querySelectorAll('.chk-limit:checked').length;
  if (count > 0) {
    btnDeleteSelected.style.display = 'inline-flex';
    if(selectedCountEl) selectedCountEl.textContent = count;
  } else {
    btnDeleteSelected.style.display = 'none';
  }
};

if (btnDeleteSelected) {
  btnDeleteSelected.addEventListener('click', async () => {
    const selectedIds = Array.from(document.querySelectorAll('.chk-limit:checked')).map(chk => chk.value);
    if (selectedIds.length === 0) return;
    if (!confirm(`ยืนยันการลบการตั้งค่าที่เลือกจำนวน ${selectedIds.length} รายการ?`)) return;
    
    btnDeleteSelected.innerHTML = '⏳ กำลังลบ...';
    btnDeleteSelected.disabled = true;
    try {
      const { error } = await db.from('slot_limits').delete().in('id', selectedIds);
      if (error) throw error;
      showToast('ลบรายการที่เลือกเรียบร้อย', 'success');
      loadLimits();
    } catch(err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการลบ', 'error');
    } finally {
      btnDeleteSelected.innerHTML = `🗑️ ลบที่เลือก (<span id="selected-limits-count">0</span>)`;
      btnDeleteSelected.disabled = false;
      btnDeleteSelected.style.display = 'none';
      if(chkAllLimits) chkAllLimits.checked = false;
    }
  });
}

// ── Init: fetchAll is called after successful login ──
// (if already authenticated, it's called by the auth check above)
if (isAuthenticated()) {
  fetchAll();
  startAutoRefresh();
}


