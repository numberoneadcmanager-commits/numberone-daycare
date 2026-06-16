// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 앱 진입점 & 라우팅
// core/app.js
// ══════════════════════════════════════════════════════════════

// ── Google Auth ───────────────────────────────────────────────
function initGoogleAuth() {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: true,
    cancel_on_tap_outside: false,
  });

  const saved = localStorage.getItem('noad_session');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.email && ALLOWED_EMAILS.includes(user.email)) {
        _currentUser = user;
        showApp(user);
        return;
      }
    } catch (e) {}
  }

  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';

  google.accounts.id.renderButton(
    document.getElementById('g-signin-btn'),
    { theme: 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular', logo_alignment: 'left' }
  );
  google.accounts.id.prompt();
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  const email   = payload.email;
  if (!ALLOWED_EMAILS.includes(email)) {
    const err = document.getElementById('login-error');
    if (err) { err.style.display = 'block'; err.textContent = '❌ 접속 권한이 없습니다: ' + email; }
    return;
  }
  _currentUser = { email, name: payload.name, picture: payload.picture };
  localStorage.setItem('noad_session', JSON.stringify(_currentUser));
  showApp(_currentUser);
}

function showApp(user) {
  _currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  const sel = document.getElementById('app-select-screen');
  sel.style.display = 'flex';
  const userEl = document.getElementById('app-select-user');
  if (userEl) userEl.textContent = (user.name || user.email) + ' 님 안녕하세요 👋';
}

function selectApp(type) {
  document.getElementById('app-select-screen').style.display = 'none';
  if (type === 'ops') { window.location.href = 'operations.html'; return; }
  document.getElementById('app').style.display = 'flex';
  const pill = document.getElementById('api-pill');
  if (pill) {
    const nameShort = _currentUser.name ? _currentUser.name.split(' ')[0] : _currentUser.email.split('@')[0];
    let userEl = document.getElementById('hdr-user');
    if (!userEl) {
      userEl = document.createElement('div');
      userEl.id = 'hdr-user';
      userEl.style.cssText = 'display:flex;align-items:center;gap:5px;margin-top:3px;cursor:pointer';
      userEl.innerHTML = (_currentUser.picture ? '<img src="' + _currentUser.picture + '" style="width:20px;height:20px;border-radius:50%">' : '')
        + '<span style="font-size:10px;color:#3C3C43;font-weight:600">' + nameShort + '</span>'
        + '<span style="font-size:9px;color:#C7C7CC">▼</span>';
      userEl.onclick = function () {
        if (confirm('앱 선택 화면으로 돌아가시겠습니까?')) {
          document.getElementById('app').style.display = 'none';
          document.getElementById('app-select-screen').style.display = 'flex';
        }
      };
      pill.parentNode.insertBefore(userEl, pill.nextSibling);
    }
  }
}

function logout() {
  localStorage.removeItem('noad_session');
  _currentUser = null;
  google.accounts.id.disableAutoSelect();
  location.reload();
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json   = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(json);
}

// ── 탭 라우팅 ─────────────────────────────────────────────────
function goTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
  closeModal();

  // 출결 탭: 항상 Sheets에서 최신 데이터 로드
  if (tab === 'attendance') {
    loadAttFromSheets(toISO(curDate));
    return;
  }
  if (tab === 'dashboard'     && typeof renderDash         === 'function') renderDash();
  if (tab === 'members'       && typeof filterM            === 'function') filterM();
  if (tab === 'absence'       && typeof renderAbsence      === 'function') renderAbsence();
  if (tab === 'logs'          && typeof renderIncidents    === 'function') renderIncidents();
  if (tab === 'report'        && typeof renderReport       === 'function') renderReport();
  if (tab === 'forms'         && typeof initFormsTab       === 'function') initFormsTab();
  if (tab === 'authorization' && typeof renderAuthList     === 'function') renderAuthList();
  if (tab === 'visitor'       && typeof renderVisitorList  === 'function') renderVisitorList();
  if (tab === 'council'       && typeof renderCouncilList  === 'function') renderCouncilList();
}

// ── API 관련 ──────────────────────────────────────────────────
function setApiStatus(ok) {
  const el = document.getElementById('api-pill');
  el.className = 'api-pill ' + (ok ? 'api-ok' : 'api-no');
  el.textContent = ok ? '✅ Sheets 연동됨' : '⚡ Sheets 미연동';
}

function saveApiUrl() { testApi(); }

async function testApi() {
  document.getElementById('api-msg').textContent = '연결 테스트 중...';
  try {
    const ok = await SheetsAPI.ping();
    if (ok) {
      SheetsAPI.setStatusPill(true);
      document.getElementById('api-msg').textContent = '✅ 연결 성공!';
      loadAllData();
    } else {
      SheetsAPI.setStatusPill(false);
      document.getElementById('api-msg').textContent = '❌ 연결 실패';
    }
  } catch (e) { SheetsAPI.setStatusPill(false); document.getElementById('api-msg').textContent = '❌ ' + e.message; }
}

async function initSheets() {
  document.getElementById('api-msg').textContent = '시트 초기화 중...';
  try {
    const res = await SheetsAPI.initSheets();
    document.getElementById('api-msg').textContent = res.ok ? '✅ 완료!' : '❌ ' + res.error;
  } catch (e) { document.getElementById('api-msg').textContent = '❌ ' + e.message; }
}

async function loadAllData() {
  try {
    const members = await SheetsAPI.loadMembers();
    if (members && members.length > 0) {
      MEMBERS.length = 0;
      members.forEach(m => MEMBERS.push(m));
      mFilt = [...MEMBERS];
    }
    const all = await SheetsAPI.loadAll();
    incidents  = all.incidents;
    activities = all.activities;
    cases      = all.cases;
    if (all.authList && all.authList.length)    AUTH_LIST    = all.authList;
    if (all.visitorList && all.visitorList.length) VISITOR_LIST = all.visitorList;
    if (all.councilList && all.councilList.length) COUNCIL_LIST = all.councilList;
    renderIncidents(); renderActivities(); renderCases();
    updateDashNow(); renderAuthList(); renderVisitorList(); renderCouncilList(); filterM();
  } catch (e) { console.log('loadAllData error:', e); }
}

async function loadFromSheets() {
  try {
    showLoadingOverlay('Google Sheets에서 데이터 로드 중...');
    const members = await SheetsAPI.loadMembers();
    if (members && members.length > 0) {
      MEMBERS.length = 0;
      members.forEach(m => MEMBERS.push(m));
      mFilt = [...MEMBERS];
    }
    const staff = await SheetsAPI.loadStaff();
    if (staff && staff.length > 0) { STAFF = staff; }
    else { STAFF = DEFAULT_STAFF.slice(); uploadDefaultStaff(); }
    hideLoadingOverlay();
    return true;
  } catch (e) { hideLoadingOverlay(); console.log('Sheets load error:', e); return false; }
}

async function uploadDefaultStaff() {
  for (let i = 0; i < DEFAULT_STAFF.length; i++) {
    const s = DEFAULT_STAFF[i];
    try {
      await SheetsAPI.post({ action: 'upsert', sheet: '스태프', key: 'ID', value: s.id, data: {
        'ID': s.id, '한글이름': s.nameKr, '영문이름': s.name, '직책': s.role,
        '전화': s.phone, '이메일': s.email, '자격증': JSON.stringify(s.certs),
        'avBg': s.avBg, 'avColor': s.avColor,
      }});
    } catch (e) {}
  }
}

// ── 스태프 ────────────────────────────────────────────────────
function renderStaff() {
  document.getElementById('staff-list').innerHTML = STAFF.map(s => {
    const certHTML = s.certs.map(c => {
      const daysLeft = Math.round((new Date(c.exp) - new Date()) / (24 * 3600 * 1000));
      const cls  = daysLeft < 0 ? 'cert-exp' : daysLeft < 90 ? 'cert-warn' : 'cert-ok';
      const icon = daysLeft < 0 ? '❌' : daysLeft < 90 ? '⚠️' : '✅';
      return `<span class="cert-badge ${cls}">${icon} ${c.name} (${c.exp})</span>`;
    }).join('');
    return `<div class="staff-card">
      <div class="staff-top">
        <div class="staff-av" style="background:${s.avBg};color:${s.avColor}">${s.name[0]}</div>
        <div style="flex:1">
          <div class="staff-name">${s.nameKr} <span style="font-size:12px;font-weight:400;color:#8E8E93">${s.name}</span></div>
          <div class="staff-role">${s.role}</div>
          <div style="font-size:12px;color:#3C3C43;margin-top:2px">📞 ${s.phone} · ${s.email}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="openEditStaff('${s.id}')" style="padding:5px 10px;border-radius:7px;border:1px solid #E5E5EA;background:#F2F2F7;cursor:pointer;font-size:11px">✏️</button>
          <button onclick="deleteStaffIdx('${s.id}')" style="padding:5px 10px;border-radius:7px;border:none;background:#FFEBEE;color:#C62828;cursor:pointer;font-size:11px">🗑️</button>
        </div>
      </div>
      <div class="staff-certs">${certHTML}</div>
    </div>`;
  }).join('');
}

// ── 스태프 추가/편집 ──────────────────────────────────────────
function openAddStaff() {
  window._staffEditId = null;
  document.getElementById('staff-modal-title').textContent = '새 스태프 추가';
  ['sf-namekr','sf-name','sf-role','sf-phone','sf-email'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  window._staffCerts = [];
  renderStaffCerts();
  openOv('ov-staff-edit');
}

function openEditStaff(sid) {
  var s = STAFF.find(function(x){ return x.id === sid; }); if (!s) return;
  window._staffEditId = sid;
  document.getElementById('staff-modal-title').textContent = s.nameKr + ' — 정보 수정';
  document.getElementById('sf-namekr').value = s.nameKr || '';
  document.getElementById('sf-name').value   = s.name   || '';
  document.getElementById('sf-role').value   = s.role   || '';
  document.getElementById('sf-phone').value  = s.phone  || '';
  document.getElementById('sf-email').value  = s.email  || '';
  window._staffCerts = JSON.parse(JSON.stringify(s.certs || []));
  renderStaffCerts();
  openOv('ov-staff-edit');
}

function renderStaffCerts() {
  var wrap = document.getElementById('sf-certs-list'); if (!wrap) return;
  wrap.innerHTML = (window._staffCerts || []).map(function(c, i){
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      + '<input class="m-input" style="flex:1;margin:0" value="' + (c.name||'') + '" oninput="window._staffCerts[' + i + '].name=this.value" placeholder="자격증명">'
      + '<input class="m-input" type="date" style="width:130px;margin:0" value="' + (c.exp||'') + '" oninput="window._staffCerts[' + i + '].exp=this.value">'
      + '<button onclick="window._staffCerts.splice(' + i + ',1);renderStaffCerts()" style="padding:4px 8px;border-radius:6px;border:none;background:#FFEBEE;color:#C62828;cursor:pointer">✕</button>'
      + '</div>';
  }).join('');
}

function addStaffCert() {
  if (!window._staffCerts) window._staffCerts = [];
  window._staffCerts.push({ name:'', exp:'' });
  renderStaffCerts();
}

async function saveStaffEdit() {
  var nameKr = document.getElementById('sf-namekr').value.trim();
  var name   = document.getElementById('sf-name').value.trim();
  var role   = document.getElementById('sf-role').value.trim();
  if (!nameKr || !name) { alert('이름을 입력해주세요.'); return; }
  var COLORS = [{bg:'#FAECE7',color:'#993C1D'},{bg:'#E6F1FB',color:'#185FA5'},{bg:'#E1F5EE',color:'#0F6E56'},{bg:'#EEEDFE',color:'#534AB7'}];
  var sid = window._staffEditId || ('S' + Date.now());
  var existStaff = window._staffEditId ? STAFF.find(function(x){ return x.id === sid; }) : null;
  var clr = existStaff ? { bg: existStaff.avBg, color: existStaff.avColor } : COLORS[STAFF.length % COLORS.length];
  var staffData = {
    id: sid, nameKr: nameKr, name: name, role: role,
    phone: document.getElementById('sf-phone').value.trim(),
    email: document.getElementById('sf-email').value.trim(),
    certs: window._staffCerts || [], avBg: clr.bg, avColor: clr.color,
  };
  if (window._staffEditId) {
    var idx = STAFF.findIndex(function(x){ return x.id === sid; });
    if (idx >= 0) STAFF[idx] = staffData;
  } else { STAFF.push(staffData); }
  try { await SheetsAPI.saveStaff(staffData); } catch (e) { console.log('Staff save error:', e); }
  closeOv('ov-staff-edit'); renderStaff(); alert(nameKr + ' 저장됨');
}

async function deleteStaffIdx(sid) {
  if (!confirm('스태프를 삭제하시겠습니까?')) return;
  STAFF = STAFF.filter(function(s){ return s.id !== sid; });
  try { await SheetsAPI.deleteStaff(sid); } catch (e) {}
  renderStaff();
}

// ── PCSP 관련 ─────────────────────────────────────────────────
function showPCSPList() {
  document.getElementById('pcsp-list-v').style.display = 'block';
  document.getElementById('pcsp-form-v').style.display = 'none';
  renderPCSPList();
}

function renderPCSPList() {
  const q    = (document.getElementById('psearch') || {}).value || '';
  const list = q
    ? MEMBERS.filter(m => m.kr.includes(q) || m.en.toLowerCase().includes(q.toLowerCase()) || m.medicaid.toLowerCase().includes(q.toLowerCase()))
    : MEMBERS;
  document.getElementById('pcsp-list').innerHTML = list.slice(0, 25).map(m =>
    `<div class="mc ${isActive(m) ? '' : 'disenrolled-card'}" onclick="openPCSPForm('${m.id}')">
      <div class="mc-top">
        <div class="mc-av" style="background:${m.avBg};color:${m.avColor};overflow:hidden;padding:0">
          ${m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover">' : m.kr[0]}
        </div>
        <div><div class="mc-name">${m.kr} <span style="font-size:11px;font-weight:400;color:#8E8E93">${m.en}</span></div>
        <div class="mc-en">Medicaid: ${m.medicaid} | ${m.pcp || '—'}</div></div>
      </div>
      <button class="btn-full btn-primary" style="margin-top:8px;padding:10px;font-size:13px" onclick="event.stopPropagation();openPCSPForm('${m.id}')">PCSP 입력 시작 →</button>
    </div>`
  ).join('');
}

function openPCSPForm(mid) {
  if (mid) localStorage.setItem('pcsp_prefill_mid', mid);
  window.location.href = 'operations.html?tab=pcsp&mid=' + (mid || '');
}

function goStep(s) {
  document.querySelectorAll('.pstep').forEach(p => p.classList.remove('active'));
  document.getElementById('ps-' + s).classList.add('active');
  document.querySelectorAll('.ptab').forEach((t, i) => { t.className = 'ptab' + (i === s ? ' active' : i < s ? ' done' : ''); });
  curStep = s;
  document.getElementById('pctr').textContent = (s + 1) + ' / 7';
  document.getElementById('ps-prev').style.visibility = s === 0 ? 'hidden' : 'visible';
  document.getElementById('ps-next').textContent = s === 6 ? '완료' : '다음';
  document.getElementById('pcsp-pf').style.width = Math.round((s + 1) / 7 * 100) + '%';
  if (s === 6) buildSummary();
  document.querySelector('.content').scrollTop = 0;
}
function nextStep() { if (curStep < 6) goStep(curStep + 1); }
function prevStep() { if (curStep > 0) goStep(curStep - 1); }
function toggleDay(btn, day) {
  if (selDays.has(day)) { selDays.delete(day); btn.classList.remove('sel'); }
  else                  { selDays.add(day);    btn.classList.add('sel'); }
}
function updatePreview() {
  const f = document.getElementById('f-first').value, l = document.getElementById('f-last').value, kr = document.getElementById('f-kr').value;
  let d = ''; if (f || l) d += (l && f ? l + ', ' + f : l || f); if (kr) d += (d ? ' (' + kr + ')' : kr);
  document.getElementById('name-preview').textContent = '문서 표시: ' + (d || '—');
}
function buildSummary() {
  const f = gv('f-first'), l = gv('f-last'), kr = gv('f-kr');
  const en   = (l && f ? l + ', ' + f : l || f) || '—';
  const days = [...selDays].map(d => DKR[d] || d).join(', ') || '—';
  document.getElementById('pcsp-summary').innerHTML = `
    <div><b>참여자:</b> ${en}${kr ? ' (' + kr + ')' : ''}</div>
    <div><b>생년월일:</b> ${gv('f-dob') || '—'} | <b>언어:</b> ${gv('f-lang')}</div>
    <div><b>작성자:</b> ${gv('f-writer') || '—'} / ${gv('f-wdate') || '—'}</div>
    <div><b>보험사:</b> ${gv('f-ins') || '—'} | Medicaid: ${gv('f-medicaid') || '—'} | MLTC: ${gv('f-mltc') || '—'}</div>
    <div><b>주치의:</b> ${gv('f-pcp') || '—'}</div>
    <div><b>출석 요일:</b> ${days}</div>
    <div><b>진단:</b> ${(gv('f-diag') || '—').substring(0, 60)}</div>`;
}
function generatePCSP() {
  const f = gv('f-first'), l = gv('f-last');
  if (!f && !l) { alert('참여자 이름을 입력해주세요.'); goStep(0); return; }
  alert('PCSP 작성은 업무 관리 앱에서 진행됩니다.');
  window.location.href = 'operations.html?tab=pcsp';
}

// ── 멤버 차트 PDF ─────────────────────────────────────────────
function generateMemberChart(mid) {
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  const dobF = m.dob ? new Date(m.dob.slice(0,10)+'T00:00:00').toLocaleDateString('en-US') : '—';
  const days = (m.days||[]).map(d=>({Mon:'월',Tue:'화',Wed:'수',Thu:'목',Fri:'금',Sat:'토',Sun:'일'}[d]||d)).join(', ');
  const insStr = {Anthem_MLTC:'Anthem MLTC',Anthem_MAP:'Anthem MAP',CLP:'Centerlight PACE',SWH:'Senior Whole Health'}[m.ins]||m.ins;
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chart - ${m.en}</title>
<style>@page{size:letter;margin:0.6in}body{font-family:Arial,sans-serif;font-size:10px}
.hd{text-align:center;border-bottom:2px solid #D85A30;padding-bottom:8px;margin-bottom:14px}
h1{font-size:13px;font-weight:bold;color:#D85A30}
.grid{display:grid;grid-template-columns:140px 1fr;gap:16px}
.photo{width:140px;height:170px;border:1.5px solid #ccc;border-radius:8px;overflow:hidden;background:#F2F2F7;display:flex;align-items:center;justify-content:center}
table{width:100%;border-collapse:collapse}
td{padding:4px 6px;border-bottom:.5px solid #E5E5EA;font-size:9.5px}
td:first-child{font-weight:700;color:#555;width:100px}
.name{font-size:20px;font-weight:800;color:#D85A30;margin-bottom:2px}
.sub{font-size:12px;color:#555;margin-bottom:10px}
</style></head><body>
<div class="hd"><h1>NUMBER ONE ADULT DAYCARE / 넘버원 어덜트 데이케어</h1>
<div style="font-size:9px;color:#666">161-22 Northern Blvd 1FL, Flushing, NY 11358 · 718-799-0248</div></div>
<div class="grid">
<div><div class="photo">${m.photo?`<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover">`:'<div style="text-align:center;color:#C7C7CC"><div style="font-size:30px">👤</div><div>사진 없음</div></div>'}</div>
<div style="text-align:center;margin-top:6px;font-size:9px;color:#8E8E93">차트번호: <b style="color:#D85A30;font-size:11px">${m.chartNo||m.id}</b></div></div>
<div><div class="name">${m.kr}</div><div class="sub">${m.en}</div>
<table>
<tr><td>생년월일</td><td>${dobF}</td></tr>
<tr><td>Medicaid</td><td>${m.medicaid}</td></tr>
<tr><td>MLTC ID</td><td>${m.mltc||'—'}</td></tr>
<tr><td>보험사</td><td>${insStr}</td></tr>
<tr><td>출석 요일</td><td>${days}</td></tr>
<tr><td>전화</td><td>${m.phone||'—'}</td></tr>
<tr><td>주소</td><td>${m.addr||'—'}</td></tr>
<tr><td>주치의</td><td>${m.pcp||'—'}</td></tr>
</table></div></div>
<div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:30px">
<div><div style="height:40px;border-bottom:1px solid #000;margin-bottom:4px"></div><div style="font-size:9px;color:#555">작성자 서명</div></div>
<div><div style="height:40px;border-bottom:1px solid #000;margin-bottom:4px"></div><div style="font-size:9px;color:#555">Date</div></div>
</div>
<button onclick="window.print()" style="margin-top:10px;padding:8px 16px;background:#D85A30;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ 인쇄</button>
</body></html>`);
  w.document.close();
}

// ── 초기화 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleAuth();
  } else {
    const checkInterval = setInterval(function () {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(checkInterval);
        initGoogleAuth();
      }
    }, 200);
  }

  const now0 = new Date();
  document.getElementById('hdr-date').textContent = now0.getFullYear() + '년 ' + (now0.getMonth()+1) + '월 ' + now0.getDate() + '일';
  document.getElementById('hdr-dow').textContent  = DNAMES[now0.getDay()] + '요일';
  DKEYS.forEach(d => { const p = document.getElementById('pip-'+d); if (p && d === DKEYS[now0.getDay()]) p.classList.add('on'); });

  document.getElementById('adl-fields').innerHTML = ADL_ITEMS.map((item, i) =>
    `<div class="adl-pair">
      <div class="fg" style="margin:0"><div class="fl">${item}</div><select class="fs" id="adl-${i}">${ADL_OPTS.map(o=>`<option>${o}</option>`).join('')}</select></div>
      <div class="fg" style="margin:0"><div class="fl">보조 기기</div><input class="fi" id="dev-${i}" placeholder="없음"></div>
    </div>`).join('');

  // 멤버 select는 MEMBERS 로드 후 채워짐 (loadAllData에서 처리)
  ['inc','act','case'].forEach(px => {
    const sel = document.getElementById(px+'-msel');
    if (sel && MEMBERS && MEMBERS.length) sel.innerHTML = MEMBERS.map(m=>`<option value="${m.id}">${m.kr} (${m.en})</option>`).join('');
  });

  ['inc','act','case'].forEach(px => {
    const f = document.getElementById(px+'-from'), t = document.getElementById(px+'-to');
    if (f) f.value = weekAgoISO; if (t) t.value = todayISO;
  });

  const bind = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

  bind('asearch',         'input',  () => renderAtt());
  bind('msearch',         'input',  () => filterM());
  bind('status-filter',   'change', () => filterM());
  bind('psearch',         'input',  () => renderPCSPList());
  bind('f-first',         'input',  () => updatePreview());
  bind('f-last',          'input',  () => updatePreview());
  bind('f-kr',            'input',  () => updatePreview());
  bind('inc-from',        'change', () => renderIncidents());
  bind('inc-to',          'change', () => renderIncidents());
  bind('act-from',        'change', () => renderActivities());
  bind('act-to',          'change', () => renderActivities());
  bind('case-from',       'change', () => renderCases());
  bind('case-to',         'change', () => renderCases());
  bind('rpt-from',        'change', () => renderReport());
  bind('rpt-to',          'change', () => renderReport());
  bind('frm-search',      'input',  () => typeof filterFrmMembers === 'function' && filterFrmMembers());
  bind('ns-height',       'input',  () => typeof calcNSBMI === 'function' && calcNSBMI());
  bind('ns-weight',       'input',  () => typeof calcNSBMI === 'function' && calcNSBMI());
  bind('vis-search',      'input',  () => renderVisitorList());
  bind('council-search',  'input',  () => renderCouncilList());
  bind('auth-search',     'input',  () => renderAuthList());
  bind('auth-member-search','input',() => filterAuthMemberList());
  bind('auth-start',      'input',  function(){ autoFormatDate(this); });
  bind('auth-end',        'input',  function(){ autoFormatDate(this); });
  bind('inc-msearch',     'input',  () => filterMSel('inc'));
  bind('act-msearch',     'input',  () => filterMSel('act'));
  bind('case-msearch',    'input',  () => filterMSel('case'));
  bind('sm-active',       'change', () => toggleStatusRadio());
  bind('sm-disenrolled',  'change', () => toggleStatusRadio());

  document.getElementById('api-url-input').value = apiUrl;

  // localStorage에서 출결 외 데이터 로드
  loadFromStorage();
  setTimeout(() => { const el = document.getElementById('storage-info'); if (el) el.textContent = showStorageInfo(); }, 100);

  // 초기 렌더링
  updateDN(); renderDash(); renderPCSPList(); renderStaff();
  renderIncidents(); renderActivities(); renderCases();
  renderAuthList(); renderVisitorList(); renderCouncilList();
  setTimeout(() => initBilling && initBilling(), 100);

  document.getElementById('rpt-from').value = weekAgoISO;
  document.getElementById('rpt-to').value   = todayISO;

  // Sheets 연결 후 데이터 로드 + 출결 로드
  SheetsAPI.ping().then(ok => {
    SheetsAPI.setStatusPill(ok);
    if (ok) {
      loadFromSheets().then(ok2 => {
        if (ok2) {
          renderDash(); filterM(); renderStaff();
          // 출결은 Sheets에서 직접 로드
          loadAttFromSheets(toISO(curDate));
        }
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Assessment / Forms 탭
// ══════════════════════════════════════════════════════════════

function initFormsTab() {
  document.getElementById('frm-list').style.display = 'block';
  document.getElementById('frm-assessment').style.display = 'none';
  document.getElementById('frm-nutrition').style.display = 'none';
  document.getElementById('frm-member-rights').style.display = 'none';
  filterFrmMembers();
}

function filterFrmMembers() {
  const q   = ((document.getElementById('frm-search')||{}).value||'').toLowerCase();
  const el  = document.getElementById('frm-member-list');
  if (!el) return;
  const list = MEMBERS.filter(m =>
    m.status !== 'disenrolled' &&
    (!q||(m.kr||'').includes(q)||(m.en||'').toLowerCase().includes(q)||(m.medicaid||'').toLowerCase().includes(q))
  );
  if (!list.length) { el.innerHTML = '<div class="empty-msg">멤버를 찾을 수 없어요</div>'; return; }
  el.innerHTML = list.map(m => `
    <div class="log-card" style="cursor:pointer">
      <div class="log-top">
        <div class="log-name" style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${m.avBg};color:${m.avColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${(m.kr||'').slice(0,1)}</div>
          <div><div style="font-size:13px;font-weight:700">${m.kr}</div><div style="font-size:11px;color:#8E8E93">${m.en}</div></div>
        </div>
      </div>
      <div style="font-size:11px;color:#8E8E93;margin:4px 0 8px">Medicaid: ${m.medicaid} · ${m.ins}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" style="background:#E6F1FB;color:#185FA5" onclick="openAssessment('${m.id}')">📋 Assessment</button>
        <button class="btn-sm" style="background:#E1F5EE;color:#0F6E56" onclick="openNutritionScreening('${m.id}')">🥗 Nutrition</button>
        <button class="btn-sm" style="background:#EEEDFE;color:#534AB7" onclick="openMemberRights('${m.id}')">📄 Member Rights</button>
      </div>
    </div>`).join('');
}

function openAssessment(mid) {
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  _asmt.mid = mid; _asmt.step = 0;
  document.getElementById('frm-list').style.display = 'none';
  document.getElementById('frm-assessment').style.display = 'block';
  const hdr = document.getElementById('as-member-header'); if (hdr) hdr.textContent = m.kr+' ('+m.en+')';
  const nkr = document.getElementById('as-name-kr'); if (nkr) nkr.textContent = m.kr;
  const nen = document.getElementById('as-name-en'); if (nen) nen.textContent = m.en;
  const dob = document.getElementById('as-dob');     if (dob) dob.value = m.dob||'';
  const med = document.getElementById('as-medicaid');if (med) med.value = m.medicaid||'';
  const phn = document.getElementById('as-phone');   if (phn) phn.value = m.phone||'';
  const adr = document.getElementById('as-addr');    if (adr) adr.value = m.addr||'';
  const adate = document.getElementById('as-date');  if (adate) adate.value = new Date().toISOString().slice(0,10);
  goAssessStep(0);
  if (typeof initSigCanvas === 'function') initSigCanvas('as-sig-canvas', function(d){ _asSig = d; });
}

function openNutritionScreening(mid) {
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  _nsMid = mid;
  document.getElementById('frm-list').style.display = 'none';
  document.getElementById('frm-nutrition').style.display = 'block';
  const nn = document.getElementById('ns-name'); if (nn) nn.textContent = m.kr+' ('+m.en+')';
  const nd = document.getElementById('ns-dob');  if (nd) nd.textContent = m.dob||'';
  const ndate = document.getElementById('ns-date'); if (ndate) ndate.value = new Date().toISOString().slice(0,10);
  if (typeof initSigCanvas === 'function') {
    initSigCanvas('ns-member-canvas', function(d){ _nsMemberSig = d; });
    initSigCanvas('ns-staff-canvas',  function(d){ _nsStaffSig  = d; });
  }
}

function openMemberRights(mid) {
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  _mrMid = mid;
  document.getElementById('frm-list').style.display = 'none';
  document.getElementById('frm-member-rights').style.display = 'block';
  const mn = document.getElementById('mr-name'); if (mn) mn.textContent = m.kr+' ('+m.en+')';
  const md = document.getElementById('mr-dob');  if (md) md.textContent = m.dob||'';
  const mdate = document.getElementById('mr-date'); if (mdate) mdate.value = new Date().toISOString().slice(0,10);
  if (typeof initSigCanvas === 'function') initSigCanvas('mr-sig-canvas', function(d){ _mrSig = d; });
}

function goAssessStep(n) {
  const steps = document.querySelectorAll('#frm-assessment .as-step');
  const tabs  = document.querySelectorAll('#frm-assessment .as-tab');
  steps.forEach((s,i) => s.style.display = i===n?'block':'none');
  tabs.forEach((t,i) => t.classList.toggle('active', i===n));
  _asmt.step = n;
  const total = steps.length;
  const pf  = document.getElementById('as-pf');   if(pf)  pf.style.width = ((n+1)/total*100)+'%';
  const ctr = document.getElementById('as-pctr'); if(ctr) ctr.textContent = (n+1)+' / '+total;
  const prv = document.getElementById('as-prev'); if(prv) prv.style.visibility = n===0?'hidden':'visible';
  const nxt = document.getElementById('as-next'); if(nxt) nxt.textContent = n===total-1?'완료':'다음';
  const pcspBtn = document.getElementById('as-pcsp-btn'); if(pcspBtn) pcspBtn.style.display = n===total-1?'block':'none';
}

function nextAssessStep() {
  const steps = document.querySelectorAll('#frm-assessment .as-step');
  if (_asmt.step < steps.length-1) goAssessStep(_asmt.step+1);
  else { alert('✅ Assessment 완료!'); initFormsTab(); }
}

function prevAssessStep() { if (_asmt.step > 0) goAssessStep(_asmt.step-1); }

function calcNSBMI() {
  const h = parseFloat(document.getElementById('ns-height').value);
  const w = parseFloat(document.getElementById('ns-weight').value);
  const el = document.getElementById('ns-bmi'); if (!el) return;
  el.value = (h>0&&w>0) ? (w/(h*h)*703).toFixed(1) : '';
}

function clearNSSig(who) {
  const id  = who==='member'?'ns-member-canvas':'ns-staff-canvas';
  const eid = who==='member'?'ns-member-empty':'ns-staff-empty';
  const canvas = document.getElementById(id);
  if (canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  const empty = document.getElementById(eid); if (empty) empty.style.display='flex';
  if (who==='member') _nsMemberSig=null; else _nsStaffSig=null;
}

function clearMRSig() {
  const canvas = document.getElementById('mr-sig-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  const empty = document.getElementById('mr-sig-empty'); if (empty) empty.style.display='flex';
  _mrSig = null;
}
