// One document at a time. No browser-persistent state or signature copying.
var _docContext=null,_docRows=[],_docActive=null,_docBusy=false,_docPending=null,_docListSerial=0;
function docResult(res){if(!res||!res.ok||!res.data||res.data.success===false)throw new Error(res&&res.data&&res.data.error||'서버 응답을 확인하지 못했습니다.');return res.data;}
function docHideForms(){['forms-hub','frm-assessment','frm-nutrition','frm-member-rights','frm-incident','pcsp-list-view','pcsp-member-select','pcsp-form-view'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
var _docMember=null,_docExpanded={},_docTrash={},_docReview=null;
var DOC_TYPES=[['PCSP','PCSP'],['Assessment','Assessment'],['Nutrition','Nutrition Screening'],['MemberRights','Member Rights'],['HIPAA','HIPAA Authorization'],['Incident','Incident Log'],['Medicaid_Card','Medicaid Card'],['Medicare_Card','Medicare Card'],['Photo_ID','Photo ID']];
function docButton(label,fn,parent){
  var b=document.createElement('button');b.type='button';
  var style=label==='삭제'?'danger':label.indexOf('복사')>=0?'copy':label.indexOf('PDF')>=0?'pdf':/이어서|서명하기/.test(label)?'primary':/새로 작성|새로고침|작성 이력|삭제한 문서/.test(label)?'text':'quiet';
  b.className='doc-button doc-button-'+style;b.textContent=label;
  b.onclick=function(e){e.stopPropagation();fn();};parent.appendChild(b);return b;
}
function docDisplayStatus(d){
  if(d.deletedAt)return {text:'삭제됨',tone:'gray'};
  if(d.status==='서명완료·PDF대기')return {text:'PDF 대기',tone:'orange'};
  if(d.signed)return {text:'✓ 완료',tone:'green'};
  if(d.status==='서명대기')return {text:'서명대기',tone:'orange'};
  return {text:d.status||'작성중',tone:'gray'};
}
function docDateLabel(d){return String(d.date||d.updatedAt||'').slice(0,10).replace(/-/g,'.')||'날짜 미상';}
function docChoose(type){_docContext={mid:_docMember.mid,name:_docMember.name,type:type};}
async function showDocumentHistory(mid,name,type){
  if(_docBusy){alert('저장 중입니다. 잠시 기다려주세요.');return;}
  if(_docPending&&!window.confirm('저장 결과를 확인하지 못했습니다. 서버 목록을 다시 확인하시겠습니까?'))return;
  _docPending=null;_docActive=null;_docReview=null;_formLoads={};docHideForms();
  document.getElementById('document-history').style.display='none';document.getElementById('forms-hub').style.display='block';
  var member=_formsMemberCache.find(function(m){return String(m.ID)===String(mid);});
  if(member){_selectedFormsMember=member;document.getElementById('forms-selected').style.display='block';document.getElementById('forms-empty-msg').style.display='none';document.getElementById('forms-selected-name').textContent=name;}
  if(!_docMember||_docMember.mid!==String(mid)){_docExpanded={};_docTrash={};}
  _docMember={mid:String(mid),name:name||''};if(type)_docExpanded[type]=true;docChoose(type||'PCSP');
  var serial=++_docListSerial;_docRows=[];renderDocumentHistory('loading');
  try{var data=docResult(await apiGet({action:'documentList',memberId:mid}));if(serial!==_docListSerial)return;_docRows=data.documents||[];renderDocumentHistory();}
  catch(e){if(serial!==_docListSerial)return;renderDocumentHistory('error',e.message);}
}
function renderDocumentHistory(state,error){
  ['forms-official-list','forms-id-list'].forEach(function(id){document.getElementById(id).textContent='';});
  DOC_TYPES.forEach(function(t,n){
    var type=t[0],root=document.getElementById(n<6?'forms-official-list':'forms-id-list'),wrap=document.createElement('section');wrap.className='doc-group';root.appendChild(wrap);
    var rows=_docRows.map(function(d,i){return {d:d,i:i};}).filter(function(x){return x.d.type===type&&!x.d.deletedAt;}).sort(function(a,b){return String(b.d.date||b.d.updatedAt).localeCompare(String(a.d.date||a.d.updatedAt));});
    var head=document.createElement('div');head.className='doc-heading';wrap.appendChild(head);
    var toggle=docButton('',function(){_docExpanded[type]=!_docExpanded[type];renderDocumentHistory(state,error);},head);toggle.className='doc-toggle';toggle.setAttribute('aria-expanded',String(!!_docExpanded[type]));toggle.setAttribute('aria-controls','doc-history-'+type);
    var icons=['📋','📝','🥗','⚖️','🔐','🚨','🪪','🪪','🪪'],tones=['blue','mint','purple','peach','rose','peach','gray','gray','gray'];
    var icon=document.createElement('span');icon.className='doc-icon doc-icon-'+tones[n];icon.textContent=icons[n];icon.setAttribute('aria-hidden','true');toggle.appendChild(icon);
    var name=document.createElement('span');name.className='doc-name';toggle.appendChild(name);
    var title=document.createElement('strong');title.textContent=t[1];name.appendChild(title);
    if(!state){var count=document.createElement('span');count.className='doc-count';count.textContent=String(rows.length);count.setAttribute('aria-label','총 '+rows.length+'건');title.appendChild(count);}
    var date=document.createElement('small');date.textContent=state==='loading'?'불러오는 중…':state==='error'?'조회 실패':rows.length?'최신 작성일 '+docDateLabel(rows[0].d):'작성된 문서가 없습니다';name.appendChild(date);
    var arrow=document.createElement('span');arrow.className='doc-chevron';arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');toggle.appendChild(arrow);
    var quick=document.createElement('div');quick.className='doc-quick';head.appendChild(quick);
    if(!state&&rows.length){var badge=document.createElement('span'),info=docDisplayStatus(rows[0].d);badge.className='doc-badge doc-badge-'+info.tone;badge.textContent=info.text;quick.appendChild(badge);}
    var body=document.createElement('div');body.className='doc-records';body.id='doc-history-'+type;body.hidden=!_docExpanded[type];wrap.appendChild(body);
    if(state==='error'){docButton('다시 불러오기',function(){showDocumentHistory(_docMember.mid,_docMember.name,type);},quick);var err=document.createElement('small');err.className='doc-error';err.textContent=error;body.appendChild(err);return;}
    if(state==='loading')return;
    var latest=rows[0];docButton(latest?(latest.d.pdfUrl?'PDF 보기':latest.d.signed?'문서 확인':latest.d.status==='서명대기'?'이어서 작성 / 서명':'이어서 작성'):'＋ 새로 작성',function(){docChoose(type);if(!latest)docNew();else if(latest.d.pdfUrl)window.open(latest.d.pdfUrl,'_blank','noopener');else if(latest.d.signed&&type==='PCSP'){_docExpanded[type]=true;renderDocumentHistory();}else docOpen(latest.i);},quick);
    if(!_docExpanded[type])return;
    var toolbar=document.createElement('div');toolbar.className='doc-history-toolbar';body.appendChild(toolbar);var heading=document.createElement('span');heading.textContent=_docTrash[type]?'삭제한 문서':'문서 이력';toolbar.appendChild(heading);
    var tools=document.createElement('div');tools.className='doc-history-tools';toolbar.appendChild(tools);
    docButton('＋ 새로 작성',function(){docChoose(type);docNew();},tools);docButton('새로고침',function(){showDocumentHistory(_docMember.mid,_docMember.name,type);},tools);
    docButton(_docTrash[type]?'작성 이력':'삭제한 문서',function(){_docTrash[type]=!_docTrash[type];renderDocumentHistory();},tools);
    if(_docTrash[type])rows=_docRows.map(function(d,i){return {d:d,i:i};}).filter(function(x){return x.d.type===type&&x.d.deletedAt;});
    if(!rows.length){var empty=document.createElement('p');empty.className='doc-empty';empty.textContent=_docTrash[type]?'삭제한 문서가 없습니다.':'첫 문서를 작성하면 여기에 이력이 표시됩니다.';body.appendChild(empty);}
    rows.forEach(function(x,index){var d=x.d,row=document.createElement('div');row.className='doc-record';body.appendChild(row);var label=document.createElement('div');label.className='doc-record-name';row.appendChild(label);
      var stamp=document.createElement('strong');stamp.textContent=docDateLabel(d);label.appendChild(stamp);
      if(!index&&!_docTrash[type]){var newest=document.createElement('span');newest.className='doc-latest';newest.textContent='최신';stamp.appendChild(newest);}
      var description=document.createElement('small');description.textContent=d.deletedAt?'삭제됨 · 복구 가능':d.signed?(d.pdfUrl?'서명 완료 · 읽기 전용':'서명 완료 · PDF 대기'):(d.status||'작성중')+' · 내용 수정 가능';label.appendChild(description);
      var card=document.createElement('div');card.className='doc-record-actions';row.appendChild(card);
      function act(fn){return function(){docChoose(type);fn();};}
      if(d.deletedAt){docButton('복구',act(function(){docChange(x.i,true);}),card);return;}
      if(d.pdfUrl)docButton('PDF 보기',function(){window.open(d.pdfUrl,'_blank','noopener');},card);
      if(!d.signed&&(d.jsonFile||type==='Incident'||type==='PCSP'))docButton('이어서 작성 / 서명',act(function(){docOpen(x.i);}),card);
      if(d.signed&&(d.jsonFile||type==='PCSP')&&['PCSP','Assessment','Nutrition','MemberRights'].includes(type))docButton('복사해서 새로 작성',act(function(){docCopy(x.i);}),card);
      if(d.signed&&!d.pdfUrl&&(d.canGeneratePDF||type==='PCSP'))docButton('PDF 생성 재시도',act(async function(){try{if(type==='PCSP'){await loadPCSPFromSheets();await wfRetryPDF(d.recordId);}else docResult(await apiCall({action:'documentPDF',documentId:d.id,memberId:_docMember.mid}));showDocumentHistory(_docMember.mid,_docMember.name,type);}catch(e){alert(e.message);}}),card);
      var more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='⋯';summary.setAttribute('aria-label',docDateLabel(d)+' '+t[1]+' 문서 관리');more.appendChild(summary);card.appendChild(more);
      if(d.signed&&d.jsonFile&&type!=='PCSP')docButton('저장 내용 보기',act(function(){docOpen(x.i);}),more);
      docButton('삭제',act(function(){docChange(x.i,false);}),more);
    });
  });
}
async function docChange(i,restore){var d=_docRows[i],c=_docContext;
  var reason=restore?'':window.prompt(c.name+' / '+c.type+' / '+d.date+' / '+(d.signed?'서명 완료':'미서명')+'\n삭제 사유를 입력해주세요. 삭제 목록에서 복구할 수 있습니다.','');
  if(!restore&&(reason===null||!reason.trim()))return;
  if(!window.confirm(c.name+' · '+c.type+' · '+d.date+'\n이 문서를 '+(restore?'복구':'삭제')+'하시겠습니까?'))return;
  try{docResult(await apiCall({action:'documentState',documentId:d.id,memberId:c.mid,fileType:c.type,expectedRevision:d.revision||0,reason:reason,restore:restore,actor:_currentUser&&_currentUser.email||''}));await showDocumentHistory(c.mid,c.name,c.type);}catch(e){alert(e.message);}
}
function docNew(){var c=_docContext;if(!c)return;_docReview=null;docHideForms();_docActive={id:'doc_'+crypto.randomUUID(),mid:c.mid,type:c.type,revision:0,isNew:true,signed:false};_docPending=null;document.getElementById('document-history').style.display='none';
  if(c.type==='PCSP'){var m=_formsMemberCache.find(function(m){return String(m.ID)===c.mid;});selectPCSPMember(m);}
  else if(c.type==='Nutrition')openNutritionForMember(c.mid,c.name);
  else if(c.type==='Assessment')openAssessmentForMember(c.mid,c.name);
  else if(c.type==='MemberRights')openMemberRightsForMember(c.mid,c.name);
  else if(c.type==='HIPAA'){document.getElementById('forms-hub').style.display='block';openHIPAAForMember(c.mid,c.name);}
  else if(c.type==='Incident')openIncidentForMember(c.mid,c.name);
  else{uploadMemberID(c.mid,c.name,c.type);document.getElementById('forms-hub').style.display='block';}
}
async function docOpen(i){var d=_docRows[i],c=_docContext;docHideForms();_docReview=null;_docActive=Object.assign({},d);_docPending=null;document.getElementById('document-history').style.display='none';
  if(d.type==='PCSP'){
    if(d.signed){if(d.pdfUrl){window.open(d.pdfUrl,'_blank','noopener');document.getElementById('forms-hub').style.display='block';}else{alert('서명된 원본은 편집할 수 없습니다. PDF 생성 재시도를 사용해주세요.');document.getElementById('forms-hub').style.display='block';}return;}
    await loadPCSPFromSheets();await editPCSP(d.recordId);return;
  }
  if(d.type==='Nutrition')openNutritionForMember(c.mid,c.name);
  else if(d.type==='Assessment')openAssessmentForMember(c.mid,c.name);
  else if(d.type==='MemberRights')openMemberRightsForMember(c.mid,c.name);
  else if(d.type==='Incident'){
    openIncidentForMember(c.mid,c.name);var form=document.getElementById('frm-incident');form.inert=true;
    try{var r=docResult(await apiGet({action:'documentRead',documentId:d.id,memberId:c.mid,fileType:c.type}));var map={'inc-date':'날짜','inc-time':'시간','inc-severity':'심각도','inc-type':'유형','inc-location':'장소','inc-desc':'설명','inc-action':'조치','inc-witness':'목격자','inc-doh':'DOH보고'};Object.keys(map).forEach(function(k){document.getElementById(k).value=r.data[map[k]]||'';});form.inert=false;}catch(e){alert(e.message);showDocumentHistory(c.mid,c.name,c.type);form.inert=false;}
  }
}
async function docLoadForm(mid,name,type){
  var a=_docActive;
  if(!a||a.mid!==String(mid)||a.type!==type){
    // Direct URL entry selects an explicit server record, never creates over the latest one.
    var list=docResult(await apiGet({action:'documentList',memberId:mid,fileType:type})).documents||[];
    list=list.filter(function(d){return !d.deletedAt&&d.jsonFile;}).sort(function(a,b){return String(b.updatedAt||b.date).localeCompare(String(a.updatedAt||a.date));});
    if(!list.length)throw new Error('저장된 문서가 없습니다. 문서 이력에서 새로 작성을 눌러주세요.');
    a=_docActive=list[0];_docContext={mid:String(mid),name:name,type:type};
  }
  if(a.isNew)return {ok:true,data:a.seed?{found:true,data:a.seed}:{found:false}};
  var res=await apiGet({action:'documentRead',documentId:a.id,memberId:mid,fileType:type});
  var r=docResult(res);if(_docActive===a)_docReview=r.data&&r.data.renewalReview||null;if(_docActive===a&&r.document)_docActive=Object.assign({},r.document);return res;
}
function docPrintFields(type){
  var root=document.getElementById(type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment'),fields=[];
  if(type==='MemberRights')fields.push({label:'Participant Bill of Rights',value:Array.from(root.children).filter(function(el){return !el.hasAttribute('data-renewal-review');}).map(function(el){return el.innerText;}).join('\n')});
  if(type==='Nutrition')fields.push({label:'Date of Birth',value:document.getElementById('ns-dob').textContent});
  root.querySelectorAll('input,select,textarea').forEach(function(el){
    if(el.hasAttribute('data-med-search')||el.closest('[data-renewal-review]')||el.type==='file'||el.type==='hidden'||el.type==='button')return;
    var wrap=el.closest('.modal-input-wrap')||el.parentElement;
    var label=el.labels&&el.labels[0];var title=label?label.textContent.trim():'';
    if(!title){var l=wrap.querySelector('.fl,label');title=l?l.textContent.trim():el.id||el.name;}
    if(el.type==='radio'&&!el.checked)return;
    fields.push({label:title,value:el.type==='checkbox'?(el.checked?'Yes':'No'):el.value});
  });return fields;
}
async function docSaveForm(mid,name,type,data){
  var a=_docActive;if(!a||a.mid!==String(mid)||a.type!==type)throw new Error('문서 이력에서 작성할 문서를 선택해주세요.');
  if(a.signed)throw new Error('서명 완료 문서는 편집할 수 없습니다. 새로 작성해주세요.');
  if(_docBusy)throw new Error('저장 중입니다.');
  if(data.signed&&docReviewIssues(_docReview).length)throw new Error(docReviewIssues(_docReview).join('\n'));
  if(_docReview)data.renewalReview=JSON.parse(JSON.stringify(_docReview));
  var body=_docPending||{action:'documentSave',documentId:a.id,memberId:mid,memberName:name,fileType:type,expectedRevision:a.revision||0,operationId:crypto.randomUUID(),jsonData:data,printFields:docPrintFields(type)};
  _docPending=body;_docBusy=true;
  var form=document.getElementById(type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment');form.inert=true;
  try{var r=docResult(await docSaveRequest(body));_docPending=null;if(_docActive&&_docActive.id===a.id)_docActive=r.document;
    if(r.document.signed){var id=type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment';docApplyReadonly(id);if(r.document.pdfError)alert('서명된 원본은 저장했습니다. PDF 생성은 문서 이력에서 재시도해주세요.');}
    return {ok:true,data:{success:true,document:r.document}};
  }finally{_docBusy=false;form.inert=false;docApplyReadonly(form.id);}
}
function docApplyReadonly(id){
  docRenderReview(id,_docReview);
  var form=document.getElementById(id),readonly=!!(_docActive&&_docActive.signed);
  if(_formLoads[id])_formLoads[id].readOnly=readonly;
  Array.from(form.children).forEach(function(el){if(!el.classList.contains('back-btn')&&!el.hasAttribute('data-load-notice'))el.inert=readonly;});
  var notice=form.querySelector('[data-load-notice]');if(notice&&readonly)notice.textContent='서명 완료 · 읽기 전용입니다. 변경이 필요하면 문서 이력에서 새로 작성해주세요.';
}
function docBack(){if(!_docContext)return false;if(_docBusy){alert('저장 중입니다.');return true;}var c=_docContext;showDocumentHistory(c.mid,c.name,c.type);return true;}

async function docSaveIncident(data){
  var a=_docActive;if(!a||a.type!=='Incident')throw new Error('문서 이력에서 Incident를 열어주세요.');
  if(a.isNew)return apiCall({action:'append',sheet:'incident',data:data});
  var r=await apiCall({action:'documentIncident',documentId:a.id,memberId:a.mid,expectedRevision:a.revision||0,data:data});
  var result=docResult(r);_docActive=result.document;return r;
}

async function docSaveRequest(body){var timer;try{return await Promise.race([apiCall(body),new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error('서버 저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 저장을 다시 누르면 같은 요청을 확인합니다.'));},45000);})]);}finally{clearTimeout(timer);}}

function docNewReview(d){
  var items=d.type==='Nutrition'?[{key:'measurements',label:'현재 키 · 체중 · BMI · 영양 상태 확인'},{key:'diet',label:'질환 · 식단 · 알레르기 · 상담 내용 확인'}]:d.type==='MemberRights'?[{key:'rights',label:'권리 안내 내용 · 참가자/대리인 정보 확인'}]:[{key:'medications',label:'약: 추가 · 중단 · 용량/횟수 변경'},{key:'health',label:'건강 · 기능 · 지원 필요'},{key:'preferences',label:'선호 · 목표 · 활동 내용 확인'}];
  return {sourceId:d.id,sourceDate:d.date||'',items:items.map(function(x){return Object.assign(x,{choice:'',note:''});})};
}
function docReviewIssues(r){if(!r)return [];var issues=(r.items||[]).filter(function(x){return !['unchanged','changed'].includes(x.choice)||(x.choice==='changed'&&!String(x.note||'').trim());}).map(function(x){return x.label+' — 변경 없음 또는 변경 내용 확인 필요';});if(r.authLoadFailed)issues.push('AUTH 조회 실패: 현재 AUTH를 다시 조회해주세요.');return issues;}
function docRenderReview(id,review){
  var form=document.getElementById(id);if(!form)return;var panel=form.querySelector('[data-renewal-review]');if(panel)panel.remove();if(!review)return;
  panel=document.createElement('div');panel.setAttribute('data-renewal-review','');panel.className='doc-renewal';
  var title=document.createElement('b');title.textContent='갱신 확인 · 이전 문서 '+review.sourceDate;panel.appendChild(title);
  var note=document.createElement('p');note.textContent='이전 내용이 복사되었습니다. 변경 사항은 아래에 요약하고 본문의 약 목록·해당 항목도 수정해주세요. 새 PDF에는 전체 내용이 포함됩니다. 서명은 새로 받아야 합니다.';panel.appendChild(note);
  (review.items||[]).forEach(function(item){var label=document.createElement('label');label.textContent=item.label;panel.appendChild(label);var select=document.createElement('select');[['','확인 필요'],['unchanged','기존 내용 유지 / 변경 없음'],['changed','변경 있음']].forEach(function(o){var op=document.createElement('option');op.value=o[0];op.textContent=o[1];select.appendChild(op);});select.value=item.choice;panel.appendChild(select);var ta=document.createElement('textarea');ta.placeholder='추가·중단된 약 / 용량·횟수 변경 등 확인한 내용';ta.value=item.note;ta.style.display=item.choice==='changed'?'block':'none';panel.appendChild(ta);select.onchange=function(){item.choice=select.value;ta.style.display=item.choice==='changed'?'block':'none';};ta.oninput=function(){item.note=ta.value;};});
  if(id==='pcsp-form-view')docButton('현재 AUTH 다시 조회',async function(){await loadPCSPAuthForMember(_pcspMemberId,true);var a=getSelectedPCSPAuth();review.authNote='현재 AUTH: '+(a&&a.authNo||'없음 / 직원 확인 필요');docRenderReview(id,review);},panel);
  if(review.authNote){var auth=document.createElement('p');auth.textContent=review.authNote;panel.appendChild(auth);}
  form.insertBefore(panel,form.children[1]||null);
}
function docUnsignedCopy(source,type,mid){
  var d=JSON.parse(JSON.stringify(source));
  ['id','documentId','sig','sigdate','memberSig','staffSig','ptSig','asSig','signedAt','signedBy','signatures','signature','signatureDate','pdfUrl','pdfFile','pdfError','createdAt','createdBy','createdByEmail','lastEditedBy','lastEditedByEmail','savedAt','updatedAt','_revision','_operationId','renewalReview'].forEach(function(k){delete d[k];});
  d.signed=false;d.status='작성중';d.mid=String(mid);d.date=new Date().toLocaleDateString('sv-SE');
  if(type==='Assessment'){d.assessor=_currentUser&&_currentUser.name||'';if(d.formFields){d.formFields['as-date']=d.date;d.formFields['as-assessor']=d.assessor;Object.keys(d.formFields).forEach(function(k){if(/sig|signed/i.test(k))delete d.formFields[k];});}}
  return d;
}
async function docCopy(i){
  if(_docBusy)return;var d=_docRows[i],c=Object.assign({},_docContext);
  if(!d||!d.signed||d.deletedAt)return;
  if(!window.confirm(c.name+' · '+c.type+' · '+d.date+'\n이 문서를 바탕으로 서명 없는 새 초안을 만드시겠습니까?'))return;
  _docBusy=true;
  try{
    var r=docResult(await apiGet({action:'documentRead',documentId:d.id,memberId:c.mid,fileType:c.type}));
    if(!r.found||!r.data)throw new Error('복사할 원본 데이터가 없습니다. PDF를 참고하여 새로 작성해주세요.');
    if(!_docMember||_docMember.mid!==c.mid)return;
    var review=docNewReview(d);
    if(c.type==='PCSP'){
      if(_wfBusy||_wfPending)throw new Error('진행 중인 PCSP 저장을 먼저 완료해주세요.');
      if(r.data.version!==2)throw new Error('PCSP v2 원본만 복사할 수 있습니다.');
      var p=docUnsignedCopy(r.data,'PCSP',c.mid);p.id='pcsp_'+crypto.randomUUID();p.memberId=c.mid;p.previousId=r.data.id;p.type='Annual';p.wdate=pcspToday();p.nextdate=pcspOneYearFromToday();p._revision=0;p.sig='';p.sigdate='';p.renewalReview=review;p.writer=_currentUser&&_currentUser.name||'';p.createdAt=new Date().toISOString();
      p.review={type:'Annual',previousDate:r.data.wdate||d.date,nextReviewDue:p.nextdate,reason:'Annual renewal',changesSinceLast:''};p.planning=p.planning||{};p.planning.meetingDate=p.wdate;
      (p.goals||[]).forEach(function(g){if(g.goal)g.needsConfirmation=true;});
      var oldAuth=r.data.authContext&&r.data.authContext.selected;
      p.authContext={selected:null,selectedId:'',records:[]};
      docHideForms();cachePCSPRecord(p);openPCSPForm(p.id);_wfPaused=true;
      try{await loadPCSPAuthForMember(c.mid,true);var auth=getSelectedPCSPAuth();review.authNote='이전 AUTH: '+(oldAuth&&oldAuth.authNo||'없음')+' → 현재 AUTH: '+(auth&&auth.authNo||'없음 / 직원 확인 필요');review.items.push({key:'auth',label:'현재 AUTH · 승인 기간/서비스 확인',choice:'',note:''});docRenderReview('pcsp-form-view',review);pcspSet('p-sigdate','');}finally{_wfPaused=false;}
      _docActive=null;return;
    }
    var seed=docUnsignedCopy(r.data,c.type,c.mid);seed.renewalReview=review;
    docNew();_docReview=review;_docActive.seed=seed;
  }catch(e){alert('복사 실패: '+e.message);}finally{_docBusy=false;}
}
function docRefreshVisible(){var hub=document.getElementById('forms-hub');if(_docMember&&_selectedFormsMember&&String(_selectedFormsMember.ID)===_docMember.mid&&hub&&hub.style.display!=='none'&&!_docBusy&&!_docActive)showDocumentHistory(_docMember.mid,_docMember.name);}
window.addEventListener('pageshow',function(e){if(e.persisted)docRefreshVisible();});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')docRefreshVisible();});
