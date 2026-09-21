// Shared medication records: {name, dose, reason}. Narrative text is a PDF/AI projection.
var _pcspMedicationRows=[],_pcspMedicationSource=null;
function medicationNormalize(rows){return (Array.isArray(rows)?rows:[]).map(function(r){return {name:String(r.name||''),dose:String(r.dose||''),reason:String(r.reason||'')};}).filter(function(r){return r.name.trim()||r.dose.trim()||r.reason.trim();});}
function medicationText(rows){return medicationNormalize(rows).map(function(r){return [r.name,r.dose,r.reason].filter(Boolean).join(' — ');}).join('\n');}
function medicationLegacy(text){return String(text||'').split('\n').filter(function(s){return s.trim();}).map(function(s){return {name:s,dose:'',reason:''};});}
function pcspMedicationRestore(health){health=health||{};_pcspMedicationRows=Array.isArray(health.medicationList)?medicationNormalize(health.medicationList):medicationLegacy(health.medications);_pcspMedicationSource=health.medicationSource||null;pcspMedicationRender();}
function pcspMedicationRender(){
  var root=document.getElementById('pcsp-medication-rows');if(!root)return;root.textContent='';
  _pcspMedicationRows.forEach(function(row,i){var wrap=document.createElement('div');wrap.className='medication-row';root.appendChild(wrap);
    [['name','약 이름'],['dose','용량 / 복용 횟수'],['reason','목적']].forEach(function(pair){var label=document.createElement('label');label.textContent=pair[1];var input=document.createElement('input');input.value=row[pair[0]];input.oninput=function(){row[pair[0]]=input.value;pcspMedicationSync();};label.appendChild(input);wrap.appendChild(label);});
    var remove=document.createElement('button');remove.type='button';remove.textContent='행 삭제';remove.onclick=function(){_pcspMedicationRows.splice(i,1);pcspMedicationRender();};wrap.appendChild(remove);
  });pcspMedicationSync();
}
function pcspMedicationSync(){var text=document.getElementById('p-meds');if(text)text.value=medicationText(_pcspMedicationRows);}
function pcspMedicationCollect(){return medicationNormalize(_pcspMedicationRows);}
function pcspMedicationAdd(){_pcspMedicationRows.push({name:'',dose:'',reason:''});pcspMedicationRender();}
function assessmentMedicationReset(){var extra=document.getElementById('assessment-medication-extra');if(extra)extra.textContent='';}
function assessmentMedicationEnsure(count){
  var extra=document.getElementById('assessment-medication-extra');if(!extra)return;
  for(var i=6;i<=count;i++){if(document.getElementById('med-'+i+'-name'))continue;var row=document.createElement('div');row.className='medication-row';extra.appendChild(row);['name','dose','reason'].forEach(function(k){var label=document.createElement('label');label.textContent={name:'약 이름',dose:'용량 / 복용 횟수',reason:'목적'}[k];var input=document.createElement('input');input.id='med-'+i+'-'+k;label.appendChild(input);row.appendChild(label);});}
}
function assessmentMedicationCollect(){var rows=[];for(var i=1;document.getElementById('med-'+i+'-name');i++){function value(k){return document.getElementById('med-'+i+'-'+k).value;}rows.push({name:value('name'),dose:value('dose'),reason:value('reason')});}return medicationNormalize(rows);}
function assessmentMedicationAdd(){var i=1;while(document.getElementById('med-'+i+'-name'))i++;assessmentMedicationEnsure(i);}
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
