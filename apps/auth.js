// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — Authorization 관리
// apps/auth.js
// ══════════════════════════════════════════════════════════════

function saveAuthStorage() { localStorage.setItem('auth_list', JSON.stringify(AUTH_LIST)); }

function authStatus(endDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((new Date(endDate + 'T00:00:00') - today) / 86400000);
  if (diff < 0)    return 'expired';
  if (diff <= 30)  return 'soon';
  return 'active';
}

function authStatusLabel(endDate) {
  const s    = authStatus(endDate);
  const diff = Math.floor((new Date(endDate + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
  if (s === 'expired') return '<span class="badge b-red">❌ 만료됨</span>';
  if (s === 'soon')    return '<span class="badge b-warn">⚠️ ' + diff + '일 후 만료</span>';
  return '<span class="badge b-ok">✅ 유효 (' + diff + '일)</span>';
}

var _authFilter = 'all';
function setAuthFilter(f, el) {
  _authFilter = f;
  document.querySelectorAll('#panel-authorization .fpill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderAuthList();
}

function renderAuthList() {
  const q    = (document.getElementById('auth-search') || {}).value || '';
  const list = AUTH_LIST.filter(a => {
    const m     = MEMBERS.find(x => x.id === a.memberId);
    const name  = m ? (m.kr + m.en) : '';
    const match = !q || name.toLowerCase().includes(q.toLowerCase()) || (a.authNo || '').includes(q);
    const st    = authStatus(a.endDate);
    return match && (_authFilter === 'all' || _authFilter === st);
  });

  let active = 0, soon = 0, expired = 0;
  AUTH_LIST.forEach(a => {
    const s = authStatus(a.endDate);
    if (s === 'active') active++;
    else if (s === 'soon') soon++;
    else expired++;
  });
  const el = document.getElementById('auth-active'); if (el) el.textContent = active;
  const el2 = document.getElementById('auth-soon');  if (el2) el2.textContent = soon;
  const el3 = document.getElementById('auth-exp');   if (el3) el3.textContent = expired;

  updateAuthAlert(soon, expired);

  let html = '';
  if (!list.length) { html = '<div class="empty-msg">Auth 기록이 없어요</div>'; }
  list.sort((a, b) => a.endDate < b.endDate ? -1 : 1);
  list.forEach(a => {
    const m      = MEMBERS.find(x => x.id === a.memberId);
    const mname  = m ? (m.kr + ' ' + m.en) : '(알 수 없음)';
    const st     = authStatus(a.endDate);
    const border = st === 'expired' ? 'border:1.5px solid #FF3B30' : st === 'soon' ? 'border:1.5px solid #FF9500' : '';
    html += `<div class="log-card" style="${border}">
      <div class="log-top"><div class="log-name">${mname}</div>${authStatusLabel(a.endDate)}</div>
      <div style="font-size:12px;color:#3C3C43;margin-bottom:5px"><b>${a.insurer || ''}</b> &nbsp;·&nbsp; Auth#: <b>${a.authNo || '—'}</b></div>
      <div style="font-size:11px;color:#8E8E93">${a.service || ''} &nbsp;|&nbsp; ${a.startDate || ''} ~ ${a.endDate || ''}${a.note ? ' &nbsp;|&nbsp; ' + a.note : ''}</div>
      <div class="log-actions" style="margin-top:7px">
        <button class="btn-sm" onclick="editAuth('${a.id}')">✏️ 수정</button>
        <button class="btn-danger" onclick="deleteAuth('${a.id}')">삭제</button>
      </div>
    </div>`;
  });
  const el4 = document.getElementById('auth-list'); if (el4) el4.innerHTML = html;
}

function openAuthModal(id) {
  document.getElementById('auth-modal-title').textContent = id ? '✏️ Auth 수정' : '➕ Auth 추가';
  document.getElementById('auth-edit-id').value = id || '';
  document.getElementById('auth-member-search').value = '';
  document.getElementById('auth-number').value = '';
  document.getElementById('auth-start').value  = '';
  document.getElementById('auth-end').value    = '';
  document.getElementById('auth-note').value   = '';
  filterAuthMemberList();
  if (id) {
    const a = AUTH_LIST.find(x => x.id === id);
    if (a) {
      document.getElementById('auth-insurer').value = a.insurer || 'Anthem MLTC';
      document.getElementById('auth-number').value  = a.authNo  || '';
      document.getElementById('auth-start').value   = toDisplayDate(a.startDate || '');
      document.getElementById('auth-end').value     = toDisplayDate(a.endDate   || '');
      document.getElementById('auth-service').value = a.service || 'Adult Day Services (S5105)';
      document.getElementById('auth-note').value    = a.note    || '';
      filterAuthMemberList();
      document.getElementById('auth-member-sel').value = a.memberId;
    }
  }
  openOv('ov-auth');
}

function filterAuthMemberList() {
  const q   = (document.getElementById('auth-member-search').value || '').toLowerCase();
  const sel = document.getElementById('auth-member-sel');
  sel.innerHTML = '';
  MEMBERS.filter(m => m.status !== 'disenrolled' && (!q || (m.kr || '').includes(q) || (m.en || '').toLowerCase().includes(q)))
    .forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = (m.kr || '') + ' ' + (m.en || '');
      sel.appendChild(opt);
    });
  sel.onchange = function () {
    const el = document.getElementById('auth-member-selected');
    const selected = sel.options[sel.selectedIndex];
    if (el && selected) { el.style.display = 'block'; el.textContent = '✅ ' + selected.textContent; }
  };
  const el = document.getElementById('auth-member-selected'); if (el) el.style.display = 'none';
}

function saveAuth() {
  const sel      = document.getElementById('auth-member-sel');
  const memberId = sel && sel.value ? sel.value : '';
  const authNo   = document.getElementById('auth-number').value.trim();
  const startDate = parseDate(document.getElementById('auth-start').value.trim());
  const endDate   = parseDate(document.getElementById('auth-end').value.trim());
  if (!memberId)              { alert('멤버를 선택해주세요 (목록에서 클릭)'); return; }
  if (!authNo)                { alert('Auth# 을 입력해주세요'); return; }
  if (!startDate || !endDate) { alert('시작일과 종료일을 입력해주세요'); return; }

  const editId2 = document.getElementById('auth-edit-id').value;
  const entry = {
    id:        editId2 || ('auth_' + Date.now()),
    memberId, insurer:   document.getElementById('auth-insurer').value,
    authNo, startDate, endDate,
    service:   document.getElementById('auth-service').value,
    note:      document.getElementById('auth-note').value.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (editId2) { const idx = AUTH_LIST.findIndex(x => x.id === editId2); if (idx >= 0) AUTH_LIST[idx] = entry; else AUTH_LIST.push(entry); }
  else AUTH_LIST.push(entry);
  saveAuthStorage();
  if (apiUrl) {
    apiCall({}, {
      action: editId2 ? 'update' : 'append', sheet: 'auth', id: editId2 || null,
      data: { 'ID': entry.id, '멤버ID': entry.memberId, '보험사': entry.insurer, 'Auth번호': entry.authNo, '시작일': entry.startDate, '종료일': entry.endDate, '서비스유형': entry.service, '메모': entry.note },
    }).catch(e => console.log('Auth Sheets sync:', e));
  }
  closeOv('ov-auth'); renderAuthList();
}

function editAuth(id)   { openAuthModal(id); }
function deleteAuth(id) {
  if (!confirm('삭제하시겠어요?')) return;
  AUTH_LIST = AUTH_LIST.filter(x => x.id !== id);
  saveAuthStorage();
  if (apiUrl) apiCall({}, { action: 'delete', sheet: 'auth', id }).catch(() => {});
  renderAuthList();
}
