// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — Authorization 관리 v2
// apps/auth.js
// ══════════════════════════════════════════════════════════════

// ── 상태 계산 ────────────────────────────────────────────────
function authStatus(endDate, manualStatus) {
  if (manualStatus && manualStatus !== 'Active') return manualStatus.toLowerCase();
  if (!endDate) return 'active';
  var today = new Date(); today.setHours(0,0,0,0);
  var diff  = Math.floor((new Date(endDate + 'T00:00:00') - today) / 86400000);
  if (diff < 0)   return 'expired';
  if (diff <= 30) return 'soon';
  return 'active';
}

function authStatusBadge(a) {
  var s    = authStatus(a.endDate, a.status);
  var diff = Math.floor((new Date((a.endDate||'')+'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
  if (s === 'hold')     return '<span class="badge b-warn">⏸️ Hold</span>';
  if (s === 'modified') return '<span class="badge b-warn">🔄 Modified</span>';
  if (s === 'expired')  return '<span class="badge b-red">❌ 만료됨</span>';
  if (s === 'soon')     return '<span class="badge b-warn">⚠️ ' + diff + '일 후 만료</span>';
  return '<span class="badge b-ok">✅ 유효 (' + diff + '일)</span>';
}

// ── 서비스코드 자동 설정 ─────────────────────────────────────
function autoServiceCode() {
  var ins  = (document.getElementById('auth-insurer')     || {}).value || '';
  var type = (document.getElementById('auth-service-type')|| {}).value || '';
  var code = '';
  if (type === 'SDC') {
    code = ins.toLowerCase().includes('senior whole') ? 'S5102' : 'S5105';
  } else if (type === 'Transportation') {
    code = ins.toLowerCase().includes('centerlight') ? 'T2003' : 'A0100';
  }
  var el = document.getElementById('auth-service-code');
  if (el) el.value = code;
}

// ── 필터 ─────────────────────────────────────────────────────
var _authFilter = 'all';
function setAuthFilter(f, el) {
  _authFilter = f;
  document.querySelectorAll('#panel-authorization .fpill').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active');
  renderAuthList();
}

// ── 렌더링 ───────────────────────────────────────────────────
function renderAuthList() {
  var q    = ((document.getElementById('auth-search') || {}).value || '').toLowerCase();
  var list = AUTH_LIST.filter(function(a) {
    var m     = MEMBERS.find(function(x){ return x.id === a.memberId; });
    var name  = m ? (m.kr + ' ' + m.en) : '';
    var match = !q || name.toLowerCase().includes(q) || (a.authNo || '').includes(q);
    var s     = authStatus(a.endDate, a.status);
    return match && (_authFilter === 'all' || _authFilter === s);
  });

  // 통계
  var counts = { active:0, hold:0, soon:0, expired:0 };
  AUTH_LIST.forEach(function(a) {
    var s = authStatus(a.endDate, a.status);
    if (counts[s] !== undefined) counts[s]++;
    else counts.active++;
  });
  var el;
  el = document.getElementById('auth-active'); if (el) el.textContent = counts.active;
  el = document.getElementById('auth-soon');   if (el) el.textContent = counts.soon;
  el = document.getElementById('auth-exp');    if (el) el.textContent = counts.expired;
  el = document.getElementById('auth-hold');   if (el) el.textContent = counts.hold;

  updateAuthAlert(counts.soon, counts.expired);

  // 만료일 오름차순 정렬
  list.sort(function(a, b) { return (a.endDate || '') < (b.endDate || '') ? -1 : 1; });

  var html = '';
  if (!list.length) { html = '<div class="empty-msg">Auth 기록이 없어요</div>'; }

  list.forEach(function(a) {
    var m      = MEMBERS.find(function(x){ return x.id === a.memberId; });
    var mname  = m ? (m.kr + ' ' + m.en) : '(알 수 없음)';
    var s      = authStatus(a.endDate, a.status);
    var border = s === 'expired' ? 'border:1.5px solid #FF3B30' :
                 s === 'soon'    ? 'border:1.5px solid #FF9500' :
                 s === 'hold'    ? 'border:1.5px solid #5856D6' : '';

    // 출석요일 vs Auth요일 불일치 체크
    var dayWarn = '';
    if (m && m.days && a.serviceType === 'SDC') {
      var authDays = [];
      if (a.dayMon !== '0') authDays.push('Mon');
      if (a.dayTue !== '0') authDays.push('Tue');
      if (a.dayWed !== '0') authDays.push('Wed');
      if (a.dayThu !== '0') authDays.push('Thu');
      if (a.dayFri !== '0') authDays.push('Fri');
      var mDays = m.days.filter(function(d){ return ['Mon','Tue','Wed','Thu','Fri'].includes(d); });
      var mismatch = authDays.some(function(d){ return !mDays.includes(d); }) ||
                     mDays.some(function(d){ return !authDays.includes(d); });
      if (mismatch && authDays.length > 0) dayWarn = ' <span style="color:#FF3B30;font-size:10px">⚠️ 출석요일 불일치</span>';
    }

    // 요일 표시
    var dayStr = '';
    var hasDays = ['Mon','Tue','Wed','Thu','Fri'].some(function(d){ return (a['day'+d]||'0') !== '0'; });
    if (hasDays) {
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d) {
        var val = a['day'+d] || '0';
        if (val !== '0') dayStr += '<span style="background:#E6F1FB;color:#185FA5;border-radius:5px;padding:1px 5px;font-size:10px;font-weight:700;margin-right:2px">' + d + (val !== '1' ? '×'+val : '') + '</span>';
      });
    } else if (a.freqPerWeek) {
      dayStr += '<span style="background:#F2F2F7;color:#8E8E93;border-radius:5px;padding:1px 6px;font-size:10px;margin-right:2px">주 ' + a.freqPerWeek + '회 (요일 미지정)</span>';
    }

    html += '<div class="log-card" style="' + border + '">'
      + '<div class="log-top"><div class="log-name">' + mname + '</div>' + authStatusBadge(a) + '</div>'
      + '<div style="font-size:12px;color:#3C3C43;margin:4px 0"><b>' + (a.insurer||'') + '</b>'
      + ' &nbsp;·&nbsp; <b>' + (a.serviceType||'') + '</b>'
      + ' &nbsp;·&nbsp; Auth#: <b>' + (a.authNo||'—') + '</b>'
      + ' &nbsp;·&nbsp; ' + (a.serviceCode||'') + '</div>'
      + '<div style="font-size:11px;color:#8E8E93">'
      + (a.startDate||'') + ' ~ ' + (a.endDate||'')
      + (a.totalQty ? ' &nbsp;·&nbsp; 총 <b>' + a.totalQty + '</b>' + (a.qtyUnit||'') : '')
      + (a.freqPerWeek ? ' &nbsp;·&nbsp; 주 <b>' + a.freqPerWeek + '</b>회' : '')
      + '</div>'
      + (dayStr ? '<div style="margin-top:4px">' + dayStr + dayWarn + '</div>' : '')
      + (a.careManager ? '<div style="font-size:11px;color:#8E8E93;margin-top:3px">케어매니저: ' + a.careManager + '</div>' : '')
      + (a.note ? '<div style="font-size:11px;color:#D85A30;margin-top:3px">📝 ' + a.note + '</div>' : '')
      + '<div class="log-actions" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="btn-sm" onclick="editAuth(\'' + a.id + '\')">✏️ 수정</button>'
      + '<button class="btn-sm" onclick="changeAuthStatus(\'' + a.id + '\')" style="background:#EDE9FE;color:#5856D6">● 상태</button>'
      + (a.pdfLink ? '<button class="btn-sm" onclick="window.open(\'' + a.pdfLink + '\',\'_blank\')" style="background:#E1F5EE;color:#0F6E56">📄 PDF</button>' : '')
      + '<button class="btn-danger" onclick="deleteAuth(\'' + a.id + '\')">삭제</button>'
      + '</div></div>';
  });

  var el4 = document.getElementById('auth-list'); if (el4) el4.innerHTML = html;
}

// ── 상태 변경 ─────────────────────────────────────────────────
function changeAuthStatus(id) {
  var a = AUTH_LIST.find(function(x){ return x.id === id; });
  if (!a) return;
  var options = ['Active', 'Hold', 'Modified', 'Expired'];
  var current = a.status || 'Active';
  var next = options[(options.indexOf(current) + 1) % options.length];
  if (!confirm(current + ' → ' + next + ' 로 변경하시겠어요?')) return;
  a.status = next;
  SheetsAPI.saveAuth(a, true).catch(function(e){ console.log('Auth status:', e); });
  renderAuthList();
}

// ── Auth 모달 ─────────────────────────────────────────────────
function openAuthModal(id) {
  document.getElementById('auth-modal-title').textContent = id ? '✏️ Auth 수정' : '➕ Auth 추가';
  document.getElementById('auth-edit-id').value = id || '';
  document.getElementById('auth-member-search').value = '';
  document.getElementById('auth-number').value     = '';
  document.getElementById('auth-start').value      = '';
  document.getElementById('auth-end').value        = '';
  document.getElementById('auth-total-qty').value  = '';
  document.getElementById('auth-freq').value       = '';
  document.getElementById('auth-care-mgr').value   = '';
  document.getElementById('auth-note').value       = '';
  document.getElementById('auth-pdf-link').value   = '';
  document.getElementById('auth-pdf-status').textContent = '';
  ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
    var el = document.getElementById('auth-day-'+d.toLowerCase()); if(el) el.value = '0';
  });
  filterAuthMemberList();

  if (id) {
    var a = AUTH_LIST.find(function(x){ return x.id === id; });
    if (a) {
      document.getElementById('auth-insurer').value       = a.insurer || 'Anthem MLTC';
      document.getElementById('auth-service-type').value  = a.serviceType || 'SDC';
      document.getElementById('auth-service-code').value  = a.serviceCode || '';
      document.getElementById('auth-qty-unit').value      = a.qtyUnit || 'Day';
      document.getElementById('auth-status-sel').value    = a.status || 'Active';
      document.getElementById('auth-number').value        = a.authNo || '';
      document.getElementById('auth-start').value         = toDisplayDate(a.startDate || '');
      document.getElementById('auth-end').value           = toDisplayDate(a.endDate   || '');
      document.getElementById('auth-total-qty').value     = a.totalQty || '';
      document.getElementById('auth-freq').value          = a.freqPerWeek || '';
      document.getElementById('auth-care-mgr').value      = a.careManager || '';
      document.getElementById('auth-note').value          = a.note || '';
      document.getElementById('auth-pdf-link').value      = a.pdfLink || '';
      if (a.pdfLink) document.getElementById('auth-pdf-status').textContent = '✅ PDF 첨부됨';
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
        var el = document.getElementById('auth-day-'+d.toLowerCase());
        if(el) el.value = a['day'+d] || '0';
      });
      filterAuthMemberList();
      document.getElementById('auth-member-sel').value = a.memberId;
      var selEl = document.getElementById('auth-member-selected');
      if (selEl) { selEl.style.display='block'; selEl.textContent='✅ ' + (MEMBERS.find(function(x){return x.id===a.memberId;})||{kr:a.memberId}).kr; }
    }
  }
  openOv('ov-auth');
}

function filterAuthMemberList() {
  var q   = ((document.getElementById('auth-member-search') || {}).value || '').toLowerCase();
  var sel = document.getElementById('auth-member-sel');
  if (!sel) return;
  sel.innerHTML = '';
  MEMBERS.filter(function(m){ return m.status !== 'disenrolled' && (!q || (m.kr||'').includes(q) || (m.en||'').toLowerCase().includes(q)); })
    .forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = (m.kr||'') + ' ' + (m.en||'');
      sel.appendChild(opt);
    });
  sel.onchange = function() {
    var selEl = document.getElementById('auth-member-selected');
    var selected = sel.options[sel.selectedIndex];
    if (selEl && selected) { selEl.style.display='block'; selEl.textContent='✅ '+selected.textContent; }
    // 멤버 출석요일 자동 반영
    var m = MEMBERS.find(function(x){ return x.id===sel.value; });
    if (m && m.days) {
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
        var el = document.getElementById('auth-day-'+d.toLowerCase());
        if (el) el.value = m.days.includes(d) ? '1' : '0';
      });
    }
  };
  var selEl = document.getElementById('auth-member-selected'); if (selEl) selEl.style.display='none';
}

// ── PDF 업로드 → Drive ────────────────────────────────────────
async function uploadAuthPDF() {
  var fileInput = document.getElementById('auth-pdf-file');
  var statusEl  = document.getElementById('auth-pdf-status');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) { alert('PDF 파일을 선택해주세요'); return; }

  var file = fileInput.files[0];
  if (!file.name.toLowerCase().endsWith('.pdf')) { alert('PDF 파일만 업로드 가능해요'); return; }

  var selVal  = (document.getElementById('auth-member-sel') || {}).value || '';
  var m       = MEMBERS.find(function(x){ return x.id===selVal; });
  var mName   = m ? m.kr : 'Unknown';
  var authNo  = (document.getElementById('auth-number') || {}).value || 'AUTH';

  statusEl.textContent = '⏳ Drive에 업로드 중...';

  try {
    var base64 = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result.split(',')[1]); };
      reader.onerror = function() { reject(new Error('파일 읽기 실패')); };
      reader.readAsDataURL(file);
    });

    var res = await SheetsAPI.call({
      action:     'savePDF',
      memberId:   selVal || 'auth',
      memberName: mName,
      fileType:   'Auth_' + authNo,
      base64Data: base64,
      author:     (_currentUser && _currentUser.name) || 'Staff',
    });

    if (res && res.ok && res.data && res.data.url) {
      document.getElementById('auth-pdf-link').value = res.data.url;
      statusEl.textContent = '✅ PDF 업로드 완료! (' + mName + ')';
    } else {
      statusEl.textContent = '❌ 업로드 실패 — Drive 권한 확인 필요';
      console.error('savePDF 응답:', res);
    }
  } catch(e) {
    statusEl.textContent = '❌ 오류: ' + e.message;
  }
}

// ── AI 자동읽기 ───────────────────────────────────────────────
async function aiReadAuthPDF() {
  var fileInput = document.getElementById('auth-pdf-file');
  var statusEl  = document.getElementById('auth-pdf-status');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) { alert('PDF 파일을 먼저 선택해주세요'); return; }

  statusEl.textContent = '⏳ AI가 Auth 정보 읽는 중...';

  try {
    var file = fileInput.files[0];
    var base64 = await new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    var prompt = 'This is an insurance authorization PDF. Extract info and return ONLY JSON with these keys:\n'
      + '{\n'
      + '  "authNo": "authorization number",\n'
      + '  "memberName": "member last name, first name",\n'
      + '  "medicaidId": "medicaid number",\n'
      + '  "insurer": "insurance company name (Anthem/Centerlight/Senior Whole Health)",\n'
      + '  "serviceType": "SDC or Transportation",\n'
      + '  "serviceCode": "procedure code: S5105 S5102 T2003 A0100",\n'
      + '  "startDate": "YYYY-MM-DD",\n'
      + '  "endDate": "YYYY-MM-DD",\n'
      + '  "totalQty": "number only",\n'
      + '  "qtyUnit": "Day or Trip",\n'
      + '  "freqPerWeek": "trips or days per week as number",\n'
      + '  "daysSpecified": true or false (true only if specific days Mon/Tue/etc are listed),\n'
      + '  "dayMon": "number of units on Monday (0 if not approved, 1 for SDC, 2 for round-trip transport). Use 0 if days not specified",\n'
      + '  "dayTue": "same as dayMon",\n'
      + '  "dayWed": "same as dayMon",\n'
      + '  "dayThu": "same as dayMon",\n'
      + '  "dayFri": "same as dayMon",\n'
      + '  "status": "Active or Hold",\n'
      + '  "careManager": "care manager name or empty string"\n'
      + '}\n'
      + 'IMPORTANT: If only total weekly frequency is given (e.g. "8 per week") without specific day breakdown, set daysSpecified=false and all day values to 0.\n'
      + 'Return only JSON, no explanation.';

    // Apps Script 경유 (CORS 우회)
    var res = await SheetsAPI.post({
      action: 'aiReadAuth',
      base64Data: base64,
      prompt: prompt
    });

    if (!res || !res.ok || !res.data || !res.data.success) {
      throw new Error(res && res.data && res.data.error ? res.data.error : 'Apps Script 오류');
    }
    var data = res.data.result;

    // 폼에 자동 채우기
    if (data.authNo)      document.getElementById('auth-number').value    = data.authNo;
    if (data.startDate)   document.getElementById('auth-start').value     = toDisplayDate(data.startDate);
    if (data.endDate)     document.getElementById('auth-end').value       = toDisplayDate(data.endDate);
    if (data.totalQty)    document.getElementById('auth-total-qty').value = data.totalQty;
    if (data.freqPerWeek) document.getElementById('auth-freq').value      = data.freqPerWeek;
    if (data.careManager) document.getElementById('auth-care-mgr').value  = data.careManager;
    if (data.serviceType) document.getElementById('auth-service-type').value = data.serviceType;
    if (data.serviceCode) document.getElementById('auth-service-code').value = data.serviceCode;
    if (data.qtyUnit)     document.getElementById('auth-qty-unit').value  = data.qtyUnit;
    if (data.status)      document.getElementById('auth-status-sel').value = data.status;

    // 요일 — 미지정이면 0으로, 지정이면 해당값
    var daysSpecified = data.daysSpecified !== false; // 기본 true
    ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d) {
      var el = document.getElementById('auth-day-'+d.toLowerCase());
      if (el) el.value = daysSpecified && data['day'+d] !== undefined ? String(data['day'+d]) : '0';
    });

    // 요일 미지정인 경우 모두 0으로 재설정
    if (data.daysSpecified === false || data.daysSpecified === 'false') {
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
        var el = document.getElementById('auth-day-'+d.toLowerCase());
        if (el) el.value = '0';
      });
      statusEl.textContent = '✅ AI 읽기 완료 (요일 미지정 — 주 '+data.freqPerWeek+'회로만 표시)';
    }
    // 미지정인 경우 안내
    if (!daysSpecified) {
      statusEl.textContent = '✅ AI 읽기 완료! ⚠️ 요일 미지정 — 멤버 출석요일 기준으로 직접 입력하세요.';
    }

    // 보험사 매핑
    if (data.insurer) {
      var ins = data.insurer.toLowerCase();
      var sel = document.getElementById('auth-insurer');
      if (sel) {
        if (ins.includes('centerlight') || ins.includes('cl ')) sel.value = 'Centerlight PACE';
        else if (ins.includes('senior whole') || ins.includes('swh') || ins.includes('molina')) sel.value = 'Senior Whole Health';
        else if (ins.includes('anthem')) sel.value = 'Anthem MLTC';
      }
    }

    // 멤버 자동 매칭 (Medicaid ID로)
    if (data.medicaidId) {
      var matched = MEMBERS.find(function(x){ return (x.medicaid||'').toUpperCase() === data.medicaidId.toUpperCase(); });
      if (matched) {
        filterAuthMemberList();
        document.getElementById('auth-member-sel').value = matched.id;
        var selEl = document.getElementById('auth-member-selected');
        if (selEl) { selEl.style.display='block'; selEl.textContent='✅ '+matched.kr+' (자동매칭)'; }
      }
    }

    statusEl.textContent = '✅ AI 읽기 완료! 내용 확인 후 저장하세요.';
  } catch(e) {
    statusEl.textContent = '❌ AI 읽기 실패: ' + e.message;
    console.error('AI Auth read:', e);
  }
}

// ── 저장 ─────────────────────────────────────────────────────
async function saveAuth() {
  var sel      = document.getElementById('auth-member-sel');
  var memberId = sel && sel.value ? sel.value : '';
  var authNo   = (document.getElementById('auth-number')    || {}).value.trim();
  var startRaw = (document.getElementById('auth-start')     || {}).value.trim();
  var endRaw   = (document.getElementById('auth-end')       || {}).value.trim();

  if (!memberId) { alert('멤버를 선택해주세요'); return; }
  if (!authNo)   { alert('Auth# 을 입력해주세요'); return; }
  if (!startRaw || !endRaw) { alert('시작일과 종료일을 입력해주세요'); return; }

  var startDate = parseDate(startRaw);
  var endDate   = parseDate(endRaw);
  if (!startDate || !endDate) { alert('날짜 형식이 맞지 않아요 (MM/DD/YYYY)'); return; }

  var editId = (document.getElementById('auth-edit-id') || {}).value;

  function gv(id) { var el=document.getElementById(id); return el?el.value.trim():''; }

  var entry = {
    id:          editId || ('auth_' + Date.now()),
    memberId:    memberId,
    insurer:     gv('auth-insurer'),
    authNo:      authNo,
    serviceType: gv('auth-service-type'),
    serviceCode: gv('auth-service-code'),
    startDate:   startDate,
    endDate:     endDate,
    totalQty:    gv('auth-total-qty'),
    qtyUnit:     gv('auth-qty-unit'),
    freqPerWeek: gv('auth-freq'),
    dayMon:      gv('auth-day-mon'),
    dayTue:      gv('auth-day-tue'),
    dayWed:      gv('auth-day-wed'),
    dayThu:      gv('auth-day-thu'),
    dayFri:      gv('auth-day-fri'),
    status:      gv('auth-status-sel'),
    careManager: gv('auth-care-mgr'),
    pdfLink:     gv('auth-pdf-link'),
    note:        gv('auth-note'),
    updatedAt:   new Date().toISOString(),
  };

  if (editId) {
    var idx = AUTH_LIST.findIndex(function(x){ return x.id === editId; });
    if (idx >= 0) AUTH_LIST[idx] = entry; else AUTH_LIST.push(entry);
  } else {
    AUTH_LIST.push(entry);
  }

  try {
    await SheetsAPI.saveAuth(entry, !!editId);
  } catch(e) { console.log('Auth Sheets sync:', e); }

  closeOv('ov-auth');
  renderAuthList();
}

function editAuth(id)   { openAuthModal(id); }

async function deleteAuth(id) {
  if (!confirm('삭제하시겠어요?')) return;
  AUTH_LIST = AUTH_LIST.filter(function(x){ return x.id !== id; });
  try { await SheetsAPI.delete('auth', id); } catch(e) {}
  renderAuthList();
}

// ── Auth 만료 경고 (대시보드용) ──────────────────────────────
function updateAuthAlert(soon, expired) {
  var el = document.getElementById('ds-auth-alert');
  if (!el) return;
  if (!soon && !expired) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  var msgs = [];
  if (expired) msgs.push('<span style="color:#FF3B30">❌ 만료 ' + expired + '건</span>');
  if (soon)    msgs.push('<span style="color:#FF9500">⚠️ 30일내 만료 ' + soon + '건</span>');
  el.innerHTML = '🔑 Auth 알림: ' + msgs.join(' &nbsp;·&nbsp; ')
    + ' &nbsp;<a href="#" onclick="goTab(\'authorization\',null);return false;" style="font-size:11px;color:#185FA5">확인 →</a>';
}

// ── 요일 자동채우기 ───────────────────────────────────────────
function autoFillAuthDays(mode) {
  var sel = document.getElementById('auth-member-sel');
  var mid = sel ? sel.value : '';
  var m   = mid ? MEMBERS.find(function(x){ return x.id===mid; }) : null;
  var days = m ? (m.days || []) : [];

  ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d) {
    var el  = document.getElementById('auth-day-'+d.toLowerCase());
    if (!el) return;
    if (mode === 'clear') {
      el.value = '0';
    } else if (mode === 'sdc') {
      el.value = days.includes(d) ? '1' : '0';
    } else if (mode === 'trans') {
      // 교통 왕복: 출석요일×2
      el.value = days.includes(d) ? '2' : '0';
    }
  });

    // 요일 미지정인 경우 모두 0으로 재설정
    if (data.daysSpecified === false || data.daysSpecified === 'false') {
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
        var el = document.getElementById('auth-day-'+d.toLowerCase());
        if (el) el.value = '0';
      });
      statusEl.textContent = '✅ AI 읽기 완료 (요일 미지정 — 주 '+data.freqPerWeek+'회로만 표시)';
    }

  // freqPerWeek 자동계산
  if (mode !== 'clear') {
    var total = 0;
    ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d) {
      var el = document.getElementById('auth-day-'+d.toLowerCase());
      if (el) total += parseInt(el.value) || 0;
    });

    // 요일 미지정인 경우 모두 0으로 재설정
    if (data.daysSpecified === false || data.daysSpecified === 'false') {
      ['Mon','Tue','Wed','Thu','Fri'].forEach(function(d){
        var el = document.getElementById('auth-day-'+d.toLowerCase());
        if (el) el.value = '0';
      });
      statusEl.textContent = '✅ AI 읽기 완료 (요일 미지정 — 주 '+data.freqPerWeek+'회로만 표시)';
    }
    var freqEl = document.getElementById('auth-freq');
    if (freqEl && total > 0) freqEl.value = total;
  }
}
