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

function _attSheetStyles() {
  return '<style>'
    + '@page{size:letter;margin:0}'
    + 'body,*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;box-sizing:border-box;margin:0;padding:0;}'
    // 페이지 레이아웃 — 바인딩용 왼쪽 여백 크게
    + '.att-pg{'
    +   'font-family:Arial,sans-serif;'
    +   'width:8.5in;height:11in;'
    +   'padding:0.25in 0.4in 0.2in 0.85in;' // top right bottom left(바인딩)
    +   'page-break-after:always;'
    +   'page-break-inside:avoid;'
    +   'display:flex;flex-direction:column;'
    + '}'
    // 헤더 — 이름/보험사 크게
    + '.pg-hdr{'
    +   'display:flex;justify-content:space-between;align-items:flex-start;'
    +   'border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:8px;flex-shrink:0;'
    + '}'
    + '.ctr-name{font-size:22px;font-weight:900;letter-spacing:0.5px;}'
    + '.ctr-addr{font-size:12px;margin-top:3px;}'
    + '.ctr-month{font-size:14px;font-weight:700;margin-top:5px;}'
    + '.hdr-r{text-align:right;}'
    + '.mbr-name{font-size:22px;font-weight:900;}'   // 이름 크게
    + '.mbr-ins{font-size:15px;font-weight:700;margin-top:4px;}'
    + '.mbr-id{font-size:14px;margin-top:3px;}'
    // 테이블
    + '.att-tbl{width:100%;border-collapse:collapse;flex:1;table-layout:fixed;}'
    + '.att-tbl th,.att-tbl td{'
    +   'border:1.5px solid #444;'
    +   'padding:4px 5px;'
    +   'font-size:13px;'
    +   'overflow:hidden;'
    + '}'
    + '.att-tbl th{text-align:center;background:#e0e0e0 !important;font-weight:700;font-size:13px;padding:6px 5px;}'
    + '.c-num{width:36px;text-align:center;font-weight:700;}'
    + '.c-day{width:46px;text-align:center;}'
    + '.c-act{width:190px;text-align:center;font-size:11px;white-space:nowrap;}'  // SDC 컬럼 좁게
    + '.c-time{width:80px;text-align:center;}'
    + '.c-sign{text-align:center;}'                             // SIGN — 남은 공간 전부
    // 일요일 회색
    + '.sun-row,.sun-row td{background:#C8C8C8 !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}'
    // 페이지 번호 푸터
    + '.pg-footer{text-align:center;font-size:11px;color:#555;padding-top:4px;flex-shrink:0;border-top:1px solid #ccc;margin-top:4px;}'
    // 목차 페이지
    + '.toc-pg{'
    +   'font-family:Arial,sans-serif;'
    +   'width:8.5in;height:11in;'
    +   'padding:0.4in 0.4in 0.3in 0.85in;'
    +   'page-break-after:always;'
    +   'page-break-inside:avoid;'
    + '}'
    + '.toc-title{font-size:22px;font-weight:900;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:14px;}'
    + '.toc-ins{font-size:16px;font-weight:700;margin:14px 0 6px;color:#333;border-bottom:1.5px solid #999;padding-bottom:4px;}'
    + '.toc-row{display:flex;justify-content:space-between;align-items:center;'
    +   'font-size:14px;padding:5px 0;border-bottom:0.5px solid #ddd;}'
    + '.toc-name{font-weight:600;}'
    + '.toc-pages{color:#555;font-size:13px;}'
    + '.toc-footer{text-align:center;font-size:11px;color:#555;margin-top:auto;padding-top:8px;border-top:1px solid #ccc;}'
    + '</style>';
}

function _attSheetTOC(tocMembers, ins, year, month, startPage, idOrderMembers) {
  var MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                     'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  var insLabel = _attSheetInsLabel(ins);
  // ID순 배열에서 각 멤버의 페이지 번호 계산
  var pageMap = {};
  for (var pi = 0; pi < idOrderMembers.length; pi++) {
    pageMap[idOrderMembers[pi].id] = {
      att: startPage + 1 + pi * 2,
      trp: startPage + 2 + pi * 2
    };
  }
  var rows = '';
  for (var i = 0; i < tocMembers.length; i++) {
    var m = tocMembers[i];
    var pg = pageMap[m.id] || {att:'?', trp:'?'};
    rows += '<div class="toc-row">'
      + '<span class="toc-name">' + (m.kr||'') + ' &nbsp;<span style="font-weight:400;font-size:13px;color:#555">' + (m.en||'') + '</span></span>'
      + '<span class="toc-pages">출석부 p.' + pg.att + ' &nbsp;·&nbsp; 교통 p.' + pg.trp + '</span>'
      + '</div>';
  }
  return '<div class="toc-pg">'
    + '<div class="toc-title">NUMBER ONE ADULT DAYCARE<br>'
    + '<span style="font-size:16px;font-weight:700;">'
    + MONTH_NAMES[month-1] + ' ' + year + ' — ' + insLabel + ' 출석부 목차</span></div>'
    + '<div class="toc-ins">📋 ' + insLabel + ' (' + members.length + '명)</div>'
    + rows
    + '<div style="flex:1"></div>'
    + '<div class="toc-footer">p. 1</div>'
    + '</div>';
}

function _attSheetMemberPage(m, year, month, daysInMonth, type, pageNum) {
  var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                     'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  var insLabel = _attSheetInsLabel(m.ins);
  var daysStr  = (m.days||[]).map(function(d){ return _attSheetDayAbbr(d); }).join(',');
  var enName   = (m.en||m.kr||'').trim();
  var actText  = (type === 'TRANSPORTATION') ? 'SDC TRANSPORTATION O' : 'SDC ATTENDANCE O';

  var rows = '';
  for (var day = 1; day <= daysInMonth; day++) {
    var date   = new Date(year, month - 1, day);
    var dow    = date.getDay();
    var isSun  = (dow === 0);
    var trClass = isSun ? ' class="sun-row"' : '';
    rows += '<tr' + trClass + '>'
      + '<td class="c-num">' + day + '</td>'
      + '<td class="c-day">' + DAY_NAMES[dow] + '</td>'
      + '<td class="c-act">' + actText + '</td>'
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
    +     '<div class="ctr-month">' + MONTH_NAMES[month-1] + ' &nbsp;YEAR ' + year + ' &nbsp;&nbsp; ' + type + '</div>'
    +   '</div>'
    +   '<div class="hdr-r">'
    +     '<div class="mbr-name">' + (m.kr||'') + '</div>'
    +     '<div class="mbr-ins">' + insLabel + ' &nbsp;' + enName + '</div>'
    +     '<div class="mbr-id">' + m.medicaid + ' &nbsp;(' + daysStr + ')</div>'
    +   '</div>'
    + '</div>'
    + '<table class="att-tbl">'
    +   '<colgroup>'
    +     '<col class="c-num"><col class="c-day"><col class="c-act">'
    +     '<col class="c-time"><col class="c-time"><col class="c-sign">'
    +   '</colgroup>'
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
    + '<div class="pg-footer">p. ' + pageNum + '</div>'
    + '</div>';
}


async function generateAttSheets(insFilter) {
  var monthVal = (document.getElementById('att-sheet-month')||{}).value;
  if (!monthVal) { alert('월을 선택해주세요'); return; }

  var parts = monthVal.split('-');
  var year  = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var daysInMonth = new Date(year, month, 0).getDate();
  var statusEl = document.getElementById('att-sheet-status');

  if (statusEl) statusEl.textContent = '⏳ 멤버 데이터 로드 중...';

  // 멤버 데이터 로드
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
          ins:      String(r['보험사']||'Anthem_MLTC'),
          days:     r['출석요일'] ? String(r['출석요일']).split(',').map(function(d){return d.trim();}).filter(Boolean) : [],
        };
      }).filter(function(m){ return m.id && m.kr; });
    }
  } catch(e) {
    alert('멤버 데이터 로드 실패: ' + e.message); return;
  }

  if (!allMembers.length) { alert('Active 멤버 데이터 없음'); return; }

  var insGroups = insFilter === 'ALL' ? ['Anthem_MLTC','CLP','SWH'] : [insFilter];
  var MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                     'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

  for (var gi = 0; gi < insGroups.length; gi++) {
    var ins = insGroups[gi];
    var members = allMembers.filter(function(m){ return m.ins === ins; });
    // 출석부 순서: 멤버 ID 순
    members.sort(function(a,b){ return String(a.id).localeCompare(String(b.id), undefined, {numeric:true}); });
    // 목차용: 가나다 순 (별도 배열)
    var tocMembers = members.slice().sort(function(a,b){ return (a.kr||'').localeCompare(b.kr||'', 'ko'); });
    if (!members.length) continue;

    if (statusEl) statusEl.textContent = '⏳ ' + _attSheetInsLabel(ins) + ' (' + members.length + '명) 출석부 열기 중...';

    var insLabel = _attSheetInsLabel(ins);
    // 페이지 번호: p.1 = 목차, p.2~ = 멤버 페이지
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
      + '<title>' + insLabel + ' ' + MONTH_NAMES[month-1] + ' ' + year + ' 출석부</title>'
      + _attSheetStyles()
      + '</head><body>';

    // 목차 (p.1)
    html += _attSheetTOC(tocMembers, ins, year, month, 1, members);

    // 멤버 페이지 (p.2~)
    for (var mi = 0; mi < members.length; mi++) {
      var attPage = 2 + mi * 2;
      var trpPage = 3 + mi * 2;
      html += _attSheetMemberPage(members[mi], year, month, daysInMonth, 'ATTENDANCE', attPage);
      html += _attSheetMemberPage(members[mi], year, month, daysInMonth, 'TRANSPORTATION', trpPage);
    }

    html += '<script>window.onload=function(){window.print();}<\/script></body></html>';

    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('팝업 차단을 해제해주세요'); return; }
    w.document.write(html);
    w.document.close();

    // 보험사 간 딜레이
    if (gi < insGroups.length - 1) {
      await new Promise(function(r){ setTimeout(r, 1500); });
    }
  }

  if (statusEl) statusEl.textContent = '✅ 출석부 창 열림 — 인쇄 창에서 PDF로 저장하세요!';
}
