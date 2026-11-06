// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 로그인 세션 (케어관리 · 업무관리 공용)
// core/session.js
// - 서버에 보낼 구글 로그인 증명(ID token) 보관 · 만료 전 자동 갱신
// - 허용 직원 확인은 서버(whoami)가 담당 (화면 코드에 이메일 목록 없음)
// - 15분 동안 조작이 없으면 화면 잠금 (13분에 경고)
// - 작성자 칸 자동 입력 · 삭제 사유 입력
// ══════════════════════════════════════════════════════════════
var ADCSession = (function () {
  var IDLE_MS = 15 * 60 * 1000, WARN_MS = 13 * 60 * 1000, CHECK_MS = 20 * 1000;
  var token = null, exp = 0, user = null, locked = false, lastActivity = Date.now();
  var refreshTimer = null, idleTimer = null, warnShown = false;
  var WRITER_IDS = ['inc-writer', 'act-writer', 'case-writer', 'dact-writer', 'disp-writer', 'f-writer', 'p-writer'];

  function parseJwt(t) {
    try {
      var b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(b).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
    } catch (e) { return {}; }
  }
  function apiURL() { return (typeof ADC_CONFIG !== 'undefined' && ADC_CONFIG.apiURL) || ''; }

  // ── 로그인 증명 ────────────────────────────────────────────
  function setToken(cred) {
    var p = parseJwt(cred);
    token = cred; exp = Number(p.exp || 0) * 1000;
    clearTimeout(refreshTimer);
    // 만료 5분 전에 조용히 새 증명 요청 (자동 로그인). 실패하면 만료 시 다시 로그인 안내.
    var ms = Math.max(0, exp - Date.now() - 5 * 60 * 1000);
    refreshTimer = setTimeout(function () { if (!locked) { try { google.accounts.id.prompt(); } catch (e) {} } }, ms);
    return p;
  }
  function getToken() {
    if (locked || !token) return null;
    if (exp && Date.now() >= exp) { lock('로그인이 만료되었습니다. 다시 로그인해주세요.'); return null; }
    return token;
  }
  function requireToken() {
    var t = getToken();
    if (!t) throw new Error('AUTH_REQUIRED: 로그인이 필요합니다.');
    return t;
  }

  // 구글 로그인 버튼/자동 로그인 콜백에서 호출. startApp(user)는 처음 로그인했을 때만 실행.
  async function handleCredential(response, startApp, showError) {
    var p = parseJwt(response.credential), email = String(p.email || '').toLowerCase();
    if (user && user.email === email) { setToken(response.credential); unlock(); return; } // 갱신 또는 잠금 해제
    if (user && user.email !== email) { location.reload(); return; }                     // 다른 계정 → 화면 초기화
    setToken(response.credential);
    try {
      var res = await fetch(apiURL() + '?action=whoami&authToken=' + encodeURIComponent(response.credential), { cache: 'no-store' });
      var data = await res.json();
      if (!data || data.ok !== true || !data.data || !data.data.user) throw new Error((data && data.error) || '접속 권한을 확인하지 못했습니다.');
      user = data.data.user;
      if (!user.name) user.name = p.name || email;
      user.picture = p.picture || '';
      startIdleWatch();
      if (startApp) startApp(user, p);
    } catch (e) {
      token = null; exp = 0;
      var msg = String(e.message || e).replace(/^Error:\s*/, '').replace(/^AUTH_[A-Z]+:\s*/, '');
      if (showError) showError('❌ ' + msg); else alert(msg);
    }
  }

  // 서버가 로그인 문제로 거절했을 때 (각 페이지의 API 함수에서 호출)
  function onApiError(msg) {
    msg = String(msg || '');
    if (!user || locked) return;
    if (/AUTH_DENIED/.test(msg)) { lock('접근 권한이 중지되었습니다. 관리자에게 문의해주세요.', true); return; }
    if (/AUTH_(EXPIRED|REQUIRED|INVALID)/.test(msg)) lock('로그인이 만료되었습니다. 다시 로그인해주세요.');
  }

  // ── 자동 잠금 ─────────────────────────────────────────────
  function activity() {
    lastActivity = Date.now();
    if (warnShown) { warnShown = false; var w = document.getElementById('adc-idle-warn'); if (w) w.remove(); }
  }
  function startIdleWatch() {
    if (idleTimer) return;
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, activity, { passive: true, capture: true });
    });
    lastActivity = Date.now();
    idleTimer = setInterval(checkIdle, CHECK_MS);
  }
  function checkIdle() {
    if (locked || !user) return;
    var idle = Date.now() - lastActivity;
    if (idle >= IDLE_MS) { lock('15분 동안 사용하지 않아 화면을 잠갔습니다. 다시 로그인해주세요.'); return; }
    if (idle >= WARN_MS && !warnShown) {
      warnShown = true;
      var w = document.createElement('div');
      w.id = 'adc-idle-warn'; w.setAttribute('role', 'alert');
      w.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:100000;background:#FF9500;color:#fff;font-weight:700;font-size:14px;padding:12px 18px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:inherit';
      w.textContent = '⏰ 2분 뒤 화면이 잠깁니다. 계속 사용하려면 화면을 눌러주세요.';
      document.body.appendChild(w);
    }
  }
  function lock(message, denied) {
    locked = true; token = null; exp = 0; clearTimeout(refreshTimer);
    var w = document.getElementById('adc-idle-warn'); if (w) w.remove();
    var ov = document.getElementById('adc-lock');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'adc-lock';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(242,242,247,.98);display:flex;align-items:center;justify-content:center;font-family:inherit';
      ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:360px;width:90%;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.12)">'
        + '<div style="font-size:34px;margin-bottom:8px">🔒</div><div id="adc-lock-msg" style="font-size:14px;font-weight:700;color:#1C1C1E;margin-bottom:6px"></div>'
        + '<div id="adc-lock-user" style="font-size:12px;color:#8E8E93;margin-bottom:16px"></div><div id="adc-lock-btn" style="display:flex;justify-content:center"></div>'
        + '<div style="font-size:11px;color:#8E8E93;margin-top:14px">작성 중이던 내용은 같은 계정으로 다시 로그인하면 그대로 남아 있습니다.</div></div>';
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
    document.getElementById('adc-lock-msg').textContent = message || '화면이 잠겼습니다.';
    document.getElementById('adc-lock-user').textContent = user ? (user.name + ' · ' + user.email) : '';
    try {
      google.accounts.id.renderButton(document.getElementById('adc-lock-btn'), { theme: 'outline', size: 'large', width: 280 });
      if (!denied) google.accounts.id.prompt();
    } catch (e) {}
  }
  function unlock() {
    locked = false; lastActivity = Date.now(); warnShown = false;
    var ov = document.getElementById('adc-lock'); if (ov) ov.style.display = 'none';
  }

  // ── 작성자 칸: 로그인한 직원 이름 자동 · 수정 불가 ─────────
  function fillWriters() {
    if (!user) return;
    WRITER_IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.readOnly = true; el.title = '로그인한 직원 이름이 자동으로 들어갑니다';
      el.style.background = '#F2F2F7';
      if (!String(el.value || '').trim()) el.value = user.name;
    });
  }

  // ── 삭제 사유 (6년 보관 기록에 남음) ──────────────────────
  function deleteReason(body) {
    if (!body || body.action !== 'delete' || String(body.reason || '').trim()) return body;
    var r = window.prompt('삭제 사유를 입력해주세요.\n(원본은 삭제 보관함에 6년간 보관되고, 사유와 삭제한 직원이 함께 기록됩니다)', '');
    if (r === null || !String(r).trim()) throw new Error('삭제 사유가 없어 삭제를 취소했습니다.');
    return Object.assign({}, body, { reason: String(r).trim() });
  }

  // 화면에 보여줄 오류 문장 (AI_DISABLED 등 내부 코드는 떼고 보여줌. AUTH_ 코드는 잠금 판단용으로 유지)
  function cleanError(m) { return String(m || '').replace(/^(AI_DISABLED|DELETE_REASON_REQUIRED|AUTH_ADMIN|AUTH_CONFIG):\s*/, ''); }

  return {
    cleanError: cleanError, handleCredential: handleCredential, getToken: getToken, requireToken: requireToken, onApiError: onApiError,
    fillWriters: fillWriters, deleteReason: deleteReason, lock: lock,
    user: function () { return user; }, userName: function () { return user ? user.name : ''; },
    isAdmin: function () { return !!(user && user.role === 'admin'); },
    _test: { setUser: function (u) { user = u; }, setToken: setToken, checkIdle: checkIdle, setLast: function (t) { lastActivity = t; }, startIdleWatch: startIdleWatch }
  };
})();

// 작성자 칸이 있는 창이 열리면 자동으로 채움 (모달/폼이 열린 직후)
['click', 'focusin'].forEach(function (ev) {
  document.addEventListener(ev, function () { setTimeout(function () { if (window.ADCSession) ADCSession.fillWriters(); }, 0); }, true);
});
