// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 대시보드 & 보고서
// apps/dashboard.js
// ══════════════════════════════════════════════════════════════

// ── 대시보드 ─────────────────────────────────────────────────
function updateDashNow() {
  const dc = MEMBERS.filter(m => !isActive(m)).length;
  const el = document.getElementById('ds-dis'); if (el) el.textContent = dc;

  const iso  = todayISO, dow = dowKey(iso);
  const list = MEMBERS.filter(m => m.days.includes(dow));
  const recs = getRec(iso);
  let inC = 0, trC = 0, hC = 0;
  list.forEach(m => {
    const s = (recs[m.id] || {}).status || '';
    if (s === 'in' || s === 'late') inC++;
    if (s === 'travel')   trC++;
    if (s === 'hospital') hC++;
  });
  document.getElementById('ds-in').textContent       = inC;
  document.getElementById('ds-travel').textContent   = trC;
  document.getElementById('ds-hospital').textContent = hC;
  document.getElementById('day-count').textContent   = '출석 ' + inC + '명';
}

function updateCertAlert() {
  const el = document.getElementById('ds-cert-alert'); if (!el) return;
  const expired = [], soon = [];
  (STAFF.length ? STAFF : DEFAULT_STAFF).forEach(s => {
    (s.certs || []).forEach(c => {
      if (!c.exp) return;
      const diff = Math.floor((new Date(c.exp) - new Date(todayISO)) / 86400000);
      if (diff < 0)    expired.push({ staff: s.nameKr || s.name || '', cert: c.name });
      else if (diff <= 90) soon.push({ staff: s.nameKr || s.name || '', cert: c.name, diff });
    });
  });
  if (!expired.length && !soon.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  let html = '';
  if (expired.length) html += '<div class="card" style="border:1.5px solid #FF3B30;padding:10px 14px;margin-bottom:6px;cursor:pointer" onclick="window.location.href=\'operations.html\'">'
    + '<div style="font-size:13px;font-weight:700;color:#900">❌ 만료된 자격증 ' + expired.length + '건</div>'
    + expired.slice(0, 3).map(x => '<div style="font-size:11px;color:#3C3C43;margin-top:3px">' + x.staff + ' · ' + x.cert + '</div>').join('')
    + (expired.length > 3 ? '<div style="font-size:11px;color:#8E8E93">외 ' + (expired.length - 3) + '건...</div>' : '')
    + '</div>';
  if (soon.length) html += '<div class="card" style="border:1.5px solid #FF9500;padding:10px 14px;cursor:pointer" onclick="window.location.href=\'operations.html\'">'
    + '<div style="font-size:13px;font-weight:700;color:#B35900">⚠️ 90일내 만료 자격증 ' + soon.length + '건</div>'
    + soon.slice(0, 3).map(x => '<div style="font-size:11px;color:#3C3C43;margin-top:3px">' + x.staff + ' · ' + x.cert + ' (' + x.diff + '일)</div>').join('')
    + (soon.length > 3 ? '<div style="font-size:11px;color:#8E8E93">외 ' + (soon.length - 3) + '건...</div>' : '')
    + '</div>';
  el.innerHTML = html;
}

function renderDash() {
  updateDashNow();

  const fu = cases.filter(c => c['팔로업날짜'] && c['팔로업날짜'] <= todayISO && c['상태'] !== '완료');
  document.getElementById('ds-fu').textContent = fu.length;

  const thisMonth = todayISO.slice(0, 7);
  const si = incidents.filter(i => i['날짜'] && i['날짜'].slice(0, 7) === thisMonth && i['심각도'] === 'Serious');
  document.getElementById('ds-inc').textContent = si.length;

  if (typeof updateCertAlert === 'function') updateCertAlert();

  const iso  = todayISO, dow = dowKey(iso);
  const list = MEMBERS.filter(m => m.days.includes(dow));
  const recs = getRec(iso);

  const html = list.slice(0, 8).map(m => {
    const r = recs[m.id] || {}, s = r.status || '';
    return `<div class="att-row" style="flex-direction:row;align-items:center;gap:9px;padding:10px 14px">
      <div class="av av-sm" style="background:${m.avBg};color:${m.avColor}">${m.kr[0]}</div>
      <div style="flex:1">
        <div class="att-name">${m.kr}</div>
        <div class="att-id">${insBadge(m.ins || 'Anthem_MLTC')} ${statusBadge(m)} ${r.memo || ''}</div>
      </div>
      ${badgeHTML(s)}
    </div>`;
  }).join('');
  document.getElementById('dash-list').innerHTML = html || '<div class="empty-msg">출결 기록 없음</div>';

  const fuHtml = fu.slice(0, 3).map(c =>
    `<div class="log-card" style="margin-bottom:6px">
      <div style="font-size:13px;font-weight:600">${c['한글이름'] || '—'} <span class="badge b-red">팔로업 필요</span></div>
      <div style="font-size:12px;color:#3C3C43;margin-top:3px">${c['제목'] || ''} · ${c['유형'] || ''}</div>
    </div>`).join('');
  document.getElementById('dash-fu-list').innerHTML = fuHtml || '<div class="empty-msg">팔로업 없음</div>';
}

// ── Auth 알림 ─────────────────────────────────────────────────
function updateAuthAlert(soon, expired) {
  const el = document.getElementById('ds-auth-alert'); if (!el) return;
  if (soon === 0 && expired === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  let html = '';
  if (expired > 0) html += '<div class="card" style="border:1.5px solid #FF3B30;padding:10px 14px;cursor:pointer" onclick="goTab(\'authorization\',document.querySelector(\'.tab[onclick*=authorization]\'))">'
    + '<span style="font-size:13px;font-weight:700;color:#900">❌ 만료된 Auth ' + expired + '건</span>'
    + '<span style="font-size:11px;color:#8E8E93;margin-left:8px">→ 갱신 필요</span></div>';
  if (soon > 0) html += '<div class="card" style="border:1.5px solid #FF9500;padding:10px 14px;cursor:pointer;margin-top:6px" onclick="goTab(\'authorization\',document.querySelector(\'.tab[onclick*=authorization]\'))">'
    + '<span style="font-size:13px;font-weight:700;color:#B35900">⚠️ 30일내 만료 Auth ' + soon + '건</span>'
    + '<span style="font-size:11px;color:#8E8E93;margin-left:8px">→ 확인하세요</span></div>';
  el.innerHTML = html;
}

// ── 보고서 ────────────────────────────────────────────────────
function renderReport() {
  const from = document.getElementById('rpt-from').value || weekAgoISO;
  const to   = document.getElementById('rpt-to').value   || todayISO;

  let attRows = '', attTotal = 0, attPresent = 0;
  for (let iso = from; iso <= to; iso = nextDay(iso)) {
    const dow  = dowKey(iso);
    const list = MEMBERS.filter(m => m.days.includes(dow));
    if (!list.length) continue;
    const recs    = getRec(iso);
    const present = list.filter(m => { const s = (recs[m.id] || {}).status || ''; return s === 'in' || s === 'late'; }).length;
    attTotal   += list.length;
    attPresent += present;
    attRows += `<div class="report-row"><span class="report-lbl">${fmtD(iso)}</span><span class="report-val">${present} / ${list.length}명</span></div>`;
  }
  document.getElementById('rpt-att-rate').textContent = attTotal ? Math.round(attPresent / attTotal * 100) + '%' : '—';
  document.getElementById('rpt-att-body').innerHTML   = attRows || '<div class="report-row"><span class="report-lbl">데이터 없음</span><span></span></div>';

  const incList  = incidents.filter(i => i['날짜'] && i['날짜'] >= from && i['날짜'] <= to);
  document.getElementById('rpt-inc-count').textContent   = incList.length;
  document.getElementById('rpt-inc-serious').textContent = incList.filter(i => i['심각도'] === 'Serious').length;

  const caseList = cases.filter(c => c['날짜'] && c['날짜'] >= from && c['날짜'] <= to);
  document.getElementById('rpt-case-count').textContent = caseList.length;
  document.getElementById('rpt-case-done').textContent  = caseList.filter(c => c['상태'] === '완료').length;
}

function printReport() { window.print(); }
