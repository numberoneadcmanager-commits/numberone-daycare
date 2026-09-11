// Operational checks use Sheets records, not inferred attendance or browser storage.
function wfEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function wfISO(v){return String(v||'').slice(0,10);}
function wfAuthCandidates(rows,mid,medicaid,day,type){return rows.filter(function(a){return [String(mid),String(medicaid||'')].includes(String(a['멤버ID']))&&a['서비스유형']===type&&a['시작일']&&a['종료일']&&wfISO(a['시작일'])<=day&&wfISO(a['종료일'])>=day&&!/hold|cancel/i.test(a['상태']||'');}).sort(function(a,b){return wfISO(b['시작일']).localeCompare(wfISO(a['시작일']))||String(a.ID).localeCompare(String(b.ID));});}
function wfUsage(rows,a,member){
  var days=new Set(),used=0,unassigned=new Set();
  rows.forEach(function(r){var day=wfISO(r['날짜']);if(![String(member.id),String(member.medicaid||'')].includes(String(r['멤버ID']))||day<wfISO(a.startDate)||day>wfISO(a.endDate))return;
    var transport=a.serviceType==='Transportation',assigned=r[transport?'교통AUTH':'SDCAUTH'];
    if(!transport&&!['in','late'].includes(r['상태']))return;
    if(transport&&(r['교통횟수']===0||r['교통횟수']==='0'))return;
    if(transport&&(r['교통횟수']===''||r['교통횟수']==null)&&!['in','late'].includes(r['상태']))return;
    if(!assigned){unassigned.add(day);return;}if(String(assigned)!==String(a.id)||days.has(day))return;
    days.add(day);if(transport){if(r['교통횟수']===''||r['교통횟수']==null){unassigned.add(day);return;}used+=Number(r['교통횟수']);}else used++;
  });return {used:used,unassigned:unassigned.size};
}
async function wfRecordServices(day,mid){
  var m=MEMBERS.find(function(x){return String(x.id)===String(mid);});if(!m)return;
  try{
    var auth=(await SheetsAPI.read('auth')).data,rec=getRec(day)[mid]||{};
    var dialog=document.createElement('dialog');dialog.style.cssText='max-width:520px;width:90%;border:0;border-radius:12px;padding:20px';
    dialog.innerHTML='<h3>서비스 확인 · '+wfEsc(m.kr)+' · '+wfEsc(day)+'</h3><p>AUTH는 해당 출석일 기준입니다. 선택한 승인별로 집계합니다.</p><label>SDC AUTH<select id="wf-sdc" style="display:block;width:100%;margin-bottom:12px"></select></label><label>Transportation AUTH<select id="wf-trip" style="display:block;width:100%;margin-bottom:12px"></select></label><label>실제 교통 이용 횟수<input id="wf-trips" type="number" min="0" step="1" style="width:100%" placeholder="미확인"></label><p><button data-count="0">미이용 0</button> <button data-count="1">편도 1</button> <button data-count="2">왕복 2</button></p><div id="wf-warnings" role="status"></div><button id="wf-service-save">확인 후 저장</button> <button id="wf-service-cancel">취소</button>';
    ['SDC','Transportation'].forEach(function(type){var select=dialog.querySelector(type==='SDC'?'#wf-sdc':'#wf-trip');select.add(new Option('미연결 / 확인 필요',''));wfAuthCandidates(auth,mid,m.medicaid,day,type).forEach(function(a){select.add(new Option((a['Auth번호']||a.ID)+' · '+wfISO(a['시작일'])+' ~ '+wfISO(a['종료일']),a.ID));});select.value=(type==='SDC'?rec.sdcAuth:rec.transportAuth)|| (select.options[1]||{}).value||'';});
    dialog.querySelector('#wf-trips').value=rec.transportCount==null?'':rec.transportCount;
    dialog.querySelectorAll('[data-count]').forEach(function(b){b.onclick=function(){dialog.querySelector('#wf-trips').value=b.dataset.count;};});
    function close(){dialog.close();dialog.remove();}dialog.querySelector('#wf-service-cancel').onclick=close;dialog.addEventListener('cancel',function(){dialog.remove();});
    dialog.querySelector('#wf-service-save').onclick=async function(){
      var b=this,count=dialog.querySelector('#wf-trips').value,sdc=dialog.querySelector('#wf-sdc').value,trip=dialog.querySelector('#wf-trip').value;
      if(count!==''&&(!Number.isSafeInteger(Number(count))||Number(count)<0)){alert('0 이상의 정수를 입력해주세요.');return;}
      if(Number(count)>2&&!confirm('교통 이용이 2회를 초과합니다. 실제 횟수가 맞나요?'))return;
      b.disabled=true;
      try{
        var warnings=[],weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(day+'T12:00:00Z').getUTCDay()];
        if(!sdc&&['in','late'].includes(rec.status))warnings.push('SDC AUTH 미연결');
        if(Number(count)>0&&!trip)warnings.push('Transportation AUTH 미연결');
        var rangeStart=auth.filter(function(a){return a.ID===sdc||a.ID===trip;}).map(function(a){return wfISO(a['시작일']);}).sort()[0]||day;
        var records=(await SheetsAPI.readByRange('출결',rangeStart,todayISO>day?todayISO:day)).data;
        [sdc,trip].filter(Boolean).forEach(function(id){var a=auth.find(function(x){return x.ID===id;});var specified=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].some(function(d){return Number(a['요일'+d])>0;});if(specified&&!Number(a['요일'+weekday]))warnings.push((a['서비스유형']||'')+' 승인 요일 외 이용');
          var candidate=Object.assign({},rec,{sdcAuth:sdc,transportAuth:trip,transportCount:count});var raw={'날짜':day,'멤버ID':mid,'상태':rec.status,'SDCAUTH':sdc,'교통AUTH':trip,'교통횟수':count};
          var filtered=records.filter(function(r){return !(wfISO(r['날짜'])===day&&[String(mid),String(m.medicaid||'')].includes(String(r['멤버ID'])));}).concat([raw]);
          var result=wfUsage(filtered,{id:id,startDate:a['시작일'],endDate:a['종료일'],serviceType:a['서비스유형']},m);
          if(a['총수량']!==''&&a['총수량']!=null&&result.used>Number(a['총수량']))warnings.push(a['서비스유형']+' 승인 총수량 초과');
          if(a['서비스유형']==='SDC'&&Number(a['주당빈도'])>0){var monday=new Date(day+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);var weekStart=monday.toISOString().slice(0,10);monday.setUTCDate(monday.getUTCDate()+6);var weekEnd=monday.toISOString().slice(0,10);var week=wfUsage(filtered.filter(function(r){return wfISO(r['날짜'])>=weekStart&&wfISO(r['날짜'])<=weekEnd;}),{id:id,startDate:a['시작일'],endDate:a['종료일'],serviceType:'SDC'},m);if(week.used>Number(a['주당빈도']))warnings.push('SDC 주당 승인 횟수 초과');}
        });
        if(warnings.length&&!confirm(warnings.join('\n')+'\n실제 이용 기록은 저장할 수 있습니다. 계속할까요?'))return;
        if(await saveAttToSheets(day,mid,Object.assign({},getRec(day)[mid]||{},{sdcAuth:sdc,transportAuth:trip,transportCount:count,authWarning:warnings.join('; ')}))){close();renderAtt();}
      }catch(e){dialog.querySelector('#wf-warnings').textContent=e.message;}finally{b.disabled=false;}
    };
    document.body.appendChild(dialog);dialog.showModal();
  }catch(e){alert('서비스 확인 실패: '+e.message);}
}
var _wfDashTime=0,_wfDashLoading=false;
async function refreshWorkflowDashboard(force){
  var el=document.getElementById('workflow-tasks');if(!el||_wfDashLoading||(!force&&Date.now()-_wfDashTime<60000))return;
  _wfDashLoading=true;el.textContent='오늘 할 일 조회 중…';
  try{
    var data=await Promise.all(['PCSP','auth','출결'].map(function(s){return s==='출결'?SheetsAPI.readByDate(s,todayISO):SheetsAPI.read(s);}));
    var plans=data[0].data,auth=data[1].data,att=data[2].data;
    var pending=plans.filter(function(p){return p['상태']!=='완료';}),missing=0,renew=0,noAuth=0,soon=0;
    MEMBERS.filter(isActive).forEach(function(m){var rows=plans.filter(function(p){return [String(m.id),String(m.medicaid||'')].includes(String(p['멤버ID']));});if(!rows.length)missing++;var completed=rows.filter(function(p){return p['상태']==='완료';}).sort(function(a,b){return wfISO(b['작성일']).localeCompare(wfISO(a['작성일']));})[0];if(completed&&wfISO(completed['갱신예정일'])&&wfISO(completed['갱신예정일'])<=todayISO)renew++;var active=wfAuthCandidates(auth,m.id,m.medicaid,todayISO,'SDC');if(!active.length)noAuth++;else if((new Date(wfISO(active[0]['종료일']))-new Date(todayISO))/86400000<=30)soon++;});
    var checks=att.filter(function(r){return ['in','late'].includes(r['상태'])&&(!r['SDCAUTH']||r['교통횟수']===''||r['교통횟수']==null||r['AUTH확인']);}).length;
    el.innerHTML='<a href="operations.html?workflow=pcsp">PCSP 전체 갱신 진행표</a><p>미작성 '+missing+'명 · 진행 중 '+pending.length+'건 · 갱신일 도래 '+renew+'명</p><p>SDC AUTH 확인 필요 '+noAuth+'명 · 30일 내 만료 '+soon+'명</p><p>오늘 출석의 AUTH / 교통 확인 '+checks+'건</p><button class="btn-sm" onclick="dashGoAttendance()">출석·서비스 확인</button> <button class="btn-sm" onclick="goTab(\'authorization\',null)">AUTH 열기</button><p style="font-size:11px">서버 조회 '+wfEsc(new Date().toLocaleTimeString())+' · 확인 필요는 서비스 미제공 판정이 아닙니다.</p>';
    _wfDashTime=Date.now();
  }catch(e){el.textContent='조회 실패: '+e.message;}finally{_wfDashLoading=false;}
}
