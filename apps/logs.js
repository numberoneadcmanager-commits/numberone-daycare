// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 로그 (Incident / Activity / Case)
// apps/logs.js
// ══════════════════════════════════════════════════════════════

// ── 탭 전환 ──────────────────────────────────────────────────
function showLog(tab) {
  ['incident','activity','caselog'].forEach(t => {
    document.getElementById('lv-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('ltab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'incident') renderIncidents();
  if (tab === 'activity') renderActivities();
  if (tab === 'caselog')  renderCases();
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
