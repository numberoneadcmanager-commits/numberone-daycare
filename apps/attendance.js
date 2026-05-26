// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 출결 관리
// apps/attendance.js
// ══════════════════════════════════════════════════════════════

// ── 출결 대상 목록 ────────────────────────────────────────────
function getList(iso) {
  const q   = (document.getElementById('asearch') || {}).value || '';
  const dow = dowKey(iso);
  return MEMBERS.filter(m => m.days.includes(dow) && (!q || m.kr.includes(q)));
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
  curDate = nd; updateDN(); renderAtt();
}

function goToday() { curDate = new Date(); updateDN(); renderAtt(); }

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
        <button class="abt ${s === 'in'       ? 's-in'       : ''}" onclick="qSet('${iso}','${m.id}','in')">✅출석</button>
        <button class="abt ${s === 'late'     ? 's-late'     : ''}" onclick="qSet('${iso}','${m.id}','late')">⏰지각</button>
        <button class="abt ${s === 'absent'   ? 's-absent'   : ''}" onclick="qSet('${iso}','${m.id}','absent')">❌결석</button>
        <button class="abt ${s === 'travel'   ? 's-travel'   : ''}" onclick="openAttModal('${iso}','${m.id}','travel')">✈️여행</button>
        <button class="abt ${s === 'hospital' ? 's-hospital' : ''}" onclick="openAttModal('${iso}','${m.id}','hospital')">🏥입원</button>
        <button class="abt" onclick="openAttModal('${iso}','${m.id}',null)" style="color:#8E8E93">•••</button>
      </div>
      <textarea class="memo-f" rows="1" placeholder="메모..." oninput="qMemo('${iso}','${m.id}',this.value)">${(r.memo || '').replace(/</g, '&lt;')}</textarea>
    </div>`;
  }).join('');

  document.getElementById('att-list').innerHTML = html || '<div class="empty-msg">오늘 대상 이용자 없음</div>';
  document.getElementById('att-in').textContent    = inC;
  document.getElementById('att-travel').textContent = trC;
  document.getElementById('att-pend').textContent   = pC;
  document.getElementById('att-title').textContent  = (past ? '📝 과거 수정 — ' : '') + fmtD(iso) + ' (' + list.length + '명)';
  document.getElementById('day-count').textContent  = '출석 ' + inC + '명';
  updateDashNow();
}

// ── 빠른 출결 체크 ────────────────────────────────────────────
function qSet(iso, mid, st) {
  const r    = getRec(iso), prev = (r[mid] || {}).status, past = iso < todayISO;
  if (prev === st) {
    if (allR[iso]) delete allR[iso][mid];
  } else {
    const ex  = r[mid] || {}, upd = { ...ex, status: st, updatedAt: now2() };
    if (past && ex.status && ex.status !== st) upd.editedAt = now2();
    if ((st === 'in' || st === 'late') && !ex.signIn && !past) upd.signIn = now2();
    setRec(iso, mid, upd);
  }
  renderAtt(); saveToStorage(); syncToSheets(iso);
}

function qMemo(iso, mid, val) {
  const ex = (getRec(iso)[mid]) || {}, past = iso < todayISO;
  const upd = { ...ex, memo: val, updatedAt: now2() };
  if (past && ex.memo !== undefined) upd.editedAt = now2();
  setRec(iso, mid, upd);
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

function saveAttModal() {
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
  saveToStorage(); closeOv('ov-att'); renderAtt(); syncToSheets(popDate);
}

function clearAttModal() {
  if (!popId || !popDate) return;
  if (allR[popDate]) delete allR[popDate][popId];
  closeOv('ov-att'); renderAtt();
}

// ── 부재 탭 ───────────────────────────────────────────────────
function renderAbsence() {
  const iso = todayISO;
  ['travel', 'hospital', 'leave'].forEach((type, i) => {
    const id   = ['tr-list', 'ho-list', 'lv-list'][i];
    const rows = MEMBERS.filter(m => (getRec(iso)[m.id] || {}).status === type);
    document.getElementById(id).innerHTML = rows.length
      ? rows.map(m => {
          const r  = getRec(iso)[m.id];
          const ds = (r.start || '') + (r.end ? ' ~ ' + r.end : r.start ? ' ~ 미정' : '—');
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

// ── Sheets 동기화 ─────────────────────────────────────────────
async function syncToSheets(iso) {
  try {
    const recs = getRec(iso);
    await SheetsAPI.syncAttendance(iso, recs, MEMBERS);
  } catch (e) {}
}

// ── 로컬 저장/로드 ────────────────────────────────────────────
function saveToStorage() {
  try {
    const ms = {};
    MEMBERS.forEach(m => {
      if (m.status === 'disenrolled')
        ms[m.id] = { status: m.status, disenrollDate: m.disenrollDate || '', disenrollNote: m.disenrollNote || '' };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      allR, incidents, activities, cases,
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
    if (data.allR)       allR       = data.allR;
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
  allR = {}; incidents = []; activities = []; cases = [];
  MEMBERS.forEach(m => { m.status = 'active'; m.disenrollDate = ''; });
  renderDash(); renderAtt(); filterM(); alert('삭제 완료');
}

function exportData() {
  const ms = {};
  MEMBERS.forEach(m => { if (m.status === 'disenrolled') ms[m.id] = { status: m.status, disenrollDate: m.disenrollDate || '' }; });
  const data = { allR, incidents, activities, cases, memberStatus: ms, exportedAt: new Date().toISOString() };
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
        if (data.allR)       allR       = data.allR;
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
        saveToStorage(); renderDash(); renderAtt(); filterM();
        renderIncidents(); renderActivities(); renderCases();
        alert('불러오기 완료!');
      } catch (err) { alert('파일 형식 오류'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
