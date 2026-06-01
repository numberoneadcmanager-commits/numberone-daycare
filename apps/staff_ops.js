// ══════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 스태프 관리 (Operations)
// apps/staff_ops.js
// ══════════════════════════════════════════════════════════

function renderOpStaff(){
  var STAFF_OP=JSON.parse(localStorage.getItem('staff_data')||'[]');
  var e=document.getElementById('op-staff-total');if(e)e.textContent=STAFF_OP.length;
  var today=new Date().toISOString().slice(0,10);
  var exp=0,soon=0;
  STAFF_OP.forEach(function(s){
    (s.certs||[]).forEach(function(c){
      if(!c.exp)return;
      var diff=Math.floor((new Date(c.exp)-new Date(today))/86400000);
      if(diff<0)exp++;else if(diff<=90)soon++;
    });
  });
  e=document.getElementById('op-staff-exp');if(e)e.textContent=exp;
  e=document.getElementById('op-staff-soon');if(e)e.textContent=soon;

  if(!STAFF_OP.length){
    var el2=document.getElementById('op-staff-list');
    if(el2)el2.innerHTML='<div class="empty-msg">스태프가 없어요. 추가해주세요.</div>';
    return;
  }

  var html='';
  STAFF_OP.forEach(function(s){
    var certHTML=(s.certs||[]).map(function(c){
      var diff=Math.floor((new Date(c.exp)-new Date(today))/86400000);
      var cls=diff<0?'b-red':diff<=90?'b-warn':'b-ok';
      var icon=diff<0?'❌':diff<=90?'⚠️':'✅';
      return '<span class="badge '+cls+'">'+icon+' '+c.name+' ('+c.exp+')</span>';
    }).join(' ');
    html+='<div class="log-card">'
      +'<div class="log-top">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:36px;height:36px;border-radius:50%;background:'+(s.avBg||'#FAECE7')+';color:'+(s.avColor||'#993C1D')+';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">'+(s.nameKr||s.name||'?')[0]+'</div>'
      +'<div><div style="font-size:13px;font-weight:700">'+(s.nameKr||'')+'</div>'
      +'<div style="font-size:11px;color:#8E8E93">'+(s.name||'')+' · '+(s.role||'')+'</div></div></div>'
      +'</div>'
      +(s.phone||s.email?'<div style="font-size:11px;color:#3C3C43;margin:4px 0">📞 '+(s.phone||'—')+' · '+(s.email||'—')+'</div>':'')
      +(certHTML?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">'+certHTML+'</div>':'')
      +'<div class="log-actions" style="margin-top:6px">'
      +'<button class="btn-sm" onclick="editStaffModal(\''+s.id+'\')">✏️ 수정</button>'
      +'<button class="btn-danger" onclick="deleteStaff(\''+s.id+'\')">삭제</button>'
      +'</div></div>';
  });
  var el2=document.getElementById('op-staff-list');if(el2)el2.innerHTML=html;
}

function openStaffModal(){
  document.getElementById('staff-modal-title').textContent='➕ 스태프 추가';
  document.getElementById('staff-edit-id').value='';
  document.getElementById('staff-kr').value='';
  document.getElementById('staff-en').value='';
  document.getElementById('staff-role').value='Program Director';
  document.getElementById('staff-phone').value='';
  document.getElementById('staff-email').value='';
  document.getElementById('staff-certs-list').innerHTML='';
  openOv('ov-staff');
}

function editStaffModal(id){
  var STAFF_OP=JSON.parse(localStorage.getItem('staff_data')||'[]');
  var s=STAFF_OP.find(function(x){return x.id===id;});
  if(!s)return;
  document.getElementById('staff-modal-title').textContent='✏️ 스태프 수정';
  document.getElementById('staff-edit-id').value=id;
  document.getElementById('staff-kr').value=s.nameKr||'';
  document.getElementById('staff-en').value=s.name||'';
  document.getElementById('staff-role').value=s.role||'Program Director';
  document.getElementById('staff-phone').value=s.phone||'';
  document.getElementById('staff-email').value=s.email||'';
  // 자격증 목록 렌더
  var html='';
  (s.certs||[]).forEach(function(c,i){
    html+=renderCertRow(c.name,c.exp,i);
  });
  document.getElementById('staff-certs-list').innerHTML=html;
  openOv('ov-staff');
}

function renderCertRow(name,exp,idx){
  return '<div style="display:grid;grid-template-columns:1fr 130px 32px;gap:6px;margin-bottom:6px" id="cert-row-'+idx+'">'
    +'<input class="m-input" id="cert-name-'+idx+'" value="'+(name||'')+'" placeholder="자격증명 (예: CPR/AED)">'
    +'<input class="m-input" id="cert-exp-'+idx+'" type="date" value="'+(exp||'')+'">'
    +'<button onclick="removeCertRow('+idx+')" style="background:#FFE5E5;color:#FF3B30;border:none;border-radius:8px;cursor:pointer;font-size:14px">✕</button>'
    +'</div>';
}

var _certIdx=0;
function addStaffCert(){
  var list=document.getElementById('staff-certs-list');
  var idx=_certIdx++;
  var div=document.createElement('div');
  div.innerHTML=renderCertRow('','',idx);
  list.appendChild(div.firstChild);
}

function removeCertRow(idx){
  var row=document.getElementById('cert-row-'+idx);
  if(row)row.remove();
}

function collectCerts(){
  var certs=[];
  document.querySelectorAll('#staff-certs-list [id^="cert-row-"]').forEach(function(row){
    var idx=row.id.replace('cert-row-','');
    var nameEl=document.getElementById('cert-name-'+idx);
    var expEl=document.getElementById('cert-exp-'+idx);
    if(nameEl&&nameEl.value.trim()){
      certs.push({name:nameEl.value.trim(),exp:expEl?expEl.value:''});
    }
  });
  return certs;
}

function saveStaffModal(){
  var nameKr=document.getElementById('staff-kr').value.trim();
  var nameEn=document.getElementById('staff-en').value.trim();
  if(!nameKr||!nameEn){alert('이름은 필수입니다');return;}
  var editId=document.getElementById('staff-edit-id').value;
  var STAFF_OP=JSON.parse(localStorage.getItem('staff_data')||'[]');
  var COLORS=[{bg:'#FAECE7',color:'#993C1D'},{bg:'#E6F1FB',color:'#185FA5'},{bg:'#E1F5EE',color:'#0F6E56'},{bg:'#EEEDFE',color:'#534AB7'},{bg:'#FAEEDA',color:'#854F0B'}];
  if(editId){
    var idx=STAFF_OP.findIndex(function(x){return x.id===editId;});
    if(idx>=0){
      STAFF_OP[idx].nameKr=nameKr;STAFF_OP[idx].name=nameEn;
      STAFF_OP[idx].role=document.getElementById('staff-role').value;
      STAFF_OP[idx].phone=document.getElementById('staff-phone').value.trim();
      STAFF_OP[idx].email=document.getElementById('staff-email').value.trim();
      STAFF_OP[idx].certs=collectCerts();
    }
  } else {
    var clr=COLORS[STAFF_OP.length%COLORS.length];
    var newStaff={
      id:'S'+Date.now(),nameKr:nameKr,name:nameEn,
      role:document.getElementById('staff-role').value,
      phone:document.getElementById('staff-phone').value.trim(),
      email:document.getElementById('staff-email').value.trim(),
      certs:collectCerts(),avBg:clr.bg,avColor:clr.color
    };
    STAFF_OP.push(newStaff);
  }
  localStorage.setItem('staff_data',JSON.stringify(STAFF_OP));
  // Sheets 동기화
  var s=editId?STAFF_OP.find(function(x){return x.id===editId;}):STAFF_OP[STAFF_OP.length-1];
  if(s){
    apiCall({action:'upsert',sheet:'스태프',key:'ID',value:s.id,data:{
      'ID':s.id,'한글이름':s.nameKr,'영문이름':s.name,'직책':s.role,
      '전화':s.phone||'','이메일':s.email||'','자격증':JSON.stringify(s.certs||[]),
      'avBg':s.avBg||'#FAECE7','avColor':s.avColor||'#993C1D'
    }}).catch(function(){});
  }
  closeOv('ov-staff');
  renderOpStaff();
  loadTrStaffDropdown();
}

function deleteStaff(id){
  if(!confirm('이 스태프를 삭제할까요?'))return;
  var STAFF_OP=JSON.parse(localStorage.getItem('staff_data')||'[]');
  STAFF_OP=STAFF_OP.filter(function(x){return x.id!==id;});
  localStorage.setItem('staff_data',JSON.stringify(STAFF_OP));
  apiCall({action:'delete',sheet:'스태프',id:id}).catch(function(){});
  renderOpStaff();
}