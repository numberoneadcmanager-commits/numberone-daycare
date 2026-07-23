// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 출결 관리 v2.0
// Sheets가 단일 진실 공급원 (Single Source of Truth)
// apps/attendance.js
// ══════════════════════════════════════════════════════════════

// ── 로딩 상태 ─────────────────────────────────────────────────
var _attLoading = false;
var _attCache   = {}; // { 'YYYY-MM-DD': { mid: {...} } } — 메모리 캐시만

// ── 출결 대상 목록 ────────────────────────────────────────────
function getList(iso) {
  const q   = (document.getElementById('asearch') || {}).value || '';
  const dow = dowKey(iso);
  return MEMBERS.filter(m => m.days.includes(dow) && (!q || m.kr.includes(q)));
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
  const nd = new Date(curDate);
  nd.setDate(nd.getDate() + d);
  if (toISO(nd) > todayISO) return;
  curDate = nd;
  updateDN();
  loadAttFromSheets(toISO(curDate));
}

function goToday() {
  curDate = new Date();
  updateDN();
  loadAttFromSheets(toISO(curDate));
}

// ── Sheets에서 출결 로드 ──────────────────────────────────────
async function loadAttFromSheets(iso) {
  if (_attLoading) return;
  _attLoading = true;

  // 로딩 표시
  const listEl = document.getElementById('att-list');
  if (listEl) listEl.innerHTML = '<div class="empty-msg">⏳ 출결 데이터 불러오는 중...</div>';

  try {
    const res = await SheetsAPI.readByDate('출결', iso);
    if (res && res.ok && res.data) {
      // 캐시 초기화 후 Sheets 데이터로 채우기
      _attCache[iso] = {};
      allR[iso]      = {};
      res.data.forEach(function(r) {
        const mid = String(r['멤버ID'] || '');
        if (!mid) return;
        const rec = {
          status:  String(r['상태']    || ''),
          signIn:  String(r['Sign-in'] || ''),
          signOut: String(r['Sign-out']|| ''),
          memo:    String(r['메모']    || ''),
          start:   String(r['시작일']  || ''),
          end:     String(r['종료일']  || ''),
          writer:  String(r['작성자']  || ''),
        };
        _attCache[iso][mid] = rec;
        allR[iso][mid]      = rec;
      });
    }
  } catch(e) {
    console.warn('출결 로드 실패:', e);
  } finally {
    _attLoading = false;
  }

  renderAtt();
  updateDashNow();
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
    return `<div class="att-row ${isActive(m) ? '' : 'disenrolled-row'}">
      <div class="att-top">
        <div class="av av-sm" style="background:${m.avBg};color:${m.avColor}">${m.kr[0]}</div>
        <div class="att-info">
          <div class="att-name">${m.kr}${etag}</div>
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
      <textarea class="memo-f" rows="1" placeholder="메모..." oninput="qMemo('${iso}','${m.id}',this.value)">${(r.memo || '').replace(/</g, '&lt;')}</textarea>
    </div>`;
  }).join('');

  const attList = document.getElementById('att-list');
  if (attList) attList.innerHTML = html || '<div class="empty-msg">오늘 대상 이용자 없음</div>';
  const attIn  = document.getElementById('att-in');    if(attIn)    attIn.textContent    = inC;
  const attTr  = document.getElementById('att-travel'); if(attTr)   attTr.textContent    = trC;
  const attPnd = document.getElementById('att-pend');  if(attPnd)   attPnd.textContent   = pC;
  const attTtl = document.getElementById('att-title'); if(attTtl)   attTtl.textContent   = (past?'📝 과거 수정 — ':'')+fmtD(iso)+' ('+list.length+'명)';
  const dayCnt = document.getElementById('day-count'); if(dayCnt)   dayCnt.textContent   = '출석 '+inC+'명';
}

// ── 빠른 출결 체크 ────────────────────────────────────────────
async function qSet(iso, mid, st) {
  const r    = getRec(iso);
  const prev = (r[mid] || {}).status;
  const past = iso < todayISO;

  // 오늘 이미 출석(in/late) 상태면 재클릭 무시
  if (!past && (prev === 'in' || prev === 'late') && st === prev) return;

  let upd;
  if (prev === st) {
    // 같은 상태 클릭 → 취소
    upd = { status: '', signIn: '', signOut: '', memo: (r[mid]||{}).memo||'' };
    if (_attCache[iso]) delete _attCache[iso][mid];
    if (allR[iso])      delete allR[iso][mid];
  } else {
    const ex = r[mid] || {};
    upd = { ...ex, status: st, updatedAt: now2() };
    if (past && ex.status && ex.status !== st) upd.editedAt = now2();
    if ((st === 'in' || st === 'late') && !ex.signIn && !past) upd.signIn = now2();
    setRec(iso, mid, upd);
  }

  renderAtt();

  // Sheets에 직접 저장
  await saveAttToSheets(iso, mid, upd);
}

function qMemo(iso, mid, val) {
  const ex  = (getRec(iso)[mid]) || {};
  const past = iso < todayISO;
  const upd = { ...ex, memo: val, updatedAt: now2() };
  if (past && ex.memo !== undefined) upd.editedAt = now2();
  setRec(iso, mid, upd);
  // 메모는 debounce (타이핑 중에 매번 저장 방지)
  clearTimeout(qMemo._t);
  qMemo._t = setTimeout(() => saveAttToSheets(iso, mid, upd), 1500);
}

// ── Sheets에 단일 출결 저장 ───────────────────────────────────
async function saveAttToSheets(iso, mid, r) {
  const nameKr = (MEMBERS.find(m => m.id === mid) || {}).kr || '';
  const author = _currentUser ? (_currentUser.name || '') : '';
  try {
    await SheetsAPI.post({
      action:  'upsert',
      sheet:   '출결',
      key:     '날짜',
      value:   iso + '_' + mid,
      data: {
        '날짜':     iso,
        '멤버ID':   mid,
        '한글이름': nameKr,
        '상태':     r.status   || '',
        'Sign-in':  r.signIn   || '',
        'Sign-out': r.signOut  || '',
        '메모':     r.memo     || '',
        '시작일':   r.start    || '',
        '종료일':   r.end      || '',
        '수정시각': new Date().toLocaleString('ko-KR'),
        '작성자':   author,
      },
    });
  } catch(e) {
    console.warn('출결 저장 실패:', mid, e);
  }
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
  setRec(popDate, popId, data);
  closeOv('ov-att');
  renderAtt();
  await saveAttToSheets(popDate, popId, data);
}

async function clearAttModal() {
  if (!popId || !popDate) return;
  if (_attCache[popDate]) delete _attCache[popDate][popId];
  if (allR[popDate])      delete allR[popDate][popId];
  closeOv('ov-att');
  renderAtt();
  await saveAttToSheets(popDate, popId, { status:'', signIn:'', signOut:'', memo:'' });
}

// ── 부재 탭 ───────────────────────────────────────────────────
async function renderAbsence() {
  const iso = todayISO;

  // ★ 부재는 "시작일에만 기록"되므로, 오늘 하루만 정확히 조회하면
  //   시작일이 오늘이 아닌(과거/미래 포함) 부재는 절대 안 보이는 버그가 있었음.
  //   넉넉한 범위(전후 180일)로 조회해서, 시작일~종료일 범위에 오늘이 포함되는 기록을 찾음.
  let absenceRecords = [];
  try {
    const from = _addDaysISO(iso, -180);
    const to   = _addDaysISO(iso, 180);
    const res  = await SheetsAPI.readByRange('출결', from, to);
    if (res && res.ok && res.data) {
      absenceRecords = res.data
        .filter(r => ['travel', 'hospital', 'leave'].includes(r['상태']))
        .map(r => ({
          mid:   String(r['멤버ID'] || ''),
          status: r['상태'] || '',
          memo:  r['메모'] || '',
          start: String(r['시작일'] || '').slice(0, 10),
          end:   String(r['종료일'] || '').slice(0, 10),
        }))
        // 시작일~종료일(종료일 없으면 시작일과 동일 취급) 범위에 오늘 포함
        .filter(r => r.start && r.start <= iso && (!r.end || r.end >= iso));
    }
  } catch (e) { console.log('부재 탭 출결 로드 실패:', e); }

  // 멤버별로 최신(시작일 기준) 1건만 사용
  const byMember = {};
  absenceRecords.forEach(r => {
    if (!byMember[r.mid] || r.start > byMember[r.mid].start) byMember[r.mid] = r;
  });

  ['travel', 'hospital', 'leave'].forEach((type, i) => {
    const id   = ['tr-list', 'ho-list', 'lv-list'][i];
    const rows = MEMBERS
      .map(m => ({ m, r: byMember[m.id] }))
      .filter(x => x.r && x.r.status === type);
    document.getElementById(id).innerHTML = rows.length
      ? rows.map(({ m, r }) => {
          const ds = (r.start || '') + (r.end ? ' ~ ' + r.end : ' ~ 미정');
          return `<div class="att-row" style="flex-direction:row;gap:9px;padding:10px 14px">
            <div class="av av-sm" style="background:${m.avBg};color:${m.avColor}">${m.kr[0]}</div>
            <div style="flex:1">
              <div class="att-name">${m.kr}</div>
              <div class="att-id">${ds}</div>
              <div style="font-size:12px;color:#3C3C43">${r.memo || ''}</div>
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
function openAbsenceModal() {
  document.getElementById('ab-member-search').value = '';
  document.getElementById('ab-type').value = 'travel';
  document.getElementById('ab-start').value = todayISO;
  document.getElementById('ab-end').value = '';
  document.getElementById('ab-memo').value = '';
  filterAbsenceMemberList();
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
  setRec(start, mid, rec);

  try {
    await SheetsAPI.syncSingleAttendance(start, mid, rec, MEMBERS);
  } catch (e) { console.log('부재 등록 저장 실패:', e); }

  closeOv('ov-absence');
  renderAbsence();
  alert('✅ ' + nameKr + ' 부재 등록 완료!');
}

// ── 저장소 (출결은 localStorage 미사용) ───────────────────────
function saveToStorage() {
  try {
    const ms = {};
    MEMBERS.forEach(m => {
      if (m.status === 'disenrolled')
        ms[m.id] = { status: m.status, disenrollDate: m.disenrollDate || '', disenrollNote: m.disenrollNote || '' };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      incidents, activities, cases,
      memberStatus: ms, memberPhotos: mp,
      savedAt: new Date().toISOString(),
    }));
  } catch (e) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    // 출결(allR)은 localStorage에서 로드하지 않음 — Sheets에서 직접 로드
    if (data.incidents)  incidents  = data.incidents;
    if (data.activities) activities = data.activities;
    if (data.cases)      cases      = data.cases;
    if (data.memberPhotos) Object.keys(data.memberPhotos).forEach(id => {
      const m = MEMBERS.find(x => x.id === id); if (m) m.photo = data.memberPhotos[id];
    });
    if (data.memberStatus) Object.keys(data.memberStatus).forEach(id => {
      const s = data.memberStatus[id];
      const m = MEMBERS.find(x => x.id === id);
      if (m) { m.status = s.status; m.disenrollDate = s.disenrollDate || ''; m.disenrollNote = s.disenrollNote || ''; }
    });
    return true;
  } catch (e) { return false; }
}

function clearStorage() {
  if (!confirm('저장된 모든 데이터를 삭제하시겠습니까?')) return;
  localStorage.removeItem(STORAGE_KEY);
  allR = {}; _attCache = {};
  incidents = []; activities = []; cases = [];
  MEMBERS.forEach(m => { m.status = 'active'; m.disenrollDate = ''; });
  renderDash(); loadAttFromSheets(toISO(curDate)); filterM(); alert('삭제 완료');
}

function exportData() {
  const ms = {};
  MEMBERS.forEach(m => { if (m.status === 'disenrolled') ms[m.id] = { status: m.status, disenrollDate: m.disenrollDate || '' }; });
  const data = { incidents, activities, cases, memberStatus: ms, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'numberone_backup_' + todayISO + '.json'; a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!confirm('현재 데이터가 덮어씌워집니다. 계속하시겠습니까?')) return;
        if (data.incidents)  incidents  = data.incidents;
        if (data.activities) activities = data.activities;
        if (data.cases)      cases      = data.cases;
        if (data.memberPhotos) Object.keys(data.memberPhotos).forEach(id => {
          const m = MEMBERS.find(x => x.id === id); if (m) m.photo = data.memberPhotos[id];
        });
        if (data.memberStatus) Object.keys(data.memberStatus).forEach(id => {
          const s = data.memberStatus[id];
          const m = MEMBERS.find(x => x.id === id);
          if (m) { m.status = s.status; m.disenrollDate = s.disenrollDate || ''; }
        });
        saveToStorage(); renderDash(); filterM();
        renderIncidents(); renderActivities(); renderCases();
        alert('불러오기 완료!');
      } catch (err) { alert('파일 형식 오류'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
