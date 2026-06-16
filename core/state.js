// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 전역 상태 & 상수
// core/state.js
// ══════════════════════════════════════════════════════════════

// ── 상수 ─────────────────────────────────────────────────────
const ALLOWED_EMAILS = ['numberone.adc.manager@gmail.com', 'chouung11@gmail.com', 'numberone.adc.lee@gmail.com'];
const CLIENT_ID = '163454046018-4q9ba9dhv68mudfhmt0ivn8525fld58e.apps.googleusercontent.com';

const DKR  = {Mon:'월',Tue:'화',Wed:'수',Thu:'목',Fri:'금',Sat:'토',Sun:'일'};
const DKEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DFUL  = {Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday'};
const DNAMES = ['일','월','화','수','목','금','토'];

const SI = {
  in:       {label:'출석', badge:'b-ok',       icon:'✅'},
  late:     {label:'지각', badge:'b-late',      icon:'⏰'},
  absent:   {label:'결석', badge:'b-absent',    icon:'❌'},
  travel:   {label:'여행', badge:'b-travel',    icon:'✈️'},
  hospital: {label:'입원', badge:'b-hospital',  icon:'🏥'},
  leave:    {label:'휴가', badge:'b-leave',      icon:'🏖️'},
};

const QT = {
  in:       ['정시 등원','특이사항 없음'],
  late:     ['교통 지연','30분 지각','1시간 지각'],
  absent:   ['보호자 연락','사전 통보','무단결석'],
  travel:   ['국내 여행','해외 여행','귀국 예정일 확인'],
  hospital: ['입원 중','외래 진료','퇴원 예정일 확인'],
  leave:    ['개인 사정','가족 행사'],
};

const ADL_ITEMS = ['이동 (Mobility)','이동 보조 (Transfers)','화장실 (Toileting)','실금 (Continence)','식사 (Eating)'];
const ADL_OPTS  = ['Independent','Supervision','Limited Assistance','Extensive Assistance','Total Dependence'];

const PER = 10; // 멤버 목록 페이지당 수

const STORAGE_KEY = 'numberone_v1';

const BILLING_CONFIG = {
  NPI: '1154194504',
  providerName: 'NUMBER ONE ADULT DAYCARE',
  providerAddr: '161-22 NORTHERN BLVD 1FL, FLUSHING, NY 11358',
  ein: '93-4271990',
  taxonomy: '261QA0600X',
  revenueCode: '3104',
  pcn: '1057',
  payers: {
    Anthem_MLTC: {name:'HEALTHPLUS', payerId:'45302'},
    Anthem_MAP:  {name:'HEALTHPLUS', payerId:'45302'},
    CLP: {name:'CENTERLIGHT PACE', payerId:'13360'},
    SWH: {name:'SENIOR WHOLE HEALTH', payerId:'631490'},
  },
  codes: {
    Anthem_MLTC: [{code:'S5105',desc:'DAY CARE SERVICES CENTER-BASED SERVICES NOT INCLUDED IN PROGRAM FEE PER DIEM',charge:60,units:1},{code:'A0100',desc:'NONEMERGENCY TRANSPORTATION TAXI',charge:12.5,units:2}],
    Anthem_MAP:  [{code:'S5105',desc:'DAY CARE SERVICES CENTER-BASED SERVICES NOT INCLUDED IN PROGRAM FEE PER DIEM',charge:60,units:1},{code:'A0100',desc:'NONEMERGENCY TRANSPORTATION TAXI',charge:12.5,units:2}],
    CLP: [{code:'S5105',desc:'DAY CARE SERVICES CENTER-BASED SERVICES NOT INCLUDED IN PROGRAM FEE PER DIEM',charge:100,units:1},{code:'T2003',desc:'NONEMERGENCY TRANSPORTATION ENCOUNTER/TRIP',charge:15,units:2}],
    SWH: [{code:'S5102',desc:'DAY CARE SERVICES ADULT PER DIEM',charge:90,units:1}],
  },
};

// ── 런타임 상태 ───────────────────────────────────────────────
var _currentUser = null;

// 출결 데이터: { 'YYYY-MM-DD': { memberId: { status, signIn, signOut, memo, ... } } }
var allR = {};

// 로그
var incidents  = [];
var activities = [];
var cases      = [];

// 멤버 목록 필터/페이지
var mFilt = [];
var mPage = 0;

// 출결 모달 상태
var popId   = null;
var popDate = null;
var mCurSt  = null;
var editId  = null;

// PCSP 스텝
var selDays = new Set();
var curStep = 0;

// 오늘 날짜 (ISO)
// 로컬 시간 기준 — toISOString()은 UTC라 저녁 8시 이후 다음날 날짜가 나옴
const todayISO = (() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
})();
const weekAgoISO = (() => {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
})();

// 현재 출결 탭 날짜
var curDate = new Date();

// Auth
var AUTH_LIST = [];

// Visitor / Council
var VISITOR_LIST = [];
var COUNCIL_LIST = [];

// Billing
var _billFrom = '', _billTo = '', _billIns = 'Anthem_MLTC', _billView = 'member', _billData = [];

// Assessment
var _asmt = { mid: null, type: 'Initial', step: 0 };
var _asSig = null, _ptSig = null;

// Nutrition Screening
var _nsMid = null, _nsMemberSig = null, _nsStaffSig = null;

// Member Rights
var _mrMid = null, _mrSig = null;

// 멤버 사진 캐시
var mp = {};

// 멤버/스태프 목록 (data/members.js에서 채워짐)
var MEMBERS = [];
var STAFF = [];
var DEFAULT_STAFF = [];
