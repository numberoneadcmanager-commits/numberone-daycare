// ══════════════════════════════════════════════════════════════
// Number One Adult Daycare — PCSP v2
// Policy-first PCSP + Sample-style output + AUTH prefill + Claude drafting
// ══════════════════════════════════════════════════════════════

var PCSP_LIST = []; // 서버(Sheets/Drive)가 원본. 브라우저에는 저장하지 않음
var PCSP_PDF_MAP = {};
var PCSP_LEGACY_PDFS={};
var _pcspPdfLoadedAt = 0;
var _pcspFilter = 'all';
var _pcspStep = 0;
var PCSP_STEP_COUNT = 11;

var _pcspMemberId = '';
var _pcspDays = new Set();
var _pcspContacts = [];
var _pcspPlanningPeople = [];
var _pcspRisks = [];
var _pcspGoals = [];
var _pcspSadcActivities = [];
var _pcspCommunity = [];
var _pcspRights = [];
var _pcspAuthRecords = [];
var _pcspSelectedAuthId = '';
var _pcspAuthSnapshot=null;
var _pcspAuthLoadSerial=0;
var _pcspMemberDefaults={};
var _pcspSig = null;

var PCSP_ADL_ITEMS = ['Mobility','Transfers','Toileting','Continence','Eating'];
var PCSP_ADL_LEVELS = ['Independent','Supervision Only','Minimal Hands-On','Moderate Hands-On','Total Hands-On'];
var PCSP_SUPPORT_LEVELS = [
  'Independent',
  'Supervision',
  'Verbal cueing',
  'Setup assistance',
  'Hands-on assistance',
  '1:1 support',
  'Other'
];
var PCSP_SADC_PRESETS = [
  {activity:'Breakfast',category:'Daily'},
  {activity:'Lunch',category:'Daily'},
  {activity:'Bingo',category:'Daily'},
  {activity:'Art',category:'Class'},
  {activity:'Music - Keyboard',category:'Class'},
  {activity:'Music - Guitar',category:'Class'},
  {activity:'Singing',category:'Class'},
  {activity:'Karaoke',category:'Class'},
  {activity:'Smartphone',category:'Class'},
  {activity:'Computer',category:'Class'},
  {activity:'Crafts',category:'Class'},
  {activity:'Billiards',category:'Other'},
  {activity:'Board Games',category:'Other'},
  {activity:'Counseling',category:'Other'}
];
var HCBS_RIGHTS = [
  {right:'Having access to food at any time.', group:'HCBS'},
  {right:'Freedom and support to control their own schedules and activities.', group:'HCBS'},
  {right:'Freedom to have visitors of their choosing at any time.', group:'HCBS'}
];
var OTHER_RIGHTS = [
  'Freedom of movement within the setting',
  'Physical accessibility of all areas of the setting',
  'Privacy (phone calls, mail, personal space)',
  'Choice of roommate or those with whom they share a unit',
  'Ability to furnish and decorate their personal space',
  'Right to lock their own space',
  'Community access and participation in community life',
  'Freedom to control their own funds',
  'Independence to interact with whom they choose'
].map(function(r){ return {right:r, group:'Other'}; });

function pcspEsc(v){
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function pcspInlineString(v){return pcspEsc(JSON.stringify(String(v==null?'':v)));}
function pcspClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function pcspVal(id){ var el=document.getElementById(id); return el ? el.value : ''; }
function gp(id){ return pcspVal('p-'+id); }
function pcspSet(id,v){ var el=document.getElementById(id); if(el) el.value=(v==null?'':v); }
function pcspDate(v){ var m=String(v||'').match(/^(\d{4}-\d{2}-\d{2})/); return m?m[1]:String(v||'').slice(0,10); }
function pcspHasConfirm(v){ return /CONFIRM WITH PARTICIPANT/i.test(String(v||'')); }
function pcspMarkConfirmFields(){
  document.querySelectorAll('#pcsp-form-view textarea,#pcsp-form-view input[type="text"]').forEach(function(el){
    el.classList.toggle('pcsp-confirm-needed', pcspHasConfirm(el.value));
  });
}
function pcspAutoHeight(el){ if(!el)return; el.style.height='auto'; el.style.height=Math.max(el.scrollHeight,60)+'px'; }
function pcspToday(){ return new Date().toLocaleDateString('sv-SE'); }
function pcspOneYearFromToday(){ var d=new Date(); d.setFullYear(d.getFullYear()+1); return d.toISOString().slice(0,10); }
var PCSP_CENTER_LOCATION='Number One Adult Daycare, 161-22 Northern Blvd 1FL, Flushing, NY 11358';
function applyPCSPCommonDefaults(){
  // 센터에서 거의 매번 동일하게 적용되는 운영 기본값만 자동 입력한다.
  // 참가자 개인의 기능/선호/권리 판단은 자동으로 선택하지 않는다.
  if(!pcspVal('p-planning-participated'))pcspSet('p-planning-participated','Yes');
  if(!pcspVal('p-meeting-date'))pcspSet('p-meeting-date',pcspVal('p-wdate')||pcspToday());
  if(!pcspVal('p-meeting-location'))pcspSet('p-meeting-location',PCSP_CENTER_LOCATION);
  if(!pcspVal('p-planning-notes'))pcspSet('p-planning-notes','Participant participated in the person-centered planning process and was given opportunities to express preferences, ask questions, and make choices regarding services, activities, and supports.');
  ['Breakfast','Lunch','Bingo'].forEach(function(activity){
    if(sadcFind(activity)>=0)return;
    var preset=PCSP_SADC_PRESETS.find(function(x){return x.activity===activity;});
    _pcspSadcActivities.push({activity:activity,category:preset?preset.category:'Daily',neededSupport:'Independent',supportDetails:''});
  });
}
function _pcspPdfKey(v){ return String(v||'').trim().toUpperCase(); }

// ══════════════════════════════════════════════════════════════
// Saved PDF lookup / list
// ══════════════════════════════════════════════════════════════
function loadPCSPPdfLinks(force){
  if(!force && _pcspPdfLoadedAt && Date.now()-_pcspPdfLoadedAt<15000) return Promise.resolve(PCSP_PDF_MAP);
  return apiGet({action:'read',sheet:'PDFLog'}).then(function(res){
    if(!res||!res.ok||!res.data)return PCSP_PDF_MAP;
    var map={},legacy={};
    res.data.forEach(function(r){
      if(String(r['파일종류']||'')!=='PCSP_Final' || !r['Drive링크'])return;
      var obj={url:String(r['Drive링크']),fileName:String(r['파일명']||''),savedAt:String(r['저장일시']||''),memberId:String(r['멤버ID']||''),name:String(r['한글이름']||'')};
      var match=obj.fileName.match(/^PCSP_Final__(.+)__\d{4}-\d{2}-\d{2}\.pdf$/);
      if(match){try{obj.pcspId=decodeURIComponent(match[1]);map[obj.memberId+'|'+obj.pcspId]=obj;}catch(e){}}else{(legacy[obj.memberId]||(legacy[obj.memberId]=[])).push(obj);}
    });
    PCSP_PDF_MAP=map;PCSP_LEGACY_PDFS=legacy; _pcspPdfLoadedAt=Date.now();
    renderPCSPList();
    return map;
  }).catch(function(e){console.log('PCSP PDFLog 로드 실패:',e);return PCSP_PDF_MAP;});
}
function getStoredPCSPPdf(p){
  if(!p)return null;
  var exact=PCSP_PDF_MAP[String(p.memberId||'')+'|'+p.id];if(exact)return exact;
  var old=PCSP_LEGACY_PDFS[String(p.memberId||'')]||[];
  // Older v2 PDF filenames omit record IDs: show the saved documents, never regenerate or silently assign one.
  return old.length?{choices:old}:null;
}
function pcspSafeDocumentURL(value){
  try{var u=new URL(value);return u.protocol==='https:'&&(u.hostname==='drive.google.com'||u.hostname==='docs.google.com')?u.href:'';}catch(e){return '';}
}
async function openStoredPCSPPdf(id){
  var p=PCSP_LIST.find(function(x){return x.id===id;});
  if(!p){alert('PCSP를 찾을 수 없어요');return;}
  var w=window.open('','_blank');
  if(!w){alert('팝업을 허용해주세요');return;}
  w.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:30px">저장된 PCSP PDF 찾는 중...</body></html>');w.document.close();
  var pdf=getStoredPCSPPdf(p);
  if(!pdf){await loadPCSPPdfLinks(true);pdf=getStoredPCSPPdf(p);}
  if(pdf&&pdf.choices){
    var links=pdf.choices.slice().reverse().map(function(x){var url=pcspSafeDocumentURL(x.url);return url?'<p><a href="'+pcspEsc(url)+'">'+pcspEsc(x.fileName)+' — '+pcspEsc(x.savedAt)+'</a></p>':'';}).join('');
    w.document.open();w.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body><h2>저장된 PCSP PDF 선택</h2><p>기존 파일명에는 PCSP ID가 없어 날짜와 파일명을 확인해 선택해주세요.</p>'+links+'</body></html>');w.document.close();return;
  }
  if(!pdf||!pcspSafeDocumentURL(pdf.url)){try{w.close();}catch(e){} alert('저장된 최종 PCSP PDF를 찾을 수 없습니다.');return;}
  w.location.replace(pcspSafeDocumentURL(pdf.url));
}

function loadPCSPFromSheets(){
  return apiGet({action:'read',sheet:'PCSP'}).then(function(res){
    if(!res||!res.ok||!res.data)return;
    PCSP_LIST=[]; // 매번 중앙 저장소 기준으로 새로 구성
    res.data.forEach(function(row){
      var id=String(row['ID']||''); if(!id)return;
      var summary={
        id:id,memberId:String(row['멤버ID']||''),nameKr:String(row['한글이름']||''),
        wdate:pcspDate(row['작성일']),nextdate:pcspDate(row['갱신예정일']),writer:String(row['작성자']||''),
        diag:String(row['진단']||''),status:String(row['상태']||'서명대기')
      };
      var existing=PCSP_LIST.find(function(p){return p.id===id;});
      if(existing) Object.keys(summary).forEach(function(k){existing[k]=summary[k];});
      else PCSP_LIST.push(summary);
    });
    savePCSPStorage();renderPCSPList();loadPCSPPdfLinks(false);
  }).catch(function(e){alert('❌ PCSP 목록 로드 실패: '+e.message);throw e;});
}
function savePCSPStorage(){ /* 메모리 전용: 영구 저장은 Sheets/Drive */ }
function setPCSPFilter(f,el){
  _pcspFilter=f;
  document.querySelectorAll('#pcsp-list-view .fpill').forEach(function(p){p.classList.remove('active');});
  if(el)el.classList.add('active');
  renderPCSPList();
}
function renderPCSPList(){
  var q=((document.getElementById('pcsp-search')||{}).value||'').toLowerCase();
  var today=pcspToday();
  var list=PCSP_LIST.filter(function(p){
    var match=!q||String(p.nameKr||'').toLowerCase().includes(q)||String(p.nameLast||'').toLowerCase().includes(q)||String(p.nameFirst||'').toLowerCase().includes(q);
    var due=p.nextdate&&p.nextdate<=today;
    return match && (_pcspFilter==='all'||(_pcspFilter==='due'&&due)||(_pcspFilter==='ok'&&!due&&String(p.status||'')!=='서명대기'));
  }).sort(function(a,b){return String(b.wdate||'').localeCompare(String(a.wdate||''));});
  var html='';
  if(!list.length) html='<div class="empty-msg">PCSP 기록이 없어요</div>';
  list.forEach(function(p){
    var due=p.nextdate&&p.nextdate<=today;
    var pending=['서명대기','작성중'].includes(String(p.status||''));
    var badge=p.status==='서명완료·PDF대기'?'<span class="badge b-warn">PDF 저장 재시도 필요</span>':p.status==='작성중'?'<span class="badge b-warn">작성중</span>':pending?'<span class="badge b-warn">✍️ 서명대기</span>':(due?'<span class="badge b-warn">⚠️ 갱신필요</span>':'<span class="badge b-ok">✅ 완료/유효</span>');
    var pdf=getStoredPCSPPdf(p);
    html+='<div class="log-card"><div class="log-top"><div class="log-name">📄 '+pcspEsc(p.nameLast||'')+(p.nameFirst?', '+pcspEsc(p.nameFirst):'')+(p.nameKr?' ('+pcspEsc(p.nameKr)+')':'')+'</div>'+badge+'</div>'
      +'<div style="font-size:11px;color:#8E8E93">작성: '+pcspEsc(p.wdate||'—')+' · 다음 검토: '+pcspEsc(p.nextdate||'—')+'</div>'
      +'<div style="font-size:11px;color:#3C3C43;margin-top:3px">'+pcspEsc((p.diag||'').slice(0,80))+'</div>'
      +'<div class="log-actions" style="margin-top:6px">'
      +(pending?'<button class="btn-sm" style="background:#FF9500;color:#fff;border-color:#FF9500" onclick="signPCSP('+pcspInlineString(p.id)+','+pcspInlineString(p.memberId||'')+','+pcspInlineString(p.nameKr||p.nameLast||'')+')">✍️ 서명하기</button>':'')
      +(pending?'<button class="btn-sm" onclick="editPCSP('+pcspInlineString(p.id)+')">✏️ 수정</button>':'<button class="btn-sm" onclick="wfRevise('+pcspInlineString(p.id)+')">새 PCSP 생성</button>')
      +(p.status==='서명완료·PDF대기'?'<button class="btn-sm" onclick="wfRetryPDF('+pcspInlineString(p.id)+')">PDF 재시도</button>':'')
      +(pdf&&!pending?'<button class="btn-sm" style="background:#E1F5EE;color:#0F6E56" onclick="openStoredPCSPPdf('+pcspInlineString(p.id)+')">📄 PDF 보기</button>':'')
      +'<button class="btn-sm" onclick="printPCSP('+pcspInlineString(p.id)+')">🔄 미리보기</button>'
      +'</div></div>';
  });
  var el=document.getElementById('pcsp-list'); if(el)el.innerHTML=html;
}
async function showPCSPList(){
  var active=document.getElementById('pcsp-form-view');
  if(active&&active.style.display!=='none'&&_pcspMemberId&&!_wfSavedExit){
    if(_pcspSig&&_pcspSig.length>100){alert('서명한 내용을 먼저 최종 저장해주세요.');return;}
    try{if(_wfBusy)await _wfBusy;if(_wfPending||wfFingerprint(wfEntry())!==_wfFingerprint)await wfPersist('draft');}catch(e){alert(e.message);return;}
  }
  _wfSavedExit=false;
  var a=document.getElementById('pcsp-list-view'),b=document.getElementById('pcsp-member-select'),c=document.getElementById('pcsp-form-view'),h=document.getElementById('forms-hub');
  if(a)a.style.display='block'; if(b)b.style.display='none'; if(c)c.style.display='none'; if(h)h.style.display='none';
  renderPCSPList();loadPCSPPdfLinks(false);wfRenewalBoard();
}
function openPCSPMemberSelect(){
  var a=document.getElementById('pcsp-list-view'),b=document.getElementById('pcsp-member-select'),c=document.getElementById('pcsp-form-view');
  if(a)a.style.display='none';if(b)b.style.display='block';if(c)c.style.display='none';
  pcspSet('pcsp-member-q','');renderPCSPMemberList();
}
function renderPCSPMemberList(){
  var q=(pcspVal('pcsp-member-q')||'').toLowerCase();
  var el=document.getElementById('pcsp-member-list');if(!el)return;
  apiGet({action:'read',sheet:'멤버'}).then(function(res){
    var members=(res&&res.ok&&res.data?res.data:[]).filter(function(r){
      return r['상태']!=='disenrolled'&&r['ID']&&(!q||String(r['한글이름']||'').toLowerCase().includes(q)||String(r['영문이름']||'').toLowerCase().includes(q));
    });
    if(!members.length){el.innerHTML='<div class="empty-msg">멤버를 찾을 수 없어요</div>';return;}
    el.innerHTML=members.map(function(m){
      return '<div class="log-card" style="cursor:pointer" onclick="selectPCSPMember('+JSON.stringify(m).replace(/"/g,'&quot;')+')">'
        +'<div class="log-top"><div class="log-name">'+pcspEsc(m['한글이름']||'')+'</div><span style="font-size:11px;color:#8E8E93">'+pcspEsc(m['영문이름']||'')+'</span></div>'
        +'<div style="font-size:11px;color:#8E8E93">ID: '+pcspEsc(m['ID'])+' · Medicaid: '+pcspEsc(m['Medicaid']||'')+' · '+pcspEsc(m['보험사']||'')+'</div></div>';
    }).join('');
  }).catch(function(){el.innerHTML='<div class="empty-msg">멤버 로드 실패 — Sheets 연결을 확인해주세요</div>';});
}

// ══════════════════════════════════════════════════════════════
// New form state / member + AUTH prefill
// ══════════════════════════════════════════════════════════════
function newPCSPRights(){
  return HCBS_RIGHTS.concat(OTHER_RIGHTS).map(function(x){
    return {right:x.right,group:x.group,modified:'',description:'',diagnosisCondition:'',priorInterventions:'',dataReviewMethod:'',reviewTimeframe:'',noHarmAssurance:''};
  });
}
function resetPCSPState(){
  _pcspDays=new Set();
  _pcspContacts=[{},{},{}];
  _pcspPlanningPeople=[];
  _pcspRisks=[];
  _pcspGoals=[];
  _pcspSadcActivities=[];
  _pcspCommunity=[];
  _pcspRights=newPCSPRights();
  _pcspAuthRecords=[];
  _pcspSelectedAuthId='';_pcspAuthSnapshot=null;_pcspMemberDefaults={};_pcspAuthLoadSerial++;
  _pcspSig=null;
}
function clearPCSPFormFields(){
  document.querySelectorAll('#pcsp-form-view input:not([type="hidden"]):not([type="button"]),#pcsp-form-view textarea,#pcsp-form-view select').forEach(function(el){
    if(el.type==='checkbox'||el.type==='radio')el.checked=false;
    else if(el.tagName==='SELECT')el.selectedIndex=0;
    else el.value='';
  });
}
function splitEnglishName(m){
  var last=String(m['LastName']||'').trim(), first=String(m['FirstName']||'').trim();
  if(last||first)return {last:last,first:first};
  var en=String(m['영문이름']||'').trim();
  if(en.indexOf(',')>=0){var p=en.split(',');return {last:(p[0]||'').trim(),first:p.slice(1).join(',').trim()};}
  var parts=en.split(/\s+/).filter(Boolean);return {last:parts.shift()||'',first:parts.join(' ')};
}
async function selectPCSPMember(m){
  if(_wfBusy||_wfPending){alert('진행 중인 저장을 먼저 완료해주세요.');return;}
  var list=document.getElementById('pcsp-list-view'),sel=document.getElementById('pcsp-member-select'),form=document.getElementById('pcsp-form-view');
  if(list)list.style.display='none';if(sel)sel.style.display='none';if(form)form.style.display='block';
  resetPCSPState();clearPCSPFormFields();
  _pcspMemberId=String(m['ID']||'');
  pcspSet('p-member-id',_pcspMemberId);pcspSet('pcsp-edit-id','');
  pcspSet('p-writer',_currentUser?(_currentUser.name||''):'');pcspSet('p-wdate',pcspToday());pcspSet('p-nextdate',pcspOneYearFromToday());pcspSet('p-type','Initial');pcspSet('p-sigdate',pcspToday());
  var nm=splitEnglishName(m);pcspSet('p-last',nm.last);pcspSet('p-first',nm.first);pcspSet('p-kr',m['한글이름']||'');
  pcspSet('p-medicaid',m['Medicaid']||'');pcspSet('p-ins',m['보험사']||'');pcspSet('p-phone',m['전화']||'');pcspSet('p-addr',m['주소']||'');pcspSet('p-pcpname',m['주치의']||'');pcspSet('p-dob',pcspDate(m['생년월일']));
  if(m['성별'])pcspSet('p-gender',String(m['성별']).toLowerCase().indexOf('m')===0?'Male':'Female');
  String(m['출석요일']||'').split(',').map(function(d){return d.trim();}).filter(Boolean).forEach(function(d){_pcspDays.add(d);});
  _pcspMemberDefaults={insurer:m['보험사']||'',careManager:'',diagCode:m['진단코드']||'',days:Array.from(_pcspDays)};
  pcspSet('p-diag-code',_pcspMemberDefaults.diagCode);
  pcspSet('p-review-prev','');
  applyPCSPCommonDefaults();
  initPCSPDynamicUI();pcspGoStep(0);
  wfBegin(null);
  await loadPCSPAuthForMember(_pcspMemberId,true);
}
function normalizeAuthRow(r){
  var days=[];['Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d){if(String(r['요일'+d]||'0')!=='0'&&String(r['요일'+d]||'')!=='')days.push(d);});
  return {
    id:String(r['ID']||''),memberId:String(r['멤버ID']||''),insurer:String(r['보험사']||''),authNo:String(r['Auth번호']||''),
    serviceType:String(r['서비스유형']||''),serviceCode:String(r['서비스코드']||''),startDate:pcspDate(r['시작일']),endDate:pcspDate(r['종료일']),
    totalQty:String(r['총수량']||''),qtyUnit:String(r['수량단위']||''),freqPerWeek:String(r['주당빈도']||''),days:days,status:String(r['상태']||'Active'),
    careManager:String(r['케어매니저']||''),pdfLink:String(r['PDF링크']||''),note:String(r['메모']||''),diagCode:String(r['진단코드']||'')
  };
}
function pcspAuthIsCurrent(a){
  var t=pcspToday();var st=String(a.status||'').toLowerCase();
  if(st==='hold'||st==='expired')return false;
  if(a.startDate&&a.startDate>t)return false;if(a.endDate&&a.endDate<t)return false;return true;
}
async function loadPCSPAuthForMember(memberId,applyBest){
  var serial=++_pcspAuthLoadSerial;
  var summary=document.getElementById('pcsp-auth-summary');if(summary)summary.innerHTML='<div style="color:#8E8E93">⏳ AUTH 정보 불러오는 중...</div>';
  try{
    var results=await Promise.all([apiGet({action:'readByMember',sheet:'auth',memberId:memberId}),apiGet({action:'read',sheet:'멤버'})]);
    if(serial!==_pcspAuthLoadSerial)return;
    var res=results[0];var master=(results[1].data||[]).find(function(m){return String(m['ID'])===String(memberId);});
    if(master)_pcspMemberDefaults={insurer:master['보험사']||'',careManager:'',diagCode:master['진단코드']||'',days:String(master['출석요일']||'').split(',').map(function(v){return v.trim();}).filter(Boolean)};
    _pcspAuthRecords=(res&&res.ok&&res.data?res.data:[]).map(normalizeAuthRow);
    _pcspAuthRecords.sort(function(a,b){
      var ac=pcspAuthIsCurrent(a)?1:0,bc=pcspAuthIsCurrent(b)?1:0;if(ac!==bc)return bc-ac;
      return String(b.startDate||'').localeCompare(String(a.startDate||''));
    });
    renderPCSPAuthSelector();
    if(applyBest){var best=_pcspAuthRecords.find(pcspAuthIsCurrent);if(best)applyPCSPAuth(best.id,true);}
  }catch(e){
    if(summary)summary.innerHTML='<div style="color:#FF3B30">AUTH 로드 실패: '+pcspEsc(e.message||e)+'</div>';
  }
}
function renderPCSPAuthSelector(){
  var sel=document.getElementById('p-auth-select');if(!sel)return;
  sel.innerHTML='<option value="">AUTH 없음 / 직접 입력</option>'+_pcspAuthRecords.map(function(a){
    var label=(pcspAuthIsCurrent(a)?'✅ ':'⚪ ')+(a.serviceType||'Service')+' · '+(a.authNo||'No #')+' · '+(a.startDate||'')+'~'+(a.endDate||'');
    return '<option value="'+pcspEsc(a.id)+'">'+pcspEsc(label)+'</option>';
  }).join('');
  if(_pcspSelectedAuthId)sel.value=_pcspSelectedAuthId;
  renderPCSPAuthSummary();
}
function getSelectedPCSPAuth(){return _pcspAuthSnapshot||_pcspAuthRecords.find(function(a){return a.id===_pcspSelectedAuthId;})||null;}
function applyPCSPAuth(id,overwrite){
  _pcspSelectedAuthId=id||'';_pcspAuthSnapshot=null;var a=getSelectedPCSPAuth();if(a)_pcspAuthSnapshot=pcspClone(a);
  var sel=document.getElementById('p-auth-select');if(sel)sel.value=_pcspSelectedAuthId;
  if(!a&&overwrite){pcspSet('p-ins',_pcspMemberDefaults.insurer||'');pcspSet('p-cm1name',_pcspMemberDefaults.careManager||'');pcspSet('p-diag-code',_pcspMemberDefaults.diagCode||'');_pcspDays=new Set(_pcspMemberDefaults.days||[]);initPCSPDayBtns();}
  if(a){
    if(overwrite||!gp('ins'))pcspSet('p-ins',a.insurer||_pcspMemberDefaults.insurer||'');
    if(overwrite||!gp('cm1name'))pcspSet('p-cm1name',a.careManager||_pcspMemberDefaults.careManager||'');
    if(overwrite||!gp('diag-code'))pcspSet('p-diag-code',a.diagCode||_pcspMemberDefaults.diagCode||'');
    _pcspDays=new Set(a.days&&a.days.length?a.days:(_pcspMemberDefaults.days||[]));initPCSPDayBtns();
  }
  renderPCSPAuthSummary();
}
function renderPCSPAuthSummary(){
  var el=document.getElementById('pcsp-auth-summary');if(!el)return;var a=getSelectedPCSPAuth();
  if(!a){el.innerHTML='<div style="font-size:11px;color:#8E8E93">연결된 AUTH를 선택하면 보험사, 케어매니저, 진단코드, 승인 요일이 자동 입력됩니다.</div>';return;}
  var active=pcspAuthIsCurrent(a)?'<span class="badge b-ok">현재 유효</span>':'<span class="badge b-warn">기간/상태 확인</span>';
  el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b>'+pcspEsc(a.insurer)+' · '+pcspEsc(a.serviceType)+'</b>'+active+'</div>'
    +'<div style="font-size:11px;margin-top:5px">Auth #: <b>'+pcspEsc(a.authNo||'')+'</b> · Code: '+pcspEsc(a.serviceCode||'')+' · '+pcspEsc(a.startDate||'')+' ~ '+pcspEsc(a.endDate||'')+'</div>'
    +'<div style="font-size:11px;color:#8E8E93;margin-top:3px">주 '+pcspEsc(a.freqPerWeek||'—')+'회 · 승인요일: '+pcspEsc((a.days||[]).join(', ')||'—')+' · Care Manager: '+pcspEsc(a.careManager||'—')+'</div>'
    +(a.diagCode?'<div style="font-size:11px;color:#8E8E93;margin-top:3px">Diagnosis code: '+pcspEsc(a.diagCode)+'</div>':'')
    +(a.pdfLink?'<button type="button" class="btn-sm" style="margin-top:7px" onclick="openSelectedAuthPDF()">📄 AUTH 원본 보기</button>':'');
}
function openSelectedAuthPDF(){var a=getSelectedPCSPAuth();if(a&&a.pdfLink)window.open(a.pdfLink,'_blank');else alert('AUTH PDF 링크가 없습니다.');}
function getPCSPAuthContext(){
  var a=getSelectedPCSPAuth();var active=_pcspAuthRecords.filter(pcspAuthIsCurrent);
  return {selected:a,active:active};
}

// ══════════════════════════════════════════════════════════════
// Dynamic input renderers
// ══════════════════════════════════════════════════════════════
function initPCSPDynamicUI(adl){
  initPCSPDayBtns();initPCSPAdlList(adl);renderPlanningPeople();renderPCSPContacts();renderPCSPRisks();renderPCSPGoals();renderSadcActivityChips();renderSelectedSadcActivities();renderPCSPCommunity();renderPCSPRights();updatePcspCapacityUI();pcspMarkConfirmFields();
}

function pcspToggleConditionalBlock(id,show){
  var el=document.getElementById(id);if(!el)return;
  el.style.display=show?'block':'none';
  el.querySelectorAll('textarea,input,button').forEach(function(x){x.disabled=!show;});
}
function updatePcspCapacityUI(){
  var comm=pcspVal('p-comm'),decision=pcspVal('p-decision'),alone=pcspVal('p-alone'),pain=pcspVal('p-pain');
  if(comm!=='No')pcspSet('p-comm-why','');
  if(decision!=='No')pcspSet('p-decision-why','');
  if(alone!=='No')pcspSet('p-alone-why','');
  if(pain!=='Yes')pcspSet('p-pain-desc','');
  pcspToggleConditionalBlock('pcsp-comm-detail',comm==='No');
  pcspToggleConditionalBlock('pcsp-decision-detail',decision==='No');
  pcspToggleConditionalBlock('pcsp-alone-detail',alone==='No');
  pcspToggleConditionalBlock('pcsp-pain-detail',pain==='Yes');
  pcspMarkConfirmFields();
}
function initPCSPDayBtns(){
  document.querySelectorAll('.pcsp-day-btn').forEach(function(btn){var d=btn.getAttribute('data-day');if(d)btn.classList.toggle('sel',_pcspDays.has(d));});
}
function togglePcspDay(btn,day){if(_pcspDays.has(day))_pcspDays.delete(day);else _pcspDays.add(day);initPCSPDayBtns();}
function initPCSPAdlList(adl){
  adl=adl||[];var el=document.getElementById('pcsp-adl-list');if(!el)return;
  el.innerHTML=PCSP_ADL_ITEMS.map(function(item,i){var x=adl.find(function(a){return a.item===item;})||{};
    return '<div class="pcsp-adl-row"><b>'+item+'</b><select class="m-select" id="padl-level-'+i+'"><option value="">선택</option>'+PCSP_ADL_LEVELS.map(function(v){return '<option'+(x.level===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select><input class="m-input" id="padl-device-'+i+'" value="'+pcspEsc(x.device||'')+'" placeholder="Device / none"></div>';
  }).join('');
}
function addPlanningPerson(){_pcspPlanningPeople.push({name:'',relationshipRole:'',participantSelected:true});renderPlanningPeople();}
function updatePlanningPerson(i,k,v){if(_pcspPlanningPeople[i])_pcspPlanningPeople[i][k]=v;}
function removePlanningPerson(i){_pcspPlanningPeople.splice(i,1);renderPlanningPeople();}
function renderPlanningPeople(){var el=document.getElementById('pcsp-planning-people');if(!el)return;
  el.innerHTML=_pcspPlanningPeople.length?_pcspPlanningPeople.map(function(x,i){return '<div class="pcsp-inline-card"><div class="modal-date-row"><div class="modal-input-wrap"><label>Name</label><input class="m-input" value="'+pcspEsc(x.name||'')+'" oninput="updatePlanningPerson('+i+',\'name\',this.value)"></div><div class="modal-input-wrap"><label>Relationship / role</label><input class="m-input" value="'+pcspEsc(x.relationshipRole||'')+'" oninput="updatePlanningPerson('+i+',\'relationshipRole\',this.value)"></div></div><button type="button" class="btn-danger" onclick="removePlanningPerson('+i+')">삭제</button></div>';}).join(''):'<div class="empty-msg" style="padding:8px">참여자가 선택한 사람이 있으면 추가하세요.</div>';
}
function ensureThreeContacts(){while(_pcspContacts.length<3)_pcspContacts.push({});}
function addPcspContact(){_pcspContacts.push({});renderPCSPContacts();}
function updatePcspContact(i,k,v){if(_pcspContacts[i])_pcspContacts[i][k]=v;}
function removePcspContact(i){if(_pcspContacts.length<=3){_pcspContacts[i]={};}else _pcspContacts.splice(i,1);renderPCSPContacts();}
function renderPCSPContacts(){ensureThreeContacts();var el=document.getElementById('pcsp-contacts-list');if(!el)return;
  el.innerHTML=_pcspContacts.map(function(c,i){return '<div class="pcsp-contact-item"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>Contact '+(i+1)+'</b>'+(i>=3?'<button class="btn-danger" onclick="removePcspContact('+i+')">삭제</button>':'')+'</div><div class="modal-date-row"><div class="modal-input-wrap"><label>Name</label><input class="m-input" value="'+pcspEsc(c.name||'')+'" oninput="updatePcspContact('+i+',\'name\',this.value)"></div><div class="modal-input-wrap"><label>Contact Type</label><input class="m-input" value="'+pcspEsc(c.type||'')+'" oninput="updatePcspContact('+i+',\'type\',this.value)" placeholder="Caregiver / Emergency / Guardian"></div></div><div class="modal-input-wrap"><label>Relationship to Participant</label><input class="m-input" value="'+pcspEsc(c.relationship||'')+'" oninput="updatePcspContact('+i+',\'relationship\',this.value)"></div><div class="modal-date-row"><div class="modal-input-wrap"><label>Phone</label><input class="m-input" value="'+pcspEsc(c.phone||'')+'" oninput="updatePcspContact('+i+',\'phone\',this.value)"></div><div class="modal-input-wrap"><label>Email</label><input class="m-input" value="'+pcspEsc(c.email||'')+'" oninput="updatePcspContact('+i+',\'email\',this.value)"></div></div></div>';}).join('');
}
function addPcspRisk(){_pcspRisks.push({risk:'',trigger:'',response:'',measure:'',safeguard:''});renderPCSPRisks();}
function updatePcspRisk(i,k,v){if(_pcspRisks[i])_pcspRisks[i][k]=v;}
function removePcspRisk(i){_pcspRisks.splice(i,1);renderPCSPRisks();}
function renderPCSPRisks(){var el=document.getElementById('pcsp-risks-list');if(!el)return;
  el.innerHTML=_pcspRisks.length?_pcspRisks.map(function(r,i){return '<div class="pcsp-risk-item"><div style="display:flex;justify-content:space-between;align-items:center"><b>⚠️ Risk '+(i+1)+'</b><div><button type="button" class="btn-sm" onclick="aiFillRiskItem('+i+')">✨ AI 문장</button> <button type="button" class="btn-danger" onclick="removePcspRisk('+i+')">삭제</button></div></div>'+pcspFieldTextareaHtml('Risk',r.risk,'updatePcspRisk('+i+',\'risk\',this.value)',2)+pcspFieldTextareaHtml('Trigger(s)',r.trigger,'updatePcspRisk('+i+',\'trigger\',this.value)',2)+pcspFieldTextareaHtml('Known Response(s)',r.response,'updatePcspRisk('+i+',\'response\',this.value)',2)+pcspFieldTextareaHtml('Measure(s) in Place',r.measure,'updatePcspRisk('+i+',\'measure\',this.value)',2)+pcspFieldTextareaHtml('Safeguard(s)',r.safeguard,'updatePcspRisk('+i+',\'safeguard\',this.value)',2)+'</div>';}).join(''):'<div class="empty-msg" style="padding:8px">알려진 위험이 없으면 비워둘 수 있습니다. PDF에는 빈 Risk 표가 유지됩니다.</div>';
}
function emptyGoal(){return {goal:'',outcome:'',targetDate:'',frequency:'',actions:'',activities:'',responsiblePerson:'',naturalSupport:'',paidSupport:'',staffResponsibility:'',progressReviewMethod:'',needsConfirmation:false};}
function addPcspGoal(){_pcspGoals.push(emptyGoal());renderPCSPGoals();}
function updatePcspGoal(i,k,v){if(_pcspGoals[i]){_pcspGoals[i][k]=v;if(k!=='needsConfirmation')_pcspGoals[i].needsConfirmation=false;}}
function removePcspGoal(i){_pcspGoals.splice(i,1);renderPCSPGoals();}
function confirmPcspGoal(i){if(_pcspGoals[i])_pcspGoals[i].needsConfirmation=false;renderPCSPGoals();}
function renderPCSPGoals(){var el=document.getElementById('pcsp-goals-list');if(!el)return;
  el.innerHTML=_pcspGoals.length?_pcspGoals.map(function(g,i){return '<div class="pcsp-goal-item">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div><b>🎯 Goal '+(i+1)+'</b>'+(g.needsConfirmation?'<span class="pcsp-confirm-badge">참여자 확인 필요</span>':'')+'</div><div><button type="button" class="btn-sm" onclick="aiDraftGoalItem('+i+')">✨ AI 작성</button> '+(g.needsConfirmation?'<button type="button" class="btn-sm" onclick="confirmPcspGoal('+i+')">✓ 확인완료</button> ':'')+'<button type="button" class="btn-danger" onclick="removePcspGoal('+i+')">삭제</button></div></div>'
    +pcspFieldTextareaHtml('Goal',g.goal,'updatePcspGoal('+i+',\'goal\',this.value)',2)
    +pcspFieldTextareaHtml('Outcome Criteria',g.outcome,'updatePcspGoal('+i+',\'outcome\',this.value)',2)
    +'<div class="modal-date-row"><div class="modal-input-wrap"><label>Target Date</label><input type="date" class="m-input" value="'+pcspEsc(g.targetDate||'')+'" onchange="updatePcspGoal('+i+',\'targetDate\',this.value)"></div><div class="modal-input-wrap"><label>Frequency</label><input class="m-input" value="'+pcspEsc(g.frequency||'')+'" oninput="updatePcspGoal('+i+',\'frequency\',this.value)" placeholder="e.g. 3x/week"></div></div>'
    +pcspFieldTextareaHtml('Actions and/or Steps',g.actions,'updatePcspGoal('+i+',\'actions\',this.value)',2)
    +pcspFieldTextareaHtml('Related Activity(s)',g.activities,'updatePcspGoal('+i+',\'activities\',this.value)',2)
    +pcspFieldTextareaHtml('Responsible Person / Support',g.responsiblePerson,'updatePcspGoal('+i+',\'responsiblePerson\',this.value)',2)
    +pcspFieldTextareaHtml('Natural Support',g.naturalSupport,'updatePcspGoal('+i+',\'naturalSupport\',this.value)',2)
    +pcspFieldTextareaHtml('Paid / SADC Support',g.paidSupport,'updatePcspGoal('+i+',\'paidSupport\',this.value)',2)
    +pcspFieldTextareaHtml('Staff Responsibility',g.staffResponsibility,'updatePcspGoal('+i+',\'staffResponsibility\',this.value)',2)
    +pcspFieldTextareaHtml('Progress / Review Method',g.progressReviewMethod,'updatePcspGoal('+i+',\'progressReviewMethod\',this.value)',2)
    +'</div>';}).join(''):'<div class="empty-msg" style="padding:8px">목표를 추가하거나 AI 목표 초안을 생성하세요.</div>';
}
function pcspFieldTextareaHtml(label,value,oninput,rows){return '<div class="modal-input-wrap" style="margin-top:7px"><label>'+pcspEsc(label)+'</label><textarea class="m-textarea'+(pcspHasConfirm(value)?' pcsp-confirm-needed':'')+'" rows="'+(rows||2)+'" style="width:100%" oninput="'+oninput+';pcspMarkConfirmFields()">'+pcspEsc(value||'')+'</textarea></div>';}

function sadcFind(activity){return _pcspSadcActivities.findIndex(function(x){return x.activity===activity;});}
function toggleSadcActivity(activity,category){var i=sadcFind(activity);if(i>=0)_pcspSadcActivities.splice(i,1);else _pcspSadcActivities.push({activity:activity,category:category||'Other',neededSupport:'Independent',supportDetails:''});renderSadcActivityChips();renderSelectedSadcActivities();}
function toggleDailySadcPreset(){var daily=['Breakfast','Lunch','Bingo'];var all=daily.every(function(x){return sadcFind(x)>=0;});daily.forEach(function(x){var i=sadcFind(x);if(all&&i>=0)_pcspSadcActivities.splice(i,1);else if(!all&&i<0){var preset=PCSP_SADC_PRESETS.find(function(p){return p.activity===x;});_pcspSadcActivities.push({activity:x,category:preset?preset.category:'Daily',neededSupport:'Independent',supportDetails:''});}});renderSadcActivityChips();renderSelectedSadcActivities();}
function addCustomSadcActivity(){var name=pcspVal('p-sadc-custom').trim();if(!name)return;if(sadcFind(name)<0)_pcspSadcActivities.push({activity:name,category:'Other',neededSupport:'Independent',supportDetails:''});pcspSet('p-sadc-custom','');renderSadcActivityChips();renderSelectedSadcActivities();}
function updateSadcActivity(i,k,v){if(_pcspSadcActivities[i])_pcspSadcActivities[i][k]=v;}
function removeSadcActivity(i){_pcspSadcActivities.splice(i,1);renderSadcActivityChips();renderSelectedSadcActivities();}
function renderSadcActivityChips(){var el=document.getElementById('pcsp-sadc-chips');if(!el)return;
  function group(cat){return PCSP_SADC_PRESETS.filter(function(p){return p.category===cat;}).map(function(p){var on=sadcFind(p.activity)>=0;return '<button type="button" class="pcsp-activity-chip'+(on?' sel':'')+'" onclick="toggleSadcActivity(\''+pcspEsc(p.activity)+'\',\''+cat+'\')">'+(on?'✓ ':'')+pcspEsc(p.activity)+'</button>';}).join('');}
  var dailyOn=['Breakfast','Lunch','Bingo'].every(function(x){return sadcFind(x)>=0;});
  el.innerHTML='<div style="margin-bottom:8px"><button type="button" class="pcsp-activity-chip pcsp-daily-chip'+(dailyOn?' sel':'')+'" onclick="toggleDailySadcPreset()">'+(dailyOn?'✓ ':'')+'일상활동 전체 (Breakfast + Lunch + Bingo)</button></div>'
    +'<div class="pcsp-chip-label">Daily</div><div class="pcsp-chip-wrap">'+group('Daily')+'</div>'
    +'<div class="pcsp-chip-label">Classes</div><div class="pcsp-chip-wrap">'+group('Class')+'</div>'
    +'<div class="pcsp-chip-label">Other Activities</div><div class="pcsp-chip-wrap">'+group('Other')+'</div>';
}
function renderSelectedSadcActivities(){var el=document.getElementById('pcsp-sadc-selected');if(!el)return;
  el.innerHTML=_pcspSadcActivities.length?_pcspSadcActivities.map(function(a,i){return '<div class="pcsp-inline-card"><div style="display:flex;justify-content:space-between"><b>✓ '+pcspEsc(a.activity)+'</b><button type="button" class="btn-danger" onclick="removeSadcActivity('+i+')">삭제</button></div><div class="modal-date-row" style="margin-top:6px"><div class="modal-input-wrap"><label>Needed Support</label><select class="m-select" onchange="updateSadcActivity('+i+',\'neededSupport\',this.value)">'+PCSP_SUPPORT_LEVELS.map(function(v){return '<option'+(a.neededSupport===v?' selected':'')+'>'+pcspEsc(v)+'</option>';}).join('')+'</select></div><div class="modal-input-wrap"><label>Support details (필요 시)</label><input class="m-input" value="'+pcspEsc(a.supportDetails||'')+'" oninput="updateSadcActivity('+i+',\'supportDetails\',this.value)" placeholder="e.g. large-print materials"></div></div></div>';}).join(''):'<div class="empty-msg" style="padding:8px">선택된 활동이 없습니다.</div>';
}
function addPcspCommunity(){_pcspCommunity.push({activity:'',details:'',location:'',schedule:'',materials:'',transportation:'',supports:''});renderPCSPCommunity();}
function updatePcspCommunity(i,k,v){if(_pcspCommunity[i])_pcspCommunity[i][k]=v;}
function removePcspCommunity(i){_pcspCommunity.splice(i,1);renderPCSPCommunity();}
function renderPCSPCommunity(){var el=document.getElementById('pcsp-community-list');if(!el)return;
  el.innerHTML=_pcspCommunity.length?_pcspCommunity.map(function(c,i){return '<div class="pcsp-comm-item"><div style="display:flex;justify-content:space-between;align-items:center"><b>🌍 Community Activity '+(i+1)+'</b><div><button type="button" class="btn-sm" onclick="aiFillCommunityItem('+i+')">✨ AI 문장</button> <button type="button" class="btn-danger" onclick="removePcspCommunity('+i+')">삭제</button></div></div><div class="modal-input-wrap"><label>Activity</label><input class="m-input" value="'+pcspEsc(c.activity||'')+'" oninput="updatePcspCommunity('+i+',\'activity\',this.value)"></div>'+pcspFieldTextareaHtml('Details',c.details,'updatePcspCommunity('+i+',\'details\',this.value)',2)+'<div class="modal-date-row"><div class="modal-input-wrap"><label>Location</label><input class="m-input" value="'+pcspEsc(c.location||'')+'" oninput="updatePcspCommunity('+i+',\'location\',this.value)"></div><div class="modal-input-wrap"><label>Day / Time / Frequency</label><input class="m-input" value="'+pcspEsc(c.schedule||'')+'" oninput="updatePcspCommunity('+i+',\'schedule\',this.value)"></div></div><div class="modal-date-row"><div class="modal-input-wrap"><label>Materials</label><input class="m-input" value="'+pcspEsc(c.materials||'')+'" oninput="updatePcspCommunity('+i+',\'materials\',this.value)"></div><div class="modal-input-wrap"><label>Transportation</label><input class="m-input" value="'+pcspEsc(c.transportation||'')+'" oninput="updatePcspCommunity('+i+',\'transportation\',this.value)"></div></div>'+pcspFieldTextareaHtml('Supports Needed',c.supports,'updatePcspCommunity('+i+',\'supports\',this.value)',2)+'</div>';}).join(''):'<div class="empty-msg" style="padding:8px">지역사회 활동이 없더라도 PDF에는 빈 기본 표가 유지됩니다.</div>';
}
function renderPCSPRights(){var el=document.getElementById('pcsp-rights-list');if(!el)return;
  var h='<div class="pcsp-chip-label">HCBS Final Rule Rights</div>';
  _pcspRights.forEach(function(r,i){if(r.group!=='HCBS')return;h+=pcspRightCard(r,i);});
  h+='<div class="pcsp-chip-label" style="margin-top:12px">Other Participant Rights</div>';
  _pcspRights.forEach(function(r,i){if(r.group!=='Other')return;h+=pcspRightCard(r,i);});el.innerHTML=h;
}
function pcspRightCard(r,i){var yes=r.modified==='Yes';return '<div class="pcsp-right-row"><div style="font-size:12px;font-weight:700">'+pcspEsc(r.right)+'</div><div class="modal-input-wrap" style="margin-top:5px"><label>Modification Needed?</label><select class="m-select" onchange="updatePcspRight('+i+',\'modified\',this.value);renderPCSPRights()"><option value=""'+(!r.modified?' selected':'')+'>선택</option><option'+(r.modified==='No'?' selected':'')+'>No</option><option'+(r.modified==='Yes'?' selected':'')+'>Yes</option></select></div>'+(yes?'<div class="pcsp-right-detail"><div style="display:flex;justify-content:flex-end"><button type="button" class="btn-sm" onclick="aiPolishRight('+i+')">✨ 입력내용 문장 정리</button></div>'+pcspFieldTextareaHtml('Description of modification',r.description,'updatePcspRight('+i+',\'description\',this.value)',2)+pcspFieldTextareaHtml('Related diagnosis / condition',r.diagnosisCondition,'updatePcspRight('+i+',\'diagnosisCondition\',this.value)',2)+pcspFieldTextareaHtml('Positive interventions/supports tried first',r.priorInterventions,'updatePcspRight('+i+',\'priorInterventions\',this.value)',2)+pcspFieldTextareaHtml('Data collection / review method',r.dataReviewMethod,'updatePcspRight('+i+',\'dataReviewMethod\',this.value)',2)+pcspFieldTextareaHtml('Review timeframe / limits',r.reviewTimeframe,'updatePcspRight('+i+',\'reviewTimeframe\',this.value)',2)+pcspFieldTextareaHtml('No-harm assurance',r.noHarmAssurance,'updatePcspRight('+i+',\'noHarmAssurance\',this.value)',2)+'</div>':'')+'</div>';}
function updatePcspRight(i,k,v){if(_pcspRights[i])_pcspRights[i][k]=v;}

// ══════════════════════════════════════════════════════════════
// Navigation / restore
// ══════════════════════════════════════════════════════════════
function pcspGoStep(s){
  s=Math.max(0,Math.min(PCSP_STEP_COUNT-1,s));_pcspStep=s;
  document.querySelectorAll('.pcsp-step').forEach(function(p){p.style.display='none';});var step=document.getElementById('pstep-'+s);if(step)step.style.display='block';
  for(var i=0;i<PCSP_STEP_COUNT;i++){var tab=document.getElementById('ptab-'+i);if(tab)tab.classList.toggle('active',i===s);}
  var label=document.getElementById('pcsp-step-label');if(label)label.textContent=(s+1)+' / '+PCSP_STEP_COUNT;
  var prog=document.getElementById('pcsp-progress');if(prog)prog.style.width=Math.round((s+1)/PCSP_STEP_COUNT*100)+'%';
  var nav=document.getElementById('pcsp-nav');if(nav)nav.style.display=s===PCSP_STEP_COUNT-1?'none':'flex';
  var prev=document.getElementById('pcsp-prev-btn');if(prev)prev.style.visibility=s===0?'hidden':'visible';
  if(s===3)setTimeout(initMedAutocomplete,80);
  if(s===4)setTimeout(updatePcspCapacityUI,0);
  if(s===PCSP_STEP_COUNT-1){buildPCSPSummary();setTimeout(initPCSPSignatureCanvas,100);}
  var content=document.querySelector('.content');if(content)content.scrollTop=0;pcspMarkConfirmFields();
}
function pcspNext(){if(_pcspStep<PCSP_STEP_COUNT-1)pcspGoStep(_pcspStep+1);}
function pcspPrev(){if(_pcspStep>0)pcspGoStep(_pcspStep-1);}
function initPCSPSignatureCanvas(){
  if(typeof initSigCanvas!=='function')return;
  initSigCanvas('pcsp-sig-canvas','pcsp-sig-empty',function(d){_pcspSig=d;});
  if(_pcspSig&&_pcspSig.indexOf('data:image')===0){
    var canvas=document.getElementById('pcsp-sig-canvas');if(!canvas)return;var img=new Image();img.onload=function(){var ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);var empty=document.getElementById('pcsp-sig-empty');if(empty)empty.style.display='none';};img.src=_pcspSig;
  }
}
function clearPCSPSig(){var c=document.getElementById('pcsp-sig-canvas');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);_pcspSig=null;var e=document.getElementById('pcsp-sig-empty');if(e)e.style.display='flex';}

function openPCSPForm(id){
  if(_wfBusy||_wfPending){alert('진행 중인 저장을 먼저 완료해주세요.');return;}
  var list=document.getElementById('pcsp-list-view'),sel=document.getElementById('pcsp-member-select'),form=document.getElementById('pcsp-form-view');if(list)list.style.display='none';if(sel)sel.style.display='none';if(form)form.style.display='block';
  resetPCSPState();clearPCSPFormFields();pcspSet('pcsp-edit-id',id||'');
  pcspSet('p-writer',_currentUser?(_currentUser.name||''):'');pcspSet('p-wdate',pcspToday());pcspSet('p-nextdate',pcspOneYearFromToday());pcspSet('p-type','Initial');pcspSet('p-sigdate',pcspToday());
  var p=id?PCSP_LIST.find(function(x){return x.id===id;}):null;
  wfBegin(p);
  if(p&&p.version===2){restorePCSPv2(p);}else{_pcspRights=newPCSPRights();applyPCSPCommonDefaults();initPCSPDynamicUI();pcspGoStep(0);}
}
function restorePCSPv2(p){
  _pcspMemberId=String(p.memberId||'');pcspSet('p-member-id',_pcspMemberId);
  ['writer','wdate','nextdate','type','nameLast','nameFirst','nameKr','dob','gender','genderid','addr','phone','email','lang','livewith','caresupp','livewithname','ins','medicaid','ins2','ins2id','cm1name','cm1phone','cm1email','cm2name','cm2phone','cm2email','pcpname','pcpphone','pcpemail','time','transport'].forEach(function(k){
    var idMap={nameLast:'last',nameFirst:'first',nameKr:'kr'};pcspSet('p-'+(idMap[k]||k),p[k]||'');
  });
  _pcspDays=new Set(p.days||[]);
  var plan=p.planning||{};pcspSet('p-planning-participated',plan.participantParticipated||'');pcspSet('p-planning-notes',plan.participationNotes||'');pcspSet('p-meeting-date',plan.meetingDate||'');pcspSet('p-meeting-time',plan.meetingTime||'');pcspSet('p-meeting-location',plan.meetingLocation||'');pcspSet('p-communication-method',plan.preferredCommunication||'');pcspSet('p-interpreter-needed',plan.interpreterNeeded||'');pcspSet('p-interpreter-language',plan.interpreterLanguage||'');pcspSet('p-accessibility',plan.accessibilityAccommodation||'');pcspSet('p-planning-concerns',plan.concerns||'');_pcspPlanningPeople=pcspClone(plan.chosenPeople||[]);
  _pcspContacts=pcspClone(p.contacts||[{},{},{}]).map(function(c){c=c||{};c.relationship=c.relationship||c.rel||'';return c;});ensureThreeContacts();
  var h=p.health||{};pcspSet('p-diag-code',h.diagnosisCode||'');pcspSet('p-diag',h.diagnoses||'');pcspSet('p-medassist',h.medicationAssistance||'');pcspSet('p-medlevel',h.medicationAssistanceLevel||'');pcspSet('p-meds',h.medications||'');pcspSet('p-allergy',h.allergies||'');pcspSet('p-diet',h.dietaryRestrictions||'');pcspSet('p-nutrition',h.nutritionPreferences||'');pcspSet('p-nutr-acc',h.nutritionAccommodated||'');pcspSet('p-nutr-how',h.nutritionAccommodationDetails||'');
  var fn=p.functional||{};pcspSet('p-comm',fn.communicateNeeds||'');pcspSet('p-comm-why',fn.communicateNeedsWhy||'');pcspSet('p-decision',fn.makeDecisions||'');pcspSet('p-decision-why',fn.makeDecisionsWhy||'');pcspSet('p-alone',fn.leftAlone||'');pcspSet('p-alone-why',fn.leftAloneWhy||'');pcspSet('p-pain',fn.painSensory||'');pcspSet('p-pain-desc',fn.painSensoryDetails||'');pcspSet('p-carepref',fn.personalCarePreference||'');pcspSet('p-carepref-acc',fn.personalCareAccommodated||'');pcspSet('p-carepref-desc',fn.personalCarePreferenceDetails||'');pcspSet('p-carepref-notified',fn.personalCareNotification||'');
  var pc=p.personCentered||{};Object.keys(pc).forEach(function(k){pcspSet('p-pc-'+k,pc[k]||'');});
  _pcspRisks=pcspClone(p.risks||[]);_pcspGoals=pcspClone(p.goals||[]);_pcspSadcActivities=pcspClone(p.sadcActivities||[]);_pcspCommunity=pcspClone(p.communityActivities||[]);_pcspRights=pcspClone(p.rights||newPCSPRights());
  var w=p.workVolunteer||{};pcspSet('p-work-interest',w.interest||'');pcspSet('p-work-opportunity',w.opportunity||'');pcspSet('p-work-frequency',w.frequencySchedule||'');pcspSet('p-work-support',w.supportNeededProvided||'');pcspSet('p-work-transport',w.transportation||'');pcspSet('p-work-unable',w.unableReason||'');
  var rv=p.review||{};pcspSet('p-review-prev',rv.previousDate||'');pcspSet('p-review-reason',rv.reason||'');pcspSet('p-review-changes',rv.changesSinceLast||'');
  _pcspSig=p.sig||null;pcspSet('p-sigdate',p.sigdate||pcspToday());
  _pcspAuthSnapshot=pcspClone((p.authContext&&p.authContext.selected)||null);
  _pcspAuthRecords=pcspClone((p.authContext&&p.authContext.records)||[]);_pcspSelectedAuthId=(p.authContext&&p.authContext.selectedId)||'';
  initPCSPDynamicUI(fn.adl||[]);renderPCSPAuthSelector();pcspGoStep(0);
  if(_pcspMemberId)loadPCSPAuthForMember(_pcspMemberId,false);
}

// ══════════════════════════════════════════════════════════════
// Collect / validate / save
// ══════════════════════════════════════════════════════════════
function collectPCSPAdl(){return PCSP_ADL_ITEMS.map(function(item,i){return {item:item,level:pcspVal('padl-level-'+i),device:pcspVal('padl-device-'+i)};});}
function collectPersonCentered(){
  var keys=['importantTo','importantFor','strengthsAbilities','interests','personalPreferences','servicePreferences','staffPreferences','settingPreferences','medicalNeeds','behavioralNeeds','socialNeeds','communityNeeds','transportationNeeds','housingPreferences','culturalNeeds','linguisticNeeds','communicationNeeds'];
  var o={};keys.forEach(function(k){o[k]=pcspVal('p-pc-'+k);});return o;
}
function collectPCSPEntry(){
  var selectedAuth=getSelectedPCSPAuth();
  var entry={
    version:2,id:pcspVal('pcsp-edit-id')||('pcsp_'+Date.now()),memberId:_pcspMemberId||gp('member-id'),
    writer:gp('writer'),wdate:gp('wdate'),nextdate:gp('nextdate'),type:gp('type'),
    nameLast:gp('last'),nameFirst:gp('first'),nameKr:gp('kr'),dob:gp('dob'),gender:gp('gender'),genderid:gp('genderid'),addr:gp('addr'),phone:gp('phone'),email:gp('email'),lang:gp('lang'),livewith:gp('livewith'),caresupp:gp('caresupp'),livewithname:gp('livewithname'),
    ins:gp('ins'),medicaid:gp('medicaid'),ins2:gp('ins2'),ins2id:gp('ins2id'),cm1name:gp('cm1name'),cm1phone:gp('cm1phone'),cm1email:gp('cm1email'),cm2name:gp('cm2name'),cm2phone:gp('cm2phone'),cm2email:gp('cm2email'),pcpname:gp('pcpname'),pcpphone:gp('pcpphone'),pcpemail:gp('pcpemail'),days:Array.from(_pcspDays),time:gp('time'),transport:gp('transport'),
    planning:{participantParticipated:pcspVal('p-planning-participated'),participationNotes:pcspVal('p-planning-notes'),meetingDate:pcspVal('p-meeting-date'),meetingTime:pcspVal('p-meeting-time'),meetingLocation:pcspVal('p-meeting-location'),preferredCommunication:pcspVal('p-communication-method'),interpreterNeeded:pcspVal('p-interpreter-needed'),interpreterLanguage:pcspVal('p-interpreter-language'),accessibilityAccommodation:pcspVal('p-accessibility'),concerns:pcspVal('p-planning-concerns'),chosenPeople:pcspClone(_pcspPlanningPeople)},
    contacts:_pcspContacts.map(function(c){var x=pcspClone(c||{});x.relationship=x.relationship||x.rel||'';x.rel=x.relationship;return x;}),
    health:{diagnosisCode:gp('diag-code'),diagnoses:gp('diag'),medicationAssistance:gp('medassist'),medicationAssistanceLevel:gp('medlevel'),medications:gp('meds'),allergies:gp('allergy'),dietaryRestrictions:gp('diet'),nutritionPreferences:gp('nutrition'),nutritionAccommodated:gp('nutr-acc'),nutritionAccommodationDetails:gp('nutr-how')},
    functional:{communicateNeeds:gp('comm'),communicateNeedsWhy:gp('comm-why'),makeDecisions:gp('decision'),makeDecisionsWhy:gp('decision-why'),leftAlone:gp('alone'),leftAloneWhy:gp('alone-why'),painSensory:gp('pain'),painSensoryDetails:gp('pain-desc'),adl:collectPCSPAdl(),personalCarePreference:gp('carepref'),personalCareAccommodated:gp('carepref-acc'),personalCarePreferenceDetails:gp('carepref-desc'),personalCareNotification:gp('carepref-notified')},
    personCentered:collectPersonCentered(),risks:pcspClone(_pcspRisks),goals:pcspClone(_pcspGoals),sadcActivities:pcspClone(_pcspSadcActivities),communityActivities:pcspClone(_pcspCommunity),
    workVolunteer:{interest:pcspVal('p-work-interest'),opportunity:pcspVal('p-work-opportunity'),frequencySchedule:pcspVal('p-work-frequency'),supportNeededProvided:pcspVal('p-work-support'),transportation:pcspVal('p-work-transport'),unableReason:pcspVal('p-work-unable')},
    rights:pcspClone(_pcspRights),review:{type:gp('type'),previousDate:pcspVal('p-review-prev'),nextReviewDue:gp('nextdate'),reason:pcspVal('p-review-reason'),changesSinceLast:pcspVal('p-review-changes')},
    authContext:{selectedId:_pcspSelectedAuthId,selected:selectedAuth?pcspClone(selectedAuth):null,records:pcspClone(_pcspAuthRecords.filter(pcspAuthIsCurrent))},
    sig:_pcspSig||'',sigdate:gp('sigdate'),signed:!!(_pcspSig&&_pcspSig.length>100),
    updatedAt:new Date().toISOString(),lastEditedBy:_currentUser?(_currentUser.name||''):'',lastEditedByEmail:_currentUser?(_currentUser.email||''):''
  };
  var old=PCSP_LIST.find(function(x){return x.id===entry.id;});entry.createdAt=(old&&old.createdAt)||new Date().toISOString();entry.createdBy=(old&&old.createdBy)||(_currentUser?(_currentUser.name||''):'');
  entry.diag=entry.health.diagnoses||entry.health.diagnosisCode||'';return entry;
}
function findUnconfirmedPaths(obj,path,out){out=out||[];path=path||'';if(obj==null)return out;if(typeof obj==='string'){if(pcspHasConfirm(obj))out.push(path||'field');return out;}if(Array.isArray(obj)){obj.forEach(function(v,i){findUnconfirmedPaths(v,path+'['+i+']',out);});return out;}if(typeof obj==='object'){Object.keys(obj).forEach(function(k){findUnconfirmedPaths(obj[k],path?(path+'.'+k):k,out);});}return out;}
function validatePCSPForSignature(e){var issues=[];
  if(!e.nameLast&&!e.nameFirst)issues.push('Participant name');if(!e.wdate)issues.push('PCSP completion date');if(!e.type)issues.push('PCSP type');
  if(!e.planning.participantParticipated)issues.push('Participant participated?');if(!e.planning.meetingDate)issues.push('Planning meeting date');if(!e.planning.meetingLocation)issues.push('Planning meeting location');
  if(!e.personCentered.importantTo)issues.push('What is important TO');if(!e.personCentered.importantFor)issues.push('What is important FOR');
  var goals=e.goals.filter(function(g){return g&&g.goal;});if(!goals.length)issues.push('At least one Goal');goals.forEach(function(g,i){if(!g.outcome)issues.push('Goal '+(i+1)+' Outcome Criteria');if(!g.staffResponsibility&&!g.responsiblePerson)issues.push('Goal '+(i+1)+' responsibility/support');if(g.needsConfirmation)issues.push('Goal '+(i+1)+' participant confirmation');});
  if(!e.nextdate)issues.push('Next Review Due');
  e.rights.forEach(function(r){if(r.modified==='Yes'){['description','diagnosisCondition','priorInterventions','dataReviewMethod','reviewTimeframe','noHarmAssurance'].forEach(function(k){if(!String(r[k]||'').trim())issues.push('Rights modification: '+r.right+' — '+k);});}});
  findUnconfirmedPaths(e,'',issues);
  if(!e.sigdate)issues.push('Signature date');return Array.from(new Set(issues));
}
function buildPCSPSummary(){var e=collectPCSPEntry();var issues=validatePCSPForSignature(e);var el=document.getElementById('pcsp-summary');if(!el)return;
  el.innerHTML='<div><b>Participant:</b> '+pcspEsc(e.nameLast+', '+e.nameFirst+(e.nameKr?' ('+e.nameKr+')':''))+'</div><div><b>PCSP:</b> '+pcspEsc(e.type)+' · '+pcspEsc(e.wdate)+' · Next review '+pcspEsc(e.nextdate)+'</div><div><b>AUTH:</b> '+pcspEsc((e.authContext.selected&&e.authContext.selected.authNo)||'not selected')+'</div><div><b>Goals:</b> '+e.goals.filter(function(g){return g.goal;}).length+' · <b>SADC activities:</b> '+e.sadcActivities.length+' · <b>Risks:</b> '+e.risks.length+'</div>'+(issues.length?'<div class="pcsp-validation-box"><b>⚠️ 최종 서명 전 확인 '+issues.length+'개</b><br>'+issues.map(function(x){return '• '+pcspEsc(x);}).join('<br>')+'</div>':'<div class="pcsp-valid-box">✅ 최종 저장 필수 항목 확인 완료</div>');
}
function pcspRequireSaved(res, label){
  if(!res || !res.ok || !res.data || res.data.success !== true)
    throw new Error(label+': '+((res&&res.data&&res.data.error)||(res&&res.error)||'서버에서 저장 완료를 확인하지 못했습니다.'));
  return res.data;
}
async function loadPCSPRecord(id, memberId, memberName){
  var res=await apiGet({action:'loadJSON',memberId:memberId,memberName:memberName||'',fileType:'PCSP',recordId:id});
  if(!res||!res.ok||!res.data||!res.data.found||!res.data.data)
    throw new Error((res&&res.data&&res.data.error)||'PCSP 전체 내용을 불러오지 못했습니다. 입력 내용은 변경하지 않았습니다.');
  var full=res.data.data;
  if(String(full.id||'')!==String(id))throw new Error('선택한 PCSP와 저장된 기록의 ID가 다릅니다. 다른 기록을 대신 열지 않습니다.');
  if(String(full.memberId||'')!==String(memberId))throw new Error('선택한 회원과 저장된 PCSP의 회원 ID가 다릅니다.');
  if(full.version!==2||!full.health||!full.functional||!full.planning)
    throw new Error('이 PCSP는 현재 v2 양식에서 바로 열 수 없습니다. 전체 v2 원본을 확인해주세요.');
  return full;
}
function cachePCSPRecord(full){
  var ix=PCSP_LIST.findIndex(function(x){return x.id===full.id;});
  if(ix>=0)PCSP_LIST[ix]=full;else PCSP_LIST.push(full);
}

async function signPCSP(id,memberId,memberName){
  try{
    var cached=PCSP_LIST.find(function(x){return x.id===id;});
    memberId=memberId||(cached&&cached.memberId)||'';
    memberName=memberName||(cached&&(cached.nameKr||cached.nameLast))||'';
    var full=await loadPCSPRecord(id,memberId,memberName);
    if(full.signed||full.status==='완료'){alert('서명된 기록입니다. 새 PCSP 생성 또는 PDF 재시도를 사용해주세요.');return;}
    cachePCSPRecord(full);openPCSPForm(full.id);pcspGoStep(PCSP_STEP_COUNT-1);
  }catch(e){alert('❌ 서명대기 PCSP를 불러오지 못했습니다: '+e.message);}
}
async function editPCSP(id){
  var p=PCSP_LIST.find(function(x){return x.id===id;});if(!p)return;
  if(p.status==='완료'){await wfRevise(id);return;}
  if(p.status==='서명완료·PDF대기'){await wfRetryPDF(id);return;}
  try{
    var full=await loadPCSPRecord(id,p.memberId||'',p.nameKr||p.nameLast||'');
    if(full.signed||full.status==='완료'){alert('서명된 기록입니다. 새 PCSP 생성 또는 PDF 재시도를 사용해주세요.');return;}
    cachePCSPRecord(full);openPCSPForm(full.id);
  }catch(e){alert('❌ PCSP를 불러오지 못했습니다: '+e.message);}
}
function deletePCSP(){alert('PCSP 이력은 보존합니다. 새 PCSP를 생성해주세요.');}
async function printPCSP(id){
  var existing=PCSP_LIST.find(function(p){return p.id===id;});if(existing&&existing.status==='완료')return openStoredPCSPPdf(id);
  var p=PCSP_LIST.find(function(x){return x.id===id;});if(!p){alert('PCSP를 찾을 수 없어요');return;}var memberId=p.memberId||'';var memberName=p.nameKr||p.nameLast||'Unknown';var w=window.open('','_blank');if(!w){alert('팝업을 허용해주세요');return;}w.document.write('<body style="font-family:Arial;padding:30px">PCSP PDF 생성 중...</body>');w.document.close();
  try{p=await loadPCSPRecord(id,memberId,memberName);var sig='';if(p.sig&&p.sig.indexOf('base64,')>=0)sig=p.sig.split('base64,')[1];var res=await apiCall({action:'fillPCSP',memberId:memberId,memberName:memberName,sigBase64:sig,pcsp:p,previewOnly:true});if(!res||!res.ok||!res.data||!res.data.success||!res.data.pdfBase64)throw new Error((res&&res.data&&res.data.error)||'PDF 생성 실패');var binary=atob(res.data.pdfBase64),bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);var url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));w.location.replace(url);setTimeout(function(){URL.revokeObjectURL(url);},120000);}catch(e){try{w.close();}catch(x){}alert('❌ PCSP 출력 실패: '+e.message);}
}

// ══════════════════════════════════════════════════════════════
// Medication helper
// ══════════════════════════════════════════════════════════════
var MED_LIBRARY=[
{name:'Metformin 500mg',reason:'Type 2 Diabetes'},{name:'Metformin 1000mg',reason:'Type 2 Diabetes'},{name:'Glipizide 5mg',reason:'Type 2 Diabetes'},{name:'Insulin (sliding scale)',reason:'Type 2 Diabetes'},
{name:'Lisinopril 10mg',reason:'Hypertension'},{name:'Amlodipine 5mg',reason:'Hypertension'},{name:'Losartan 50mg',reason:'Hypertension'},{name:'Atorvastatin 20mg',reason:'High Cholesterol'},
{name:'Aspirin 81mg',reason:'Cardiovascular Prevention'},{name:'Furosemide 20mg',reason:'Congestive Heart Failure / Edema'},{name:'Levothyroxine 50mcg',reason:'Hypothyroidism'},
{name:'Omeprazole 20mg',reason:'GERD / Acid Reflux'},{name:'Calcium + Vitamin D',reason:'Bone Health'},{name:'Donepezil 5mg',reason:'Dementia / Alzheimer\'s'},
{name:'Memantine 10mg',reason:'Dementia / Alzheimer\'s'},{name:'Sertraline 50mg',reason:'Depression / Anxiety'},{name:'Gabapentin 300mg',reason:'Neuropathic Pain'},{name:'Acetaminophen 500mg',reason:'Pain Management'}];
// 공용 약물 라이브러리 — Google Sheets medlib
var PCSP_MED_CUSTOM=[]; var _pcspMedLibLoaded=false;
async function loadMedLibraryFromSheets(){
  try{
    var res=await apiGet({action:'read',sheet:'medlib'});
    PCSP_MED_CUSTOM=(res&&res.ok&&res.data?res.data:[]).map(function(r){return {name:String(r['이름']||''),reason:String(r['이유']||'')};}).filter(function(m){return m.name;});
    _pcspMedLibLoaded=true;
  }catch(e){console.log('약물 라이브러리 로드 실패:',e);}
}
function getMedLibrary(){if(!_pcspMedLibLoaded)loadMedLibraryFromSheets();return MED_LIBRARY.concat(PCSP_MED_CUSTOM);}
async function saveMedToLibrary(name,reason){
  name=String(name||'').trim(); if(!name)return;
  var exists=getMedLibrary().find(function(m){return m.name.toLowerCase()===name.toLowerCase();}); if(exists)return;
  try{
    var id='MED_'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    var res=await apiCall({action:'upsert',sheet:'medlib',key:'ID',value:id,data:{'ID':id,'이름':name,'이유':reason||''}});
    if(!res||!res.ok||!res.data||res.data.success===false) throw new Error((res&&res.data&&res.data.error)||'약물 라이브러리 저장 실패');
    PCSP_MED_CUSTOM.push({name:name,reason:reason||''});
  }catch(e){console.log('약물 라이브러리 저장 실패:',e);}
}
function initMedAutocomplete(){var input=document.getElementById('p-med-input');if(!input||input._medInit)return;input._medInit=true;input.addEventListener('input',function(){var q=this.value.trim().toLowerCase(),d=document.getElementById('med-autocomplete');if(!q){d.style.display='none';return;}var matches=getMedLibrary().filter(function(m){return m.name.toLowerCase().includes(q);}).slice(0,8);d.innerHTML=matches.map(function(m){return '<div onclick="selectMed('+JSON.stringify(m.name).replace(/"/g,'&quot;')+','+JSON.stringify(m.reason).replace(/"/g,'&quot;')+')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #F2F2F7;font-size:12px"><b>'+pcspEsc(m.name)+'</b> <span style="color:#8E8E93">'+pcspEsc(m.reason)+'</span></div>';}).join('');d.style.display=matches.length?'block':'none';});input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addMedLine();}if(e.key==='Escape'){var d=document.getElementById('med-autocomplete');if(d)d.style.display='none';}});}
function selectMed(name,reason){pcspSet('p-med-input',name);pcspSet('p-med-reason',reason);var d=document.getElementById('med-autocomplete');if(d)d.style.display='none';}
function addMedLine(){var n=pcspVal('p-med-input').trim(),r=pcspVal('p-med-reason').trim(),ta=document.getElementById('p-meds');if(!n||!ta)return;var line=n+(r?' – '+r:'');ta.value=ta.value?ta.value+'\n'+line:line;pcspSet('p-med-input','');pcspSet('p-med-reason','');saveMedToLibrary(n,r);}

// ══════════════════════════════════════════════════════════════
// Claude drafting — facts first, no invented participant choices
// ══════════════════════════════════════════════════════════════
function pcspCleanAIText(v){return String(v==null?'':v).replace(/```(?:json)?/gi,'').replace(/```/g,'').replace(/^\s*#{1,6}\s*/gm,'').replace(/\*\*/g,'').trim();}
async function _callAIForJSON(promptText){var res=await apiCall({action:'aiPCSP',prompt:promptText});if(!res||!res.ok||!res.data||!res.data.success)throw new Error((res&&res.data&&res.data.error)||'AI 응답 오류');var clean=pcspCleanAIText(res.data.text||'');var firstObj=clean.indexOf('{'),lastObj=clean.lastIndexOf('}'),firstArr=clean.indexOf('['),lastArr=clean.lastIndexOf(']');var candidate=clean;if(firstObj>=0&&lastObj>firstObj)candidate=clean.slice(firstObj,lastObj+1);else if(firstArr>=0&&lastArr>firstArr)candidate=clean.slice(firstArr,lastArr+1);return JSON.parse(candidate);}
function pcspFactsForAI(){var e=collectPCSPEntry();return {
  participant:{name:[e.nameFirst,e.nameLast].filter(Boolean).join(' '),dob:e.dob,gender:e.gender,language:e.lang},
  auth:{selected:e.authContext.selected},diagnosisCode:e.health.diagnosisCode,diagnoses:e.health.diagnoses,medications:e.health.medications,allergies:e.health.allergies,diet:e.health.dietaryRestrictions,
  pcspDates:{completionDate:e.wdate,nextReviewDue:e.nextdate,type:e.type},schedule:{days:e.days,time:e.time,transportation:e.transport},
  capacity:e.functional,selectedSadcActivities:e.sadcActivities,communityActivities:e.communityActivities,planning:e.planning,workInterest:e.workVolunteer.interest,
  existingPersonCentered:e.personCentered
};}
function pcspAiBaseInstruction(){return 'Use ONLY the documented facts, selected options, selected AUTH snapshot, and staff-entered hints supplied. Existing narrative drafts are not independently confirmed facts; do not turn their assumptions into new factual claims. Never invent names, diagnoses, past events, risks, rights restrictions, religion, culture, housing choices, employment interests, or planning attendees. IMPORTANT: do not answer every field with CONFIRM WITH PARTICIPANT. For objective/support narrative, synthesize a useful draft from the documented facts and selected Yes/No/activity choices. Use CONFIRM WITH PARTICIPANT only when the field truly requires a personal choice or preference and there is no documented clue. If an objective field has no usable facts, return an empty string rather than inventing information. Write professional plain English, person-centered and concise.';}
function pcspAIFieldInstruction(targetId,label){
  var preferenceIds=['p-pc-importantTo','p-pc-personalPreferences','p-pc-servicePreferences','p-pc-staffPreferences','p-pc-settingPreferences','p-pc-housingPreferences','p-pc-culturalNeeds'];
  var isPreference=preferenceIds.indexOf(targetId)>=0;
  if(isPreference)return 'This field is participant-directed. Use documented activities, existing text, or staff-entered hints when they genuinely support the preference. If no such evidence exists, return exactly CONFIRM WITH PARTICIPANT. Do not infer a preference from diagnosis alone.';
  return 'This is an objective/support narrative field. Draft the most useful wording supported by available AUTH, health, functional, schedule, selected activity, and existing field facts. Do not use CONFIRM WITH PARTICIPANT merely because every detail is not known; omit unsupported specifics.';
}
async function aiDraftCapacityExplanation(targetId,label,btn){
  var el=document.getElementById(targetId);if(!el)return;
  var facts=pcspFactsForAI();
  var conditionMap={
    'p-comm-why':'The staff-confirmed selection is that the participant is NOT independently able to communicate needs.',
    'p-decision-why':'The staff-confirmed selection is that the participant is NOT independently able to make their own decisions.',
    'p-alone-why':'The staff-confirmed selection is that the participant CANNOT be left alone or unsupervised.',
    'p-pain-desc':'The staff-confirmed selection is that the participant DOES have pain and/or sensory needs.'
  };
  var condition=conditionMap[targetId]||'';
  if(btn){btn.disabled=true;btn.textContent='⏳ 작성 중...';}
  try{
    var aiPrompt=`Write the "${label}" field for a NYS SADC PCSP. ${pcspAiBaseInstruction()}
${pcspAIFieldInstruction(targetId,label)}
CONFIRMED CAPACITY FACT: ${condition}
FACTS:
${JSON.stringify(facts)}
Existing field text: ${el.value||''}
Write 1-3 concise sentences. The Yes/No selection itself is confirmed and may be used as the basis for general staff-support wording. Do not invent a specific cognitive diagnosis, symptom, trigger, injury, incident, or assistive device. Return ONLY the field text, no heading or markdown.`;
    var res=await apiCall({action:'aiPCSP',prompt:aiPrompt});
    if(!res||!res.ok||!res.data||!res.data.success)throw new Error((res&&res.data&&res.data.error)||'AI response error');
    var text=pcspCleanAIText(res.data.text);
    if(pcspHasConfirm(text))text='';
    el.value=text;pcspAutoHeight(el);pcspMarkConfirmFields();
    if(!text)alert('현재 확인된 정보만으로 구체적인 설명을 만들기 어렵습니다. 짧은 키워드를 직접 입력한 뒤 다시 AI 문장을 눌러주세요.');
  }catch(e){alert('❌ AI 작성 실패: '+e.message);}finally{if(btn){btn.disabled=false;btn.textContent='✨ AI 문장';}}
}
async function aiDraftWholePCSP(){
  if(!confirm('현재 입력된 사실과 AUTH 정보를 기반으로 문장형 항목과 Goal 초안을 Claude가 작성합니다.\n모르는 참여자 선호는 "CONFIRM WITH PARTICIPANT"로 남깁니다. 계속할까요?'))return;
  var btn=document.getElementById('pcsp-ai-all-btn');if(btn){btn.disabled=true;btn.textContent='⏳ 전체 초안 생성 중...';}
  try{var facts=pcspFactsForAI();var aiPrompt=`You are drafting a NYS SADC Person-Centered Service Plan. ${pcspAiBaseInstruction()}
FACTS:\n${JSON.stringify(facts)}\n\nReturn ONLY valid JSON with this exact shape:
{"personCentered":{"importantTo":"","importantFor":"","strengthsAbilities":"","interests":"","personalPreferences":"","servicePreferences":"","staffPreferences":"","settingPreferences":"","medicalNeeds":"","behavioralNeeds":"","socialNeeds":"","communityNeeds":"","transportationNeeds":"","housingPreferences":"","culturalNeeds":"","linguisticNeeds":"","communicationNeeds":""},"goals":[{"goal":"","outcome":"","targetDate":"","frequency":"","actions":"","activities":"","responsiblePerson":"","naturalSupport":"","paidSupport":"","staffResponsibility":"","progressReviewMethod":""}]}
For personCentered fields, maximize useful drafting from documented facts. Objective/support fields (importantFor, strengthsAbilities, medicalNeeds, behavioralNeeds, socialNeeds, communityNeeds, transportationNeeds, linguisticNeeds, communicationNeeds) should be drafted from available evidence and should be empty, not CONFIRM WITH PARTICIPANT, when there is no evidence. Interests may use selected SADC/community activities as documented participation. Only direct preference fields (importantTo, personalPreferences, servicePreferences, staffPreferences, settingPreferences, housingPreferences, culturalNeeds) should use CONFIRM WITH PARTICIPANT when genuinely unknown.\nCreate 2-3 reasonable draft goals only from documented health/support facts and selected activities. Goals are proposals and require participant confirmation. Never invent a natural support person; if none is documented, leave naturalSupport blank rather than filling every goal with CONFIRM WITH PARTICIPANT.`;
    var obj=await _callAIForJSON(aiPrompt);if(obj.personCentered){Object.keys(obj.personCentered).forEach(function(k){if(document.getElementById('p-pc-'+k))pcspSet('p-pc-'+k,obj.personCentered[k]);});}
    if(Array.isArray(obj.goals)){_pcspGoals=obj.goals.slice(0,3).map(function(g){var x=Object.assign(emptyGoal(),g||{});x.needsConfirmation=true;return x;});renderPCSPGoals();}
    pcspMarkConfirmFields();alert('✅ Claude 전체 초안을 만들었습니다.\n노란색 항목과 Goal은 참여자 확인 후 수정/확인해주세요.');
  }catch(e){alert('❌ AI 전체 초안 실패: '+e.message);}finally{if(btn){btn.disabled=false;btn.textContent='✨ Claude 전체 문장 초안';}}
}
async function aiDraftPersonCentered(){
  var btn=document.getElementById('pcsp-ai-pc-btn');if(btn){btn.disabled=true;btn.textContent='⏳ 작성 중...';}
  try{var facts=pcspFactsForAI();var aiPrompt=`You are drafting the person-centered narrative section of a NYS SADC PCSP. ${pcspAiBaseInstruction()}\nFACTS:\n${JSON.stringify(facts)}\n\nField rules:\n- importantFor, strengthsAbilities, medicalNeeds, behavioralNeeds, socialNeeds, communityNeeds, transportationNeeds, linguisticNeeds, communicationNeeds: create useful drafts from documented facts when possible. Do NOT default these to CONFIRM WITH PARTICIPANT. If no evidence exists, use an empty string.\n- interests: selected SADC/community activities may be used as documented participation/interests, without exaggerating preference.\n- importantTo, personalPreferences, servicePreferences, staffPreferences, settingPreferences, housingPreferences, culturalNeeds: these require a genuine participant preference. Use existing documented preference/activity/hint evidence when available; otherwise return CONFIRM WITH PARTICIPANT.\nReturn ONLY valid JSON with keys: importantTo, importantFor, strengthsAbilities, interests, personalPreferences, servicePreferences, staffPreferences, settingPreferences, medicalNeeds, behavioralNeeds, socialNeeds, communityNeeds, transportationNeeds, housingPreferences, culturalNeeds, linguisticNeeds, communicationNeeds.`;var obj=await _callAIForJSON(aiPrompt);Object.keys(obj||{}).forEach(function(k){if(document.getElementById('p-pc-'+k))pcspSet('p-pc-'+k,obj[k]);});pcspMarkConfirmFields();}
  catch(e){alert('❌ AI 작성 실패: '+e.message);}finally{if(btn){btn.disabled=false;btn.textContent='✨ 이 섹션 전체 작성';}}
}
async function aiDraftGoals(){
  try{var facts=pcspFactsForAI();var hint=window.prompt('참여자가 말한 목표 방향/키워드가 있으면 입력하세요.\n없으면 AUTH·건강정보·선택 활동을 바탕으로 제안 Goal을 만듭니다.','');if(hint===null)return;var aiPrompt=`Draft 2-3 SMART goal PROPOSALS for a NYS SADC PCSP. ${pcspAiBaseInstruction()}
FACTS:
${JSON.stringify(facts)}
Participant/staff goal hints: ${hint||'none provided'}
Use documented selected activities, functional support needs, health information, and SADC service context to create useful proposals. Do not fill goal fields with CONFIRM WITH PARTICIPANT. These goals are already flagged in the UI for participant review. If a natural support person is not documented, leave naturalSupport blank. If no specific responsible person is documented, use "SADC staff" where appropriate. Use the PCSP nextReviewDue as targetDate when it is a reasonable goal review date.
Return ONLY valid JSON: {"goals":[{"goal":"","outcome":"","targetDate":"YYYY-MM-DD or blank","frequency":"","actions":"","activities":"","responsiblePerson":"","naturalSupport":"","paidSupport":"","staffResponsibility":"","progressReviewMethod":""}]}. Do not claim that the participant chose or approved a goal unless the hint/facts support it.`;var obj=await _callAIForJSON(aiPrompt);if(Array.isArray(obj.goals)){obj.goals.forEach(function(g){var x=Object.assign(emptyGoal(),g||{});x.needsConfirmation=true;_pcspGoals.push(x);});renderPCSPGoals();}}
  catch(e){alert('❌ AI 목표 생성 실패: '+e.message);}
}
async function aiDraftGoalItem(i){var g=_pcspGoals[i];if(!g)return;try{var hint=window.prompt('이 Goal에 반영할 참여자/직원 확인 키워드가 있으면 입력하세요.','');if(hint===null)return;var aiPrompt=`Complete one SMART goal PROPOSAL in a NYS SADC PCSP. ${pcspAiBaseInstruction()}
FACTS:
${JSON.stringify(pcspFactsForAI())}
Current goal:
${JSON.stringify(g)}
Hint: ${hint||'none'}
Do not use CONFIRM WITH PARTICIPANT inside goal fields; the UI already flags this proposal for participant review. Leave unknown naturalSupport blank. Use SADC staff for responsible/staff support when appropriate and supported by the service context. Return ONLY one JSON object with keys goal,outcome,targetDate,frequency,actions,activities,responsiblePerson,naturalSupport,paidSupport,staffResponsibility,progressReviewMethod.`;var obj=await _callAIForJSON(aiPrompt);_pcspGoals[i]=Object.assign(emptyGoal(),g,obj||{});_pcspGoals[i].needsConfirmation=true;renderPCSPGoals();}catch(e){alert('❌ AI Goal 작성 실패: '+e.message);}}
async function aiDraftTextField(targetId,label){var el=document.getElementById(targetId);if(!el)return;var hint=window.prompt(label+'에 반영할 사실/키워드가 있으면 짧게 입력하세요.\n비워도 AUTH·멤버·선택 정보로 작성 가능한 항목은 Claude가 초안을 만듭니다.','');if(hint===null)return;try{var aiPrompt=`Write the "${label}" field for a NYS SADC PCSP. ${pcspAiBaseInstruction()}\n${pcspAIFieldInstruction(targetId,label)}\nFACTS:\n${JSON.stringify(pcspFactsForAI())}\nExisting field text: ${el.value||''}\nAdditional confirmed hint: ${hint||'none'}\nWrite 1-4 concise sentences. Return ONLY the field text, no heading, no markdown.`;var res=await apiCall({action:'aiPCSP',prompt:aiPrompt});if(!res||!res.ok||!res.data||!res.data.success)throw new Error((res&&res.data&&res.data.error)||'AI response error');el.value=pcspCleanAIText(res.data.text);pcspAutoHeight(el);pcspMarkConfirmFields();}catch(e){alert('❌ AI 작성 실패: '+e.message);}}
async function aiFillRiskItem(i){var r=_pcspRisks[i];if(!r)return;if(!String(r.risk||'').trim()){alert('먼저 실제로 확인된 Risk를 입력해주세요.');return;}try{var aiPrompt=`Draft supporting risk-management wording for a NYS SADC PCSP. ${pcspAiBaseInstruction()}
FACTS:
${JSON.stringify(pcspFactsForAI())}
Confirmed risk: ${r.risk}
Return ONLY JSON {"trigger":"","response":"","measure":"","safeguard":""}. Draft general safeguards/supports that logically follow from the confirmed risk and documented facts. Do not invent past events or specific triggers. If a trigger or prior response is not documented, leave that field blank instead of writing CONFIRM WITH PARTICIPANT.`;var obj=await _callAIForJSON(aiPrompt);Object.assign(r,obj||{});renderPCSPRisks();pcspMarkConfirmFields();}catch(e){alert('❌ AI 작성 실패: '+e.message);}}
async function aiFillCommunityItem(i){var c=_pcspCommunity[i];if(!c||!c.activity){alert('먼저 실제 관심 활동을 입력해주세요.');return;}try{var aiPrompt=`Draft wording for a confirmed community activity in a NYS SADC PCSP. ${pcspAiBaseInstruction()}
FACTS:
${JSON.stringify(pcspFactsForAI())}
Confirmed community activity: ${c.activity}
Existing: ${JSON.stringify(c)}
Return ONLY JSON {"details":"","location":"","schedule":"","materials":"","transportation":"","supports":""}. Write useful Details and Supports from the confirmed activity and documented functional facts. Do not invent a location, schedule, material, or transportation method; leave unknown factual fields blank rather than writing CONFIRM WITH PARTICIPANT.`;var obj=await _callAIForJSON(aiPrompt);Object.assign(c,obj||{});renderPCSPCommunity();pcspMarkConfirmFields();}catch(e){alert('❌ AI 작성 실패: '+e.message);}}
async function aiDraftWorkVolunteer(){var interest=pcspVal('p-work-interest');if(!interest){alert('먼저 Work/Volunteer 관심 여부를 선택해주세요.');return;}try{var hint=window.prompt('참여자가 말한 관심 분야/일정 등 확인된 사실이 있으면 입력하세요.','');if(hint===null)return;var aiPrompt=`Draft Work/Volunteer fields for a NYS SADC PCSP. ${pcspAiBaseInstruction()}\nFACTS:\n${JSON.stringify(pcspFactsForAI())}\nConfirmed interest selection: ${interest}\nConfirmed hint: ${hint||'none'}\nReturn ONLY JSON {"opportunity":"","frequencySchedule":"","supportNeededProvided":"","transportation":"","unableReason":""}. If interest is no, do not invent an opportunity. If na, focus on unableReason only.`;var o=await _callAIForJSON(aiPrompt);pcspSet('p-work-opportunity',o.opportunity||'');pcspSet('p-work-frequency',o.frequencySchedule||'');pcspSet('p-work-support',o.supportNeededProvided||'');pcspSet('p-work-transport',o.transportation||'');pcspSet('p-work-unable',o.unableReason||'');pcspMarkConfirmFields();}catch(e){alert('❌ AI 작성 실패: '+e.message);}}
async function aiPolishRight(i){var r=_pcspRights[i];if(!r||r.modified!=='Yes'){alert('Modification Needed = Yes인 권리에서만 사용할 수 있습니다.');return;}var missing=['description','diagnosisCondition','priorInterventions','dataReviewMethod','reviewTimeframe','noHarmAssurance'].filter(function(k){return !String(r[k]||'').trim();});if(missing.length){alert('AI가 사실을 만들지 않도록 먼저 6개 근거 항목을 간단히 입력해주세요.\n비어 있는 항목: '+missing.join(', '));return;}try{var aiPrompt=`Polish the following confirmed HCBS rights modification facts into concise professional English without changing meaning or inventing anything. Return ONLY JSON with the same keys.\nRight: ${r.right}\nFacts: ${JSON.stringify(r)}`;var o=await _callAIForJSON(aiPrompt);['description','diagnosisCondition','priorInterventions','dataReviewMethod','reviewTimeframe','noHarmAssurance'].forEach(function(k){if(o[k])r[k]=o[k];});renderPCSPRights();}catch(e){alert('❌ AI 문장 정리 실패: '+e.message);}}

// ══════════════════════════════════════════════════════════════
// Integration from member / assessment pages
// ══════════════════════════════════════════════════════════════
async function prefillPCSPFromMember(mid){
  try{
    var results=await Promise.all([apiGet({action:'read',sheet:'멤버'}),loadPCSPFromSheets()]);
    var member=results[0].data.find(function(m){return String(m['ID'])===String(mid);});
    if(!member)throw new Error('멤버 정보를 찾을 수 없습니다.');
    var matches=PCSP_LIST.filter(function(p){return [String(mid),String(member.Medicaid||'')].includes(String(p.memberId));});
    if(!matches.length)await selectPCSPMember(member);
    else if(matches.length===1)await editPCSP(matches[0].id);
    else showPCSPSelectPopup(matches,member);
  }catch(e){alert('❌ PCSP 열기 실패: '+e.message);}
}
function showPCSPSelectPopup(matches,member){matches.sort(function(a,b){return String(b.wdate||'').localeCompare(String(a.wdate||''));});window._pcspPopupMember=member;var h='<div style="padding:4px 0"><div style="font-size:13px;font-weight:700;margin-bottom:10px">'+pcspEsc(member&&member['한글이름']||'')+' — 저장된 PCSP '+matches.length+'건</div>';matches.forEach(function(p){h+='<div onclick="closeOv(\'ov-doc-viewer\');editPCSP('+pcspInlineString(p.id)+')" style="background:#F2F2F7;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer"><b>작성일: '+pcspEsc(p.wdate||'—')+'</b><div style="font-size:11px;color:#8E8E93">다음 검토: '+pcspEsc(p.nextdate||'—')+'</div></div>';});h+='<button onclick="closeOv(\'ov-doc-viewer\');selectPCSPMember(window._pcspPopupMember)" class="btn-full btn-primary">➕ 새 PCSP 작성</button></div>';var t=document.getElementById('doc-viewer-title'),b=document.getElementById('doc-viewer-body');if(t)t.textContent='PCSP 선택';if(b)b.innerHTML=h;openOv('ov-doc-viewer');}


var _pcspFactsForAIBase=pcspFactsForAI;
pcspFactsForAI=function(){
  var facts=_pcspFactsForAIBase();var e=collectPCSPEntry();
  facts['MEMBER FACTS']={memberId:e.memberId,nameLast:e.nameLast,nameFirst:e.nameFirst,dob:e.dob,health:e.health,functional:e.functional};
  facts['AUTH FACTS']=e.authContext.selected;
  facts['ASSESSMENT / NUTRITION SOURCES']=(_wfMeta[e.id]||{}).importSources||[];
  facts['SELECTED SADC ACTIVITIES']=e.sadcActivities;
  facts['STAFF / PARTICIPANT CONFIRMED FACTS']={planningParticipation:e.planning.participantParticipated,meetingDate:e.planning.meetingDate,meetingLocation:e.planning.meetingLocation,workInterest:e.workVolunteer.interest,rightsSelections:e.rights.map(function(r){return {right:r.right,modified:r.modified};})};
  facts['EXISTING NARRATIVE DRAFTS']={personCentered:e.personCentered,risks:e.risks,goals:e.goals,planning:e.planning,workVolunteer:e.workVolunteer};
  return facts;
};

// Central draft autosave and per-record revisions; no browser persistence.
var _wfSavedExit=false;
var _wfMeta={},_wfBusy=null,_wfPending=null,_wfFingerprint='',_wfPaused=false;
function wfNotice(text){var el=document.getElementById('pcsp-save-state');if(el)el.textContent=text;}
function wfFingerprint(p){var c=pcspClone(p);['updatedAt','createdAt','status','_revision','_operationId','pdfUrl','keepSignedJSON'].forEach(function(k){delete c[k];});return JSON.stringify(c);}
function wfEntry(){var id=pcspVal('pcsp-edit-id');if(!id){id='pcsp_'+crypto.randomUUID();pcspSet('pcsp-edit-id',id);}var p=collectPCSPEntry();var m=_wfMeta[id]||{};p.previousId=m.previousId||'';p.importSources=m.importSources||[];return p;}
async function wfPersist(mode){
  if(_wfBusy)await _wfBusy;
  if(_wfPaused)throw new Error('저장 충돌이 있습니다. 현재 내용을 확인한 뒤 최신 기록을 다시 열어주세요.');
  if(_wfPending)await wfSend();
  var p=wfEntry();if(!p.memberId)throw new Error('멤버를 선택해주세요.');
  if(mode==='finalize'){var issues=validatePCSPForSignature(p);if(issues.length)throw new Error(issues.join('\n'));}
  _wfPending={action:'savePCSPWorkflow',pcsp:p,mode:mode,expectedRevision:(_wfMeta[p.id]||{}).revision||0,operationId:crypto.randomUUID(),keepSignedJSON:document.getElementById('pcsp-keep-json').checked};
  return wfSend();
}
async function wfSend(){
  var request=_wfPending;
  _wfBusy=(async function(){
    wfNotice('서버 저장 중…');
    try{
      var result=pcspRequireSaved(await apiCall(request),'PCSP 저장');
      var p=request.pcsp;p._revision=result.revision;p.status=result.status;p.pdfUrl=result.url||p.pdfUrl;
      _wfMeta[p.id]={revision:result.revision,previousId:p.previousId,importSources:p.importSources};
      _wfFingerprint=wfFingerprint(p);_wfPending=null;cachePCSPRecord(p);
      wfNotice(result.status+' · 서버 저장 완료 '+new Date().toLocaleTimeString());
      return result;
    }catch(e){if(String(e.message).includes('CONFLICT'))_wfPaused=true;wfNotice('저장 실패 — 입력은 이 화면에 남아 있습니다. '+e.message);throw e;}
  })();
  try{return await _wfBusy;}finally{_wfBusy=null;}
}
async function savePCSPFull(){
  var btn=document.getElementById('pcsp-save-btn'),form=document.getElementById('pcsp-form-view');
  btn.disabled=true;
  try{
    var signed=!!(_pcspSig&&_pcspSig.length>100);if(signed)form.inert=true;
    var result=await wfPersist(signed?'finalize':'ready');
    alert(result.status==='완료'?'최종 PDF와 목록 저장 완료':'서명대기로 저장했습니다. 다른 기기에서 이어서 서명할 수 있습니다.');
    await loadPCSPFromSheets();_wfSavedExit=true;showPCSPList();
  }catch(e){alert('저장하지 못했습니다: '+e.message+'\n서명 후 실패했다면 목록의 PDF 재시도를 이용해주세요.');}
  finally{btn.disabled=false;form.inert=false;}
}
async function wfRetryPDF(id){
  try{var summary=PCSP_LIST.find(function(p){return p.id===id;}),p=await loadPCSPRecord(id,summary.memberId,summary.nameKr);var r=pcspRequireSaved(await apiCall({action:'savePCSPWorkflow',pcsp:p,mode:'finalize',expectedRevision:p._revision||0,operationId:crypto.randomUUID()}),'PDF 재시도');await loadPCSPFromSheets();await loadPCSPPdfLinks(true);alert('최종 PDF 저장 완료');}catch(e){alert(e.message);}
}
async function wfRevise(id){
  if(_wfBusy||_wfPending){alert('현재 저장을 먼저 완료해주세요.');return;}
  var old=PCSP_LIST.find(function(x){return x.id===id;});
  var reason=window.prompt('새 PCSP 작성 사유','전체 갱신');if(!reason)return;
  try{
    var rows=(await apiGet({action:'read',sheet:'멤버'})).data;
    var m=rows.find(function(x){return [String(x.ID),String(x.Medicaid||'')].includes(String(old.memberId));});if(!m)throw new Error('멤버 정보를 찾을 수 없습니다.');
    var res=await apiGet({action:'loadJSON',memberId:old.memberId,memberName:old.nameKr,fileType:'PCSP',recordId:id});
    if(res.data.found){
      var p=res.data.data;if(p.version!==2)throw new Error('v2 원본이 아닙니다.');
      p=pcspClone(p);p.id='pcsp_'+crypto.randomUUID();p.memberId=String(m.ID);p.previousId=id;p.sig='';p.sigdate='';p.signed=false;p.status='작성중';p.pdfUrl='';p._revision=0;delete p._operationId;
      p.type='Annual';p.wdate=pcspToday();p.nextdate=pcspOneYearFromToday();p.review=p.review||{};p.review.previousDate=old.wdate;p.review.reason=reason;p.review.nextReviewDue=p.nextdate;
      (p.goals||[]).forEach(function(g){if(g.goal)g.needsConfirmation=true;});p.planning.meetingDate=p.wdate;p.createdAt=new Date().toISOString();p.writer=_currentUser.name||'';
      cachePCSPRecord(p);openPCSPForm(p.id);await loadPCSPAuthForMember(p.memberId,true);
    }else{await selectPCSPMember(m);var p=wfEntry();p.previousId=id;_wfMeta[p.id]={revision:0,previousId:id};pcspSet('p-review-prev',old.wdate);pcspSet('p-review-reason',reason);wfNotice('이전 JSON이 없어 최신 멤버/AUTH 정보로 새 초안을 만들었습니다.');}
    var nm=splitEnglishName(m);pcspSet('p-last',nm.last);pcspSet('p-first',nm.first);pcspSet('p-kr',m['한글이름']||'');pcspSet('p-phone',m['전화']||'');pcspSet('p-addr',m['주소']||'');pcspSet('p-dob',pcspDate(m['생년월일']));pcspSet('p-pcpname',m['주치의']||'');pcspSet('p-medicaid',m.Medicaid||'');pcspSet('p-type','Annual');
    pcspSet('p-sigdate',pcspToday());
  }catch(e){alert('새 PCSP 생성 실패: '+e.message);}
}
async function wfImportSources(){
  var id=pcspVal('pcsp-edit-id'),mid=_pcspMemberId,name=gp('kr')||gp('last');if(!mid)return;
  try{
    var results=await Promise.all(['Assessment','Nutrition'].map(function(t){return apiGet({action:'loadJSON',memberId:mid,memberName:name,fileType:t});}));
    if(mid!==_pcspMemberId||id!==pcspVal('pcsp-edit-id'))return;
    var a=results[0].data.found?results[0].data.data:null,n=results[1].data.found?results[1].data.data:null;
    var sources=[];if(a)sources.push({type:'Assessment',date:a.date||'',savedAt:a.savedAt||'',adl:a.adl||{},healthComments:(a.formFields||{})['health-comments']||'',adlComments:(a.formFields||{})['adl-comments']||''});if(n)sources.push({type:'Nutrition',date:n.date||'',savedAt:n.savedAt||'',assessment:n.assessment||'',diet:n.diet||{},allergy:n.allergy||'',allergySpec:n.allergySpec||''});
    if(!sources.length){alert('저장된 Assessment/Nutrition이 없습니다.');return;}
    if(!confirm(sources.map(function(s){return s.type+' · 평가일 '+(s.date||'미기재');}).join('\n')+'\n빈 항목에만 적용합니다. 평가일과 내용을 확인해주세요.'))return;
    function empty(field,value){if(value&&!pcspVal(field))pcspSet(field,value);}
    if(a){empty('p-meds',(a.medications||[]).map(function(m){return [m.name,m.dose,m.reason].filter(Boolean).join(' — ');}).join('\n'));empty('p-pcpname',a.pcp);}
    if(n){empty('p-allergy',n.allergySpec);var diet=n.diet||{};empty('p-diet',[diet.na?'Sodium restricted':'',diet.lf?'Low fat':'',diet.carb?'Carbohydrate controlled':'',diet.renal?'Renal diet':'',diet.other?diet.otherText:''].filter(Boolean).join('; '));}
    var p=wfEntry();_wfMeta[p.id]=Object.assign({},_wfMeta[p.id],{importSources:sources});
    wfNotice(sources.map(function(s){return s.type+' '+s.date;}).join(' / ')+' · 빈 항목에 반영됨. 개인 선호·Capacity는 직접 확인해주세요.');
  }catch(e){alert('평가 정보 조회 실패: '+e.message);}
}
function wfBegin(p){_wfSavedExit=false;_wfPaused=false;_wfFingerprint='';if(p)_wfMeta[p.id]={revision:p._revision||0,previousId:p.previousId||'',importSources:p.importSources||[]};wfNotice('초안 변경은 20초 간격으로 서버에 저장됩니다.');document.getElementById('pcsp-keep-json').checked=true;}
setInterval(function(){
  var form=document.getElementById('pcsp-form-view');
  if(!form||form.style.display==='none'||!_pcspMemberId||_wfBusy||_wfPaused||(_pcspSig&&_pcspSig.length>100))return;
  var p=wfEntry();if(_wfFingerprint===wfFingerprint(p)&&!_wfPending)return;
  wfPersist('draft').catch(function(){});
},20000);
window.addEventListener('beforeunload',function(e){var f=document.getElementById('pcsp-form-view');if(_wfBusy||_wfPending||(f&&f.style.display!=='none'&&_pcspMemberId&&wfFingerprint(wfEntry())!==_wfFingerprint)){e.preventDefault();e.returnValue='';}});

var _wfRenewalMembers=[];
async function wfRenewalBoard(){
  var el=document.getElementById('pcsp-renewal-board');if(!el)return;
  try{
    var results=await Promise.all([apiGet({action:'read',sheet:'멤버'}),apiGet({action:'read',sheet:'settings'})]);
    _wfRenewalMembers=results[0].data.filter(function(m){return m.ID&&!/disenroll/i.test(m['상태']||'');});
    var setting=results[1].data.find(function(r){return r.Key==='PCSPRenewalStart';});var start=setting?String(setting.Value).slice(0,10):'';
    el.innerHTML='<h3>전체 PCSP 갱신 진행표</h3><p>기준일 이후 작성된 PCSP로 진행 상황을 확인합니다. 이전 완료본은 보존됩니다.</p><label>갱신 작업 기준일 <input type="date" id="wf-renewal-start" value="'+pcspEsc(start)+'"></label> <button class="btn-sm" onclick="wfSaveRenewalStart()">기준일 저장</button><div id="wf-renewal-count"></div><div id="wf-renewal-rows"></div>';
    var counts={};document.getElementById('wf-renewal-rows').innerHTML=_wfRenewalMembers.map(function(m,i){
      var list=PCSP_LIST.filter(function(p){return [String(m.ID),String(m.Medicaid||'')].includes(String(p.memberId));}).sort(function(a,b){return String(b.wdate).localeCompare(String(a.wdate))||String(b.id).localeCompare(String(a.id));});
      var current=list.find(function(p){return !start||p.wdate>=start;}),last=list[0],status=current?current.status:'미작성';counts[status]=(counts[status]||0)+1;
      var action=!current?'<button onclick="wfRenewalOpen('+i+','+(last?pcspInlineString(last.id):'null')+')">새 PCSP</button>':current.status==='완료'?'<button onclick="openStoredPCSPPdf('+pcspInlineString(current.id)+')">PDF 보기</button>':current.status==='서명완료·PDF대기'?'<button onclick="wfRetryPDF('+pcspInlineString(current.id)+')">PDF 재시도</button>':'<button onclick="editPCSP('+pcspInlineString(current.id)+')">이어서 작성 / 서명</button>';
      return '<div class="log-card"><b>'+pcspEsc(m['한글이름']||m['영문이름'])+'</b> · '+pcspEsc(status)+' '+action+'</div>';
    }).join('');document.getElementById('wf-renewal-count').textContent=Object.keys(counts).map(function(k){return k+' '+counts[k]+'명';}).join(' · ');
  }catch(e){el.textContent='갱신 진행표 조회 실패: '+e.message;}
}
async function wfSaveRenewalStart(){var date=document.getElementById('wf-renewal-start').value;if(!date)return;try{pcspRequireSaved(await apiCall({action:'upsert',sheet:'settings',key:'Key',value:'PCSPRenewalStart',data:{Key:'PCSPRenewalStart',Value:date,'수정시각':new Date().toISOString()}}),'기준일 저장');await wfRenewalBoard();}catch(e){alert(e.message);}}
function wfRenewalOpen(i,previous){if(previous)return wfRevise(previous);return selectPCSPMember(_wfRenewalMembers[i]);}
async function wfResolveConflict(){
  var current=wfEntry();
  try{
    var latest=await loadPCSPRecord(current.id,current.memberId,current.nameKr||current.nameLast);
    var changes=[];function compare(a,b,path){if(a&&b&&typeof a==='object'&&typeof b==='object'){Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).forEach(function(k){if(!['_revision','_operationId','updatedAt'].includes(k))compare(a[k],b[k],path+'.'+k);});}else if(JSON.stringify(a)!==JSON.stringify(b))changes.push(path+'\n현재 입력: '+String(a==null?'':a)+'\n서버 원본: '+String(b==null?'':b));}compare(current,latest,'PCSP');
    var d=document.createElement('dialog');d.style.cssText='max-width:700px;width:90%;max-height:80vh';var pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;max-height:55vh;overflow:auto';pre.textContent=changes.join('\n\n')||'내용 차이가 없습니다.';d.appendChild(pre);
    var reload=document.createElement('button');reload.textContent='현재 입력을 버리고 서버 원본 열기';reload.onclick=function(){if(!confirm('현재 화면의 미저장 변경을 버릴까요?'))return;_wfPending=null;_wfPaused=false;d.close();d.remove();if(latest.signed){cachePCSPRecord(latest);document.getElementById('pcsp-form-view').style.display='none';showPCSPList();}else{cachePCSPRecord(latest);openPCSPForm(latest.id);}};d.appendChild(reload);
    var close=document.createElement('button');close.textContent='현재 입력 유지';close.onclick=function(){d.close();d.remove();};d.appendChild(close);document.body.appendChild(d);d.showModal();
  }catch(e){alert(e.message);}
}
