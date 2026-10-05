// SADC training register. Existing legacy rows remain read-only.
// Shared settings rows reuse the deployed API and its optimistic write tokens.
var TR_SESSIONS=[], TR_PROFILES={}, _trView='session', TR_READY=false, TR_BUSY=false;
var TR_PREFIX='sadc_training_v2:', TR_PROFILE_PREFIX='sadc_training_profile_v2:';
var TR_TOPICS=[
 ['orientation','Program / provider / community orientation','General'],
 ['elderly','Working with older adults / aging','General'],
 ['participant_rights','Participant rights, dignity and choice','General'],
 ['safety','Safety / accident prevention','General'],
 ['personal_care','Personal care skills overview','Personal care',true],
 ['body_mechanics','Body mechanics','Pre-service'],
 ['behavior','Behavior management','Pre-service'],
 ['toileting','Toileting / incontinence care','Personal care',true],
 ['feeding','Eating / feeding assistance','Personal care',true],
 ['grooming','Grooming / dressing / bathing','Personal care',true],
 ['transfers','Transfers / mobility','Personal care',true],
 ['med_assist','Assistance with self-administration of medication','Personal care',true],
 ['adaptive','Adaptive / assistive equipment','Personal care',true],
 ['socialization','Socialization skills and activities','Service staff'],
 ['supervision','Supervision and monitoring','Service staff'],
 ['family','Family and family relationships','Service staff'],
 ['mental_health','Mental illness and mental health','Service staff'],
 ['cpr','CPR training (certificate tracked separately)','Service staff'],
 ['aed','AED / choking response','Emergency'],
 ['fire','Use of fire extinguishers','Annual emergency'],
 ['evacuation','Written evacuation and emergency procedures','Annual emergency'],
 ['emergency_numbers','Emergency telephone numbers','Annual emergency'],
 ['hcbs','HCBS Settings Final Rule / site policies','HCBS'],
 ['pcp','Person-centered planning process and PCSP development','HCBS'],
 ['pc_thinking','Person-centered thinking and practice','HCBS'],
 ['community','Individual choice and community integration','HCBS'],
 ['supported_decision','Supported decision-making / cultural humility','HCBS'],
 ['abuse','Freedom from abuse, neglect, coercion and restraints','HCBS'],
 ['hipaa_training','Confidentiality / HIPAA','Site / role policy'],
 ['infection','Infection prevention','Site / role policy']
].map(function(t){return {id:t[0],label:t[1],group:t[2],rn:!!t[3]};});
var TR_INITIAL=['socialization','supervision','personal_care','family','mental_health','cpr'];
var TR_PRE=['personal_care','body_mechanics','behavior'];
var TR_FIRE=['fire','evacuation','emergency_numbers'];
function trEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function trToday(){return new Date().toLocaleDateString('sv-SE',{timeZone:'America/New_York'});}
function trVal(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function trChecked(id){var e=document.getElementById(id);return !!(e&&e.checked);}
function trLabel(id){var t=TR_TOPICS.find(function(t){return t.id===id;});return t?t.label:id;}
function trURL(s){try{var u=new URL(s);return u.protocol==='https:'?u.href:'';}catch(e){return '';}}
function trDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function trMonths(s,n){var d=new Date(s+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);var end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d.toISOString().slice(0,10);}
function trButton(text,action,index){return '<button class="btn-sm" data-tr-action="'+action+'" data-tr-index="'+index+'">'+text+'</button>';}
function trField(id,label,value,type){return '<label class="tr-field">'+label+'<input class="m-input" id="'+id+'" type="'+(type||'text')+'" value="'+trEsc(value)+'"></label>';}
function trSelect(id,label,options,value){return '<label class="tr-field">'+label+'<select class="m-select" id="'+id+'">'+options.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===value?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';}
function trName(st){return st.name||st.nameKr||st.id;}
function trActor(){return typeof _currentUser!=='undefined'&&_currentUser?(_currentUser.name||_currentUser.email||'operator'):'operator';}
async function trPut(key,value){var json=JSON.stringify(value);if(json.length>45000)throw new Error('기록이 너무 큽니다. 첨부 문서는 Drive 링크로 보관해주세요.');var r=await apiCall({action:'upsert',sheet:'settings',key:'Key',value:key,data:{Key:key,Value:json,'수정시각':new Date().toISOString()}});if(!r||r.ok!==true||!r.data||r.data.success!==true)throw new Error('저장 성공을 확인하지 못했습니다. 다시 불러와 확인해주세요.');}
async function loadTrFromSheets(){
 if(TR_BUSY||WriteGuard.editing()){trNotice('열린 편집을 저장하거나 닫은 후 새로고침해주세요.');return;}
 TR_READY=false;trNotice('교육기록 불러오는 중…');
 try{
  var results=await Promise.all([apiGet({action:'read',sheet:'training_log'}),apiGet({action:'read',sheet:'settings'})]);
  results.forEach(function(r){if(!r||!r.ok||!Array.isArray(r.data))throw new Error('교육 조회 응답 오류');});
  var list=[],profiles={},legacy={};
  results[0].data.forEach(function(r){var id=String(r['세션ID']||'');if(!id)return;var s=legacy[id];if(!s){var topics;try{topics=JSON.parse(r['토픽']||'[]');}catch(e){topics=[];}s=legacy[id]={id:id,legacy:true,date:String(r['날짜']||'').slice(0,10),hours:Number(r['시간'])||0,topics:Array.isArray(topics)?topics:[],title:'Legacy training',trainer:r['RN이름']||'',license:r['RN_LicenseID']||'',supervisor:r['수퍼바이저']||'',staff:[]};}if(r['스태프ID'])s.staff.push({id:String(r['스태프ID']),name:r['스태프이름']||'',hours:s.hours});});
  results[1].data.forEach(function(r){var key=String(r.Key||'');if(key.indexOf(TR_PREFIX)!==0&&key.indexOf(TR_PROFILE_PREFIX)!==0)return;var obj=JSON.parse(r.Value);if(key.indexOf(TR_PREFIX)===0){if(!obj||!obj.id||!Array.isArray(obj.staff)||!Array.isArray(obj.topics))throw new Error('교육 데이터 형식 오류: '+key);list.push(obj);}else profiles[key.slice(TR_PROFILE_PREFIX.length)]=obj;});
  list=list.concat(Object.values(legacy));var combined=WriteGuard.track({},results[0],results[1]);WriteGuard.adopt(combined,function(){TR_SESSIONS=list;TR_PROFILES=profiles;});
  TR_READY=true;renderTrSessionList();if(_trView==='staff'){loadTrStaffDropdown();renderTrStaffView();}trNotice('중앙 저장 자료 · '+trToday()+' 기준');
 }catch(e){trNotice('조회 실패 — 편집 잠금: '+e.message);}
}
function trNotice(msg){var el=document.getElementById('tr-notice');if(el)el.textContent=msg;}
function setTrView(v,el){_trView=v;document.querySelectorAll('#panel-training .fpill').forEach(function(p){p.classList.remove('active');});if(el)el.classList.add('active');document.getElementById('tr-session-view').style.display=v==='session'?'block':'none';document.getElementById('tr-staff-view').style.display=v==='staff'?'block':'none';if(v==='staff'){loadTrStaffDropdown();renderTrStaffView();}}
function trIssues(s,st){
 var out=[];if(s.legacy)out.push('기존 기록 검토 필요');if(s.voided)out.push('취소 기록');
 if(!trDate(s.date)||s.date>trToday())out.push('실제 교육일 확인');
 if(!s.title||!s.content||!s.material)out.push('교육 내용/자료 누락');
 if(!s.method)out.push('교육 방법 누락');
 if(!s.trainer||!s.qualification)out.push('교육자/자격 누락');
 if(s.topics.some(function(id){var t=TR_TOPICS.find(function(t){return t.id===id;});return t&&t.rn;})&&(!s.rnName||!s.license))out.push('RN 교육자/면허 확인');
 if(s.kind==='initial'&&!s.directorQualified)out.push('20시간 교육 지도자 자격 확인');
 if(!trURL(s.evidence))out.push('서명 원본 링크 누락');
 if(!trDate(s.signatureDate||'')||s.signatureDate<s.date||s.signatureDate>trToday()||!trDate(s.reviewerDate||'')||s.reviewerDate<s.date||s.reviewerDate>trToday())out.push('교육자/확인자 서명일 확인');
 if(!s.trainerSigned||!s.supervisorSigned||!s.supervisor||!s.signatureVerified)out.push('교육자·확인자 교차 서명 확인');
 if(!st.attended||!(st.hours>0)||st.hours>s.hours)out.push('참석/시간 확인');
 if(!st.signed||!trDate(st.signedDate)||st.signedDate<s.date||st.signedDate>trToday())out.push('직원 서명 확인');
 if(s.kind==='initial'&&(!st.assessor||!trDate(st.assessedDate)||st.assessedDate<s.date||st.assessedDate>trToday()||s.topics.some(function(t){return !(st.evaluated||[]).includes(t);})||!trURL(st.assessmentEvidence)))out.push('주제별 역량 평가/증빙 필요');
 return out;
}
function renderTrSessionList(){
 var el=document.getElementById('tr-session-list');if(!el)return;
 document.getElementById('tr-sessions').textContent=TR_SESSIONS.filter(function(s){return !s.voided;}).length;
 document.getElementById('tr-expired').textContent=TR_SESSIONS.filter(function(s){return !s.voided&&s.staff.some(function(st){return trIssues(s,st).length;});}).length;
 document.getElementById('tr-soon').textContent=TR_SESSIONS.filter(function(s){return s.locked&&!s.voided;}).length;
 el.innerHTML=TR_SESSIONS.map(function(s,i){var issues=s.staff.reduce(function(n,st){return n+(trIssues(s,st).length?1:0);},0);return '<div class="log-card"><b>'+trEsc(s.date)+' · '+trEsc(s.title)+'</b><p>'+s.hours+' hours · '+trEsc(s.kind||'legacy')+' · '+(s.voided?'취소':s.locked?'증빙 검토 확정':'작성/검토 중')+'</p><p>'+s.topics.map(trLabel).map(trEsc).join(' / ')+'</p><p>'+s.staff.map(function(st){return trEsc(st.name);}).join(', ')+'</p><p>확인 필요 '+issues+'명</p>'+trButton('열기 / 검토','edit',i)+trButton('그룹 서명부 출력','print',i)+(s.legacy?'':trButton('취소 기록 남기기','void',i))+'</div>';}).join('')||'<p>등록된 교육이 없습니다.</p>';
}
var TR_EDIT=null, TR_PROFILE_DIRTY=null;
function trDiscardProfile(){TR_PROFILE_DIRTY=null;WriteGuard.endEdit('training-profile');renderTrStaffView();}
if(typeof document!=='undefined')document.addEventListener('input',function(e){if(e.target.id&&e.target.id.indexOf('tr-profile-')===0){TR_PROFILE_DIRTY=trVal('tr-staff-select');WriteGuard.beginEdit('training-profile');}});
function openTrModal(id){
 if(!TR_READY){alert('교육 자료를 먼저 새로고침해주세요.');return;}if(TR_BUSY)return;
 var old=TR_SESSIONS.find(function(s){return s.id===id;});
 TR_EDIT=old?JSON.parse(JSON.stringify(old)):{id:'tr2_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),date:trToday(),topics:[],staff:[],kind:'inservice',createdAt:new Date().toISOString()};
 var s=TR_EDIT,readonly=!!(s.legacy||s.locked||s.voided);
 var h='<div class="modal-title"><span>교육 주제 · 참석 · 교차 서명</span><button onclick="closeOv(\'ov-tr\')">✕</button></div><p>서명은 출력물에 직접 받고 스캔본을 연결합니다. 이름 입력은 전자서명이 아닙니다.</p><fieldset '+(readonly?'disabled':'')+'>';
 h+='<div class="tr-grid">'+trField('tr-title','교육명 *',s.title)+trField('tr-date','실시일 *',s.date,'date')+trSelect('tr-kind','교육 구분',[['orientation','Orientation'],['pre','Pre-service'],['initial','Initial 20-hour'],['inservice','Annual in-service'],['hcbs','HCBS / PCP'],['remediation','Remediation']],s.kind)+trField('tr-hours','실제 교육시간 (휴식 제외) *',s.hours,'number')+trField('tr-start','시작 시간',s.start,'time')+trField('tr-end','종료 시간',s.end,'time')+trField('tr-break','휴식 (분)',s.breakMinutes||0,'number')+trField('tr-method','교육 방법 (대면/온라인/OJT)',s.method)+'</div>';
 h+='<h3>실제 교육한 Topic만 선택</h3><p>같은 교육의 시간을 주제 수만큼 중복 합산하지 않습니다. 반복 주기는 규정에 명시된 항목만 적용합니다.</p><div class="tr-topics">';
 TR_TOPICS.forEach(function(t){h+='<label><input type="checkbox" id="trtopic-'+t.id+'" '+(s.topics.includes(t.id)?'checked':'')+'> '+trEsc(t.label)+(t.rn?' [RN]':'')+' <small>'+t.group+'</small></label>';});h+='</div>';
 h+=trField('tr-content','교육 내용 / 학습 목표 *',s.content)+trField('tr-material','교육자료명·정책 버전 / 링크 *',s.material);
 h+='<div class="tr-grid">'+trField('tr-trainer','교육자 이름 *',s.trainer)+trField('tr-qualification','교육자 자격 / 관련 경력 *',s.qualification)+trField('tr-rn','개인 돌봄을 직접 교육한 RN 이름',s.rnName)+trField('tr-license','RN 면허번호',s.license)+trField('tr-supervisor','검토·확인자 이름',s.supervisor)+trField('tr-sign-date','교육자 서명일',s.signatureDate,'date')+trField('tr-review-date','확인자 서명일',s.reviewerDate,'date')+'</div>';
 h+='<label><input type="checkbox" id="tr-qualified" '+(s.directorQualified?'checked':'')+'> Initial 교육 지도자가 §6654.20(d)(2)(iv)(d)(2)(i)의 자격을 충족함을 확인 (자격·경력 증빙은 교육자료에 연결)</label>';
 h+='<h3>서명·증빙</h3>'+trField('tr-evidence','서명된 원본 HTTPS 링크 (Drive 등)',s.evidence)+'<label class="tr-field">서명 PDF 업로드<input type="file" id="tr-upload" accept="application/pdf"></label><button type="button" onclick="trUpload()">PDF 업로드 후 링크 연결</button><span id="tr-upload-status"></span>';
 [['trainerSigned','tr-trainer-signed','교육자 서명 원본 확인'],['supervisorSigned','tr-supervisor-signed','확인자 교차 서명 원본 확인'],['signatureVerified','tr-sign-verified','서명자·역할·해당 topic/날짜/시간을 원본과 대조함']].forEach(function(a){h+='<label class="tr-field"><input type="checkbox" id="'+a[1]+'" '+(s[a[0]]?'checked':'')+'> '+a[2]+'</label>';});
 h+='<h3>직원별 참석 · 서명 · 역량 평가</h3><p>Initial 20-hour 교육은 각 선택 주제의 역량 평가가 필요합니다. 직접 관찰/실습/질문 등 평가 내용과 결과를 증빙에 남기세요.</p>';
 var roster=(typeof STAFF_OP==='undefined'?[]:STAFF_OP).map(function(st){return {id:String(st.id),name:st.name||st.nameKr};});s.staff.forEach(function(st){if(!roster.some(function(r){return r.id===st.id;}))roster.push(st);});TR_EDIT.roster=roster;
 roster.forEach(function(r,i){var st=s.staff.find(function(x){return x.id===r.id;})||{};h+='<div class="tr-person"><label><input id="tr-person-'+i+'" type="checkbox" '+(st.id?'checked':'')+'> <b>'+trEsc(r.name)+'</b></label><div class="tr-grid">'+trField('tr-att-hours-'+i,'개인 실제 교육시간',st.hours==null?s.hours:st.hours,'number')+trField('tr-st-sign-date-'+i,'직원 서명일',st.signedDate,'date')+trField('tr-assessor-'+i,'역량 평가자',st.assessor)+trField('tr-assessed-'+i,'평가일',st.assessedDate,'date')+'</div><label><input id="tr-attended-'+i+'" type="checkbox" '+(st.attended?'checked':'')+'> 실제 참석 확인</label> <label><input id="tr-signed-'+i+'" type="checkbox" '+(st.signed?'checked':'')+'> 직원 서명 원본 확인</label>'+trField('tr-assess-evidence-'+i,'평가 방법·결과가 있는 증빙 HTTPS 링크',st.assessmentEvidence)+'<details><summary>역량 확인된 Topic 선택</summary>'+TR_TOPICS.map(function(t){return '<label class="tr-field"><input type="checkbox" id="tr-eval-'+i+'-'+t.id+'" '+((st.evaluated||[]).includes(t.id)?'checked':'')+'> '+trEsc(t.label)+'</label>';}).join('')+'</details></div>';});
 h+='<h3>시정조치 (해당 시)</h3>'+trField('tr-remediation','관련 지적사항 / 계획 번호',s.remediation)+trField('tr-accepted','시정계획 수락일',s.accepted,'date');
 h+='<label class="tr-field"><input type="checkbox" id="tr-lock"> 증빙 검토 확정 (필수 확인 완료 시만 가능, 확정 후 수정 잠금)</label>';
 h+='</fieldset><p id="tr-save-status"></p>'+(readonly?'<p>보존 기록입니다. 내용을 변경하려면 새 교육기록을 작성하고 원본 관계를 메모하세요.</p>':'<button class="mbt mbt-save" id="tr-save" onclick="saveTrSession()">저장</button>')+'<button class="btn-sm" onclick="closeOv(\'ov-tr\')">닫기</button>';
 document.getElementById('modal-ov-tr').innerHTML=h;openOv('ov-tr');
}
async function trUpload(){if(TR_BUSY)return;var f=document.getElementById('tr-upload').files[0];if(!f||f.type!=='application/pdf'||f.size>15*1024*1024||!f.size){alert('15MB 이하의 PDF를 선택해주세요.');return;}TR_BUSY=true;var status=document.getElementById('tr-upload-status');status.textContent=' 업로드 중';try{var b64=await new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result.split(',')[1]);};r.onerror=reject;r.readAsDataURL(f);});var res=await apiCall({action:'savePDF',originalName:f.name,memberId:'CENTER',memberName:'센터문서',fileType:'Training_'+TR_EDIT.id,base64Data:b64,author:trActor()});if(!res||!res.ok||!res.data||!res.data.success||!trURL(res.data.url))throw new Error('업로드 성공/링크 미확인');document.getElementById('tr-evidence').value=res.data.url;status.textContent=' 업로드 완료 — 교육기록도 저장하세요';}catch(e){status.textContent=' 실패: '+e.message;}finally{TR_BUSY=false;}}
async function saveTrSession(){
 if(TR_BUSY||!TR_READY||!TR_EDIT||TR_EDIT.locked||TR_EDIT.legacy||TR_EDIT.voided)return;
 var s=JSON.parse(JSON.stringify(TR_EDIT));delete s.roster;
 var mapping={title:'title',date:'date',kind:'kind',start:'start',end:'end',method:'method',content:'content',material:'material',trainer:'trainer',qualification:'qualification',rnName:'rn',license:'license',supervisor:'supervisor',signatureDate:'sign-date',reviewerDate:'review-date',evidence:'evidence',remediation:'remediation',accepted:'accepted'};
 Object.keys(mapping).forEach(function(k){s[k]=trVal('tr-'+mapping[k]);});s.hours=Number(trVal('tr-hours'));s.breakMinutes=Number(trVal('tr-break'));
 s.topics=TR_TOPICS.filter(function(t){return trChecked('trtopic-'+t.id);}).map(function(t){return t.id;});
 s.directorQualified=trChecked('tr-qualified');s.trainerSigned=trChecked('tr-trainer-signed');s.supervisorSigned=trChecked('tr-supervisor-signed');s.signatureVerified=trChecked('tr-sign-verified');
 s.staff=TR_EDIT.roster.map(function(r,i){if(!trChecked('tr-person-'+i))return null;return {id:r.id,name:r.name,hours:Number(trVal('tr-att-hours-'+i)),attended:trChecked('tr-attended-'+i),signed:trChecked('tr-signed-'+i),signedDate:trVal('tr-st-sign-date-'+i),assessor:trVal('tr-assessor-'+i),assessedDate:trVal('tr-assessed-'+i),assessmentEvidence:trVal('tr-assess-evidence-'+i),evaluated:s.topics.filter(function(t){return trChecked('tr-eval-'+i+'-'+t);})};}).filter(Boolean);
 try{
 if(!s.title||!trDate(s.date)||s.date>trToday()||!(s.hours>0&&s.hours<=24)||!s.topics.length||!s.staff.length)throw new Error('교육명·실제 날짜·0~24시간·Topic·참석 직원을 확인하세요.');
 if(s.staff.some(function(st){return !(st.hours>0)||st.hours>s.hours;}))throw new Error('개인 시간은 0보다 크고 세션 시간 이하여야 합니다.');
 if(s.evidence&&!trURL(s.evidence))throw new Error('증빙은 HTTPS 링크여야 합니다.');
 if(s.start||s.end){if(!s.start||!s.end)throw new Error('시작·종료 시간을 모두 입력하세요.');var mins=function(t){return Number(t.slice(0,2))*60+Number(t.slice(3));};var duration=mins(s.end)-mins(s.start)-s.breakMinutes;if(s.breakMinutes<0||duration<=0||Math.abs(duration/60-s.hours)>0.02)throw new Error('시작·종료·휴식과 실제 교육시간이 일치하지 않습니다. 같은 날짜 교육만 등록하세요.');}
 if(s.start&&TR_SESSIONS.some(function(old){return old.id!==s.id&&!old.voided&&old.date===s.date&&old.start&&old.end&&s.start<old.end&&s.end>old.start&&old.staff.some(function(a){return s.staff.some(function(b){return a.id===b.id;});});}))throw new Error('같은 직원의 교육시간이 기존 회차와 겹칩니다.');
 if(s.kind==='remediation'&&(!s.remediation||!trDate(s.accepted)||s.date<=s.accepted))throw new Error('시정조치 교육은 지적사항과 수락일이 필요하고 교육일이 수락일 이후여야 합니다.');
 var issues=s.staff.map(function(st){return st.name+': '+trIssues(s,st).join(', ');}).filter(function(_,i){return trIssues(s,s.staff[i]).length;});
 s.locked=trChecked('tr-lock');if(s.locked&&issues.length)throw new Error(issues.join('\n'));
 s.updatedAt=new Date().toISOString();s.updatedBy=trActor();s.revision=(s.revision||0)+1;
 // Keep each prior version as a separate append-only key before replacing the current row.
 TR_BUSY=true;document.getElementById('tr-save').disabled=true;
 if(TR_SESSIONS.some(function(x){return x.id===s.id;}))await trPut('sadc_training_history:'+s.id+':'+Date.now(),TR_SESSIONS.find(function(x){return x.id===s.id;}));
 await trPut(TR_PREFIX+s.id,s);var i=TR_SESSIONS.findIndex(function(x){return x.id===s.id;});if(i<0)TR_SESSIONS.push(s);else TR_SESSIONS[i]=s;
 closeOv('ov-tr');renderTrSessionList();if(_trView==='staff')renderTrStaffView();
 }catch(e){document.getElementById('tr-save-status').textContent='저장하지 못했습니다: '+e.message;}finally{TR_BUSY=false;var b=document.getElementById('tr-save');if(b)b.disabled=false;}
}
async function deleteTrSession(id){var s=TR_SESSIONS.find(function(x){return x.id===id;});if(!TR_READY||TR_BUSY||!s||s.legacy||s.voided)return;var reason=prompt('원본은 보존됩니다. 취소 사유를 입력하세요.');if(!reason||!reason.trim())return;TR_BUSY=true;try{var next=Object.assign({},s,{voided:true,voidReason:reason.trim(),voidedAt:new Date().toISOString(),voidedBy:trActor()});await trPut(TR_PREFIX+s.id,next);Object.assign(s,next);renderTrSessionList();}catch(e){alert(e.message);}finally{TR_BUSY=false;}}
function loadTrStaffDropdown(){var el=document.getElementById('tr-staff-select');if(!el)return;var selected=el.value;el.innerHTML='<option value="">— 직원 선택 —</option>'+(typeof STAFF_OP==='undefined'?[]:STAFF_OP).map(function(st){return '<option value="'+trEsc(st.id)+'">'+trEsc(st.name||st.nameKr)+'</option>';}).join('');el.value=selected;}
function trRecords(id){return TR_SESSIONS.filter(function(s){return !s.voided&&s.staff.some(function(st){return st.id===id;});}).map(function(s){return {s:s,st:s.staff.find(function(st){return st.id===id;})};});}
function trCompliance(id,today){
 var p=TR_PROFILES[id]||{},records=trRecords(id),verified=records.filter(function(r){return r.s.locked&&!trIssues(r.s,r.st).length&&r.s.date<=today;}),year=today.slice(0,4),start=year+'-01-01';
 var annual=verified.filter(function(r){return r.s.kind==='inservice'&&r.s.date>=start;});
 function covered(rows,topics){return topics.every(function(t){return rows.some(function(r){return r.s.topics.includes(t);});});}
 var hrs=annual.reduce(function(n,r){return n+r.st.hours;},0),fire=covered(verified.filter(function(r){return r.s.date>=start;}),TR_FIRE);
 var due=trDate(p.assigned||'')?trMonths(p.assigned,3):'',initial=verified.filter(function(r){return r.s.kind==='initial'&&r.s.date>=p.assigned&&r.s.date<=due;});
 var initialHours=initial.reduce(function(n,r){return n+r.st.hours;},0),pre=verified.filter(function(r){return r.s.date<p.firstService;});
 return {hours:hrs,fire:fire,initialHours:initialHours,due:due,initial:covered(initial,TR_INITIAL)&&initialHours>=20,pre:!!p.firstService&&covered(pre,TR_PRE),orientation:covered(verified,['orientation','elderly','participant_rights','safety']),hcbs:covered(verified,['hcbs','pcp','pc_thinking']),records:records,verified:verified,profile:p};
}
function renderTrStaffView(){if(TR_PROFILE_DIRTY){document.getElementById('tr-staff-select').value=TR_PROFILE_DIRTY;return;}var id=trVal('tr-staff-select'),el=document.getElementById('tr-staff-detail');if(!el)return;if(!id){el.innerHTML='';return;}var c=trCompliance(id,trToday()),p=c.profile;
 var h='<div class="card"><h3>교육 기준 확인</h3><p>연간 화면은 '+trToday().slice(0,4)+'년 1월~12월 기준입니다. 전체 기관 compliance 인증이 아닌 기록 검토 결과입니다.</p><div class="tr-grid">'+trSelect('tr-profile-service','직접 서비스 제공 여부',[['','미확인'],['yes','예 (직원/봉사자)'],['no','아니요']],p.service||'')+trSelect('tr-profile-volunteer','구분',[['staff','직원'],['volunteer','봉사자']],p.type||'staff')+trField('tr-profile-hire','입사일',p.hire,'date')+trField('tr-profile-assigned','서비스 업무 배정일',p.assigned,'date')+trField('tr-profile-first','첫 서비스 제공일',p.firstService,'date')+'</div>'+trField('tr-profile-equivalent','동등 교육/자격 증빙 링크 (자동 면제하지 않음)',p.equivalent)+trField('tr-profile-equivalent-note','동등 자격 인정 범위·검토자·근거',p.equivalentNote)+'<button class="btn-sm" onclick="trSaveProfile()">직원 기준 저장</button><button class="btn-sm" onclick="trDiscardProfile()">입력 취소</button></div>';
 h+='<div class="card"><b>기록 검토 현황</b><ul><li>기본교육: '+(c.orientation?'증빙 확인':'주제/증빙 확인 필요')+'</li><li>연간 in-service: '+c.hours.toFixed(2)+' / 6시간</li><li>연간 화재·대피·비상 연락: '+(c.fire?'증빙 확인':'미확인 항목 있음')+'</li><li>HCBS / PCP / thinking & practice: '+(c.hcbs?'증빙 확인':'주제/증빙 확인 필요')+'</li>';
 if(p.service==='yes')h+='<li>서비스 제공 전 기본교육: '+(c.pre?'증빙 확인':'날짜·주제 확인 필요 (당일 교육은 선후관계 별도 확인)')+'</li><li>Initial 교육: '+c.initialHours.toFixed(2)+' / 20시간 · 기한 '+(c.due||'배정일 필요')+' · '+(c.initial?'주제·평가 증빙 확인':c.due&&c.due<trToday()?'기한 경과 / 증빙 검토 필요':'주제·평가 확인 필요')+'</li>';
 else h+='<li>직접 서비스 교육 적용: '+(p.service==='no'?'비대상으로 등록됨':'직무 확인 필요')+'</li>';
 if(p.equivalent)h+='<li>동등 교육 증빙 등록됨 — 인정 범위를 검토한 후 판단하세요.</li>';
 h+='</ul>'+trButton('직원별 로그 출력','staffprint',0)+'</div><div class="card"><h3>Topic별 증빙</h3>'+TR_TOPICS.map(function(t){var rows=c.verified.filter(function(r){return r.s.topics.includes(t.id);});return '<p>'+trEsc(t.label)+' — '+(rows.length?trEsc(rows.map(function(r){return r.s.date;}).sort().pop()):'미확인')+'</p>';}).join('')+'</div>';
 h+='<div class="card"><h3>교육 이력</h3>'+c.records.map(function(r){return '<p>'+trEsc(r.s.date)+' · '+trEsc(r.s.title)+' · '+r.st.hours+'h — '+(trIssues(r.s,r.st).join(' / ')||'증빙 확인, '+(r.s.locked?'확정':'확정 대기'))+'</p>';}).join('')+'</div>';el.innerHTML=h;
}
async function trSaveProfile(){if(!TR_READY||TR_BUSY)return;var id=trVal('tr-staff-select');if(!id)return;var p={service:trVal('tr-profile-service'),type:trVal('tr-profile-volunteer'),hire:trVal('tr-profile-hire'),assigned:trVal('tr-profile-assigned'),firstService:trVal('tr-profile-first'),equivalent:trVal('tr-profile-equivalent'),equivalentNote:trVal('tr-profile-equivalent-note'),updatedBy:trActor(),updatedAt:new Date().toISOString()};if(p.equivalent&&!trURL(p.equivalent)){alert('HTTPS 증빙 링크를 입력하세요.');return;}if(p.assigned&&p.firstService&&p.firstService<p.assigned){alert('첫 서비스일은 업무 배정일 이후여야 합니다.');return;}TR_BUSY=true;try{await trPut(TR_PROFILE_PREFIX+id,p);TR_PROFILES[id]=p;TR_PROFILE_DIRTY=null;WriteGuard.endEdit('training-profile');renderTrStaffView();}catch(e){alert('저장 실패: '+e.message);}finally{TR_BUSY=false;}}
function trPrint(title,body){var w=window.open('','_blank');if(!w){alert('팝업을 허용해주세요.');return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+trEsc(title)+'</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#111}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #444;padding:7px;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}.sign td{height:40px}h1{font-size:18px}p{overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body><h1>Number One Adult Daycare — '+trEsc(title)+'</h1>'+body+'<button onclick="window.print()">Print / Save PDF</button></body></html>');w.document.close();}
function printTrSession(id){var s=TR_SESSIONS.find(function(s){return s.id===id;});if(!s)return;var meta=trEsc(s.date+' | '+s.id+' | '+s.title);trPrint('Competency Training Log','<p>'+meta+' · '+s.hours+' hours (breaks excluded)</p><p>Topics: '+s.topics.map(trLabel).map(trEsc).join('; ')+'</p><p>Content: '+trEsc(s.content)+'<br>Materials/version: '+trEsc(s.material)+'</p><p>Trainer: '+trEsc(s.trainer)+' · Qualifications: '+trEsc(s.qualification)+'<br>Personal care RN: '+trEsc(s.rnName)+' · License: '+trEsc(s.license)+'<br>Supervisor/reviewer: '+trEsc(s.supervisor)+'</p><table><thead><tr><th colspan="6">'+meta+'</th></tr><tr><th>Name</th><th>Date / hours</th><th>Staff signature / date</th><th>Trainer / RN signature / date</th><th>Supervisor signature / date</th><th>Competency evaluation</th></tr></thead><tbody>'+s.staff.map(function(st){return '<tr class="sign"><td>'+trEsc(st.name)+'</td><td>'+trEsc(s.date)+' / '+st.hours+'</td><td></td><td></td><td></td><td>Evaluator: '+trEsc(st.assessor)+'<br>Topics assessed: '+(st.evaluated||[]).map(trLabel).map(trEsc).join('; ')+'<br>Method / outcome: __________________</td></tr>';}).join('')+'</tbody></table><p>Status: '+(s.voided?'VOID':s.locked?'Evidence reviewed':'Draft / evidence pending')+' · Original evidence: '+trEsc(s.evidence)+'</p><p>Blank signature spaces are for fresh handwritten signatures. Stored names do not reproduce signatures.</p>');}
function trPrintStaff(){var id=trVal('tr-staff-select'),p=TR_PROFILES[id]||{},st=(typeof STAFF_OP==='undefined'?[]:STAFF_OP).find(function(s){return String(s.id)===id;});if(!st)return;var name=st.name||st.nameKr;trPrint('Personal Training Record','<p>Name: '+trEsc(name)+' · Title: '+trEsc(st.role)+' · Hire date: '+trEsc(p.hire)+'</p><table><thead><tr><th colspan="7">'+trEsc(name)+' — Personal Training Record</th></tr><tr><th>Topic / session</th><th>Date</th><th>Hours</th><th>Train by / signature</th><th>Supervisor / signature</th><th>Evidence</th><th>Status</th></tr></thead><tbody>'+trRecords(id).map(function(r){return '<tr><td>'+r.s.topics.map(trLabel).map(trEsc).join('; ')+'<br>'+trEsc(r.s.id)+'</td><td>'+trEsc(r.s.date)+'</td><td>'+r.st.hours+'</td><td>'+trEsc(r.s.trainer)+'<br>________________</td><td>'+trEsc(r.s.supervisor)+'<br>________________</td><td>'+trEsc(r.s.evidence)+'</td><td>'+trEsc(trIssues(r.s,r.st).join('; ')||(r.s.locked?'Evidence reviewed':'Pending confirmation'))+'</td></tr>';}).join('')+'</tbody></table><p>Refer to linked originals for existing signatures. This summary does not create or copy signatures.</p>');}
if(typeof document!=='undefined')document.addEventListener('click',function(e){var b=e.target.closest('[data-tr-action]');if(!b)return;var action=b.dataset.trAction,s=TR_SESSIONS[Number(b.dataset.trIndex)];if(action==='staffprint')trPrintStaff();else if(s){if(action==='edit')openTrModal(s.id);if(action==='print')printTrSession(s.id);if(action==='void')deleteTrSession(s.id);}});
// ── 문서보관함 파일 업로드 ──────────────────────────────────
function saveDocWithUpload(){
  var name = document.getElementById('doc-name').value.trim();
  if(!name){ alert('문서명은 필수입니다'); return; }
  var editId = document.getElementById('doc-edit-id').value;
  var fileInput = document.getElementById('doc-file');
  var file = fileInput&&fileInput.files&&fileInput.files[0];
  var existingLink = document.getElementById('doc-link').value.trim();

  async function finalize(link){
    var entry = {
      id:editId||('doc_'+Date.now()), name:name,
      cat:document.getElementById('doc-cat').value,
      issued:document.getElementById('doc-issued').value,
      expiry:document.getElementById('doc-expiry').value,
      link:link||'', note:document.getElementById('doc-note').value.trim()
    };
    try{await apiCall({action:'upsert',sheet:'docs',key:'ID',value:entry.id,data:{
      'ID':entry.id,'이름':entry.name,'카테고리':entry.cat,'발급일':entry.issued,
      '만료일':entry.expiry,'Drive링크':entry.link,'메모':entry.note
    }});}catch(e){alert('❌ 문서 정보 저장 실패: '+e.message);return;}
    if(editId){ var idx=DOCS_LIST.findIndex(function(x){return x.id===editId;});if(idx>=0)DOCS_LIST[idx]=entry;else DOCS_LIST.push(entry); }
    else DOCS_LIST.push(entry);
    saveDocsStorage();
    closeOv('ov-doc'); renderDocsList();
  }

  if(file){
    if(!file.size||file.size>20*1024*1024){alert('빈 파일 또는 20MB 초과 파일은 업로드할 수 없습니다.');return;}
    var statusEl = document.getElementById('doc-upload-status');
    if(statusEl) statusEl.textContent = '📤 업로드 중...';
    var reader = new FileReader();
    reader.onload = function(ev){
      var b64 = ev.target.result.split(',')[1];
      apiCall({
        action:'savePDF', originalName:file.name, memberId:'CENTER', memberName:'센터문서',
        fileType:name.replace(/\s+/g,'_'), base64Data:b64,
        author:_currentUser?(_currentUser.name||''):''
      }).then(function(res){
        if(res&&res.ok&&res.data&&res.data.success){
          if(statusEl) statusEl.textContent = '✅ 업로드 완료';
          finalize(res.data.url);
        } else {
          if(statusEl) statusEl.textContent = '❌ 업로드 실패';
          return;
        }
      }).catch(function(){
        if(statusEl) statusEl.textContent = '❌ 네트워크 오류';
        return;
      });
    };
    reader.onerror=function(){if(statusEl)statusEl.textContent='파일 읽기 실패';};
    reader.readAsDataURL(file);
  } else {
    finalize(existingLink);
  }
}

// ── 초기화 ────────────────────────────────────────────────
// PCSP entry points and startup are owned by apps/pcsp.js and operations.html.
