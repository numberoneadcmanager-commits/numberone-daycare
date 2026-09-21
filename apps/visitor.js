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
  try {
    await SheetsAPI.post({
      action: editId2 ? 'update' : 'append',
      sheet: 'visitor',
      id: editId2 || null,
      data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '이름': entry.name, '소속': entry.org, '목적': entry.purpose, '메모': entry.note },
    });
  } catch(e) { alert('❌ 저장 실패: '+e.message); return; }

  if (editId2) { const idx = VISITOR_LIST.findIndex(x => x.id === editId2); if (idx >= 0) VISITOR_LIST[idx] = entry; else VISITOR_LIST.push(entry); }
  else VISITOR_LIST.push(entry);

  closeOv('ov-visitor'); renderVisitorList();
}

function editVisitor(id)   { openVisitorModal(id); }
async function deleteVisitor(id) {
  if (!confirm('삭제하시겠어요?')) return;
  try { await SheetsAPI.post({ action: 'delete', sheet: 'visitor', id }); } catch(e) { alert('❌ 삭제 실패: '+e.message); return; }
  VISITOR_LIST = VISITOR_LIST.filter(x => x.id !== id);
  renderVisitorList();
}

// ── 회의록 ───────────────────────────────────────────────────
function renderCouncilList(){
  var q=((document.getElementById('council-search')||{}).value||'').toLowerCase();
  var list=COUNCIL_LIST.filter(function(c){return !q||[c.type,c.attendees,c.agenda].join(' ').toLowerCase().includes(q);}).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
  var html=list.length?'':'<div class="empty-msg">회의록이 없어요</div>';
  function arg(v){return councilEscape(JSON.stringify(String(v||'')));}
  list.forEach(function(c){var id=arg(c.id),busy=_councilPdfBusy?' disabled':'';
    html+='<article class="council-record"><div class="council-record-title"><strong>'+councilEscape(c.type)+'</strong><span>'+councilEscape(c.date)+'</span></div><h4>안건</h4><p>'+councilEscape(c.agenda||'—')+'</p><h4>참석자</h4><p>'+councilEscape(c.attendees||'—')+'</p><h4>회의 내용 / 결정사항</h4><p>'+councilEscape(c.minutes||'—')+'</p>'+(c.next?'<p>다음 회의: '+councilEscape(c.next)+'</p>':'')+'<div class="council-actions">'
      +'<button onclick="editCouncil('+id+')">수정</button><button onclick="printCouncilMinutes('+id+')">🖨️ 회의록 인쇄</button><button onclick="printCouncilSignSheet('+id+')">서명지 인쇄</button>'
      +(c.minutesPdfLink?'<button onclick="councilOpenPDF('+arg(c.minutesPdfLink)+')">회의록 PDF 보기</button>':'<button'+busy+' onclick="councilExportPDF('+id+',false)">회의록 PDF 저장</button>')
      +(c.pdfLink?'<button onclick="councilOpenPDF('+arg(c.pdfLink)+')">첨부 서명지 보기</button>':'')
      +(c.combinedPdfLink?'<button class="council-primary" onclick="councilOpenPDF('+arg(c.combinedPdfLink)+')">서명 포함 합본 PDF 보기</button>':c.pdfLink?'<button class="council-primary"'+busy+' onclick="councilExportPDF('+id+',true)">회의록 + 서명지 PDF 저장</button>':'')
      +'<button class="council-danger" onclick="deleteCouncil('+id+')">삭제</button></div></article>';
  });var el=document.getElementById('council-list');if(el)el.innerHTML=html;
}

function openCouncilModal(id) {
  _councilAiSerial++;if(_councilPdfBusy||_councilSaveBusy){alert('현재 처리가 끝난 뒤 열어주세요.');return;}
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

var _councilSaveBusy=false;
async function saveCouncil() {
  if(_councilPdfBusy||_councilUploadBusy||_councilSaveBusy){alert('현재 처리가 끝난 뒤 저장해주세요.');return;}
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
  document.getElementById('council-edit-id').value=entry.id;
  _councilSaveBusy=true;
  try {
    await SheetsAPI.post({
      action: 'upsert',
      sheet: 'council',
      key: 'ID', value: entry.id,
      id: editId2 || null,
      data: { 'ID': entry.id, '날짜': entry.date, '시간': entry.time, '유형': entry.type, '참석자': entry.attendees, '안건': entry.agenda, '내용': entry.minutes, '다음회의': entry.next, 'PDF링크': entry.pdfLink, '회의록PDF링크':'', '합본PDF링크':'' },
    });
  } catch(e) { alert('❌ 저장 실패: '+e.message); return; }finally{_councilSaveBusy=false;}

  if (editId2) { const idx = COUNCIL_LIST.findIndex(x => x.id === editId2); if (idx >= 0) COUNCIL_LIST[idx] = entry; else COUNCIL_LIST.push(entry); }
  else COUNCIL_LIST.push(entry);

  _councilAiSerial++;closeOv('ov-council'); renderCouncilList();
}

function editCouncil(id)   { openCouncilModal(id); }
async function deleteCouncil(id) {
  if(_councilPdfBusy){alert('PDF 처리가 끝난 뒤 삭제해주세요.');return;}
  if (!confirm('삭제하시겠어요?')) return;
  try { await SheetsAPI.post({ action: 'delete', sheet: 'council', id }); } catch(e) { alert('❌ 삭제 실패: '+e.message); return; }
  COUNCIL_LIST = COUNCIL_LIST.filter(x => x.id !== id);
  renderCouncilList();
}

// ── Council 회의 참석 서명지 인쇄 ────────────────────────────
function printCouncilSignSheet(id){
  var c = id ? COUNCIL_LIST.find(function(x){return x.id===id;}) : null;
  var date = c ? c.date : (document.getElementById('council-date').value || todayISO);
  var time = c ? c.time : (document.getElementById('council-time').value || '');
  var type = c ? c.type : (document.getElementById('council-type').value || 'Participant Council Meeting');
  var agenda = c ? c.agenda : (document.getElementById('council-agenda').value || '');

  date=councilEscape(date);time=councilEscape(time);type=councilEscape(type);agenda=councilEscape(agenda);
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
var _councilUploadBusy=false;
async function uploadCouncilSignedPDF(input){
  if(_councilUploadBusy||_councilPdfBusy)return;
  var file = input.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) { alert('PDF 파일만 업로드 가능해요'); return; }
  var statusEl = document.getElementById('council-pdf-status');
  if(file.size>20*1024*1024){alert('20MB 이하 PDF를 첨부해주세요.');return;}
  var editId=document.getElementById('council-edit-id').value,serial=_councilAiSerial;
  _councilUploadBusy=true;statusEl.textContent = '⏳ 업로드 중...';
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
      fileType:'Council_Signatures_' + (editId||'draft') + '_' + crypto.randomUUID(), base64Data:base64,
      author:(_currentUser&&_currentUser.name)||'Staff'
    });
    if(serial!==_councilAiSerial||editId!==document.getElementById('council-edit-id').value)return;
    if (res && res.ok && res.data && res.data.success!==false && res.data.url) {
      document.getElementById('council-pdf-link').value = res.data.url;
      statusEl.textContent = '✅ PDF 업로드 완료!';
    } else {
      statusEl.textContent = '❌ 업로드 실패';
    }
  } catch(e){
    statusEl.textContent = '❌ 오류: ' + e.message;
  }finally{_councilUploadBusy=false;input.value='';}
}
