// One document at a time. No browser-persistent state or signature copying.
var _docContext=null,_docRows=[],_docActive=null,_docBusy=false,_docPending=null,_docListSerial=0;
function docResult(res){if(!res||!res.ok||!res.data||res.data.success===false)throw new Error(res&&res.data&&res.data.error||'서버 응답을 확인하지 못했습니다.');return res.data;}
function docHideForms(){['forms-hub','frm-assessment','frm-nutrition','frm-member-rights','frm-incident','pcsp-list-view','pcsp-member-select','pcsp-form-view'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
async function showDocumentHistory(mid,name,type){
  if(_docBusy){alert('저장 중입니다. 잠시 기다려주세요.');return;}
  if(_docPending&&!window.confirm('저장 결과를 확인하지 못한 입력이 있습니다. 화면을 나가 서버 목록을 다시 확인하시겠습니까?'))return;
  _docContext={mid:String(mid),name:name||'',type:type};_docActive=null;_docPending=null;_formLoads={};docHideForms();
  var box=document.getElementById('document-history');box.style.display='block';box.innerHTML='<p>문서 이력을 불러오는 중...</p>';var serial=++_docListSerial;
  try{var data=docResult(await apiGet({action:'documentList',memberId:mid,fileType:type}));if(serial!==_docListSerial)return;_docRows=data.documents||[];renderDocumentHistory(false);}
  catch(e){if(serial!==_docListSerial)return;box.textContent=e.message;var btn=document.createElement('button');btn.textContent='다시 불러오기';btn.onclick=function(){showDocumentHistory(mid,name,type);};box.appendChild(btn);}
}
function renderDocumentHistory(trash){
  var c=_docContext,box=document.getElementById('document-history');box.innerHTML='';
  function button(label,fn,parent){var b=document.createElement('button');b.className='btn-sm';b.textContent=label;b.onclick=fn;(parent||box).appendChild(b);}
  button('← 문서 종류',function(){_docContext=null;_docActive=null;box.style.display='none';document.getElementById('forms-hub').style.display='block';});
  var title=document.createElement('h3');title.textContent=c.name+' · '+c.type;box.appendChild(title);
  button('＋ 새로 작성',docNew);button('새로고침',function(){showDocumentHistory(c.mid,c.name,c.type);});button(trash?'작성 이력 보기':'삭제한 문서',function(){renderDocumentHistory(!trash);});
  var note=document.createElement('p');note.textContent='미서명 문서는 이어서 작성할 수 있습니다. 서명 완료 문서는 읽기 전용입니다.';box.appendChild(note);
  var rows=_docRows.map(function(d,i){return {d:d,i:i};}).filter(function(x){return !!x.d.deletedAt===!!trash;}).sort(function(a,b){return String(b.d.updatedAt||b.d.date).localeCompare(String(a.d.updatedAt||a.d.date));});
  if(!rows.length){var empty=document.createElement('p');empty.textContent=trash?'삭제한 문서가 없습니다.':'작성된 문서가 없습니다.';box.appendChild(empty);}
  rows.forEach(function(x){var d=x.d,card=document.createElement('div');card.className='card';var label=document.createElement('div');label.textContent=(d.date||'날짜 미상')+' · '+(d.deletedAt?'삭제됨':d.status|| (d.signed?'완료':'미서명'))+(d.legacy?' · 기존 저장본':'');card.appendChild(label);box.appendChild(card);
    if(trash){button('복구',function(){docChange(x.i,true);},card);return;}
    if(d.pdfUrl)button('PDF 보기',function(){window.open(d.pdfUrl,'_blank','noopener');},card);
    if(d.jsonFile||d.type==='PCSP'||d.type==='Incident')button(d.signed?'저장 내용 보기':'이어서 작성 / 서명',function(){docOpen(x.i);},card);
    if(d.signed&&!d.pdfUrl&&d.canGeneratePDF&&d.type!=='PCSP')button('PDF 생성 재시도',async function(){try{docResult(await apiCall({action:'documentPDF',documentId:d.id,memberId:c.mid}));showDocumentHistory(c.mid,c.name,c.type);}catch(e){alert(e.message);}},card);
    if(d.type==='PCSP'&&d.status==='서명완료·PDF대기')button('PDF 생성 재시도',async function(){await loadPCSPFromSheets();await wfRetryPDF(d.recordId);showDocumentHistory(c.mid,c.name,c.type);},card);
    button('삭제',function(){docChange(x.i,false);},card);
  });
}
async function docChange(i,restore){var d=_docRows[i],c=_docContext;
  var reason=restore?'':window.prompt(c.name+' / '+c.type+' / '+d.date+' / '+(d.signed?'서명 완료':'미서명')+'\n삭제 사유를 입력해주세요. 삭제 목록에서 복구할 수 있습니다.','');
  if(!restore&&(reason===null||!reason.trim()))return;
  if(!window.confirm(c.name+' · '+c.type+' · '+d.date+'\n이 문서를 '+(restore?'복구':'삭제')+'하시겠습니까?'))return;
  try{docResult(await apiCall({action:'documentState',documentId:d.id,memberId:c.mid,fileType:c.type,expectedRevision:d.revision||0,reason:reason,restore:restore,actor:_currentUser&&_currentUser.email||''}));await showDocumentHistory(c.mid,c.name,c.type);}catch(e){alert(e.message);}
}
function docNew(){var c=_docContext;if(!c)return;_docActive={id:'doc_'+crypto.randomUUID(),mid:c.mid,type:c.type,revision:0,isNew:true,signed:false};_docPending=null;document.getElementById('document-history').style.display='none';
  if(c.type==='PCSP'){var m=_formsMemberCache.find(function(m){return String(m.ID)===c.mid;});selectPCSPMember(m);}
  else if(c.type==='Nutrition')openNutritionForMember(c.mid,c.name);
  else if(c.type==='Assessment')openAssessmentForMember(c.mid,c.name);
  else if(c.type==='MemberRights')openMemberRightsForMember(c.mid,c.name);
  else if(c.type==='HIPAA'){document.getElementById('document-history').style.display='block';openHIPAAForMember(c.mid,c.name);}
  else if(c.type==='Incident')openIncidentForMember(c.mid,c.name);
  else{uploadMemberID(c.mid,c.name,c.type);document.getElementById('document-history').style.display='block';}
}
async function docOpen(i){var d=_docRows[i],c=_docContext;_docActive=Object.assign({},d);_docPending=null;document.getElementById('document-history').style.display='none';
  if(d.type==='PCSP'){
    if(d.signed){if(d.pdfUrl){window.open(d.pdfUrl,'_blank','noopener');document.getElementById('document-history').style.display='block';}else{alert('서명된 원본은 편집할 수 없습니다. PDF 생성 재시도를 사용해주세요.');document.getElementById('document-history').style.display='block';}return;}
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
  if(a.isNew)return {ok:true,data:{found:false}};
  var res=await apiGet({action:'documentRead',documentId:a.id,memberId:mid,fileType:type});
  var r=docResult(res);if(_docActive===a&&r.document)_docActive=Object.assign({},r.document);return res;
}
function docPrintFields(type){
  var root=document.getElementById(type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment'),fields=[];
  if(type==='MemberRights')fields.push({label:'Participant Bill of Rights',value:root.innerText});
  if(type==='Nutrition')fields.push({label:'Date of Birth',value:document.getElementById('ns-dob').textContent});
  root.querySelectorAll('input,select,textarea').forEach(function(el){
    if(el.type==='file'||el.type==='hidden'||el.type==='button')return;
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
  var body=_docPending||{action:'documentSave',documentId:a.id,memberId:mid,memberName:name,fileType:type,expectedRevision:a.revision||0,operationId:crypto.randomUUID(),jsonData:data,printFields:docPrintFields(type)};
  _docPending=body;_docBusy=true;
  var form=document.getElementById(type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment');form.inert=true;
  try{var r=docResult(await docSaveRequest(body));_docPending=null;if(_docActive&&_docActive.id===a.id)_docActive=r.document;
    if(r.document.signed){var id=type==='MemberRights'?'frm-member-rights':type==='Nutrition'?'frm-nutrition':'frm-assessment';docApplyReadonly(id);if(r.document.pdfError)alert('서명된 원본은 저장했습니다. PDF 생성은 문서 이력에서 재시도해주세요.');}
    return {ok:true,data:{success:true,document:r.document}};
  }finally{_docBusy=false;form.inert=false;docApplyReadonly(form.id);}
}
function docApplyReadonly(id){
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
