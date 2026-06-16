// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 멤버 관리
// apps/members.js
// ══════════════════════════════════════════════════════════════

// ── 멤버 목록 필터/렌더 ──────────────────────────────────────
async function toggleMemberDocs(mid, btn) {
  var wrap = document.getElementById('docs-' + mid);
  if (!wrap) return;
  if (wrap.style.display !== 'none') {
    wrap.style.display = 'none';
    btn.textContent = '📄 관련 문서 보기';
    return;
  }
  btn.textContent = '⏳ 로딩 중...';
  btn.disabled = true;
  wrap.style.display = 'block';
  wrap.innerHTML = '<div style="font-size:12px;color:#8E8E93;padding:8px 0">불러오는 중...</div>';

  try {
    // 병렬로 모두 로드
    var [pcspRes, logRes, incRes, caseRes, authRes] = await Promise.all([
      SheetsAPI.readByMember('PCSP', mid),
      SheetsAPI.readByMember('JSONLog', mid),
      SheetsAPI.readByMember('incident', mid),
      SheetsAPI.readByMember('caselog', mid),
      SheetsAPI.readByMember('auth', mid),
    ]);

    var html = '<div style="border:1.5px solid #E5E5EA;border-radius:10px;overflow:hidden">';

    // PCSP
    var pcspList = (pcspRes.ok && pcspRes.data) ? pcspRes.data : [];
    var pcsp = pcspList.length ? pcspList[pcspList.length-1] : null;
    var pcspExp = pcsp ? String(pcsp['갱신예정일']||'').slice(0,10) : '';
    var pcspDate = pcsp ? String(pcsp['작성일']||'').slice(0,10) : '';
    var pcspExpired = pcspExp && pcspExp < new Date().toISOString().slice(0,10);
    html += docRow('📋', 'PCSP',
      pcsp ? (pcspDate + (pcspExp ? ' · 만료: <b style="color:'+(pcspExpired?'#FF3B30':'#34C759')+'">'+pcspExp+'</b>' : '')) : null);

    // Drive JSON 문서들
    var logs = (logRes.ok && logRes.data) ? logRes.data : [];
    function lastLog(type) {
      var found = logs.filter(function(l){ return String(l['파일종류']||'') === type; });
      return found.length ? String(found[found.length-1]['저장일시']||'').slice(0,10) : null;
    }
    html += docRow('🥗', 'Nutrition Screening', lastLog('Nutrition'));
    html += docRow('📋', 'Assessment',          lastLog('Assessment'));
    html += docRow('📄', 'Member Rights',        lastLog('MemberRights'));

    // Incident / Case / Auth
    var incCount  = incRes.ok  ? (incRes.data ||[]).length  : 0;
    var caseCount = caseRes.ok ? (caseRes.data||[]).length  : 0;
    var authList  = authRes.ok ? (authRes.data||[])         : [];
    var authActive = authList.filter(function(a){
      return !a['종료일'] || String(a['종료일']) >= new Date().toISOString().slice(0,10);
    });
    html += docRow('🚨', 'Incident Log',   incCount  ? incCount+'건'  : null);
    html += docRow('📁', 'Case Log',       caseCount ? caseCount+'건' : null);
    html += docRow('🔑', 'Authorization',  authActive.length ? authActive.length+'건 활성' : (authList.length ? authList.length+'건 (만료)' : null));

    html += '</div>';
    wrap.innerHTML = html;
  } catch(e) {
    wrap.innerHTML = '<div style="font-size:12px;color:#FF3B30;padding:8px 0">❌ 오류: ' + e.message + '</div>';
  }

  btn.textContent = '📄 문서 접기';
  btn.disabled = false;
}

function docRow(icon, label, value) {
  var hasData = value !== null && value !== undefined && value !== '';
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:.5px solid #F2F2F7">'
    + '<span style="font-size:12px;color:#3C3C43">' + icon + ' ' + label + '</span>'
    + (hasData
       ? '<span style="font-size:11px;color:#34C759;font-weight:600">' + value + '</span>'
       : '<span style="font-size:11px;color:#C7C7CC">없음</span>')
    + '</div>';
}

function filterM() {
  if (!MEMBERS || !MEMBERS.length) return;

  var raw = ((document.getElementById('msearch') || {}).value || '').toLowerCase().trim();
  var sf  = ((document.getElementById('status-filter') || {}).value) || 'all';

  // 보험사 라벨 매핑
  function insLabel(ins) {
    ins = (ins || '').toLowerCase();
    if (ins.includes('anthem')) return 'anthem anthem_mltc anthem_map';
    if (ins.includes('clp'))    return 'clp centerlight';
    if (ins.includes('swh'))    return 'swh senior whole health';
    return ins;
  }

  // 생일 월 매핑
  var MONTHS = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
    january:1, february:2, march:3, april:4, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12
  };

  // 요일 매핑
  var DAYS = {
    mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun',
    '월':'Mon', '화':'Tue', '수':'Wed', '목':'Thu', '금':'Fri', '토':'Sat', '일':'Sun'
  };

  mFilt = MEMBERS.filter(function(m) {
    // 상태 필터
    var mS = sf === 'all'
      || (sf === 'active'      && isActive(m))
      || (sf === 'disenrolled' && !isActive(m));
    if (!mS) return false;
    if (!raw) return true;

    // ── 1. 텍스트 통합 검색 ──────────────────────────────
    var txt = [
      m.kr || '',
      (m.en || '').toLowerCase(),
      (m.medicaid || '').toLowerCase(),
      (m.mltc || '').toLowerCase(),
      (m.addr || '').toLowerCase(),
      (m.phone || '').replace(/-/g,''),
      (m.pcp || '').toLowerCase(),
      (m.chartNo || ''),
      insLabel(m.ins),
    ].join(' ');
    if (txt.includes(raw)) return true;

    // ── 2. 생일 월 (may, june, 5월, 12월) ───────────────
    var dobMonth = parseInt((m.dob || '').slice(5, 7));
    if (MONTHS[raw] !== undefined && dobMonth === MONTHS[raw]) return true;
    var mNum = raw.match(/^(\d{1,2})월$/);
    if (mNum && dobMonth === parseInt(mNum[1])) return true;

    // ── 3. 생년 (1952 등) ────────────────────────────────
    if (/^\d{4}$/.test(raw) && (m.dob || '').startsWith(raw)) return true;

    // ── 4. 출석 요일 (mon, tue / 월, 화) ────────────────
    var dayKey = DAYS[raw] || DAYS[raw.slice(0,3)];
    if (dayKey && (m.days || []).includes(dayKey)) return true;

    return false;
  });

  mPage = 0; renderMG();
}

function setMDay(f, btn) {
  document.querySelectorAll('.fpill[data-mf]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  mFilt = f ? MEMBERS.filter(m => m.days.includes(f)) : [...MEMBERS];
  mPage = 0; renderMG();
}

function renderMG() {
  document.getElementById('m-cnt').textContent = '검색 결과: ' + mFilt.length + '명';
  const sl = mFilt.slice(mPage * PER, (mPage + 1) * PER);
  document.getElementById('mgrid').innerHTML = sl.map(m => `<div class="mc ${isActive(m) ? '' : 'disenrolled-card'}">
    <div class="mc-top">
      <div class="mc-av" style="background:${m.avBg};color:${m.avColor};overflow:hidden;padding:0">
        ${m.photo ? '<img src="' + m.photo + '" style="width:100%;height:100%;object-fit:cover">' : m.kr[0]}
      </div>
      <div style="flex:1;min-width:0"><div class="mc-name">${m.kr}</div><div class="mc-en">${m.en}</div></div>
    </div>
    <div class="mc-grid">
      <span class="mc-lbl">차트번호</span><span class="mc-val" style="color:#D85A30;font-weight:800">${m.chartNo || m.id || '—'}</span>
      <span class="mc-lbl">생년월일</span><span class="mc-val">${m.dob ? m.dob.slice(0,10) : '—'}</span>
      <span class="mc-lbl">Medicaid</span><span class="mc-val">${m.medicaid}</span>
      <span class="mc-lbl">보험사</span><span class="mc-val">${insBadge(m.ins || 'Anthem_MLTC')}</span>
      <span class="mc-lbl">상태</span><span class="mc-val">${statusBadge(m)}</span>
      <span class="mc-lbl">주치의</span><span class="mc-val">${m.pcp || '—'}</span>
    </div>
    <div class="mc-days" style="margin-top:7px">${m.days.map(d => `<span class="mc-day">${DKR[d]}</span>`).join('')}</div>
    ${m.memo ? `<div style="font-size:11px;color:#D85A30;background:#FFF3EE;border-radius:8px;padding:5px 9px;margin-top:6px">📝 ${m.memo}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openMemberEdit('${m.id}')">✏️ 정보 수정</button>
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openStatusModal('${m.id}')">● 상태 변경</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#E6F1FB;color:#0C447C;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="openPhotoUpload('${m.id}')">📸 사진</button>
      <button style="padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#FFF3EE;color:#D85A30;font-size:12px;font-weight:700;cursor:pointer;width:100%" onclick="generateMemberChart('${m.id}')">🪪 차트</button>
    </div>
    <a href="operations.html?tab=pcsp&mid=${m.id}" onclick="localStorage.setItem('pcsp_prefill_mid',this.getAttribute('data-mid'))" data-mid="${m.id}" style="display:block;margin-top:6px;padding:10px;background:#D85A30;color:#fff;border-radius:12px;font-size:13px;font-weight:700;text-align:center;text-decoration:none">📋 PCSP 입력 →</a>
    <button onclick="toggleMemberDocs('${m.id}',this)" style="width:100%;margin-top:6px;padding:9px;border-radius:10px;border:1.5px solid #E5E5EA;background:#F2F2F7;color:#3C3C43;font-size:12px;font-weight:700;cursor:pointer">📄 관련 문서 보기</button>
    <div id="docs-${m.id}" style="display:none;margin-top:8px"></div>
  </div>`).join('');

  const tot = Math.ceil(mFilt.length / PER);
  if (tot <= 1) { document.getElementById('mpg').innerHTML = ''; return; }
  let h = '';
  if (mPage > 0) h += `<button class="pgb" onclick="chMP(${mPage - 1})">← 이전</button>`;
  h += `<span class="pg-info">${mPage + 1} / ${tot}</span>`;
  if (mPage < tot - 1) h += `<button class="pgb" onclick="chMP(${mPage + 1})">다음 →</button>`;
  document.getElementById('mpg').innerHTML = h;
}

function chMP(p) { mPage = p; renderMG(); document.querySelector('.content').scrollTop = 0; }

// ── 멤버 상태 변경 모달 ──────────────────────────────────────
function openStatusModal(mid) {
  window._statusMid = mid;
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  document.getElementById('sm-name').textContent = m.kr + ' — ' + m.en;
  const a = isActive(m);
  document.getElementById('sm-active').checked      = a;
  document.getElementById('sm-disenrolled').checked = !a;
  document.getElementById('sm-date-wrap').style.display = a ? 'none' : 'block';
  document.getElementById('sm-date').value = m.disenrollDate || '';
  document.getElementById('sm-note').value = m.disenrollNote || '';
  document.getElementById('ov-status').classList.add('open');
  document.getElementById('modal-ov-status').style.display = 'block';
}

function toggleStatusRadio() {
  document.getElementById('sm-date-wrap').style.display =
    document.getElementById('sm-disenrolled').checked ? 'block' : 'none';
}

function saveStatus() {
  const m = MEMBERS.find(x => x.id === window._statusMid); if (!m) return;
  if (document.getElementById('sm-disenrolled').checked) {
    m.status = 'disenrolled';
    m.disenrollDate = document.getElementById('sm-date').value || '';
    m.disenrollNote = document.getElementById('sm-note').value || '';
  } else { m.status = 'active'; m.disenrollDate = ''; m.disenrollNote = ''; }
  document.getElementById('ov-status').classList.remove('open');
  document.getElementById('modal-ov-status').style.display = 'none';
  if (apiUrl) {
    apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id,
      data: { 'ID': m.id, '상태': m.status, 'Disenroll날짜': m.disenrollDate || '' } }).catch(() => {});
  }
  saveToStorage(); renderAtt(); filterM(); renderDash();
}

// ── 멤버 추가/수정 모달 ──────────────────────────────────────
var _meEditDays = new Set();

function openAddMember() {
  window._meditMid = null;
  document.getElementById('medit-title').textContent = '새 멤버 추가';
  ['me-kr','me-en','me-phone','me-addr','me-medicaid','me-mltc','me-pcp','me-memo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('me-dob').value = '';
  document.getElementById('me-ins').value = 'Anthem_MLTC';
  _meEditDays = new Set();
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const b = document.getElementById('me-' + d); if (b) b.className = 'dsbtn';
  });
  openOv('ov-medit');
}

function openMemberEdit(mid) {
  window._meditMid = mid;
  const m = MEMBERS.find(x => x.id === mid); if (!m) return;
  document.getElementById('medit-title').textContent = m.kr + ' — 정보 수정';
  const cno = document.getElementById('me-chartno'); if (cno) cno.value = m.chartNo || m.id || '';
  document.getElementById('me-kr').value      = m.kr       || '';
  document.getElementById('me-en').value      = m.en       || '';
  document.getElementById('me-dob').value     = m.dob      || '';
  document.getElementById('me-phone').value   = m.phone    || '';
  document.getElementById('me-addr').value    = m.addr     || '';
  document.getElementById('me-medicaid').value = m.medicaid || '';
  document.getElementById('me-mltc').value    = m.mltc     || '';
  document.getElementById('me-pcp').value     = m.pcp      || '';
  document.getElementById('me-ins').value     = m.ins      || 'Anthem_MLTC';
  const memoEl = document.getElementById('me-memo'); if (memoEl) memoEl.value = m.memo || '';
  _meEditDays = new Set(m.days || []);
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const b = document.getElementById('me-' + d); if (b) b.className = 'dsbtn' + (_meEditDays.has(d) ? ' sel' : '');
  });
  openOv('ov-medit');
}

function toggleMEDay(btn, day) {
  if (_meEditDays.has(day)) { _meEditDays.delete(day); btn.className = 'dsbtn'; }
  else                      { _meEditDays.add(day);    btn.className = 'dsbtn sel'; }
}

async function saveMemberEdit() {
  const isNew = !window._meditMid;
  let m;
  if (isNew) {
    const newId = document.getElementById('me-medicaid').value.trim().toUpperCase();
    if (!newId) { alert('Medicaid ID를 입력해주세요.'); return; }
    if (MEMBERS.find(x => x.id === newId)) { alert('이미 존재하는 Medicaid ID입니다.'); return; }
    const COLORS = [{bg:'#FAECE7',color:'#993C1D'},{bg:'#E6F1FB',color:'#185FA5'},{bg:'#E1F5EE',color:'#0F6E56'},{bg:'#EEEDFE',color:'#534AB7'}];
    const clr = COLORS[MEMBERS.length % COLORS.length];
    m = { id: newId, status: 'active', disenrollDate: '', disenrollNote: '', memo: '', avBg: clr.bg, avColor: clr.color };
    MEMBERS.push(m);
  } else {
    m = MEMBERS.find(x => x.id === window._meditMid); if (!m) return;
  }
  const cno2 = document.getElementById('me-chartno'); if (cno2) m.chartNo = cno2.value.trim();
  m.kr       = document.getElementById('me-kr').value.trim();
  m.en       = document.getElementById('me-en').value.trim().toUpperCase();
  m.dob      = document.getElementById('me-dob').value;
  m.phone    = document.getElementById('me-phone').value.trim();
  m.addr     = document.getElementById('me-addr').value.trim();
  m.medicaid = document.getElementById('me-medicaid').value.trim().toUpperCase();
  m.mltc     = document.getElementById('me-mltc').value.trim();
  m.pcp      = document.getElementById('me-pcp').value.trim();
  m.ins      = document.getElementById('me-ins').value;
  const memoEl = document.getElementById('me-memo'); if (memoEl) m.memo = memoEl.value.trim();
  m.days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => _meEditDays.has(d));

  if (apiUrl) {
    apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id, data: {
      'ID': m.id, '한글이름': m.kr, '영문이름': m.en, 'Medicaid': m.medicaid, 'MLTC': m.mltc,
      '주치의': m.pcp, '출석요일': m.days.join(','), '전화': m.phone, '주소': m.addr,
      '생년월일': m.dob ? m.dob.slice(0,10) : '', '보험사': m.ins, '상태': m.status || 'active',
      'Disenroll날짜': m.disenrollDate || '', '메모': m.memo || '',
      'avBg': m.avBg || '#E6F1FB', 'avColor': m.avColor || '#185FA5',
    }}).catch(e => console.log(e));
  }
  saveToStorage(); closeOv('ov-medit'); filterM(); renderAtt();
  alert((isNew ? '새 멤버 추가: ' : '') + m.kr + ' 저장됨');
}

// ── 멤버 Sheets 전체 업로드 ──────────────────────────────────
async function uploadMembersToSheets() {
  if (!apiUrl) { alert('Google Sheets URL을 먼저 설정해주세요.'); return; }
  if (!confirm('멤버 ' + MEMBERS.length + '명 업로드?')) return;
  const btn = document.getElementById('btn-upload-members');
  if (btn) { btn.textContent = '업로드 중...'; btn.disabled = true; }
  let ok = 0;
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i];
    try {
      await apiCall({}, { action: 'upsert', sheet: '멤버', key: 'ID', value: m.id, data: {
        'ID': m.id, '한글이름': m.kr, '영문이름': m.en, 'Medicaid': m.medicaid, 'MLTC': m.mltc,
        '주치의': m.pcp || '', '출석요일': (m.days || []).join(','), '전화': m.phone || '',
        '주소': m.addr || '', '생년월일': m.dob ? m.dob.slice(0,10) : '', '보험사': m.ins || '',
        '상태': m.status || 'active', 'Disenroll날짜': m.disenrollDate || '', '메모': m.memo || '',
        'avBg': m.avBg || '#E6F1FB', 'avColor': m.avColor || '#185FA5',
      }});
      ok++;
    } catch (e) {}
    if (btn && i % 10 === 0) btn.textContent = '업로드 중... ' + (i + 1) + '/' + MEMBERS.length;
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 200));
  }
  if (btn) { btn.textContent = '✅ 완료 (' + ok + '명)'; btn.disabled = false; }
  const el = document.getElementById('api-msg'); if (el) el.textContent = '✅ ' + ok + '명 업로드 완료!';
}

// ── 멤버 사진 ────────────────────────────────────────────────
function openPhotoUpload(mid) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const m = MEMBERS.find(x => x.id === mid); if (!m) return;
      m.photo = ev.target.result;
      mp[mid] = ev.target.result;
      saveToStorage(); filterM();
      alert(m.kr + ' 사진이 저장됐어요!');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
