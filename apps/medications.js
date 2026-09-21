// Shared editor UI; each document has its own medication array.
var _pcspMedicationRows=[],_pcspMedicationSource=null,_assessmentMedicationRows=[];
function medicationNormalize(rows){return (Array.isArray(rows)?rows:[]).map(function(r){return {name:String(r.name||''),dose:String(r.dose||''),reason:String(r.reason||'')};}).filter(function(r){return r.name.trim()||r.dose.trim()||r.reason.trim();});}
function medicationText(rows){return medicationNormalize(rows).map(function(r){return [r.name,r.dose,r.reason].filter(Boolean).join(' — ');}).join('\n');}
function medicationLegacy(text){return String(text||'').split('\n').filter(function(s){return s.trim();}).map(function(s){return {name:s,dose:'',reason:''};});}
function medicationEditorRows(context){return context==='pcsp'?_pcspMedicationRows:_assessmentMedicationRows;}
function medicationEditorRender(context){
  var root=document.getElementById(context==='pcsp'?'pcsp-medication-rows':'assessment-medication-editor');if(!root)return;root.textContent='';root.className='medication-editor';
  var toolbar=document.createElement('div');toolbar.className='medication-search';root.appendChild(toolbar);
  var label=document.createElement('label');label.textContent='약 검색 · 공용 라이브러리';toolbar.appendChild(label);
  var input=document.createElement('input');input.type='search';input.placeholder='약 이름을 검색하거나 직접 입력하세요';input.setAttribute('data-med-search','');input.autocomplete='off';label.appendChild(input);
  var add=document.createElement('button');add.type='button';add.className='medication-add';add.textContent='＋ 약 추가';toolbar.appendChild(add);
  var matches=document.createElement('div');matches.className='medication-matches';matches.hidden=true;toolbar.appendChild(matches);
  function commit(name,reason){medicationEditorRows(context).push({name:name||'',dose:'',reason:reason||''});medicationEditorRender(context);if(context==='pcsp')pcspMedicationSync();}
  add.onclick=function(){commit(input.value.trim(),'');};
  function search(){
    var q=input.value.trim().toLowerCase();matches.textContent='';matches.hidden=!q;if(!q)return;
    var library=typeof getMedLibrary==='function'?getMedLibrary():[];
    var found=library.filter(function(m){return String(m.name).toLowerCase().includes(q);}).slice(0,8);
    found.forEach(function(m){var option=document.createElement('button');option.type='button';option.textContent=m.name+(m.reason?' · '+m.reason:'');option.onclick=function(){commit(m.name,m.reason);};matches.appendChild(option);});
    if(!found.length){var msg=document.createElement('p');msg.textContent='검색 결과가 없습니다. 약 추가로 직접 입력할 수 있습니다.';matches.appendChild(msg);}
  }
  input.oninput=search;input.onfocus=search;input.onkeydown=function(e){if(e.key==='Escape')matches.hidden=true;if(e.key==='Enter'){e.preventDefault();commit(input.value.trim(),'');}};
  var rows=document.createElement('div');rows.className='medication-items';root.appendChild(rows);
  if(!medicationEditorRows(context).length){var empty=document.createElement('p');empty.className='medication-empty';empty.textContent='등록된 약이 없습니다. 검색 결과를 선택하거나 약을 추가하세요.';rows.appendChild(empty);}
  medicationEditorRows(context).forEach(function(row,i){var wrap=document.createElement('div');wrap.className='medication-row';rows.appendChild(wrap);
    [['name','약 이름'],['dose','용량 / 복용 횟수'],['reason','목적']].forEach(function(pair){var field=document.createElement('label');field.textContent=pair[1];var value=document.createElement('input');value.value=row[pair[0]];value.id=(context==='assessment'?'med-':'pcsp-med-')+(i+1)+'-'+pair[0];value.oninput=function(){row[pair[0]]=value.value;if(context==='pcsp')pcspMedicationSync();};field.appendChild(value);wrap.appendChild(field);});
    var actions=document.createElement('div');actions.className='medication-row-actions';wrap.appendChild(actions);
    var save=document.createElement('button');save.type='button';save.textContent='라이브러리 저장';save.onclick=async function(){if(!row.name.trim()){alert('약 이름을 입력해주세요.');return;}save.disabled=true;try{var ok=await saveMedToLibrary(row.name,row.reason);save.textContent=ok?'✓ 라이브러리 저장됨':'저장 실패 · 재시도';}finally{save.disabled=false;}};actions.appendChild(save);
    var remove=document.createElement('button');remove.type='button';remove.className='medication-remove';remove.textContent='삭제';remove.setAttribute('aria-label',(row.name||'약 '+(i+1))+' 행 삭제');remove.onclick=function(){medicationEditorRows(context).splice(i,1);medicationEditorRender(context);if(context==='pcsp')pcspMedicationSync();};actions.appendChild(remove);
  });
}
function pcspMedicationRestore(health){health=health||{};_pcspMedicationRows=Array.isArray(health.medicationList)?medicationNormalize(health.medicationList):medicationLegacy(health.medications);_pcspMedicationSource=health.medicationSource||null;pcspMedicationRender();}
function pcspMedicationRender(){medicationEditorRender('pcsp');pcspMedicationSync();}
function pcspMedicationSync(){var text=document.getElementById('p-meds');if(text)text.value=medicationText(_pcspMedicationRows);}
function pcspMedicationCollect(){return medicationNormalize(_pcspMedicationRows);}
function pcspMedicationAdd(){_pcspMedicationRows.push({name:'',dose:'',reason:''});pcspMedicationRender();}
function assessmentMedicationReset(){_assessmentMedicationRows=[];medicationEditorRender('assessment');}
function assessmentMedicationRestore(data){
  var rows=data.medications;
  if(!Array.isArray(rows)){var fields=data.formFields||{},indices=Object.keys(fields).map(function(k){return /^med-(\d+)-name$/.exec(k);}).filter(Boolean).map(function(m){return Number(m[1]);}).sort(function(a,b){return a-b;});rows=indices.map(function(i){return {name:fields['med-'+i+'-name'],dose:fields['med-'+i+'-dose'],reason:fields['med-'+i+'-reason']};});}
  _assessmentMedicationRows=medicationNormalize(rows);medicationEditorRender('assessment');
}
function assessmentMedicationCollect(){return medicationNormalize(_assessmentMedicationRows);}
function assessmentMedicationAdd(){_assessmentMedicationRows.push({name:'',dose:'',reason:''});medicationEditorRender('assessment');}
function medicationComparison(current,incoming){
  var used=new Set(),result=[];function key(row){return row.name.trim().toLowerCase().replace(/\s+/g,' ');}
  incoming.forEach(function(next){var index=current.findIndex(function(old,i){return !used.has(i)&&key(old)&&key(old)===key(next);});
    if(index>=0){used.add(index);if(JSON.stringify(current[index])!==JSON.stringify(next))result.push({kind:'update',index:index,before:current[index],after:next});}
    else result.push({kind:'add',after:next});
  });
  current.forEach(function(old,i){if(!used.has(i))result.push({kind:'remove',index:i,before:old});});return result;
}
function pcspMedicationCompare(assessment,source){
  if(_pcspSig||_wfBusy||_wfPending){alert('서명 또는 저장 중인 문서에는 반영할 수 없습니다.');return;}
  var id=pcspVal('pcsp-edit-id'),mid=_pcspMemberId,current=pcspMedicationCollect(),fingerprint=JSON.stringify(current),incoming=medicationNormalize(assessment.medications),changes=medicationComparison(current,incoming);
  var dialog=document.createElement('dialog');dialog.className='medication-compare';var h=document.createElement('h3');h.textContent='Assessment 약 목록 비교';dialog.appendChild(h);
  var info=document.createElement('p');info.textContent='평가일 '+(assessment.date||'미기재')+' · '+(assessment.signed?'서명 완료':'미서명 초안')+' · 반영할 항목을 직접 선택하세요. 목록에 없는 약이 중단되었다는 뜻은 아닙니다.';dialog.appendChild(info);
  var selectors=[];changes.forEach(function(change){var label=document.createElement('label');label.className='medication-change';var checkbox=document.createElement('input');checkbox.type='checkbox';label.appendChild(checkbox);var text=document.createElement('span');text.textContent=change.kind==='add'?'추가: '+medicationText([change.after]):change.kind==='remove'?'이 PCSP에서 제거할지 확인: '+medicationText([change.before]):'변경: '+medicationText([change.before])+' → '+medicationText([change.after]);label.appendChild(text);dialog.appendChild(label);selectors.push({checkbox:checkbox,change:change});});
  if(!changes.length){var same=document.createElement('p');same.textContent='약 목록이 동일합니다.';dialog.appendChild(same);}
  var apply=document.createElement('button');apply.textContent='선택한 변경 반영';apply.onclick=function(){
    if(id!==pcspVal('pcsp-edit-id')||mid!==_pcspMemberId||_pcspSig||_wfBusy||_wfPending||fingerprint!==JSON.stringify(pcspMedicationCollect())){alert('문서가 변경되었습니다. 비교를 다시 열어주세요.');return;}
    var selected=selectors.filter(function(s){return s.checkbox.checked;}).map(function(s){return s.change;});
    if(changes.length&&!selected.length){alert('반영할 항목을 선택하거나 취소해주세요.');return;}
    var rows=current.map(function(r){return Object.assign({},r);});selected.filter(function(c){return c.kind==='update';}).forEach(function(c){rows[c.index]=c.after;});var removals=new Set(selected.filter(function(c){return c.kind==='remove';}).map(function(c){return c.index;}));rows=rows.filter(function(r,i){return !removals.has(i);});selected.filter(function(c){return c.kind==='add';}).forEach(function(c){rows.push(c.after);});
    _pcspMedicationRows=rows;_pcspMedicationSource={type:'Assessment',documentId:assessment.documentId||'',date:assessment.date||'',savedAt:assessment.savedAt||'',confirmedAt:new Date().toISOString(),changes:selected};pcspMedicationRender();
    var entry=wfEntry();_wfMeta[entry.id]=Object.assign({},_wfMeta[entry.id],{importSources:((_wfMeta[entry.id]||{}).importSources||[]).concat([source])});wfNotice('선택한 약 정보를 초안에 반영했습니다. 저장 상태를 확인해주세요.');dialog.close();dialog.remove();
  };dialog.appendChild(apply);var cancel=document.createElement('button');cancel.textContent='취소';cancel.onclick=function(){dialog.close();dialog.remove();};dialog.appendChild(cancel);dialog.addEventListener('cancel',function(){dialog.remove();});document.body.appendChild(dialog);dialog.showModal();
}
