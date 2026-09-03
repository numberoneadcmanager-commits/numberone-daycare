// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — SheetsAPI 모듈 v3.0
// core/api.js
// ══════════════════════════════════════════════════════════════

const SheetsAPI = {

  // ── 설정 ───────────────────────────────────────────────────
  URL: 'https://script.google.com/macros/s/AKfycby88tpdxiWLOekrE2FViJr5ew6KeSeiXEoefR6houH9BHUsp2EkooGx5aNA1NvC2fyP/exec',

  // ── 상태 ───────────────────────────────────────────────────
  _connected: false,

  isConnected() { return this._connected; },

  // ── 기본 호출 ──────────────────────────────────────────────
  async get(params) {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(this.URL + '?' + qs);
    return res.json();
  },

  async post(body) {
    const res = await fetch(this.URL, {
      method: 'POST',
      body:   JSON.stringify(body),
    });
    return res.json();
  },

  // ── 연결 테스트 ────────────────────────────────────────────
  async ping() {
    try {
      const res       = await this.get({ action: 'ping' });
      this._connected = res.ok;
      return res.ok;
    } catch (e) {
      this._connected = false;
      return false;
    }
  },

  // ── 시트 초기화 ────────────────────────────────────────────
  async initSheets() {
    return this.get({ action: 'initSheets' });
  },

  // ══════════════════════════════════════════════════════════
  // 읽기
  // ══════════════════════════════════════════════════════════

  async read(sheet) { return this.get({ action: 'read', sheet }); },

  async readByMember(sheet, memberId) {
    return this.get({ action: 'readByMember', sheet, memberId });
  },

  async readByDate(sheet, date) {
    return this.get({ action: 'readByDate', sheet, date });
  },

  async readByRange(sheet, from, to) {
    return this.get({ action: 'readByRange', sheet, from, to });
  },

  // ══════════════════════════════════════════════════════════
  // 쓰기
  // ══════════════════════════════════════════════════════════

  async append(sheet, data)              { return this.post({ action: 'append', sheet, data }); },
  async upsert(sheet, key, value, data)  { return this.post({ action: 'upsert', sheet, key, value, data }); },
  async update(sheet, id, data)          { return this.post({ action: 'update', sheet, id, data }); },
  async delete(sheet, id)                { return this.post({ action: 'delete', sheet, id }); },

  // 주소 → 좌표 변환 (서버(Apps Script)를 거쳐 안전하게 처리, API 키는 서버에만 저장됨)
  async geocodeAllMembers()              { return this.post({ action: 'geocodeAllMembers' }); },
  async geocodeCenter()                  { return this.post({ action: 'geocodeCenter' }); },

  // ══════════════════════════════════════════════════════════
  // Drive JSON 저장/로드
  // ══════════════════════════════════════════════════════════

  async saveJSON(memberId, memberName, fileType, jsonData, author) {
    return this.post({
      action: 'saveJSON',
      memberId,
      memberName,
      fileType,
      jsonData,
      author: author || '',
    });
  },

  async loadJSON(memberId, memberName, fileType) {
    return this.get({
      action: 'loadJSON',
      memberId,
      memberName: memberName || '',
      fileType,
    });
  },

  // ══════════════════════════════════════════════════════════
  // 멤버
  // ══════════════════════════════════════════════════════════

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
      var n  = 0; for (var i = 0; i < id.length; i++) n += id.charCodeAt(i);
      var clr = COLORS[n % COLORS.length];
      return {
        id,
        kr:            String(r['한글이름'] || ''),
        en:            String(r['영문이름'] || '').toUpperCase(),
        lastName:      String(r['LastName'] || ''),
        firstName:     String(r['FirstName'] || ''),
        middleName:    String(r['MiddleName'] || ''),
        medicaid:      String(r['Medicaid'] || '').toUpperCase(),
        mltc:          String(r['MLTC'] || ''),
        pcp:           String(r['주치의'] || ''),
        days:          r['출석요일'] ? String(r['출석요일']).split(',').map(d => d.trim()).filter(Boolean) : [],
        phone:         String(r['전화'] || ''),
        addr:          String(r['주소'] || ''),
        city:          String(r['City'] || ''),
        state:         String(r['State'] || 'NY'),
        zip:           String(r['Zip'] || ''),
        lat:           r['Lat'] ? parseFloat(r['Lat']) : null,
        lng:           r['Lng'] ? parseFloat(r['Lng']) : null,
        gender:        String(r['성별'] || ''),
        diagCode:      String(r['진단코드'] || ''),
        dob:           String(r['생년월일'] || '').slice(0, 10),
        ins:           String(r['보험사'] || 'Anthem_MLTC'),
        status:        String(r['상태'] || 'active'),
        disenrollDate: String(r['Disenroll날짜'] || ''),
        memo:          String(r['메모'] || ''),
        chartNo:       String(r['차트번호'] || r['ID'] || ''),
        hcAgency:      String(r['홈케어회사'] || ''),
        hcSchedule:    (function(){
          var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          var sched = {};
          days.forEach(function(d){
            var raw = String(r['홈케어'+d] || '').trim();
            if (raw && raw.includes('-')) {
              var parts = raw.split('-');
              sched[d] = { start: parts[0]||'', end: parts[1]||'' };
            }
          });
          return sched;
        })(),
        avBg:          r['avBg']   || clr.bg,
        avColor:       r['avColor'] || clr.color,
      };
    }).filter(m => m.id && m.kr);
  },

  async saveMember(m) {
    return this.upsert('멤버', 'ID', m.id, {
      'ID':           m.id,
      '한글이름':      m.kr,
      '영문이름':      m.en,
      'LastName':     m.lastName   || '',
      'FirstName':    m.firstName  || '',
      'MiddleName':   m.middleName || '',
      'Medicaid':     m.medicaid,
      'MLTC':         m.mltc || '',
      '주치의':        m.pcp || '',
      '출석요일':      (m.days || []).join(','),
      '전화':          m.phone || '',
      '주소':          m.addr || '',
      'City':         m.city  || '',
      'State':        m.state || 'NY',
      'Zip':          m.zip   || '',
      'Lat':          m.lat != null ? m.lat : '',
      'Lng':          m.lng != null ? m.lng : '',
      '성별':          m.gender || '',
      '진단코드':      m.diagCode || '',
      '생년월일':      m.dob ? m.dob.slice(0, 10) : '',
      '보험사':        m.ins || 'Anthem_MLTC',
      '상태':          m.status || 'active',
      'Disenroll날짜': m.disenrollDate || '',
      '메모':          m.memo || '',
      '홈케어회사':    m.hcAgency || '',
      '홈케어Sun':    (m.hcSchedule && m.hcSchedule.Sun) ? (m.hcSchedule.Sun.start+'-'+m.hcSchedule.Sun.end) : '',
      '홈케어Mon':    (m.hcSchedule && m.hcSchedule.Mon) ? (m.hcSchedule.Mon.start+'-'+m.hcSchedule.Mon.end) : '',
      '홈케어Tue':    (m.hcSchedule && m.hcSchedule.Tue) ? (m.hcSchedule.Tue.start+'-'+m.hcSchedule.Tue.end) : '',
      '홈케어Wed':    (m.hcSchedule && m.hcSchedule.Wed) ? (m.hcSchedule.Wed.start+'-'+m.hcSchedule.Wed.end) : '',
      '홈케어Thu':    (m.hcSchedule && m.hcSchedule.Thu) ? (m.hcSchedule.Thu.start+'-'+m.hcSchedule.Thu.end) : '',
      '홈케어Fri':    (m.hcSchedule && m.hcSchedule.Fri) ? (m.hcSchedule.Fri.start+'-'+m.hcSchedule.Fri.end) : '',
      '홈케어Sat':    (m.hcSchedule && m.hcSchedule.Sat) ? (m.hcSchedule.Sat.start+'-'+m.hcSchedule.Sat.end) : '',
      'avBg':         m.avBg   || '#E6F1FB',
      'avColor':      m.avColor || '#185FA5',
    });
  },

  async uploadAllMembers(members, onProgress) {
    let ok = 0;
    for (let i = 0; i < members.length; i++) {
      try { await this.saveMember(members[i]); ok++; }
      catch (e) { console.warn('멤버 업로드 실패:', members[i].kr, e); }
      if (onProgress) onProgress(i + 1, members.length);
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 200));
    }
    return ok;
  },

  // ══════════════════════════════════════════════════════════
  // 스태프
  // ══════════════════════════════════════════════════════════

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
        avBg:    String(r['avBg']   || '#FAECE7'),
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
      'avColor': s.avColor,
    });
  },

  async deleteStaff(id) { return this.delete('스태프', id); },

  // ══════════════════════════════════════════════════════════
  // 출결 — 단일 멤버만 저장 (race condition 방지)
  // ══════════════════════════════════════════════════════════

  // 출결 버튼 클릭 시 해당 멤버 1건만 저장
  async syncSingleAttendance(iso, mid, r, members) {
    const nameKr = (members && members.find(m => m.id === mid) || {}).kr || '';
    return this.post({
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
        '작성자':   r.writer   || '',
      },
    });
  },

  // 전체 동기화 (페이지 로드 시 백그라운드)
  async syncAttendance(iso, recs, members) {
    const entries = Object.entries(recs);
    for (const [mid, r] of entries) {
      if (!r.status) continue;
      try {
        await this.syncSingleAttendance(iso, mid, r, members);
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
        status:  r['상태']    || '',
        signIn:  r['Sign-in'] || '',
        signOut: r['Sign-out']|| '',
        memo:    r['메모']    || '',
        start:   r['시작일']  || '',
        end:     r['종료일']  || '',
        writer:  r['작성자']  || '',
      };
    });
    return result;
  },

  // ══════════════════════════════════════════════════════════
  // 로그 (Incident / Activity / Case)
  // ══════════════════════════════════════════════════════════

  async saveIncident(entry, isEdit) {
    if (isEdit) return this.update('incident', entry['ID'], entry);
    return this.append('incident', entry);
  },
  async deleteIncident(id)  { return this.delete('incident', id); },

  async saveActivity(entry, isEdit) {
    if (isEdit) return this.update('activity', entry['ID'], entry);
    return this.append('activity', entry);
  },
  async deleteActivity(id)  { return this.delete('activity', id); },

  async saveCase(entry, isEdit) {
    if (isEdit) return this.update('caselog', entry['ID'], entry);
    return this.append('caselog', entry);
  },
  async deleteCase(id)      { return this.delete('caselog', id); },

  // ══════════════════════════════════════════════════════════
  // Auth
  // ══════════════════════════════════════════════════════════

  async saveAuth(entry, isEdit) {
    const data = {
      'ID':         entry.id,
      '멤버ID':     entry.memberId,
      '보험사':     entry.insurer,
      'Auth번호':   entry.authNo,
      '서비스유형': entry.serviceType || '',
      '서비스코드': entry.serviceCode || '',
      '시작일':     entry.startDate,
      '종료일':     entry.endDate,
      '총수량':     entry.totalQty || '',
      '수량단위':   entry.qtyUnit || '',
      '주당빈도':   entry.freqPerWeek || '',
      '요일Mon':    entry.dayMon || '0',
      '요일Tue':    entry.dayTue || '0',
      '요일Wed':    entry.dayWed || '0',
      '요일Thu':    entry.dayThu || '0',
      '요일Fri':    entry.dayFri || '0',
      '요일Sat':    entry.daySat || '0',
      '진단코드':   entry.diagCode || '',
      '상태':       entry.status || 'Active',
      '케어매니저': entry.careManager || '',
      'PDF링크':    entry.pdfLink || '',
      '메모':       entry.note || '',
    };
    if (isEdit) return this.update('auth', entry.id, data);
    return this.append('auth', data);
  },
  async deleteAuth(id) { return this.delete('auth', id); },

  async loadAuth() {
    const res = await this.read('auth');
    if (!res.ok) return [];
    return (res.data || []).map(function(r) {
      return {
        id:          String(r['ID'] || ''),
        memberId:    String(r['멤버ID'] || ''),
        insurer:     String(r['보험사'] || ''),
        authNo:      String(r['Auth번호'] || ''),
        serviceType: String(r['서비스유형'] || ''),   // SDC / Transportation
        serviceCode: String(r['서비스코드'] || ''),   // S5105 / T2003 / A0100 / S5102
        startDate:   String(r['시작일'] || ''),
        endDate:     String(r['종료일'] || ''),
        totalQty:    String(r['총수량'] || ''),
        qtyUnit:     String(r['수량단위'] || ''),     // Day / Trip
        freqPerWeek: String(r['주당빈도'] || ''),
        dayMon:      String(r['요일Mon'] || '0'),
        dayTue:      String(r['요일Tue'] || '0'),
        dayWed:      String(r['요일Wed'] || '0'),
        dayThu:      String(r['요일Thu'] || '0'),
        dayFri:      String(r['요일Fri'] || '0'),
        daySat:      String(r['요일Sat'] || '0'),
        diagCode:    String(r['진단코드'] || ''),
        status:      String(r['상태'] || 'Active'),
        careManager: String(r['케어매니저'] || ''),
        pdfLink:     String(r['PDF링크'] || ''),
        note:        String(r['메모'] || ''),
      };
    });
  },

  // ══════════════════════════════════════════════════════════
  // 방문자 / 회의록
  // ══════════════════════════════════════════════════════════

  async saveVisitor(entry, isEdit) {
    const data = {
      'ID':   entry.id,  '날짜': entry.date, '시간': entry.time,
      '이름': entry.name, '소속': entry.org || '',
      '목적': entry.purpose || '', '메모': entry.note || '',
    };
    if (isEdit) return this.update('visitor', entry.id, data);
    return this.append('visitor', data);
  },
  async deleteVisitor(id) { return this.delete('visitor', id); },

  async saveCouncil(entry, isEdit) {
    const data = {
      'ID':     entry.id,   '날짜':   entry.date,  '시간':   entry.time,
      '유형':   entry.type, '참석자': entry.attendees || '',
      '안건':   entry.agenda || '', '내용': entry.minutes || '',
      '다음회의': entry.next || '',
    };
    if (isEdit) return this.update('council', entry.id, data);
    return this.append('council', data);
  },
  async deleteCouncil(id) { return this.delete('council', id); },

  // ══════════════════════════════════════════════════════════
  // 전체 데이터 로드 (앱 시작 시)
  // ══════════════════════════════════════════════════════════

  async loadAll() {
    const [iR, aR, cR, authR, vR, coR] = await Promise.all([
      this.read('incident'),
      this.read('activity'),
      this.read('caselog'),
      this.loadAuth(),
      this.read('visitor'),
      this.read('council'),
    ]);
    return {
      incidents:  iR.ok ? (iR.data  || []) : [],
      activities: aR.ok ? (aR.data  || []) : [],
      cases:      cR.ok ? (cR.data  || []) : [],
      authList:   Array.isArray(authR) ? authR : [],
      visitorList: vR.ok ? (vR.data || []).map(function(r){
        return { id:String(r['ID']||''), date:String(r['날짜']||'').slice(0,10), time:String(r['시간']||''),
                 name:String(r['이름']||''), org:String(r['소속']||''),
                 purpose:String(r['목적']||''), note:String(r['메모']||'') };
      }) : [],
      councilList: coR.ok ? (coR.data || []).map(function(r){
        return { id:String(r['ID']||''), date:String(r['날짜']||'').slice(0,10), time:String(r['시간']||''),
                 type:String(r['유형']||''), attendees:String(r['참석자']||''),
                 agenda:String(r['안건']||''), minutes:String(r['내용']||''), next:String(r['다음회의']||''),
                 pdfLink:String(r['PDF링크']||'') };
      }) : [],
    };
  },

  // ══════════════════════════════════════════════════════════
  // UI 헬퍼
  // ══════════════════════════════════════════════════════════

  setStatusPill(ok) {
    const pill = document.getElementById('api-pill');
    if (!pill) return;
    pill.className   = ok ? 'api-pill api-ok' : 'api-pill api-no';
    pill.textContent = ok ? '✅ Sheets 연동' : '⚡ Sheets 미연동';
    this._connected  = ok;
  },
};

// ── 기존 코드 호환 래퍼 ────────────────────────────────────────
async function apiCall(data) {
  try {
    const r = await fetch(SheetsAPI.URL, { method: 'POST', body: JSON.stringify(data) });
    return r.json();
  } catch(e) { return { ok: false, error: e.message }; }
}

async function apiGet(data) {
  try {
    const qs  = new URLSearchParams(data).toString();
    const res = await fetch(SheetsAPI.URL + '?' + qs);
    return res.json();
  } catch(e) { return { ok: false, error: e.message }; }
}

async function saveJSONtoDrive(mid, mName, fileType, jsonData) {
  return SheetsAPI.saveJSON(mid, mName, fileType, jsonData);
}

async function loadJSONfromDrive(mid, mName, fileType) {
  return SheetsAPI.loadJSON(mid, mName, fileType);
}

var API_URL = SheetsAPI.URL;
