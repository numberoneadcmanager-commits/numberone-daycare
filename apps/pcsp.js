// ══════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — PCSP 관리
// apps/pcsp.js
// ══════════════════════════════════════════════════════════

var PCSP_LIST=JSON.parse(localStorage.getItem('op_pcsp_list')||'[]');
function loadPCSPFromSheets(){
  apiGet({action:'read',sheet:'PCSP'}).then(function(res){
    if(!res.ok||!res.data)return;
    res.data.forEach(function(row){
      var id=String(row['ID']||'');
      if(!id)return;
      var existing=PCSP_LIST.find(function(p){return p.id===id;});
      var summary={
        id:id,
        memberId:String(row['멤버ID']||''),
        nameLast:String(row['nameLast']||''),
        nameFirst:String(row['nameFirst']||''),
        nameKr:String(row['한글이름']||''),
        wdate:String(row['작성일']||'').slice(0,10),
        nextdate:String(row['갱신예정일']||'').slice(0,10),
        writer:String(row['작성자']||''),
        diag:String(row['진단']||''),
        status:String(row['상태']||'active')
      };
      if(existing){
        Object.keys(summary).forEach(function(k){
          if(summary[k]!=='' || k==='status') existing[k]=summary[k];
        });
      }else{
        PCSP_LIST.push(summary);
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
// 샘플 문서(NYS DOH)와 정확히 일치하는 HCBS Final Rule 필수 3개 권리 (고정, 문구 변경 금지)
var HCBS_RIGHTS=[
  'Having access to food at any time.',
  'Freedom and support to control their own schedules and activities.',
  'Freedom to have visitors of their choosing at any time.'
];
// 그 외 참여자 권리 (선택적으로 수정 필요 시에만 기록)
var PCSP_RIGHTS=[
  'Freedom of movement within the setting',
  'Physical accessibility of all areas of the setting',
  'Privacy (phone calls, mail, personal space)',
  'Choice of roommate or those with whom they share a unit',
  'Ability to furnish and decorate their personal space',
  'Right to lock their own space',
  'Community access and participation in community life',
  'Freedom to control their own funds',
  'Independence to interact with whom they choose'
];

function setPCSPFilter(f,el){_pcspFilter=f;document.querySelectorAll('#panel-forms .fpill').forEach(function(p){p.classList.remove('active');});el.classList.add('active');renderPCSPList();}

function renderPCSPList(){
  var q=(document.getElementById('pcsp-search')||{}).value||'';
  var today=new Date().toLocaleDateString('sv-SE');
  var list=PCSP_LIST.filter(function(p){
    var match=!q||(p.nameKr||'').includes(q)||(p.nameLast||'').includes(q);
    var due=p.nextdate&&p.nextdate<=today;
    return (_pcspFilter==='all'||(_pcspFilter==='due'&&due)||(_pcspFilter==='ok'&&!due))&&match;
  }).sort(function(a,b){return (a.nextdate||'9999')>(b.nextdate||'9999')?1:-1;});
  var html='';
  if(!list.length)html='<div class="empty-msg">PCSP 기록이 없어요</div>';
  list.forEach(function(p){
    var due=p.nextdate&&p.nextdate<=today;
    var isPending=String(p.status||'')==='서명대기';
    var badge=isPending
      ?'<span class="badge b-warn">✍️ 서명대기</span>'
      :(due?'<span class="badge b-warn">⚠️ 갱신필요</span>':'<span class="badge b-ok">✅ 완료/유효</span>');
    var safeName=(p.nameKr||p.nameLast||'').replace(/'/g,"\\'");
    html+='<div class="log-card"><div class="log-top"><div class="log-name">📄 '+(p.nameLast||'')+', '+(p.nameFirst||'')+' '+(p.nameKr?'('+p.nameKr+')':'')+'</div>'+badge+'</div>'
      +'<div style="font-size:11px;color:#8E8E93">작성: '+(p.wdate||'—')+' · 갱신예정: '+(p.nextdate||'—')+'</div>'
      +'<div style="font-size:11px;color:#3C3C43;margin-top:3px">'+(p.diag||'').slice(0,60)+'</div>'
      +'<div class="log-actions" style="margin-top:6px">'
      +(isPending?'<button class="btn-sm" style="background:#FF9500;color:#fff;border-color:#FF9500" onclick="signPCSP(\''+p.id+'\',\''+(p.memberId||p.medicaid||'')+'\',\''+safeName+'\')">✍️ 서명하기</button>':'')
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
  document.getElementById('pcsp-list-view').style.display='none';
  document.getElementById('pcsp-member-select').style.display='none';
  document.getElementById('pcsp-form-view').style.display='block';
  _pcspDays=new Set();_pcspContacts=[];_pcspRisks=[];_pcspGoals=[];_pcspCommunity=[];
  document.getElementById('pcsp-edit-id').value='';

  // 기본값 설정
  var today=new Date().toLocaleDateString('sv-SE');
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
  initPCSPRightsList();initPCSPHcbsList();
  renderPCSPContacts();
  renderPCSPRisks();
  renderPCSPGoals();
  renderPCSPCommunity();
  pcspGoStep(0);
}

function openPCSPForm(id){
  document.getElementById('pcsp-list-view').style.display='none';
  document.getElementById('pcsp-member-select').style.display='none';
  document.getElementById('pcsp-form-view').style.display='block';
  _pcspDays=new Set();_pcspContacts=[];_pcspRisks=[];_pcspGoals=[];_pcspCommunity=[];
  _pcspSig=null;
  document.getElementById('pcsp-edit-id').value=id||'';
  var today=new Date().toLocaleDateString('sv-SE');
  var nextYear=new Date();nextYear.setFullYear(nextYear.getFullYear()+1);
  document.getElementById('p-wdate').value=today;
  document.getElementById('p-sigdate').value=today;
  document.getElementById('p-nextdate').value=nextYear.toISOString().slice(0,10);
  document.getElementById('p-writer').value=_currentUser?(_currentUser.name||''):'';
  ['last','first','kr','genderid','addr','phone','email','lang','livewithname','ins','medicaid','ins2','ins2id','time','transport','cm1name','cm1phone','cm1email','cm2name','cm2phone','cm2email','pcpname','pcpphone','pcpemail','diag','meds','allergy','diet','nutrition','nutr-how','comm-why','decision-why','alone-why','pain-desc','cap-desc','carepref-desc','prefs','strengths','needs','sadc-act','work-desc','sig'].forEach(function(k){var el=document.getElementById('p-'+k);if(el)el.value='';});

  initPCSPAdlList();
  initPCSPRightsList();
  initPCSPHcbsList();

  if(id){
    var p=PCSP_LIST.find(function(x){return x.id===id;});
    if(p){
      var fields={last:'nameLast',first:'nameFirst',kr:'nameKr',writer:'writer',wdate:'wdate',nextdate:'nextdate',dob:'dob',genderid:'genderid',addr:'addr',phone:'phone',email:'email',lang:'lang',livewithname:'livewithname',ins:'ins',medicaid:'medicaid',ins2:'ins2',ins2id:'ins2id',time:'time',transport:'transport',cm1name:'cm1name',cm1phone:'cm1phone',cm1email:'cm1email',cm2name:'cm2name',cm2phone:'cm2phone',cm2email:'cm2email',pcpname:'pcpname',pcpphone:'pcpphone',pcpemail:'pcpemail',diag:'diag',meds:'meds',allergy:'allergy',diet:'diet',nutrition:'nutrition','nutr-how':'nutr_how','comm-why':'comm_why','decision-why':'decision_why','alone-why':'alone_why','pain-desc':'pain_desc','cap-desc':'cap_desc','carepref-desc':'carepref_desc',prefs:'prefs',strengths:'strengths',needs:'needs','sadc-act':'sadc_act','work-desc':'work_desc',sigdate:'sigdate'};
      Object.keys(fields).forEach(function(k){var el=document.getElementById('p-'+k);var v=p[fields[k]];if(el&&v!==undefined&&v!==null&&v!=='')el.value=v;});
      ['gender','livewith','caresupp','medassist','medlevel','nutr-acc','comm','decision','alone','pain','carepref','carepref-acc','carepref-notified','work'].forEach(function(k){var el=document.getElementById('p-'+k);var pk=k.replace(/-/g,'_');var v=p[pk];if(el&&v!==undefined&&v!==null&&v!=='')el.value=v;});
      _pcspDays=new Set(p.days||[]);_pcspContacts=p.contacts||[];_pcspRisks=p.risks||[];_pcspGoals=p.goals||[];_pcspCommunity=p.community||[];
      if(p.adl){p.adl.forEach(function(a,i){var lv=document.getElementById('padl-level-'+i);var dv=document.getElementById('padl-device-'+i);if(lv)lv.value=a.level||'';if(dv)dv.value=a.device||'';});}
      (p.hcbs_rights||[]).forEach(function(r,i){var mod=document.getElementById('phcbs-mod-'+i);var desc=document.getElementById('phcbs-desc-'+i);if(mod)mod.value=r.modified||'No';if(desc)desc.value=r.desc||'';toggleHcbsDetail(i);});
      (p.other_rights||p.rights||[]).forEach(function(r,i){
        var mod=document.getElementById('pright-mod-'+i);if(mod)mod.value=r.modified||'No';
        var vals={desc:r.desc||'',dx:r.dx||'',prior:r.prior||'',data:r.dataReview||'',time:r.timeframe||'',harm:r.noHarm||''};
        Object.keys(vals).forEach(function(k){var el=document.getElementById('pright-'+k+'-'+i);if(el)el.value=vals[k];});
        toggleRightDetail(i);
      });
    }
  }
  initPCSPDayBtns();
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

function initPCSPHcbsList(){
  var html='';
  HCBS_RIGHTS.forEach(function(right,i){
    html+='<div class="pcsp-right-row">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<div style="font-size:12px;font-weight:600;flex:1">'+right+'</div>'
      +'<select class="m-select" id="phcbs-mod-'+i+'" style="width:80px;font-size:11px;padding:4px;margin-left:8px" onchange="toggleHcbsDetail('+i+')">'
      +'<option>No</option><option>Yes</option></select>'
      +'</div>'
      +'<div id="phcbs-detail-'+i+'" style="display:none;background:#FFF3E0;border-radius:8px;padding:10px;margin-bottom:4px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      +'<div style="font-size:11px;font-weight:700;color:#B35900">Justification & Details (필수)</div>'
      +'<button class="btn-sm" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-size:10px" onclick="aiWriteHcbsJustification('+i+')">✨ AI 작성</button>'
      +'</div>'
      +'<textarea class="m-textarea" id="phcbs-desc-'+i+'" placeholder="진단/상태, 이전 시도, 검토 기간, 무해성 확인 포함" style="width:100%;font-size:11px;min-height:60px"></textarea>'
      +'</div>'
      +'</div>';
  });
  var el=document.getElementById('pcsp-hcbs-list');if(el)el.innerHTML=html;
}
function toggleHcbsDetail(i){var sel=document.getElementById('phcbs-mod-'+i);var detail=document.getElementById('phcbs-detail-'+i);if(detail)detail.style.display=sel&&sel.value==='Yes'?'block':'none';}

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
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">④ Data Collection & Review Method (효과 측정/검토 방법)</div>'
      +'<input class="m-input" id="pright-data-'+i+'" placeholder="예: Staff will document incidents weekly and review monthly" style="font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">⑤ Timeframe for Review (기간 및 재검토 일정)</div>'
      +'<input class="m-input" id="pright-time-'+i+'" placeholder="예: 6 months – 1/1/2026 to 7/1/2026" style="font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#3C3C43;margin-bottom:4px">⑥ Assurance of No Harm (무해성 확인)</div>'
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

function renderPCSPRisks(){var el=document.getElementById('pcsp-risks-list');if(!el)return;if(!_pcspRisks.length){el.innerHTML='<div class="empty-msg" style="padding:8px">없으면 저장 시 "No known risks" 기록</div>';return;}el.innerHTML=_pcspRisks.map(function(r,i){return '<div class="pcsp-risk-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>⚠️ '+r.risk+'</b><div><button class="btn-sm" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-size:10px" onclick="aiFillRiskItem('+i+')">✨ AI 작성</button> <button class="btn-danger" onclick="removePcspRisk('+i+')">삭제</button></div></div><div style="font-size:11px"><b>Trigger:</b> '+(r.trigger||'—')+' | <b>Response:</b> '+(r.response||'—')+'</div><div style="font-size:11px"><b>Measure:</b> '+(r.measure||'—')+' | <b>Safeguard:</b> '+(r.safeguard||'—')+'</div></div>';}).join('');}
function addPcspRisk(){var risk=prompt('위험 요소 (예: Fall Risk):');if(!risk)return;_pcspRisks.push({risk:risk,trigger:'',response:'',measure:'',safeguard:''});renderPCSPRisks();}
function removePcspRisk(i){_pcspRisks.splice(i,1);renderPCSPRisks();}

function renderPCSPGoals(){var el=document.getElementById('pcsp-goals-list');if(!el)return;if(!_pcspGoals.length){el.innerHTML='<div class="empty-msg" style="padding:8px">목표 없음</div>';return;}el.innerHTML=_pcspGoals.map(function(g,i){return '<div class="pcsp-goal-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>🎯 Goal '+(i+1)+'</b><button class="btn-danger" onclick="removePcspGoal('+i+')">삭제</button></div><div style="font-size:11px"><b>Goal:</b> '+g.goal+'</div><div style="font-size:11px"><b>Outcome:</b> '+g.outcome+'</div><div style="font-size:11px"><b>Actions:</b> '+g.actions+'</div></div>';}).join('');}
function addPcspGoal(){var goal=prompt('Goal (목표):');if(!goal)return;var outcome=prompt('Outcome Criteria (달성 기준/날짜):','');var actions=prompt('Actions/Steps:','');var activities=prompt('Related Activities:','');_pcspGoals.push({goal:goal,outcome:outcome||'',actions:actions||'',activities:activities||''});renderPCSPGoals();}
function removePcspGoal(i){_pcspGoals.splice(i,1);renderPCSPGoals();}

function renderPCSPCommunity(){var el=document.getElementById('pcsp-community-list');if(!el)return;if(!_pcspCommunity.length){el.innerHTML='<div class="empty-msg" style="padding:8px">지역사회 활동 없음</div>';return;}el.innerHTML=_pcspCommunity.map(function(c,i){return '<div class="pcsp-comm-item"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>🌍 '+c.activity+'</b><div><button class="btn-sm" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-size:10px" onclick="aiFillCommunityItem('+i+')">✨ AI 작성</button> <button class="btn-danger" onclick="removePcspCommunity('+i+')">삭제</button></div></div><div style="font-size:11px">'+(c.details||'')+'</div><div style="font-size:11px">'+(c.location||'—')+' · '+(c.schedule||'—')+'</div><div style="font-size:11px">Transport: '+(c.transport||'—')+' · Support: '+(c.supports||c.support||'—')+'</div></div>';}).join('');}
function addPcspCommunity(){var activity=prompt('활동명:');if(!activity)return;_pcspCommunity.push({activity:activity,details:'',location:'',schedule:'',materials:'',transport:'',supports:''});renderPCSPCommunity();}
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
      dataReview:isYes&&document.getElementById('pright-data-'+i)?document.getElementById('pright-data-'+i).value:'',
      timeframe:isYes&&document.getElementById('pright-time-'+i)?document.getElementById('pright-time-'+i).value:'',
      noHarm:isYes&&document.getElementById('pright-harm-'+i)?document.getElementById('pright-harm-'+i).value:''
    };
  });
  // HCBS Final Rule 필수 3개 권리 (샘플 문서와 정확히 일치하는 별도 목록)
  var hcbsRights=HCBS_RIGHTS.map(function(right,i){
    var mod=document.getElementById('phcbs-mod-'+i);
    var isYes=mod&&mod.value==='Yes';
    return {
      right:right,
      modified:mod?mod.value:'No',
      desc:isYes&&document.getElementById('phcbs-desc-'+i)?document.getElementById('phcbs-desc-'+i).value:'',
    };
  });

  // 서명 캔버스에서 서명 이미지 가져오기
  // ★ _pcspSig는 실제로 서명을 그렸을 때만 채워짐 — 빈 캔버스에서 강제로 toDataURL()을
  //   뽑으면 빈 이미지도 100자 넘는 base64가 나와서 "서명 있음"으로 오판되는 버그 있었음
  var sigData = _pcspSig || null;

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
    comm:gp('comm'),decision:gp('decision'),decision_why:gp('decision-why'),comm_why:gp('comm-why'),
    alone:gp('alone'),alone_why:gp('alone-why'),pain:gp('pain'),pain_desc:gp('pain-desc'),cap_desc:gp('cap-desc'),
    adl:adl,
    carepref:gp('carepref'),carepref_acc:gp('carepref-acc'),
    carepref_desc:gp('carepref-desc'),carepref_notified:gp('carepref-notified'),
    risks:_pcspRisks.length?_pcspRisks:[{risk:'No known risks',trigger:'',response:'',measure:'',safeguard:''}],
    prefs:gp('prefs'),strengths:gp('strengths'),needs:gp('needs'),
    goals:_pcspGoals,sadc_act:gp('sadc-act'),community:_pcspCommunity,
    work:gp('work'),work_desc:gp('work-desc'),
    hcbs_rights:hcbsRights, other_rights:rights,
    sig:sigData||'',sigdate:gp('sigdate'),
    signed:!!(sigData&&sigData.length>100),
    createdBy:    (PCSP_LIST.find(function(x){return x.id===editId;})||{}).createdBy || (_currentUser?(_currentUser.name||''):''),
    createdByEmail: (PCSP_LIST.find(function(x){return x.id===editId;})||{}).createdByEmail || (_currentUser?(_currentUser.email||''):''),
    createdAt:    (PCSP_LIST.find(function(x){return x.id===editId;})||{}).createdAt || new Date().toISOString(),
    lastEditedBy:    _currentUser?(_currentUser.name||''):'',
    lastEditedByEmail: _currentUser?(_currentUser.email||''):'',
    status:(sigData&&sigData.length>100)?'완료':'서명대기',updatedAt:new Date().toISOString()
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

// 서명대기 PCSP를 기존 JSON으로 열고 서명 단계(7단계)로 바로 이동
async function signPCSP(id, memberId, memberName){
  try{
    var cached=PCSP_LIST.find(function(x){return x.id===id;});
    memberId=memberId||(cached&&(cached.memberId||cached.medicaid))||'';
    memberName=memberName||(cached&&(cached.nameKr||cached.nameLast))||'';
    var full=null;
    if(memberId){
      var res=await loadJSONfromDrive(memberId,memberName,'PCSP');
      if(res&&res.ok&&res.data&&res.data.found&&res.data.data)full=res.data.data;
    }
    if(full){
      full.memberId=full.memberId||memberId;
      full.status='서명대기';
      var ix=PCSP_LIST.findIndex(function(x){return x.id===full.id;});
      if(ix>=0)PCSP_LIST[ix]=full;else PCSP_LIST.push(full);
      savePCSPStorage();
      openPCSPForm(full.id);
    }else if(cached&&(cached.nameLast||cached.nameFirst||cached.medicaid)){
      openPCSPForm(id);
    }else{
      throw new Error('저장된 PCSP 상세 JSON을 찾을 수 없습니다.');
    }
    setTimeout(function(){
      var sigDate=document.getElementById('p-sigdate');
      if(sigDate&&!sigDate.value)sigDate.value=new Date().toLocaleDateString('sv-SE');
      pcspGoStep(6);
    },120);
  }catch(e){
    console.error('PCSP signature open error:',e);
    alert('❌ 서명대기 PCSP를 불러오지 못했습니다: '+e.message);
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
async function deletePCSP(id){
  if(!confirm('삭제?'))return;
  PCSP_LIST=PCSP_LIST.filter(function(x){return x.id!==id;});
  savePCSPStorage();
  renderPCSPList();
  try{ await apiCall({action:'delete',sheet:'PCSP',id:id}); }catch(e){ console.log('PCSP Sheets 삭제 실패:', e); }
}

async function printPCSP(id){
  var p=PCSP_LIST.find(function(x){return x.id===id;});
  if(!p){alert('PCSP를 찾을 수 없어요');return;}

  // 출력은 브라우저 HTML이 아니라 서버의 단일 PCSP 출력 엔진을 사용한다.
  // 이렇게 해야 화면 출력/Drive PDF가 서로 다른 양식으로 갈라지지 않는다.
  var memberId=p.memberId||p.medicaid||p.id;
  var memberName=p.nameKr||p.nameLast||'Unknown';

  var previewWin=window.open('','_blank');
  if(!previewWin){alert('팝업을 허용해주세요');return;}
  previewWin.document.write('<!doctype html><html><head><meta charset="utf-8"><title>PCSP 생성 중</title></head><body style="font-family:Arial,sans-serif;padding:30px">PCSP PDF 생성 중...</body></html>');
  previewWin.document.close();

  try{
    // 목록에는 요약 데이터만 있을 수 있으므로 Drive JSON을 우선 사용한다.
    try{
      var loaded=await loadJSONfromDrive(memberId,memberName,'PCSP');
      if(loaded&&loaded.ok&&loaded.data&&loaded.data.found&&loaded.data.data){
        p=loaded.data.data;
        p.memberId=p.memberId||memberId;
      }
    }catch(loadErr){
      console.log('PCSP 출력용 Drive JSON 로드 실패, 캐시 사용:',loadErr);
    }

    var sigBase64='';
    if(p.sig&&p.sig.indexOf('base64,')>=0)sigBase64=p.sig.split('base64,')[1]||'';

    var res=await apiCall({
      action:'fillPCSP',
      memberId:memberId,
      memberName:memberName,
      sigBase64:sigBase64,
      pcsp:p,
      previewOnly:true
    });

    if(!res||!res.ok||!res.data||!res.data.success||!res.data.pdfBase64){
      throw new Error(res&&res.data&&res.data.error?res.data.error:'PDF 생성 실패');
    }

    var binary=atob(res.data.pdfBase64);
    var bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    var blob=new Blob([bytes],{type:'application/pdf'});
    var url=URL.createObjectURL(blob);
    previewWin.location.replace(url);
    setTimeout(function(){try{URL.revokeObjectURL(url);}catch(e){}},120000);
  }catch(e){
    console.error('PCSP print error:',e);
    try{previewWin.close();}catch(closeErr){}
    alert('❌ PCSP 출력 실패: '+e.message);
  }
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
- Current date: ${new Date().toLocaleDateString('sv-SE')}

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

// ══════════════════════════════════════════════════════════════
// 케어 관리(index.html)에서 멤버 선택 후 넘어온 경우 처리
// ══════════════════════════════════════════════════════════════
function prefillPCSPFromMember(mid){
  var member = (typeof _formsMemberCache !== 'undefined' ? _formsMemberCache : []).find(function(m){
    return String(m['ID']) === String(mid);
  });

  if (!member) {
    // 멤버 캐시에 없으면(로드 지연 등) 신규 작성 화면만 열기
    document.getElementById('pcsp-list-view').style.display='none';
    document.getElementById('pcsp-member-select').style.display='none';
    document.getElementById('pcsp-form-view').style.display='block';
    return;
  }

  var medicaid = String(member['Medicaid']||'').toUpperCase();
  var nameKr   = String(member['한글이름']||'');
  var matches = PCSP_LIST.filter(function(p){
    return (medicaid && String(p.medicaid||'').toUpperCase() === medicaid)
        || (nameKr && p.nameKr === nameKr);
  });

  if (matches.length === 0) {
    selectPCSPMember(member);
  } else if (matches.length === 1) {
    editPCSP(matches[0].id);
  } else {
    showPCSPSelectPopup(matches, member);
  }
}

// 같은 멤버 이름으로 PCSP가 여러 건일 때 선택 팝업
function showPCSPSelectPopup(matches, member){
  matches.sort(function(a,b){ return (b.wdate||'').localeCompare(a.wdate||''); });
  var mName = member ? (member['한글이름']||'') : '';
  window._pcspPopupMember = member; // 새 PCSP 작성 버튼에서 사용
  var html = '<div style="padding:4px 0">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px">' + mName + ' — 저장된 PCSP ' + matches.length + '건</div>';
  matches.forEach(function(p){
    var due = p.nextdate && p.nextdate <= new Date().toLocaleDateString('sv-SE');
    html += '<div onclick="closeOv(\'ov-doc-viewer\');editPCSP(\''+p.id+'\')" '
      + 'style="background:#F2F2F7;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer">'
      + '<div style="font-size:13px;font-weight:600">작성일: ' + (p.wdate||'—') + '</div>'
      + '<div style="font-size:12px;color:' + (due?'#FF3B30':'#34C759') + ';margin-top:3px">갱신예정일: ' + (p.nextdate||'—') + (due?' (임박/만료)':'') + '</div>'
      + '<div style="font-size:11px;color:#8E8E93;margin-top:3px">작성자: ' + (p.writer||'—') + '</div>'
      + '</div>';
  });
  html += '<button onclick="closeOv(\'ov-doc-viewer\');selectPCSPMember(window._pcspPopupMember)" '
    + 'style="width:100%;padding:11px;border-radius:10px;border:1.5px solid #D85A30;background:#FFF3EE;color:#D85A30;font-weight:700;font-size:13px;cursor:pointer;margin-top:6px">➕ 새 PCSP 작성</button>';
  html += '</div>';

  var titleEl = document.getElementById('doc-viewer-title');
  var bodyEl  = document.getElementById('doc-viewer-body');
  if (titleEl) titleEl.textContent = 'PCSP 선택';
  if (bodyEl)  bodyEl.innerHTML = html;
  openOv('ov-doc-viewer');
}

// ══════════════════════════════════════════════════════════════
// AI 작성 확장 — 위험요소/커뮤니티활동/HCBS 정당화 등 배열 항목용
// (기존 aiWritePCSP은 단일 textarea용이라 별도 함수로 구현)
// ══════════════════════════════════════════════════════════════

async function _callAIForJSON(promptText) {
  var res = await apiCall({ action: 'aiPCSP', prompt: promptText });
  if (!res || !res.ok || !res.data || !res.data.success) {
    throw new Error(res && res.data && res.data.error ? res.data.error : 'AI 응답 오류');
  }
  var text = res.data.text || '';
  var clean = text.replace(/```json|```/g, '').trim();
  var m = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : clean);
}

function _pcspContextInfo() {
  var nameLast = (document.getElementById('p-last')||{}).value || '';
  var nameFirst = (document.getElementById('p-first')||{}).value || '';
  var nameDisplay = (nameLast && nameFirst) ? nameFirst + ' ' + nameLast : (nameLast || nameFirst || 'the participant');
  var diag = (document.getElementById('p-diag')||{}).value || 'not specified';
  return { nameDisplay: nameDisplay, diag: diag };
}

// ── 위험요소 항목 AI 자동 채우기 ──
async function aiFillRiskItem(idx) {
  var r = _pcspRisks[idx];
  if (!r) return;
  var ctx = _pcspContextInfo();
  var prompt = `You are a NYS DOH SADC PCSP writer. Write risk management details for a Korean-American senior participant.

Participant: ${ctx.nameDisplay}
Diagnoses: ${ctx.diag}
Risk identified: ${r.risk}

Write in English. Respond with ONLY a raw JSON object, no markdown, no commentary:
{"trigger":"...","response":"...","measure":"...","safeguard":"..."}`;

  try {
    var btn = event && event.target;
    if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }
    var obj = await _callAIForJSON(prompt);
    r.trigger = obj.trigger || r.trigger;
    r.response = obj.response || r.response;
    r.measure = obj.measure || r.measure;
    r.safeguard = obj.safeguard || r.safeguard;
    renderPCSPRisks();
  } catch(e) {
    alert('❌ AI 생성 실패: ' + e.message);
  }
}

// ── 커뮤니티 활동 항목 AI 자동 채우기 ──
async function aiFillCommunityItem(idx) {
  var c = _pcspCommunity[idx];
  if (!c) return;
  var ctx = _pcspContextInfo();
  var prompt = `You are a NYS DOH SADC PCSP writer. Write community integration activity details for a Korean-American senior participant.

Participant: ${ctx.nameDisplay}
Activity: ${c.activity}

Write in English. Respond with ONLY a raw JSON object, no markdown, no commentary:
{"details":"2-3 sentence description of the activity and why it fits the participant","location":"...","schedule":"day/time/frequency","materials":"materials needed or none","transport":"transportation method","supports":"supports needed or none"}`;

  try {
    var btn = event && event.target;
    if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }
    var obj = await _callAIForJSON(prompt);
    c.details = obj.details || c.details;
    c.location = obj.location || c.location;
    c.schedule = obj.schedule || c.schedule;
    c.materials = obj.materials || c.materials;
    c.transport = obj.transport || c.transport;
    c.supports = obj.supports || c.supports;
    renderPCSPCommunity();
  } catch(e) {
    alert('❌ AI 생성 실패: ' + e.message);
  }
}

// ── HCBS 권리 수정 정당화(Justification) AI 작성 ──
async function aiWriteHcbsJustification(idx) {
  var right = HCBS_RIGHTS[idx];
  var ctx = _pcspContextInfo();
  var hint = prompt('✨ AI로 정당화 사유 작성\n\n키워드를 입력해주세요 (선택사항):\n예: 당뇨 관리, 저녁 시간대 낙상 위험', '');
  if (hint === null) return;

  var promptText = `You are a NYS DOH SADC PCSP writer. Write justification for a modification to a participant's HCBS right.

Participant: ${ctx.nameDisplay}
Diagnoses: ${ctx.diag}
Right being modified: ${right}
Keywords/hints: ${hint || 'not specified'}

Requirements — the justification MUST include all of the following:
1. Diagnosis/condition related to the modification
2. Positive interventions and supports used before this modification
3. Method for collection and review of data for effectiveness
4. Timeframe/limits for review and determination of need for modification
5. Assurance that the modification will cause no harm

Write in English, 4-6 sentences, as one continuous paragraph. Respond with ONLY the paragraph text, no markdown, no headers, no JSON.`;

  var btn = document.querySelector('[onclick="aiWriteHcbsJustification('+idx+')"]');
  if (btn) { btn.textContent = '⏳ 생성 중...'; btn.disabled = true; }

  try {
    var res = await apiCall({ action: 'aiPCSP', prompt: promptText });
    if (!res || !res.ok || !res.data || !res.data.success) throw new Error(res && res.data && res.data.error ? res.data.error : 'AI 응답 오류');
    var text = (res.data.text || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    var ta = document.getElementById('phcbs-desc-' + idx);
    if (ta) { ta.value = text; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  } catch(e) {
    alert('❌ AI 생성 실패: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '✨ AI 작성'; btn.disabled = false; }
  }
}

// ── SADC 활동(필요 지원), 취업/봉사 설명, 새 필드(의사표현/혼자있기/통증 이유) AI 작성 ──
async function aiWriteSimpleField(field, targetId, label) {
  var ctx = _pcspContextInfo();
  var hint = prompt('✨ AI로 ' + label + ' 작성\n\n키워드를 입력해주세요 (선택사항):', '');
  if (hint === null) return;

  var fieldPrompts = {
    sadc_act: `Write the "SADC Activities" section listing activities the participant is interested in and any needed supports. Format: one activity per line as "Activity – Supports needed (or 'no support needed')".`,
    work_desc: `Write a description of the participant's work/volunteer interest, including frequency, days/time, and what support is provided.`,
    comm_why: `Explain why the participant is unable to communicate their needs (pain, hunger, etc.) independently.`,
    alone_why: `Explain why the participant cannot be left alone/unsupervised, including any cognitive or communication needs.`,
    pain_desc: `Describe the participant's pain and/or sensory needs, and what assistance is to be provided.`,
  };

  var promptText = `You are a NYS DOH SADC PCSP writer. ${fieldPrompts[field] || ('Write the ' + label + ' section.')}

Participant: ${ctx.nameDisplay}
Diagnoses: ${ctx.diag}
Keywords/hints: ${hint || 'not specified'}

Write in English, 2-4 sentences (or 2-3 lines if listing activities). Respond with ONLY the text, no markdown, no headers, no JSON.`;

  var btn = event && event.target;
  if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }

  try {
    var res = await apiCall({ action: 'aiPCSP', prompt: promptText });
    if (!res || !res.ok || !res.data || !res.data.success) throw new Error(res && res.data && res.data.error ? res.data.error : 'AI 응답 오류');
    var text = (res.data.text || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
    var ta = document.getElementById(targetId);
    if (ta) {
      var existing = ta.value.trim();
      ta.value = existing ? existing + '\n\n' + text : text;
      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
    }
  } catch(e) {
    alert('❌ AI 생성 실패: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '✨ AI 작성'; btn.disabled = false; }
  }
}
