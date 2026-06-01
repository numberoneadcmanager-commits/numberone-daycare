// ══════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — Forms (Assessment/Nutrition/MemberRights/HIPAA)
// apps/forms_ops.js
// ══════════════════════════════════════════════════════════

══
// FORMS HUB — 텍스트 검색 기반
// ══════════════════════════════════════════════════════════
var _formsMemberCache = [];
var _selectedFormsMember = null;

function loadFormsMemberDropdown(){
  apiGet({action:'read',sheet:'멤버'}).then(function(res){
    if(!res.ok||!res.data)return;
    _formsMemberCache = res.data.filter(function(r){return r['ID']&&r['한글이름']&&r['상태']!=='disenrolled';});
  }).catch(function(){});
}

function filterFormsMembers(){
  var q = (document.getElementById('forms-search').value||'').trim().toLowerCase();
  var clearBtn = document.getElementById('forms-clear-btn');
  var resultDiv = document.getElementById('forms-member-result');
  var emptyMsg = document.getElementById('forms-empty-msg');
  var selectedDiv = document.getElementById('forms-selected');
  if(clearBtn) clearBtn.style.display = q ? 'block' : 'none';
  if(_selectedFormsMember){ return; }
  if(!q){
    if(resultDiv) resultDiv.style.display='none';
    if(emptyMsg) emptyMsg.style.display='block';
    return;
  }
  var filtered = _formsMemberCache.filter(function(m){
    return (m['한글이름']||'').includes(q)
      || (m['영문이름']||'').toLowerCase().includes(q)
      || (m['Medicaid']||'').toLowerCase().includes(q);
  }).slice(0,10);
  if(!filtered.length){
    if(resultDiv){resultDiv.style.display='block';resultDiv.innerHTML='<div class="empty-msg">검색 결과 없음</div>';}
    if(emptyMsg) emptyMsg.style.display='none';
    return;
  }
  var html = filtered.map(function(m){
    var avBg=m['avBg']||'#E6F1FB', avColor=m['avColor']||'#185FA5';
    return '<div onclick="selectFormsMember(\''+m['ID']+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border-radius:12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer">'
      +'<div style="width:36px;height:36px;border-radius:50%;background:'+avBg+';color:'+avColor+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">'+(m['한글이름']||'?')[0]+'</div>'
      +'<div><div style="font-size:13px;font-weight:700">'+m['한글이름']+'</div>'
      +'<div style="font-size:11px;color:#8E8E93">'+m['영문이름']+' · '+m['Medicaid']+'</div></div>'
      +'</div>';
  }).join('');
  if(resultDiv){resultDiv.style.display='block';resultDiv.innerHTML=html;}
  if(emptyMsg) emptyMsg.style.display='none';
}

function selectFormsMember(mid){
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(mid);});
  if(!member)return;
  _selectedFormsMember=member;
  document.getElementById('forms-search').value=member['한글이름'];
  document.getElementById('forms-member-result').style.display='none';
  document.getElementById('forms-empty-msg').style.display='none';
  document.getElementById('forms-selected').style.display='block';
  var avBg=member['avBg']||'#E6F1FB', avColor=member['avColor']||'#185FA5';
  var nameEl=document.getElementById('forms-selected-name');
  if(nameEl) nameEl.innerHTML='<span style="display:inline-flex;align-items:center;gap:6px">'
    +'<span style="width:28px;height:28px;border-radius:50%;background:'+avBg+';color:'+avColor+';display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">'+member['한글이름'][0]+'</span>'
    +member['한글이름']+' <span style="font-size:11px;color:#8E8E93;font-weight:400">'+member['영문이름']+'</span></span>';
  renderFormsList(member);
}

function renderFormsList(member){
  var mid=member['ID'], mName=member['한글이름']||'';
  var officialForms=[
    {key:'PCSP',        label:'PCSP',               icon:'📋', color:'#E6F1FB', tc:'#185FA5'},
    {key:'Assessment',  label:'Assessment',          icon:'📝', color:'#E1F5EE', tc:'#0F6E56'},
    {key:'Nutrition',   label:'Nutrition Screening', icon:'🥗', color:'#EEEDFE', tc:'#534AB7'},
    {key:'MemberRights',label:'Member Rights',       icon:'⚖️', color:'#FFF3EE', tc:'#D85A30'},
    {key:'HIPAA',       label:'HIPAA Authorization', icon:'🔐', color:'#FBEAF0', tc:'#72243E'},
  ];
  var html='';
  officialForms.forEach(function(f){
    html+='<div data-fkey="'+f.key+'" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#fff;border-radius:12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<div style="width:38px;height:38px;border-radius:10px;background:'+f.color+';color:'+f.tc+';display:flex;align-items:center;justify-content:center;font-size:18px">'+f.icon+'</div>'
      +'<div style="font-size:13px;font-weight:600">'+f.label+'</div>'
      +'</div><span style="color:#C7C7CC;font-size:20px">›</span></div>';
  });
  var el=document.getElementById('forms-official-list');
  if(el){
    el.innerHTML=html;
    el.querySelectorAll('[data-fkey]').forEach(function(div){
      div.addEventListener('click',function(){
        var key=this.getAttribute('data-fkey');
        if(key==='PCSP')          openPCSPForMember(mid,mName);
        else if(key==='Assessment')    openAssessmentForMember(mid,mName);
        else if(key==='Nutrition')     openNutritionForMember(mid,mName);
        else if(key==='MemberRights')  openMemberRightsForMember(mid,mName);
        else if(key==='HIPAA')         openHIPAAForMember(mid,mName);
      });
    });
  }
  var idForms=[
    {key:'Medicaid_Card',label:'Medicaid Card',icon:'🪪'},
    {key:'Medicare_Card',label:'Medicare Card',icon:'🪪'},
    {key:'Photo_ID',label:'Photo ID',icon:'🪪'},
  ];
  var idHtml='';
  idForms.forEach(function(f){
    idHtml+='<div onclick="uploadMemberID(\''+mid+'\',\''+mName+'\',\''+f.key+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#fff;border-radius:12px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<div style="width:38px;height:38px;border-radius:10px;background:#F2F2F7;display:flex;align-items:center;justify-content:center;font-size:18px">'+f.icon+'</div>'
      +'<div style="font-size:13px;font-weight:600">'+f.label+'</div>'
      +'</div><span style="font-size:11px;color:#5856D6;font-weight:600">📎 업로드</span></div>';
  });
  var idEl=document.getElementById('forms-id-list');if(idEl)idEl.innerHTML=idHtml;
}

function clearFormsSearch(){
  document.getElementById('forms-search').value='';
  var cb=document.getElementById('forms-clear-btn');if(cb)cb.style.display='none';
  var rd=document.getElementById('forms-member-result');if(rd)rd.style.display='none';
  var em=document.getElementById('forms-empty-msg');if(em)em.style.display='block';
  var sd=document.getElementById('forms-selected');if(sd)sd.style.display='none';
  _selectedFormsMember=null;
}

function clearFormsSelection(){
  _selectedFormsMember=null;
  document.getElementById('forms-search').value='';
  var cb=document.getElementById('forms-clear-btn');if(cb)cb.style.display='none';
  var rd=document.getElementById('forms-member-result');if(rd)rd.style.display='none';
  var sd=document.getElementById('forms-selected');if(sd)sd.style.display='none';
  var em=document.getElementById('forms-empty-msg');if(em)em.style.display='block';
  ['frm-assessment','frm-nutrition','frm-member-rights'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='block';
}


function closeFrmBack(){
  ['frm-assessment','frm-nutrition','frm-member-rights'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  var pv=document.getElementById('pcsp-member-select');if(pv)pv.style.display='none';
  var pf=document.getElementById('pcsp-form-view');if(pf)pf.style.display='none';
  var lv=document.getElementById('pcsp-list-view');if(lv)lv.style.display='none';
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='block';
  // 선택된 멤버가 있으면 폼 목록 다시 표시
  if(_selectedFormsMember){
    var sd=document.getElementById('forms-selected');if(sd)sd.style.display='block';
    var em=document.getElementById('forms-empty-msg');if(em)em.style.display='none';
  }
}

function openPCSPForMember(mid, mName){
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='none';
  var lv=document.getElementById('pcsp-list-view');if(lv)lv.style.display='block';
  renderPCSPList();
  if(mid) prefillPCSPFromMember(mid);
}

function showPCSPMemberSelect(){
  document.getElementById('pcsp-list-view').style.display='none';
  document.getElementById('pcsp-member-select').style.display='block';
  document.getElementById('pcsp-form-view').style.display='none';
  var q = document.getElementById('pcsp-member-q');
  if(q) q.value='';
  renderPCSPMemberList();
}

function openAssessmentForMember(mid,mName){
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(mid);});
  if(!member){alert('멤버 정보를 찾을 수 없습니다');return;}
  _asmt.mid=mid;_asmt.step=0;
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='none';
  document.getElementById('frm-assessment').style.display='block';
  var pv=document.getElementById('pcsp-list-view');if(pv)pv.style.display='none';
  var hdr=document.getElementById('as-member-header');if(hdr)hdr.textContent=member['한글이름']+' ('+member['영문이름']+')';
  var nkr=document.getElementById('as-name-kr');if(nkr)nkr.textContent=member['한글이름']||'';
  var nen=document.getElementById('as-name-en');if(nen)nen.textContent=member['영문이름']||'';
  var dob=document.getElementById('as-dob');if(dob)dob.value=(member['생년월일']||'').slice(0,10);
  var med=document.getElementById('as-medicaid');if(med)med.value=member['Medicaid']||'';
  var phn=document.getElementById('as-phone');if(phn)phn.value=member['전화']||'';
  var adr=document.getElementById('as-addr');if(adr)adr.value=member['주소']||'';
  var pcp=document.getElementById('as-pcp');if(pcp)pcp.value=member['주치의']||'';
  var adate=document.getElementById('as-date');if(adate)adate.value=new Date().toISOString().slice(0,10);
  loadJSONfromDrive(mid,member['한글이름']||'','Assessment').then(function(res){if(res&&res.ok&&res.data&&res.data.found&&res.data.data)fillAssessmentFromJSON(res.data.data);}).catch(function(){});
  goAssessStep(0);_ptSig=null;_asSig=null;
  initSigCanvas('pt-sig-canvas','pt-sig-empty',function(d){_ptSig=d;});
  initSigCanvas('as-sig-canvas','as-sig-empty',function(d){_asSig=d;});
}
function goAssessStep(n){
  var steps=document.querySelectorAll('#frm-assessment .as-step');
  var tabs=document.querySelectorAll('#frm-assessment .as-tab');
  steps.forEach(function(s,i){s.style.display=i===n?'block':'none';});
  tabs.forEach(function(t,i){t.classList.toggle('active',i===n);});
  _asmt.step=n;var total=steps.length;
  var pf=document.getElementById('as-pf');if(pf)pf.style.width=((n+1)/total*100)+'%';
  var ctr=document.getElementById('as-pctr');if(ctr)ctr.textContent=(n+1)+' / '+total;
  var prv=document.getElementById('as-prev');if(prv)prv.style.visibility=n===0?'hidden':'visible';
  var nxt=document.getElementById('as-next');if(nxt)nxt.textContent=n===total-1?'저장':'다음';
  var btn=document.getElementById('as-pcsp-btn');if(btn)btn.style.display=n===total-1?'block':'none';
}
function nextAssessStep(){var steps=document.querySelectorAll('#frm-assessment .as-step');if(_asmt.step<steps.length-1)goAssessStep(_asmt.step+1);else saveAssessment();}
function prevAssessStep(){if(_asmt.step>0)goAssessStep(_asmt.step-1);}
function clearPtSig(){clearSigCanvas('pt-sig-canvas','pt-sig-empty');_ptSig=null;}
function clearAsSig(){clearSigCanvas('as-sig-canvas','as-sig-empty');_asSig=null;}
function collectAssessmentData(){
  var gv2=function(id){var el=document.getElementById(id);return el?el.value:'';};
  return{mid:_asmt.mid,date:gv2('as-date'),assessor:gv2('as-assessor'),medicaid:gv2('as-medicaid'),phone:gv2('as-phone'),addr:gv2('as-addr'),pcp:gv2('as-pcp'),dob:gv2('as-dob'),
    adl:{bathing:gv2('adl-bathing-st'),hygiene:gv2('adl-hygiene-st'),dressing:gv2('adl-dressing-st'),mobility:gv2('adl-mobility-st'),transfer:gv2('adl-transfer-st'),eating:gv2('adl-eating-st'),toilet:gv2('adl-toilet-st')},
    medications:[{name:gv2('med-1-name'),dose:gv2('med-1-dose'),reason:gv2('med-1-reason')},{name:gv2('med-2-name'),dose:gv2('med-2-dose'),reason:gv2('med-2-reason')},{name:gv2('med-3-name'),dose:gv2('med-3-dose'),reason:gv2('med-3-reason')},{name:gv2('med-4-name'),dose:gv2('med-4-dose'),reason:gv2('med-4-reason')},{name:gv2('med-5-name'),dose:gv2('med-5-dose'),reason:gv2('med-5-reason')}].filter(function(m){return m.name;}),
    caregiver:{name:gv2('care-name'),rel:gv2('care-rel'),phone:gv2('care-hphone')},
    ec1:{name:gv2('ec1-name'),rel:gv2('ec1-rel'),phone:gv2('ec1-hphone')},
    ec2:{name:gv2('ec2-name'),rel:gv2('ec2-rel'),phone:gv2('ec2-hphone')},
    personal:{work:gv2('ph-work'),edu:gv2('ph-edu'),hobbies:gv2('ph-hobbies'),religion:gv2('ph-religion'),hopes:gv2('ph-hopes')},
    ptSig:_ptSig||'',asSig:_asSig||'',savedAt:new Date().toISOString()};
}
function fillAssessmentFromJSON(data){
  var sv=function(id,v){var el=document.getElementById(id);if(el)el.value=v||'';};
  if(data.date)sv('as-date',data.date);if(data.assessor)sv('as-assessor',data.assessor);
  if(data.adl){sv('adl-bathing-st',data.adl.bathing);sv('adl-hygiene-st',data.adl.hygiene);sv('adl-dressing-st',data.adl.dressing);sv('adl-mobility-st',data.adl.mobility);sv('adl-transfer-st',data.adl.transfer);sv('adl-eating-st',data.adl.eating);sv('adl-toilet-st',data.adl.toilet);}
  if(data.medications)data.medications.forEach(function(m,i){sv('med-'+(i+1)+'-name',m.name);sv('med-'+(i+1)+'-dose',m.dose);sv('med-'+(i+1)+'-reason',m.reason);});
  if(data.caregiver){sv('care-name',data.caregiver.name);sv('care-rel',data.caregiver.rel);sv('care-hphone',data.caregiver.phone);}
  if(data.personal){sv('ph-work',data.personal.work);sv('ph-edu',data.personal.edu);sv('ph-hobbies',data.personal.hobbies);sv('ph-religion',data.personal.religion);sv('ph-hopes',data.personal.hopes);}
}
function saveAssessment(){
  if(!_asmt.mid){alert('멤버가 선택되지 않았습니다');return;}
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(_asmt.mid);});
  var mName=member?(member['한글이름']||''):'';
  var data=collectAssessmentData();
  var author=_currentUser?(_currentUser.name||''):'';
  apiCall({action:'upsert',sheet:'PCSP',key:'멤버ID',value:_asmt.mid,data:{'멤버ID':_asmt.mid,'한글이름':mName,'작성일':data.date,'작성자':data.assessor||author,'상태':'Assessment완료'}}).catch(function(){});
  saveJSONtoDrive(_asmt.mid,mName,'Assessment',data).then(function(res){
    if(res&&res.ok&&res.data&&res.data.success){alert('✅ Assessment 저장 완료!\n'+mName);closeFrmBack();}
    else alert('❌ Drive 저장 실패');
  }).catch(function(){alert('❌ 네트워크 오류');});
}
function goToFormsAndOpenPCSP(){closeFrmBack();setTimeout(function(){prefillPCSPFromMember(_asmt.mid);},300);}

function openNutritionForMember(mid,mName){
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(mid);});
  if(!member){alert('멤버 정보를 찾을 수 없습니다');return;}
  _nsMid=mid;
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='none';
  document.getElementById('frm-nutrition').style.display='block';
  var pv=document.getElementById('pcsp-list-view');if(pv)pv.style.display='none';
  var nn=document.getElementById('ns-name');if(nn)nn.textContent=member['한글이름']+' ('+member['영문이름']+')';
  var nd=document.getElementById('ns-dob');if(nd)nd.textContent=(member['생년월일']||'').slice(0,10);
  var ndate=document.getElementById('ns-date');if(ndate)ndate.value=new Date().toISOString().slice(0,10);
  _nsMemberSig=null;_nsStaffSig=null;
  initSigCanvas('ns-member-canvas','ns-member-empty',function(d){_nsMemberSig=d;});
  initSigCanvas('ns-staff-canvas','ns-staff-empty',function(d){_nsStaffSig=d;});
}
function calcNSBMI(){var h=parseFloat((document.getElementById('ns-height')||{}).value||0);var w=parseFloat((document.getElementById('ns-weight')||{}).value||0);var el=document.getElementById('ns-bmi');if(el)el.value=(h>0&&w>0)?(w/(h*h)*703).toFixed(1):'';}
function clearNSSig(who){var cid=who==='member'?'ns-member-canvas':'ns-staff-canvas';var eid=who==='member'?'ns-member-empty':'ns-staff-empty';clearSigCanvas(cid,eid);if(who==='member')_nsMemberSig=null;else _nsStaffSig=null;}
function generateNutritionPDF(){
  if(!_nsMid){alert('멤버가 선택되지 않았습니다');return;}
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(_nsMid);});
  var mName=member?(member['한글이름']||''):'';
  var gv2=function(id){var el=document.getElementById(id);return el?el.value:'';};
  var gc=function(id){var el=document.getElementById(id);return el&&el.checked?'✅':'☐';};
  var nsData={mid:_nsMid,memberName:mName,date:gv2('ns-date'),height:gv2('ns-height'),weight:gv2('ns-weight'),bmi:gv2('ns-bmi'),memberSig:_nsMemberSig||'',staffSig:_nsStaffSig||'',savedAt:new Date().toISOString()};
  saveJSONtoDrive(_nsMid,mName,'Nutrition',nsData).catch(function(){});
  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nutrition - '+mName+'</title><style>body{font-family:Arial,sans-serif;font-size:10px;margin:20px}h1{font-size:13px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:10px}td,th{border:1px solid #ccc;padding:5px 8px}th{background:#f5f5f5;font-weight:700}.sig{height:60px}@media print{button{display:none}}</style></head><body>'
    +'<h1>NUMBER ONE ADULT DAYCARE — Nutrition Screening</h1>'
    +'<table><tr><th>Participant</th><td>'+mName+'</td><th>Date</th><td>'+nsData.date+'</td></tr><tr><th>Height</th><td>'+nsData.height+'"</td><th>Weight</th><td>'+nsData.weight+' lbs</td></tr><tr><th>BMI</th><td colspan="3">'+nsData.bmi+'</td></tr></table>'
    +'<table><tr><th colspan="3">Questions</th></tr>'
    +'<tr><td>1. Underweight BMI &lt;18</td><td>'+gc('ns-q1-no')+' No</td><td>'+gc('ns-q1-yes')+' Yes</td></tr>'
    +'<tr><td>2. Obese BMI &gt;30</td><td>'+gc('ns-q2-no')+' No</td><td>'+gc('ns-q2-yes')+' Yes</td></tr>'
    +'<tr><td>3. Unintentional Weight Loss</td><td>'+gc('ns-q3-no')+' No</td><td>'+gc('ns-q3-yes')+' Yes</td></tr>'
    +'<tr><td>4. Diabetes/HgbA1c &gt;5.7%</td><td>'+gc('ns-q4-no')+' No</td><td>'+gc('ns-q4-yes')+' Yes</td></tr>'
    +'<tr><td>5. Chronic Kidney Disease</td><td>'+gc('ns-q5-no')+' No</td><td>'+gc('ns-q5-yes')+' Yes</td></tr></table>'
    +'<table><tr><th>Member Sig</th><th>Staff Sig</th></tr><tr><td class="sig">'+(nsData.memberSig?'<img src="'+nsData.memberSig+'" style="height:55px">':'')+'</td><td class="sig">'+(nsData.staffSig?'<img src="'+nsData.staffSig+'" style="height:55px">':'')+'</td></tr></table>'
    +'<button onclick="window.print()">🖨️ 인쇄</button></body></html>';
  var w=window.open('','_blank');if(!w){alert('팝업을 허용해주세요');return;}w.document.write(html);w.document.close();setTimeout(function(){w.print();},800);
}

function openMemberRightsForMember(mid,mName){
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(mid);});
  if(!member){alert('멤버 정보를 찾을 수 없습니다');return;}
  _mrMid=mid;
  var hub=document.getElementById('forms-hub');if(hub)hub.style.display='none';
  document.getElementById('frm-member-rights').style.display='block';
  var pv=document.getElementById('pcsp-list-view');if(pv)pv.style.display='none';
  var mn=document.getElementById('mr-name');if(mn)mn.textContent=member['한글이름']+' ('+member['영문이름']+')';
  var md=document.getElementById('mr-dob');if(md)md.textContent=(member['생년월일']||'').slice(0,10);
  var mdate=document.getElementById('mr-date');if(mdate)mdate.value=new Date().toISOString().slice(0,10);
  _mrSig=null;initSigCanvas('mr-sig-canvas','mr-sig-empty',function(d){_mrSig=d;});
}
function clearMRSig(){clearSigCanvas('mr-sig-canvas','mr-sig-empty');_mrSig=null;}
function generateMemberRightsPDF(){
  if(!_mrMid){alert('멤버가 선택되지 않았습니다');return;}
  var member=_formsMemberCache.find(function(m){return String(m['ID'])===String(_mrMid);});
  var mName=member?(member['영문이름']||''):'';
  var date=(document.getElementById('mr-date')||{}).value||new Date().toISOString().slice(0,10);
  var rep=(document.getElementById('mr-rep')||{}).value||'';
  var repRel=(document.getElementById('mr-rep-rel')||{}).value||'';

  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Participant Rights - '+mName+'</title>'
    +'<style>body{font-family:Arial,sans-serif;font-size:9.5px;margin:20px;line-height:1.5}'
    +'h1{font-size:12px;text-align:center;margin-bottom:2px}'
    +'.sub{font-size:8.5px;color:#555;text-align:center;margin-bottom:10px}'
    +'.sec{margin-bottom:8px;padding-left:8px;border-left:3px solid #D85A30}'
    +'.sec-title{font-weight:700;font-size:10px;margin-bottom:3px}'
    +'.sec-body{font-size:9px;line-height:1.6}'
    +'table{width:100%;border-collapse:collapse;margin-top:8px}'
    +'td,th{border:1px solid #999;padding:5px 8px;vertical-align:top}'
    +'th{background:#f0f0f0;font-weight:700;width:35%}'
    +'.sig-row{height:55px}@media print{button{display:none}}</style></head><body>'
    +'<h1>NUMBER ONE ADULT DAYCARE — PARTICIPANT\'S BILL OF RIGHTS</h1>'
    +'<p class="sub">161-22 Northern Blvd 1FL, Flushing, NY 11358 · 718-799-0248</p>'
    +'<table style="margin-bottom:10px"><tr><th>Participant Name</th><td>'+mName+'</td><th>Date</th><td>'+date+'</td></tr>'
    +'<tr><th>Date of Birth</th><td>'+(member?String(member['생년월일']||'').slice(0,10):'')+'</td><th>Medicaid #</th><td>'+(member?member['Medicaid']||'':'')+'</td></tr></table>'

    +'<div class="sec"><div class="sec-title">I. Fundamental Rights: Dignity, Safety, and Freedom</div><div class="sec-body">'
    +'<b>Non-Discrimination and Respect:</b> You have the right not to be discriminated against by race, skin color, or national origin. You have the right to respect and treatment as an adult and to personal treatment and help.<br>'
    +'<b>Dignity and Safety:</b> You have the right to privacy, dignity, and respect. You have the right to be free from any form of restraint including chemical, physical, or mechanical restraints, and free from abuse, neglect, intimidation, coercion, and seclusion.<br>'
    +'<b>Environment:</b> You have the right to a safe and pleasant environment with careful attention.</div></div>'

    +'<div class="sec" style="border-left-color:#185FA5"><div class="sec-title">II. Rights to Control and Self-Determination</div><div class="sec-body">'
    +'<b>Service Choice:</b> You have the right to choose your own day care center services and activities and to direct your service plan.<br>'
    +'<b>Program Involvement:</b> You have the right to participate in the organization and operation of the program.<br>'
    +'<b>Personal Development:</b> You have the right to pursue personal interests and develop hobbies.<br>'
    +'<b>Personal Control:</b> You have control over personal finances and daily schedule, including the right to participate with modifications if needed.<br>'
    +'<b>Staff and Withdrawal:</b> You have the right to request preferred staff for personal care needs and to stop the adult day care program at any time.</div></div>'

    +'<div class="sec" style="border-left-color:#0F6E56"><div class="sec-title">III. Rights to Communication, Privacy, and Information</div><div class="sec-body">'
    +'<b>Private Space:</b> You have access to a private space for dining, speaking on the phone, and meeting with visitors.<br>'
    +'<b>Communication:</b> You have the right to exchange and communicate with other participants and the community.<br>'
    +'<b>Information Access:</b> You have the right to receive information about your rights and to confirm consent forms related to personal information.<br>'
    +'<b>Grievance:</b> You have the right to request correction of injustice regarding discriminatory treatment.<br>'
    +'<b>Notification:</b> You have the right to be informed of decisions that affect your care.</div></div>'

    +'<div class="sec" style="border-left-color:#534AB7"><div class="sec-title">IV. Rights to Opportunities and Choices</div><div class="sec-body">'
    +'<b>Opportunities:</b> You have the right to seek employment or volunteer opportunities.<br>'
    +'<b>Choices:</b> You have choices of services and visitors; choices of meals and mealtimes; choices of alternatives to services and activities; choices of community integration; and choices of attending appointments and social opportunities.</div></div>'

    +'<div style="font-size:9px;background:#f9f9f9;border:1px solid #ddd;padding:8px;border-radius:4px;margin:8px 0">'
    +'<b>Acknowledgment of Participant Rights:</b> I, the undersigned, have received, read, and/or had the Participant\'s Bill of Rights explained to me in a language I understand. '
    +'I acknowledge that I understand my rights and expectations as a participant at Number One Adult Daycare.</div>'

    +'<table><tr><th>Participant Signature</th><td class="sig-row">'
    +(_mrSig?'<img src="'+_mrSig+'" style="max-height:50px;max-width:100%">':'')
    +'</td><th>Date</th><td>'+date+'</td></tr>'
    +(rep
      ?'<tr><th>Representative / Guardian</th><td>'+rep+'</td><th>Relationship</th><td>'+repRel+'</td></tr>'
       +'<tr><th>Representative Signature</th><td class="sig-row"></td><th>Date</th><td></td></tr>'
      :'')
    +'<tr><th>Staff Witness Signature</th><td class="sig-row"></td><th>Date</th><td></td></tr>'
    +'</table>'
    +'<p style="font-size:8px;margin-top:8px;color:#555">This document has been prepared in accordance with the Number One Adult Daycare Policies and Procedures manual.</p>'
    +'<button onclick="window.print()">🖨️ 인쇄 / PDF 저장</button></body></html>';

  var w=window.open('','_blank');if(!w){alert('팝업을 허용해주세요');return;}
  w.document.write(html);w.document.close();setTimeout(function(){w.print();},800);
}

function initSigCanvas(canvasId,emptyId,onSave){
  var canvas=document.getElementById(canvasId);if(!canvas||canvas._sigInit)return;canvas._sigInit=true;
  var ctx=canvas.getContext('2d');ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  var drawing=false,lx=0,ly=0;
  function getPos(e){var rect=canvas.getBoundingClientRect();var sx=canvas.width/rect.width,sy=canvas.height/rect.height;if(e.touches)return{x:(e.touches[0].clientX-rect.left)*sx,y:(e.touches[0].clientY-rect.top)*sy};return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy};}
  function start(e){e.preventDefault();drawing=true;var p=getPos(e);lx=p.x;ly=p.y;var em=document.getElementById(emptyId);if(em)em.style.display='none';}
  function draw(e){if(!drawing)return;e.preventDefault();var p=getPos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;}
  function stop(){if(!drawing)return;drawing=false;if(onSave)onSave(canvas.toDataURL('image/png'));}
  canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',draw);canvas.addEventListener('mouseup',stop);canvas.addEventListener('mouseleave',stop);
  canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',draw,{passive:false});canvas.addEventListener('touchend',stop);
}
function clearSigCanvas(canvasId,emptyId){
  var canvas=document.getElementById(canvasId);if(canvas){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas._sigInit=false;}
  var em=document.getElementById(emptyId);if(em)em.style.display='flex';
}

// ── 멤버별 ID 업로드 ──────────────────────────────────────
function uploadMemberID(mid, mName, docType){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png';
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file)return;
    var status = '📤 업로드 중...';
    alert(status+'\n'+file.name+'\n멤버: '+mName+'\n종류: '+docType);
    var reader = new FileReader();
    reader.onload = function(ev){
      var b64 = ev.target.result.split(',')[1];
      var ext = file.name.split('.').pop().toLowerCase();
      apiCall({
        action:'savePDF', memberId:mid, memberName:mName,
        fileType:docType, base64Data:b64,
        author:_currentUser?(_currentUser.name||''):''
      }).then(function(res){
        if(res&&res.ok&&res.data&&res.data.success){
          alert('✅ '+docType+' 업로드 완료!\n'+mName);
          renderFormsHub();
        } else {
          alert('❌ 업로드 실패. Drive 연결을 확인해주세요.');
        }
      }).catch(function(){ alert('❌ 네트워크 오류'); });
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ══════════════════════════════════════════════════════════
// HIPAA FORM
// ══════════════════════════════════════════════════════════
var _hipaaeSig = null;

function openHIPAAForMember(mid, mName){
  var member = _formsMemberCache.find(function(m){return String(m['ID'])===String(mid);});
  if(!member){ alert('멤버 정보를 찾을 수 없습니다'); return; }

  document.getElementById('hipaa-member-id').value = mid;
  document.getElementById('hipaa-member-name').value = mName;
  document.getElementById('hipaa-name').value = (member['영문이름']||'').toUpperCase();
  document.getElementById('hipaa-dob').value = (member['생년월일']||'').slice(0,10);
  document.getElementById('hipaa-addr').value = member['주소']||'';
  document.getElementById('hipaa-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('hipaa-ssn').value = '';
  document.getElementById('hipaa-extra').value = '';
  document.getElementById('hipaa-rep').value = '';
  document.getElementById('hipaa-rep-rel').value = '';
  document.getElementById('hipaa-init-alcohol').value = '';
  document.getElementById('hipaa-init-mh').value = '';
  document.getElementById('hipaa-init-hiv').value = '';
  document.getElementById('hipaa-save-status').textContent = '';

  document.getElementById('hipaa-mltc-display').textContent = member['MLTC']||member['보험사']||'—';
  document.getElementById('hipaa-pcp-display').textContent = member['주치의']||'—';
  var pcsp = PCSP_LIST.find(function(p){ return p.medicaid===mid||p.nameKr===mName; });
  var ec = (pcsp&&pcsp.contacts&&pcsp.contacts[0]) ? pcsp.contacts[0].name+' ('+pcsp.contacts[0].rel+')' : '(PCSP 연락처 참조)';
  document.getElementById('hipaa-ec-display').textContent = ec;

  // 서명 캔버스 초기화
  _hipaaeSig = null;
  var canvas = document.getElementById('hipaa-sig-canvas');
  if(canvas){ canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); canvas._sigInit=false; }
  var empty = document.getElementById('hipaa-sig-empty'); if(empty) empty.style.display='flex';
  initSigCanvas('hipaa-sig-canvas','hipaa-sig-empty',function(d){_hipaaeSig=d;});

  openOv('ov-hipaa');
}

function clearHIPAASig(){
  clearSigCanvas('hipaa-sig-canvas','hipaa-sig-empty');
  _hipaaeSig = null;
}

// OCA-960 공식 PDF (base64 임베드)
var OCA960_PDF_B64 = "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PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6cGRmPSJodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgICAgICAgICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iPgogICAgICAgICA8cGRmOlByb2R1Y2VyPkFjcm9iYXQgUERGV3JpdGVyIDUuMCBmb3IgV2luZG93cyBOVDwvcGRmOlByb2R1Y2VyPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAwNC0wMi0xN1QxNjoyMzo0NVo8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAxNS0wNS0wN1QxNDoxMzo1NC0wNDowMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMTUtMDUtMDdUMTQ6MTM6NTQtMDQ6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+SGlwYWEgMi0xNy0wNCAtIE1pY3Jvc29mdCBXb3JkPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgIDxkYzpmb3JtYXQ+YXBwbGljYXRpb24vcGRmPC9kYzpmb3JtYXQ+CiAgICAgICAgIDxkYzp0aXRsZT4KICAgICAgICAgICAgPHJkZjpBbHQ+CiAgICAgICAgICAgICAgIDxyZGY6bGkgeG1sOmxhbmc9IngtZGVmYXVsdCI+SGlwYWEgMi0xNy0wNC5ydGY8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6QWx0PgogICAgICAgICA8L2RjOnRpdGxlPgogICAgICAgICA8ZGM6Y3JlYXRvcj4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGk+SlJDPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAgPC9kYzpjcmVhdG9yPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD51dWlkOmYwZjg5MWY1LWIwYmItNGQ2ZS05NGI4LWM2Y2U3YmM1MjVjYzwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOkluc3RhbmNlSUQ+dXVpZDpiMDI0NmFkNy01Njk3LTQ0MzQtYmQ4Mi0zMzcwZjI2ZjZmOWI8L3htcE1NOkluc3RhbmNlSUQ+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBlbmQ9InciPz5lbmRzdHJlYW0KZW5kb2JqCjQ2IDAgb2JqCjw8IC9UeXBlIC9PYmpTdG0gL0xlbmd0aCA2MSAvRmlsdGVyIC9GbGF0ZURlY29kZSAvTiAxIC9GaXJzdCA1ID4+CnN0cmVhbQp4nDMxVzDgsrFR0HfOL80rUTBS0PfOTClWiFYwNVYwUAhSsDAAU7EK+iGVBakK+gGJ6anFCnZ2XACNag4kZW5kc3RyZWFtCmVuZG9iago0OCAwIG9iago8PCAvVHlwZSAvT2JqU3RtIC9MZW5ndGggNjY5IC9GaWx0ZXIgL0ZsYXRlRGVjb2RlIC9OIDMgL0ZpcnN0IDE4ID4+CnN0cmVhbQp4nI1U227bMAx931foBzbFXZslQFHA3TwswNAAW/LQDXtQJNoWKkupLt2yrx9tMZExYMBeTFPkOaQPaV2v2YLdLNjqmt1UrFquX93eMn4vAnx0NjL+CcwLRC0F442VTmnbjYkL9oXxBzFAzmD8azrE0xHdHT6rbBifOO7u/uLc6QHC63tn1D9Jd/re/Q/pB9224MFKCOw7u7pm/ODhBZOk8M6i0V6moTXwi3HlopASxg76ZDvh02BEQs91zsIT437sg0dtFLC3a8afk4sQ8NAAWy8Z77xA6upqhVWSMYBQJboO/Nmqg2EcjNHHoAO+DUqEHq3NtjUOS6D1QkY9ttclbaYCBto4c73uevQHbRPyHMHH3qUgrKKmsNAB5Sxexp89gk/uLDI/nspkjuiFgkF4VKDVY5eMfw5m6njb4BBIykelUenpw77RESpqIAQEGQI45AsU/Z1ttVzgmJN3+IbzkcmP8zqhtxyn5Z7AHoRHF2UtJaQ7nqhf51ULKIW2KP67KyzmOlxIYx0G3+BTQYvDg04H/EZAjQYhc3/QecCOjiYF0jL+dCGhoNrh1GKP4eIKmSJmD4lVq7eT7NqpcWEyqwSljcEfAbelgLC7QQSZzNTeajWFn5PwcdwLfO+FaakUHQdWrfEz6rxPvKa69XxZ67yGvC6S1Hk/a5zJ+0svDZE0RNLMSZoC3lDehvI287xNyWsiTvGBim8JtCXQdg7anpMKeEgm6qM54SHtw54Y9sSwnzPsC/KR4rve+fG/AD/gth8MhgRRCEoRcwpBTYhCJbJMYrwELjIBkQCRwJwEClhTnqY8Pc/TJQ9GmSwVdwRyBHJzkDsnFbDSL3o6IpES4RPh0xyfCu5E8ZhFOl0iP85X4+U2xevxDxARBNZlbmRzdHJlYW0KZW5kb2JqCjUyIDAgb2JqCjw8IC9CQm94IFsgMCAwIDI5MS43NzU4IDE1LjE5MDA2IF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbIC9QREYgXSA+PiAvU3VidHlwZSAvRm9ybSAvTGVuZ3RoIDE5IC9GaWx0ZXIgL0ZsYXRlRGVjb2RlID4+CnN0cmVhbQp4nNMPqVBw8nVWcPV1BgARpwLjZW5kc3RyZWFtCmVuZG9iago1MyAwIG9iago8PCAvQW5ub3RzIDYgMCBSIC9Db250ZW50cyBbIDgxIDAgUiA4MiAwIFIgODMgMCBSIDg0IDAgUiA4NSAwIFIgODYgMCBSIDg3IDAgUiA4OCAwIFIgXSAvQ3JvcEJveCBbIDAgMCA2MTIgNzkyIF0gL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDQ3IDAgUiAvUmVzb3VyY2VzIDw8IC9Db2xvclNwYWNlIDw8IC9DUzAgWyAvSW5kZXhlZCAvRGV2aWNlUkdCIDI1NSA4OSAwIFIgXSAvQ1MxIDI5IDAgUiAvQ1MyIDMwIDAgUiA+PiAvRXh0R1N0YXRlIDw8IC9HUzAgMzEgMCBSID4+IC9Gb250IDw8IC9UVDAgMzMgMCBSIC9UVDEgMzUgMCBSIC9UVDIgMzcgMCBSIC9UVDMgNDAgMCBSIC9UVDQgNDIgMCBSID4+IC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VDIC9JbWFnZUkgXSAvWE9iamVjdCA8PCAvSW0wIDkwIDAgUiA+PiA+PiAvUm90YXRlIDAgL1R5cGUgL1BhZ2UgPj4KZW5kb2JqCjU0IDAgb2JqCjw8IC9CQm94IFsgMCAwIDU0My42Nzc2OSAxNS44MjI5OCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWyAvUERGIF0gPj4gL1N1YnR5cGUgL0Zvcm0gL0xlbmd0aCAxOSAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJzTD6lQcPJ1VnD1dQYAEacC42VuZHN0cmVhbQplbmRvYmoKNTUgMCBvYmoKPDwgL0JCb3ggWyAwIDAgNi43NSA3LjUgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsgL1BERiBdID4+IC9TdWJ0eXBlIC9Gb3JtIC9MZW5ndGggMzEgL0ZpbHRlciAvRmxhdGVEZWNvZGUgPj4Kc3RyZWFtCnicM9AzN7FUSFcwAEIzPXNTBXM9U4WiVIU0AEA+BVFlbmRzdHJlYW0KZW5kb2JqCjU2IDAgb2JqCjw8IC9CQm94IFsgMCAwIDYuNzUgNy41IF0gL0ZpbHRlciAvRmxhdGVEZWNvZGUgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvWmFEYiAxNCAwIFIgPj4gL1Byb2NTZXQgWyAvUERGIC9UZXh0IF0gPj4gL1N1YnR5cGUgL0Zvcm0gL0xlbmd0aCAxMDEgPj4Kc3RyZWFtCkiJJMo7CoAwEEXR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";

async function saveHIPAAWithSig(){
  var mid = document.getElementById('hipaa-member-id').value;
  var mName = document.getElementById('hipaa-member-name').value;
  if(!mid){ alert('멤버를 선택해주세요'); return; }
  if(!_hipaaeSig){ alert('서명을 먼저 해주세요'); return; }
  if(typeof PDFLib==='undefined'){ alert('PDF 라이브러리 로딩 중입니다.'); return; }

  var statusEl = document.getElementById('hipaa-save-status');
  if(statusEl) statusEl.textContent = '📤 PDF 생성 중...';

  try {
    var name    = document.getElementById('hipaa-name').value;
    var dob     = document.getElementById('hipaa-dob').value;
    var ssn     = document.getElementById('hipaa-ssn').value||'';
    var addr    = document.getElementById('hipaa-addr').value;
    var date    = document.getElementById('hipaa-date').value;
    var mltc    = document.getElementById('hipaa-mltc-display').textContent;
    var pcp     = document.getElementById('hipaa-pcp-display').textContent;
    var ec      = document.getElementById('hipaa-ec-display').textContent;
    var extra   = document.getElementById('hipaa-extra').value;
    var initAlc = document.getElementById('hipaa-init-alcohol').value;
    var initMH  = document.getElementById('hipaa-init-mh').value;
    var initHIV = document.getElementById('hipaa-init-hiv').value;
    var rep     = document.getElementById('hipaa-rep').value;
    var repRel  = document.getElementById('hipaa-rep-rel').value;

    var pdfBytes = Uint8Array.from(atob(OCA960_PDF_B64), function(c){return c.charCodeAt(0);});
    var pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    var form = pdfDoc.getForm();
    var page = pdfDoc.getPages()[0];
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    // 한글 포함 여부 체크
    function hasKorean(s){ return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(s); }

    // 폼 필드 세팅 (영어만) — 실패 시 좌표 오버레이로 fallback
    function safeSetText(fieldName, value, x, y, sz){
      if(!value) return;
      try{
        if(!hasKorean(value)){
          form.getTextField(fieldName).setText(value);
        } else {
          // 한글 포함 → 좌표 오버레이 (폼 필드 비우기)
          page.drawText(value.replace(/[^\x20-\x7E]/g,''), {x:x, y:y, size:sz||8, font:font, color:PDFLib.rgb(0,0,0)});
        }
      } catch(e){
        try{ page.drawText(String(value).substring(0,60), {x:x, y:y, size:sz||8, font:font, color:PDFLib.rgb(0,0,0)}); }catch(e2){}
      }
    }

    function safeCheck(fieldName){
      try{ form.getCheckBox(fieldName).check(); }catch(e){}
    }

    // 환자 정보 (영문)
    safeSetText('Name', name, 38, 700, 9);
    safeSetText('Date', dob, 339, 700, 9);
    safeSetText('SS', ssn, 471, 700, 9);
    safeSetText('Address', addr, 38, 671, 8);

    // Item 7 — 센터 정보
    safeSetText('Provider Name', 'Number One Adult Daycare, 161-22 Northern Blvd 1FL, Flushing, NY 11358 / 718-799-0248', 43, 381, 7);

    // Item 8 — 공개 대상 (한글 가능성 → 안전 처리)
    var recipients = 'MLTC: '+mltc+' | PCP: '+pcp+' | EC: '+ec+(extra?' | '+extra:'');
    // 한글 제거 후 폼 필드에 입력
    var recipientsClean = recipients.replace(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g, '');
    safeSetText('Receipient Name', recipientsClean, 43, 356, 7);

    // Item 9(a) — Entire Medical Record
    safeCheck('Entire Med Rec');

    // 이니셜
    var inits = [];
    if(initAlc) inits.push('Alcohol/Drug: '+initAlc);
    if(initMH)  inits.push('Mental Health: '+initMH);
    if(initHIV) inits.push('HIV: '+initHIV);
    if(inits.length){
      safeCheck('Other');
      safeSetText('Other Text', inits.join('; '), 95, 290, 8);
    }

    // Item 10
    safeCheck('Request Of');

    // Item 11
    safeSetText('Event', 'Upon Disenrollment from the program', 312, 150, 8);

    // Item 12/13 대리인 (영문으로 입력하므로 OK)
    if(rep){
      var repClean = rep.replace(/[\uac00-\ud7af]/g, '');
      safeSetText('Other Name', repClean, 33, 122, 8);
    }
    if(repRel) safeSetText('Authority', repRel, 310, 122, 8);

    // 서명 이미지 — 리사이즈하여 용량 줄이기
    var sigCanvas = document.getElementById('hipaa-sig-canvas');
    var miniCanvas = document.createElement('canvas');
    miniCanvas.width = 200; miniCanvas.height = 44;
    miniCanvas.getContext('2d').drawImage(sigCanvas, 0, 0, 200, 44);
    var miniSigUrl = miniCanvas.toDataURL('image/png');
    var sigB64 = miniSigUrl.replace(/^data:image\/png;base64,/,'');
    var sigBytes = Uint8Array.from(atob(sigB64), function(c){return c.charCodeAt(0);});
    var pngImage = await pdfDoc.embedPng(sigBytes);
    page.drawImage(pngImage, { x:45, y:62, width:190, height:38 });

    // 서명 날짜
    page.drawText(date, { x:385, y:75, size:10, font:font, color:PDFLib.rgb(0,0,0) });

    // 폼 평면화
    form.flatten();

    // 저장
    if(statusEl) statusEl.textContent = '📤 Drive 업로드 중...';
    var filledBytes = await pdfDoc.save();
    console.log('PDF 크기:', (filledBytes.length/1024).toFixed(1)+'KB');
    var binary = '';
    var bytes = new Uint8Array(filledBytes);
    var chunk = 8192;
    for(var i=0;i<bytes.length;i+=chunk){
      binary += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
    }
    var outB64 = btoa(binary);

    var author = _currentUser?(_currentUser.name||''):'';
    console.log('HIPAA PDF 크기:', (filledBytes.length/1024).toFixed(1)+'KB', 'base64:', (outB64.length/1024).toFixed(1)+'KB');

    // apiCall 사용 (다른 savePDF와 동일 방식)
    if(statusEl) statusEl.textContent = '📤 Drive 업로드 중...';
    apiCall({
      action:'savePDF', memberId:mid, memberName:mName,
      fileType:'HIPAA', base64Data:outB64, author:author
    }).then(function(res){
      console.log('Drive 응답:', res);
      if(res&&res.ok&&res.data&&res.data.success){
        if(statusEl) statusEl.textContent = '✅ 저장 완료!';
        setTimeout(function(){
          closeOv('ov-hipaa');
          alert('✅ HIPAA Form (OCA-960) 저장 완료!\n'+mName);
        }, 800);
      } else {
        var errMsg = (res&&res.error)?res.error:(res&&res.data&&res.data.error)?res.data.error:'알 수 없는 오류';
        if(statusEl) statusEl.textContent = '❌ 실패: '+errMsg;
        console.error('Drive 저장 실패 상세:', JSON.stringify(res));
      }
    }).catch(function(err){
      if(statusEl) statusEl.textContent = '❌ 네트워크 오류: '+err.message;
      console.error('Drive 네트워크 오류:', err);
    });

  } catch(err){
    if(statusEl) statusEl.textContent = '❌ PDF 생성 오류: '+err.message;
    console.error('HIPAA PDF Error:', err);
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  var fsearch = document.getElementById('forms-search');
  if(fsearch) fsearch.addEventListener('input', filterFormsMembers);

  var fclear = document.getElementById('forms-clear-btn');
  if(fclear) fclear.addEventListener('click', clearFormsSearch);

  var pmq = document.getElementById('pcsp-member-q');
  if(pmq) pmq.addEventListener('input', renderPCSPMemberList);
});
