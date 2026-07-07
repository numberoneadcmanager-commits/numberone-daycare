// ══════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — Training Records
// apps/training_ops.js
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// TRAINING RECORDS
// ══════════════════════════════════════════════════════════
var TR_SESSIONS = JSON.parse(localStorage.getItem('tr_sessions')||'[]');
var _trView = 'session';

var TR_TOPICS = [
  {id:'personal_care',  label:'Personal Care Skills (RN 필수)', rn:true,  annual:false},
  {id:'body_mechanics', label:'Body Mechanics / Elderly Safety', rn:true,  annual:false},
  {id:'toileting',      label:'Toileting / Incontinence Care',   rn:true,  annual:false},
  {id:'feeding',        label:'Feeding / Grooming / Dressing',   rn:true,  annual:false},
  {id:'transfers',      label:'Transfers / Mobility',            rn:true,  annual:false},
  {id:'med_assist',     label:'Medication Self-Administration Assist', rn:true, annual:false},
  {id:'adaptive',       label:'Adaptive/Assistive Equipment',    rn:true,  annual:false},
  {id:'cpr',            label:'CPR / AED / Choking',             rn:false, annual:false, expMonths:24},
  {id:'fire',           label:'Fire Prevention / Emergency Safety', rn:false, annual:true},
  {id:'participant_rights', label:'Participant Rights (HCBS)',   rn:false, annual:true},
  {id:'pcp',            label:'Person-Centered Planning',        rn:false, annual:true},
  {id:'hcbs',           label:'HCBS Final Rule',                 rn:false, annual:true},
  {id:'abuse',          label:'Abuse / Neglect Prevention',      rn:false, annual:true},
  {id:'hipaa_training', label:'Confidentiality / HIPAA',         rn:false, annual:true},
  {id:'emergency_prep', label:'Emergency Preparedness',          rn:false, annual:true},
  {id:'infection',      label:'Infection Control',               rn:false, annual:true},
  {id:'supervision',    label:'Supervision & Monitoring',        rn:false, annual:false},
  {id:'socialization',  label:'Socialization / Aging Process',   rn:false, annual:false},
  {id:'mental_health',  label:'Mental Health & Mental Illness',  rn:false, annual:true},
  {id:'family',         label:'Family Relationship',             rn:false, annual:false},
  {id:'safety',         label:'Safety / Accident Prevention',    rn:false, annual:false},
  {id:'ppd',            label:'PPD Test (TB) — Health Record',   rn:false, annual:false, expMonths:24},
];

function saveTrStorage(){ localStorage.setItem('tr_sessions', JSON.stringify(TR_SESSIONS)); }

function loadTrFromSheets(){
  apiGet({action:'read',sheet:'training_log'}).then(function(res){
    if(res&&res.ok&&res.data&&res.data.length){
      // 세션별로 그룹핑
      var sessions = {};
      res.data.forEach(function(r){
        var sid = String(r['세션ID']||'');
        if(!sid)return;
        if(!sessions[sid]){
          sessions[sid] = {
            id:sid, date:String(r['날짜']||''), hours:String(r['시간']||''),
            topics:JSON.parse(r['토픽']||'[]'), rnName:String(r['RN이름']||''),
            rnLic:String(r['RN_LicenseID']||''), supervisor:String(r['수퍼바이저']||''),
            staff:[]
          };
        }
        if(r['스태프ID']) sessions[sid].staff.push({
          id:String(r['스태프ID']),name:String(r['스태프이름']||'')
        });
      });
      TR_SESSIONS = Object.values(sessions);
      saveTrStorage(); renderTrSessionList();
    }
  }).catch(function(){});
}

function setTrView(v,el){
  _trView=v;
  document.querySelectorAll('#panel-training .fpill').forEach(function(p){p.classList.remove('active');});
  el.classList.add('active');
  document.getElementById('tr-session-view').style.display = v==='session'?'block':'none';
  document.getElementById('tr-staff-view').style.display   = v==='staff'?'block':'none';
  if(v==='staff') loadTrStaffDropdown();
}

function renderTrSessionList(){
  var sorted = TR_SESSIONS.slice().sort(function(a,b){return b.date>a.date?1:-1;});
  var e = document.getElementById('tr-sessions'); if(e)e.textContent=TR_SESSIONS.length;
  document.getElementById('tr-expired').textContent = '—';
  document.getElementById('tr-soon').textContent = '—';

  var html = '';
  if(!sorted.length) html='<div class="empty-msg">트레이닝 기록이 없어요</div>';
  sorted.forEach(function(s){
    var topicLabels = (s.topics||[]).map(function(tid){
      var t = TR_TOPICS.find(function(x){return x.id===tid;});
      return t?t.label:tid;
    }).join(', ');
    html += '<div class="log-card">'
      +'<div class="log-top"><div class="log-name">📚 '+s.date+'</div><span class="badge b-blue">'+s.hours+'hrs</span></div>'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:3px">'+topicLabels.slice(0,80)+(topicLabels.length>80?'...':'')+'</div>'
      +(s.rnName?'<div style="font-size:11px;color:#8E8E93">RN: '+s.rnName+' ('+s.rnLic+')</div>':'')
      +'<div style="font-size:11px;color:#8E8E93">참가: '+(s.staff||[]).map(function(st){return st.name;}).join(', ')+'</div>'
      +'<div class="log-actions" style="margin-top:6px">'
      +'<button class="btn-sm" onclick="printTrSession(\''+s.id+'\')">🖨️ PDF 출력</button>'
      +'<button class="btn-danger" onclick="deleteTrSession(\''+s.id+'\')">삭제</button>'
      +'</div></div>';
  });
  var el2 = document.getElementById('tr-session-list'); if(el2)el2.innerHTML=html;
}

function openTrModal(){
  document.getElementById('tr-date').value = new Date().toLocaleDateString('sv-SE');
  document.getElementById('tr-hours').value = '';
  document.getElementById('tr-rn-name').value = '';
  document.getElementById('tr-rn-lic').value = '';
  document.getElementById('tr-supervisor').value = '';

  // 토픽 체크박스
  var topicHtml = '';
  TR_TOPICS.forEach(function(t){
    topicHtml += '<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer">'
      +'<input type="checkbox" id="trtopic-'+t.id+'" value="'+t.id+'">'
      +(t.rn?'<span style="color:#FF9500;font-size:10px">[RN]</span>':'')
      +t.label
      +'</label>';
  });
  document.getElementById('tr-topics-list').innerHTML = topicHtml;

  // 스태프 체크박스
  var staff = JSON.parse(localStorage.getItem('staff_data')||'[]');
  var staffHtml = '';
  if(!staff.length){ staffHtml='<div style="color:#8E8E93">스태프 데이터 없음 — 케어관리 앱에서 먼저 등록해주세요</div>'; }
  staff.forEach(function(s){
    staffHtml += '<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer">'
      +'<input type="checkbox" id="trstaff-'+s.id+'" value="'+s.id+'" data-name="'+(s.nameKr||s.name)+'">'
      +(s.nameKr||s.name)+' ('+s.role+')'
      +'</label>';
  });
  document.getElementById('tr-staff-list').innerHTML = staffHtml;
  openOv('ov-tr');
}

function saveTrSession(){
  var date = document.getElementById('tr-date').value;
  var hours = document.getElementById('tr-hours').value;
  if(!date||!hours){ alert('날짜와 시간은 필수입니다'); return; }

  var topics = [];
  TR_TOPICS.forEach(function(t){
    var cb = document.getElementById('trtopic-'+t.id);
    if(cb&&cb.checked) topics.push(t.id);
  });
  if(!topics.length){ alert('토픽을 하나 이상 선택해주세요'); return; }

  // RN 필수 토픽 체크
  var needsRN = topics.some(function(tid){
    var t = TR_TOPICS.find(function(x){return x.id===tid;});
    return t&&t.rn;
  });
  var rnName = document.getElementById('tr-rn-name').value.trim();
  if(needsRN && !rnName){ alert('Personal Care 관련 토픽이 선택되었습니다.\nRN 이름을 입력해주세요.'); return; }

  var selectedStaff = [];
  var staff = JSON.parse(localStorage.getItem('staff_data')||'[]');
  staff.forEach(function(s){
    var cb = document.getElementById('trstaff-'+s.id);
    if(cb&&cb.checked) selectedStaff.push({id:s.id, name:s.nameKr||s.name});
  });
  if(!selectedStaff.length){ alert('참가 스태프를 선택해주세요'); return; }

  var sid = 'tr_'+Date.now();
  var session = {
    id:sid, date:date, hours:hours, topics:topics,
    rnName:rnName, rnLic:document.getElementById('tr-rn-lic').value.trim(),
    supervisor:document.getElementById('tr-supervisor').value.trim(),
    staff:selectedStaff
  };
  TR_SESSIONS.push(session);
  saveTrStorage();

  // Sheets에 저장 (스태프별 행)
  selectedStaff.forEach(function(st){
    apiCall({action:'append',sheet:'training_log',data:{
      '세션ID':sid, '날짜':date, '시간':hours,
      '토픽':JSON.stringify(topics),
      'RN이름':rnName, 'RN_LicenseID':document.getElementById('tr-rn-lic').value.trim(),
      '수퍼바이저':document.getElementById('tr-supervisor').value.trim(),
      '스태프ID':st.id, '스태프이름':st.name
    }}).catch(function(){});
  });

  closeOv('ov-tr');
  renderTrSessionList();
  // 자동으로 PDF 출력
  setTimeout(function(){ printTrSession(sid); }, 300);
}

function printTrSession(sid){
  var s = TR_SESSIONS.find(function(x){return x.id===sid;});
  if(!s){ alert('세션을 찾을 수 없습니다'); return; }

  var topicLabels = (s.topics||[]).map(function(tid){
    var t = TR_TOPICS.find(function(x){return x.id===tid;});
    return t?t.label:tid;
  });

  var staffRows = (s.staff||[]).map(function(st){
    return '<tr><td>'+st.name+'</td><td>'+s.date+'</td><td>'+s.hours+'</td>'
      +'<td style="height:40px"></td>'  // Staff Signature
      +'<td style="height:40px"></td>'  // Nurse Signature
      +'<td style="height:40px"></td>'  // Supervisor Signature
      +'</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Training Log - '+s.date+'</title>'
    +'<style>body{font-family:Arial,sans-serif;font-size:10px;margin:20px}'
    +'h1{font-size:14px;text-align:center}h2{font-size:11px}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:10px}'
    +'td,th{border:1px solid #ccc;padding:4px 6px;vertical-align:middle}'
    +'th{background:#f5f5f5;font-weight:700}'
    +'.topic-box{border:1px solid #ccc;padding:8px;margin-bottom:10px;background:#fafafa}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'
    +'<h1>Number One Adult Daycare — Competency Training Log</h1>'
    +'<p style="text-align:center;font-size:9px">161-22 Northern Blvd 1FL, Flushing, NY 11358 · 718-799-0248</p>'
    +'<br>'
    +'<table><tr><th>Date</th><td>'+s.date+'</td><th>Total Hours</th><td>'+s.hours+'</td></tr>'
    +'<tr><th>Directed By (RN)</th><td>'+s.rnName+'</td><th>License ID</th><td>'+s.rnLic+'</td></tr>'
    +'<tr><th>Supervisor</th><td colspan="3">'+s.supervisor+'</td></tr></table>'
    +'<div class="topic-box"><b>Training Topics:</b><br>'
    +topicLabels.map(function(l,i){return (i+1)+'. '+l;}).join('<br>')
    +'</div>'
    +'<table><tr>'
    +'<th style="width:20%">Name</th>'
    +'<th style="width:12%">Date</th>'
    +'<th style="width:8%">Hours</th>'
    +'<th style="width:20%">Staff Signature</th>'
    +'<th style="width:20%">Nurse Signature</th>'
    +'<th style="width:20%">Supervisor Signature</th>'
    +'</tr>'+staffRows+'</table>'
    +'<br><p style="font-size:9px">* 서명 후 스캔하여 Drive에 업로드하세요</p>'
    +'<button onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>'
    +'</body></html>';

  var w = window.open('','_blank');
  if(!w){ alert('팝업을 허용해주세요'); return; }
  w.document.write(html); w.document.close();
  setTimeout(function(){ w.print(); }, 800);
}

function deleteTrSession(sid){
  if(!confirm('이 트레이닝 세션을 삭제할까요?'))return;
  TR_SESSIONS = TR_SESSIONS.filter(function(s){return s.id!==sid;});
  saveTrStorage();
  renderTrSessionList();
}

function loadTrStaffDropdown(){
  var staff = JSON.parse(localStorage.getItem('staff_data')||'[]');
  var sel = document.getElementById('tr-staff-select');
  if(!sel)return;
  sel.innerHTML = '<option value="">— 스태프 선택 —</option>';
  staff.forEach(function(s){
    sel.innerHTML += '<option value="'+s.id+'">'+(s.nameKr||s.name)+'</option>';
  });
}

function renderTrStaffView(){
  var sid = document.getElementById('tr-staff-select').value;
  var el = document.getElementById('tr-staff-detail');
  if(!sid||!el){ if(el)el.innerHTML=''; return; }

  var staff = JSON.parse(localStorage.getItem('staff_data')||'[]');
  var s = staff.find(function(x){return x.id===sid;});
  var sName = s?(s.nameKr||s.name):sid;

  // 이 스태프가 참가한 세션들
  var mySessions = TR_SESSIONS.filter(function(sess){
    return (sess.staff||[]).some(function(st){return st.id===sid;});
  }).sort(function(a,b){return b.date>a.date?1:-1;});

  // 완료된 토픽 집계
  var completedTopics = {};
  mySessions.forEach(function(sess){
    (sess.topics||[]).forEach(function(tid){
      if(!completedTopics[tid]||completedTopics[tid]<sess.date){
        completedTopics[tid] = sess.date;
      }
    });
  });

  var today = new Date().toLocaleDateString('sv-SE');
  var html = '<div class="card"><div style="font-size:13px;font-weight:700;margin-bottom:10px">👤 '+sName+' 트레이닝 현황</div>';

  // 토픽별 이수 현황
  html += '<div style="font-size:11px;font-weight:700;color:#8E8E93;margin-bottom:6px">이수 현황</div>';
  TR_TOPICS.forEach(function(t){
    var done = completedTopics[t.id];
    var status, badge;
    if(done){
      if(t.expMonths){
        var expDate = new Date(done);
        expDate.setMonth(expDate.getMonth()+t.expMonths);
        var expStr = expDate.toISOString().slice(0,10);
        var diff = Math.floor((expDate-new Date())/86400000);
        if(diff<0){ badge='<span class="badge b-red">❌ 만료</span>'; }
        else if(diff<=90){ badge='<span class="badge b-warn">⚠️ '+'만료: '+expStr+'</span>'; }
        else { badge='<span class="badge b-ok">✅ '+done+'</span>'; }
      } else {
        badge='<span class="badge b-ok">✅ '+done+'</span>';
      }
    } else {
      badge = t.annual
        ? '<span class="badge b-red">❌ 미이수</span>'
        : '<span class="badge" style="background:#F2F2F7;color:#8E8E93">미이수</span>';
    }
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:.5px solid #F2F2F7">'
      +'<div style="font-size:11px">'+(t.rn?'<span style="color:#FF9500">[RN] </span>':'')+t.label+'</div>'
      +badge+'</div>';
  });
  html += '</div>';

  // 세션 이력
  html += '<div class="card"><div style="font-size:12px;font-weight:700;margin-bottom:8px">세션 이력 ('+mySessions.length+'회)</div>';
  if(!mySessions.length){ html+='<div class="empty-msg">없음</div>'; }
  mySessions.forEach(function(sess){
    var topicCount = (sess.topics||[]).length;
    html += '<div style="padding:6px 0;border-bottom:.5px solid #F2F2F7;font-size:11px">'
      +'<b>'+sess.date+'</b> · '+sess.hours+'hrs · '+topicCount+'개 토픽'
      +(sess.rnName?' · RN: '+sess.rnName:'')+'</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── 문서보관함 파일 업로드 ──────────────────────────────────
function saveDocWithUpload(){
  var name = document.getElementById('doc-name').value.trim();
  if(!name){ alert('문서명은 필수입니다'); return; }
  var editId = document.getElementById('doc-edit-id').value;
  var fileInput = document.getElementById('doc-file');
  var file = fileInput&&fileInput.files&&fileInput.files[0];
  var existingLink = document.getElementById('doc-link').value.trim();

  function finalize(link){
    var entry = {
      id:editId||('doc_'+Date.now()), name:name,
      cat:document.getElementById('doc-cat').value,
      issued:document.getElementById('doc-issued').value,
      expiry:document.getElementById('doc-expiry').value,
      link:link||'', note:document.getElementById('doc-note').value.trim()
    };
    if(editId){ var idx=DOCS_LIST.findIndex(function(x){return x.id===editId;});if(idx>=0)DOCS_LIST[idx]=entry;else DOCS_LIST.push(entry); }
    else DOCS_LIST.push(entry);
    saveDocsStorage();
    apiCall({action:'upsert',sheet:'docs',key:'ID',value:entry.id,data:{
      'ID':entry.id,'이름':entry.name,'카테고리':entry.cat,'발급일':entry.issued,
      '만료일':entry.expiry,'Drive링크':entry.link,'메모':entry.note
    }}).catch(function(){});
    closeOv('ov-doc'); renderDocsList();
  }

  if(file){
    var statusEl = document.getElementById('doc-upload-status');
    if(statusEl) statusEl.textContent = '📤 업로드 중...';
    var reader = new FileReader();
    reader.onload = function(ev){
      var b64 = ev.target.result.split(',')[1];
      apiCall({
        action:'savePDF', memberId:'CENTER', memberName:'센터문서',
        fileType:name.replace(/\s+/g,'_'), base64Data:b64,
        author:_currentUser?(_currentUser.name||''):''
      }).then(function(res){
        if(res&&res.ok&&res.data&&res.data.success){
          if(statusEl) statusEl.textContent = '✅ 업로드 완료';
          finalize(res.data.url);
        } else {
          if(statusEl) statusEl.textContent = '❌ 업로드 실패';
          finalize(existingLink);
        }
      }).catch(function(){
        if(statusEl) statusEl.textContent = '❌ 네트워크 오류';
        finalize(existingLink);
      });
    };
    reader.readAsDataURL(file);
  } else {
    finalize(existingLink);
  }
}

// ── 초기화 ────────────────────────────────────────────────
function initData(){
  renderAudit();

  // ── 앱 시작 시 Sheets에서 데이터 로드 (localStorage는 오프라인 fallback) ──
  loadGRfromSheets();
  loadFDfromSheets();
  loadTempfromSheets();
  loadDocsfromSheets();
  loadActfromSheets();

  // URL 파라미터 처리 (케어 관리 앱에서 넘어온 경우)
  var params = new URLSearchParams(window.location.search);
  var tab = params.get('tab');
  var formType = params.get('type'); // 'Nutrition' / 'Assessment' / null(=PCSP)
  var mid = params.get('mid') || localStorage.getItem('pcsp_prefill_mid');
  if(tab === 'pcsp' || tab === 'forms'){
    localStorage.removeItem('pcsp_prefill_mid');
    // Forms 탭으로 이동
    var formsTabEl = document.querySelector('.tab[onclick*="forms"]');
    goTab('forms', formsTabEl);
    if(mid){
      setTimeout(function(){
        if(typeof loadFormsMemberDropdown === 'function') loadFormsMemberDropdown();
        setTimeout(function(){
          var member = (_formsMemberCache||[]).find(function(m){return String(m['ID'])===String(mid);});
          var mName = member ? (member['한글이름']||'') : '';

          if (formType === 'Nutrition' && typeof openNutritionForMember === 'function') {
            openNutritionForMember(mid, mName);
          } else if (formType === 'Assessment' && typeof openAssessmentForMember === 'function') {
            openAssessmentForMember(mid, mName);
          } else if(typeof prefillPCSPFromMember === 'function'){
            prefillPCSPFromMember(mid);
          } else if(typeof openPCSPForMember === 'function'){
            openPCSPForMember(mid, '');
          }
        }, 800);
      }, 300);
    }
  }
}

function prefillPCSPFromMember(mid){
  // 1) 멤버 정보 + 2) 해당 멤버의 저장된 PCSP 목록을 함께 조회
  Promise.all([
    apiGet({action:'read',sheet:'멤버'}),
    apiGet({action:'readByMember',sheet:'PCSP',memberId:mid})
  ]).then(function(results){
    var memberRes = results[0];
    var pcspRes   = results[1];
    var member = null;
    if (memberRes.ok && memberRes.data) {
      member = memberRes.data.find(function(r){ return String(r['ID']) === String(mid); });
    }
    var pcspRows = (pcspRes.ok && pcspRes.data) ? pcspRes.data : [];

    if (!pcspRows.length) {
      // 저장된 PCSP 없음 → 새로 작성
      if (member) selectPCSPMember(member);
      else openPCSPForm();
      return;
    }

    // 작성일 최신순 정렬
    pcspRows.sort(function(a,b){
      return String(b['작성일']||'').localeCompare(String(a['작성일']||''));
    });

    if (pcspRows.length === 1) {
      // PCSP 1개 → 바로 열기
      loadPCSPFromSheets().then(function(){
        openPCSPForm(pcspRows[0]['ID']);
      });
    } else {
      // 여러 개 → 선택 팝업
      showPCSPSelectPopup(pcspRows, member, mid);
    }
  }).catch(function(){ openPCSPForm(); });
}

// 멤버에 저장된 PCSP가 여러 개일 때 선택 팝업
function showPCSPSelectPopup(pcspRows, member, mid){
  var mName = member ? (member['한글이름']||'') : '';
  var html = '<div style="padding:4px 0">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px">' + mName + ' — 저장된 PCSP ' + pcspRows.length + '건</div>';
  pcspRows.forEach(function(p){
    var date = String(p['작성일']||'').slice(0,10);
    var exp  = String(p['갱신예정일']||'').slice(0,10);
    var expired = exp && exp < new Date().toLocaleDateString('sv-SE');
    html += '<div onclick="closeOv(\'ov-doc-viewer\');loadPCSPFromSheets().then(function(){openPCSPForm(\''+p['ID']+'\');})" '
      + 'style="background:#F2F2F7;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer">'
      + '<div style="font-size:13px;font-weight:600">작성일: ' + date + '</div>'
      + '<div style="font-size:12px;color:' + (expired ? '#FF3B30' : '#34C759') + ';margin-top:3px">갱신예정일: ' + (exp || '—') + (expired ? ' (만료)' : '') + '</div>'
      + '<div style="font-size:11px;color:#8E8E93;margin-top:3px">작성자: ' + (p['작성자']||'—') + '</div>'
      + '</div>';
  });
  html += '<button onclick="closeOv(\'ov-doc-viewer\');' + (member ? 'selectPCSPMember(' + JSON.stringify(member).replace(/"/g,'&quot;') + ')' : 'openPCSPForm()') + '" '
    + 'style="width:100%;padding:11px;border-radius:10px;border:1.5px solid #D85A30;background:#FFF3EE;color:#D85A30;font-weight:700;font-size:13px;cursor:pointer;margin-top:6px">➕ 새 PCSP 작성</button>';
  html += '</div>';

  var titleEl = document.getElementById('doc-viewer-title');
  var bodyEl  = document.getElementById('doc-viewer-body');
  if (titleEl) titleEl.textContent = 'PCSP 선택';
  if (bodyEl)  bodyEl.innerHTML = html;
  openOv('ov-doc-viewer');
}
