// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 방문자 & 회의록
// apps/visitor.js
// ══════════════════════════════════════════════════════════════

// ── 방문자 ───────────────────────────────────────────────────
function saveVisitorStorage() { localStorage.setItem('visitor_list', JSON.stringify(VISITOR_LIST)); }

function renderVisitorList() {
  const q         = (document.getElementById('vis-search') || {}).value || '';
  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const list      = VISITOR_LIST.filter(v =>
    !q || (v.name || '').toLowerCase().includes(q.toLowerCase()) || (v.org || '').toLowerCase().includes(q.toLowerCase())
  );
  list.sort((a, b) => b.date > a.date ? 1 : -1);

  const el = document.getElementById('vis-today');  if (el) el.textContent = VISITOR_LIST.filter(v => v.date === today).length;
  const el2 = document.getElementById('vis-month'); if (el2) el2.textContent = VISITOR_LIST.filter(v => (v.date || '').slice(0, 7) === thisMonth).length;
  const el3 = document.getElementById('vis-total'); if (el3) el3.textContent = VISITOR_LIST.length;

  let html = list.length ? '' : '<div class="empty-msg">방문자 기록이 없어요</div>';
  list.forEach(v => {
    html += `<div class="log-card">
      <div class="log-top"><div class="log-name">👤 ${v.name}</div><span class="badge b-ok">${v.purpose}</span></div>
      <div style="font-size:12px;color:#3C3C43;margin-bottom:3px">${v.org || ''}</div>
      <div style="font-size:11px;color:#8E8E93">${v.date} ${v.time || ''} ${v.note ? '· ' + v.note : ''}</div>
      <div class="log-actions" style="margin-top:6px">
        <button class="btn-sm" onclick="editVisitor('${v.id}')">✏️ 수정</button>
        <button class="btn-danger" onclick="deleteVisitor('${v.id}')">삭제</button>
      </div>
    </div>`;
  });
  const el4 = document.getElementById('vis-list'); if (el4) el4.innerHTML = html;
}

function openVisitorModal(id) {
  document.getElementById('vis-modal-title').textContent = id ? '✏️ 방문자 수정' : '👥 방문자 추가';
  document.getElementById('vis-edit-id').value = id || '';
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toTimeString().slice(0, 5);
  if (id) {
    const v = VISITOR_LIST.find(x => x.id === id);
    if (v) {
      document.getElementById('vis-date').value    = v.date    || today;
      document.getElementById('vis-time').value    = v.time    || now;
      document.getElementById('vis-name').value    = v.name    || '';
      document.getElementById('vis-org').value     = v.org     || '';
      document.getElementById('vis-purpose').value = v.purpose || '기타';
      document.getElementById('vis-note').value    = v.note    || '';
    }
  } else {
    document.getElementById('vis-date').value    = today;
    document.getElementById('vis-time').value    = now;
    document.getElementById('vis-name').value    = '';
    document.getElementById('vis-org').value     = '';
    document.getElementById('vis-note').value    = '';
  }
  openOv('ov-visitor');
}

function saveVisitor() {
  const name   = document.getElementById('vis-name').value.trim();
  const date   = document.getElementById('vis-date').value;
  if (!name || !date) { alert('이름과 날짜는 필수입니다'); return; }
  const editId2 = document.getElementById('vis-edit-id').value;
  const entry = {
    id:      editId2 || ('vis_' + Date.now()),
    date, time:    document.getElementById('vis-time').value,
    name, org:     document.getElementById('vis-org').value.trim(),
    purpose: document.getElementById('vis-purpose').value,
    note:    document.getElementById('vis-note').value.trim(),
  };
  if (editId2) { const idx = VISITOR_LIST.findIndex(x => x.id === editId2); if (idx >= 0) VISITOR_LIST[idx] = entry; else VISITOR_LIST.push(entry); }
  else VISITOR_LIST.push(entry);
  saveVisitorStorage();
  if (apiUrl) apiCall({}, { action: 'append', sheet: 'visitor', data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '이름': entry.name, '소속': entry.org, '목적': entry.purpose, '메모': entry.note } }).catch(() => {});
  closeOv('ov-visitor'); renderVisitorList();
}

function editVisitor(id)   { openVisitorModal(id); }
function deleteVisitor(id) {
  if (!confirm('삭제하시겠어요?')) return;
  VISITOR_LIST = VISITOR_LIST.filter(x => x.id !== id);
  saveVisitorStorage(); renderVisitorList();
}

// ── 회의록 ───────────────────────────────────────────────────
function saveCouncilStorage() { localStorage.setItem('council_list', JSON.stringify(COUNCIL_LIST)); }

function renderCouncilList() {
  const q    = (document.getElementById('council-search') || {}).value || '';
  const list = COUNCIL_LIST.filter(c =>
    !q || (c.type || '').includes(q) || (c.attendees || '').includes(q) || (c.agenda || '').includes(q)
  );
  list.sort((a, b) => b.date > a.date ? 1 : -1);
  let html = list.length ? '' : '<div class="empty-msg">회의록이 없어요</div>';
  list.forEach(c => {
    html += `<div class="log-card">
      <div class="log-top"><div class="log-name">📋 ${c.type}</div><span class="badge b-ok">${c.date}</span></div>
      <div style="font-size:12px;font-weight:600;color:#3C3C43;margin-bottom:3px">안건: ${c.agenda || '—'}</div>
      <div style="font-size:11px;color:#8E8E93;margin-bottom:3px">참석자: ${c.attendees || '—'}</div>
      ${c.minutes ? `<div style="font-size:11px;color:#3C3C43;background:#F2F2F7;border-radius:8px;padding:6px;margin-bottom:4px">${c.minutes}</div>` : ''}
      ${c.next ? `<div style="font-size:11px;color:#FF9500">📅 다음 회의: ${c.next}</div>` : ''}
      <div class="log-actions" style="margin-top:6px">
        <button class="btn-sm" onclick="editCouncil('${c.id}')">✏️ 수정</button>
        <button class="btn-danger" onclick="deleteCouncil('${c.id}')">삭제</button>
      </div>
    </div>`;
  });
  const el = document.getElementById('council-list'); if (el) el.innerHTML = html;
}

function openCouncilModal(id) {
  document.getElementById('council-modal-title').textContent = id ? '✏️ 회의록 수정' : '📋 회의록 추가';
  document.getElementById('council-edit-id').value = id || '';
  const today = new Date().toISOString().slice(0, 10);
  if (id) {
    const c = COUNCIL_LIST.find(x => x.id === id);
    if (c) {
      document.getElementById('council-date').value      = c.date      || today;
      document.getElementById('council-time').value      = c.time      || '';
      document.getElementById('council-type').value      = c.type      || 'Participant Council Meeting';
      document.getElementById('council-attendees').value = c.attendees || '';
      document.getElementById('council-agenda').value    = c.agenda    || '';
      document.getElementById('council-minutes').value   = c.minutes   || '';
      document.getElementById('council-next').value      = c.next      || '';
    }
  } else {
    ['council-time','council-attendees','council-agenda','council-minutes'].forEach(id2 => {
      document.getElementById(id2).value = '';
    });
    document.getElementById('council-date').value = today;
    document.getElementById('council-next').value = '';
  }
  openOv('ov-council');
}

function saveCouncil() {
  const date = document.getElementById('council-date').value;
  if (!date) { alert('날짜는 필수입니다'); return; }
  const editId2 = document.getElementById('council-edit-id').value;
  const entry = {
    id:        editId2 || ('council_' + Date.now()),
    date, time:      document.getElementById('council-time').value,
    type:      document.getElementById('council-type').value,
    attendees: document.getElementById('council-attendees').value.trim(),
    agenda:    document.getElementById('council-agenda').value.trim(),
    minutes:   document.getElementById('council-minutes').value.trim(),
    next:      document.getElementById('council-next').value,
  };
  if (editId2) { const idx = COUNCIL_LIST.findIndex(x => x.id === editId2); if (idx >= 0) COUNCIL_LIST[idx] = entry; else COUNCIL_LIST.push(entry); }
  else COUNCIL_LIST.push(entry);
  saveCouncilStorage();
  if (apiUrl) apiCall({}, { action: 'append', sheet: 'council', data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '유형': entry.type, '참석자': entry.attendees, '안건': entry.agenda, '내용': entry.minutes, '다음회의': entry.next } }).catch(() => {});
  closeOv('ov-council'); renderCouncilList();
}

function editCouncil(id)   { openCouncilModal(id); }
function deleteCouncil(id) {
  if (!confirm('삭제하시겠어요?')) return;
  COUNCIL_LIST = COUNCIL_LIST.filter(x => x.id !== id);
  saveCouncilStorage(); renderCouncilList();
}
