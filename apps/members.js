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
    var expired  = pcspExp && pcspExp < new Date().toISOString().slice(0,10);
    var pcspVal  = pcsp ? (pcspDate + (pcspExp ? ' · 만료: <b style="color:'+(expired?'#FF3B30':'#34C759')+'">'+pcspExp+'</b>' : '')) : null;
    html += docRow('📋','PCSP', pcspVal, pcsp ? "openPCSPForm('"+mid+"')" : '');

    // Drive JSON 문서
    var logs = (logRes.ok && logRes.data) ? logRes.data : [];
    function lastLog(type) {
      var found = logs.filter(function(l){ return String(l['파일종류']||'')===type; });
      return found.length ? String(found[found.length-1]['저장일시']||'').slice(0,10) : null;
    }
    html += docRow('🥗','Nutrition Screening', lastLog('Nutrition'),  lastLog('Nutrition')  ? "viewDriveDoc('"+mid+"','Nutrition')"  : '');
    html += docRow('📋','Assessment',           lastLog('Assessment'), lastLog('Assessment') ? "viewDriveDoc('"+mid+"','Assessment')" : '');
    html += docRow('📄','Member Rights',         lastLog('MemberRights'), lastLog('MemberRights') ? "viewDriveDoc('"+mid+"','MemberRights')" : '');

    // Incident / Case / Auth
    var incData   = incRes.ok  ? (incRes.data ||[]) : [];
    var caseData  = caseRes.ok ? (caseRes.data||[]) : [];
    var authData  = authRes.ok ? (authRes.data||[]) : [];
    var authActive = authData.filter(function(a){
      return !String(a['종료일']||'') || String(a['종료일']) >= new Date().toISOString().slice(0,10);
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

function docRow(icon, label, value, onclick) {
  var hasData = value !== null && value !== undefined && value !== '';
  var click = onclick ? ' onclick="'+onclick+'" style="cursor:pointer"' : '';
  return '<div class="doc-row"'+click+'>'
    + '<span style="font-size:12px;color:#3C3C43">'+icon+' '+label+'</span>'
    + (hasData
      ? '<span style="font-size:11px;color:#34C759;font-weight:600">'+value+(onclick?' →':'')+'</span>'
      : '<span style="font-size:11px;color:#C7C7CC">없음</span>')
    + '</div>';
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

function saveStatus() {
  const m = MEMBERS.find(x => x.id === window._statusMid); if (!m) return;
  if (document.getElementById('sm-disenrolled').checked) {
    m.status = 'disenrolled';
    m.disenrollDate = document.getElementById('sm-date').value || '';
    m.disenrollNote = document.getElementById('sm-note').value || '';
  } else { m.status = 'active'; m.disenrollDate = ''; m.disenrollNote = ''; }
  document.getElementById('ov-status').classList.remove('open');
  document.getElementById('modal-ov-status').style.display = 'none';
  if (apiUrl) {
    apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id,
      data: { 'ID': m.id, '상태': m.status, 'Disenroll날짜': m.disenrollDate || '' } }).catch(() => {});
  }
  saveToStorage(); renderAtt(); filterM(); renderDash();
}

// ── 멤버 추가/수정 모달 ──────────────────────────────────────
var _meEditDays = new Set();

function openAddMember() {
  window._meditMid = null;
  document.getElementById('medit-title').textContent = '새 멤버 추가';
  ['me-kr','me-en','me-phone','me-addr','me-medicaid','me-mltc','me-pcp','me-memo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('me-dob').value = '';
  document.getElementById('me-ins').value = 'Anthem_MLTC';
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
  document.getElementById('me-dob').value     = m.dob      || '';
  document.getElementById('me-phone').value   = m.phone    || '';
  document.getElementById('me-addr').value    = m.addr     || '';
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
    const newId = document.getElementById('me-medicaid').value.trim().toUpperCase();
    if (!newId) { alert('Medicaid ID를 입력해주세요.'); return; }
    if (MEMBERS.find(x => x.id === newId)) { alert('이미 존재하는 Medicaid ID입니다.'); return; }
    const COLORS = [{bg:'#FAECE7',color:'#993C1D'},{bg:'#E6F1FB',color:'#185FA5'},{bg:'#E1F5EE',color:'#0F6E56'},{bg:'#EEEDFE',color:'#534AB7'}];
    const clr = COLORS[MEMBERS.length % COLORS.length];
    m = { id: newId, status: 'active', disenrollDate: '', disenrollNote: '', memo: '', avBg: clr.bg, avColor: clr.color };
    MEMBERS.push(m);
  } else {
    m = MEMBERS.find(x => x.id === window._meditMid); if (!m) return;
  }
  const cno2 = document.getElementById('me-chartno'); if (cno2) m.chartNo = cno2.value.trim();
  m.kr       = document.getElementById('me-kr').value.trim();
  m.en       = document.getElementById('me-en').value.trim().toUpperCase();
  m.dob      = document.getElementById('me-dob').value;
  m.phone    = document.getElementById('me-phone').value.trim();
  m.addr     = document.getElementById('me-addr').value.trim();
  m.medicaid = document.getElementById('me-medicaid').value.trim().toUpperCase();
  m.mltc     = document.getElementById('me-mltc').value.trim();
  m.pcp      = document.getElementById('me-pcp').value.trim();
  m.ins      = document.getElementById('me-ins').value;
  const memoEl = document.getElementById('me-memo'); if (memoEl) m.memo = memoEl.value.trim();
  m.days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => _meEditDays.has(d));

  if (apiUrl) {
    apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id, data: {
      'ID': m.id, '한글이름': m.kr, '영문이름': m.en, 'Medicaid': m.medicaid, 'MLTC': m.mltc,
      '주치의': m.pcp, '출석요일': m.days.join(','), '전화': m.phone, '주소': m.addr,
      '생년월일': m.dob ? m.dob.slice(0,10) : '', '보험사': m.ins, '상태': m.status || 'active',
      'Disenroll날짜': m.disenrollDate || '', '메모': m.memo || '',
      'avBg': m.avBg || '#E6F1FB', 'avColor': m.avColor || '#185FA5',
    }}).catch(e => console.log(e));
  }
  saveToStorage(); closeOv('ov-medit'); filterM(); renderAtt();
  alert((isNew ? '새 멤버 추가: ' : '') + m.kr + ' 저장됨');
}

// ── 멤버 Sheets 전체 업로드 ──────────────────────────────────
async function uploadMembersToSheets() {
  if (!apiUrl) { alert('Google Sheets URL을 먼저 설정해주세요.'); return; }
  if (!confirm('멤버 ' + MEMBERS.length + '명 업로드?')) return;
  const btn = document.getElementById('btn-upload-members');
  if (btn) { btn.textContent = '업로드 중...'; btn.disabled = true; }
  let ok = 0;
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i];
    try {
      await apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id, data: {
        'ID': m.id, '한글이름': m.kr, '영문이름': m.en, 'Medicaid': m.medicaid, 'MLTC': m.mltc,
        '주치의': m.pcp || '', '출석요일': (m.days || []).join(','), '전화': m.phone || '',
        '주소': m.addr || '', '생년월일': m.dob ? m.dob.slice(0,10) : '', '보험사': m.ins || '',
        '상태': m.status || 'active', 'Disenroll날짜': m.disenrollDate || '', '메모': m.memo || '',
        'avBg': m.avBg || '#E6F1FB', 'avColor': m.avColor || '#185FA5',
      }});
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

      // 1. 로컬 캐시 (빠른 표시용)
      mp[mid] = dataUrl;

      // 2. Drive에 저장 (영구 보관)
      try {
        const m = MEMBERS.find(x => x.id === mid);
        const mName = m ? m.kr : mid;
        const res = await apiCall({}, {
          action:     'savePDF',
          memberId:   mid,
          memberName: mName,
          fileType:   'Photo',
          base64Data: base64,
          author:     (currentUser && currentUser.name) || 'Staff',
        });
        if (res && res.ok && res.data && res.data.url) {
          // Drive 링크를 멤버 시트 memo에 저장
          console.log('사진 Drive 저장:', res.data.url);
        }
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

