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
var NEAR_CITIES = ['FLUSHING','BAYSIDE','WHITESTONE','COLLEGE POINT','COLLEGE PT','FRESH MEADOWS'];
var VEHICLES = [
  { label: '15인승 #1', cap: 14 },
  { label: '15인승 #2', cap: 14 },
  { label: '7인승',     cap: 6  },
];

function _isNearCity(city) {
  var c = (city || '').trim().toUpperCase();
  return NEAR_CITIES.some(function(nc) { return c.includes(nc); });
}

function generateDispatchPlan() {
  var iso = document.getElementById('disp-date').value || todayISO;
  var dow = (typeof dowKey === 'function') ? dowKey(iso) : null;
  var statusEl = document.getElementById('disp-status');
  var resultEl = document.getElementById('disp-result');

  var todayMembers = MEMBERS.filter(function(m) {
    return isActive(m) && dow && (m.days || []).includes(dow);
  });

  if (!todayMembers.length) {
    statusEl.textContent = '⚠️ 해당 요일에 출석 예정인 멤버가 없어요';
    resultEl.innerHTML = '';
    return;
  }
  statusEl.textContent = '총 ' + todayMembers.length + '명 등원 예정';

  // 원거리 / 근거리 분류
  var farMembers = [], nearMembers = [];
  todayMembers.forEach(function(m) {
    if (_isNearCity(m.city)) nearMembers.push(m); else farMembers.push(m);
  });

  // 원거리: 도시별로 그룹핑
  var farByCity = {};
  farMembers.forEach(function(m) {
    var city = (m.city || '(주소없음)').trim();
    if (!farByCity[city]) farByCity[city] = [];
    farByCity[city].push(m);
  });

  var html = '';

  // ── 원거리 그룹 ──
  html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:10px 0 6px">🚕 원거리 (' + farMembers.length + '명)</div>';
  if (!Object.keys(farByCity).length) {
    html += '<div class="empty-msg" style="padding:10px">원거리 멤버 없음</div>';
  } else {
    Object.keys(farByCity).sort().forEach(function(city) {
      var members = farByCity[city];
      var mode = members.length <= 5 ? 'taxi' : 'vehicle';
      var badge = mode === 'taxi'
        ? '<span class="badge b-blue">🚕 택시 추천</span>'
        : '<span class="badge b-warn">🚐 차량 필요</span>';
      html += '<div class="log-card">'
        + '<div class="log-top"><div class="log-name">' + city + ' (' + members.length + '명)</div>' + badge + '</div>'
        + '<div style="font-size:12px;color:#3C3C43">' + members.map(function(m){ return m.kr; }).join(', ') + '</div>'
        + '</div>';
    });
  }

  // ── 근거리: 2차/3차 차량 배정 (도시순 정렬로 인접 지역 묶기) ──
  nearMembers.sort(function(a, b) { return (a.city || '').localeCompare(b.city || ''); });
  var batches = [];
  var idx = 0;
  var vIdx = 1; // 1차는 원거리 차량 배정에 이미 쓰였다고 가정, 근거리는 2차부터 시작
  while (idx < nearMembers.length) {
    var vh = VEHICLES[batches.length % VEHICLES.length];
    var chunk = nearMembers.slice(idx, idx + vh.cap);
    batches.push({ label: (batches.length + 2) + '차 (' + vh.label + ')', members: chunk, cap: vh.cap });
    idx += vh.cap;
  }

  html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:16px 0 6px">🚐 근거리 퀸즈 (' + nearMembers.length + '명)</div>';
  if (!batches.length) {
    html += '<div class="empty-msg" style="padding:10px">근거리 멤버 없음</div>';
  } else {
    batches.forEach(function(b, i) {
      html += '<div class="log-card">'
        + '<div class="log-top"><div class="log-name">' + b.label + '</div><span class="badge b-ok">' + b.members.length + '/' + b.cap + '명</span></div>'
        + '<div style="font-size:12px;color:#3C3C43">' + b.members.map(function(m){ return m.kr + '(' + (m.city||'—') + ')'; }).join(', ') + '</div>'
        + '<div class="frow" style="margin-top:8px;gap:6px">'
        + '<input class="fi" id="disp-driver-near-' + i + '" placeholder="운전자 이름" style="font-size:12px">'
        + '</div>'
        + '</div>';
    });
  }

  // 원거리 차량 배정군 운전자 입력 (택시 제외)
  var vehicleFarCities = Object.keys(farByCity).filter(function(c){ return farByCity[c].length > 5; });
  if (vehicleFarCities.length) {
    html += '<div style="font-size:12px;font-weight:700;color:#8E8E93;margin:16px 0 6px">🚐 원거리 차량 배정 운전자</div>';
    vehicleFarCities.forEach(function(city, i) {
      html += '<div class="frow" style="margin-bottom:6px"><div style="font-size:12px;padding-top:8px">' + city + '</div>'
        + '<input class="fi" id="disp-driver-far-' + i + '" placeholder="운전자 이름" style="font-size:12px"></div>';
    });
  }

  html += '<div id="disp-writer-wrap" class="fg" style="margin-top:10px"><div class="fl">작성자</div><input class="m-input" id="disp-writer" placeholder="이름, 직책"></div>';
  html += '<button class="btn-full btn-primary" style="margin-top:6px" onclick="saveDispatchToLog()">💾 이 배차로 로그 저장</button>';

  resultEl.innerHTML = html;

  // 저장 시 사용할 데이터 임시 보관
  window._dispatchPlan = { iso: iso, farByCity: farByCity, nearBatches: batches };
}

async function saveDispatchToLog() {
  var plan = window._dispatchPlan;
  if (!plan) { alert('먼저 배차 계획을 생성해주세요'); return; }
  var writer = (document.getElementById('disp-writer') || {}).value.trim();
  var iso = plan.iso;
  var entries = [];

  // 원거리 — 택시/차량
  Object.keys(plan.farByCity).forEach(function(city, ci) {
    var members = plan.farByCity[city];
    var mode = members.length <= 5 ? '택시' : '차량';
    var driverEl = document.getElementById('disp-driver-far-' + ci);
    var driver = mode === '차량' && driverEl ? driverEl.value.trim() : '';
    members.forEach(function(m) {
      entries.push({
        'ID': 'TRP' + Date.now() + '_' + m.id + '_far',
        '날짜': iso, '멤버ID': m.id, '한글이름': m.kr,
        '방향': '등원', '차량': mode, '운전자': driver,
        '그룹': '원거리-' + city, '메모': '',
        '작성자': writer, '작성시각': new Date().toLocaleString('ko-KR'),
      });
    });
  });

  // 근거리 — 2차/3차 배치
  plan.nearBatches.forEach(function(b, i) {
    var driverEl = document.getElementById('disp-driver-near-' + i);
    var driver = driverEl ? driverEl.value.trim() : '';
    b.members.forEach(function(m) {
      entries.push({
        'ID': 'TRP' + Date.now() + '_' + m.id + '_near',
        '날짜': iso, '멤버ID': m.id, '한글이름': m.kr,
        '방향': '등원', '차량': b.label, '운전자': driver,
        '그룹': '근거리', '메모': '',
        '작성자': writer, '작성시각': new Date().toLocaleString('ko-KR'),
      });
    });
  });

  if (!entries.length) { alert('저장할 배차 내용이 없어요'); return; }

  var statusEl = document.getElementById('disp-status');
  for (var i = 0; i < entries.length; i++) {
    try { await SheetsAPI.post({ action:'append', sheet:'transportation', data: entries[i] }); }
    catch(e) { console.log('배차 로그 저장 실패:', e); }
    statusEl.textContent = '⏳ 저장 중... ' + (i+1) + '/' + entries.length;
    if (i % 8 === 7) await new Promise(function(r){ setTimeout(r, 200); });
  }
  statusEl.textContent = '✅ ' + entries.length + '건 저장 완료!';
  loadTransportFromSheets();
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
  if (from) list = list.filter(function(t){ return t['날짜'] >= from; });
  if (to)   list = list.filter(function(t){ return t['날짜'] <= to; });
  list.sort(function(a, b){ return (b['날짜']||'').localeCompare(a['날짜']||''); });

  var listEl = document.getElementById('trp-list');
  if (!listEl) return;
  listEl.innerHTML = list.length
    ? list.map(function(t) {
        return '<div class="log-card">'
          + '<div class="log-top"><div class="log-name">' + (t['한글이름']||'—') + '</div>'
          + '<span class="badge b-blue">' + (t['차량']||'—') + '</span></div>'
          + '<div style="font-size:12px;color:#3C3C43">' + (t['날짜']||'') + ' · ' + (t['그룹']||'') + ' · 운전자: ' + (t['운전자']||'—') + '</div>'
          + '</div>';
      }).join('')
    : '<div class="empty-msg">기록 없음</div>';
}
