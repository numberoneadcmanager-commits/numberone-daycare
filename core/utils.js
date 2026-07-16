// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 공통 유틸리티
// core/utils.js
// ══════════════════════════════════════════════════════════════

// ── 날짜 헬퍼 ────────────────────────────────────────────────
// 로컬(뉴욕) 시간 기준 — toISOString()은 UTC라서 저녁 8시 이후 날짜가 밀림
function toISO(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function fmtD(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DNAMES[d.getDay()] + ')';
}

function dowKey(iso) { return DKEYS[new Date(iso + 'T00:00:00').getDay()]; }

function nextDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toISO(d);
}

function now2() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

// Auth 날짜 포맷 변환 (MM/DD/YYYY ↔ YYYY-MM-DD)
function toDisplayDate(str) {
  if (!str) return '';
  str = String(str).slice(0, 10); // 타임스탬프(YYYY-MM-DDTHH:mm:ss.sssZ) 등에서 날짜 부분만 추출
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[2] + '/' + m[3] + '/' + m[1];
  return str;
}

function parseDate(str) {
  if (!str) return '';
  str = String(str).trim();
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return m1[3] + '-' + m1[1].padStart(2, '0') + '-' + m1[2].padStart(2, '0');
  // 타임스탬프(YYYY-MM-DDTHH:mm:ss.sssZ) 등에서 날짜 부분만 추출
  const m2 = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m2) return m2[1];
  const v = str.replace(/\D/g, '');
  if (v.length === 8) return v.slice(4, 8) + '-' + v.slice(0, 2) + '-' + v.slice(2, 4);
  return '';
}

function autoFormatDate(input) {
  const v = input.value.replace(/\D/g, '');
  if (v.length >= 8)      input.value = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4,8);
  else if (v.length >= 4) input.value = v.slice(0,2) + '/' + v.slice(2,4) + '/' + v.slice(4);
  else if (v.length >= 2) input.value = v.slice(0,2) + '/' + v.slice(2);
}

// ── 출결 기록 접근 ────────────────────────────────────────────
function getRec(iso)            { return allR[iso] || {}; }
function setRec(iso, mid, data) { if (!allR[iso]) allR[iso] = {}; allR[iso][mid] = data; }

// ── 멤버 상태 ─────────────────────────────────────────────────
function isActive(m) { return !m.status || m.status === 'active'; }

// ── 배지 HTML ─────────────────────────────────────────────────
function badgeHTML(s) {
  const info = SI[s];
  return info
    ? `<span class="badge ${info.badge}">${info.icon} ${info.label}</span>`
    : '<span class="badge b-gray">미확인</span>';
}

function insBadge(ins) {
  if (ins === 'Anthem_MLTC') return '<span class="ins-mltc">Anthem MLTC</span>';
  if (ins === 'Anthem_MAP')  return '<span class="ins-map">Anthem MAP</span>';
  if (ins === 'CLP')         return '<span class="ins-clp">Centerlight</span>';
  if (ins === 'SWH')         return '<span class="ins-swh">SWH</span>';
  return '<span class="ins-mltc">Anthem MLTC</span>';
}

function statusBadge(m) {
  if (!m.status || m.status === 'active')
    return '<span class="s-active">&#9679; Active</span>';
  return '<span class="s-disenrolled">&#9679; Disenrolled' + (m.disenrollDate ? ' ' + m.disenrollDate : '') + '</span>';
}

// ── gv 헬퍼 (form 값 가져오기) ───────────────────────────────
function gv(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// ── 로딩 오버레이 ─────────────────────────────────────────────
function showLoadingOverlay(msg) {
  const el = document.getElementById('loading-overlay');
  if (el) { el.querySelector('.loading-msg').textContent = msg || '로딩 중...'; el.style.display = 'flex'; }
}

function hideLoadingOverlay() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ── 모달 헬퍼 ─────────────────────────────────────────────────
function openOv(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById(id.replace(/^ov-/, 'modal-ov-')).style.display = 'block';
}

function closeOv(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById(id.replace(/^ov-/, 'modal-ov-')).style.display = 'none';
  editId = null; popId = null; popDate = null; mCurSt = null;
}

function closeModal() {
  document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'));
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  editId = null; popId = null; popDate = null; mCurSt = null;
}

// ── 멤버 select 필터링 ────────────────────────────────────────
function filterMSel(px) {
  const q   = document.getElementById(px + '-msearch').value.toLowerCase();
  const sel = document.getElementById(px + '-msel');
  sel.innerHTML = MEMBERS
    .filter(m => !q || m.kr.includes(q) || m.en.toLowerCase().includes(q))
    .map(m => `<option value="${m.id}">${m.kr} (${m.en})</option>`)
    .join('');
}

// ── 캔버스 서명 공통 초기화 ───────────────────────────────────
function initSigCanvas(canvasId, emptyId, onSave) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || canvas._sigInit) return;
  canvas._sigInit = true;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false, lx = 0, ly = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if (e.touches) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }
  function start(e) {
    e.preventDefault(); drawing = true;
    const p = getPos(e); lx = p.x; ly = p.y;
    const empty = document.getElementById(emptyId);
    if (empty) empty.style.display = 'none';
  }
  function draw(e) {
    if (!drawing) return; e.preventDefault();
    const p = getPos(e);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
    lx = p.x; ly = p.y;
  }
  function stop() {
    if (!drawing) return; drawing = false;
    onSave(canvas.toDataURL('image/png'));
  }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function clearSigCanvas(canvasId, emptyId, onClear) {
  const canvas = document.getElementById(canvasId);
  if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); canvas._sigInit = false; }
  if (onClear) onClear();
  const empty = document.getElementById(emptyId);
  if (empty) empty.style.display = 'flex';
}

// ── 저장소 정보 ───────────────────────────────────────────────
function showStorageInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '저장된 데이터 없음';
    const data = JSON.parse(raw);
    const size = (new Blob([raw]).size / 1024).toFixed(1);
    const dis  = Object.keys(data.memberStatus || {}).length;
    const t    = data.savedAt ? new Date(data.savedAt).toLocaleString('ko-KR') : '알 수 없음';
    return '마지막 저장: ' + t + ' · ' + size + 'KB · Disenrolled: ' + dis + '명';
  } catch (e) { return '정보 없음'; }
}

// ── apiCall 래퍼 (SheetsAPI 위임) ────────────────────────────
function apiCall(getParams, postBody) {
  if (postBody) return SheetsAPI.post(postBody);
  return SheetsAPI.get(getParams);
}

var apiUrl = SheetsAPI.URL;
