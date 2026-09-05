// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 로그 (Incident / Activity / Case)
// apps/logs.js
// ══════════════════════════════════════════════════════════════

// ── 탭 전환 ──────────────────────────────────────────────────
function showLog(tab) {
  ['incident','activity','caselog','transport'].forEach(t => {
    document.getElementById('lv-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('ltab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'incident') renderIncidents();
  if (tab === 'activity') renderActivities();
  if (tab === 'caselog')  renderCases();
  if (tab === 'transport') { renderTransportLog(); loadTransportFromSheets(); }
}

// ── Incident ─────────────────────────────────────────────────
function renderIncidents() {
  const from = document.getElementById('inc-from').value;
  const to   = document.getElementById('inc-to').value;
  let list   = [...incidents];
  if (from) list = list.filter(i => i['날짜'] >= from);
  if (to)   list = list.filter(i => i['날짜'] <= to);
  list.sort((a, b) => (b['날짜'] || '').localeCompare(a['날짜'] || ''));

  document.getElementById('inc-total').textContent   = list.length;
  document.getElementById('inc-serious').textContent = list.filter(i => i['심각도'] === 'Serious').length;
  document.getElementById('inc-mod').textContent     = list.filter(i => i['심각도'] === 'Moderate').length;
  document.getElementById('inc-minor').textContent   = list.filter(i => i['심각도'] === 'Minor').length;

  const sevBadge = s => s === 'Serious'
    ? '<span class="badge b-red">🔴 Serious</span>'
    : s === 'Moderate'
    ? '<span class="badge b-warn">🟡 Moderate</span>'
    : '<span class="badge b-ok">🟢 Minor</span>';
  const dohBadge = v => v === '보고 완료'
    ? '<span class="badge b-ok">DOH ✓</span>'
    : v === '미보고'
    ? '<span class="badge b-red">DOH 미보고</span>'
    : '<span class="badge b-gray">—</span>';

  document.getElementById('inc-list').innerHTML = list.length
    ? list.map(inc => `<div class="log-card ${inc['심각도'] === 'Serious' && inc['DOH보고'] === '미보고' ? 'followup-alert' : ''}">
        <div class="log-top"><div>
          <div class="log-name"><span class="av av-xs" style="background:#FAECE7;color:#993C1D">${(inc['한글이름'] || '?')[0]}</span>${inc['한글이름'] || '—'} ${sevBadge(inc['심각도'])}</div>
          <div class="log-date">${inc['날짜']} ${inc['시간'] || ''} · ${inc['유형'] || '—'} · ${inc['장소'] || '—'}</div>
        </div><div>${dohBadge(inc['DOH보고'])}</div></div>
        <div class="log-body">${inc['설명'] || ''}</div>
        ${inc['조치'] ? `<div class="log-body" style="color:#1C1C1E"><b>조치:</b> ${inc['조치']}</div>` : ''}
        <div class="log-footer">
          <span class="log-meta">목격자: ${inc['목격자'] || '—'} · ${inc['작성자'] || '—'}</span>
          <div class="log-actions">
            <button class="btn-sm" onclick="editLog('incident','${inc['ID']}')">수정</button>
            <button class="btn-danger" onclick="delLog('incident','${inc['ID']}')">삭제</button>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty-msg">해당 기간 Incident 없음</div>';
}

function openIncModal(id = null) {
  editId = id;
  const inc = id ? incidents.find(i => i['ID'] === id) : null;
  document.getElementById('inc-date').value   = inc ? inc['날짜']   : todayISO;
  document.getElementById('inc-time').value   = inc ? inc['시간']   : new Date().toTimeString().slice(0, 5);
  document.getElementById('inc-sev').value    = inc ? inc['심각도'] : 'Minor';
  document.getElementById('inc-type').value   = inc ? inc['유형']   : '낙상';
  document.getElementById('inc-loc').value    = inc ? inc['장소']   : '';
  document.getElementById('inc-desc').value   = inc ? inc['설명']   : '';
  document.getElementById('inc-action').value = inc ? inc['조치']   : '';
  document.getElementById('inc-wit').value    = inc ? inc['목격자'] : '';
  document.getElementById('inc-doh').value    = inc ? inc['DOH보고']: '미보고';
  document.getElementById('inc-writer').value = inc ? inc['작성자'] : '';
  if (inc) { const sel = document.getElementById('inc-msel'); for (const o of sel.options) if (o.value === String(inc['멤버ID'])) o.selected = true; }
  openOv('ov-inc');
}

function saveIncident() {
  const mid = document.getElementById('inc-msel').value;
  const mem = MEMBERS.find(m => m.id === mid) || {};
  const data = {
    '날짜': gv('inc-date'), '시간': gv('inc-time'), '멤버ID': mid, '한글이름': mem.kr || '',
    '심각도': gv('inc-sev'), '유형': gv('inc-type'), '장소': gv('inc-loc'),
    '설명': gv('inc-desc'), '조치': gv('inc-action'), '목격자': gv('inc-wit'),
    'DOH보고': gv('inc-doh'), '작성자': gv('inc-writer'), '작성시각': new Date().toLocaleString('ko-KR'),
  };
  if (!data['날짜'] || !data['설명']) { alert('날짜와 내용을 입력해주세요.'); return; }
  if (editId) { const idx = incidents.findIndex(i => i['ID'] === editId); if (idx > -1) incidents[idx] = { ...incidents[idx], ...data }; }
  else        { data['ID'] = 'INC' + Date.now(); incidents.unshift(data); }
  syncLog('incident', data); saveToStorage(); closeOv('ov-inc'); renderIncidents(); updateDashNow();
}

// ── Activity ─────────────────────────────────────────────────
function renderActivities() {
  const from = document.getElementById('act-from').value;
  const to   = document.getElementById('act-to').value;
  let list   = [...activities];
  if (from) list = list.filter(a => a['날짜'] >= from);
  if (to)   list = list.filter(a => a['날짜'] <= to);
  list.sort((a, b) => (b['날짜'] || '').localeCompare(a['날짜'] || ''));

  document.getElementById('act-today').textContent   = list.filter(a => a['날짜'] === todayISO).length;
  document.getElementById('act-week').textContent    = list.filter(a => a['날짜'] >= weekAgoISO).length;
  document.getElementById('act-refused').textContent = list.filter(a => (a['참여도'] || '').includes('Refused')).length;
  document.getElementById('act-total').textContent   = list.length;

  const pBadge = v => v && v.includes('Active')
    ? '<span class="badge b-ok">✅ Active</span>'
    : v && v.includes('Passive')
    ? '<span class="badge b-warn">🔶 Passive</span>'
    : v && v.includes('Refused')
    ? '<span class="badge b-red">❌ Refused</span>'
    : '<span class="badge b-gray">—</span>';

  document.getElementById('act-list').innerHTML = list.length
    ? list.map(act => `<div class="log-card">
        <div class="log-top"><div>
          <div class="log-name"><span class="av av-xs" style="background:#E6F1FB;color:#185FA5">${(act['한글이름'] || '?')[0]}</span>${act['한글이름'] || '—'} ${pBadge(act['참여도'])}</div>
          <div class="log-date">${act['날짜']} · ${act['카테고리'] || '—'}</div>
        </div></div>
        <div class="log-body"><b>${act['활동명'] || '—'}</b>${act['메모'] ? ' — ' + act['메모'] : ''}</div>
        <div class="log-footer">
          <span class="log-meta">${act['작성자'] || '—'}</span>
          <div class="log-actions">
            <button class="btn-sm" onclick="editLog('activity','${act['ID']}')">수정</button>
            <button class="btn-danger" onclick="delLog('activity','${act['ID']}')">삭제</button>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty-msg">해당 기간 Activity 없음</div>';
}

function openActModal(id = null) {
  editId = id;
  const act = id ? activities.find(a => a['ID'] === id) : null;
  document.getElementById('act-date').value   = act ? act['날짜']    : todayISO;
  document.getElementById('act-cat').value    = act ? act['카테고리'] : '운동/신체';
  document.getElementById('act-name').value   = act ? act['활동명']  : '';
  document.getElementById('act-part').value   = act ? act['참여도']  : 'Active — 적극 참여';
  document.getElementById('act-memo').value   = act ? act['메모']    : '';
  document.getElementById('act-writer').value = act ? act['작성자']  : '';
  if (act) { const sel = document.getElementById('act-msel'); for (const o of sel.options) if (o.value === String(act['멤버ID'])) o.selected = true; }
  openOv('ov-act');
}

function saveActivity() {
  const mid = document.getElementById('act-msel').value;
  const mem = MEMBERS.find(m => m.id === mid) || {};
  const data = {
    '날짜': gv('act-date'), '멤버ID': mid, '한글이름': mem.kr || '',
    '활동명': gv('act-name'), '카테고리': gv('act-cat'), '참여도': gv('act-part'),
    '메모': gv('act-memo'), '작성자': gv('act-writer'), '작성시각': new Date().toLocaleString('ko-KR'),
  };
  if (!data['날짜'] || !data['활동명']) { alert('날짜와 활동명을 입력해주세요.'); return; }
  if (editId) { const idx = activities.findIndex(a => a['ID'] === editId); if (idx > -1) activities[idx] = { ...activities[idx], ...data }; }
  else        { data['ID'] = 'ACT' + Date.now(); activities.unshift(data); }
  syncLog('activity', data); saveToStorage(); closeOv('ov-act'); renderActivities();
}

// ── Case Log ─────────────────────────────────────────────────
function renderCases() {
  const from = document.getElementById('case-from').value;
  const to   = document.getElementById('case-to').value;
  let list   = [...cases];
  if (from) list = list.filter(c => c['날짜'] >= from);
  if (to)   list = list.filter(c => c['날짜'] <= to);
  list.sort((a, b) => (b['날짜'] || '').localeCompare(a['날짜'] || ''));

  const fu = list.filter(c => c['팔로업날짜'] && c['팔로업날짜'] <= todayISO && c['상태'] !== '완료');
  document.getElementById('case-open').textContent  = list.filter(c => c['상태'] === '진행 중').length;
  document.getElementById('case-fu').textContent    = fu.length;
  document.getElementById('case-done').textContent  = list.filter(c => c['상태'] === '완료').length;
  document.getElementById('case-total').textContent = list.length;

  const stBadge = v => v === '완료'  ? '<span class="badge b-ok">✅ 완료</span>'
                     : v === '보류'  ? '<span class="badge b-gray">⏸ 보류</span>'
                     : '<span class="badge b-coral">🔄 진행 중</span>';
  const tyBadge = v => `<span class="badge b-purple">${v || '—'}</span>`;

  document.getElementById('case-list').innerHTML = list.length
    ? list.map(c => {
        const needFu = c['팔로업날짜'] && c['팔로업날짜'] <= todayISO && c['상태'] !== '완료';
        return `<div class="log-card ${needFu ? 'followup-alert' : ''}">
          <div class="log-top"><div>
            <div class="log-name"><span class="av av-xs" style="background:#EDE9FE;color:#4C1D95">${(c['한글이름'] || '?')[0]}</span>${c['한글이름'] || '—'} ${tyBadge(c['유형'])} ${stBadge(c['상태'])}</div>
            <div class="log-date">${c['날짜']} · ${c['담당기관'] || '—'}</div>
          </div>${needFu ? '<span class="badge b-red">📅 팔로업 필요</span>' : ''}</div>
          <div class="log-body"><b>${c['제목'] || '—'}</b></div>
          ${c['내용'] ? `<div class="log-body">${c['내용']}</div>` : ''}
          ${c['결과'] ? `<div class="log-body" style="color:#1C1C1E"><b>결과:</b> ${c['결과']}</div>` : ''}
          <div class="log-footer">
            ${c['팔로업날짜'] ? `<span class="badge b-coral">📅 ${c['팔로업날짜']}</span>` : ''}
            <span class="log-meta">${c['담당자'] || '—'} · ${c['작성자'] || '—'}</span>
            <div class="log-actions">
              <button class="btn-sm" onclick="editLog('case','${c['ID']}')">수정</button>
              <button class="btn-danger" onclick="delLog('case','${c['ID']}')">삭제</button>
            </div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-msg">해당 기간 Case 없음</div>';
}

function openCaseModal(id = null) {
  editId = id;
  const c = id ? cases.find(x => x['ID'] === id) : null;
  document.getElementById('case-date').value    = c ? c['날짜']      : todayISO;
  document.getElementById('case-type').value    = c ? c['유형']      : 'Medicaid 갱신';
  document.getElementById('case-title').value   = c ? c['제목']      : '';
  document.getElementById('case-content').value = c ? c['내용']      : '';
  document.getElementById('case-agency').value  = c ? c['담당기관']   : '';
  document.getElementById('case-contact').value = c ? c['담당자']    : '';
  document.getElementById('case-followup').value = c ? c['팔로업날짜'] : '';
  document.getElementById('case-status').value  = c ? c['상태']      : '진행 중';
  document.getElementById('case-result').value  = c ? c['결과']      : '';
  document.getElementById('case-writer').value  = c ? c['작성자']    : '';
  if (c) { const sel = document.getElementById('case-msel'); for (const o of sel.options) if (o.value === String(c['멤버ID'])) o.selected = true; }
  openOv('ov-case');
}

function saveCase() {
  const mid = document.getElementById('case-msel').value;
  const mem = MEMBERS.find(m => m.id === mid) || {};
  const data = {
    '날짜': gv('case-date'), '멤버ID': mid, '한글이름': mem.kr || '',
    '유형': gv('case-type'), '제목': gv('case-title'), '내용': gv('case-content'),
    '담당기관': gv('case-agency'), '담당자': gv('case-contact'),
    '팔로업날짜': gv('case-followup'), '상태': gv('case-status'),
    '결과': gv('case-result'), '작성자': gv('case-writer'),
    '작성시각': new Date().toLocaleString('ko-KR'),
  };
  if (!data['날짜'] || !data['제목']) { alert('날짜와 제목을 입력해주세요.'); return; }
  if (editId) { const idx = cases.findIndex(c => c['ID'] === editId); if (idx > -1) cases[idx] = { ...cases[idx], ...data }; }
  else        { data['ID'] = 'CASE' + Date.now(); cases.unshift(data); }
  syncLog('caselog', data); saveToStorage(); closeOv('ov-case'); renderCases(); updateDashNow();
}

// ── 공통 수정/삭제 ────────────────────────────────────────────
function editLog(type, id) {
  if (type === 'incident') openIncModal(id);
  if (type === 'activity') openActModal(id);
  if (type === 'case')     openCaseModal(id);
}

function delLog(type, id) {
  if (!confirm('삭제하시겠습니까?')) return;
  if (type === 'incident') incidents  = incidents.filter(i => i['ID'] !== id);
  if (type === 'activity') activities = activities.filter(a => a['ID'] !== id);
  if (type === 'case')     cases      = cases.filter(c => c['ID'] !== id);
  renderIncidents(); renderActivities(); renderCases(); updateDashNow();
}

// ── Sheets 동기화 ─────────────────────────────────────────────
async function syncLog(sheet, data) {
  try {
    await SheetsAPI.post({ action: editId ? 'update' : 'append', sheet, id: editId, data });
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
// 📅 데일리 일괄 Activity 기록 — 출석 증빙용
// 출석자 전원에게 프로그램참여+식사지원 기본 체크, 예외/추가지원만 개별 조정
// ══════════════════════════════════════════════════════════════
window._dailyActAttendees = [];

async function openDailyActivityModal() {
  document.getElementById('dact-date').value = todayISO;
  document.getElementById('dact-program-name').value = 'Bingo';
  document.getElementById('dact-writer').value = '';
  document.getElementById('dact-status').textContent = '';
  document.getElementById('dact-list').innerHTML = '';
  openOv('ov-daily-act');
  await loadDailyActivityAttendees();
}

async function loadDailyActivityAttendees() {
  const iso = document.getElementById('dact-date').value || todayISO;
  const statusEl = document.getElementById('dact-status');
  const listEl = document.getElementById('dact-list');
  statusEl.textContent = '⏳ 출석자 불러오는 중...';
  listEl.innerHTML = '';

  // 해당 날짜 출결 캐시가 없으면 Sheets에서 로드
  if (typeof _attCache !== 'undefined' && !_attCache[iso] && typeof loadAttFromSheets === 'function') {
    await loadAttFromSheets(iso);
  }

  const recs = (typeof getRec === 'function') ? getRec(iso) : {};
  const attendees = MEMBERS.filter(m => {
    const r = recs[m.id];
    return r && (r.status === 'in' || r.status === 'late');
  });

  if (!attendees.length) {
    statusEl.textContent = '⚠️ 해당 날짜에 출석 기록이 없어요 (출결 탭에서 먼저 체크해주세요)';
    window._dailyActAttendees = [];
    return;
  }

  statusEl.textContent = attendees.length + '명 출석 확인됨';
  window._dailyActAttendees = attendees.map(m => m.id);

  const catBtns = [
    { cat:'program', icon:'🎨', label:'프로그램', defChecked:true },
    { cat:'meal',    icon:'🍽️', label:'식사',     defChecked:true },
    { cat:'social',  icon:'💬', label:'소셜',     defChecked:false },
    { cat:'admin',   icon:'📄', label:'서류',     defChecked:false },
    { cat:'adl',     icon:'🚿', label:'ADL',      defChecked:false },
    { cat:'etc',     icon:'📋', label:'기타',     defChecked:false },
  ];

  listEl.innerHTML = attendees.map(m => `
    <div class="log-card" style="padding:10px 12px;margin-bottom:6px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">${m.kr}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${catBtns.map(c => `
          <label style="display:flex;align-items:center;gap:3px;font-size:11px;background:#F2F2F7;border-radius:6px;padding:4px 8px;cursor:pointer">
            <input type="checkbox" class="dact-cat" data-cat="${c.cat}" data-mid="${m.id}" ${c.defChecked ? 'checked' : ''}
              ${c.defChecked ? '' : `onchange="toggleDactNote('${m.id}','${c.cat}',this)"`} style="margin:0">
            ${c.icon}${c.label}
          </label>
        `).join('')}
      </div>
      <div id="dact-notes-${m.id}"></div>
    </div>
  `).join('');
}

function toggleDactNote(mid, cat, checkbox) {
  const wrap = document.getElementById('dact-notes-' + mid);
  const noteId = 'dact-note-' + mid + '-' + cat;
  if (checkbox.checked) {
    if (!document.getElementById(noteId)) {
      const catLabel = { social:'소셜지원', admin:'서류지원', adl:'ADL지원', etc:'기타' }[cat] || '';
      const div = document.createElement('div');
      div.innerHTML = `<input class="m-input" id="${noteId}" placeholder="${catLabel} 메모 (선택)" style="font-size:12px;margin-top:4px;padding:6px 10px">`;
      wrap.appendChild(div.firstChild);
    }
  } else {
    const el = document.getElementById(noteId);
    if (el) el.remove();
  }
}

function updateDailyProgramName() { /* 저장 시점에 값 읽어서 사용, 별도 처리 불필요 */ }

function dailyActToggleAll(cat, checked) {
  document.querySelectorAll('.dact-cat[data-cat="' + cat + '"]').forEach(cb => {
    cb.checked = checked;
    if (cat !== 'program' && cat !== 'meal') toggleDactNote(cb.dataset.mid, cat, cb);
  });
}

async function saveDailyActivityLog() {
  const iso = document.getElementById('dact-date').value;
  const programName = document.getElementById('dact-program-name').value.trim() || '프로그램';
  const writer = document.getElementById('dact-writer').value.trim();
  const attendeeIds = window._dailyActAttendees || [];
  if (!attendeeIds.length) { alert('출석자가 없어요'); return; }

  const catMeta = {
    program: { label:'프로그램참여', name: programName },
    meal:    { label:'식사지원',     name:'식사 지원' },
    social:  { label:'소셜지원',     name:'소셜/정서적 지원' },
    admin:   { label:'서류지원',     name:'서류/행정 지원' },
    adl:     { label:'ADL지원',      name:'ADL 지원' },
    etc:     { label:'기타',         name:'기타 지원' },
  };

  const entries = [];
  attendeeIds.forEach(mid => {
    const mem = MEMBERS.find(m => m.id === mid) || {};
    Object.keys(catMeta).forEach(cat => {
      const cb = document.querySelector('.dact-cat[data-cat="' + cat + '"][data-mid="' + mid + '"]');
      if (cb && cb.checked) {
        const noteEl = document.getElementById('dact-note-' + mid + '-' + cat);
        const note = noteEl ? noteEl.value.trim() : '';
        entries.push({
          'ID': 'ACT' + Date.now() + '_' + mid + '_' + cat,
          '날짜': iso, '멤버ID': mid, '한글이름': mem.kr || '',
          '활동명': cat === 'program' ? programName : (note || catMeta[cat].name),
          '카테고리': catMeta[cat].label,
          '참여도': cat === 'program' ? 'Active — 적극 참여' : '',
          '메모': (cat !== 'program' && cat !== 'meal') ? note : '',
          '작성자': writer, '작성시각': new Date().toLocaleString('ko-KR'),
        });
      }
    });
  });

  if (!entries.length) { alert('선택된 항목이 없어요'); return; }

  const saveBtn = document.getElementById('dact-save-btn');
  const statusEl = document.getElementById('dact-status');
  if (saveBtn) saveBtn.disabled = true;

  for (let i = 0; i < entries.length; i++) {
    activities.unshift(entries[i]);
    try {
      await SheetsAPI.post({ action:'append', sheet:'activity', data: entries[i] });
    } catch(e) { console.log('일괄 Activity 저장 실패:', e); }
    if (statusEl) statusEl.textContent = '⏳ 저장 중... ' + (i+1) + '/' + entries.length;
    if (i % 8 === 7) await new Promise(r => setTimeout(r, 200));
  }

  if (saveBtn) saveBtn.disabled = false;
  saveToStorage();
  closeOv('ov-daily-act');
  renderActivities();
  alert('✅ ' + attendeeIds.length + '명, 총 ' + entries.length + '건 기록 완료!');
}

// ══════════════════════════════════════════════════════════════
// 🚐 배차 계획 (Dispatch Plan) — 근거리/원거리 자동 분류
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// 🚐 배차 계획 (Dispatch Plan) — 거리/방향 기반 자동 그룹핑
// ══════════════════════════════════════════════════════════════
var TAXI_CAPACITY = 7; // 택시도 미니밴형을 부를 수 있어서 정원 7명 기준
var FAR_DISTANCE_MILES = 6; // 이 거리(마일) 초과면 "원거리"로 분류
var SECTOR_NAMES = ['N','NE','E','SE','S','SW','W','NW'];

// ── 차량 목록 관리 (설정 화면에서 추가/수정/삭제 가능, localStorage에 저장) ──
function getVehicleFleet() {
  var saved = localStorage.getItem('fleet_vehicles');
  if (saved) { try { var arr = JSON.parse(saved); if (arr && arr.length) return arr; } catch(e) {} }
  // 기본값 (처음 한 번도 설정 안 했을 때)
  return [
    { label: 'Van1',     cap: 14 },
    { label: 'Van2',     cap: 14 },
    { label: 'Minivan1', cap: 7  },
  ];
}

function saveVehicleFleet(fleet) {
  localStorage.setItem('fleet_vehicles', JSON.stringify(fleet));
}

function renderVehicleFleetSettings() {
  var fleet = getVehicleFleet();
  var el = document.getElementById('fleet-list');
  if (!el) return;
  el.innerHTML = fleet.map(function(v, i) {
    return '<div class="frow" style="margin-bottom:6px;align-items:center">'
      + '<input class="fi" value="' + v.label + '" onchange="_fleetUpdate(' + i + ',\'label\',this.value)" style="font-size:12px">'
      + '<input class="fi" type="number" value="' + v.cap + '" onchange="_fleetUpdate(' + i + ',\'cap\',parseInt(this.value)||1)" style="font-size:12px;width:70px" placeholder="정원">'
      + '<button onclick="_fleetRemove(' + i + ')" style="background:#FFEBEE;color:#FF3B30;border:none;border-radius:8px;padding:8px 10px;font-size:12px;cursor:pointer">삭제</button>'
      + '</div>';
  }).join('');
}

function _fleetUpdate(idx, field, value) {
  var fleet = getVehicleFleet();
  fleet[idx][field] = value;
  saveVehicleFleet(fleet);
}

function _fleetRemove(idx) {
  var fleet = getVehicleFleet();
  if (fleet.length <= 1) { alert('차량이 최소 1대는 있어야 해요'); return; }
  if (!confirm(fleet[idx].label + ' 삭제할까요?')) return;
  fleet.splice(idx, 1);
  saveVehicleFleet(fleet);
  renderVehicleFleetSettings();
}

function _fleetAdd() {
  var fleet = getVehicleFleet();
  fleet.push({ label: '새차량' + (fleet.length + 1), cap: 14 });
  saveVehicleFleet(fleet);
  renderVehicleFleetSettings();
}

function _toRad(deg) { return deg * Math.PI / 180; }

function _haversineMiles(lat1, lng1, lat2, lng2) {
  var R = 3958.8;
  var dLat = _toRad(lat2 - lat1);
  var dLng = _toRad(lng2 - lng1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2)
    + Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _bearingDeg(lat1, lng1, lat2, lng2) {
  var y = Math.sin(_toRad(lng2 - lng1)) * Math.cos(_toRad(lat2));
  var x = Math.cos(_toRad(lat1)) * Math.sin(_toRad(lat2)) - Math.sin(_toRad(lat1)) * Math.cos(_toRad(lat2)) * Math.cos(_toRad(lng2 - lng1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function _sectorOf(bearing) { return Math.floor(((bearing + 22.5) % 360) / 45); }

// 멤버 주소 전체를 좌표로 변환 (Apps Script를 거쳐 안전하게 처리 — API 키는 서버에만 저장됨)
async function geocodeAllMemberAddresses() {
  if (!confirm('전체 멤버 주소를 좌표로 변환합니다. 이미 변환된 멤버는 건너뛰어요. 계속할까요?')) return;
  var statusEl = document.getElementById('geo-status');
  if (statusEl) statusEl.textContent = '⏳ 좌표 변환 중... (멤버 수에 따라 몇 분 걸릴 수 있어요)';
  try {
    var res = await SheetsAPI.geocodeAllMembers();
    if (res && res.ok) {
      if (statusEl) statusEl.textContent = '✅ ' + (res.data && res.data.updated || 0) + '명 좌표 변환 완료!';
      if (typeof loadFromSheets === 'function') await loadFromSheets();
      alert('좌표 변환 완료!');
    } else {
      if (statusEl) statusEl.textContent = '❌ 실패: ' + (res && res.error || '알 수 없는 오류');
    }
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ 오류: ' + e.message;
  }
}

async function _ensureCenterCoord() {
  if (window._centerCoord) return window._centerCoord;
  try {
    var res = await SheetsAPI.geocodeCenter();
    if (res && res.ok && res.data && res.data.lat != null) {
      window._centerCoord = { lat: res.data.lat, lng: res.data.lng };
    }
  } catch(e) { console.log('센터 좌표 로드 실패:', e); }
  return window._centerCoord;
}

async function generateDispatchPlan() {
  var iso = document.getElementById('disp-date').value || todayISO;
  var dow = (typeof dowKey === 'function') ? dowKey(iso) : null;
  var statusEl = document.getElementById('disp-status');
  var resultEl = document.getElementById('disp-result');
  var VEHICLES = getVehicleFleet(); // 설정 화면에서 관리하는 차량 목록
  statusEl.textContent = '⏳ 계산 중...';
  resultEl.innerHTML = '';

  var center = await _ensureCenterCoord();
  if (!center) {
    statusEl.textContent = '⚠️ 센터 좌표가 없어요. 설정 탭에서 "주소 좌표 변환"을 먼저 실행해주세요.';
    return;
  }

  // 오늘 부재(여행/입원/휴가) 예약된 멤버는 자동 제외
  var absenceMap = (typeof ABSENCE_MAP !== 'undefined') ? ABSENCE_MAP : {};

  var todayMembers = MEMBERS.filter(function(m) {
    if (!isActive(m)) return false;
    if (!dow || !(m.days || []).includes(dow)) return false;
    if (absenceMap[m.id]) return false; // 부재 예약자 제외
    return true;
  });

  if (!todayMembers.length) {
    statusEl.textContent = '⚠️ 해당 요일에 출석 예정인 멤버가 없어요';
    return;
  }

  var noCoord   = todayMembers.filter(function(m) { return m.lat == null || m.lng == null; });
  var withCoord = todayMembers.filter(function(m) { return m.lat != null && m.lng != null; });

  withCoord.forEach(function(m) {
    m._dist    = _haversineMiles(center.lat, center.lng, m.lat, m.lng);
    m._bearing = _bearingDeg(center.lat, center.lng, m.lat, m.lng);
  });

  statusEl.textContent = '총 ' + todayMembers.length + '명 출석 예정'
    + (noCoord.length ? ' · ⚠️ 좌표없음 ' + noCoord.length + '명은 배차 그룹에서 빠짐' : '');

  var farMembers  = withCoord.filter(function(m) { return m._dist > FAR_DISTANCE_MILES; });
  var nearMembers = withCoord.filter(function(m) { return m._dist <= FAR_DISTANCE_MILES; });

  // ── 클러스터링: 같은 City 이거나 1마일 이내면 하나로 묶음 (Union-Find) ──
  function _clusterMembers(members) {
    var parent = members.map(function(_, i) { return i; });
    function find(x) { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

    for (var i = 0; i < members.length; i++) {
      for (var j = i + 1; j < members.length; j++) {
        var sameCity = members[i].city && members[j].city
          && members[i].city.trim().toUpperCase() === members[j].city.trim().toUpperCase();
        var closeBy = _haversineMiles(members[i].lat, members[i].lng, members[j].lat, members[j].lng) <= 1;
        if (sameCity || closeBy) union(i, j);
      }
    }

    var groups = {};
    members.forEach(function(m, i) {
      var root = find(i);
      if (!groups[root]) groups[root] = [];
      groups[root].push(m);
    });

    return Object.values(groups).map(function(g) {
      var avgDist = g.reduce(function(s, m) { return s + m._dist; }, 0) / g.length;
      var avgBearing = g.reduce(function(s, m) { return s + m._bearing; }, 0) / g.length;
      return { members: g, dist: avgDist, bearing: avgBearing, city: g[0].city || '(주소없음)' };
    });
  }

  // 방향 → 거리순으로 정렬 (같은 방향의 가까운 클러스터부터 채움 → 남는 자리는 다음으로 가까운 방향으로 메움)
  function _sortClusters(clusters) {
    clusters.sort(function(a, b) {
      var sa = _sectorOf(a.bearing), sb = _sectorOf(b.bearing);
      if (sa !== sb) return sa - sb;
      return a.dist - b.dist;
    });
    return clusters;
  }

  var html = '';
  var taxiCounter = 0, farVehicleCounter = 0;
  var farAssignments = [];

  var farClusters = _sortClusters(_clusterMembers(farMembers));

  html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:10px 0 6px">🚕 원거리 (' + farMembers.length + '명, ' + FAR_DISTANCE_MILES + '마일 초과)</div>';
  if (!farClusters.length) {
    html += '<div class="empty-msg" style="padding:10px">원거리 멤버 없음</div>';
  } else {
    // 클러스터(같은 City/1마일 이내)를 최대한 유지한 채, 같은 방향(섹터)의 클러스터끼리만
    // 차량 정원만큼 합침. 방향이 다르면 무조건 새 차량/택시로 분리 (엉뚱한 자치구를 한 차에 몰아넣지 않도록)
    var curChunk = null, curLeft = 0, curSector = null;

    // 택시는 4명까지만 태울 수 있음 — 그 이상은 여러 대로 자동 분리
    function _pushAsTaxis(members) {
      var remaining = members.slice();
      while (remaining.length) {
        taxiCounter++;
        var chunk = remaining.splice(0, TAXI_CAPACITY);
        var cities = [];
        chunk.forEach(function(m) { var c = m.city || '(주소없음)'; if (cities.indexOf(c) === -1) cities.push(c); });
        farAssignments.push({ members: chunk, mode: 'taxi', label: '택시' + taxiCounter, cities: cities });
      }
    }

    function _closeFarChunk() {
      if (curChunk && curChunk.members.length) {
        if (curChunk.members.length <= 5) {
          _pushAsTaxis(curChunk.members); // 5명 이하는 차량 대신 택시로 — 4명 넘으면 자동으로 여러 대 분리
        } else {
          farAssignments.push(curChunk);
        }
      }
      curChunk = null; curLeft = 0; curSector = null;
    }

    farClusters.forEach(function(cluster) {
      var clusterSector = _sectorOf(cluster.bearing);
      // 방향이 다르면 지금까지 채우던 차량을 마무리하고 새로 시작
      if (curChunk && curSector !== clusterSector) _closeFarChunk();

      var remaining = cluster.members.slice();
      while (remaining.length) {
        if (!curChunk) {
          // ★ 우리 차량은 총 3대뿐(Van1, Van2, Minivan1) — 원거리(1차)엔 각 차량 딱 한 번만 배정 가능
          if (farVehicleCounter >= VEHICLES.length) {
            _pushAsTaxis(remaining.splice(0)); // 차량 소진 — 남은 인원 전부 택시로 (4명씩 분리)
            break;
          }
          var vh = VEHICLES[farVehicleCounter];
          farVehicleCounter++;
          curChunk = { members: [], mode: 'vehicle', label: vh.label, cities: [] };
          curLeft = vh.cap;
          curSector = clusterSector;
        }
        var take = remaining.splice(0, curLeft);
        curChunk.members = curChunk.members.concat(take);
        if (curChunk.cities.indexOf(cluster.city) === -1) curChunk.cities.push(cluster.city);
        curLeft -= take.length;
        if (curLeft <= 0) _closeFarChunk();
      }
    });
    _closeFarChunk(); // 마지막 청크 마무리 (5명 이하면 택시로 전환)

    farAssignments.forEach(function(g) {
      var badge = g.mode === 'taxi'
        ? '<span class="badge b-blue">🚕 ' + g.label + '</span>'
        : '<span class="badge b-warn">🚐 ' + g.label + '</span>';
      html += '<div class="log-card">'
        + '<div class="log-top"><div class="log-name">' + g.cities.join('/') + ' (' + g.members.length + '명)</div>' + badge + '</div>'
        + '<div style="font-size:12px;color:#3C3C43">' + g.members.map(function(m) { return m.kr + ' (' + (m.city||'—') + ', ' + m._dist.toFixed(1) + 'mi)'; }).join(', ') + '</div>'
        + '</div>';
    });
  }

  // ── 근거리: 같은 방식으로 클러스터링 후 차량 정원대로 채움 (택시 없이 전부 우리 차량) ──
  var nearClusters = _sortClusters(_clusterMembers(nearMembers));
  var batches = [];
  (function() {
    var curBatch = null, curLeft = 0;
    function closeBatch() {
      if (curBatch && curBatch.members.length) batches.push(curBatch);
      curBatch = null; curLeft = 0;
    }
    nearClusters.forEach(function(cluster) {
      var remaining = cluster.members.slice();
      while (remaining.length) {
        if (!curBatch) {
          var vh = VEHICLES[batches.length % VEHICLES.length];
          curBatch = { label: (batches.length + 2) + '차 (' + vh.label + ')', members: [], cap: vh.cap, cities: [] };
          curLeft = vh.cap;
        }
        var take = remaining.splice(0, curLeft);
        curBatch.members = curBatch.members.concat(take);
        if (curBatch.cities.indexOf(cluster.city) === -1) curBatch.cities.push(cluster.city);
        curLeft -= take.length;
        if (curLeft <= 0) closeBatch();
      }
    });
    closeBatch();
  })();

  window._dispatchPlan = { iso: iso, farAssignments: farAssignments, nearBatches: batches, unassigned: [] };
  if (noCoord.length) window._dispatchPlan.unassigned = window._dispatchPlan.unassigned.concat(noCoord);

  resultEl.innerHTML = '<div id="disp-editable"></div>'
    + '<div id="disp-writer-wrap" class="fg" style="margin-top:10px"><div class="fl">작성자</div><input class="m-input" id="disp-writer" placeholder="이름, 직책"></div>'
    + '<button class="btn-full btn-primary" style="margin-top:6px" onclick="saveDispatchToLog()">💾 이 배차로 로그 저장</button>';

  _renderDispatchGroups();
}

// ── 배차 결과를 사람이 직접 빼기/추가/합치기로 수정할 수 있게 그리기 ──
function _renderDispatchGroups() {
  var plan = window._dispatchPlan;
  if (!plan) return;
  var el = document.getElementById('disp-editable');
  if (!el) return;

  function memberChip(m, groupType, groupIdx) {
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:#F2F2F7;border-radius:6px;padding:2px 6px;margin:2px;font-size:11px">'
      + m.kr + ' (' + (m.city||'—') + ')'
      + ' <span onclick="_dispatchRemoveMember(\'' + groupType + '\',' + groupIdx + ',\'' + m.id + '\')" style="cursor:pointer;color:#FF3B30;font-weight:900;padding:0 2px">✕</span>'
      + '</span>';
  }

  function unassignedSelect(groupType, groupIdx) {
    if (!plan.unassigned.length) return '';
    var opts = plan.unassigned.map(function(m) { return '<option value="' + m.id + '">' + m.kr + ' (' + (m.city||'—') + ')</option>'; }).join('');
    return '<select onchange="if(this.value){_dispatchAddMember(\'' + groupType + '\',' + groupIdx + ',this.value);this.value=\'\';}" style="font-size:11px;border:1px solid #E5E5EA;border-radius:6px;padding:3px;margin-top:4px">'
      + '<option value="">+ 미배정 멤버 추가...</option>' + opts + '</select>';
  }

  var html = '';

  // ── 원거리 그룹 ──
  html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:10px 0 6px">🚕 원거리 (그룹을 직접 조정할 수 있어요)</div>';
  plan.farAssignments.forEach(function(g, i) {
    var badge = g.mode === 'taxi'
      ? '<span class="badge b-blue">🚕 ' + g.label + '</span>'
      : '<span class="badge b-warn">🚐 ' + g.label + '</span>';
    html += '<div class="log-card">'
      + '<div class="log-top">'
      + '<label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700"><input type="checkbox" class="disp-merge-far" value="' + i + '"> ' + g.cities.join('/') + ' (' + g.members.length + '명)</label>'
      + badge
      + ' <span onclick="_dispatchDeleteGroup(\'far\',' + i + ')" style="cursor:pointer;color:#FF3B30;font-size:11px;margin-left:6px">🗑️</span>'
      + '</div>'
      + '<div>' + g.members.map(function(m) { return memberChip(m, 'far', i); }).join('') + '</div>'
      + unassignedSelect('far', i)
      + (g.mode === 'vehicle' ? '<div class="frow" style="margin-top:8px;gap:6px"><input class="fi" id="disp-driver-far-' + i + '" placeholder="운전자 이름" style="font-size:12px"></div>' : '')
      + '</div>';
  });
  html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
  html += '<button class="btn-sm" style="background:#E1F5EE;color:#0F6E56" onclick="_dispatchAddNewGroup(\'far\',\'taxi\')">➕ 택시 그룹 추가</button>';
  html += '<button class="btn-sm" style="background:#FFF3E0;color:#B35900" onclick="_dispatchAddNewGroup(\'far\',\'vehicle\')">➕ 차량 그룹 추가</button>';
  if (plan.farAssignments.length > 1) {
    html += '<button class="btn-sm" style="background:#EDE9FE;color:#5856D6" onclick="_dispatchMergeChecked(\'far\')">☑️ 체크한 그룹 합치기</button>';
  }
  html += '</div>';

  // ── 근거리 배치 ──
  html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:16px 0 6px">🚐 근거리 (그룹을 직접 조정할 수 있어요)</div>';
  plan.nearBatches.forEach(function(b, i) {
    html += '<div class="log-card">'
      + '<div class="log-top">'
      + '<label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700"><input type="checkbox" class="disp-merge-near" value="' + i + '"> ' + b.label + ' — ' + b.cities.join('/') + '</label>'
      + '<span class="badge b-ok">' + b.members.length + '/' + b.cap + '명</span>'
      + ' <span onclick="_dispatchDeleteGroup(\'near\',' + i + ')" style="cursor:pointer;color:#FF3B30;font-size:11px;margin-left:6px">🗑️</span>'
      + '</div>'
      + '<div>' + b.members.map(function(m) { return memberChip(m, 'near', i); }).join('') + '</div>'
      + unassignedSelect('near', i)
      + '<div class="frow" style="margin-top:8px;gap:6px"><input class="fi" id="disp-driver-near-' + i + '" placeholder="운전자 이름" style="font-size:12px"></div>'
      + '</div>';
  });
  html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
  html += '<button class="btn-sm" style="background:#E1F5EE;color:#0F6E56" onclick="_dispatchAddNewGroup(\'near\',\'vehicle\')">➕ 차량 배치 추가</button>';
  if (plan.nearBatches.length > 1) {
    html += '<button class="btn-sm" style="background:#EDE9FE;color:#5856D6" onclick="_dispatchMergeChecked(\'near\')">☑️ 체크한 그룹 합치기</button>';
  }
  html += '</div>';

  // ── 미배정 멤버 풀 ──
  if (plan.unassigned.length) {
    html += '<div style="font-size:12px;font-weight:700;color:#FF3B30;margin:16px 0 6px">⚠️ 미배정 멤버 (' + plan.unassigned.length + '명) — 위 그룹의 드롭다운으로 추가해주세요</div>';
    html += '<div class="log-card">' + plan.unassigned.map(function(m) {
      return '<span style="display:inline-block;background:#FFEBEE;color:#FF3B30;border-radius:6px;padding:3px 8px;margin:2px;font-size:11px">' + m.kr + ' (' + (m.city||'—') + ')</span>';
    }).join('') + '</div>';
  }

  el.innerHTML = html;
}

// 멤버를 그룹에서 빼서 미배정 풀로
function _dispatchRemoveMember(groupType, groupIdx, mid) {
  var plan = window._dispatchPlan;
  var group = groupType === 'far' ? plan.farAssignments[groupIdx] : plan.nearBatches[groupIdx];
  if (!group) return;
  var idx = group.members.findIndex(function(m) { return m.id === mid; });
  if (idx === -1) return;
  var removed = group.members.splice(idx, 1)[0];
  plan.unassigned.push(removed);
  _renderDispatchGroups();
}

// 미배정 풀(또는 다른 그룹)에서 멤버를 이 그룹으로 추가
function _dispatchAddMember(groupType, groupIdx, mid) {
  var plan = window._dispatchPlan;
  var group = groupType === 'far' ? plan.farAssignments[groupIdx] : plan.nearBatches[groupIdx];
  if (!group) return;
  var idx = plan.unassigned.findIndex(function(m) { return m.id === mid; });
  if (idx === -1) return;
  var member = plan.unassigned.splice(idx, 1)[0];
  group.members.push(member);
  if (group.cities && group.cities.indexOf(member.city) === -1) group.cities.push(member.city || '(주소없음)');
  _renderDispatchGroups();
}

// 그룹 전체 삭제 — 멤버는 미배정 풀로 되돌려 보냄
function _dispatchDeleteGroup(groupType, groupIdx) {
  var plan = window._dispatchPlan;
  var arr = groupType === 'far' ? plan.farAssignments : plan.nearBatches;
  var group = arr[groupIdx];
  if (!group) return;
  if (!confirm('이 그룹을 삭제할까요? 멤버 ' + group.members.length + '명은 미배정으로 돌아가요.')) return;
  plan.unassigned = plan.unassigned.concat(group.members);
  arr.splice(groupIdx, 1);
  _renderDispatchGroups();
}

// 새 그룹(택시 또는 차량) 수동 추가 — 처음엔 빈 그룹, 드롭다운으로 멤버를 채움
function _dispatchAddNewGroup(groupType, mode) {
  var plan = window._dispatchPlan;
  if (groupType === 'far') {
    var taxiCount = plan.farAssignments.filter(function(g) { return g.mode === 'taxi'; }).length;
    var label = mode === 'taxi' ? '택시' + (taxiCount + 1) : '차량(직접추가)';
    plan.farAssignments.push({ members: [], mode: mode, label: label, cities: [] });
  } else {
    var fleet = getVehicleFleet();
    var vh = fleet[plan.nearBatches.length % fleet.length];
    plan.nearBatches.push({ label: (plan.nearBatches.length + 2) + '차 (' + vh.label + ', 직접추가)', members: [], cap: vh.cap, cities: [] });
  }
  _renderDispatchGroups();
}

// 체크한 그룹들을 하나로 합치기 (첫 번째 체크한 그룹으로 나머지를 흡수)
function _dispatchMergeChecked(groupType) {
  var plan = window._dispatchPlan;
  var checkboxClass = groupType === 'far' ? '.disp-merge-far' : '.disp-merge-near';
  var checked = Array.from(document.querySelectorAll(checkboxClass + ':checked')).map(function(el) { return parseInt(el.value); });
  if (checked.length < 2) { alert('합칠 그룹을 2개 이상 체크해주세요'); return; }
  checked.sort(function(a, b) { return a - b; });

  var arr = groupType === 'far' ? plan.farAssignments : plan.nearBatches;
  var baseIdx = checked[0];
  var base = arr[baseIdx];

  for (var i = checked.length - 1; i >= 1; i--) {
    var idx = checked[i];
    var toMerge = arr[idx];
    base.members = base.members.concat(toMerge.members);
    (toMerge.cities || []).forEach(function(c) { if (base.cities.indexOf(c) === -1) base.cities.push(c); });
    arr.splice(idx, 1); // 뒤에서부터 제거해야 인덱스 안 꼬임
  }

  var totalCap = groupType === 'near' ? base.cap : null;
  if (totalCap && base.members.length > totalCap) {
    alert('⚠️ 합친 인원(' + base.members.length + '명)이 차량 정원(' + totalCap + '명)을 넘어요. 일부는 다른 그룹으로 다시 빼주세요.');
  }

  _renderDispatchGroups();
}

async function saveDispatchToLog() {
  var plan = window._dispatchPlan;
  if (!plan) { alert('먼저 배차 계획을 생성해주세요'); return; }
  var writer = (document.getElementById('disp-writer') || {}).value.trim();
  var iso = plan.iso;
  var entries = [];

  plan.farAssignments.forEach(function(g, i) {
    if (!g.members.length) return; // 빈 그룹(수동 추가 후 안 채운 경우)은 저장 안 함
    var driver = '';
    if (g.mode === 'vehicle') {
      var driverEl = document.getElementById('disp-driver-far-' + i);
      driver = driverEl ? driverEl.value.trim() : '';
    }
    entries.push({
      'ID': 'TRP' + Date.now() + '_far_' + g.label.replace(/\s+/g, '') + '_' + i,
      '날짜': iso, '방향': '등원', '차량': g.label, '운전자': driver,
      '그룹': '원거리-' + g.cities.join('/'), '인원수': g.members.length,
      '멤버ID목록': g.members.map(function(m) { return m.id; }).join(','),
      '멤버명단': g.members.map(function(m) { return m.kr; }).join(', '),
      '메모': '', '작성자': writer, '작성시각': new Date().toLocaleString('ko-KR'),
    });
  });

  plan.nearBatches.forEach(function(b, i) {
    if (!b.members.length) return;
    var driverEl = document.getElementById('disp-driver-near-' + i);
    var driver = driverEl ? driverEl.value.trim() : '';
    entries.push({
      'ID': 'TRP' + Date.now() + '_near' + i,
      '날짜': iso, '방향': '등원', '차량': b.label, '운전자': driver,
      '그룹': '근거리-' + b.label, '인원수': b.members.length,
      '멤버ID목록': b.members.map(function(m) { return m.id; }).join(','),
      '멤버명단': b.members.map(function(m) { return m.kr; }).join(', '),
      '메모': '', '작성자': writer, '작성시각': new Date().toLocaleString('ko-KR'),
    });
  });

  if (plan.unassigned.length) {
    if (!confirm('⚠️ 미배정 멤버 ' + plan.unassigned.length + '명이 있어요. 이대로 저장할까요? (미배정 멤버는 기록되지 않아요)')) return;
  }

  if (!entries.length) { alert('저장할 배차 내용이 없어요'); return; }

  var statusEl = document.getElementById('disp-status');
  for (var i = 0; i < entries.length; i++) {
    try { await SheetsAPI.post({ action: 'append', sheet: 'transportation', data: entries[i] }); }
    catch(e) { console.log('배차 로그 저장 실패:', e); }
    statusEl.textContent = '⏳ 저장 중... ' + (i + 1) + '/' + entries.length;
    if (i % 8 === 7) await new Promise(function(r) { setTimeout(r, 200); });
  }
  statusEl.textContent = '✅ ' + entries.length + '건 저장 완료!';
  loadTransportFromSheets();
}

// ══════════════════════════════════════════════════════════════
// 🚫 당일 캔슬 — 배차됐지만 아침에 못 나오는 경우 (예외만 기록해서 용량 최소화)
// ══════════════════════════════════════════════════════════════
function filterCancelMemberList() {
  var q = (document.getElementById('cancel-msearch').value || '').toLowerCase();
  var sel = document.getElementById('cancel-msel');
  if (!sel) return;
  sel.innerHTML = '';
  MEMBERS.filter(function(m) {
    return m.status !== 'disenrolled' && (!q || (m.kr || '').includes(q) || (m.en || '').toLowerCase().includes(q));
  }).forEach(function(m) {
    var opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.kr + ' ' + (m.en || '');
    sel.appendChild(opt);
  });
}

async function saveCancelLog() {
  var sel = document.getElementById('cancel-msel');
  var mid = sel && sel.value;
  if (!mid) { alert('멤버를 선택해주세요'); return; }
  var m = MEMBERS.find(function(x) { return x.id === mid; });
  var reason = (document.getElementById('cancel-reason') || {}).value.trim();
  var iso = document.getElementById('disp-date').value || todayISO;

  var entry = {
    'ID': 'TRP' + Date.now() + '_cancel_' + mid,
    '날짜': iso, '방향': '등원', '차량': '', '운전자': '',
    '그룹': '캔슬', '인원수': 1,
    '멤버ID목록': mid, '멤버명단': m ? m.kr : mid,
    '메모': reason, '작성자': '', '작성시각': new Date().toLocaleString('ko-KR'),
  };

  try {
    await SheetsAPI.post({ action: 'append', sheet: 'transportation', data: entry });
    alert('✅ ' + (m ? m.kr : mid) + ' 당일 캔슬 기록됨');
    document.getElementById('cancel-msearch').value = '';
    document.getElementById('cancel-reason').value = '';
    filterCancelMemberList();
    loadTransportFromSheets();
  } catch(e) {
    alert('❌ 저장 실패: ' + e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// 🚐 트랜스포테이션 로그 (기록 조회)
// ══════════════════════════════════════════════════════════════
var TRANSPORT_LOG = [];

function loadTransportFromSheets() {
  apiGet({ action: 'read', sheet: 'transportation' }).then(function(res) {
    if (res && res.ok && res.data) {
      TRANSPORT_LOG = res.data;
      renderTransportLog();
    }
  }).catch(function(){});
}

function renderTransportLog() {
  var from = (document.getElementById('trp-from') || {}).value;
  var to   = (document.getElementById('trp-to')   || {}).value;
  var list = [...TRANSPORT_LOG];
  if (from) list = list.filter(function(t) { return t['날짜'] >= from; });
  if (to)   list = list.filter(function(t) { return t['날짜'] <= to; });
  list.sort(function(a, b) { return (b['날짜'] || '').localeCompare(a['날짜'] || ''); });

  var listEl = document.getElementById('trp-list');
  if (!listEl) return;
  listEl.innerHTML = list.length
    ? list.map(function(t) {
        var isCancel = t['그룹'] === '캔슬';
        var badge = isCancel
          ? '<span class="badge b-red">🚫 캔슬</span>'
          : '<span class="badge b-blue">' + (t['차량'] || '—') + ' · ' + (t['인원수'] || 0) + '명</span>';
        return '<div class="log-card">'
          + '<div class="log-top"><div class="log-name">' + (t['그룹'] || '—') + '</div>' + badge + '</div>'
          + '<div style="font-size:12px;color:#3C3C43;margin-bottom:3px">' + (t['멤버명단'] || '') + (t['메모'] ? ' — ' + t['메모'] : '') + '</div>'
          + '<div style="font-size:11px;color:#8E8E93">' + (t['날짜'] || '') + (isCancel ? '' : ' · 운전자: ' + (t['운전자'] || '—')) + '</div>'
          + '</div>';
      }).join('')
    : '<div class="empty-msg">기록 없음</div>';
}
