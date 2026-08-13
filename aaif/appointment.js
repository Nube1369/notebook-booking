// ============================================
//  APPOINTMENT.JS — AAIF Appointment Scheduler
//  Tables: bookings_aaif, slot_limits_aaif
// ============================================

const SUPABASE_URL = 'https://nnnqshuptvirjbnesjvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubnFzaHVwdHZpcmpibmVzanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTIzNDIsImV4cCI6MjEwMTU2ODM0Mn0.gtAkjGe-rSrf5fzCwwcYgdLF68mNs5dRVTIODXo0Lag';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── AAIF uses its own tables ────────────────
const TABLE_BOOKINGS = 'bookings_aaif';
const TABLE_SLOT_LIMITS = 'slot_limits_aaif';

// ── Time Slots ────────────────────────────────
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30',
];

// ── State ──────────────────────────────────────
let currentBooking = null;
let selectedTime = null;
let searchTimer = null;

// ── DOM refs ───────────────────────────────────
const nameSearch = document.getElementById('name-search');
const searchClear = document.getElementById('search-clear');
const resultsDropdown = document.getElementById('results-dropdown');
const detailCard = document.getElementById('detail-card');
const successScreen = document.getElementById('success-screen');
const btnNewSearch = document.getElementById('btn-new-search');
const toast = document.getElementById('toast');

// Detail fields
const dName = document.getElementById('d-name');
const dRef = document.getElementById('d-ref');
const dStatusBadge = document.getElementById('d-status-badge');
const dPhone = document.getElementById('d-phone');
const dMachine = document.getElementById('d-machine');
const dTags = document.getElementById('d-tags');
const statusSection = document.getElementById('status-section');

// ── Check URL params ───────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const urlName = urlParams.get('name');
if (urlName) {
  nameSearch.value = urlName;
  searchClear.style.display = 'block';
  setTimeout(() => doSearch(urlName), 400);
}

// ── Search input handler ───────────────────────
nameSearch.addEventListener('input', () => {
  const val = nameSearch.value.trim();
  searchClear.style.display = val ? 'block' : 'none';

  clearTimeout(searchTimer);
  if (val.length < 2) {
    hideDropdown();
    return;
  }
  searchTimer = setTimeout(() => doSearch(val), 350);
});

searchClear.addEventListener('click', () => {
  nameSearch.value = '';
  searchClear.style.display = 'none';
  hideDropdown();
  hideDetail();
  successScreen.classList.remove('show');
  nameSearch.focus();
});

btnNewSearch.addEventListener('click', () => {
  nameSearch.value = '';
  searchClear.style.display = 'none';
  hideDropdown();
  hideDetail();
  successScreen.style.display = 'none';
  successScreen.classList.remove('show');
  nameSearch.focus();
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper') && !e.target.closest('.results-dropdown')) {
    hideDropdown();
  }
});

// ── Search Supabase ────────────────────────────
async function doSearch(query) {
  resultsDropdown.innerHTML = '<div class="no-results">🔍 กำลังค้นหา...</div>';
  resultsDropdown.classList.add('show');

  try {
    const { data, error } = await db
      .from(TABLE_BOOKINGS)
      .select('*')
      .ilike('full_name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) throw error;

    if (!data || data.length === 0) {
      resultsDropdown.innerHTML = '<div class="no-results">❌ ไม่พบข้อมูลที่ตรงกัน</div>';
      return;
    }

    renderDropdown(data);
  } catch (err) {
    resultsDropdown.innerHTML = `<div class="no-results">⚠️ ${err.message}</div>`;
  }
}

// ── Render dropdown results ────────────────────
function maskPhone(phone) {
  if (!phone || phone.length < 4) return '***';
  return phone.substring(0, 3) + '*'.repeat(phone.length - 5) + phone.substring(phone.length - 2);
}
function maskCode(code) {
  if (!code) return '***';
  if (code.length <= 2) return '*'.repeat(code.length);
  return code.charAt(0) + '*'.repeat(code.length - 2) + code.charAt(code.length - 1);
}

function renderDropdown(bookings) {
  const statusLabel = { pending: '⏳ รอ', in_progress: '🟢 ดำเนินการ', completed: '✅ พร้อมแล้ว', scheduled: '📅 นัดแล้ว', delivered: '🏁 เสร็จเรียบร้อย' };
  resultsDropdown.innerHTML = bookings.map(b => `
    <div class="result-item" data-id="${b.id}">
      <div class="result-avatar">${b.full_name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="result-name">${escapeHtml(b.full_name)}</div>
        <div class="result-meta">${maskPhone(b.phone)} · ${b.ref_number}</div>
      </div>
      <div class="result-status">${statusLabel[b.status] || b.status}</div>
    </div>
  `).join('');

  resultsDropdown.querySelectorAll('.result-item').forEach((el, i) => {
    el.addEventListener('click', () => selectBooking(bookings[i]));
  });
}

// ── Select a booking ───────────────────────────
function selectBooking(booking) {
  currentBooking = booking;
  selectedTime = null;
  nameSearch.value = booking.full_name;
  searchClear.style.display = 'block';
  hideDropdown();
  renderDetail(booking);
}

// ── Render detail card ─────────────────────────
function renderDetail(b) {
  successScreen.style.display = 'none';
  successScreen.classList.remove('show');

  dName.textContent = b.full_name;
  dRef.textContent = `#${b.ref_number} · จองวันที่ ${formatDate(b.created_at)}`;

  const statusMap = {
    pending: `<span class="status-badge status-badge--pending"><span class="status-dot"></span>รอดำเนินการ</span>`,
    in_progress: `<span class="status-badge status-badge--pending"><span class="status-dot"></span>กำลังดำเนินการ</span>`,
    completed: `<span class="status-badge status-badge--completed"><span class="status-dot"></span>พร้อมแล้ว ✅</span>`,
    scheduled: `<span class="status-badge status-badge--scheduled"><span class="status-dot"></span>นัดหมายแล้ว</span>`,
    delivered: `<span class="status-badge" style="background:#ccfbf1;color:#0f766e;"><span class="status-dot"></span>เสร็จเรียบร้อย 🏁</span>`,
  };
  dStatusBadge.innerHTML = statusMap[b.status] || b.status;

  dPhone.textContent = maskPhone(b.phone);
  dMachine.textContent = maskCode(b.machine_code);

  const floorTags = (b.printer_floors || []).map(f => `<span class="tag tag--floor">🖨️ ${f}</span>`).join('');
  const backupTags = (b.backup_items || []).map(i => `<span class="tag tag--backup">💾 ${i}</span>`).join('');
  dTags.innerHTML = floorTags + backupTags;

  renderStatusSection(b);

  detailCard.classList.add('show');
  detailCard.style.display = 'block';
  setTimeout(() => detailCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

// ── Render status section ──────────────────────
function renderStatusSection(b) {
  if (b.status === 'pending' || b.status === 'in_progress') {
    statusSection.innerHTML = `
      <div class="state-pending">
        <div class="state-pending-icon">⏳</div>
        <h3>เครื่องยังอยู่ระหว่างดำเนินการ</h3>
        <p>ทีม IT ยังดำเนินการอยู่ กรุณารอจนกว่าสถานะจะเป็น "พร้อมแล้ว" ก่อนนัดหมาย</p>
      </div>`;
  } else if (b.status === 'completed') {
    renderScheduler();
  } else if (b.status === 'scheduled') {
    statusSection.innerHTML = `
      <div class="state-scheduled">
        <div class="state-scheduled-icon">📅</div>
        <h3>นัดหมายแล้ว</h3>
        <div class="state-scheduled-detail">
          ${formatApptDate(b.appointment_date)} เวลา ${b.appointment_time} น.
        </div>
      </div>`;
  } else if (b.status === 'delivered') {
    statusSection.innerHTML = `
      <div class="state-scheduled" style="background:#f0fdfa;border-color:#99f6e4;">
        <div class="state-scheduled-icon">🏁</div>
        <h3 style="color:#0f766e;">เสร็จเรียบร้อยแล้ว</h3>
        <p style="font-size:.85rem;color:#0d9488;margin-top:.5rem;">เครื่องของคุณได้รับการส่งมอบเรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ</p>
      </div>`;
  } else {
    statusSection.innerHTML = '';
  }
}

// ── Render date/time scheduler ─────────────────
function renderScheduler() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const timeBtns = TIME_SLOTS.map(t => `
    <button class="time-btn" data-time="${t}" type="button">${t}</button>
  `).join('');

  statusSection.innerHTML = `
    <div class="scheduler">
      <div class="scheduler-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#6366f1" stroke-width="2"/>
          <path d="M16 2v4M8 2v4M3 10h18" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
        </svg>
        เลือกวันและเวลาที่สะดวก
      </div>

      <div class="date-section">
        <label class="field-label" for="appt-date">วันที่นัดหมาย</label>
        <input type="date" id="appt-date" class="date-input"
               min="${minDate}" max="${maxDateStr}" />
      </div>

      <div class="time-section">
        <label class="field-label">เวลา (09:00 – 16:30 น.)</label>
        <div class="time-grid" id="time-grid">${timeBtns}</div>
      </div>

      <button class="btn-confirm-appt" id="btn-confirm-appt" disabled>
        📅 ยืนยันนัดหมาย
      </button>
    </div>`;

  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTime = btn.dataset.time;
      checkCanConfirm();
    });
  });

  document.getElementById('appt-date').addEventListener('change', async (e) => {
    checkCanConfirm();
    await checkSlotCapacity(e.target.value);
  });

  document.getElementById('btn-confirm-appt').addEventListener('click', confirmAppointment);
}

function checkCanConfirm() {
  const dateInput = document.getElementById('appt-date');
  const confirmBtn = document.getElementById('btn-confirm-appt');
  if (!confirmBtn) return;
  const hasDate = dateInput && dateInput.value;
  confirmBtn.disabled = !(hasDate && selectedTime);
}

// ── Confirm appointment ────────────────────────
async function confirmAppointment() {
  if (!currentBooking || !selectedTime) return;
  const dateInput = document.getElementById('appt-date');
  if (!dateInput || !dateInput.value) return;

  const apptDate = dateInput.value;
  const apptTime = selectedTime;
  const btn = document.getElementById('btn-confirm-appt');

  btn.disabled = true;
  btn.innerHTML = `<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" stroke-width="2" stroke-linecap="round"/></svg> กำลังบันทึก...`;

  try {
    const { error } = await db
      .from(TABLE_BOOKINGS)
      .update({
        status: 'scheduled',
        appointment_date: apptDate,
        appointment_time: apptTime,
        scheduled_at: new Date().toISOString()
      })
      .eq('id', currentBooking.id);

    if (error) throw error;

    currentBooking.status = 'scheduled';
    currentBooking.appointment_date = apptDate;
    currentBooking.appointment_time = apptTime;

    hideDetail();
    showSuccessScreen(currentBooking.full_name, apptDate, apptTime);
    showToast('📅 นัดหมายสำเร็จแล้ว!', 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '📅 ยืนยันนัดหมาย';
  }
}

// ── Check Slot Capacity ────────────────────────
async function checkSlotCapacity(dateStr) {
  if (!dateStr) return;
  const timeBtns = document.querySelectorAll('.time-btn');
  const timeSection = document.querySelector('.time-section');
  
  const existingNotice = document.getElementById('date-closed-notice');
  if (existingNotice) existingNotice.remove();

  timeBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('full', 'closed');
    btn.innerHTML = btn.dataset.time;
  });

  try {
    const { data: limits, error: lErr } = await db
      .from(TABLE_SLOT_LIMITS)
      .select('slot_time, max_capacity')
      .eq('slot_date', dateStr);

    if (lErr) throw lErr;

    if (!limits || limits.length === 0) {
      timeBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('full');
      });
      const notice = document.createElement('div');
      notice.id = 'date-closed-notice';
      notice.style.cssText = 'margin-top:0.75rem;padding:0.75rem 1rem;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;color:#92400e;font-size:0.875rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;';
      notice.innerHTML = '⚠️ วันที่นี้ยังไม่เปิดรับการจอง กรุณาเลือกวันที่อื่นหรือติดต่อเจ้าหน้าที่ IT';
      if (timeSection) timeSection.appendChild(notice);
      if (selectedTime) {
        const selectedBtn = document.querySelector(`.time-btn[data-time="${selectedTime}"]`);
        if (selectedBtn) selectedBtn.classList.remove('selected');
        selectedTime = null;
        checkCanConfirm();
      }
      return;
    }

    const { data: bookings, error: bErr } = await db
      .from(TABLE_BOOKINGS)
      .select('appointment_time')
      .eq('appointment_date', dateStr)
      .in('status', ['scheduled', 'delivered']);
      
    if (bErr) throw bErr;

    const limitMap = {};
    limits.forEach(l => limitMap[l.slot_time] = l.max_capacity);

    const countMap = {};
    bookings.forEach(b => {
      if (b.appointment_time) {
        countMap[b.appointment_time] = (countMap[b.appointment_time] || 0) + 1;
      }
    });

    timeBtns.forEach(btn => {
      const t = btn.dataset.time;
      const count = countMap[t] || 0;
      const limit = limitMap[t];
      
      if (limit === undefined) {
        btn.disabled = true;
        btn.classList.add('closed');
        btn.innerHTML = `${t}<br><span style="font-size:0.65rem;">ไม่เปิด</span>`;
      } else if (count >= limit) {
        btn.disabled = true;
        btn.classList.add('full');
        btn.innerHTML = `${t} <br><span style="font-size:0.65rem;">(เต็ม)</span>`;
      }
    });
    
    if (selectedTime) {
      const selectedBtn = document.querySelector(`.time-btn[data-time="${selectedTime}"]`);
      if (selectedBtn && selectedBtn.disabled) {
        selectedBtn.classList.remove('selected');
        selectedTime = null;
        checkCanConfirm();
      }
    }

  } catch (err) {
    console.error('Error checking capacity:', err);
  }
}

// ── Show success screen ────────────────────────
function showSuccessScreen(name, date, time) {
  const formattedDate = formatApptDate(date);
  document.getElementById('success-detail').innerHTML = `
    ยืนยันนัดหมายสำหรับ <strong>${escapeHtml(name)}</strong><br/>
    เรียบร้อยแล้ว ทีม IT จะรอพบท่านตามวันเวลาที่กำหนด
  `;
  document.getElementById('success-appt-badge').innerHTML = `
    📅 ${formattedDate} เวลา ${time} น.
  `;
  successScreen.style.display = 'block';
  successScreen.classList.add('show');
  successScreen.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Helpers ────────────────────────────────────
function hideDropdown() {
  resultsDropdown.classList.remove('show');
  resultsDropdown.innerHTML = '';
}

function hideDetail() {
  detailCard.style.display = 'none';
  detailCard.classList.remove('show');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function formatApptDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ──────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
