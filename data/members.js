// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 멤버 관리
// apps/members.js
// ══════════════════════════════════════════════════════════════

// ── 멤버 목록 필터/렌더 ──────────────────────────────────────
function filterM() {
  const q  = document.getElementById('msearch').value.toLowerCase().trim();
  const sf = (document.getElementById('status-filter') || {}).value || 'all';

  mFilt = MEMBERS.filter(m => {
    const mS = sf === 'all' || (sf === 'active' && isActive(m)) || (sf === 'disenrolled' && !isActive(m));
    if (!mS) return false;
    if (!q)  return true;

    // ── 통합 검색 ──────────────────────────────────────────
    // 이름 (한글/영문)
    if (m.kr.includes(q))                    return true;
    if (m.en.toLowerCase().includes(q))      return true;

    // Medicaid / MLTC ID
    if (m.medicaid.toLowerCase().includes(q)) return true;
    if ((m.mltc||'').toLowerCase().includes(q)) return true;

    // 보험사 (anthem, clp, centerlight, swh)
    const insMap = { anthem_mltc:'anthem', anthem_map:'anthem map', clp:'centerlight', swh:'swh' };
    const insLabel = (insMap[m.ins.toLowerCase()] || m.ins.toLowerCase());
    if (insLabel.includes(q) || m.ins.toLowerCase().includes(q)) return true;

    // 주소 (flushing, bronx, bayside 등)
    if ((m.addr||'').toLowerCase().includes(q)) return true;

    // 전화번호
    if ((m.phone||'').toLowerCase().includes(q)) return true;

    // 주치의
    if ((m.pcp||'').toLowerCase().includes(q)) return true;

    // 출석 요일 (mon, tue, wed, thu, fri / 월,화,수,목,금)
    const dayKrMap = { '월':'Mon','화':'Tue','수':'Wed','목':'Thu','금':'Fri','토':'Sat','일':'Sun' };
    const dayEnMap = { mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun' };
    const dayKey = dayKrMap[q] || dayEnMap[q.slice(0,3)];
    if (dayKey && m.days.includes(dayKey)) return true;

    // 생일 월 (may→5, june→6 / 5월, 1월 등)
    const monthMap = {
      jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
      jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
      january:1,february:2,march:3,april:4,june:6,
      july:7,august:8,september:9,october:10,november:11,december:12
    };
    const monthNum = monthMap[q] || (q.match(/^(\d{1,2})월$/) ? parseInt(q) : null);
    if (monthNum && m.dob) {
      const dobMonth = parseInt((m.dob||'').slice(5,7));
      if (dobMonth === monthNum) return true;
    }

    // 생일 연도 (1952, 1960 등)
    if (q.match(/^\d{4}$/) && m.dob && m.dob.startsWith(q)) return true;

    // 차트번호
    if ((m.chartNo||'').includes(q)) return true;

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
