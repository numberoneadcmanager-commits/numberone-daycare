// Original files and medication extraction. Persistent data stays in Drive/Sheets.
function attachmentResult(r){if(!r||!r.ok||!r.data||r.data.success===false)throw new Error(r&&r.data&&r.data.error||'서버 저장을 확인하지 못했습니다.');return r.data;}
function attachmentRead(file){return new Promise(function(resolve,reject){if(!file.size||file.size>20*1024*1024){reject(new Error('PDF/JPG/PNG, 최대 20MB를 선택해주세요.'));return;}var reader=new FileReader();reader.onload=function(){resolve(String(reader.result).split(',')[1]);};reader.onerror=function(){reject(new Error('파일 읽기 실패'));};reader.readAsDataURL(file);});}
async function attachmentUpload(file,mid,name,type){var b64=await attachmentRead(file);return attachmentResult(await apiCall({action:'savePDF',memberId:mid,memberName:name,fileType:type,originalName:file.name,base64Data:b64,author:_currentUser&&_currentUser.name||''}));}
async function attachmentRepair(d){
  if(!window.confirm('원본은 보존하고, 실제 파일 형식에 맞는 복구본으로 보기 링크를 바꿉니다. 진행할까요?'))return;
  try{var r=attachmentResult(await apiCall({action:'repairUploadedFile',documentId:d.id,memberId:d.mid,expectedUrl:d.pdfUrl}));alert((r.unchanged?'파일 형식이 정상입니다.': '파일 형식을 복구했습니다. 파일 보기를 눌러주세요.')+(r.warning?'\n'+r.warning:''));if(_docMember&&_docMember.mid===d.mid)await showDocumentHistory(d.mid,_docMember.name,d.type);}catch(e){alert(e.message);}
}
async function attachmentRepairCenter(btn){
  var id=document.getElementById('doc-edit-id').value,url=document.getElementById('doc-link').value;
  if(!id||!url){alert('저장된 센터 문서를 먼저 열어주세요.');return;}
  if(!window.confirm('원본을 보존하고 이 센터 문서의 파일 형식을 복구할까요?'))return;
  btn.disabled=true;
  try{var r=attachmentResult(await apiCall({action:'repairUploadedFile',centerId:id,expectedUrl:url}));
    if(typeof WriteGuard!=='undefined'&&r.writeToken)WriteGuard.saved({_guardKey:'docs|'+id},{data:r});
    var row=DOCS_LIST.find(function(d){return String(d.id)===String(id);});if(row)row.link=r.url;
    if(document.getElementById('doc-edit-id').value===id&&document.getElementById('doc-link').value===url)document.getElementById('doc-link').value=r.url;
    renderDocsList();alert((r.unchanged?'파일 형식이 정상입니다.':'복구가 완료되었습니다.')+(r.warning?'\n'+r.warning:''));
  }catch(e){alert(e.message);}finally{btn.disabled=false;}
}
function medElement(tag,text,parent,cls){var el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;if(parent)parent.appendChild(el);return el;}
function medButton(text,fn,parent){var b=medElement('button',text,parent);b.type='button';b.onclick=fn;return b;}
function medDialog(title){var d=medElement('dialog',null,document.body,'medication-source-dialog');medElement('h2',title,d);d.addEventListener('cancel',function(){d.remove();});d.showModal();return d;}
function medClose(d){d.close();d.remove();}
function medOpenOriginal(url){if(!/^https:\/\/drive\.google\.com\//.test(url||'')){alert('Drive 링크를 확인해주세요.');return;}window.open(url,'_blank','noopener');}
function medicationTarget(context){
  var form=document.getElementById(context==='pcsp'?'pcsp-form-view':'frm-assessment');
  if(!form||form.style.display==='none'||form.inert)throw new Error('작성 중인 문서를 먼저 열어주세요.');
  if(context==='pcsp'){
    if(!_pcspMemberId||_pcspSig||_wfBusy||_wfPending||((_wfMeta[pcspVal('pcsp-edit-id')]||{}).signedAt))throw new Error('서명된 문서나 저장 중인 문서에는 반영할 수 없습니다.');
    var entry=wfEntry();return {mid:String(_pcspMemberId),id:entry.id};
  }
  if(!_docActive||_docActive.type!=='Assessment'||_docActive.signed||_ptSig||_asSig||_docBusy||_docPending)throw new Error('서명 전의 Assessment를 열고 저장 처리를 완료해주세요.');
  if(!_formLoads['frm-assessment']||!_formLoads['frm-assessment'].ready||_formLoads['frm-assessment'].readOnly)throw new Error('Assessment 조회가 완료되지 않았습니다.');
  return {mid:String(_docActive.mid),id:_docActive.id};
}
function medicationCheckTarget(context,target,fingerprint){var current=medicationTarget(context);if(current.id!==target.id||current.mid!==target.mid||JSON.stringify(medicationNormalize(medicationEditorRows(context)))!==fingerprint)throw new Error('회원 또는 약 목록이 변경됐습니다. 가져오기를 다시 열어주세요.');}
async function medicationSourcePicker(context){
  var target;try{target=medicationTarget(context);}catch(e){alert(e.message);return;}
  var fingerprint=JSON.stringify(medicationNormalize(medicationEditorRows(context))),d=medDialog('📄 약 리스트 원본 선택');
  medElement('p','원본을 선택하면 AI 초안을 확인할 수 있습니다. 확인한 약만 현재 문서에 반영합니다.',d);
  var list=medElement('div','불러오는 중…',d);
  async function refresh(){try{var r=attachmentResult(await apiGet({action:'documentList',memberId:target.mid,fileType:'Medication_List'}));if(!d.isConnected)return;list.textContent='';
    var rows=(r.documents||[]).filter(function(x){return !x.deletedAt;}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
    if(!rows.length)medElement('p','보관된 약 리스트가 없습니다. 사진이나 PDF를 올려주세요.',list);
    rows.forEach(function(row){var item=medElement('div',null,list,'medication-source-row');medElement('strong',String(row.date||'').slice(0,10),item);medButton('원본 보기',function(){medOpenOriginal(row.pdfUrl);},item);medButton('선택 / AI 읽기',function(){try{medicationCheckTarget(context,target,fingerprint);medClose(d);medicationSourceOpen(row,{context:context,target:target,fingerprint:fingerprint});}catch(e){alert(e.message);}},item);});
  }catch(e){if(d.isConnected)list.textContent=e.message;}}
  var upload=medButton('＋ 사진 / PDF 업로드',function(){var input=document.createElement('input');input.type='file';input.accept='.pdf,.jpg,.jpeg,.png';input.onchange=async function(){var file=input.files[0];if(!file)return;upload.disabled=true;try{
    medicationCheckTarget(context,target,fingerprint);var member=_formsMemberCache.find(function(m){return String(m.ID)===target.mid;});if(!member)throw new Error('회원 정보를 다시 불러와주세요.');
    await attachmentUpload(file,target.mid,member['한글이름']||member['영문이름'],'Medication_List');await refresh();
  }catch(e){alert(e.message);}finally{upload.disabled=false;}};input.click();},d);
  medButton('닫기',function(){medClose(d);},d);await refresh();
}
async function medicationSourceOpen(source,targetInfo){
  var listSerial=_docListSerial;
  var d=medDialog('💊 약 리스트 · AI 검토');
  function refreshHistory(){var hub=document.getElementById('forms-hub');if(!targetInfo&&_docMember&&_docMember.mid===source.mid&&listSerial===_docListSerial&&hub&&hub.style.display!=='none')showDocumentHistory(source.mid,_docMember.name,'Medication_List');}
  d.addEventListener('close',refreshHistory);d.addEventListener('cancel',refreshHistory);medButton('원본 보기 ↗',function(){medOpenOriginal(source.pdfUrl);},d);
  medElement('p','환자 이름과 작성일을 원본에서 먼저 확인하세요. AI 결과는 초안이며 목적·중단 여부를 추측하지 않습니다.',d);
  var status=medElement('p','저장된 AI 초안을 확인하는 중…',d),body=medElement('div',null,d),busy=false;
  var read=medButton('✨ AI로 읽기 / 다시 읽기',async function(){
    if(busy)return;if(!window.confirm('이 약 리스트 원본을 Claude AI로 읽고 검토용 초안을 저장할까요?'))return;
    busy=true;read.disabled=true;body.textContent='';status.textContent='AI가 읽는 중… 잠시 기다려주세요.';
    try{show(attachmentResult(await apiCall({action:'medicationExtract',memberId:source.mid,documentId:source.id})));}catch(e){if(d.isConnected)status.textContent=e.message;}finally{busy=false;read.disabled=false;}
  },d);read.disabled=true;
  medButton('닫기',function(){medClose(d);},d);
  function show(result){if(!d.isConnected)return;if(!result.found){status.textContent='보관된 초안이 없습니다. AI로 읽기를 눌러주세요.';return;}
    status.textContent='AI 초안 저장됨 · '+result.extraction.extractedAt.slice(0,10);body.textContent='';
    medicationReview(body,result.extraction,source,targetInfo,function(){medClose(d);});
  }
  try{show(attachmentResult(await apiCall({action:'medicationRead',memberId:source.mid,documentId:source.id})));}catch(e){if(d.isConnected)status.textContent=e.message;}finally{read.disabled=false;}
}
function medKey(value){return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');}
function medicationExtractRows(raw){
  var seen=new Set(),duplicateCount=0,rows=[];
  (raw||[]).forEach(function(r){var keys=['name','ingredient','strength','form','directions','purpose','status'];var key=JSON.stringify(keys.map(function(k){return medKey(r[k]);}).concat([r.uncertain===true]));
    // Uncertain readings are never silently collapsed.
    if(!r.uncertain&&seen.has(key)){duplicateCount++;return;}seen.add(key);
    rows.push({name:[r.name,r.form].filter(Boolean).join(' · '),dose:[r.strength,r.directions].filter(Boolean).join(' · '),reason:r.purpose||'',ingredient:r.ingredient||'',status:r.status||'',uncertain:!!r.uncertain,note:r.note||''});
  });return {rows:rows,duplicateCount:duplicateCount};
}
function medSame(a,b){return medKey(a.name)===medKey(b.name)&&medKey(a.dose)===medKey(b.dose);}
function medRelated(a,b){var an=medKey(a.name),bn=medKey(b.name),ai=medKey(a.ingredient),bi=medKey(b.ingredient);return !!(an&&bn&&(an===bn||an.indexOf(bn)>=0||bn.indexOf(an)>=0||(ai&&bi&&ai===bi)||(ai.length>=4&&bn.indexOf(ai)>=0)||(bi.length>=4&&an.indexOf(bi)>=0)));}
function medicationApplyChoices(current,choices){
  var result=current.map(function(r){return Object.assign({},r);}),used=new Set(),skipped=0;
  choices.forEach(function(c){if(c.action==='skip')return;if(!c.row.name.trim())throw new Error('반영할 약 이름을 확인해주세요.');
    var clean={name:c.row.name.trim(),dose:c.row.dose.trim(),reason:c.row.reason.trim()};
    if(c.action==='add'){if(result.some(function(r){return medSame(r,clean);})){skipped++;return;}result.push(clean);}
    else{var index=Number(c.action);if(!Number.isInteger(index)||index<0||index>=current.length||used.has(index))throw new Error('같은 기존 약에 여러 변경을 선택했습니다. 한 항목만 선택해주세요.');
      if(result.some(function(r,i){return i!==index&&medSame(r,clean);}))throw new Error('변경 결과가 다른 약과 중복됩니다. 반영 선택을 확인해주세요.');used.add(index);result[index]=clean;}
  });return {rows:result,skipped:skipped};
}
function medicationReview(body,extraction,source,targetInfo,close){
  var processed=medicationExtractRows(extraction.rows),incoming=processed.rows,current=targetInfo?medicationNormalize(medicationEditorRows(targetInfo.context)):[],choices=[];
  medElement('p','완전히 일치하는 반복 항목 '+processed.duplicateCount+'건 제외 · 검토할 항목 '+incoming.length+'건',body,'medication-review-summary');
  (extraction.warnings||[]).forEach(function(w){medElement('p','확인: '+w,body,'medication-review-warning');});
  if(!targetInfo)medElement('p','아래는 읽기 결과입니다. Assessment 또는 작성 중인 PCSP의 약 입력란에서 「약 리스트에서 가져오기」를 눌러 반영하세요.',body);
  if(!incoming.length)medElement('p','읽힌 약이 없습니다. 원본의 선명도와 페이지를 확인해주세요.',body);
  incoming.forEach(function(row,i){
    var card=medElement('section',null,body,'medication-review-card');medElement('h3',(i+1)+'. '+(row.name||'이름 확인 필요'),card);
    var same=current.some(function(r){return medSame(r,row);}),related=current.filter(function(r){return medRelated(r,row);}),peers=incoming.filter(function(r,j){return j!==i&&medRelated(r,row);});
    var message=same?'기존 목록과 이름·용량 일치 — 기본 제외':related.length?'기존 약과 중복 / 변경 후보':peers.length?'이 원본 안에 유사 약이 있습니다 — 함께 확인':'새 약 후보';
    medElement('p',message,card,same?'medication-review-summary':'medication-review-warning');
    if(related.length)medElement('p','현재: '+medicationText(related),card);
    if(peers.length)medElement('p','원본의 유사 항목: '+peers.map(function(r){return r.name+' / '+r.dose;}).join('; '),card);
    if(row.ingredient)medElement('p','원본 성분 표기: '+row.ingredient,card);
    if(row.status||row.uncertain||row.note)medElement('p',[row.status?'원본 상태: '+row.status:'',row.uncertain?'판독 불확실 — 원본 확인 필수':'',row.note].filter(Boolean).join(' · '),card,'medication-review-warning');
    ['name','dose','reason'].forEach(function(key,j){var label=medElement('label',['약 이름 / 제형','용량 / 복용법','원본에 기재된 목적'][j],card);var input=medElement('input',null,label);input.value=row[key];input.readOnly=!targetInfo;input.oninput=function(){row[key]=input.value;};});
    if(targetInfo){var label=medElement('label','반영 방법 — 직접 선택',card),select=medElement('select',null,label);
      var skip=medElement('option','반영하지 않음',select);skip.value='skip';var add=medElement('option','새 약으로 추가',select);add.value='add';
      current.forEach(function(old,index){var opt=medElement('option','기존 '+(index+1)+': '+old.name+' / '+old.dose+' → 변경',select);opt.value=String(index);});
      select.value='skip';choices.push({select:select,row:row});
    }
  });
  if(targetInfo&&incoming.length){
    var label=medElement('label',null,body,'medication-review-confirm'),confirmed=medElement('input',null,label);confirmed.type='checkbox';medElement('span','원본의 환자·날짜, 현재 복용 여부, 중복 및 용량·복용법을 확인했습니다.',label);
    var status=medElement('p','선택한 항목만 반영됩니다. 기존 약의 자동 삭제는 없습니다.',body);
    medButton('확인한 항목을 현재 초안에 반영',async function(){
      try{medicationCheckTarget(targetInfo.context,targetInfo.target,targetInfo.fingerprint);
        if(!confirmed.checked)throw new Error('원본 확인 체크가 필요합니다.');
        var selected=choices.map(function(c){return {action:c.select.value,row:Object.assign({},c.row)};}).filter(function(c){return c.action!=='skip';});if(!selected.length)throw new Error('반영 방법을 선택해주세요.');
        var proposed=medicationApplyChoices(current,selected);
        var related=selected.filter(function(c){return c.action==='add'&&(current.some(function(r){return medRelated(r,c.row);})||selected.some(function(other){return other!==c&&medRelated(other.row,c.row);}));});
        if(related.length&&!window.confirm('기존 또는 선택한 약과 이름/성분이 유사한 항목을 별도로 추가합니다. 서로 다른 처방으로 확인했습니까?\n'+related.map(function(c){return c.row.name+' / '+c.row.dose;}).join('\n')))return;
        // Verify source still belongs to this member and is not deleted before applying.
        var sourceCheck=attachmentResult(await apiCall({action:'medicationRead',memberId:targetInfo.target.mid,documentId:source.id}));
        if(!sourceCheck.found||sourceCheck.extraction.extractedAt!==extraction.extractedAt)throw new Error('원본 AI 초안이 변경되었습니다. 다시 열어주세요.');
        medicationCheckTarget(targetInfo.context,targetInfo.target,targetInfo.fingerprint);
        var metadata={type:'Medication_List',documentId:source.id,sourceFile:extraction.sourceFile,extractedAt:extraction.extractedAt,confirmedAt:new Date().toISOString(),confirmedBy:_currentUser&&_currentUser.email||'',changes:selected};
        if(targetInfo.context==='pcsp'){_pcspMedicationRows=proposed.rows;_pcspMedicationSource=metadata;pcspMedicationRender();}
        else{_assessmentMedicationRows=proposed.rows;_assessmentMedicationSource=metadata;medicationEditorRender('assessment');}
        close();alert('선택 항목을 초안에 반영했습니다.'+(proposed.skipped?' 완전히 같은 약 '+proposed.skipped+'건은 추가하지 않았습니다.':'')+' 문서 저장을 확인해주세요.');
      }catch(e){status.textContent=e.message;}
    },body);
  }
}
