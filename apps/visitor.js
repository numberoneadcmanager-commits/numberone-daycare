// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 방문자 & 회의록
// apps/visitor.js
// ══════════════════════════════════════════════════════════════

// ── 방문자 ───────────────────────────────────────────────────
function renderVisitorList() {
  const q         = (document.getElementById('vis-search') || {}).value || '';
  const today     = todayISO;
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
  const today = todayISO;
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

async function saveVisitor() {
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

  try {
    await SheetsAPI.post({
      action: editId2 ? 'update' : 'append',
      sheet: 'visitor',
      id: editId2 || null,
      data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '이름': entry.name, '소속': entry.org, '목적': entry.purpose, '메모': entry.note },
    });
  } catch (e) { console.log('Visitor Sheets sync:', e); }

  closeOv('ov-visitor'); renderVisitorList();
}

function editVisitor(id)   { openVisitorModal(id); }
async function deleteVisitor(id) {
  if (!confirm('삭제하시겠어요?')) return;
  VISITOR_LIST = VISITOR_LIST.filter(x => x.id !== id);
  try { await SheetsAPI.post({ action: 'delete', sheet: 'visitor', id }); } catch (e) {}
  renderVisitorList();
}

// ── 회의록 ───────────────────────────────────────────────────
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
      ${c.pdfLink ? `<div style="font-size:11px;color:#0F6E56;margin-top:3px">📎 서명지 PDF 첨부됨</div>` : ''}
      <div class="log-actions" style="margin-top:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="editCouncil('${c.id}')">✏️ 수정</button>
        <button class="btn-sm" onclick="printCouncilSignSheet('${c.id}')" style="background:#EDE9FE;color:#5856D6">🖨️ 서명지</button>
        ${c.pdfLink ? `<button class="btn-sm" onclick="window.open('${c.pdfLink}','_blank')" style="background:#E1F5EE;color:#0F6E56">📄 PDF보기</button>` : ''}
        <button class="btn-danger" onclick="deleteCouncil('${c.id}')">삭제</button>
      </div>
    </div>`;
  });
  const el = document.getElementById('council-list'); if (el) el.innerHTML = html;
}

function openCouncilModal(id) {
  document.getElementById('council-modal-title').textContent = id ? '✏️ 회의록 수정' : '📋 회의록 추가';
  document.getElementById('council-edit-id').value = id || '';
  const today = todayISO;
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
      document.getElementById('council-pdf-link').value  = c.pdfLink   || '';
      document.getElementById('council-pdf-status').textContent = c.pdfLink ? '✅ PDF 첨부됨' : '';
    }
  } else {
    ['council-time','council-attendees','council-agenda','council-minutes'].forEach(id2 => {
      document.getElementById(id2).value = '';
    });
    document.getElementById('council-date').value = today;
    document.getElementById('council-next').value = '';
    document.getElementById('council-pdf-link').value = '';
    document.getElementById('council-pdf-status').textContent = '';
  }
  openOv('ov-council');
}

async function saveCouncil() {
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
    pdfLink:   document.getElementById('council-pdf-link').value || '',
  };
  if (editId2) { const idx = COUNCIL_LIST.findIndex(x => x.id === editId2); if (idx >= 0) COUNCIL_LIST[idx] = entry; else COUNCIL_LIST.push(entry); }
  else COUNCIL_LIST.push(entry);

  try {
    await SheetsAPI.post({
      action: editId2 ? 'update' : 'append',
      sheet: 'council',
      id: editId2 || null,
      data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '유형': entry.type, '참석자': entry.attendees, '안건': entry.agenda, '내용': entry.minutes, '다음회의': entry.next, 'PDF링크': entry.pdfLink },
    });
  } catch (e) { console.log('Council Sheets sync:', e); }

  closeOv('ov-council'); renderCouncilList();
}

function editCouncil(id)   { openCouncilModal(id); }
async function deleteCouncil(id) {
  if (!confirm('삭제하시겠어요?')) return;
  COUNCIL_LIST = COUNCIL_LIST.filter(x => x.id !== id);
  try { await SheetsAPI.post({ action: 'delete', sheet: 'council', id }); } catch (e) {}
  renderCouncilList();
}

// ── Council 회의 참석 서명지 인쇄 ────────────────────────────
function printCouncilSignSheet(id){
  var c = id ? COUNCIL_LIST.find(function(x){return x.id===id;}) : null;
  var date = c ? c.date : (document.getElementById('council-date').value || todayISO);
  var time = c ? c.time : (document.getElementById('council-time').value || '');
  var type = c ? c.type : (document.getElementById('council-type').value || 'Participant Council Meeting');
  var agenda = c ? c.agenda : (document.getElementById('council-agenda').value || '');

  var rows = '';
  for (var i=0;i<20;i++){
    rows += '<tr><td style="border:1px solid #999;padding:10px;width:30px;text-align:center">'+(i+1)+'</td>'
      + '<td style="border:1px solid #999;padding:10px;width:200px"></td>'
      + '<td style="border:1px solid #999;padding:10px"></td></tr>';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>회의 참석 서명지</title>'
    + '<style>@page{size:letter;margin:0.6in}body{font-family:Arial,sans-serif}'
    + 'h1{font-size:20px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}'
    + 'th{background:#e0e0e0;border:1px solid #999;padding:10px;font-size:13px}</style></head><body>'
    + '<h1>NUMBER ONE ADULT DAYCARE</h1>'
    + '<div style="font-size:14px;margin-bottom:4px">📋 ' + type + ' — 참석 확인 서명지</div>'
    + '<div style="font-size:13px;color:#333">날짜: ' + date + ' &nbsp;&nbsp; 시간: ' + (time||'—') + '</div>'
    + (agenda ? '<div style="font-size:12px;color:#555;margin-top:4px">안건: ' + agenda + '</div>' : '')
    + '<table><thead><tr><th>#</th><th>이름 (인쇄체)</th><th>서명</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '<script>window.onload=function(){window.print();}<\/script></body></html>';

  var w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('팝업 차단을 해제해주세요'); return; }
  w.document.write(html); w.document.close();
}

// ── Council 서명지 PDF 업로드 ────────────────────────────────
async function uploadCouncilSignedPDF(input){
  var file = input.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) { alert('PDF 파일만 업로드 가능해요'); return; }
  var statusEl = document.getElementById('council-pdf-status');
  statusEl.textContent = '⏳ 업로드 중...';
  try {
    var base64 = await new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onload = function(e){ resolve(e.target.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    var date = document.getElementById('council-date').value || todayISO;
    var res = await SheetsAPI.post({
      action:'savePDF', memberId:'council', memberName:'Council',
      fileType:'Council_' + date, base64Data:base64,
      author:(_currentUser&&_currentUser.name)||'Staff'
    });
    if (res && res.ok && res.data && res.data.url) {
      document.getElementById('council-pdf-link').value = res.data.url;
      statusEl.textContent = '✅ PDF 업로드 완료!';
    } else {
      statusEl.textContent = '❌ 업로드 실패';
    }
  } catch(e){
    statusEl.textContent = '❌ 오류: ' + e.message;
  }
}
