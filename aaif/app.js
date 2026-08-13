// ============================================
//  NOTEBOOK BOOKING SYSTEM — AAIF APP.JS
//  Supabase integration + Form logic
//  Table: bookings_aaif
// ============================================

// ── Supabase Configuration ──────────────────
const SUPABASE_URL = 'https://nnnqshuptvirjbnesjvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubnFzaHVwdHZpcmpibmVzanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTIzNDIsImV4cCI6MjEwMTU2ODM0Mn0.gtAkjGe-rSrf5fzCwwcYgdLF68mNs5dRVTIODXo0Lag';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── AAIF uses its own table ─────────────────
const TABLE_BOOKINGS = 'bookings_aaif';

// ── DOM References ──────────────────────────
const form = document.getElementById('booking-form');
const btnSubmit = document.getElementById('btn-submit');
const btnText = document.querySelector('.btn-text');
const btnIcon = document.querySelector('.btn-icon');
const btnLoading = document.getElementById('btn-loading');
const btnNewBooking = document.getElementById('btn-new-booking');
const sectionForm = document.getElementById('section-form');
const sectionSuccess = document.getElementById('section-success');
const refNumber = document.getElementById('ref-number');
const successInfo = document.getElementById('success-info');
const toast = document.getElementById('toast');

// Progress Steps
const stepInfo = document.getElementById('step-info');
const stepConfirm = document.getElementById('step-confirm');
const stepDone = document.getElementById('step-done');
const progressLines = document.querySelectorAll('.progress-line');

// ── Toggle Password Visibility ──────────────
const toggleBtn = document.getElementById('toggle-password');
const machineCodeInput = document.getElementById('machine-code');
const eyeIcon = document.getElementById('eye-icon');

const eyeOpenSVG = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>`;
const eyeClosedSVG = `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;

toggleBtn.addEventListener('click', () => {
  if (machineCodeInput.type === 'text') {
    machineCodeInput.type = 'password';
    eyeIcon.innerHTML = eyeOpenSVG;
  } else {
    machineCodeInput.type = 'text';
    eyeIcon.innerHTML = eyeClosedSVG;
  }
});

// ── Validation ──────────────────────────────
function validateEnglishName(val) {
  return /^[A-Za-z\s'\-\.]+$/.test(val.trim()) && val.trim().length >= 3;
}

function validatePhone(val) {
  const cleaned = val.replace(/[\s\-\(\)]/g, '');
  return /^[0-9]{9,10}$/.test(cleaned);
}

function showError(id, msg) {
  const el = document.getElementById(`error-${id}`);
  if (el) el.textContent = msg;
  const input = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
  if (input && input.classList) {
    input.classList.add('error');
    input.classList.remove('valid');
  }
}

function clearError(id) {
  const el = document.getElementById(`error-${id}`);
  if (el) el.textContent = '';
  const input = document.getElementById(id);
  if (input && input.classList) {
    input.classList.remove('error');
  }
}

function setValid(id) {
  clearError(id);
  const input = document.getElementById(id);
  if (input && input.classList) {
    input.classList.add('valid');
  }
}

// ── Real-time input validation ──────────────
document.getElementById('full-name').addEventListener('blur', function () {
  if (!this.value.trim()) {
    showError('full-name', 'กรุณากรอกชื่อ-นามสกุล');
  } else if (!validateEnglishName(this.value)) {
    showError('full-name', 'กรุณากรอกชื่อภาษาอังกฤษเท่านั้น');
  } else {
    setValid('full-name');
  }
});

document.getElementById('phone').addEventListener('blur', function () {
  if (!this.value.trim()) {
    showError('phone', 'กรุณากรอกเบอร์มือถือ');
  } else if (!validatePhone(this.value)) {
    showError('phone', 'รูปแบบเบอร์มือถือไม่ถูกต้อง');
  } else {
    setValid('phone');
  }
});

document.getElementById('machine-code').addEventListener('blur', function () {
  if (!this.value.trim()) {
    showError('machine-code', 'กรุณากรอกรหัสเข้าเครื่อง');
  } else {
    setValid('machine-code');
  }
});

// ── Toast Notification ──────────────────────
let toastTimeout;
function showToast(msg, type = '') {
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ` toast--${type}` : '');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ── Generate Reference Number ───────────────
function generateRef() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AF-${date}-${rand}`;
}

// ── Set Submit Loading State ────────────────
function setLoading(loading) {
  btnSubmit.disabled = loading;
  if (loading) {
    btnText.style.display = 'none';
    btnIcon.style.display = 'none';
    btnLoading.style.display = 'flex';
  } else {
    btnText.style.display = '';
    btnIcon.style.display = '';
    btnLoading.style.display = 'none';
  }
}

// ── Collect Form Data ────────────────────────
function collectFormData() {
  const fullName = document.getElementById('full-name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const machineCode = document.getElementById('machine-code').value.trim();

  // Printer floors
  const floorCheckboxes = document.querySelectorAll('input[name="printer_floors"]:checked');
  const printerFloors = Array.from(floorCheckboxes).map(cb => cb.value);

  // Printer other (free text)
  const printerOther = document.getElementById('printer-other').value.trim();
  if (printerOther) printerFloors.push(printerOther);

  // Backup items
  const backupCheckboxes = document.querySelectorAll('input[name="backup_items"]:checked');
  const backupItems = Array.from(backupCheckboxes).map(cb => cb.value);

  const backupNotes = document.getElementById('backup-notes').value.trim();

  return { fullName, phone, machineCode, printerFloors, backupItems, backupNotes };
}

// ── Validate Form ────────────────────────────
function validateForm(data) {
  let isValid = true;

  if (!data.fullName) {
    showError('full-name', 'กรุณากรอกชื่อ-นามสกุล');
    isValid = false;
  } else if (!validateEnglishName(data.fullName)) {
    showError('full-name', 'กรุณากรอกชื่อภาษาอังกฤษเท่านั้น');
    isValid = false;
  } else {
    setValid('full-name');
  }

  if (!data.phone) {
    showError('phone', 'กรุณากรอกเบอร์มือถือ');
    isValid = false;
  } else if (!validatePhone(data.phone)) {
    showError('phone', 'รูปแบบเบอร์มือถือไม่ถูกต้อง (09-10 หลัก)');
    isValid = false;
  } else {
    setValid('phone');
  }

  if (!data.machineCode) {
    showError('machine-code', 'กรุณากรอกรหัสเข้าเครื่อง');
    isValid = false;
  } else {
    setValid('machine-code');
  }

  if (data.printerFloors.length === 0) {
    document.getElementById('error-printer-floors').textContent = 'กรุณาเลือกอย่างน้อย 1 รายการ';
    isValid = false;
  } else {
    document.getElementById('error-printer-floors').textContent = '';
  }

  return isValid;
}

// ── Show Success Screen ──────────────────────
function showSuccess(ref, data) {
  // Update progress
  stepInfo.classList.remove('active');
  stepInfo.classList.add('completed');
  stepConfirm.classList.add('completed');
  stepDone.classList.add('active', 'completed');
  progressLines.forEach(l => l.classList.add('completed'));

  // Update ref number
  refNumber.textContent = ref;

  // Summary info
  successInfo.innerHTML = `
    <strong>สรุปข้อมูลที่จอง:</strong><br/>
    👤 ${data.fullName}<br/>
    📞 ${data.phone}<br/>
    🖨️ ปริ้นเตอร์: ${data.printerFloors.length > 0 ? data.printerFloors.join(', ') : '-'}<br/>
    💾 สำรองข้อมูล: ${data.backupItems.length > 0 ? data.backupItems.join(', ') : 'ไม่ระบุ'}
    ${data.backupNotes ? `<br/>📝 หมายเหตุ: ${data.backupNotes}` : ''}
  `;

  // Switch sections with animation
  sectionForm.style.animation = 'fadeOut 0.3s ease forwards';
  setTimeout(() => {
    sectionForm.style.display = 'none';
    sectionSuccess.style.display = 'flex';
  }, 300);
}

// ── Form Submit Handler ──────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = collectFormData();
  if (!validateForm(data)) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
    const firstError = document.querySelector('.field-input.error, .field-error:not(:empty)');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  setLoading(true);

  const ref = generateRef();

  try {
    const { error } = await db.from(TABLE_BOOKINGS).insert([{
      ref_number: ref,
      full_name: data.fullName,
      phone: data.phone,
      machine_code: data.machineCode,
      printer_floors: data.printerFloors,
      backup_items: data.backupItems,
      backup_notes: data.backupNotes || null,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);

    if (error) throw error;

    showSuccess(ref, data);
    showToast('จองสำเร็จแล้ว! 🎉', 'success');
  } catch (err) {
    console.error('Supabase error:', err);
    showToast('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถส่งข้อมูลได้'), 'error');
  } finally {
    setLoading(false);
  }
});

// ── New Booking Button ───────────────────────
btnNewBooking.addEventListener('click', () => {
  form.reset();
  document.querySelectorAll('.field-input').forEach(el => {
    el.classList.remove('error', 'valid');
  });
  document.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
  });

  stepInfo.classList.add('active');
  stepInfo.classList.remove('completed');
  stepConfirm.classList.remove('completed', 'active');
  stepDone.classList.remove('completed', 'active');
  progressLines.forEach(l => l.classList.remove('completed'));

  sectionSuccess.style.display = 'none';
  sectionForm.style.display = 'block';
  sectionForm.style.animation = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Initial setup ────────────────────────────
machineCodeInput.type = 'password';
