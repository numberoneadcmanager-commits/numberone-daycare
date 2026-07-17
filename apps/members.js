// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 멤버 관리
// apps/members.js
// ══════════════════════════════════════════════════════════════

// ── 멤버 목록 필터/렌더 ──────────────────────────────────────
// 멤버 문서 목록 캐시
var _docCache = {};

async function toggleMemberDocs(mid, btn) {
  var wrap = document.getElementById('docs-' + mid);
  if (!wrap) return;
  if (wrap.style.display !== 'none') {
    wrap.style.display = 'none';
    btn.textContent = '📄 관련 문서 보기';
    return;
  }
  btn.textContent = '⏳ 로딩 중...';
  btn.disabled = true;
  wrap.style.display = 'block';
  wrap.innerHTML = '<div style="font-size:12px;color:#8E8E93;padding:8px 0">불러오는 중...</div>';

  try {
    var [pcspRes, logRes, incRes, caseRes, authRes] = await Promise.all([
      SheetsAPI.readByMember('PCSP', mid),
      SheetsAPI.readByMember('JSONLog', mid),
      SheetsAPI.readByMember('incident', mid),
      SheetsAPI.readByMember('caselog', mid),
      SheetsAPI.readByMember('auth', mid),
    ]);

    // 캐시 저장
    _docCache[mid] = { inc: incRes.data||[], cases: caseRes.data||[], auth: authRes.data||[] };

    var html = '<div style="border:1.5px solid #E5E5EA;border-radius:10px;overflow:hidden">';

    // PCSP
    var pcspList = (pcspRes.ok && pcspRes.data) ? pcspRes.data : [];
    var pcsp = pcspList.length ? pcspList[pcspList.length-1] : null;
    var pcspExp  = pcsp ? String(pcsp['갱신예정일']||'').slice(0,10) : '';
    var pcspDate = pcsp ? String(pcsp['작성일']||'').slice(0,10) : '';
    var expired  = pcspExp && pcspExp < new Date().toLocaleDateString('sv-SE');
    var pcspStatus = pcsp ? String(pcsp['상태']||'') : '';
    var pcspBadge  = pcspStatus === '서명대기' ? ' &nbsp;<span style="background:#FFF3E0;color:#B35900;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700">📝 서명대기</span>' : '';
    var pcspVal  = pcsp ? (pcspDate + (pcspExp ? ' · 만료: <b style="color:'+(expired?'#FF3B30':'#34C759')+'">'+pcspExp+'</b>' : '') + pcspBadge) : null;
    html += docRow('📋','PCSP', pcspVal, pcsp ? "openPCSPForm('"+mid+"')" : '');

    // Drive JSON 문서
    var logs = (logRes.ok && logRes.data) ? logRes.data : [];
    function lastLog(type) {
      var found = logs.filter(function(l){ return String(l['파일종류']||'')===type; });
      return found.length ? String(found[found.length-1]['저장일시']||'').slice(0,10) : null;
    }
    html += docRow('🥗','Nutrition Screening', lastLog('Nutrition'),  lastLog('Nutrition')  ? "viewDriveDoc('"+mid+"','Nutrition')"  : '', '_pendingNutrition_'+mid);
    html += docRow('📋','Assessment',           lastLog('Assessment'), lastLog('Assessment') ? "viewDriveDoc('"+mid+"','Assessment')" : '', '_pendingAssessment_'+mid);
    html += docRow('📄','Member Rights',         lastLog('MemberRights'), lastLog('MemberRights') ? "viewDriveDoc('"+mid+"','MemberRights')" : '');

    // 서명 여부 비동기 체크 (배지 나중에 채움)
    if (lastLog('Nutrition'))  _checkSignedBadge(mid, 'Nutrition');
    if (lastLog('Assessment')) _checkSignedBadge(mid, 'Assessment');

    // Incident / Case / Auth
    var incData   = incRes.ok  ? (incRes.data ||[]) : [];
    var caseData  = caseRes.ok ? (caseRes.data||[]) : [];
    var authData  = authRes.ok ? (authRes.data||[]) : [];
    var authActive = authData.filter(function(a){
      return !String(a['종료일']||'') || String(a['종료일']) >= new Date().toLocaleDateString('sv-SE');
    });
    html += docRow('🚨','Incident Log', incData.length  ? incData.length+'건'  : null, incData.length  ? "viewLogList('"+mid+"','incident')"  : '');
    html += docRow('📁','Case Log',     caseData.length ? caseData.length+'건' : null, caseData.length ? "viewLogList('"+mid+"','caselog')" : '');
    html += docRow('🔑','Authorization', authActive.length ? authActive.length+'건 활성' : (authData.length ? authData.length+'건(만료)' : null),
      authData.length ? "viewLogList('"+mid+"','auth')" : '');

    html += '</div>';
    wrap.innerHTML = html;
  } catch(e) {
    wrap.innerHTML = '<div style="font-size:12px;color:#FF3B30;padding:8px 0">❌ 오류: '+e.message+'</div>';
  }
  btn.textContent = '📄 문서 접기';
  btn.disabled = false;
}

function docRow(icon, label, value, onclick, badgeId) {
  var hasData = value !== null && value !== undefined && value !== '';
  var click = onclick ? ' onclick="'+onclick+'" style="cursor:pointer"' : '';
  var badgeSpan = badgeId ? '<span id="'+badgeId+'"></span>' : '';
  return '<div class="doc-row"'+click+'>'
    + '<span style="font-size:12px;color:#3C3C43">'+icon+' '+label+'</span>'
    + (hasData
      ? '<span style="font-size:11px;color:#34C759;font-weight:600">'+value+(onclick?' →':'')+badgeSpan+'</span>'
      : '<span style="font-size:11px;color:#C7C7CC">없음</span>')
    + '</div>';
}

// Nutrition/Assessment 서명 여부 비동기 체크 → 배지 채우기
async function _checkSignedBadge(mid, fileType) {
  try {
    var m = MEMBERS.find(function(x){return x.id===mid;});
    var mName = m ? m.kr : mid;
    var res = await SheetsAPI.loadJSON(mid, mName, fileType);
    if (!res.ok || !res.data || !res.data.found) return;
    var d = res.data.data || {};
    var el = document.getElementById('_pending' + fileType + '_' + mid);
    if (!el) return;
    if (d.signed === false) {
      el.innerHTML = ' &nbsp;<span style="background:#FFF3E0;color:#B35900;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700">📝 서명대기</span>';
    }
  } catch(e) { /* 무시 */ }
}

// Drive JSON 문서 팝업 뷰어
async function viewDriveDoc(mid, fileType) {
  var m = MEMBERS.find(function(x){return x.id===mid;});
  var mName = m ? m.kr : mid;
  document.getElementById('doc-viewer-title').textContent = mName+' — '+fileType;
  document.getElementById('doc-viewer-body').innerHTML = '<div style="padding:16px;color:#8E8E93">불러오는 중...</div>';
  openOv('ov-doc-viewer');
  try {
    var res = await SheetsAPI.loadJSON(mid, mName, fileType);
    if (!res.ok || !res.data || !res.data.found) {
      document.getElementById('doc-viewer-body').innerHTML = '<div style="padding:16px;color:#FF3B30">저장된 데이터 없음</div>';
      return;
    }
    var d = res.data.data;
    var html = '<div style="padding:12px">';
    // Nutrition 전용 뷰
    if (fileType==='Nutrition') {
      html += nsView(d);
    } else if (fileType==='Assessment') {
      html += asmtView(d);
    } else {
      // 기타: JSON 키-값 표시
      Object.keys(d).forEach(function(k){
        if(k==='memberSig'||k==='staffSig'||k==='mid') return;
        var v = d[k];
        if(typeof v==='object') v = JSON.stringify(v);
        html += '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:.5px solid #F2F2F7">'
          +'<span style="font-size:11px;color:#8E8E93;min-width:100px">'+k+'</span>'
          +'<span style="font-size:12px;color:#1C1C1E;flex:1">'+String(v||'—')+'</span></div>';
      });
      // 서명
      if(d.memberSig) html += '<div style="margin-top:8px"><div style="font-size:11px;color:#8E8E93;margin-bottom:4px">회원 서명</div><img src="'+d.memberSig+'" style="height:50px;border:1px solid #E5E5EA;border-radius:6px"></div>';
      if(d.staffSig)  html += '<div style="margin-top:8px"><div style="font-size:11px;color:#8E8E93;margin-bottom:4px">스태프 서명</div><img src="'+d.staffSig+'" style="height:50px;border:1px solid #E5E5EA;border-radius:6px"></div>';
    }
    html += '</div>';
    document.getElementById('doc-viewer-body').innerHTML = html;
  } catch(e) {
    document.getElementById('doc-viewer-body').innerHTML = '<div style="padding:16px;color:#FF3B30">오류: '+e.message+'</div>';
  }
}

// Nutrition 팝업 뷰
function _authorFooter(d) {
  if (!d.createdBy && !d.lastEditedBy) return '';
  var html = '<div style="margin-top:12px;padding-top:8px;border-top:1px solid #F2F2F7;font-size:10px;color:#8E8E93">';
  if (d.createdBy) {
    html += '✍️ 최초 작성: ' + d.createdBy + (d.createdAt ? ' (' + String(d.createdAt).slice(0,16).replace('T',' ') + ')' : '');
  }
  if (d.lastEditedBy && d.lastEditedBy !== d.createdBy) {
    html += '<br>🔄 마지막 수정: ' + d.lastEditedBy + (d.savedAt ? ' (' + String(d.savedAt).slice(0,16).replace('T',' ') + ')' : '');
  }
  html += '</div>';
  return html;
}

function nsView(d) {
  function rv(v,opt){return v===opt?'●':'○';}
  function ck(v){return v?'☑':'☐';}
  var html = '<div style="font-size:12px;line-height:2">';
  html += '<b>날짜:</b> '+d.date+' &nbsp; <b>성별:</b> '+rv(d.gender,'Male')+' Male '+rv(d.gender,'Female')+' Female<br>';
  html += '<b>키:</b> '+d.height+'in &nbsp; <b>체중:</b> '+d.weight+'lbs &nbsp; <b>BMI:</b> '+d.bmi+'<br>';
  html += '<b>체중진단:</b> '+rv(d.assessment,'Normal')+' Normal '+rv(d.assessment,'Underweight')+' Underweight '+rv(d.assessment,'Overweight')+' Overweight '+rv(d.assessment,'Obese')+' Obese<br>';
  if(d.dx) html += '<b>진단:</b> '+ck(d.dx.htn)+' HTN '+ck(d.dx.hld)+' Hyperlipidemia '+ck(d.dx.dm)+' Diabetes '+ck(d.dx.ckd)+' Kidney Dis. '+ck(d.dx.other)+' Others<br>';
  if(d.diet) html += '<b>식단:</b> '+ck(d.diet.na)+' 2gm Na '+ck(d.diet.lf)+' Low fat '+ck(d.diet.carb)+' Carb '+ck(d.diet.renal)+' Renal '+ck(d.diet.other)+' '+d.diet.otherText+'<br>';
  html += '<b>알러지:</b> '+rv(d.allergy,'No')+' No '+rv(d.allergy,'Yes')+' Yes '+(d.allergySpec||'')+'<br>';
  html += '<b>Q1(BMI&lt;18):</b> '+rv(d.q1,'No')+' No '+rv(d.q1,'Yes')+' Yes &nbsp;';
  html += '<b>Q2(BMI&gt;30):</b> '+rv(d.q2,'No')+' No '+rv(d.q2,'Yes')+' Yes<br>';
  html += '<b>Q3(체중감소):</b> '+rv(d.q3,'No')+' No '+rv(d.q3,'Yes')+' Yes &nbsp;';
  html += '<b>Q4(당뇨):</b> '+rv(d.q4,'No')+' No '+rv(d.q4,'Yes')+' Yes<br>';
  html += '<b>Q5(신부전):</b> '+rv(d.q5,'No')+' No '+rv(d.q5,'Yes')+' Yes<br>';
  html += '<b>영양상담:</b> '+rv(d.counselling,'Accepted')+' Accepted '+rv(d.counselling,'Declined')+' Declined<br>';
  if(d.memberSig) html += '<div style="margin-top:6px"><div style="font-size:10px;color:#8E8E93">회원 서명</div><img src="'+d.memberSig+'" style="height:44px;border:1px solid #E5E5EA;border-radius:6px"></div>';
  if(d.staffSig)  html += '<div style="margin-top:6px"><div style="font-size:10px;color:#8E8E93">스태프 서명</div><img src="'+d.staffSig+'" style="height:44px;border:1px solid #E5E5EA;border-radius:6px"></div>';
  html += _authorFooter(d);
  html += '</div>';
  return html;
}

// Assessment 팝업 뷰
function asmtView(d) {
  function row(label, val) {
    if (val === undefined || val === null || val === '') return '';
    return '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:.5px solid #F2F2F7">'
      + '<span style="font-size:11px;color:#8E8E93;min-width:90px">' + label + '</span>'
      + '<span style="font-size:12px;color:#1C1C1E;flex:1">' + val + '</span></div>';
  }
  var ADL_LABEL = {bathing:'목욕',hygiene:'개인위생',dressing:'옷입기',mobility:'이동',transfer:'이동보조',eating:'식사',toilet:'화장실'};
  var ADL_SCORE = {1:'1 독립',2:'2 약간도움',3:'3 많은도움',4:'4 거부'};

  var html = '<div style="font-size:12px">';
  html += row('평가일', d.date);
  html += row('평가자', d.assessor);
  html += row('생년월일', d.dob);
  html += row('Medicaid #', d.medicaid);
  html += row('전화', d.phone);
  html += row('주소', d.addr);
  html += row('주치의', d.pcp);

  if (d.adl && Object.values(d.adl).some(function(v){return v;})) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">ADL 평가</div>';
    Object.keys(ADL_LABEL).forEach(function(k){
      if (d.adl[k]) html += row(ADL_LABEL[k], ADL_SCORE[d.adl[k]] || d.adl[k]);
    });
  }

  if (d.medications && d.medications.length) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">복용 약물</div>';
    d.medications.forEach(function(m){
      if (m.name) html += row(m.name, (m.dose||'') + (m.reason ? ' — ' + m.reason : ''));
    });
  }

  if (d.caregiver && d.caregiver.name) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">주 보호자</div>';
    html += row(d.caregiver.name, (d.caregiver.rel||'') + ' · ' + (d.caregiver.phone||''));
  }
  if (d.ec1 && d.ec1.name) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">비상 연락처 1</div>';
    html += row(d.ec1.name, (d.ec1.rel||'') + ' · ' + (d.ec1.phone||''));
  }
  if (d.ec2 && d.ec2.name) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">비상 연락처 2</div>';
    html += row(d.ec2.name, (d.ec2.rel||'') + ' · ' + (d.ec2.phone||''));
  }

  if (d.personal && Object.values(d.personal).some(function(v){return v;})) {
    html += '<div style="font-size:12px;font-weight:700;margin:12px 0 6px">개인 이력</div>';
    html += row('직업', d.personal.work);
    html += row('교육', d.personal.edu);
    html += row('취미', d.personal.hobbies);
    html += row('종교', d.personal.religion);
    html += row('희망사항', d.personal.hopes);
  }

  if (d.ptSig) html += '<div style="margin-top:10px"><div style="font-size:11px;color:#8E8E93;margin-bottom:4px">회원/대리인 서명</div><img src="'+d.ptSig+'" style="height:50px;border:1px solid #E5E5EA;border-radius:6px"></div>';
  if (d.asSig) html += '<div style="margin-top:8px"><div style="font-size:11px;color:#8E8E93;margin-bottom:4px">평가자 서명</div><img src="'+d.asSig+'" style="height:50px;border:1px solid #E5E5EA;border-radius:6px"></div>';
  html += _authorFooter(d);

  html += '</div>';
  return html;
}

// Incident/Case/Auth 목록 팝업
function viewLogList(mid, type) {
  var m = MEMBERS.find(function(x){return x.id===mid;});
  var mName = m ? m.kr : mid;
  var cache = _docCache[mid] || {};
  var data = type==='incident' ? cache.inc : type==='caselog' ? cache.cases : cache.auth;
  var title = type==='incident' ? '🚨 Incident Log' : type==='caselog' ? '📁 Case Log' : '🔑 Authorization';
  document.getElementById('doc-viewer-title').textContent = mName+' — '+title;

  if (!data || !data.length) {
    document.getElementById('doc-viewer-body').innerHTML = '<div style="padding:16px;color:#8E8E93">데이터 없음</div>';
    openOv('ov-doc-viewer');
    return;
  }

  var html = '<div style="padding:8px">';
  data.forEach(function(r) {
    html += '<div style="background:#F2F2F7;border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px">';
    if(type==='incident') {
      html += '<div style="font-weight:700;color:#FF3B30">'+String(r['날짜']||'').slice(0,10)+' — '+String(r['유형']||'')+'</div>';
      html += '<div style="color:#3C3C43;margin-top:3px">심각도: '+String(r['심각도']||'—')+'</div>';
      html += '<div style="color:#555;margin-top:3px">'+String(r['설명']||'')+'</div>';
    } else if(type==='caselog') {
      html += '<div style="font-weight:700;color:#185FA5">'+String(r['날짜']||'').slice(0,10)+' — '+String(r['유형']||'')+'</div>';
      html += '<div style="color:#3C3C43;margin-top:2px;font-weight:600">'+String(r['제목']||'')+'</div>';
      html += '<div style="color:#555;margin-top:2px">'+String(r['내용']||'').slice(0,100)+'</div>';
      if(r['상태']) html += '<div style="margin-top:3px;color:#8E8E93">상태: '+String(r['상태'])+'</div>';
    } else { // auth
      html += '<div style="font-weight:700;color:#0F6E56">Auth# '+String(r['Auth번호']||'—')+'</div>';
      html += '<div style="color:#3C3C43;margin-top:2px">'+String(r['시작일']||'')+'  ~  '+String(r['종료일']||'')+'</div>';
      html += '<div style="color:#555;margin-top:2px">'+String(r['서비스유형']||'')+'</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('doc-viewer-body').innerHTML = html;
  openOv('ov-doc-viewer');
}

function filterM() {
  if (!MEMBERS || !MEMBERS.length) return;

  var raw = ((document.getElementById('msearch') || {}).value || '').toLowerCase().trim();
  var sf  = ((document.getElementById('status-filter') || {}).value) || 'all';

  // 보험사 라벨 매핑
  function insLabel(ins) {
    ins = (ins || '').toLowerCase();
    if (ins.includes('anthem')) return 'anthem anthem_mltc anthem_map';
    if (ins.includes('clp'))    return 'clp centerlight';
    if (ins.includes('swh'))    return 'swh senior whole health';
    return ins;
  }

  // 생일 월 매핑
  var MONTHS = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
    january:1, february:2, march:3, april:4, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12
  };

  // 요일 매핑
  var DAYS = {
    mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun',
    '월':'Mon', '화':'Tue', '수':'Wed', '목':'Thu', '금':'Fri', '토':'Sat', '일':'Sun'
  };

  mFilt = MEMBERS.filter(function(m) {
    // 상태 필터
    var mS = sf === 'all'
      || (sf === 'active'      && isActive(m))
      || (sf === 'disenrolled' && !isActive(m));
    if (!mS) return false;
    if (!raw) return true;

    // ── 1. 텍스트 통합 검색 ──────────────────────────────
    var txt = [
      m.kr || '',
      (m.en || '').toLowerCase(),
      (m.medicaid || '').toLowerCase(),
      (m.mltc || '').toLowerCase(),
      (m.addr || '').toLowerCase(),
      (m.phone || '').replace(/-/g,''),
      (m.pcp || '').toLowerCase(),
      (m.chartNo || ''),
      insLabel(m.ins),
    ].join(' ');
    if (txt.includes(raw)) return true;

    // ── 2. 생일 월 (may, june, 5월, 12월) ───────────────
    var dobMonth = parseInt((m.dob || '').slice(5, 7));
    if (MONTHS[raw] !== undefined && dobMonth === MONTHS[raw]) return true;
    var mNum = raw.match(/^(\d{1,2})월$/);
    if (mNum && dobMonth === parseInt(mNum[1])) return true;

    // ── 3. 생년 (1952 등) ────────────────────────────────
    if (/^\d{4}$/.test(raw) && (m.dob || '').startsWith(raw)) return true;

    // ── 4. 출석 요일 (mon, tue / 월, 화) ────────────────
    var dayKey = DAYS[raw] || DAYS[raw.slice(0,3)];
    if (dayKey && (m.days || []).includes(dayKey)) return true;

    return false;
  });

  mPage = 0; renderMG();
}

function setMDay(f, btn) {
  document.querySelectorAll('.fpill[data-mf]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  mFilt = f ? MEMBERS.filter(m => m.days.includes(f)) : [...MEMBERS];
  mPage = 0; renderMG();
}

function renderMG() {
  document.getElementById('m-cnt').textContent = '검색 결과: ' + mFilt.length + '명';
  const sl = mFilt.slice(mPage * PER, (mPage + 1) * PER);
  document.getElementById('mgrid').innerHTML = sl.map(m => `<div class="mc ${isActive(m) ? '' : 'disenrolled-card'}">
    <div class="mc-top">
      <div class="mc-av" style="background:${m.avBg};color:${m.avColor};overflow:hidden;padding:0">
        ${m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover">' : m.kr[0]}
      </div>
      <div style="flex:1;min-width:0"><div class="mc-name">${m.kr}</div><div class="mc-en">${m.en}</div></div>
    </div>
    <div class="mc-grid">
      <span class="mc-lbl">차트번호</span><span class="mc-val" style="color:#D85A30;font-weight:800">${m.chartNo || m.id || '—'}</span>
      <span class="mc-lbl">생년월일</span><span class="mc-val">${m.dob ? m.dob.slice(0,10) : '—'}</span>
      <span class="mc-lbl">Medicaid</span><span class="mc-val">${m.medicaid}</span>
      <span class="mc-lbl">보험사</span><span class="mc-val">${insBadge(m.ins || 'Anthem_MLTC')}</span>
      <span class="mc-lbl">상태</span><span class="mc-val">${statusBadge(m)}</span>
      <span class="mc-lbl">주치의</span><span class="mc-val">${m.pcp || '—'}</span>
    </div>
    <div class="mc-days" style="margin-top:7px">${m.days.map(d => `<span class="mc-day">${DKR[d]}</span>`).join('')}</div>
    ${m.memo ? `<div style="font-size:11px;color:#D85A30;background:#FFF3EE;border-radius:8px;padding:5px 9px;margin-top:6px">📝 ${m.memo}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openMemberEdit('${m.id}')">✏️ 정보 수정</button>
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openStatusModal('${m.id}')">● 상태 변경</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#E6F1FB;color:#0C447C;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openPhotoUpload('${m.id}')">📸 사진</button>
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#FFF3EE;color:#D85A30;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="generateMemberChart('${m.id}')">🪪 차트</button>
    </div>
    <a href="operations.html?tab=pcsp&mid=${m.id}" onclick="localStorage.setItem('pcsp_prefill_mid',this.getAttribute('data-mid'))" data-mid="${m.id}" style="display:block;margin-top:6px;padding:10px;background:#D85A30;color:#fff;border-radius:12px;font-size:13px;font-weight:700;text-align:center;text-decoration:none">📋 PCSP 입력 →</a>
    <button onclick="toggleMemberDocs('${m.id}',this)" style="width:100%;margin-top:6px;padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer">📄 관련 문서 보기</button>
    <div id="docs-${m.id}" style="display:none;margin-top:8px"></div>
  </div>`).join('');

  const tot = Math.ceil(mFilt.length / PER);
  if (tot <= 1) { document.getElementById('mpg').innerHTML = ''; return; }
  let h = '';
  if (mPage > 0) h += `<button class="pgb" onclick="chMP(${mPage - 1})">← 이전</button>`;
  h += `<span class="pg-info">${mPage + 1} / ${tot}</span>`;
  if (mPage < tot - 1) h += `<button class="pgb" onclick="chMP(${mPage + 1})">다음 →</button>`;
  document.getElementById('mpg').innerHTML = h;
}

function chMP(p) { mPage = p; renderMG(); document.querySelector('.content').scrollTop = 0; }

// ── 멤버 상태 변경 모달 ──────────────────────────────────────
function openStatusModal(mid) {
  window._statusMid = mid;
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  document.getElementById('sm-name').textContent = m.kr + ' — ' + m.en;
  const a = isActive(m);
  document.getElementById('sm-active').checked      = a;
  document.getElementById('sm-disenrolled').checked = !a;
  document.getElementById('sm-date-wrap').style.display = a ? 'none' : 'block';
  document.getElementById('sm-date').value = m.disenrollDate || '';
  document.getElementById('sm-note').value = m.disenrollNote || '';
  document.getElementById('ov-status').classList.add('open');
  document.getElementById('modal-ov-status').style.display = 'block';
}

function toggleStatusRadio() {
  document.getElementById('sm-date-wrap').style.display =
    document.getElementById('sm-disenrolled').checked ? 'block' : 'none';
}

async function saveStatus() {
  const m = MEMBERS.find(x => x.id === window._statusMid); if (!m) return;
  if (document.getElementById('sm-disenrolled').checked) {
    m.status = 'disenrolled';
    m.disenrollDate = document.getElementById('sm-date').value || '';
    m.disenrollNote = document.getElementById('sm-note').value || '';
  } else { m.status = 'active'; m.disenrollDate = ''; m.disenrollNote = ''; }
  document.getElementById('ov-status').classList.remove('open');
  document.getElementById('modal-ov-status').style.display = 'none';
  // ★ 멤버 전체 필드를 함께 저장 (상태만 보내면 나머지 컬럼이 빈 값으로 덮어써짐)
  try {
    await SheetsAPI.saveMember(m);
  } catch(e) { console.log('상태 저장 오류:', e); }
  saveToStorage(); renderAtt(); filterM(); renderDash();
}

// ── 멤버 추가/수정 모달 ──────────────────────────────────────
var _meEditDays = new Set();

function openAddMember() {
  window._meditMid = null;
  document.getElementById('medit-title').textContent = '새 멤버 추가';
  ['me-chartno','me-kr','me-en','me-lastname','me-firstname','me-middlename','me-phone','me-addr','me-city','me-zip','me-diagcode','me-medicaid','me-mltc','me-pcp','me-memo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('me-dob').value = '';
  document.getElementById('me-ins').value = 'Anthem_MLTC';
  document.getElementById('me-state').value = 'NY';
  document.getElementById('me-gender').value = 'F';
  _meEditDays = new Set();
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const b = document.getElementById('me-' + d); if (b) b.className = 'dsbtn';
  });
  openOv('ov-medit');
}

function openMemberEdit(mid) {
  window._meditMid = mid;
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  document.getElementById('medit-title').textContent = m.kr + ' — 정보 수정';
  const cno = document.getElementById('me-chartno'); if (cno) cno.value = m.chartNo || m.id || '';
  document.getElementById('me-kr').value      = m.kr       || '';
  document.getElementById('me-en').value      = m.en       || '';
  document.getElementById('me-lastname').value   = m.lastName   || '';
  document.getElementById('me-firstname').value  = m.firstName  || '';
  document.getElementById('me-middlename').value = m.middleName || '';
  document.getElementById('me-dob').value     = m.dob      || '';
  document.getElementById('me-phone').value   = m.phone    || '';
  document.getElementById('me-addr').value    = m.addr     || '';
  document.getElementById('me-city').value    = m.city     || '';
  document.getElementById('me-state').value   = m.state    || 'NY';
  document.getElementById('me-zip').value     = m.zip      || '';
  document.getElementById('me-gender').value  = m.gender   || 'F';
  document.getElementById('me-diagcode').value = m.diagCode || '';
  document.getElementById('me-medicaid').value = m.medicaid || '';
  document.getElementById('me-mltc').value    = m.mltc     || '';
  document.getElementById('me-pcp').value     = m.pcp      || '';
  document.getElementById('me-ins').value     = m.ins      || 'Anthem_MLTC';
  const memoEl = document.getElementById('me-memo'); if (memoEl) memoEl.value = m.memo || '';
  _meEditDays = new Set(m.days || []);
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const b = document.getElementById('me-' + d); if (b) b.className = 'dsbtn' + (_meEditDays.has(d) ? ' sel' : '');
  });
  openOv('ov-medit');
}

function toggleMEDay(btn, day) {
  if (_meEditDays.has(day)) { _meEditDays.delete(day); btn.className = 'dsbtn'; }
  else                      { _meEditDays.add(day);    btn.className = 'dsbtn sel'; }
}

async function saveMemberEdit() {
  const isNew = !window._meditMid;
  let m;
  if (isNew) {
    // ★ 내부 차트번호를 ID로 사용 (Medicaid는 나중에 입력 가능)
    const cnoEl = document.getElementById('me-chartno');
    let newId = cnoEl ? cnoEl.value.trim() : '';
    if (!newId) {
      // 차트번호 미입력 시 자동 생성: 기존 숫자 ID 최대값 + 1
      const nums = MEMBERS.map(x => parseInt(x.id)).filter(n => !isNaN(n));
      newId = String(nums.length ? Math.max.apply(null, nums) + 1 : 1001);
      if (cnoEl) cnoEl.value = newId;
    }
    if (MEMBERS.find(x => x.id === newId)) { alert('이미 존재하는 차트번호입니다: ' + newId); return; }
    const COLORS = [{bg:'#FAECE7',color:'#993C1D'},{bg:'#E6F1FB',color:'#185FA5'},{bg:'#E1F5EE',color:'#0F6E56'},{bg:'#EEEDFE',color:'#534AB7'}];
    const clr = COLORS[MEMBERS.length % COLORS.length];
    m = { id: newId, chartNo: newId, status: 'active', disenrollDate: '', disenrollNote: '', memo: '', avBg: clr.bg, avColor: clr.color };
    MEMBERS.push(m);
  } else {
    m = MEMBERS.find(x => x.id === window._meditMid); if (!m) return;
  }
  const cno2 = document.getElementById('me-chartno'); if (cno2) m.chartNo = cno2.value.trim();
  m.kr       = document.getElementById('me-kr').value.trim();
  m.en       = document.getElementById('me-en').value.trim().toUpperCase();
  m.lastName   = document.getElementById('me-lastname').value.trim().toUpperCase();
  m.firstName  = document.getElementById('me-firstname').value.trim().toUpperCase();
  m.middleName = document.getElementById('me-middlename').value.trim().toUpperCase();
  m.dob      = document.getElementById('me-dob').value;
  m.phone    = document.getElementById('me-phone').value.trim();
  m.addr     = document.getElementById('me-addr').value.trim();
  m.city     = document.getElementById('me-city').value.trim();
  m.state    = document.getElementById('me-state').value.trim().toUpperCase() || 'NY';
  m.zip      = document.getElementById('me-zip').value.trim();
  m.gender   = document.getElementById('me-gender').value;
  m.diagCode = document.getElementById('me-diagcode').value.trim().toUpperCase();
  m.medicaid = document.getElementById('me-medicaid').value.trim().toUpperCase();
  m.mltc     = document.getElementById('me-mltc').value.trim();
  m.pcp      = document.getElementById('me-pcp').value.trim();
  m.ins      = document.getElementById('me-ins').value;
  const memoEl = document.getElementById('me-memo'); if (memoEl) m.memo = memoEl.value.trim();
  m.days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => _meEditDays.has(d));

  // ★ SheetsAPI.saveMember()로 통일 — 전체 필드를 한번에 정확히 저장
  try {
    await SheetsAPI.saveMember(m);
  } catch(e) { console.log('멤버 저장 오류:', e); }

  saveToStorage(); closeOv('ov-medit'); filterM(); renderAtt();
  alert((isNew ? '새 멤버 추가: ' : '') + m.kr + ' 저장됨');
}

// ── 멤버 Sheets 전체 업로드 ──────────────────────────────────
async function uploadMembersToSheets() {
  if (!confirm('멤버 ' + MEMBERS.length + '명 업로드?')) return;
  const btn = document.getElementById('btn-upload-members');
  if (btn) { btn.textContent = '업로드 중...'; btn.disabled = true; }
  let ok = 0;
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i];
    try {
      await SheetsAPI.saveMember(m);
      ok++;
    } catch (e) {}
    if (btn && i % 10 === 0) btn.textContent = '업로드 중... ' + (i + 1) + '/' + MEMBERS.length;
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 200));
  }
  if (btn) { btn.textContent = '✅ 완료 (' + ok + '명)'; btn.disabled = false; }
  const el = document.getElementById('api-msg'); if (el) el.textContent = '✅ ' + ok + '명 업로드 완료!';
}

// ── 멤버 사진 ────────────────────────────────────────────────
async function openPhotoUpload(mid) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async function(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
      const dataUrl = ev.target.result;
      const base64  = dataUrl.split(',')[1];

      // 1. 로컬 캐시 + 멤버 객체에 즉시 반영
      mp[mid] = dataUrl;
      const mObj = MEMBERS.find(x => x.id === mid);
      if (mObj) mObj.photo = dataUrl;
      saveToStorage(); // localStorage에 사진 보존 (새로고침 대비)

      // 2. Drive에 JSON으로 저장 (다른 기기에서 복원 가능)
      try {
        const m = MEMBERS.find(x => x.id === mid);
        const mName = m ? m.kr : mid;
        await SheetsAPI.saveJSON(mid, mName, 'Photo', { photo: dataUrl, savedAt: new Date().toISOString() });
        console.log('사진 Drive 저장 완료:', mid);
      } catch(err) {
        console.log('사진 Drive 저장 실패:', err);
      }

      // 3. 멤버 카드 즉시 업데이트
      renderMG();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}


// ══════════════════════════════════════════════════════════════
// 영문이름 Last/First/Middle 자동 분리 (일회성 도구)
// ══════════════════════════════════════════════════════════════
function _parseEnName(en) {
  en = (en || '').trim();
  if (!en) return { lastName:'', firstName:'', middleName:'' };

  // "LEE, ANN S." 형식 (쉼표 있음) → Last, First Middle
  if (en.includes(',')) {
    var parts = en.split(',');
    var last  = parts[0].trim();
    var rest  = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
    return {
      lastName:   last,
      firstName:  rest[0] || '',
      middleName: rest.slice(1).join(' ') || ''
    };
  }

  // "KIM JUNG HO" 형식 (공백 구분) → First Middle... Last (보통 한국식 영문표기는 Last가 맨 앞)
  var words = en.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return { lastName: words[0], firstName:'', middleName:'' };
  }
  if (words.length === 2) {
    return { lastName: words[0], firstName: words[1], middleName:'' };
  }
  // 3단어 이상: 첫 단어=Last, 둘째=First, 나머지=Middle
  return {
    lastName:   words[0],
    firstName:  words[1],
    middleName: words.slice(2).join(' ')
  };
}

async function splitMemberNames() {
  if (!MEMBERS || !MEMBERS.length) { alert('멤버 데이터가 로드되지 않았어요'); return; }
  if (!confirm('전체 ' + MEMBERS.length + '명의 영문이름을 Last/First/Middle로 자동 분리합니다.\n이미 입력된 값이 있으면 덮어쓰지 않아요. 계속하시겠어요?')) return;

  var msgEl = document.getElementById('api-msg');
  var done = 0, skipped = 0, failed = 0;

  for (var i = 0; i < MEMBERS.length; i++) {
    var m = MEMBERS[i];

    // 이미 분리되어 있으면 스킵
    if (m.lastName || m.firstName || m.middleName) { skipped++; continue; }

    var parsed = _parseEnName(m.en);
    m.lastName   = parsed.lastName;
    m.firstName  = parsed.firstName;
    m.middleName = parsed.middleName;

    try {
      await SheetsAPI.saveMember(m);
      done++;
    } catch(e) {
      failed++;
    }

    if (msgEl) msgEl.textContent = '⏳ 처리 중... ' + (i+1) + '/' + MEMBERS.length + ' (완료:' + done + ' 스킵:' + skipped + ' 실패:' + failed + ')';
  }

  if (msgEl) msgEl.textContent = '✅ 완료! 분리:' + done + '건, 이미있음(스킵):' + skipped + '건, 실패:' + failed + '건';
  alert('이름 분리 완료!\n분리: ' + done + '건\n스킵(이미 입력됨): ' + skipped + '건\n실패: ' + failed + '건\n\n잘못 나뉜 항목은 멤버 수정에서 직접 고쳐주세요.');
}

// ══════════════════════════════════════════════════════════════
// 서명대기 폼 전체보기 (PCSP / Nutrition / Assessment)
// ══════════════════════════════════════════════════════════════
async function showPendingSignatures() {
  var titleEl = document.getElementById('doc-viewer-title');
  var bodyEl  = document.getElementById('doc-viewer-body');
  if (titleEl) titleEl.textContent = '📝 서명대기 목록';
  if (bodyEl)  bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#8E8E93">불러오는 중...</div>';
  openOv('ov-doc-viewer');

  var pending = []; // { mid, mName, type, date, icon }

  try {
    // 1) PCSP — Sheets에서 '상태'=서명대기 인 것
    var pcspRes = await SheetsAPI.read('PCSP');
    if (pcspRes.ok && pcspRes.data) {
      pcspRes.data.forEach(function(p) {
        if (String(p['상태']||'') === '서명대기') {
          pending.push({
            mid: String(p['멤버ID']||''),
            mName: String(p['한글이름']||''),
            type: 'PCSP', icon: '📋',
            date: String(p['작성일']||'').slice(0,10),
            onclick: "closeOv('ov-doc-viewer');openPCSPForm('"+(p['ID']||'')+"')"
          });
        }
      });
    }

    // 2) Nutrition / Assessment — JSONLog 전체 조회 후 각 파일 signed 체크
    var logRes = await SheetsAPI.read('JSONLog');
    var logs = (logRes.ok && logRes.data) ? logRes.data : [];
    var checkTargets = logs.filter(function(l){
      var t = String(l['파일종류']||'');
      return t === 'Nutrition' || t === 'Assessment';
    });

    // 멤버별 + 종류별 최신 1건만
    var latestMap = {};
    checkTargets.forEach(function(l){
      var key = l['멤버ID'] + '_' + l['파일종류'];
      var savedAt = String(l['저장일시']||'');
      if (!latestMap[key] || savedAt > latestMap[key]['저장일시']) latestMap[key] = l;
    });

    var checks = Object.values(latestMap).map(async function(l) {
      var mid = String(l['멤버ID']||'');
      var mName = String(l['한글이름']||'');
      var fileType = String(l['파일종류']||'');
      try {
        var res = await SheetsAPI.loadJSON(mid, mName, fileType);
        if (res.ok && res.data && res.data.found) {
          var d = res.data.data || {};
          if (d.signed === false) {
            pending.push({
              mid: mid, mName: mName, type: fileType,
              icon: fileType === 'Nutrition' ? '🥗' : '📋',
              date: String(l['저장일시']||'').slice(0,10),
              onclick: "closeOv('ov-doc-viewer');"
                + "window.location.href='operations.html?tab=forms&mid="+mid+"&type="+fileType+"'"
            });
          }
        }
      } catch(e) { /* 무시 */ }
    });

    await Promise.all(checks);

    // 날짜 오름차순(오래된 것 먼저)
    pending.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });

    var countEl = document.getElementById('pending-sig-count');
    if (countEl) countEl.textContent = pending.length;

    if (!pending.length) {
      if (bodyEl) bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:#34C759;font-weight:600">✅ 서명대기 없음! 모두 완료됐어요.</div>';
      return;
    }

    var html = '<div style="font-size:12px;color:#8E8E93;margin-bottom:10px">총 ' + pending.length + '건 — 태블릿으로 순서대로 열어 서명받으세요</div>';
    pending.forEach(function(p) {
      html += '<div onclick="' + p.onclick + '" style="background:#FFF3E0;border:1px solid #FFB347;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">'
        + '<div><div style="font-size:13px;font-weight:700">' + p.icon + ' ' + p.mName + '</div>'
        + '<div style="font-size:11px;color:#8E8E93;margin-top:2px">' + p.type + ' · ' + p.date + '</div></div>'
        + '<span style="color:#FF9500;font-size:13px">서명받기 →</span>'
        + '</div>';
    });
    if (bodyEl) bodyEl.innerHTML = html;

  } catch(e) {
    if (bodyEl) bodyEl.innerHTML = '<div style="padding:20px;color:#FF3B30">오류: ' + e.message + '</div>';
  }
}

// 대시보드 진입 시 서명대기 카운트 자동 업데이트 (가벼운 PCSP만 체크)
async function updatePendingSigCount() {
  try {
    var res = await SheetsAPI.read('PCSP');
    if (!res.ok || !res.data) return;
    var count = res.data.filter(function(p){ return String(p['상태']||'')==='서명대기'; }).length;
    var el = document.getElementById('pending-sig-count');
    if (el) el.textContent = count;

    // 대시보드 알림도 함께 업데이트
    var alertEl = document.getElementById('ds-sig-alert');
    if (alertEl) {
      if (count > 0) {
        alertEl.style.display = 'block';
        alertEl.innerHTML = '📝 서명대기 PCSP <b style="color:#B35900">' + count + '건</b> — 클릭해서 확인 →';
      } else {
        alertEl.style.display = 'none';
      }
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// 멤버 사진 Drive에서 복원 (다른 기기 동기화)
// ══════════════════════════════════════════════════════════════
async function restorePhotosFromDrive() {
  var msgEl = document.getElementById('api-msg');
  if (msgEl) msgEl.textContent = '⏳ Drive에서 사진 목록 확인 중...';

  try {
    // JSONLog에서 Photo 타입 멤버 목록 조회
    var logRes = await SheetsAPI.read('JSONLog');
    if (!logRes.ok || !logRes.data) { if(msgEl) msgEl.textContent='❌ JSONLog 조회 실패'; return; }

    var photoLogs = logRes.data.filter(function(l){ return String(l['파일종류']||'') === 'Photo'; });
    // 멤버별 최신 1건
    var latest = {};
    photoLogs.forEach(function(l){
      var mid = String(l['멤버ID']||'');
      var at  = String(l['저장일시']||'');
      if (!latest[mid] || at > latest[mid].at) latest[mid] = { mid: mid, name: String(l['한글이름']||''), at: at };
    });

    var targets = Object.values(latest).filter(function(t){
      var m = MEMBERS.find(function(x){ return x.id === t.mid; });
      return m && !m.photo; // 이미 사진 있으면 스킵
    });

    if (!targets.length) { if(msgEl) msgEl.textContent='✅ 복원할 사진 없음 (모두 최신)'; return; }

    var done = 0;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      try {
        var res = await SheetsAPI.loadJSON(t.mid, t.name, 'Photo');
        if (res.ok && res.data && res.data.found && res.data.data && res.data.data.photo) {
          var m = MEMBERS.find(function(x){ return x.id === t.mid; });
          if (m) { m.photo = res.data.data.photo; mp[t.mid] = res.data.data.photo; done++; }
        }
      } catch(e) {}
      if (msgEl) msgEl.textContent = '⏳ 사진 복원 중... ' + (i+1) + '/' + targets.length;
    }

    saveToStorage();
    renderMG();
    if (msgEl) msgEl.textContent = '✅ 사진 ' + done + '건 복원 완료!';
  } catch(e) {
    if (msgEl) msgEl.textContent = '❌ 오류: ' + e.message;
  }
}

// ══════════════════════════════════════════════════════════════
// 주소 City/State/Zip 자동 분리 (일회성 도구)
// ══════════════════════════════════════════════════════════════
function _parseAddress(addr) {
  addr = (addr || '').trim();
  if (!addr) return { city:'', state:'NY', zip:'' };

  // 우편번호 추출 (마지막 5자리 숫자, 뒤에 -XXXX 있어도 무시)
  var zipMatch = addr.match(/(\d{5})(?:-\d{4})?\s*$/);
  var zip = zipMatch ? zipMatch[1] : '';
  var rest = zip ? addr.slice(0, zipMatch.index).trim() : addr;

  // 주(State) 추출 — 우편번호 바로 앞의 2글자 대문자 약어
  var stateMatch = rest.match(/,?\s*([A-Z]{2})\s*$/);
  var state = stateMatch ? stateMatch[1] : 'NY';
  rest = stateMatch ? rest.slice(0, stateMatch.index).trim() : rest;
  rest = rest.replace(/,\s*$/, '').trim();

  // City 추출 — 쉼표가 있으면 마지막 쉼표 뒤, 없으면 마지막 단어들(도시명은 보통 1~2단어)
  var city = '';
  if (rest.includes(',')) {
    var parts = rest.split(',');
    city = parts[parts.length - 1].trim();
  } else {
    // 쉼표 없는 경우: 마지막 1~2단어를 도시로 추정 (예: "BAYSIDE", "FRESH MEADOWS")
    var words = rest.split(/\s+/);
    // 흔한 뉴욕 지역명 몇 개는 2단어
    var twoWordCities = ['FRESH MEADOWS','JACKSON HEIGHTS','FOREST HILLS','RICHMOND HILL','LITTLE NECK','FLORAL PARK','MOUNT VERNON','WHITE PLAINS','MOTT HAVEN'];
    var lastTwo = words.slice(-2).join(' ').toUpperCase();
    if (twoWordCities.includes(lastTwo)) {
      city = words.slice(-2).join(' ');
    } else {
      city = words[words.length - 1] || '';
    }
  }

  return { city: city, state: state, zip: zip };
}

async function splitMemberAddresses() {
  if (!MEMBERS || !MEMBERS.length) { alert('멤버 데이터가 로드되지 않았어요'); return; }
  if (!confirm('전체 ' + MEMBERS.length + '명의 주소를 City/State/Zip으로 자동 분리합니다.\n이미 입력된 값이 있으면 덮어쓰지 않아요. 계속하시겠어요?')) return;

  var msgEl = document.getElementById('api-msg');
  var done = 0, skipped = 0, failed = 0;

  for (var i = 0; i < MEMBERS.length; i++) {
    var m = MEMBERS[i];

    if (m.city || m.zip) { skipped++; continue; }
    if (!m.addr) { skipped++; continue; }

    var parsed = _parseAddress(m.addr);
    m.city  = parsed.city;
    m.state = parsed.state;
    m.zip   = parsed.zip;

    try {
      await SheetsAPI.saveMember(m);
      done++;
    } catch(e) {
      failed++;
    }

    if (msgEl) msgEl.textContent = '⏳ 주소 분리 중... ' + (i+1) + '/' + MEMBERS.length + ' (완료:' + done + ' 스킵:' + skipped + ' 실패:' + failed + ')';
  }

  if (msgEl) msgEl.textContent = '✅ 완료! 분리:' + done + '건, 스킵:' + skipped + '건, 실패:' + failed + '건';
  alert('주소 분리 완료!\n분리: ' + done + '건\n스킵(이미 입력됨/주소없음): ' + skipped + '건\n실패: ' + failed + '건\n\n잘못 나뉜 항목은 멤버 수정에서 직접 고쳐주세요.');
}
