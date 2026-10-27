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

// 디스엔롤 날짜를 YYYY-MM-DD로 정리 (시트에서 날짜/문자열 어느 형태로 와도 처리)
function disenrollISO(m) {
  var v = String((m && m.disenrollDate) || '').trim();
  if (!v) return '';
  var hit = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (hit) return hit[1];
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE');
}

// 출결 대상 여부 — 디스엔롤된 멤버는 디스엔롤 날짜(당일 포함)부터 출결 대상에서 제외.
// 그 이전 날짜는 실제 서비스 기록(청구 근거)이므로 그대로 대상에 남긴다.
// 디스엔롤 상태인데 날짜가 비어 있으면 항상 제외.
function isAttendanceTarget(m, iso) {
  if (!m || m.status !== 'disenrolled') return true;
  var cut = disenrollISO(m);
  return !!cut && iso < cut;
}

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
  WriteGuard.beginEdit(id);
  document.getElementById(id).classList.add('open');
  document.getElementById(id.replace(/^ov-/, 'modal-ov-')).style.display = 'block';
}

function closeOv(id) {
  WriteGuard.endEdit(id);
  document.getElementById(id).classList.remove('open');
  document.getElementById(id.replace(/^ov-/, 'modal-ov-')).style.display = 'none';
  editId = null; popId = null; popDate = null; mCurSt = null;
}

function closeModal() {
  document.querySelectorAll('.ov.open').forEach(o => {WriteGuard.endEdit(o.id);o.classList.remove('open');});
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  editId = null; popId = null; popDate = null; mCurSt = null;
}

// ── 멤버 select 필터링 ────────────────────────────────────────
// 로그(Incident / Activity / Case) 멤버 선택 상태.
// select 목록이 새로 그려져도(검색, 자동 새로고침) 고른 멤버가 풀리지 않도록 따로 기억한다.
var MSEL_PICKED = { inc: '', act: '', case: '', ab: '', auth: '', cancel: '' };
// 멤버 선택 칸 목록: 검색칸 id, 목록 id, 디스엔롤 제외 여부, 선택 시 추가 동작
var MSEL_CONF = {
  inc:    { s: 'inc-msearch',        l: 'inc-msel' },
  act:    { s: 'act-msearch',        l: 'act-msel' },
  case:   { s: 'case-msearch',       l: 'case-msel' },
  ab:     { s: 'ab-member-search',   l: 'ab-member-sel',   activeOnly: true },
  auth:   { s: 'auth-member-search', l: 'auth-member-sel', activeOnly: true, onPick: function(m){ if (typeof authApplyMemberDays === 'function') authApplyMemberDays(m); } },
  cancel: { s: 'cancel-msearch',     l: 'cancel-msel',     activeOnly: true },
};
function _mselIn(px){ return document.getElementById((MSEL_CONF[px] || {}).s || (px + '-msearch')); }
function _mselList(px){ return document.getElementById((MSEL_CONF[px] || {}).l || (px + '-msel')); }
// 내부 ID 또는 (예전 기록의) Medicaid 번호 → 멤버
function findMemberByAnyId(id){
  var v = String(id == null ? '' : id).trim(); if (!v) return null;
  return MEMBERS.find(function(m){ return String(m.id) === v; })
      || MEMBERS.find(function(m){ return m.medicaid && String(m.medicaid).trim().toUpperCase() === v.toUpperCase(); }) || null;
}
function _mselEsc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderMSel(px) {
  const input = _mselIn(px);
  const sel = _mselList(px);
  if (!sel) return;
  const q = ((input && input.value) || '').trim().toLowerCase();
  const picked = MSEL_PICKED[px] || '';
  const pickedM = MEMBERS.find(m => String(m.id) === String(picked));
  const pickedLabel = pickedM ? (pickedM.kr + ' (' + pickedM.en + ')').toLowerCase() : '';
  // 검색칸에 고른 멤버 이름이 그대로 있으면 전체 목록을 보여준다
  const useQ = q && q !== pickedLabel && !(pickedM && q === String(pickedM.kr).toLowerCase());
  const conf = MSEL_CONF[px] || {};
  let list = MEMBERS.filter(m => (!conf.activeOnly || m.status !== 'disenrolled') && (!useQ || String(m.kr || '').toLowerCase().includes(q) || String(m.en || '').toLowerCase().includes(q) || String(m.medicaid || '').toLowerCase().includes(q)));
  if (pickedM && !list.includes(pickedM)) list = [pickedM].concat(list);
  sel.innerHTML = list.map(m => `<option value="${_mselEsc(m.id)}"${String(m.id) === String(picked) ? ' selected' : ''}>${_mselEsc(m.kr)} (${_mselEsc(m.en)})</option>`).join('');
  // 자동 선택은 하지 않는다 (입력 중에 이름이 바뀌어 지울 수 없게 되던 문제). 결과가 한 명이면 Enter로 선택.
  _renderMSelPicked(px);
}
function filterMSel(px) {
  const input = _mselIn(px);
  const picked = MEMBERS.find(m => String(m.id) === String(MSEL_PICKED[px]));
  // 검색어를 바꾸기 시작하면 이전 선택은 해제 (다른 멤버를 찾는 중)
  if (picked && input && input.value.trim() !== String(picked.kr)) MSEL_PICKED[px] = '';
  renderMSel(px);
}
function pickMSel(px, mid, silent) {
  const found = mid ? findMemberByAnyId(mid) : null;   // 예전 Medicaid 번호로 저장된 기록도 내부 ID로 맞춤
  MSEL_PICKED[px] = found ? String(found.id) : '';
  const m = found;
  const input = _mselIn(px);
  if (input && m) input.value = m.kr;
  renderMSel(px);
  const conf = MSEL_CONF[px] || {};
  if (m && conf.onPick && !silent) conf.onPick(m);
}
function _renderMSelPicked(px) {
  const sel = _mselList(px);
  if (!sel) return;
  let chip = document.getElementById(px + '-mpicked');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = px + '-mpicked';
    chip.style.cssText = 'font-size:12px;font-weight:600;margin-top:4px';
    sel.insertAdjacentElement('afterend', chip);
  }
  const m = MEMBERS.find(x => String(x.id) === String(MSEL_PICKED[px]));
  chip.style.color = m ? '#34C759' : '#FF9500';
  chip.textContent = m ? '✓ 선택됨: ' + m.kr + ' (' + m.en + ')' : '멤버를 목록에서 눌러 선택해주세요 (한 명이면 Enter)';
}
function resetMSel(px, mid, silent) {
  const input = _mselIn(px);
  if (input) input.value = '';
  MSEL_PICKED[px] = '';
  if (mid) pickMSel(px, mid, silent); else renderMSel(px);
}
function getMSel(px) {
  const mid = MSEL_PICKED[px] || ((_mselList(px) || {}).value) || '';
  const m = findMemberByAnyId(mid);
  return m ? String(m.id) : '';
}
function refreshAllMSel() { Object.keys(MSEL_CONF).forEach(renderMSel); }
function bindMSel(px) {
  const sel = _mselList(px);
  if (!sel || sel._mselBound) return;
  sel._mselBound = true;
  const take = () => { if (sel.value) pickMSel(px, sel.value); };
  sel.addEventListener('change', take);
  sel.addEventListener('click', take);
  sel.addEventListener('dblclick', take);
  // 검색칸에서 Enter: 결과가 한 명이면 그 멤버 선택
  const input = _mselIn(px);
  if (input) input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (sel.options.length === 1) pickMSel(px, sel.options[0].value);
  });
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
  return '이 기기에는 운영 데이터를 저장하지 않습니다. 데이터 원본은 Google Sheets / Drive입니다.';
}

// API wrappers are defined once in core/api.js. apiCall = POST, apiGet = GET.
var apiUrl = SheetsAPI.URL;

// Sheet/user text used in HTML content or quoted attributes.
function escapeHTML(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

