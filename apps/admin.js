// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 관리자 설정 (업무관리 → ⚙️ 관리자)
// apps/admin.js
// - 관리자(role=admin)로 로그인했을 때만 탭이 보입니다. 서버도 관리자만 허용합니다.
// - 접근 권한: 직원 추가 · 이름 수정 · 권한(관리자/직원) · 사용 중지
// - 기본 관리자(서버 ADMIN_EMAIL)는 앱에서 바꿀 수 없습니다.
// - 모든 변경은 서버 ChangeLog에 변경자와 함께 기록됩니다.
// ══════════════════════════════════════════════════════════════
var _adminUsers = [], _adminBootstrap = '', _adminBusy = false;

function adminEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function adminInit() {
  if (!window.ADCSession || !ADCSession.isAdmin()) return;
  if (document.getElementById('panel-admin')) return;
  var bar = document.querySelector('.tabbar'), content = document.querySelector('.content');
  if (!bar || !content) return;
  var tab = document.createElement('div');
  tab.className = 'tab'; tab.id = 'tab-admin'; tab.textContent = '⚙️ 관리자';
  tab.onclick = function () { goTab('admin', tab); adminLoad(); };
  bar.appendChild(tab);
  var panel = document.createElement('div');
  panel.className = 'panel'; panel.id = 'panel-admin';
  panel.innerHTML =
    '<div class="card" style="padding:14px;margin-bottom:12px">'
    + '<div style="font-size:15px;font-weight:800;margin-bottom:4px">🔐 접근 권한</div>'
    + '<div style="font-size:12px;color:#8E8E93;line-height:1.5">앱에 로그인할 수 있는 직원 Google 계정입니다. 사용 중지하면 다음 요청부터 바로 막힙니다 (최대 2분).<br>'
    + '기본 관리자 <b id="adm-boot"></b> 은(는) 서버 설정(ADMIN_EMAIL)으로만 바꿀 수 있습니다.</div></div>'
    + '<div class="card" style="padding:14px;margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:700;margin-bottom:8px">➕ 직원 추가</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + '<input id="adm-email" type="email" placeholder="Google 이메일" style="flex:2;min-width:180px;padding:9px;border:1px solid #E5E5EA;border-radius:8px;font-size:13px">'
    + '<input id="adm-name" placeholder="이름 (작성자 칸에 들어갈 이름)" style="flex:2;min-width:140px;padding:9px;border:1px solid #E5E5EA;border-radius:8px;font-size:13px">'
    + '<select id="adm-role" style="flex:1;min-width:90px;padding:9px;border:1px solid #E5E5EA;border-radius:8px;font-size:13px"><option value="staff">직원</option><option value="admin">관리자</option></select>'
    + '<button onclick="adminAdd()" style="padding:9px 16px;border:none;border-radius:8px;background:#007AFF;color:#fff;font-weight:700;font-size:13px;cursor:pointer">추가</button>'
    + '</div><div id="adm-msg" style="font-size:12px;margin-top:8px;color:#8E8E93"></div></div>'
    + '<div id="adm-list"><div class="empty-msg">불러오는 중...</div></div>';
  content.appendChild(panel);
}

async function adminLoad() {
  var el = document.getElementById('adm-list'); if (!el) return;
  try {
    var r = await apiGet({ action: 'accessList' });
    _adminUsers = (r.data && r.data.users) || [];
    _adminBootstrap = (r.data && r.data.bootstrapAdmin) || '';
    adminRender();
  } catch (e) { el.innerHTML = '<div class="empty-msg">❌ ' + adminEsc(e.message) + '</div>'; }
}

function adminRender() {
  var boot = document.getElementById('adm-boot'); if (boot) boot.textContent = _adminBootstrap;
  var el = document.getElementById('adm-list'); if (!el) return;
  var me = (ADCSession.user() || {}).email;
  var rows = _adminUsers.slice().sort(function (a, b) { return (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1) || String(a.name || a.email).localeCompare(String(b.name || b.email)); });
  var head = '<div class="card" style="padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;background:#F2F7FF">'
    + '<div style="flex:1"><div style="font-weight:700;font-size:13px">' + adminEsc(_adminBootstrap) + '</div><div style="font-size:11px;color:#8E8E93">기본 관리자 · 앱에서 변경 불가</div></div>'
    + '<span style="font-size:11px;font-weight:700;color:#007AFF">관리자</span></div>';
  if (!rows.length) { el.innerHTML = head + '<div class="empty-msg">등록된 직원이 없습니다</div>'; return; }
  el.innerHTML = head + rows.map(function (u) {
    var off = u.status !== 'active', self = u.email === me, e = adminEsc(u.email);
    return '<div class="card" style="padding:12px 14px;margin-bottom:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;' + (off ? 'opacity:.55' : '') + '">'
      + '<div style="flex:1;min-width:180px"><div style="font-weight:700;font-size:13px">' + adminEsc(u.name || '(이름 없음)') + (self ? ' <span style="font-size:10px;color:#34C759">· 나</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:#3C3C43">' + e + '</div>'
      + (u.changedBy ? '<div style="font-size:10px;color:#8E8E93">마지막 변경: ' + adminEsc(u.changedBy) + ' · ' + adminEsc(String(u.changedAt || '').slice(0, 16).replace('T', ' ')) + '</div>' : '') + '</div>'
      + '<button onclick="adminRename(\'' + e + '\')" style="padding:6px 10px;border:1px solid #E5E5EA;border-radius:7px;background:#F2F2F7;font-size:11px;cursor:pointer">✏️ 이름</button>'
      + '<select onchange="adminSet(\'' + e + '\',{role:this.value})" ' + (self || off ? 'disabled' : '') + ' style="padding:6px;border:1px solid #E5E5EA;border-radius:7px;font-size:12px">'
      + '<option value="staff"' + (u.role !== 'admin' ? ' selected' : '') + '>직원</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>관리자</option></select>'
      + (self ? '' : '<button onclick="adminSet(\'' + e + '\',{status:\'' + (off ? 'active' : 'disabled') + '\'})" style="padding:6px 10px;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;'
        + (off ? 'background:#E8F5E9;color:#2E7D32">다시 사용' : 'background:#FFEBEE;color:#C62828">사용 중지') + '</button>')
      + '</div>';
  }).join('');
}

async function adminSave(payload, msg) {
  if (_adminBusy) return false;
  _adminBusy = true;
  try {
    await apiCall(Object.assign({ action: 'accessSave' }, payload));
    if (msg) { var m = document.getElementById('adm-msg'); if (m) { m.style.color = '#34C759'; m.textContent = msg; } }
    await adminLoad();
    return true;
  } catch (e) { alert('❌ ' + e.message); return false; }
  finally { _adminBusy = false; }
}

function adminFind(email) { return _adminUsers.filter(function (u) { return u.email === email; })[0]; }

async function adminAdd() {
  var email = document.getElementById('adm-email').value.trim().toLowerCase();
  var name = document.getElementById('adm-name').value.trim();
  var role = document.getElementById('adm-role').value;
  var m = document.getElementById('adm-msg');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { m.style.color = '#FF3B30'; m.textContent = '이메일 형식을 확인해주세요.'; return; }
  if (!name) { m.style.color = '#FF3B30'; m.textContent = '이름을 입력해주세요. (기록의 작성자 이름으로 쓰입니다)'; return; }
  if (email === _adminBootstrap) { m.style.color = '#FF3B30'; m.textContent = '기본 관리자는 이미 들어갈 수 있습니다.'; return; }
  var cur = adminFind(email);
  if (cur && !confirm(email + ' 은(는) 이미 등록되어 있습니다. 이름/권한을 바꾸고 사용 상태로 할까요?')) return;
  var ok = await adminSave({ email: email, name: name, role: role, status: 'active', reason: cur ? '다시 등록' : '직원 추가' }, '✅ ' + email + ' 저장했습니다.');
  if (ok) { document.getElementById('adm-email').value = ''; document.getElementById('adm-name').value = ''; document.getElementById('adm-role').value = 'staff'; }
}

async function adminSet(email, change) {
  var u = adminFind(email); if (!u) return;
  var next = Object.assign({ email: u.email, name: u.name, role: u.role, status: u.status }, change);
  var reason = '';
  if (change.status === 'disabled') {
    reason = prompt(email + ' 의 접속을 중지합니다. 사유를 입력해주세요. (예: 퇴사)', '');
    if (reason === null || !reason.trim()) { adminRender(); return; }
  } else if (change.role) {
    if (!confirm(email + ' 의 권한을 ' + (change.role === 'admin' ? '관리자' : '직원') + '(으)로 바꿀까요?')) { adminRender(); return; }
    reason = '권한 변경';
  } else reason = '다시 사용';
  next.reason = reason.trim();
  await adminSave(next);
}

async function adminRename(email) {
  var u = adminFind(email); if (!u) return;
  var name = prompt('이름 (기록의 작성자 이름으로 쓰입니다)', u.name || '');
  if (name === null || !name.trim() || name.trim() === u.name) return;
  await adminSave({ email: u.email, name: name.trim(), role: u.role, status: u.status, reason: '이름 변경' });
}
