// 넘버원 어덜트 데이케어 — 빌링
function initBilling(){
  var t=new Date(),day=t.getDay(),mon=new Date(t);mon.setDate(t.getDate()-day+1);
  var sun2=new Date(mon);sun2.setDate(mon.getDate()+13);
  _billFrom=mon.toISOString().slice(0,10);_billTo=sun2.toISOString().slice(0,10);
  var f=document.getElementById('bill-from'),t2=document.getElementById('bill-to');
  if(f)f.value=_billFrom;if(t2)t2.value=_billTo;
}
function generateBilling(){
  _billFrom=document.getElementById('bill-from').value;
  _billTo=document.getElementById('bill-to').value;
  _billIns=document.getElementById('bill-ins').value;
  if(!_billFrom||!_billTo){alert('기간을 선택해주세요.');return;}
  var dates=[],d=new Date(_billFrom+'T00:00:00'),end=new Date(_billTo+'T00:00:00');
  while(d<=end){dates.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  var dkeys=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var codes=BILLING_CONFIG.codes[_billIns]||BILLING_CONFIG.codes['Anthem_MLTC'];
  var tgtM=MEMBERS.filter(function(m){return m.ins===_billIns&&isActive(m);});
  _billData=[];
  tgtM.forEach(function(m){
    dates.forEach(function(dt){
      var dow=dkeys[new Date(dt+'T00:00:00').getDay()];if(!m.days.includes(dow))return;
      var st=((allR[dt]||{})[m.id]||{}).status||'';
      if(st==='absent'||st==='travel'||st==='hospital'||st==='leave')return;
      codes.forEach(function(c){_billData.push({member:m,date:dt,code:c.code,desc:c.desc,charge:c.charge,units:c.units,total:parseFloat((c.charge*c.units).toFixed(2))});});
    });
  });
  var mems=new Set(_billData.map(function(r){return r.member.id;}));
  var sdays=new Set(_billData.filter(function(r){return r.code==='S5105';}).map(function(r){return r.member.id+'_'+r.date;}));
  var tot=parseFloat(_billData.reduce(function(a,r){return a+r.total;},0).toFixed(2));
  var s5=parseFloat(_billData.filter(function(r){return r.code==='S5105';}).reduce(function(a,r){return a+r.total;},0).toFixed(2));
  var a0=parseFloat(_billData.filter(function(r){return r.code==='A0100';}).reduce(function(a,r){return a+r.total;},0).toFixed(2));
  var el=function(id){return document.getElementById(id);};
  if(el('bill-stat-members'))el('bill-stat-members').textContent=mems.size+'명';
  if(el('bill-stat-days'))el('bill-stat-days').textContent=sdays.size+'일';
  if(el('bill-stat-s5105'))el('bill-stat-s5105').textContent='$'+s5.toLocaleString();
  if(el('bill-stat-a0100'))el('bill-stat-a0100').textContent='$'+a0.toLocaleString();
  if(el('bill-stat-total'))el('bill-stat-total').textContent='$'+tot.toLocaleString();
  if(el('bill-summary'))el('bill-summary').textContent=_billFrom+' ~ '+_billTo+' · '+mems.size+'명 · '+sdays.size+'일 · $'+tot.toLocaleString();
  renderBillingTable();
}
function setBillingView(v,btn){
  _billView=v;
  document.querySelectorAll('.bill-view-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');renderBillingTable();
}
function renderBillingTable(){
  var w=document.getElementById('bill-table-wrap');if(!w)return;
  if(!_billData.length){w.innerHTML='<div style="text-align:center;padding:2rem;color:var(--color-text-secondary);font-size:13px">리포트를 먼저 생성해주세요</div>';return;}
  var th='',rows=[];
  var ts='padding:8px 12px;font-size:10px;font-weight:500;color:var(--color-text-secondary);border-bottom:.5px solid var(--color-border-tertiary);';
  if(_billView==='member'){
    var bm={};
    _billData.forEach(function(r){if(!bm[r.member.id])bm[r.member.id]={m:r.member,days:new Set(),s5:0,a0:0};if(r.code==='S5105'){bm[r.member.id].days.add(r.date);bm[r.member.id].s5+=r.total;}else bm[r.member.id].a0+=r.total;});
    th='<tr style="background:var(--color-background-secondary)"><th style="text-align:left;'+ts+'">이름</th><th style="text-align:left;'+ts+'">Medicaid</th><th style="text-align:center;'+ts+'">출석일</th><th style="text-align:right;'+ts+'">S5105</th><th style="text-align:right;'+ts+'">A0100</th><th style="text-align:right;'+ts+'">합계</th></tr>';
    Object.values(bm).forEach(function(r){rows.push('<tr style="border-bottom:.5px solid var(--color-border-tertiary)"><td style="padding:8px 12px;font-size:12px;font-weight:500">'+r.m.kr+'<div style="font-size:10px;color:var(--color-text-secondary)">'+r.m.en+'</div></td><td style="padding:8px 12px;font-size:10px">'+r.m.medicaid+'</td><td style="padding:8px 12px;text-align:center;font-weight:500">'+r.days.size+'일</td><td style="padding:8px 12px;text-align:right;color:#185FA5;font-weight:500">$'+r.s5.toFixed(2)+'</td><td style="padding:8px 12px;text-align:right;color:#0F6E56;font-weight:500">$'+r.a0.toFixed(2)+'</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:#993C1D">$'+(r.s5+r.a0).toFixed(2)+'</td></tr>');});
  }else if(_billView==='date'){
    var bd={};
    _billData.forEach(function(r){if(!bd[r.date])bd[r.date]={cnt:0,s5:0,a0:0};if(r.code==='S5105'){bd[r.date].cnt++;bd[r.date].s5+=r.total;}else bd[r.date].a0+=r.total;});
    th='<tr style="background:var(--color-background-secondary)"><th style="text-align:left;'+ts+'">날짜</th><th style="text-align:center;'+ts+'">출석인원</th><th style="text-align:right;'+ts+'">S5105</th><th style="text-align:right;'+ts+'">A0100</th><th style="text-align:right;'+ts+'">합계</th></tr>';
    var dn=['일','월','화','수','목','금','토'];
    Object.keys(bd).sort().forEach(function(dt){var dow=dn[new Date(dt+'T00:00:00').getDay()];rows.push('<tr style="border-bottom:.5px solid var(--color-border-tertiary)"><td style="padding:8px 12px;font-weight:500">'+dt+' <span style="font-size:10px;color:var(--color-text-secondary)">('+dow+')</span></td><td style="padding:8px 12px;text-align:center">'+bd[dt].cnt+'명</td><td style="padding:8px 12px;text-align:right;color:#185FA5;font-weight:500">$'+bd[dt].s5.toFixed(2)+'</td><td style="padding:8px 12px;text-align:right;color:#0F6E56;font-weight:500">$'+bd[dt].a0.toFixed(2)+'</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:#993C1D">$'+(bd[dt].s5+bd[dt].a0).toFixed(2)+'</td></tr>');});
  }else{
    th='<tr style="background:var(--color-background-secondary)"><th style="text-align:left;'+ts+';width:20%">환자명</th><th style="text-align:left;'+ts+';width:15%">Medicaid</th><th style="text-align:left;'+ts+';width:13%">서비스일</th><th style="text-align:center;'+ts+';width:10%">코드</th><th style="text-align:center;'+ts+';width:7%">수량</th><th style="text-align:right;'+ts+';width:8%">단가</th><th style="text-align:right;'+ts+';width:10%">합계</th></tr>';
    _billData.slice().sort(function(a,b){return a.member.kr.localeCompare(b.member.kr)||a.date.localeCompare(b.date);}).forEach(function(r){var c=r.code==='S5105'?'#185FA5':'#0F6E56';var bg=r.code==='S5105'?'#E6F1FB':'#E1F5EE';rows.push('<tr style="border-bottom:.5px solid var(--color-border-tertiary)"><td style="padding:7px 12px;font-size:11px">'+r.member.en+'</td><td style="padding:7px 12px;font-size:10px">'+r.member.medicaid+'</td><td style="padding:7px 12px;font-size:11px">'+r.date+'</td><td style="padding:7px 12px;text-align:center"><span style="font-size:9px;padding:1px 7px;border-radius:20px;font-weight:700;background:'+bg+';color:'+c+'">'+r.code+'</span></td><td style="padding:7px 12px;text-align:center">'+r.units+'</td><td style="padding:7px 12px;text-align:right">$'+r.charge+'</td><td style="padding:7px 12px;text-align:right;font-weight:500">$'+r.total.toFixed(2)+'</td></tr>');});
  }
  w.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed"><thead>'+th+'</thead><tbody>'+rows.join('')+'</tbody></table>';
}
function exportBillingCSV(){
  if(!_billData.length){alert('먼저 리포트를 생성해주세요.');return;}
  var p=BILLING_CONFIG.payers[_billIns]||{};
  var hdrs=['NPI','Provider Name','Provider Address','FED TAX NO','PCN','Patient Last Name','Patient First Name','Date of Birth','Medicaid ID','Insurance ID (MLTC)','Payer Name','Payer ID','Revenue Code','Date of Service From','Date of Service To','HCPCS Code','Description','Units','Unit Charge','Total Charge','Taxonomy'];
  var rows=_billData.map(function(r){var np=r.member.en.split(',');var last=(np[0]||'').trim();var first=(np[1]||'').trim();return[BILLING_CONFIG.NPI,'"'+BILLING_CONFIG.providerName+'"','"'+BILLING_CONFIG.providerAddr+'"',BILLING_CONFIG.ein,BILLING_CONFIG.pcn,last,first,r.member.dob||'',r.member.medicaid,r.member.mltc,p.name||'',p.payerId||'','3104',r.date,r.date,r.code,'"'+r.desc+'"',r.units,r.charge,r.total.toFixed(2),BILLING_CONFIG.taxonomy].join(',');});
  var csv='\uFEFF'+[hdrs.join(',')].concat(rows).join('\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var a=document.createElement('a');
  a.href=url;a.download='billing_'+_billIns+'_'+_billFrom+'_'+_billTo+'.csv';a.click();URL.revokeObjectURL(url);
}

