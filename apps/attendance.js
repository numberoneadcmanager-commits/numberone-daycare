// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 출결 관리 v2.0
// Sheets가 단일 진실 공급원 (Single Source of Truth)
// apps/attendance.js
// ══════════════════════════════════════════════════════════════

// ── 로딩 상태 ─────────────────────────────────────────────────
var _attLoading = false,_attLoadSerial=0,_attReady={},_attBulkBusy=false,_attBulkResult=null,_attLastErrors={},_attRowWrites=new Set();
var _attCache   = {}; // { 'YYYY-MM-DD': { mid: {...} } } — 메모리 캐시만

// ── 출결 대상 목록 ────────────────────────────────────────────
function getList(iso) {
  const q   = (document.getElementById('asearch') || {}).value || '';
  const dow = dowKey(iso);
  return MEMBERS.filter(m => m.days.includes(dow) && isAttendanceTarget(m, iso) && (!q || m.kr.includes(q)));
}

// ── 캐시 접근 ─────────────────────────────────────────────────
function getRec(iso)            { return _attCache[iso] || {}; }
function setRec(iso, mid, data) {
  if (!_attCache[iso]) _attCache[iso] = {};
  _attCache[iso][mid] = data;
  // allR도 동기화 (대시보드 등 다른 곳에서 allR 사용)
  if (!allR[iso]) allR[iso] = {};
  allR[iso][mid] = data;
}

// ── 날짜 네비게이션 ───────────────────────────────────────────
function updateDN() {
  const iso = toISO(curDate);
  document.getElementById('att-date-main').textContent = fmtD(iso);
  const sub = document.getElementById('att-date-sub');
  sub.textContent = iso === todayISO ? '오늘' : iso < todayISO ? '📝 과거 기록 수정 가능' : '';
  document.getElementById('btn-nd').disabled = iso >= todayISO;
}

function moveDate(d) {
  if(_attBulkBusy||_attWrites||Object.keys(_attMemoDrafts).length){alert('출결 저장이 끝난 후 날짜를 이동해주세요.');return;}
  const nd = new Date(curDate);
  nd.setDate(nd.getDate() + d);
  if (toISO(nd) > todayISO) return;
  curDate = nd;
  updateDN();
  loadAttFromSheets(toISO(curDate));
}

function goToday() {
  if(_attBulkBusy||_attWrites||Object.keys(_attMemoDrafts).length){alert('출결 저장이 끝난 후 날짜를 이동해주세요.');return;}
  curDate = new Date();
  updateDN();
  loadAttFromSheets(toISO(curDate));
}

// ── Sheets에서 출결 로드 ──────────────────────────────────────
async function loadAttFromSheets(iso,options) {
  options=options||{};
  if(_attWrites||Object.keys(_attMemoDrafts).length||(_attBulkBusy&&!options.bulk)||WriteGuard.editing())return false;
  var serial=++_attLoadSerial;_attLoading=true;_attReady[iso]=false;
  if(!options.quiet)renderAtt();
  try {
    const res=await SheetsAPI.readByDate('출결',iso);
    if(serial!==_attLoadSerial)return false;
    if(!res||!res.ok||!Array.isArray(res.data))throw new Error('출결 조회 응답을 확인하지 못했습니다.');
    var next={};
    res.data.forEach(function(r){var mid=String(r['멤버ID']||'');if(!mid)return;
      next[mid]={sdcAuth:r['SDCAUTH']||'',transportAuth:r['교통AUTH']||'',transportCount:r['교통횟수']==null?'':r['교통횟수'],authWarning:r['AUTH확인']||'',status:String(r['상태']||''),signIn:String(r['Sign-in']||''),signOut:String(r['Sign-out']||''),memo:String(r['메모']||''),start:String(r['시작일']||''),end:String(r['종료일']||''),writer:String(r['작성자']||'')};
    });
    WriteGuard.adopt(res,function(){_attCache[iso]=next;allR[iso]=Object.assign({},next);_attReady[iso]=true;});
    return true;
  }catch(e){console.warn('출결 로드 실패:',e);return false;}
  finally{if(serial===_attLoadSerial){_attLoading=false;renderAtt();updateDashNow();}}
}

// ── 출결 렌더링 ───────────────────────────────────────────────
function renderAtt() {
  updateDN();
  const iso  = toISO(curDate), list = getList(iso), recs = getRec(iso), past = iso < todayISO;
  let inC = 0, trC = 0, pC = 0;

  const html = list.map(m => {
    const r = recs[m.id] || {}, s = r.status || '';
    if (s === 'in' || s === 'late') inC++;
    if (s === 'travel') trC++;
    if (!s) pC++;
    let ds = '';
    if (r.start && ['travel', 'hospital', 'leave'].includes(s))
      ds = ' (' + r.start.slice(5) + (r.end ? ' ~ ' + r.end.slice(5) : ' ~') + ')';
    const etag   = r.editedAt ? '<span class="etag">수정됨</span>' : '';
    const sigStr = (r.signIn || r.signOut)
      ? `<div style="font-size:10px;color:#34C759;margin-top:2px">🕐 ${r.signIn || '—'} ~ 🕔 ${r.signOut || '—'}</div>`
      : '';
    // 아직 상태 표시 안 한 사람 = 기본 출석 예정 (종이 출석부가 원본, 이 앱은 예외만 빠르게 표시)
    const pendingTag = !s ? '<span style="font-size:9px;color:#8E8E93;background:#F2F2F7;border-radius:8px;padding:1px 6px;margin-left:4px">기본출석 예정</span>' : '';
    return `<div class="att-row ${isActive(m) ? '' : 'disenrolled-row'} ${!s ? 'att-row-pending' : ''}">
      <div class="att-top">
        <div class="av av-sm" style="background:${m.avBg};color:${m.avColor}">${m.kr[0]}</div>
        <div class="att-info">
          <div class="att-name">${m.kr}${etag}${pendingTag}</div>
          <div class="att-id">${m.medicaid} ${insBadge(m.ins || 'Anthem_MLTC')} ${statusBadge(m)}</div>
          ${sigStr}
        </div>
        <div>${badgeHTML(s)}${ds ? `<div style="font-size:10px;color:#8E8E93;margin-top:2px">${ds}</div>` : ''}</div>
      </div>
      <div class="att-btns">
        <button class="abt ${s==='in'       ?'s-in'      :''}" onclick="qSet('${iso}','${m.id}','in')">✅출석</button>
        <button class="abt ${s==='late'     ?'s-late'    :''}" onclick="qSet('${iso}','${m.id}','late')">⏰지각</button>
        <button class="abt ${s==='absent'   ?'s-absent'  :''}" onclick="qSet('${iso}','${m.id}','absent')">❌결석</button>
        <button class="abt ${s==='travel'   ?'s-travel'  :''}" onclick="openAttModal('${iso}','${m.id}','travel')">✈️여행</button>
        <button class="abt ${s==='hospital' ?'s-hospital':''}" onclick="openAttModal('${iso}','${m.id}','hospital')">🏥입원</button>
        <button class="abt" onclick="openAttModal('${iso}','${m.id}',null)" style="color:#8E8E93">•••</button>
      </div>
      <button class="btn-sm" onclick="wfRecordServices('${iso}','${m.id}')">AUTH / 교통 확인 · ${r.transportCount===''||r.transportCount==null?'횟수 미확인':r.transportCount+'회'}</button>
      <div style="color:#B35900;font-size:11px">${wfEsc(r.authWarning||(!r.sdcAuth&&['in','late'].includes(s)?'SDC AUTH 미연결':''))}</div>
      <textarea class="memo-f" rows="1" placeholder="메모..." oninput="qMemo('${iso}','${m.id}',this.value)">${String(Object.prototype.hasOwnProperty.call(_attMemoDrafts,iso+'|'+m.id)?_attMemoDrafts[iso+'|'+m.id]:(r.memo||'')).replace(/</g, '&lt;')}</textarea>
      ${Object.prototype.hasOwnProperty.call(_attMemoDrafts,iso+'|'+m.id)?`<button class="btn-sm" onclick="retryAttMemo('${iso}','${m.id}')">메모 저장 재시도</button><button class="btn-sm" onclick="discardAttMemo('${iso}','${m.id}')">미저장 메모 취소</button>`:''}
    </div>`;
  }).join('');

  const attList = document.getElementById('att-list');
  if (attList) {
    var blocked=_attBulkBusy||_attLoading||!_attReady[iso];
    attList.innerHTML = (! _attReady[iso]?'<div class="empty-msg">'+(_attLoading?'⏳ 최신 출결 조회 중…':'조회되지 않은 출결입니다. 새로고침 후 작성해주세요.')+'</div>':'')+(html||'<div class="empty-msg">오늘 대상 이용자 없음</div>');
    attList.querySelectorAll('button,textarea').forEach(function(el){el.disabled=blocked;});
  }
  const attIn  = document.getElementById('att-in');    if(attIn)    attIn.textContent    = inC;
  const attTr  = document.getElementById('att-travel'); if(attTr)   attTr.textContent    = trC;
  const attPnd = document.getElementById('att-pend');  if(attPnd)   attPnd.textContent   = pC;
  const attTtl = document.getElementById('att-title'); if(attTtl)   attTtl.textContent   = (past?'📝 과거 수정 — ':'')+fmtD(iso)+' ('+list.length+'명)';
  const dayCnt = document.getElementById('day-count'); if(dayCnt)   dayCnt.textContent   = '출석 '+inC+'명';

  // 일괄 확정 버튼 표시 여부 (미확정자 있을 때만)
  const bulkBtn = document.getElementById('att-bulk-confirm-btn');
  if (bulkBtn) {bulkBtn.style.display=pC>0?'block':'none';bulkBtn.disabled=_attBulkBusy||_attLoading||!_attReady[iso];}
  const bulkCount = document.getElementById('att-bulk-count');
  if (bulkCount) bulkCount.textContent = pC;
  renderAttBulkResult();
}

// 결석/지각/여행 등 예외만 표시된 상태에서, 나머지 미확정 전원을 한번에 "출석"으로 확정
async function confirmRemainingAsPresent(){return runAttendanceBulk(false);}
async function retryFailedAttendance(){return runAttendanceBulk(true);}
function renderAttBulkResult(){
  var box=document.getElementById('att-bulk-result');if(!box)return;box.textContent='';
  var r=_attBulkResult;if(!r||r.iso!==toISO(curDate)){box.hidden=true;return;}box.hidden=false;
  var title=document.createElement('strong');title.textContent=r.busy?'⏳ 출결 처리 중 · '+r.processed+'/'+r.total:r.verified?'출결 서버 확인 완료':'출결 서버 재확인 필요';box.appendChild(title);
  var text=document.createElement('p');text.textContent=r.busy?'저장 결과를 확인하고 있습니다.':r.verified?'출석 확인 '+r.confirmed+'명 · 다른 상태로 기록됨 '+r.other+'명 · 미확정 '+r.failed.length+'명':'저장 응답 성공 '+r.saved+'명. 서버 조회에 실패하여 나머지 결과를 확정하지 않았습니다.';box.appendChild(text);
  if(!r.busy&&r.failed.length){var list=document.createElement('ul');r.failed.forEach(function(x){var li=document.createElement('li');li.textContent=x.name+' — '+x.error;list.appendChild(li);});box.appendChild(list);}
  if(!r.busy&&(r.failed.length||!r.verified)){var retry=document.createElement('button');retry.type='button';retry.className='btn-sm';retry.textContent=r.verified?'미확정 대상만 재시도':'서버 재확인 후 재시도';retry.onclick=retryFailedAttendance;box.appendChild(retry);}
}
async function runAttendanceBulk(retry){
  if(_attBulkBusy||_attWrites||_attLoading||Object.keys(_attMemoDrafts).length||WriteGuard.editing()){alert('진행 중인 저장이나 편집을 먼저 완료해주세요.');return;}
  const iso=toISO(curDate),previous=_attBulkResult;
  var candidates=retry&&previous&&previous.iso===iso?previous.failed.map(function(x){return {id:x.id,kr:x.name};}):getList(iso).filter(function(m){return !(getRec(iso)[m.id]||{}).status;});
  if(!candidates.length){alert('확정할 대상이 없습니다.');return;}
  if(!confirm(candidates.length+'명의 최신 서버 상태를 확인하고 미확정인 사람만 출석으로 저장할까요?'))return;
  _attBulkBusy=true;
  var result={iso:iso,total:candidates.length,processed:0,busy:true,saved:0,confirmed:0,other:0,verified:false,failed:[],targets:candidates};_attBulkResult=result;renderAtt();
  try{
    if(!await loadAttFromSheets(iso,{bulk:true,quiet:true})){
      result.failed=candidates.map(function(m){return {id:m.id,name:m.kr,error:'서버 조회 실패 — 저장하지 않음'};});return;
    }
    var pending=candidates.filter(function(m){return !(getRec(iso)[m.id]||{}).status;});
    for(var start=0;start<pending.length;start+=50){
      var chunk=pending.slice(start,start+50),drafts=chunk.map(function(m){var r=Object.assign({},getRec(iso)[m.id]||{},{status:'in',updatedAt:now2()});if(iso>=todayISO&&!r.signIn)r.signIn=now2();return r;});
      _attWrites++;
      try{
        var responses=await SheetsAPI.batchWrite('출결',chunk.map(function(m,i){return attendanceWriteBody(iso,m.id,drafts[i]);}));
        responses.forEach(function(r,i){if(r.success){setRec(iso,chunk[i].id,drafts[i]);result.saved++;}else result.failed.push({id:chunk[i].id,name:chunk[i].kr,error:r.error||'저장 실패'});});
      }catch(e){chunk.forEach(function(m){result.failed.push({id:m.id,name:m.kr,error:e.message});});}
      finally{_attWrites--;}
      result.processed=Math.min(candidates.length,candidates.length-pending.length+start+chunk.length);renderAttBulkResult();
    }
    // Successful rows are never blindly resubmitted. Re-read even after all POSTs succeeded.
    var failedById={};result.failed.forEach(function(x){failedById[x.id]=x;});
    result.verified=await loadAttFromSheets(iso,{bulk:true,quiet:true});
    if(result.verified){
      result.failed=[];candidates.forEach(function(m){var status=(getRec(iso)[m.id]||{}).status;
        if(status==='in'||status==='late')result.confirmed++;
        else if(status)result.other++;
        else result.failed.push(failedById[m.id]||{id:m.id,name:m.kr,error:'서버에 미확정 상태로 남아 있습니다.'});
      });
    }else{
      // Include uncertain successes in the verification candidates, but retry never overwrites a server status.
      result.failed=candidates.map(function(m){return failedById[m.id]||{id:m.id,name:m.kr,error:'서버 최종 조회 실패 — 재확인 필요'};});
    }
  }catch(e){result.verified=false;result.failed=candidates.map(function(m){return {id:m.id,name:m.kr,error:e.message};});}
  finally{result.busy=false;_attBulkBusy=false;renderAtt();}
}

// ── 빠른 출결 체크 ────────────────────────────────────────────
async function qSet(iso, mid, st, options) {
  options=options||{};
  if((_attBulkBusy&&!options.bulk)||!_attReady[iso])return false;
  const r    = getRec(iso);
  const prev = (r[mid] || {}).status;
  const past = iso < todayISO;

  // 오늘 이미 출석(in/late) 상태면 재클릭 무시
  if (options.ensure&&prev)return true;
  if (!past && (prev === 'in' || prev === 'late') && st === prev) return true;

  let upd;
  if (prev === st) {
    // 같은 상태 클릭 → 취소
    upd = { status: '', signIn: '', signOut: '', memo: (r[mid]||{}).memo||'' };

  } else {
    const ex = r[mid] || {};
    upd = { ...ex, status: st, updatedAt: now2() };
    if (past && ex.status && ex.status !== st) upd.editedAt = now2();
    if ((st === 'in' || st === 'late') && !ex.signIn && !past) upd.signIn = now2();

  }

  var ok=await saveAttToSheets(iso, mid, upd,options);
  if(!options.bulk)renderAtt();
  return ok;
}

var _attMemoTimers=Object.create(null),_attMemoDrafts=Object.create(null);
var _attWrites=0;
function qMemo(iso,mid,val){
  var key=iso+'|'+mid;_attMemoDrafts[key]=val;clearTimeout(_attMemoTimers[key]);
  _attMemoTimers[key]=setTimeout(async function(){
    delete _attMemoTimers[key];
    var ex=getRec(iso)[mid]||{};
    var ok=await saveAttToSheets(iso,mid,{...ex,memo:val,updatedAt:now2()});
    if(_attMemoDrafts[key]===val){if(ok)delete _attMemoDrafts[key];renderAtt();}
  },500);
}
function retryAttMemo(iso,mid){var key=iso+'|'+mid;if(Object.prototype.hasOwnProperty.call(_attMemoDrafts,key))qMemo(iso,mid,_attMemoDrafts[key]);}
function discardAttMemo(iso,mid){var key=iso+'|'+mid;if(_attRowWrites.has(key)||!confirm('저장하지 못한 메모를 취소하고 서버에서 읽었던 값으로 돌아갈까요?'))return;clearTimeout(_attMemoTimers[key]);delete _attMemoTimers[key];delete _attMemoDrafts[key];renderAtt();}
window.addEventListener('beforeunload',function(e){
  if(Object.keys(_attMemoDrafts).length||_attWrites){e.preventDefault();e.returnValue='';}
});

// ── Sheets에 단일 출결 저장 ───────────────────────────────────
function attendanceWriteBody(iso,mid,r){
  const member=MEMBERS.find(m=>m.id===mid)||{};
  const nameKr=member.kr||'';
  const nameEn=member.en||''; // 감사(Audit) 시 시트에서 바로 확인할 수 있도록 영문 이름도 기록
  const author=_currentUser?(_currentUser.name||''):'';
  return {
      action:  'upsert',
      sheet:   '출결',
      key:     '날짜',
      value:   iso + '_' + mid,
      data: {
        'SDCAUTH':r.sdcAuth||'', '교통AUTH':r.transportAuth||'', '교통횟수':r.transportCount==null?'':r.transportCount, 'AUTH확인':r.authWarning||'',
        '날짜':     iso,
        '멤버ID':   mid,
        '한글이름': nameKr,
        '영문이름': nameEn,
        '상태':     r.status   || '',
        'Sign-in':  r.signIn   || '',
        'Sign-out': r.signOut  || '',
        '메모':     r.memo     || '',
        '시작일':   r.start    || '',
        '종료일':   r.end      || '',
        '수정시각': new Date().toISOString(),
        '작성자':   author,
      },
  };
}
async function saveAttToSheets(iso, mid, r, options) {
  options=options||{};var rowKey=iso+'|'+mid;
  if(_attRowWrites.has(rowKey)||(_attBulkBusy&&!options.bulk)){if(!options.quiet)alert('이 출결은 저장 중입니다. 잠시 기다려주세요.');return false;}
  _attRowWrites.add(rowKey);delete _attLastErrors[rowKey];
  r=Object.assign({},getRec(iso)[mid]||{},r);
  const nameKr = (MEMBERS.find(m => m.id === mid) || {}).kr || '';
  const author = _currentUser ? (_currentUser.name || '') : '';
  _attWrites++;
  try {
    await SheetsAPI.post(attendanceWriteBody(iso,mid,r));
    setRec(iso,mid,{...r});return true;
  } catch(e) {
    _attLastErrors[rowKey]=e.message;if(!options.quiet)alert('❌ 출결 저장 실패: '+e.message);return false;
  } finally{_attWrites--;_attRowWrites.delete(rowKey);} 
}

// ── 출결 상세 모달 ────────────────────────────────────────────
function openAttModal(iso, mid, fs) {
  popId = mid; popDate = iso;
  const m = MEMBERS.find(x => x.id === mid), r = (getRec(iso)[mid]) || {};
  document.getElementById('att-modal-title').textContent = (m ? m.kr : '') + ' — ' + (iso === todayISO ? '오늘' : fmtD(iso));
  document.getElementById('m-memo').value    = r.memo    || '';
  document.getElementById('m-start').value   = r.start   || '';
  document.getElementById('m-end').value     = r.end     || '';
  document.getElementById('m-signin').value  = r.signIn  || '';
  document.getElementById('m-signout').value = r.signOut || '';

  mCurSt = fs || r.status || null;
  ['in','late','absent','travel','hospital','leave'].forEach(s => {
    document.getElementById('mst-' + s).className = 'mst' + (mCurSt === s ? ' a-' + s : '');
  });
  document.getElementById('att-modal-date-section').style.display =
    ['travel','hospital','leave'].includes(mCurSt || '') ? 'block' : 'none';

  if (fs && !r.start) document.getElementById('m-start').value = iso;
  if ((fs === 'in' || fs === 'late') && !r.signIn) document.getElementById('m-signin').value = now2();

  document.getElementById('m-chips').innerHTML = (QT[mCurSt || ''] || QT['absent'])
    .map(t => `<button class="chip" onclick="addChip('${t}')">${t}</button>`).join('');
  openOv('ov-att');
}

function setMSt(s) {
  mCurSt = s;
  ['in','late','absent','travel','hospital','leave'].forEach(st => {
    document.getElementById('mst-' + st).className = 'mst' + (st === s ? ' a-' + st : '');
  });
  document.getElementById('att-modal-date-section').style.display =
    ['travel','hospital','leave'].includes(s) ? 'block' : 'none';
  if (['travel','hospital','leave'].includes(s) && !document.getElementById('m-start').value)
    document.getElementById('m-start').value = popDate || todayISO;
  document.getElementById('m-chips').innerHTML = (QT[s] || [])
    .map(t => `<button class="chip" onclick="addChip('${t}')">${t}</button>`).join('');
}

function addChip(t) {
  const ta = document.getElementById('m-memo');
  ta.value = ta.value + (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + t;
}

async function saveAttModal() {
  if (!popId || !popDate) return;
  const past = popDate < todayISO, ex = (getRec(popDate)[popId]) || {};
  const data = {
    status:   mCurSt || '',
    memo:     document.getElementById('m-memo').value,
    start:    document.getElementById('m-start').value,
    end:      document.getElementById('m-end').value,
    signIn:   document.getElementById('m-signin').value,
    signOut:  document.getElementById('m-signout').value,
    updatedAt: now2(),
  };
  if (past && ex.status) data.editedAt = now2();
  if(!await saveAttToSheets(popDate,popId,data))return;
  closeOv('ov-att');renderAtt();
}

async function clearAttModal(){
  if(!popId||!popDate)return;
  if(!await saveAttToSheets(popDate,popId,{status:'',signIn:'',signOut:'',memo:''}))return;
  closeOv('ov-att');renderAtt();
}

// ── 부재 탭 ───────────────────────────────────────────────────
// ── 부재(여행/입원/휴가) 공유 캐시 ──────────────────────────────
// memberId -> { status, start, end, memo } (오늘 기준 "현재 부재중"인 것만)
var ABSENCE_MAP = {};

async function loadAbsenceMap() {
  const iso = todayISO;
  const map = {};
  try {
    // 오늘 기준 앞뒤 3개월(약 90일) 범위로 조회
    const from = _addDaysISO(iso, -90);
    const to   = _addDaysISO(iso, 90);
    const res  = await SheetsAPI.readByRange('출결', from, to);
    if (res && res.ok && res.data) {
      res.data
        .filter(r => ['travel', 'hospital', 'leave'].includes(r['상태']))
        .forEach(r => {
          const mid   = String(r['멤버ID'] || '');
          const start = String(r['시작일'] || '').slice(0, 10);
          let   end   = String(r['종료일'] || '').slice(0, 10);
          if (!mid || !start) return;
          if (end && end < start) end = ''; // 종료일이 시작일보다 빠르면 잘못 입력된 것 → 미정 처리

          // 진행중 / 예정 / 종료 상태 계산
          let state;
          if (start <= iso && (!end || end >= iso)) state = 'ongoing';
          else if (start > iso) state = 'upcoming';
          else state = 'past'; // end < iso

          const entry = { status: r['상태'] || '', start, end, memo: r['메모'] || '', state };

          // 멤버당 하나만 표시: 진행중 > 예정(가장 가까운) > 종료(가장 최근) 우선순위
          const cur = map[mid];
          if (!cur) { map[mid] = entry; return; }
          const priority = { ongoing: 0, upcoming: 1, past: 2 };
          if (priority[entry.state] < priority[cur.state]) { map[mid] = entry; return; }
          if (priority[entry.state] === priority[cur.state]) {
            if (entry.state === 'upcoming' && entry.start < cur.start) map[mid] = entry;
            if (entry.state === 'past' && entry.start > cur.start) map[mid] = entry;
            if (entry.state === 'ongoing' && entry.start > cur.start) map[mid] = entry;
          }
        });
    }
  } catch (e) { console.log('부재 맵 로드 실패:', e); }
  ABSENCE_MAP = map;
  return ABSENCE_MAP;
}

async function renderAbsence() {
  await loadAbsenceMap();

  ['travel', 'hospital', 'leave'].forEach((type, i) => {
    const id   = ['tr-list', 'ho-list', 'lv-list'][i];
    const rows = MEMBERS
      .map(m => ({ m, r: ABSENCE_MAP[m.id] }))
      .filter(x => x.r && x.r.status === type);
    document.getElementById(id).innerHTML = rows.length
      ? rows.map(({ m, r }) => {
          const ds = (r.start || '') + (r.end ? ' ~ ' + r.end : ' ~ 미정');
          const stateInfo = {
            ongoing:  { label: '🟢 진행중', color: '#1A7A3C' },
            upcoming: { label: '🔵 예정',   color: '#0C447C' },
            past:     { label: '⚪ 종료',   color: '#8E8E93' },
          }[r.state] || { label: '', color: '#8E8E93' };
          return `<div class="att-row" style="flex-direction:row;gap:9px;padding:10px 14px;align-items:center">
            <div class="av av-sm" style="background:${m.avBg};color:${m.avColor}">${m.kr[0]}</div>
            <div style="flex:1">
              <div class="att-name">${m.kr} <span style="font-size:11px;font-weight:700;color:${stateInfo.color}">${stateInfo.label}</span></div>
              <div class="att-id">${ds}</div>
              <div style="font-size:12px;color:#3C3C43">${r.memo || ''}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0">
              <button class="btn-sm" onclick="editAbsence('${m.id}')">✏️</button>
              <button class="btn-danger" onclick="deleteAbsence('${m.id}')">🗑️</button>
            </div>
          </div>`;
        }).join('')
      : '<div class="empty-msg">해당 없음</div>';
  });
}

function _addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
}

// ── 부재 직접 등록 (출결 탭을 거치지 않고 바로 등록) ────────────
function openAbsenceModal(mid) {
  window._abEditOriginal = null;
  document.getElementById('ab-member-search').value = '';
  filterAbsenceMemberList();

  if (mid && ABSENCE_MAP[mid]) {
    // 수정 모드: 기존 값 채우기 + 원래 시작일 기억(변경 시 옛 행 정리용)
    const r = ABSENCE_MAP[mid];
    window._abEditOriginal = { mid, start: r.start };
    document.getElementById('ab-type').value  = r.status || 'travel';
    document.getElementById('ab-start').value = r.start  || todayISO;
    document.getElementById('ab-end').value    = r.end    || '';
    document.getElementById('ab-memo').value   = r.memo   || '';
    const sel = document.getElementById('ab-member-sel');
    if (sel) sel.value = mid;
  } else {
    document.getElementById('ab-type').value = 'travel';
    document.getElementById('ab-start').value = todayISO;
    document.getElementById('ab-end').value = '';
    document.getElementById('ab-memo').value = '';
  }
  openOv('ov-absence');
}

function filterAbsenceMemberList() {
  const q = (document.getElementById('ab-member-search').value || '').toLowerCase();
  const sel = document.getElementById('ab-member-sel');
  if (!sel) return;
  sel.innerHTML = '';
  MEMBERS.filter(m => m.status !== 'disenrolled' && (!q || (m.kr||'').includes(q) || (m.en||'').toLowerCase().includes(q)))
    .forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = (m.kr||'') + ' ' + (m.en||'');
      sel.appendChild(opt);
    });
}

async function saveAbsence() {
  const sel = document.getElementById('ab-member-sel');
  const mid = sel && sel.value;
  if (!mid) { alert('멤버를 선택해주세요'); return; }
  const type  = document.getElementById('ab-type').value;
  const start = document.getElementById('ab-start').value;
  const end   = document.getElementById('ab-end').value;
  const memo  = document.getElementById('ab-memo').value.trim();
  if (!start) { alert('시작일을 입력해주세요'); return; }

  const m = MEMBERS.find(x => x.id === mid);
  const nameKr = m ? m.kr : '';

  const rec = { status: type, signIn: '', signOut: '', memo, start, end, writer: (_currentUser && _currentUser.name) || '' };


  try {
    await SheetsAPI.syncSingleAttendance(start, mid, rec, MEMBERS);
  } catch(e){alert('❌ 부재 등록 실패: '+e.message);return;}
  setRec(start,mid,rec);
  // 수정 중 시작일을 바꾼 경우, 예전 행은 상태를 비워서 부재 목록에서 사라지게 함
  const orig = window._abEditOriginal;
  if (orig && orig.mid === mid && orig.start && orig.start !== start) {
    const clearRec = { status: '', signIn: '', signOut: '', memo: '', start: '', end: '', writer: (_currentUser && _currentUser.name) || '' };
    try { await SheetsAPI.syncSingleAttendance(orig.start, mid, clearRec, MEMBERS); } catch(e){alert('새 부재는 저장되었으나 이전 행 정리에 실패했습니다: '+e.message);return;}
  }



  window._abEditOriginal = null;
  closeOv('ov-absence');
  renderAbsence();
  if (typeof filterM === 'function') filterM(); // 멤버 목록 배지도 즉시 갱신
  alert('✅ ' + nameKr + ' 부재 등록 완료!');
}

async function editAbsence(mid) {
  openAbsenceModal(mid);
}

async function deleteAbsence(mid) {
  const r = ABSENCE_MAP[mid];
  if (!r) return;
  const m = MEMBERS.find(x => x.id === mid);
  if (!confirm((m ? m.kr : '') + '의 부재 기록을 삭제할까요?')) return;

  const clearRec = { status: '', signIn: '', signOut: '', memo: '', start: '', end: '', writer: (_currentUser && _currentUser.name) || '' };
  try {
    await SheetsAPI.syncSingleAttendance(r.start, mid, clearRec, MEMBERS);
  } catch (e) { console.log('부재 삭제 실패:', e); alert('❌ 삭제 실패: ' + e.message); return; }

  delete ABSENCE_MAP[mid];
  renderAbsence();
  if (typeof filterM === 'function') filterM();
}

// ── 저장소 ───────────────────────────────────────────────
// 기존 호출 호환용 no-op. 운영 데이터는 Google Sheets/Drive만 사용.
function saveToStorage() {}







