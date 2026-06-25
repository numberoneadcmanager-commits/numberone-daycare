// ══════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — PCSP 관리
// apps/pcsp.js
// ══════════════════════════════════════════════════════════

var PCSP_LIST=JSON.parse(localStorage.getItem('op_pcsp_list')||'[]');
function loadPCSPFromSheets(){
  apiGet({action:'read',sheet:'PCSP'}).then(function(res){
    if(!res.ok||!res.data||!res.data.length)return;
    // Sheets에 있는 ID 목록
    var sheetIds = res.data.map(function(r){return String(r['ID']||'');}).filter(Boolean);
    // localStorage에 없는 항목은 Drive JSON에서 로드
    sheetIds.forEach(function(id){
      if(!PCSP_LIST.find(function(p){return p.id===id;})){
        var row = res.data.find(function(r){return String(r['ID'])===id;});
        if(row){
          // 기본 정보만 추가 (Drive JSON 로드는 별도)
          PCSP_LIST.push({
            id: id,
            nameLast: String(row['nameLast']||''),
            nameFirst: String(row['nameFirst']||''),
            nameKr: String(row['한글이름']||''),
            wdate: String(row['작성일']||''),
            nextdate: String(row['갱신예정일']||''),
            writer: String(row['작성자']||''),
            diag: String(row['진단']||''),
            status: String(row['상태']||'active'),
          });
        }
      }
    });
    savePCSPStorage();
    renderPCSPList();
  }).catch(function(){});
}

function savePCSPStorage(){localStorage.setItem('op_pcsp_list',JSON.stringify(PCSP_LIST));}
var _pcspStep=0,_pcspDays=new Set(),_pcspContacts=[],_pcspRisks=[],_pcspGoals=[],_pcspCommunity=[],_pcspFilter='all';
var PCSP_ADL_ITEMS=['Mobility','Transfers','Toileting','Continence','Eating'];
var PCSP_ADL_LEVELS=['Independent','Supervision Only','Minimal Hands-On','Moderate Hands-On','Total Hands-On'];
var PCSP_RIGHTS=[
  'Freedom of movement within the setting',
  'Access to food/snacks at any time',
  'Physical accessibility of all areas of the setting',
  'Visitors and visitor hours of choosing',
  'Privacy (phone calls, mail, personal space)',
  'Choice of roommate or those with whom they share a unit',
  'Ability to furnish and decorate their personal space',
  'Right to lock their own space',
  'Control their own schedules and activities',
  'Community access and participation in community life'
];

function setPCSPFilter(f,el){_pcspFilter=f;document.querySelectorAll('#panel-forms .fpill').forEach(function(p){p.classList.remove('active');});el.classList.add('active');renderPCSPList();}

function renderPCSPList(){
  var q=(document.getElementById('pcsp-search')||{}).value||'';
  var today=new Date().toISOString().slice(0,10);
  var list=PCSP_LIST.filter(function(p){
    var match=!q||(p.nameKr||'').includes(q)||(p.nameLast||'').includes(q);
    var due=p.nextdate&&p.nextdate<=today;
    return (_pcspFilter==='all'||(_pcspFilter==='due'&&due)||(_pcspFilter==='ok'&&!due))&&match;
  }).sort(function(a,b){return (a.nextdate||'9999')>(b.nextdate||'9999')?1:-1;});
  var html='';
  if(!list.length)html='<div class="empty-msg">PCSP 기록이 없어요</div>';
  list.forEach(function(p){
    var due=p.nextdate&&p.nextdate<=today;
    var badge=due?'<span class="badge b-warn">⚠️ 갱신필요</span>':'<span class="badge b-ok">✅ 유효</span>';
    html+='<div class="log-card"><div class="log-top"><div class="log-name">📄 '+(p.nameLast||'')+', '+(p.nameFirst||'')+' '+(p.nameKr?'('+p.nameKr+')':'')+'</div>'+badge+'</div>'
      +'<div style="font-size:11px;color:#8E8E93">작성: '+(p.wdate||'—')+' · 갱신예정: '+(p.nextdate||'—')+'</div>'
      +'<div style="font-size:11px;color:#3C3C43;margin-top:3px">'+(p.diag||'').slice(0,60)+'</div>'
      +'<div class="log-actions" style="margin-top:6px">'
      +'<button class="btn-sm" onclick="editPCSP(\''+p.id+'\')">✏️ 수정</button>'
      +'<button class="btn-sm" onclick="printPCSP(\''+p.id+'\')">🖨️ 출력</button>'
      +'<button class="btn-danger" onclick="deletePCSP(\''+p.id+'\')">삭제</button>'
      +'</div></div>';
  });
  var el=document.getElementById('pcsp-list');if(el)el.innerHTML=html;
}

function showPCSPList(){
  document.getElementById('pcsp-list-view').style.display='block';
  document.getElementById('pcsp-member-select').style.display='none';
  document.getElementById('pcsp-form-view').style.display='none';
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='none';
  renderPCSPList();
}

function openPCSPMemberSelect(){
  document.getElementById('pcsp-list-view').style.display='none';
  document.getElementById('pcsp-member-select').style.display='block';
  document.getElementById('pcsp-form-view').style.display='none';
  document.getElementById('pcsp-member-q').value='';
  renderPCSPMemberList();
}

function renderPCSPMemberList(){
  var q=(document.getElementById('pcsp-member-q').value||'').toLowerCase();
  var el=document.getElementById('pcsp-member-list');
  if(!el)return;

  // Sheets에서 멤버 로드 (GET)
  apiGet({action:'read',sheet:'멤버'}).then(function(res){
    var members=[];
    if(res.ok&&res.data){
      members=res.data.filter(function(r){
        return r['상태']!=='disenrolled' && r['ID'] &&
          (!q||(r['한글이름']||'').includes(q)||(r['영문이름']||'').toLowerCase().includes(q));
      });
    }
    if(!members.length){
      el.innerHTML='<div class="empty-msg">멤버를 찾을 수 없어요</div>';
      return;
    }
    el.innerHTML=members.map(function(m){
      return '<div class="log-card" style="cursor:pointer" onclick="selectPCSPMember('+JSON.stringify(m).replace(/"/g,'&quot;')+')">'
        +'<div class="log-top">'
        +'<div class="log-name">'+m['한글이름']+'</div>'
        +'<span style="font-size:11px;color:#8E8E93">'+m['영문이름']+'</span>'
        +'</div>'
        +'<div style="font-size:11px;color:#8E8E93">Medicaid: '+m['Medicaid']+'  ·  '+m['보험사']+'</div>'
        +'</div>';
    }).join('');
  }).catch(function(){
    el.innerHTML='<div class="empty-msg">멤버 로드 실패 — Sheets 연결을 확인해주세요</div>';
  });
}

function selectPCSPMember(m){
  document.getElementById('pcsp-member-select').style.display='none';
  document.getElementById('pcsp-form-view').style.display='block';
  _pcspDays=new Set();_pcspContacts=[];_pcspRisks=[];_pcspGoals=[];_pcspCommunity=[];
  document.getElementById('pcsp-edit-id').value='';

  // 기본값 설정
  var today=new Date().toISOString().slice(0,10);
  var nextYear=new Date();nextYear.setFullYear(nextYear.getFullYear()+1);
  document.getElementById('p-wdate').value=today;
  document.getElementById('p-sigdate').value=today;
  document.getElementById('p-nextdate').value=nextYear.toISOString().slice(0,10);
  document.getElementById('p-writer').value=_currentUser?(_currentUser.name||''):'';

  // 멤버 정보 자동 채우기
  var en=(m['영문이름']||'').trim();
  var parts=en.split(/[\s,]+/);
  document.getElementById('p-last').value=parts[0]||'';
  document.getElementById('p-first').value=parts.slice(1).join(' ')||'';
  document.getElementById('p-kr').value=m['한글이름']||'';
  document.getElementById('p-ins').value=m['보험사']||'Anthem MLTC';
  document.getElementById('p-medicaid').value=m['Medicaid']||'';
  document.getElementById('p-phone').value=m['전화']||'';
  document.getElementById('p-addr').value=m['주소']||'';
  document.getElementById('p-pcpname').value=m['주치의']||'';
  var dob=document.getElementById('p-dob');
  if(dob)dob.value=(m['생년월일']||'').slice(0,10);

  // 출석 요일 설정
  var days=(m['출석요일']||'').split(',').map(function(d){return d.trim();}).filter(Boolean);
  _pcspDays=new Set(days);

  // MLTC 번호를 ins2에
  if(m['MLTC']){
    document.getElementById('p-ins2id').value=m['MLTC']||'';
  }

  initPCSPDayBtns();
  initPCSPAdlList();
  initPCSPRightsList();
  renderPCSPContacts();
  renderPCSPRisks();
  renderPCSPGoals();
  renderPCSPCommunity();
  pcspGoStep(0);
}

function openPCSPForm(id){
  document.getElementById('pcsp-list-view').style.display='none';
  document.getElementById('pcsp-form-view').style.display='block';
  _pcspDays=new Set();_pcspContacts=[];_pcspRisks=[];_pcspGoals=[];_pcspCommunity=[];
  document.getElementById('pcsp-edit-id').value=id||'';
  var today=new Date().toISOString().slice(0,10);
  var nextYear=new Date();nextYear.setFullYear(nextYear.getFullYear()+1);
  document.getElementById('p-wdate').value=today;
  document.getElementById('p-sigdate').value=today;
  document.getElementById('p-nextdate').value=nextYear.toISOString().slice(0,10);
  document.getElementById('p-writer').value=_currentUser?(_currentUser.name||''):'';
  ['last','first','kr','genderid','addr','phone','email','lang','livewithname','ins','medicaid','ins2','ins2id','time','transport','cm1name','cm1phone','cm1email','cm2name','cm2phone','cm2email','pcpname','pcpphone','pcpemail','diag','meds','allergy','diet','nutrition','nutr-how','cap-desc','carepref-desc','prefs','strengths','needs','sadc-act','work-desc','sig'].forEach(function(k){var el=document.getElementById('p-'+k);if(el)el.value='';});
  if(id){
    var p=PCSP_LIST.find(function(x){return x.id===id;});
    if(p){
      var fields={last:'nameLast',first:'nameFirst',kr:'nameKr',writer:'writer',wdate:'wdate',nextdate:'nextdate',dob:'dob',genderid:'genderid',addr:'addr',phone:'phone',email:'email',lang:'lang',livewithname:'livewithname',ins:'ins',medicaid:'medicaid',ins2:'ins2',ins2id:'ins2id',time:'time',transport:'transport',cm1name:'cm1name',cm1phone:'cm1phone',cm1email:'cm1email',cm2name:'cm2name',cm2phone:'cm2phone',cm2email:'cm2email',pcpname:'pcpname',pcpphone:'pcpphone',pcpemail:'pcpemail',diag:'diag',meds:'meds',allergy:'allergy',diet:'diet',nutrition:'nutrition','nutr-how':'nutr_how','cap-desc':'cap_desc','carepref-desc':'carepref_desc',prefs:'prefs',strengths:'strengths',needs:'needs','sadc-act':'sadc_act','work-desc':'work_desc',sig:'sig',sigdate:'sigdate'};
      Object.keys(fields).forEach(function(k){var el=document.getElementById('p-'+k);if(el&&p[fields[k]])el.value=p[fields[k]];});
      ['gender','livewith','caresupp','medassist','medlevel','nutr-acc','comm','decision','alone','pain','carepref','carepref-acc','work'].forEach(function(k){var el=document.getElementById('p-'+k);var pk=k.replace(/-/g,'_');if(el&&p[pk])el.value=p[pk];});
      _pcspDays=new Set(p.days||[]);_pcspContacts=p.contacts||[];_pcspRisks=p.risks||[];_pcspGoals=p.goals||[];_pcspCommunity=p.community||[];
      if(p.adl){p.adl.forEach(function(a,i){var lv=document.getElementById('padl-level-'+i);var dv=document.getElementById('padl-device-'+i);if(lv)lv.value=a.level;if(dv)dv.value=a.device;});}
      if(p.rights){p.rights.forEach(function(r,i){var mod=document.getElementById('pright-mod-'+i);var desc=document.getElementById('pright-desc-'+i);if(mod)mod.value=r.modified;if(desc)desc.value=r.desc||'';toggleRightDetail(i);});}
    }
  }
  initPCSPDayBtns();initPCSPAdlList();initPCSPRightsList();
  renderPCSPContacts();renderPCSPRisks();renderPCSPGoals();renderPCSPCommunity();
  pcspGoStep(0);
}

function initPCSPDayBtns(){document.querySelectorAll('.pcsp-day-btn').forEach(function(btn){var m=btn.getAttribute('onclick').match(/'(\w+)'/);if(m)btn.classList.toggle('sel',_pcspDays.has(m[1]));});}
function togglePcspDay(btn,day){if(_pcspDays.has(day)){_pcspDays.delete(day);btn.classList.remove('sel');}else{_pcspDays.add(day);btn.classList.add('sel');}}

function initPCSPAdlList(){
  var html='<div style="display:grid;grid-template-columns:80px 1fr 1fr;gap:6px;margin-bottom:4px"><div style="font-size:10px;font-weight:700;color:#8E8E93">ADL</div><div style="font-size:10px;font-weight:700;color:#8E8E93">케어 수준</div><div style="font-size:10px;font-weight:700;color:#8E8E93">보조기기</div></div>';
  PCSP_ADL_ITEMS.forEach(function(item,i){html+='<div class="pcsp-adl-row"><div style="font-weight:700;font-size:11px">'+item+'</div><select class="m-select" id="padl-level-'+i+'" style="font-size:11px;padding:5px">'+PCSP_ADL_LEVELS.map(function(l){return '<option>'+l+'</option>';}).join('')+'</select><input class="m-input" id="padl-device-'+i+'" placeholder="none" style="font-size:11px;padding:5px"></div>';});
  var el=document.getElementById('pcsp-adl-list');if(el)el.innerHTML=html;
}

function initPCSPRightsList(){
  var html='';
  PCSP_RIGHTS.forEach(function(right,i){
    html+='<div class="pcsp-right-row">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<div style="font-size:12px;font-weight:600;flex:1">'+right+'</div>'
      +'<select class="m-select" id="pright-mod-'+i+'" style="width:80px;font-size:11px;padding:4px;margin-left:8px" onchange="toggleRightDetail('+i+')">'
      +'<option>No</option><option>Yes</option></select>'
      +'</div>'
      +'<div id="pright-detail-'+i+'" style="display:none;background:#FFF3E0;border-radius:8px;padding:10px;margin-bottom:4px">'
      +'<div style="font-size:11px;font-weight:700;color:#B35900;margin-bottom:6px">수정 내용 입력 (모두 필수)</div>'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">① Modification Description (수정 내용 설명)</div>'
      +'<textarea class="m-textarea" id="pright-desc-'+i+'" placeholder="예: Participant will have staff supervision when making food choices" style="width:100%;font-size:11px;min-height:50px;margin-bottom:8px"></textarea>'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">② Diagnosis/Condition (관련 진단/상태)</div>'
      +'<input class="m-input" id="pright-dx-'+i+'" placeholder="예: Type 2 Diabetes" style="font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">③ Positive Interventions Used Before Modification (이전 시도 방법)</div>'
      +'<input class="m-input" id="pright-prior-'+i+'" placeholder="예: Verbal reminders, motivational interviewing, visual cues" style="font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">④ Timeframe for Review (기간 및 재검토 일정)</div>'
      +'<input class="m-input" id="pright-time-'+i+'" placeholder="예: 6 months – 1/1/2026 to 7/1/2026" style="font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">⑤ Assurance of No Harm (무해성 확인)</div>'
      +'<textarea class="m-textarea" id="pright-harm-'+i+'" placeholder="예: Participant will continue to have access to healthy snacks at any time at the SADC" style="width:100%;font-size:11px;min-height:50px"></textarea>'
      +'</div>'
      +'</div>';
  });
  var el=document.getElementById('pcsp-rights-list');if(el)el.innerHTML=html;
}
function toggleRightDetail(i){var sel=document.getElementById('pright-mod-'+i);var detail=document.getElementById('pright-detail-'+i);if(detail)detail.style.display=sel&&sel.value==='Yes'?'block':'none';}

function renderPCSPContacts(){var el=document.getElementById('pcsp-contacts-list');if(!el)return;if(!_pcspContacts.length){el.innerHTML='<div class="empty-msg" style="padding:8px">연락처 없음</div>';return;}el.innerHTML=_pcspContacts.map(function(c,i){return '<div class="pcsp-contact-item"><div style="display:flex;justify-content:space-between"><b>'+c.name+'</b><button class="btn-danger" onclick="removePcspContact('+i+')">삭제</button></div><div style="font-size:11px;color:#8E8E93">'+c.type+' · '+c.rel+' · '+c.phone+'</div></div>';}).join('');}
function addPcspContact(){var name=prompt('이름:');if(!name)return;var type=prompt('유형 (Caregiver/Emergency Contact/Guardian):','Emergency Contact');var rel=prompt('관계:','');var phone=prompt('전화번호:','');var email=prompt('이메일 (없으면 none):','none');_pcspContacts.push({name:name,type:type||'Emergency Contact',rel:rel||'',phone:phone||'',email:email||'none'});renderPCSPContacts();}
function removePcspContact(i){_pcspContacts.splice(i,1);renderPCSPContacts();}

function renderPCSPRisks(){var el=document.getElementById('pcsp-risks-list');if(!el)return;if(!_pcspRisks.length){el.innerHTML='<div class="empty-msg" style="padding:8px">없으면 저장 시 "No known risks" 기록</div>';return;}el.innerHTML=_pcspRisks.map(function(r,i){return '<div class="pcsp-risk-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>⚠️ '+r.risk+'</b><button class="btn-danger" onclick="removePcspRisk('+i+')">삭제</button></div><div style="font-size:11px"><b>Trigger:</b> '+r.trigger+' | <b>Response:</b> '+r.response+'</div><div style="font-size:11px"><b>Measure:</b> '+r.measure+' | <b>Safeguard:</b> '+r.safeguard+'</div></div>';}).join('');}
function addPcspRisk(){var risk=prompt('위험 요소 (예: Fall Risk):');if(!risk)return;var trigger=prompt('Trigger:','');var response=prompt('Known Response:','');var measure=prompt('Measure in Place:','');var safeguard=prompt('Safeguard:','');_pcspRisks.push({risk:risk,trigger:trigger||'',response:response||'',measure:measure||'',safeguard:safeguard||''});renderPCSPRisks();}
function removePcspRisk(i){_pcspRisks.splice(i,1);renderPCSPRisks();}

function renderPCSPGoals(){var el=document.getElementById('pcsp-goals-list');if(!el)return;if(!_pcspGoals.length){el.innerHTML='<div class="empty-msg" style="padding:8px">목표 없음</div>';return;}el.innerHTML=_pcspGoals.map(function(g,i){return '<div class="pcsp-goal-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>🎯 Goal '+(i+1)+'</b><button class="btn-danger" onclick="removePcspGoal('+i+')">삭제</button></div><div style="font-size:11px"><b>Goal:</b> '+g.goal+'</div><div style="font-size:11px"><b>Outcome:</b> '+g.outcome+'</div><div style="font-size:11px"><b>Actions:</b> '+g.actions+'</div></div>';}).join('');}
function addPcspGoal(){var goal=prompt('Goal (목표):');if(!goal)return;var outcome=prompt('Outcome Criteria (달성 기준/날짜):','');var actions=prompt('Actions/Steps:','');var activities=prompt('Related Activities:','');_pcspGoals.push({goal:goal,outcome:outcome||'',actions:actions||'',activities:activities||''});renderPCSPGoals();}
function removePcspGoal(i){_pcspGoals.splice(i,1);renderPCSPGoals();}

function renderPCSPCommunity(){var el=document.getElementById('pcsp-community-list');if(!el)return;if(!_pcspCommunity.length){el.innerHTML='<div class="empty-msg" style="padding:8px">지역사회 활동 없음</div>';return;}el.innerHTML=_pcspCommunity.map(function(c,i){return '<div class="pcsp-comm-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>🌍 '+c.activity+'</b><button class="btn-danger" onclick="removePcspCommunity('+i+')">삭제</button></div><div style="font-size:11px">'+c.location+' · '+c.schedule+'</div><div style="font-size:11px">Transport: '+c.transport+' · Support: '+c.support+'</div></div>';}).join('');}
function addPcspCommunity(){var activity=prompt('활동명:');if(!activity)return;var location=prompt('장소:','');var schedule=prompt('일정:','');var transport=prompt('교통수단:','');var support=prompt('필요 지원:','none');_pcspCommunity.push({activity:activity,location:location||'',schedule:schedule||'',transport:transport||'',support:support||'none'});renderPCSPCommunity();}
function removePcspCommunity(i){_pcspCommunity.splice(i,1);renderPCSPCommunity();}

function pcspGoStep(s){
  _pcspStep=s;
  document.querySelectorAll('.pcsp-step').forEach(function(p){p.style.display='none';});
  var step=document.getElementById('pstep-'+s);if(step)step.style.display='block';
  for(var i=0;i<7;i++){var tab=document.getElementById('ptab-'+i);if(tab)tab.classList.toggle('active',i===s);}
  var label=document.getElementById('pcsp-step-label');if(label)label.textContent=(s+1)+' / 7';
  var prog=document.getElementById('pcsp-progress');if(prog)prog.style.width=Math.round((s+1)/7*100)+'%';
  var nav=document.getElementById('pcsp-nav');
  if(s===6){if(nav)nav.style.display='none';buildPCSPSummary();
    setTimeout(function(){
      initSigCanvas('pcsp-sig-canvas','pcsp-sig-empty',function(d){_pcspSig=d;});
    },100);
  }
  else{
    if(nav)nav.style.display='flex';
    var prevBtn=document.getElementById('pcsp-prev-btn');
    if(prevBtn)prevBtn.style.visibility=s===0?'hidden':'visible';
  }
  // Step 2 (건강정보) 진입 시 약 자동완성 초기화
  if(s===2){ setTimeout(initMedAutocomplete, 100); }
  document.querySelector('.content').scrollTop=0;
}
function pcspNext(){if(_pcspStep<6)pcspGoStep(_pcspStep+1);}
function pcspPrev(){if(_pcspStep>0)pcspGoStep(_pcspStep-1);}
function gp(id){var el=document.getElementById('p-'+id);return el?el.value:'';}

function buildPCSPSummary(){
  var days=Array.from(_pcspDays).join(', ')||'—';
  document.getElementById('pcsp-summary').innerHTML=
    '<div><b>참여자:</b> '+gp('last')+', '+gp('first')+(gp('kr')?' ('+gp('kr')+')':'')+'</div>'
    +'<div><b>작성:</b> '+gp('wdate')+' · '+gp('writer')+' · 갱신예정: '+gp('nextdate')+'</div>'
    +'<div><b>보험:</b> '+gp('ins')+' · Medicaid: '+gp('medicaid')+'</div>'
    +'<div><b>출석:</b> '+days+' '+gp('time')+'</div>'
    +'<div><b>진단:</b> '+(gp('diag')||'—').slice(0,80)+'</div>'
    +'<div><b>목표:</b> '+_pcspGoals.length+'개 | 위험: '+(_pcspRisks.length||'없음')+'</div>';
}

function clearPCSPSig(){
  clearSigCanvas('pcsp-sig-canvas','pcsp-sig-empty');
  _pcspSig = null;
}

var _pcspSig = null;

async function savePCSPFull(){
  var last=gp('last'),first=gp('first'),wdate=gp('wdate');
  if(!last&&!first){alert('참여자 이름을 입력해주세요');pcspGoStep(0);return;}
  if(!wdate){alert('작성일을 입력해주세요');pcspGoStep(0);return;}
  var adl=PCSP_ADL_ITEMS.map(function(item,i){var lv=document.getElementById('padl-level-'+i);var dv=document.getElementById('padl-device-'+i);return {item:item,level:lv?lv.value:'',device:dv?dv.value:''};});
  var rights=PCSP_RIGHTS.map(function(right,i){
    var mod=document.getElementById('pright-mod-'+i);
    var isYes=mod&&mod.value==='Yes';
    return {
      right:right,
      modified:mod?mod.value:'No',
      desc:isYes&&document.getElementById('pright-desc-'+i)?document.getElementById('pright-desc-'+i).value:'',
      dx:isYes&&document.getElementById('pright-dx-'+i)?document.getElementById('pright-dx-'+i).value:'',
      prior:isYes&&document.getElementById('pright-prior-'+i)?document.getElementById('pright-prior-'+i).value:'',
      timeframe:isYes&&document.getElementById('pright-time-'+i)?document.getElementById('pright-time-'+i).value:'',
      noHarm:isYes&&document.getElementById('pright-harm-'+i)?document.getElementById('pright-harm-'+i).value:''
    };
  });

  // 서명 캔버스에서 서명 이미지 가져오기
  var sigCanvas = document.getElementById('pcsp-sig-canvas');
  var sigData = _pcspSig || (sigCanvas ? sigCanvas.toDataURL('image/png') : null);

  var editId=document.getElementById('pcsp-edit-id').value;
  var entry={
    id:editId||('pcsp_'+Date.now()),
    writer:gp('writer'),wdate:wdate,nextdate:gp('nextdate'),type:gp('type'),
    nameLast:last,nameFirst:first,nameKr:gp('kr'),
    dob:gp('dob'),gender:gp('gender'),genderid:gp('genderid'),
    addr:gp('addr'),phone:gp('phone'),email:gp('email'),lang:gp('lang'),
    livewith:gp('livewith'),caresupp:gp('caresupp'),livewithname:gp('livewithname'),
    ins:gp('ins'),medicaid:gp('medicaid'),mltc:gp('mltc')||gp('medicaid'),
    ins2:gp('ins2'),ins2id:gp('ins2id'),
    days:Array.from(_pcspDays),time:gp('time'),transport:gp('transport'),
    cm1name:gp('cm1name'),cm1phone:gp('cm1phone'),cm1email:gp('cm1email'),
    cm2name:gp('cm2name'),cm2phone:gp('cm2phone'),cm2email:gp('cm2email'),
    pcpname:gp('pcpname'),pcpphone:gp('pcpphone'),pcpemail:gp('pcpemail'),
    contacts:_pcspContacts,
    diag:gp('diag'),medassist:gp('medassist'),medlevel:gp('medlevel'),meds:gp('meds'),
    allergy:gp('allergy'),diet:gp('diet'),nutrition:gp('nutrition'),
    nutr_acc:gp('nutr-acc'),nutr_how:gp('nutr-how'),
    comm:gp('comm'),decision:gp('decision'),decision_why:gp('decision-why'),
    alone:gp('alone'),pain:gp('pain'),cap_desc:gp('cap-desc'),
    adl:adl,
    carepref:gp('carepref'),carepref_acc:gp('carepref-acc'),
    carepref_desc:gp('carepref-desc'),carepref_notified:gp('carepref-notified'),
    risks:_pcspRisks.length?_pcspRisks:[{risk:'No known risks',trigger:'',response:'',measure:'',safeguard:''}],
    prefs:gp('prefs'),strengths:gp('strengths'),needs:gp('needs'),
    goals:_pcspGoals,sadc_act:gp('sadc-act'),community:_pcspCommunity,
    work:gp('work'),work_desc:gp('work-desc'),
    rights:rights,
    sig:sigData||'',sigdate:gp('p-sigdate'),
    signed:!!(sigData&&sigData.length>100),
    status:'active',updatedAt:new Date().toISOString()
  };

  if(editId){var idx=PCSP_LIST.findIndex(function(x){return x.id===editId;});if(idx>=0)PCSP_LIST[idx]=entry;else PCSP_LIST.push(entry);}
  else PCSP_LIST.push(entry);
  savePCSPStorage();

  var memberId = entry.medicaid||entry.id;
  var memberName = entry.nameKr||entry.nameLast;

  // 저장 버튼 비활성화
  var saveBtn = document.getElementById('pcsp-save-btn');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='⏳ 저장 중...'; }

  var hasSig = !!(sigData && sigData.length > 100);

  try {
    if (hasSig) {
      // ── 서명 있음: Word + PDF 최종 생성 ──────────────────────
      var sigCanvas2 = document.createElement('canvas');
      sigCanvas2.width = 250; sigCanvas2.height = 55;
      var sigCanvas = document.getElementById('pcsp-sig-canvas');
      sigCanvas2.getContext('2d').drawImage(sigCanvas, 0, 0, 250, 55);
      var sigBase64 = sigCanvas2.toDataURL('image/png').replace(/^data:image\/png;base64,/,'');

      var res = await apiCall({
        action: 'fillPCSP',
        memberId: memberId,
        memberName: memberName,
        sigBase64: sigBase64,
        pcsp: entry
      });

      if(!res||!res.ok||!res.data||!res.data.success){
        throw new Error(res&&res.data&&res.data.error ? res.data.error : '서버 오류');
      }

      await apiCall({
        action:'savePDF',
        memberId:memberId,
        memberName:memberName,
        fileType:'PCSP_Final',
        base64Data:res.data.pdfBase64,
        author:_currentUser?(_currentUser.name||''):''
      });

      // JSON도 최신 상태로 갱신
      await saveJSONtoDrive(memberId, memberName, 'PCSP', entry);

      apiCall({action:'upsert',sheet:'PCSP',key:'ID',value:entry.id,data:{
        'ID':entry.id,'작성일':entry.wdate,'멤버ID':memberId,'한글이름':entry.nameKr,
        '작성자':entry.writer,'갱신예정일':entry.nextdate,'진단':(entry.diag||'').slice(0,100),
        '목표1':(entry.goals[0]||{}).goal||'','목표2':(entry.goals[1]||{}).goal||'',
        '목표3':(entry.goals[2]||{}).goal||'','상태':'완료'
      }}).catch(function(){});

      alert('✅ PCSP 저장 완료!\n'+memberName+'\n📄 Word + PDF → Drive 저장됨');
    } else {
      // ── 서명 없음: JSON만 임시저장 (서명대기) ────────────────
      await saveJSONtoDrive(memberId, memberName, 'PCSP', entry);

      apiCall({action:'upsert',sheet:'PCSP',key:'ID',value:entry.id,data:{
        'ID':entry.id,'작성일':entry.wdate,'멤버ID':memberId,'한글이름':entry.nameKr,
        '작성자':entry.writer,'갱신예정일':entry.nextdate,'진단':(entry.diag||'').slice(0,100),
        '목표1':(entry.goals[0]||{}).goal||'','목표2':(entry.goals[1]||{}).goal||'',
        '목표3':(entry.goals[2]||{}).goal||'','상태':'서명대기'
      }}).catch(function(){});

      alert('💾 임시저장 완료!\n'+memberName+'\n✍️ 나중에 서명만 추가하면 완료돼요.');
    }
    showPCSPList();

  } catch(e){
    alert('❌ PCSP 저장 실패: '+e.message);
    console.error('PCSP save error:', e);
  } finally {
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 PCSP 저장 (Drive)'; }
  }
}

function editPCSP(id){
  var p=PCSP_LIST.find(function(x){return x.id===id;});
  if(!p){openPCSPForm(id);return;}
  // Drive JSON에서 전체 데이터 로드 시도
  var memberId=p.medicaid||p.id;
  var memberName=p.nameKr||p.nameLast;
  loadJSONfromDrive(memberId,memberName,'PCSP').then(function(res){
    if(res&&res.ok&&res.data&&res.data.found&&res.data.data){
      // Drive JSON이 있으면 localStorage 캐시 업데이트 후 폼 열기
      var full=res.data.data;
      var idx=PCSP_LIST.findIndex(function(x){return x.id===full.id;});
      if(idx>=0)PCSP_LIST[idx]=full;else PCSP_LIST.push(full);
      savePCSPStorage();
      openPCSPForm(full.id);
    }else{
      // fallback: localStorage
      openPCSPForm(id);
    }
  }).catch(function(){openPCSPForm(id);});
}
function deletePCSP(id){if(!confirm('삭제?'))return;PCSP_LIST=PCSP_LIST.filter(function(x){return x.id!==id;});savePCSPStorage();renderPCSPList();}

function printPCSP(id){
  var p=PCSP_LIST.find(function(x){return x.id===id;});
  if(!p){alert('PCSP를 찾을 수 없어요');return;}
  var days=(p.days||[]).join(', ')||'—';

  // ADL rows
  var adlRows=(p.adl||[{item:'Mobility'},{item:'Transfers'},{item:'Toileting'},{item:'Continence'},{item:'Eating'}]).map(function(a){
    return '<tr><td>'+a.item+'</td><td>'+(a.level||'—')+'</td><td>'+(a.device||'none')+'</td></tr>';
  }).join('');

  // Contacts
  var contactsHtml=(p.contacts||[]).map(function(c,i){
    return '<table style="margin-bottom:6px"><tr><th colspan="4" style="background:#e8e8e8;text-align:center">Contact '+(i+1)+'</th></tr>'
      +'<tr><th>Full Name</th><td>'+c.name+'</td><th>Contact Type</th><td>'+c.type+'</td></tr>'
      +'<tr><th>Relationship</th><td colspan="3">'+c.rel+'</td></tr>'
      +'<tr><th>Phone</th><td>'+c.phone+'</td><th>Email</th><td>'+(c.email||'N/A')+'</td></tr>'
      +'</table>';
  }).join('');

  // Goals
  var goalsHtml=(p.goals||[]).map(function(g){
    return '<table style="margin-bottom:8px"><tr><th style="width:180px">Goal</th><td>'+g.goal+'</td></tr>'
      +'<tr><th>Outcome Criteria</th><td>'+g.outcome+'</td></tr>'
      +'<tr><th>Actions and/or Steps</th><td>'+g.actions+'</td></tr>'
      +'<tr><th>Related Activity(s)</th><td>'+(g.related||'—')+'</td></tr>'
      +'</table>';
  }).join('');

  // SADC Activities
  var sadcActHtml='';
  if(p.sadc_activities&&p.sadc_activities.length){
    sadcActHtml='<table><tr><th>SADC Activity</th><th>Needed Supports</th></tr>'
      +p.sadc_activities.map(function(a){return '<tr><td>'+(a.activity||'')+'</td><td>'+(a.supports||'none')+'</td></tr>';}).join('')
      +'</table>';
  } else if(p.sadc_act){
    sadcActHtml='<table><tr><th>SADC Activity</th><th>Needed Supports</th></tr><tr><td>'+p.sadc_act+'</td><td>—</td></tr></table>';
  }

  // Community Activities
  var commActHtml='';
  if(p.comm_activities&&p.comm_activities.length){
    commActHtml=p.comm_activities.map(function(a){
      return '<table style="margin-bottom:6px"><tr><th colspan="2" style="text-align:center;background:#eee">'+a.activity+'</th></tr>'
        +'<tr><td colspan="2" style="font-weight:700;background:#f9f9f9">Details</td></tr>'
        +'<tr><th>Location of Activity</th><td>'+(a.location||'—')+'</td></tr>'
        +'<tr><th>Day, Time, & Frequency</th><td>'+(a.schedule||'—')+'</td></tr>'
        +'<tr><th>Materials Needed</th><td>'+(a.materials||'—')+'</td></tr>'
        +'<tr><th>Transportation Method</th><td>'+(a.transport||'—')+'</td></tr>'
        +'<tr><th>Supports Needed</th><td>'+(a.supports||'—')+'</td></tr>'
        +'</table>';
    }).join('');
  } else if(p.comm_act){
    commActHtml='<table><tr><th colspan="2" style="text-align:center">Community Activity</th></tr>'
      +'<tr><th>Activity</th><td>'+p.comm_act+'</td></tr></table>';
  }

  // Risks
  var risksHtml='';
  if(p.risks&&p.risks.length&&p.risks[0].risk){
    risksHtml=p.risks.map(function(r){
      return '<table style="margin-bottom:6px">'
        +'<tr><th style="width:160px">Risk</th><td>'+r.risk+'</td></tr>'
        +'<tr><th>Trigger(s)</th><td>'+r.trigger+'</td></tr>'
        +'<tr><th>Known Response(s)</th><td>'+r.response+'</td></tr>'
        +'<tr><th>Measure(s) in Place</th><td>'+r.measure+'</td></tr>'
        +'<tr><th>Safeguard(s)</th><td>'+r.safeguard+'</td></tr>'
        +'</table>';
    }).join('');
  }

  // HCBS Rights
  var hcbsRights=['Having access to food at any time.','Freedom and support to control their own schedules and activities.','Freedom to have visitors of their choosing at any time.'];
  var hcbsHtml='<table><tr><th>Participant Rights</th><th style="width:90px;text-align:center">Modification Needed?</th><th>Justification & Details</th></tr>'
    +hcbsRights.map(function(right){
      var r=(p.rights||[]).find(function(x){return x.right===right;})||{};
      return '<tr><td>'+right+'</td><td style="text-align:center">'+(r.modified==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'</td><td>'+(r.modified==='Yes'?(r.desc||''):'')+'</td></tr>';
    }).join('')+'</table>';

  // Other Rights
  var otherRights=['Freedom to control their own funds.','Independence to interact with whom they choose.'];
  var otherRightsHtml='<table><tr><th>Participant Rights</th><th style="width:90px;text-align:center">Modification Needed?</th><th>Justification & Details</th></tr>'
    +otherRights.map(function(right){
      var r=(p.other_rights||[]).find(function(x){return x.right===right;})||{};
      return '<tr><td>'+right+'</td><td style="text-align:center">'+(r.modified==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'</td><td>'+(r.modified==='Yes'?(r.desc||''):'')+'</td></tr>';
    }).join('')+'</table>';

  // Work/Volunteer
  var workHtml='<table>'
    +'<tr><td colspan="2" style="font-size:9px;font-style:italic">Please speak to the participant about their interests in obtaining/keeping a job and/or volunteering.</td></tr>'
    +'<tr><td colspan="2"><b>Is the participant interested in working or volunteering?</b><br>'
    +(p.work==='work'?'☑ Yes – Work Only  ☐ Yes – Volunteer Only  ☐ Yes – Work & Volunteer  ☐ No – Not Interested  ☐ N/A':
      p.work==='volunteer'?'☐ Yes – Work Only  ☑ Yes – Volunteer Only  ☐ Yes – Work & Volunteer  ☐ No – Not Interested  ☐ N/A':
      p.work==='both'?'☐ Yes – Work Only  ☐ Yes – Volunteer Only  ☑ Yes – Work & Volunteer  ☐ No – Not Interested  ☐ N/A':
      p.work==='na'?'☐ Yes – Work Only  ☐ Yes – Volunteer Only  ☐ Yes – Work & Volunteer  ☐ No – Not Interested  ☑ N/A':
      '☐ Yes – Work Only  ☐ Yes – Volunteer Only  ☐ Yes – Work & Volunteer  ☑ No – Not Interested  ☐ N/A')
    +'</td></tr>'
    +(p.work==='na'?'<tr><th>If N/A – please describe why unable:</th><td>'+p.work_desc+'</td></tr>':'')
    +(p.work&&p.work!=='no'&&p.work!=='na'?'<tr><th>If yes, describe opportunity:</th><td>'+p.work_desc+'</td></tr>':'')
    +'</table>';

  // Sig image
  var sigImg=p.sig&&p.sig.length>10?'<img src="'+p.sig+'" style="max-height:50px;max-width:100%">':'';

  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>PCSP - '+p.nameLast+', '+p.nameFirst+'</title>'
    +'<style>'
    +'*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:9.5px;margin:20px;color:#000;line-height:1.4}'
    +'h1{font-size:13px;text-align:center;font-weight:700;margin-bottom:2px}'
    +'.center{text-align:center;font-size:8.5px;color:#555;margin-bottom:10px}'
    +'.sec{width:100%;border-collapse:collapse;margin-bottom:2px}'
    +'.sec-hdr{background:#1a3a6b;color:#fff;font-weight:700;font-size:10px;padding:4px 8px}'
    +'.sub-hdr{background:#6b7db3;color:#fff;font-size:9px;padding:3px 8px}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:6px}'
    +'td,th{border:1px solid #999;padding:4px 7px;vertical-align:top}'
    +'th{background:#f0f0f0;font-weight:700;white-space:nowrap}'
    +'.sig-row{height:55px;vertical-align:bottom}'
    +'@media print{button{display:none}}'
    +'</style></head><body>'

    +'<h1>Number One Adult Daycare</h1>'
    +'<h1>Person Centered Service Plan (PCSP)</h1>'
    +'<p class="center">161-22 Northern Blvd 1FL, Flushing, NY 11358 · 718-799-0248</p>'

    // PCSP Completion
    +'<table class="sec"><tr><td class="sec-hdr" colspan="4">PCSP Completion Information</td></tr>'
    +'<tr><th>Person Completing PCSP</th><td>'+p.writer+'</td><th>Date of PCSP Completion</th><td>'+p.wdate+'</td></tr></table>'

    // Participant Info
    +'<table class="sec"><tr><td class="sec-hdr" colspan="4">SADC Participant Information</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">7.1 Participant Demographic and Contact Information</td></tr>'
    +'<tr><th>Full Name</th><td>'+p.nameLast+', '+p.nameFirst+'</td><th>Date of Birth</th><td>'+p.dob+'</td></tr>'
    +'<tr><th>Address</th><td colspan="3">'+p.addr+'</td></tr>'
    +'<tr><th>Phone</th><td>'+p.phone+'</td><th>Email</th><td>'+p.email+'</td></tr>'
    +'<tr><th>Preferred Language</th><td>'+p.lang+'</td><th>Gender</th><td>'+p.gender+'</td></tr>'
    +'<tr><th>Gender Identity</th><td>'+p.genderid+'</td><th></th><td></td></tr>'
    +'<tr><td colspan="4"><b>Does the participant live with someone?</b> '+(p.livewith==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'<br>'
    +(p.livewith==='Yes'?'<b>If yes, does that person support the participant\'s care?</b> '+(p.caresupp==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'<br>':'')
    +(p.livewithname?'<b>Name(s) and relationship:</b> '+p.livewithname:'')+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">7.2 Primary Insurance / MLTC Plan</td></tr>'
    +'<tr><th>MLTC Plan/Insurance Co.</th><td>'+p.ins+'</td><th>Medicaid/Insurance ID</th><td>'+p.mltc+' / '+p.medicaid+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">7.4 Primary Care Manager</td></tr>'
    +'<tr><th>Full Name</th><td>'+p.cm1name+'</td><th>Phone</th><td>'+p.cm1phone+'</td></tr>'
    +'<tr><th>Email</th><td colspan="3">'+p.cm1email+'</td></tr>'
    +(p.cm2name?'<tr><td class="sub-hdr" colspan="4">7.5 Secondary Care Manager</td></tr><tr><th>Full Name</th><td>'+p.cm2name+'</td><th>Phone</th><td>'+p.cm2phone+'</td></tr><tr><th>Email</th><td colspan="3">'+p.cm2email+'</td></tr>':'')
    +'<tr><td class="sub-hdr" colspan="4">7.6 Primary Care Physician</td></tr>'
    +'<tr><th>Full Name</th><td>'+p.pcpname+'</td><th>Phone</th><td>'+p.pcpphone+'</td></tr>'
    +'<tr><th>Email (if known)</th><td colspan="3">'+(p.pcpemail||'N/A')+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">7.7 SADC Attendance</td></tr>'
    +'<tr><th>Days of Attendance</th><td colspan="3">'+days+'</td></tr>'
    +'<tr><th>Time</th><td>'+p.time+'</td><th>Transportation</th><td>'+p.transport+'</td></tr>'
    +'</table>'

    // Contact Info
    +'<table class="sec"><tr><td class="sec-hdr" colspan="4">Contact Information</td></tr></table>'
    +(contactsHtml||'<table><tr><td>No contacts recorded</td></tr></table>')

    // Health Info
    +'<table class="sec"><tr><td class="sec-hdr" colspan="4">Participant Health Information</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">9.1 Pertinent Diagnoses</td></tr>'
    +'<tr><td colspan="4"><i>Physical, cognitive, mental health, and behavioral health conditions:</i><br>'+p.diag+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">9.2 Medications</td></tr>'
    +'<tr><td colspan="4"><b>Does the participant require assistance with medication while attending the SADC?</b> '+(p.medassist==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'<br>'+(p.medassist==='Yes'?'<b>If yes, what level of assistance is needed?</b> '+p.medlevel:'')+'</td></tr>'
    +'<tr><td colspan="4">'+p.meds+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">9.3 Other Health Information</td></tr>'
    +'<tr><th>Allergies (include severity & emergency response)</th><td colspan="3">'+p.allergy+'</td></tr>'
    +'<tr><th>Dietary Restrictions/Requirements (include reason)</th><td colspan="3">'+p.diet+'</td></tr>'
    +'<tr><th>Nutrition (Preferences/Special Diet)</th><td colspan="3">'+p.nutrition+'</td></tr>'
    +'<tr><td colspan="4"><b>If the participant has a nutrition preference or special diet, can the SADC accommodate this?</b> '+(p.nutr_acc==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'<br>'+(p.nutr_how?p.nutr_how:'')+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">9.4 Capacity for Independence</td></tr>'
    +'<tr><td colspan="4">'
    +'<b>Is the participant able to communicate their needs?</b> '+(p.comm==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+(p.comm==='No'&&p.cap_desc?'<br><i>If no: '+p.cap_desc+'</i>':'')+'<br>'
    +'<b>Does the participant appear able to make their own decisions?</b> '+(p.decision==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+(p.decision==='No'&&p.decision_why?'<br><i>If no: '+p.decision_why+'</i>':'')+'<br>'
    +'<b>Is the participant capable of being left alone and unsupervised?</b> '+(p.alone==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+(p.alone==='No'&&p.cap_desc?'<br><i>If no: '+p.cap_desc+'</i>':'')+'<br>'
    +'<b>Does the participant have any pain and/or sensory needs?</b> '+(p.pain==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+(p.pain==='Yes'&&p.cap_desc?'<br><i>If yes: '+p.cap_desc+'</i>':'')
    +'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="4">9.5 Functional Assessment / Staff Intervention</td></tr>'
    +'<tr><th>ADL</th><th>Level of Care</th><th colspan="2">Assistive Technology/Device</th></tr>'
    +adlRows
    +'<tr><td class="sub-hdr" colspan="4">9.6 Personal Care Assistance Preference</td></tr>'
    +'<tr><td colspan="4"><b>Does the participant have a preference of who provides their personal care assistance?</b> '+(p.carepref==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No')+'<br>'+(p.carepref==='Yes'&&p.carepref_desc?'<b>If yes:</b> '+p.carepref_desc+'<br>':'')+(p.carepref==='Yes'?'<b>Can the SADC accommodate this preference?</b> '+(p.carepref_acc==='Yes'?'☑ Yes  ☐ No':'☐ Yes  ☑ No'):'')+'</td></tr>'
    +'</table>'

    // Risk Management
    +'<table class="sec"><tr><td class="sec-hdr">Risk Management and Safeguards</td></tr></table>'
    +(risksHtml||'<table><tr><td>No known risks identified</td></tr></table>')

    // Preferences
    +'<table class="sec"><tr><td class="sec-hdr" colspan="2">Preferences, Strengths, and Needs</td></tr>'
    +'<tr><td class="sub-hdr" colspan="2">Preferences</td></tr>'
    +'<tr><td colspan="2">'+p.prefs+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="2">Strengths</td></tr>'
    +'<tr><td colspan="2">'+p.strengths+'</td></tr>'
    +'<tr><td class="sub-hdr" colspan="2">Needs</td></tr>'
    +'<tr><td colspan="2">'+p.needs+'</td></tr>'
    +'</table>'

    // Goals
    +'<table class="sec"><tr><td class="sec-hdr">Goals and Activities</td></tr></table>'
    +(goalsHtml||'<table><tr><td>No goals recorded</td></tr></table>')
    +'<table><tr><td class="sub-hdr" colspan="2">SADC Activities</td></tr></table>'
    +(sadcActHtml||'<table><tr><th>SADC Activity</th><th>Needed Supports</th></tr><tr><td>—</td><td>—</td></tr></table>')
    +'<table><tr><td class="sub-hdr">Community Integration Activities</td></tr></table>'
    +(commActHtml||'<table><tr><td>No community activities recorded</td></tr></table>')
    +'<table><tr><td class="sub-hdr">Work / Volunteer Interests</td></tr></table>'
    +workHtml

    // Rights Modifications
    +'<table class="sec"><tr><td class="sec-hdr">Modifications to Participant Rights</td></tr>'
    +'<tr><td class="sub-hdr">13.1 CMS HCBS Final Rule Rights</td></tr></table>'
    +hcbsHtml
    +'<table><tr><td class="sub-hdr">13.2 Other Participant Rights</td></tr></table>'
    +otherRightsHtml

    // Acknowledgement
    +'<table class="sec"><tr><td class="sec-hdr">PCSP Acknowledgement</td></tr>'
    +'<tr><td style="font-size:9px;font-style:italic;line-height:1.6">'
    +'I agree with what is written in this person centered service plan and acknowledge that I, the participant, lead the person centered planning process. '
    +'I understand my rights and/or I have someone I trust who can help me with them. This includes the right to integrate with and be a part of my community, '
    +'separate from the Social Adult Day Care and Social Adult Day Services I am choosing to receive. I acknowledge that I was offered options to integrate with '
    +'and be part of my community, and my decisions on goals or activities related to this are documented in this plan. I understand that my plan will be reviewed '
    +'regularly, that I can ask for it to be reviewed sooner, and whom to speak to about having my plan reviewed and updated. I agree to this plan being shared '
    +'with the people that need it to provide my services.'
    +'</td></tr>'
    +'<tr><th>Participant or Designated Representative Signature</th><th>Date</th></tr>'
    +'<tr><td class="sig-row">'+sigImg+'</td><td>'+p.sigdate+'</td></tr>'
    +'</table>'
    +'<button onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>'
    +'</body></html>';

  var w=window.open('','_blank');if(!w){alert('팝업을 허용해주세요');return;}
  w.document.write(html);w.document.close();setTimeout(function(){w.print();},800);
}
// ══════════════════════════════════════════════════════════════
// 약 자동완성
// ══════════════════════════════════════════════════════════════

var MED_LIBRARY = [
  {name:'Metformin 500mg', reason:'Type 2 Diabetes'},
  {name:'Metformin 1000mg', reason:'Type 2 Diabetes'},
  {name:'Glipizide 5mg', reason:'Type 2 Diabetes'},
  {name:'Insulin (sliding scale)', reason:'Type 2 Diabetes'},
  {name:'Lisinopril 10mg', reason:'Hypertension'},
  {name:'Lisinopril 20mg', reason:'Hypertension'},
  {name:'Amlodipine 5mg', reason:'Hypertension'},
  {name:'Losartan 50mg', reason:'Hypertension'},
  {name:'Atorvastatin 20mg', reason:'High Cholesterol'},
  {name:'Atorvastatin 40mg', reason:'High Cholesterol'},
  {name:'Simvastatin 20mg', reason:'High Cholesterol'},
  {name:'Aspirin 81mg', reason:'Cardiovascular Prevention'},
  {name:'Clopidogrel 75mg', reason:'Cardiovascular Prevention'},
  {name:'Warfarin', reason:'Atrial Fibrillation / Blood Clot Prevention'},
  {name:'Furosemide 20mg', reason:'Congestive Heart Failure / Edema'},
  {name:'Carvedilol 6.25mg', reason:'Congestive Heart Failure'},
  {name:'Levothyroxine 50mcg', reason:'Hypothyroidism'},
  {name:'Omeprazole 20mg', reason:'GERD / Acid Reflux'},
  {name:'Alendronate 70mg', reason:'Osteoporosis'},
  {name:'Calcium + Vitamin D', reason:'Bone Health'},
  {name:'Vitamin D3 1000IU', reason:'Vitamin D Deficiency'},
  {name:'Donepezil 5mg', reason:'Dementia / Alzheimer\'s'},
  {name:'Memantine 10mg', reason:'Dementia / Alzheimer\'s'},
  {name:'Sertraline 50mg', reason:'Depression / Anxiety'},
  {name:'Gabapentin 300mg', reason:'Neuropathic Pain'},
  {name:'Acetaminophen 500mg', reason:'Pain Management'},
  {name:'Albuterol inhaler', reason:'Asthma / COPD'},
];

// localStorage에서 커스텀 약 로드
function getMedLibrary(){
  var custom = [];
  try{ custom = JSON.parse(localStorage.getItem('med_custom')||'[]'); }catch(e){}
  return MED_LIBRARY.concat(custom);
}

function saveMedToLibrary(name, reason){
  var custom = [];
  try{ custom = JSON.parse(localStorage.getItem('med_custom')||'[]'); }catch(e){}
  var exists = custom.find(function(m){ return m.name.toLowerCase()===name.toLowerCase(); });
  if(!exists && !MED_LIBRARY.find(function(m){ return m.name.toLowerCase()===name.toLowerCase(); })){
    custom.push({name:name, reason:reason||''});
    localStorage.setItem('med_custom', JSON.stringify(custom));
  }
}

function initMedAutocomplete(){
  var input = document.getElementById('p-med-input');
  if(!input || input._medInit) return;
  input._medInit = true;

  input.addEventListener('input', function(){
    var q = this.value.trim().toLowerCase();
    var dropdown = document.getElementById('med-autocomplete');
    if(!q || q.length < 1){ dropdown.style.display='none'; return; }

    var matches = getMedLibrary().filter(function(m){
      return m.name.toLowerCase().startsWith(q) || m.name.toLowerCase().includes(q);
    }).slice(0, 8);

    if(!matches.length){ dropdown.style.display='none'; return; }

    dropdown.innerHTML = matches.map(function(m){
      var safeName = m.name.replace(/'/g,"\\'");
      var safeReason = m.reason.replace(/'/g,"\\'");
      return '<div onclick="selectMed(\''+safeName+'\',\''+safeReason+'\')" '
        +'style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #F2F2F7;font-size:12px" '
        +'onmouseover="this.style.background=\'#F2F2F7\'" onmouseout="this.style.background=\'#fff\'">'
        +'<span style="font-weight:600">'+m.name+'</span>'
        +'<span style="color:#8E8E93;margin-left:8px">'+m.reason+'</span>'
        +'</div>';
    }).join('');
    dropdown.style.display='block';
  });

  input.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ document.getElementById('med-autocomplete').style.display='none'; }
    if(e.key==='Enter'){ e.preventDefault(); addMedLine(); }
  });

  document.addEventListener('click', function(e){
    if(!e.target.closest('#p-med-input') && !e.target.closest('#med-autocomplete')){
      var d = document.getElementById('med-autocomplete');
      if(d) d.style.display='none';
    }
  });
}

function selectMed(name, reason){
  var ni = document.getElementById('p-med-input');
  var ri = document.getElementById('p-med-reason');
  if(ni) ni.value = name;
  if(ri) ri.value = reason || '';
  var d = document.getElementById('med-autocomplete');
  if(d) d.style.display='none';
  if(ri) ri.focus();
}

function addMedLine(){
  var ni = document.getElementById('p-med-input');
  var ri = document.getElementById('p-med-reason');
  var ta = document.getElementById('p-meds');
  if(!ni || !ta) return;
  var name = (ni.value||'').trim();
  var reason = (ri?ri.value||'':'').trim();
  if(!name) return;
  var line = name + (reason ? ' – ' + reason : '');
  ta.value = ta.value ? ta.value + '\n' + line : line;
  ni.value = '';
  if(ri) ri.value = '';
  saveMedToLibrary(name, reason);
  var d = document.getElementById('med-autocomplete');
  if(d) d.style.display='none';
  ni.focus();
}

// ══════════════════════════════════════════════════════════════
// PCSP AI 자동완성
// ══════════════════════════════════════════════════════════════

async function aiWritePCSP(field){
  var diag = (document.getElementById('p-diag')||{}).value || '';
  var meds = (document.getElementById('p-meds')||{}).value || '';
  var prefs = (document.getElementById('p-prefs')||{}).value || '';
  var nameKr = (document.getElementById('p-kr')||{}).value || '';
  var nameLast = (document.getElementById('p-last')||{}).value || '';
  var nameFirst = (document.getElementById('p-first')||{}).value || '';
  var nameEn = (nameLast && nameFirst) ? nameFirst + ' ' + nameLast : (nameLast || nameFirst || 'the participant');
  var nameDisplay = nameEn; // 영문 이름으로 문서 작성
  var dob = (document.getElementById('p-dob')||{}).value || '';
  var gender = (document.getElementById('p-gender')||{}).value || '';

  // 나이 계산
  var age = '';
  if(dob){ var y=new Date().getFullYear()-parseInt(dob.slice(0,4)); age=y+'세 ('+y+' years old)'; }

  var fieldLabels = {
    prefs: '선호도 (Preferences)',
    strengths: '강점 (Strengths)',
    needs: '필요 (Needs)',
    goals: '목표 (Goals)'
  };

  // 키워드 입력 팝업
  var hint = prompt(
    '✨ AI로 ' + fieldLabels[field] + ' 작성\n\n'
    + '키워드를 입력해주세요 (선택사항):\n'
    + '예: 음악감상, 산책, 종교활동, 사회화 필요, 가족 지지',
    ''
  );
  if(hint === null) return; // 취소

  var btn = document.querySelector('[onclick="aiWritePCSP(\''+field+'\')"]');
  if(btn){ btn.textContent='⏳ 생성 중...'; btn.disabled=true; }

  var prompts = {
    prefs: `You are a NYS DOH SADC PCSP writer. Write the "Preferences" section for a Korean-American senior participant.

Participant info:
- Name: ${nameDisplay}
- Age/Gender: ${age} ${gender}
- Diagnoses: ${diag || 'not specified'}
- Keywords/hints: ${hint || 'typical Korean senior preferences'}

Requirements:
- Write in English only
- 3-5 sentences
- Include both likes AND dislikes
- Mention specific activities (music, food, social activities, religious activities if applicable)
- Reference Korean cultural preferences naturally
- Follow NYS DOH SADC PCSP 2026 template format
- Use the participant's actual name: ${nameDisplay}
- Start with their name: e.g. "${nameDisplay} enjoys..." or "${nameDisplay} prefers..."
- Do NOT use "[Participant Name]" placeholder
- Do NOT include headers or labels, just the paragraph text`,

    strengths: `You are a NYS DOH SADC PCSP writer. Write the "Strengths" section for a Korean-American senior participant.

Participant info:
- Name: ${nameDisplay}
- Age/Gender: ${age} ${gender}
- Diagnoses: ${diag || 'not specified'}
- Keywords/hints: ${hint || 'typical Korean senior strengths'}

Requirements:
- Write in English only
- 3-4 sentences
- Use the participant's actual name "${nameDisplay}" (not "Participant" or "[Participant Name]")
- Include behavioral, social, AND physical strengths
- "None" is NOT acceptable
- Be specific and person-centered
- Follow NYS DOH SADC PCSP 2026 template format
- Do NOT include headers or labels, just the paragraph text`,

    needs: `You are a NYS DOH SADC PCSP writer. Write the "Needs" section for a Korean-American senior participant.

Participant info:
- Name: ${nameDisplay}
- Age/Gender: ${age} ${gender}
- Diagnoses: ${diag || 'not specified'}
- Preferences: ${prefs || 'not specified'}
- Keywords/hints: ${hint || 'typical Korean senior needs'}

Requirements:
- Write in English only
- 3-4 sentences
- Include reason for SADC attendance
- May include: socialization, cognitive stimulation, caregiver respite, health monitoring
- "None" is NOT acceptable
- Follow NYS DOH SADC PCSP 2026 template format
- Do NOT include headers or labels, just the paragraph text`,

    goals: `You are a NYS DOH SADC PCSP writer. Write 2-3 SMART Goals for a Korean-American senior participant.

Participant info:
- Name: ${nameDisplay}
- Age/Gender: ${age} ${gender}
- Diagnoses: ${diag || 'not specified'}
- Keywords/hints: ${hint || 'typical Korean senior goals'}
- Current date: ${new Date().toISOString().slice(0,10)}

Requirements:
- Write in English only
- 2-3 SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
- Each goal on a new line in format: "Goal: [goal] | Outcome: [criteria] | Actions: [steps]"
- Include dates (6-12 months from today)
- Goals should relate to diagnoses and preferences
- Follow NYS DOH SADC PCSP 2026 template format`
  };

  try {
    var res = await apiCall({ action: 'aiPCSP', prompt: prompts[field] });
    if(!res || !res.ok || !res.data || !res.data.success){
      throw new Error(res&&res.data&&res.data.error ? res.data.error : 'AI 응답 오류');
    }
    var text = res.data.text || '';

    if(!text){ throw new Error('응답 없음'); }

    if(field === 'goals'){
      // Goals는 파싱해서 각 goal 추가
      var lines = text.split('\n').filter(function(l){ return l.trim().startsWith('Goal:'); });
      if(lines.length){
        lines.forEach(function(line){
          var parts = line.split('|');
          var goal = (parts[0]||'').replace('Goal:','').trim();
          var outcome = (parts[1]||'').replace('Outcome:','').trim();
          var actions = (parts[2]||'').replace('Actions:','').trim();
          if(goal){
            _pcspGoals.push({
              goal: goal,
              outcome: outcome || 'To be measured by staff observation and participation tracking.',
              actions: actions || 'SADC staff will remind and encourage participant weekly.',
              activities: ''
            });
          }
        });
        renderPCSPGoals();
        alert('✅ AI가 '+lines.length+'개 목표를 생성했어요!');
      } else {
        // 파싱 실패시 첫 번째 goal에 텍스트 전체 넣기
        _pcspGoals.push({ goal: text.slice(0,200), outcome:'', actions:'', activities:'' });
        renderPCSPGoals();
      }
    } else {
      var ta = document.getElementById('p-'+field);
      if(ta){
        var existing = ta.value.trim();
        ta.value = existing ? existing + '\n\n' + text : text;
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      }
    }

  } catch(err){
    alert('❌ AI 생성 실패: ' + err.message + '\n\nAPI 연결을 확인해주세요.');
    console.error('AI 오류:', err);
  } finally {
    if(btn){ btn.textContent='✨ AI 작성'; btn.disabled=false; }
  }
}
