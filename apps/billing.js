// 넘버원 어덜트 데이케어 — 빌링
function _isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function initBilling(){
  var t=new Date(),day=t.getDay(),mon=new Date(t);mon.setDate(t.getDate()-day+1);
  var sun2=new Date(mon);sun2.setDate(mon.getDate()+13);
  _billFrom=_isoLocal(mon);_billTo=_isoLocal(sun2);
  var f=document.getElementById('bill-from'),t2=document.getElementById('bill-to');
  if(f)f.value=_billFrom;if(t2)t2.value=_billTo;
}
async function generateBilling(){
  _billFrom=document.getElementById('bill-from').value;
  _billTo=document.getElementById('bill-to').value;
  _billIns=document.getElementById('bill-ins').value;
  if(!_billFrom||!_billTo){alert('기간을 선택해주세요.');return;}

  // ★ Sheets에서 해당 기간 출결을 직접 로드 (실제 출석만 청구)
  var attData={};
  try{
    attData=await SheetsAPI.loadAttendanceRange(_billFrom,_billTo);
  }catch(e){alert('출결 데이터 로드 실패: '+e.message);return;}

  var codes=BILLING_CONFIG.codes[_billIns]||BILLING_CONFIG.codes['Anthem_MLTC'];
  var tgtM=MEMBERS.filter(function(m){return m.ins===_billIns&&isActive(m);});
  _billData=[];
  tgtM.forEach(function(m){
    Object.keys(attData).forEach(function(dt){
      if(dt<_billFrom||dt>_billTo)return;
      var st=((attData[dt]||{})[m.id]||{}).status||'';
      // ★ 실제 출석(in) 또는 지각(late)만 청구
      if(st!=='in'&&st!=='late')return;
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


// ══════════════════════════════════════════════════════════════
// 월별 출석부 생성
// ══════════════════════════════════════════════════════════════

function _attSheetDayAbbr(dayKey) {
  return {Mon:'M',Tue:'T',Wed:'W',Thu:'TH',Fri:'F',Sat:'S',Sun:'SU'}[dayKey] || dayKey;
}

function _attSheetInsLabel(ins) {
  return {Anthem_MLTC:'ANTHEM', Anthem_MAP:'ANTHEM', CLP:'CENTERLIGHT', SWH:'SWH'}[ins] || ins;
}

function _attSheetMemberPage(m, year, month, daysInMonth, type) {
  var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                     'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  var insLabel = _attSheetInsLabel(m.ins);
  var daysStr  = (m.days||[]).map(function(d){ return _attSheetDayAbbr(d); }).join(',');
  var enName   = (m.en||m.kr||'').trim();

  var rows = '';
  for (var day = 1; day <= daysInMonth; day++) {
    var date   = new Date(year, month - 1, day);
    var dow    = date.getDay(); // 0=일, 6=토
    var isSun  = (dow === 0);
    var bgStyle = isSun ? 'background:#D8D8D8;' : '';
    rows += '<tr style="' + bgStyle + '">'
      + '<td class="c-num">' + day + '</td>'
      + '<td class="c-day">' + DAY_NAMES[dow] + '</td>'
      + '<td class="c-act">SDC ATTENDANCE O</td>'
      + '<td class="c-time"></td>'
      + '<td class="c-time"></td>'
      + '<td class="c-sign"></td>'
      + '</tr>';
  }

  return '<div class="att-pg">'
    + '<div class="pg-hdr">'
    +   '<div class="hdr-l">'
    +     '<div class="ctr-name">NUMBER ONE ADULT DAYCARE</div>'
    +     '<div class="ctr-addr">161-22 NORTHERN BLVD.#1FL FLUSHING. NY.11358</div>'
    +     '<div class="ctr-month">' + MONTH_NAMES[month-1] + ' &nbsp;YEAR ' + year + ' &nbsp;&nbsp;&nbsp; ' + type + '</div>'
    +   '</div>'
    +   '<div class="hdr-r">'
    +     '<div class="mbr-name">' + enName + '</div>'
    +     '<div class="mbr-ins">' + insLabel + ',' + (m.kr||'') + '(' + m.id + ')</div>'
    +     '<div class="mbr-id">' + m.medicaid + ' (' + daysStr + ')</div>'
    +   '</div>'
    + '</div>'
    + '<table class="att-tbl">'
    +   '<thead><tr>'
    +     '<th class="c-num"></th>'
    +     '<th class="c-day"></th>'
    +     '<th class="c-act"></th>'
    +     '<th class="c-time">TIME IN</th>'
    +     '<th class="c-time">TIME OUT</th>'
    +     '<th class="c-sign">SIGN</th>'
    +   '</tr></thead>'
    +   '<tbody>' + rows + '</tbody>'
    + '</table>'
    + '</div>';
}

function _attSheetStyles() {
  return '<style>'
    + '@page{size:letter;margin:0}'
    + '*{box-sizing:border-box;}'
    + '.att-pg{'
    +   'font-family:Arial,sans-serif;'
    +   'width:8.5in;min-height:11in;'
    +   'padding:0.35in 0.4in;'
    +   'page-break-after:always;'
    +   'page-break-inside:avoid;'
    + '}'
    + '.pg-hdr{display:flex;justify-content:space-between;align-items:flex-start;'
    +   'border-bottom:2.5px solid #000;padding-bottom:6px;margin-bottom:8px;}'
    + '.ctr-name{font-size:24px;font-weight:900;letter-spacing:0.5px;}'
    + '.ctr-addr{font-size:11px;margin-top:2px;}'
    + '.ctr-month{font-size:13px;font-weight:700;margin-top:5px;}'
    + '.hdr-r{text-align:right;}'
    + '.mbr-name{font-size:15px;font-weight:700;}'
    + '.mbr-ins{font-size:12px;margin-top:2px;}'
    + '.mbr-id{font-size:12px;margin-top:1px;}'
    + '.att-tbl{width:100%;border-collapse:collapse;}'
    + '.att-tbl th,.att-tbl td{border:1px solid #555;padding:3px 5px;font-size:11.5px;}'
    + '.att-tbl th{text-align:center;background:#f0f0f0;font-weight:700;font-size:12px;}'
    + '.c-num{width:32px;text-align:center;}'
    + '.c-day{width:44px;text-align:center;}'
    + '.c-act{text-align:center;}'
    + '.c-time{width:90px;text-align:center;}'
    + '.c-sign{width:110px;}'
    + '</style>';
}

async function generateAttSheets(insFilter) {
  var monthVal = (document.getElementById('att-sheet-month')||{}).value;
  if (!monthVal) { alert('월을 선택해주세요'); return; }

  var parts = monthVal.split('-');
  var year  = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();

  var statusEl = document.getElementById('att-sheet-status');

  // 로드된 멤버 데이터 가져오기
  var allMembers = [];
  try {
    var res = await apiGet({action:'read', sheet:'멤버'});
    if (res && res.ok && res.data) {
      allMembers = res.data.filter(function(r){
        return String(r['상태']||'active') === 'active' || !r['상태'];
      }).map(function(r){
        return {
          id:       String(r['ID']||''),
          kr:       String(r['한글이름']||''),
          en:       String(r['영문이름']||'').toUpperCase(),
          medicaid: String(r['Medicaid']||'').toUpperCase(),
          mltc:     String(r['MLTC']||''),
          ins:      String(r['보험사']||'Anthem_MLTC'),
          days:     r['출석요일'] ? String(r['출석요일']).split(',').map(function(d){return d.trim();}).filter(Boolean) : [],
        };
      }).filter(function(m){ return m.id && m.kr; });
    }
  } catch(e) {
    alert('멤버 데이터 로드 실패: ' + e.message); return;
  }

  if (!allMembers.length) { alert('Active 멤버 데이터 없음'); return; }

  var insGroups = insFilter === 'ALL'
    ? ['Anthem_MLTC','CLP','SWH']
    : [insFilter];

  var MONTH_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  for (var gi = 0; gi < insGroups.length; gi++) {
    var ins = insGroups[gi];
    var members = allMembers.filter(function(m){ return m.ins === ins; });
    if (!members.length) {
      if (statusEl) statusEl.textContent = _attSheetInsLabel(ins) + ' — 멤버 없음, 건너뜀';
      continue;
    }

    if (statusEl) statusEl.textContent = '⏳ ' + _attSheetInsLabel(ins) + ' 출석부 생성 중... (' + members.length + '명)';

    var html = _attSheetStyles();
    for (var mi = 0; mi < members.length; mi++) {
      html += _attSheetMemberPage(members[mi], year, month, daysInMonth, 'ATTENDANCE');
      html += _attSheetMemberPage(members[mi], year, month, daysInMonth, 'TRANSPORTATION');
    }

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;';
    document.body.appendChild(wrap);

    var fname = 'AttSheet_' + _attSheetInsLabel(ins) + '_' + year + '_' + String(month).padStart(2,'0') + '.pdf';
    try {
      await html2pdf().set({
        margin:     0,
        filename:   fname,
        image:      { type:'jpeg', quality:0.97 },
        html2canvas:{ scale:2, useCORS:true, logging:false },
        jsPDF:      { unit:'in', format:'letter', orientation:'portrait' },
        pagebreak:  { mode:['avoid-all'], before:'.att-pg' }
      }).from(wrap).save();
    } catch(e) {
      console.error('PDF 생성 오류:', e);
    }
    document.body.removeChild(wrap);

    // 파일 간 딜레이
    if (gi < insGroups.length - 1) {
      await new Promise(function(r){ setTimeout(r, 800); });
    }
  }

  if (statusEl) statusEl.textContent = '✅ 출석부 생성 완료!';
}
