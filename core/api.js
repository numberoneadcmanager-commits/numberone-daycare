// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — SheetsAPI 모듈 v1.0
// core/api.js
// ══════════════════════════════════════════════════════════════

const SheetsAPI = {

  // ── 설정 ────────────────────────────────────────────────────
  URL: 'https://script.google.com/macros/s/AKfycbw3Bfexm_whVFu5pKUHkA9h9np6BpilKPbWry6d4GriGJdUv1K7Xt_Jhu5-wdIg1S4C/exec',

  // ── 상태 ────────────────────────────────────────────────────
  _connected: false,

  isConnected() {
    return this._connected;
  },

  // ── 기본 호출 ────────────────────────────────────────────────
  async get(params) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(this.URL + '?' + qs);
    return res.json();
  },

  async post(body) {
    const res = await fetch(this.URL, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return res.json();
  },

  // ── 연결 테스트 ──────────────────────────────────────────────
  async ping() {
    try {
      const res = await this.get({ action: 'ping' });
      this._connected = res.ok;
      return res.ok;
    } catch (e) {
      this._connected = false;
      return false;
    }
  },

  // ── 시트 초기화 ──────────────────────────────────────────────
  async initSheets() {
    return this.get({ action: 'initSheets' });
  },

  // ══════════════════════════════════════════════════════════════
  // 읽기
  // ══════════════════════════════════════════════════════════════

  async read(sheet) {
    return this.get({ action: 'read', sheet });
  },

  async readByMember(sheet, memberId) {
    return this.get({ action: 'readByMember', sheet, memberId });
  },

  async readByDate(sheet, date) {
    return this.get({ action: 'readByDate', sheet, date });
  },

  async readByRange(sheet, from, to) {
    return this.get({ action: 'readByRange', sheet, from, to });
  },

  // ══════════════════════════════════════════════════════════════
  // 쓰기
  // ══════════════════════════════════════════════════════════════

  async append(sheet, data) {
    return this.post({ action: 'append', sheet, data });
  },

  async upsert(sheet, key, value, data) {
    return this.post({ action: 'upsert', sheet, key, value, data });
  },

  async update(sheet, id, data) {
    return this.post({ action: 'update', sheet, id, data });
  },

  async delete(sheet, id) {
    return this.post({ action: 'delete', sheet, id });
  },

  // ══════════════════════════════════════════════════════════════
  // 멤버
  // ══════════════════════════════════════════════════════════════

  async loadMembers() {
    const res = await this.read('멤버');
    if (!res.ok || !res.data || !res.data.length) return null;
    const COLORS = [
      { bg: '#FAECE7', color: '#993C1D' }, { bg: '#E6F1FB', color: '#185FA5' },
      { bg: '#E1F5EE', color: '#0F6E56' }, { bg: '#EEEDFE', color: '#534AB7' },
      { bg: '#FAEEDA', color: '#854F0B' }, { bg: '#FBEAF0', color: '#72243E' },
      { bg: '#EAF3DE', color: '#3B6D11' }, { bg: '#E6F1FB', color: '#0C447C' }
    ];
    return res.data.map(function(r) {
      var id = String(r['ID'] || '');
      var n = 0; for (var i = 0; i < id.length; i++) n += id.charCodeAt(i);
      var clr = COLORS[n % COLORS.length];
      return {
        id,
        kr:           String(r['한글이름'] || ''),
        en:           String(r['영문이름'] || '').toUpperCase(),
        medicaid:     String(r['Medicaid'] || '').toUpperCase(),
        mltc:         String(r['MLTC'] || ''),
        pcp:          String(r['주치의'] || ''),
        days:         r['출석요일'] ? String(r['출석요일']).split(',').map(d => d.trim()).filter(Boolean) : [],
        phone:        String(r['전화'] || ''),
        addr:         String(r['주소'] || ''),
        dob:          String(r['생년월일'] || '').slice(0, 10),
        ins:          String(r['보험사'] || 'Anthem_MLTC'),
        status:       String(r['상태'] || 'active'),
        disenrollDate:String(r['Disenroll날짜'] || ''),
        memo:         String(r['메모'] || ''),
        chartNo:      String(r['차트번호'] || r['ID'] || ''),
        avBg:         r['avBg'] || clr.bg,
        avColor:      r['avColor'] || clr.color,
      };
    }).filter(m => m.id && m.kr);
  },

  async saveMember(m) {
    return this.upsert('멤버', 'ID', m.id, {
      'ID':            m.id,
      '한글이름':       m.kr,
      '영문이름':       m.en,
      'Medicaid':      m.medicaid,
      'MLTC':          m.mltc || '',
      '주치의':         m.pcp || '',
      '출석요일':       (m.days || []).join(','),
      '전화':           m.phone || '',
      '주소':           m.addr || '',
      '생년월일':       m.dob ? m.dob.slice(0, 10) : '',
      '보험사':         m.ins || 'Anthem_MLTC',
      '상태':           m.status || 'active',
      'Disenroll날짜':  m.disenrollDate || '',
      '메모':           m.memo || '',
      'avBg':          m.avBg || '#E6F1FB',
      'avColor':       m.avColor || '#185FA5',
    });
  },

  async uploadAllMembers(members, onProgress) {
    let ok = 0;
    for (let i = 0; i < members.length; i++) {
      try {
        await this.saveMember(members[i]);
        ok++;
      } catch (e) { console.warn('멤버 업로드 실패:', members[i].kr, e); }
      if (onProgress) onProgress(i + 1, members.length);
      // 5명마다 200ms 대기 (Apps Script 과부하 방지)
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 200));
    }
    return ok;
  },

  // ══════════════════════════════════════════════════════════════
  // 스태프
  // ══════════════════════════════════════════════════════════════

  async loadStaff() {
    const res = await this.read('스태프');
    if (!res.ok || !res.data || !res.data.length) return null;
    return res.data.map(function(r) {
      var certs = [];
      try { certs = JSON.parse(r['자격증'] || '[]'); } catch (e) {}
      return {
        id:      String(r['ID'] || ''),
        name:    String(r['영문이름'] || ''),
        nameKr:  String(r['한글이름'] || ''),
        role:    String(r['직책'] || ''),
        phone:   String(r['전화'] || ''),
        email:   String(r['이메일'] || ''),
        certs,
        avBg:    String(r['avBg'] || '#FAECE7'),
        avColor: String(r['avColor'] || '#993C1D'),
      };
    });
  },

  async saveStaff(s) {
    return this.upsert('스태프', 'ID', s.id, {
      'ID':      s.id,
      '한글이름': s.nameKr,
      '영문이름': s.name,
      '직책':    s.role,
      '전화':    s.phone || '',
      '이메일':  s.email || '',
      '자격증':  JSON.stringify(s.certs || []),
      'avBg':   s.avBg,
      'avColor':s.avColor,
    });
  },

  async deleteStaff(id) {
    return this.delete('스태프', id);
  },

  // ══════════════════════════════════════════════════════════════
  // 출결
  // ══════════════════════════════════════════════════════════════

  async syncAttendance(iso, recs, members) {
    // recs = { memberId: { status, memo, start, end, signIn, signOut, ... } }
    // members = MEMBERS 배열 (한글이름 조회용, 선택적)
    const entries = Object.entries(recs);
    for (const [mid, r] of entries) {
      if (!r.status) continue;
      try {
        const nameKr = (members && members.find(function(m){return m.id===mid;})||{}).kr || '';
        await this.upsert('출결', '날짜', iso + '_' + mid, {
          '날짜':     iso,
          '멤버ID':   mid,
          '한글이름': nameKr,
          '상태':     r.status || '',
          'Sign-in':  r.signIn || '',
          'Sign-out': r.signOut || '',
          '메모':     r.memo || '',
          '시작일':   r.start || '',
          '종료일':   r.end || '',
          '수정시각': new Date().toLocaleString('ko-KR'),
          '작성자':   r.writer || '',
        });
      } catch (e) { console.warn('출결 동기화 실패:', mid, e); }
    }
  },

  async loadAttendanceRange(from, to) {
    const res = await this.readByRange('출결', from, to);
    if (!res.ok) return {};
    const result = {};
    (res.data || []).forEach(function(r) {
      const iso = String(r['날짜'] || '').slice(0, 10);
      const mid = String(r['멤버ID'] || '');
      if (!iso || !mid) return;
      if (!result[iso]) result[iso] = {};
      result[iso][mid] = {
        status:   r['상태'] || '',
        signIn:   r['Sign-in'] || '',
        signOut:  r['Sign-out'] || '',
        memo:     r['메모'] || '',
        start:    r['시작일'] || '',
        end:      r['종료일'] || '',
        writer:   r['작성자'] || '',
      };
    });
    return result;
  },

  // ══════════════════════════════════════════════════════════════
  // 로그 (Incident / Activity / Case)
  // ══════════════════════════════════════════════════════════════

  async saveIncident(entry, isEdit) {
    if (isEdit) return this.update('incident', entry['ID'], entry);
    return this.append('incident', entry);
  },

  async deleteIncident(id) {
    return this.delete('incident', id);
  },

  async saveActivity(entry, isEdit) {
    if (isEdit) return this.update('activity', entry['ID'], entry);
    return this.append('activity', entry);
  },

  async deleteActivity(id) {
    return this.delete('activity', id);
  },

  async saveCase(entry, isEdit) {
    if (isEdit) return this.update('caselog', entry['ID'], entry);
    return this.append('caselog', entry);
  },

  async deleteCase(id) {
    return this.delete('caselog', id);
  },

  // ══════════════════════════════════════════════════════════════
  // Auth
  // ══════════════════════════════════════════════════════════════

  async saveAuth(entry, isEdit) {
    const data = {
      'ID':       entry.id,
      '멤버ID':   entry.memberId,
      '보험사':   entry.insurer,
      'Auth번호': entry.authNo,
      '시작일':   entry.startDate,
      '종료일':   entry.endDate,
      '서비스유형': entry.service,
      '메모':     entry.note || '',
    };
    if (isEdit) return this.update('auth', entry.id, data);
    return this.append('auth', data);
  },

  async deleteAuth(id) {
    return this.delete('auth', id);
  },

  async loadAuth() {
    const res = await this.read('auth');
    if (!res.ok) return [];
    return (res.data || []).map(function(r) {
      return {
        id:          String(r['ID'] || ''),
        memberId:    String(r['멤버ID'] || ''),
        insurer:     String(r['보험사'] || ''),
        authNo:      String(r['Auth번호'] || ''),
        startDate:   String(r['시작일'] || ''),
        endDate:     String(r['종료일'] || ''),
        service:     String(r['서비스유형'] || ''),
        note:        String(r['메모'] || ''),
      };
    });
  },

  // ══════════════════════════════════════════════════════════════
  // 방문자 / 회의록
  // ══════════════════════════════════════════════════════════════

  async saveVisitor(entry, isEdit) {
    const data = {
      'ID':   entry.id,
      '날짜': entry.date,
      '시간': entry.time,
      '이름': entry.name,
      '소속': entry.org || '',
      '목적': entry.purpose || '',
      '메모': entry.note || '',
    };
    if (isEdit) return this.update('visitor', entry.id, data);
    return this.append('visitor', data);
  },

  async deleteVisitor(id) {
    return this.delete('visitor', id);
  },

  async saveCouncil(entry, isEdit) {
    const data = {
      'ID':     entry.id,
      '날짜':   entry.date,
      '시간':   entry.time,
      '유형':   entry.type,
      '참석자': entry.attendees || '',
      '안건':   entry.agenda || '',
      '내용':   entry.minutes || '',
      '다음회의': entry.next || '',
    };
    if (isEdit) return this.update('council', entry.id, data);
    return this.append('council', data);
  },

  async deleteCouncil(id) {
    return this.delete('council', id);
  },

  // ══════════════════════════════════════════════════════════════
  // 전체 데이터 로드 (앱 시작 시)
  // ══════════════════════════════════════════════════════════════

  async loadAll() {
    const [iR, aR, cR, authR] = await Promise.all([
      this.read('incident'),
      this.read('activity'),
      this.read('caselog'),
      this.loadAuth(),
    ]);
    return {
      incidents:  iR.ok  ? (iR.data  || []) : [],
      activities: aR.ok  ? (aR.data  || []) : [],
      cases:      cR.ok  ? (cR.data  || []) : [],
      authList:   Array.isArray(authR) ? authR : [],
    };
  },

  // ══════════════════════════════════════════════════════════════
  // UI 헬퍼 (상태 표시)
  // ══════════════════════════════════════════════════════════════

  setStatusPill(ok) {
    const pill = document.getElementById('api-pill');
    if (!pill) return;
    pill.className = ok ? 'api-pill api-ok' : 'api-pill api-no';
    pill.textContent = ok ? '✅ Sheets 연동' : '⚡ Sheets 미연동';
    this._connected = ok;
  },
};

// 전역에서 apiCall 호환 (기존 코드 호환용 — 나중에 제거)
function apiCall(params, body = null) {
  if (body) return SheetsAPI.post(body);
  return SheetsAPI.get(params);
}
var apiUrl = SheetsAPI.URL; // 기존 코드 호환용
