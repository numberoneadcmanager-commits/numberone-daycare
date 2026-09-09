// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — Google Sheets API v6
// ══════════════════════════════════════════════════════════════
const SHEETS = {
  멤버: ['ID','한글이름','영문이름','LastName','FirstName','MiddleName','Medicaid','MLTC','주치의','출석요일','전화','주소','City','State','Zip','성별','진단코드','생년월일','보험사','상태','Disenroll날짜','메모','홈케어회사','홈케어Sun','홈케어Mon','홈케어Tue','홈케어Wed','홈케어Thu','홈케어Fri','홈케어Sat','avBg','avColor'],
  스태프:   ['ID','한글이름','영문이름','직책','전화','이메일','자격증','avBg','avColor'],
  PCSP:    ['ID','작성일','멤버ID','한글이름','작성자','갱신예정일','진단','목표1','목표2','목표3','상태'],
  출결:    ['날짜','멤버ID','한글이름','상태','Sign-in','Sign-out','메모','시작일','종료일','수정시각','작성자'],
  incident:['ID','날짜','시간','멤버ID','한글이름','심각도','유형','장소','설명','조치','목격자','DOH보고','작성자','작성시각'],
  activity:['ID','날짜','멤버ID','한글이름','활동명','카테고리','참여도','메모','작성자','작성시각'],
  caselog: ['ID','날짜','멤버ID','한글이름','유형','제목','내용','담당기관','담당자','팔로업날짜','상태','결과','작성자','작성시각'],
  auth: ['ID','멤버ID','보험사','Auth번호','서비스유형','서비스코드','시작일','종료일','총수량','수량단위','주당빈도','요일Mon','요일Tue','요일Wed','요일Thu','요일Fri','요일Sat','상태','케어매니저','PDF링크','메모','수정시각','진단코드', '상태',],
  visitor:   ['ID','날짜','시간','이름','소속','목적','메모'],
  council:   ['ID','날짜','시간','유형','참석자','안건','내용','다음회의'],
  grievance: ['ID','날짜','유형','멤버','내용','조치','담당자','상태','결과'],
  firedrill: ['ID','날짜','시간','참석인원','소요시간','유형','담당자','메모'],
  templog:   ['ID','날짜','시간','유형','측정값','단위','기록자','메모'],
  docs:      ['ID','이름','카테고리','발급일','만료일','Drive링크','메모','수정시각'],
  op_activity:['ID','날짜','시간','활동명','카테고리','담당자','메모','수정시각'],
  training_log:['ID','세션ID','날짜','시간','토픽','RN이름','RN_LicenseID','수퍼바이저','스태프ID','스태프이름','작성시각'],
  PDFLog:    ['ID','저장일시','멤버ID','한글이름','파일종류','파일명','Drive링크','작성자'],
  JSONLog:   ['ID','저장일시','멤버ID','한글이름','파일종류','파일명','Drive링크','작성자'],
  medlib: ['ID','이름','이유'],
};

// ── 응답 생성 ──────────────────────────────────────────────
function makeResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function okResponse(data)  { return makeResponse({ ok: true,  data: data }); }
function errResponse(msg)  { return makeResponse({ ok: false, error: msg }); }

// ── GET 핸들러 ─────────────────────────────────────────────
function doGet(e) {
  try {
    var p = e.parameter;
    if (!p.action) return okResponse({ status: 'ok', time: new Date().toISOString() });
    if (p.action === 'ping')         return okResponse({ status: 'ok', time: new Date().toISOString() });
    if (p.action === 'initSheets')   return okResponse(initAllSheets());
    if (p.action === 'read')         return okResponse(readSheet(p.sheet));
    if (p.action === 'readByMember') return okResponse(readByMember(p.sheet, p.memberId));
    if (p.action === 'readByDate')   return okResponse(readByDate(p.sheet, p.date));
    if (p.action === 'readByRange')  return okResponse(readByRange(p.sheet, p.from, p.to));
    if (p.action === 'loadJSON')     return okResponse(loadJSONfromDrive(p));
    if (p.action === 'dedup')        return okResponse(deduplicateAttendance());
    return errResponse('Unknown action: ' + p.action);
  } catch(err) {
    return errResponse(err.toString());
  }
}

// ── POST 핸들러 ────────────────────────────────────────────
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var sheet  = body.sheet;
    var data   = body.data;
    var key    = body.key;
    var value  = body.value;
    var id     = body.id;

    if (action === 'append')   return okResponse(appendRow(sheet, data));
    // 출결 upsert는 날짜+멤버ID 복합키로 처리
    if (action === 'upsert' && sheet === '출결') return okResponse(upsertAttendance(data));
    if (action === 'upsert')   return okResponse(upsertRow(sheet, key, value, data));
    if (action === 'update')   return okResponse(updateById(sheet, id, data));
    if (action === 'delete')   return okResponse(deleteById(sheet, id));
    if (action === 'replace')  return okResponse(replaceAll(sheet, body.rows));
    if (action === 'savePDF')  return okResponse(savePDFtoDrive(body));
    if (action === 'saveJSON') return okResponse(saveJSONtoDrive(body));
    if (action === 'aiReadAuth') return okResponse(aiReadAuth(body));
    if (action === 'fillPCSP') return okResponse(fillPCSP(body));
    if (action === 'aiPCSP')   return okResponse(callClaudeForPCSP(body));
    return errResponse('Unknown action: ' + action);
  } catch(err) {
    return errResponse(err.toString());
  }
}

// ── 시트 초기화 ────────────────────────────────────────────
function initAllSheets() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];
  var updated = [];

  for (var name in SHEETS) {
    var headers = SHEETS[name];
    var sh      = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold')
        .setBackground('#D85A30')
        .setFontColor('#ffffff');
      sh.setFrozenRows(1);
      created.push(name);
    } else {
      var existHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var added = false;
      for (var i = 0; i < headers.length; i++) {
        if (existHeaders.indexOf(headers[i]) === -1) {
          var newCol = existHeaders.length + 1;
          sh.getRange(1, newCol).setValue(headers[i])
            .setFontWeight('bold')
            .setBackground('#D85A30')
            .setFontColor('#ffffff');
          existHeaders.push(headers[i]);
          added = true;
        }
      }
      if (added) updated.push(name);
    }
  }

  return { initialized: created, updated: updated };
}

// ── 읽기 ──────────────────────────────────────────────────
function readSheet(sheetName) {
  var sh = getSheet(sheetName);
  if (!sh) return [];
  return sheetToObjects(sh);
}

function readByMember(sheetName, memberId) {
  return readSheet(sheetName).filter(function(r) {
    return String(r['멤버ID']) === String(memberId);
  });
}

function readByDate(sheetName, date) {
  return readSheet(sheetName).filter(function(r) {
    var raw = r['날짜'];
    var iso;
    if (raw instanceof Date) {
      iso = Utilities.formatDate(raw, 'America/New_York', 'yyyy-MM-dd');
    } else {
      iso = String(raw).slice(0, 10); // 문자열은 그대로 비교 (타임존 변환 금지)
    }
    return iso === date;
  });
}

function readByRange(sheetName, from, to) {
  return readSheet(sheetName).filter(function(r) {
    var raw = r['날짜'];
    var iso;
    if (raw instanceof Date) {
      iso = Utilities.formatDate(raw, 'America/New_York', 'yyyy-MM-dd');
    } else {
      iso = String(raw).slice(0, 10);
    }
    // 문자열 비교 (YYYY-MM-DD 형식은 사전순 = 날짜순)
    return iso >= from && iso <= to;
  });
}

// ── 출결 전용 Upsert (날짜 + 멤버ID 복합키) ───────────────
function upsertAttendance(data) {
  // 동시 접근 방지 — Race condition 차단
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch(e) {
    return { success: false, error: 'Lock timeout' };
  }

  try {
    var sh = getSheet('출결');
    if (!sh) return { success: false, error: '출결 시트 없음' };
    var headers = getHeaders(sh);
    var all = sh.getDataRange().getValues();

    var dateCol = headers.indexOf('날짜');
    var midCol  = headers.indexOf('멤버ID');

    var targetDate = String(data['날짜']).slice(0, 10);
    var targetMid  = String(data['멤버ID']);

    var foundRow = -1;
    for (var i = 1; i < all.length; i++) {
      var rowRaw  = all[i][dateCol];
      var rowDate = rowRaw instanceof Date
        ? Utilities.formatDate(rowRaw, 'America/New_York', 'yyyy-MM-dd')
        : String(rowRaw).slice(0, 10);
      var rowMid = String(all[i][midCol]);
      if (rowDate === targetDate && rowMid === targetMid) {
        foundRow = i + 1;
        break;
      }
    }

    data['수정시각'] = new Date().toLocaleString('ko-KR');
    var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });

    if (foundRow > 0) {
      sh.getRange(foundRow, 1, 1, headers.length).setValues([row]);
      return { success: true, action: 'updated' };
    } else {
      sh.appendRow(row);
      return { success: true, action: 'inserted' };
    }
  } finally {
    lock.releaseLock();
  }
}

// ── 추가 ──────────────────────────────────────────────────
function appendRow(sheetName, data) {
  var sh = getSheet(sheetName);
  if (!sh) return { success: false, error: 'Sheet not found: ' + sheetName };
  var headers = getHeaders(sh);
  if (headers.indexOf('ID') >= 0 && !data['ID']) {
    data['ID'] = sheetName.slice(0,3).toUpperCase() + Date.now();
  }
  if (!data['작성시각']) data['작성시각'] = new Date().toLocaleString('ko-KR');
  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
  sh.appendRow(row);
  return { success: true, id: data['ID'] };
}

// ── Upsert ─────────────────────────────────────────────────
function upsertRow(sheetName, key, value, data) {
  var sh = getSheet(sheetName);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var keyCol = headers.indexOf(key);
    if (keyCol < 0) return { success: false, error: 'key column not found: ' + key };

    var lastRow = sh.getLastRow();
    var rowIndex = -1;
    if (lastRow > 1) {
      var keyVals = sh.getRange(2, keyCol + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keyVals.length; i++) {
        if (String(keyVals[i][0]) === String(value)) { rowIndex = i + 2; break; }
      }
    }

    if (rowIndex > 0) {
      // ★ 기존 행 업데이트: 빈 문자열/undefined 필드는 기존 값 유지
      var existing = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      var newRow = headers.map(function(h, idx) {
        var v = data[h];
        if (v === undefined || v === null || String(v) === '') {
          return existing[idx];  // 기존 값 유지
        }
        return v;
      });
      sh.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
      return { success: true, action: 'updated', row: rowIndex };
    } else {
      // 신규 행 추가
      var newRow2 = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
      sh.appendRow(newRow2);
      return { success: true, action: 'inserted' };
    }
  } finally {
    lock.releaseLock();
  }
}


// ── 업데이트 / 삭제 ────────────────────────────────────────
function updateById(sheetName, id, data) {
  var sh = getSheet(sheetName);
  if (!sh) return { success: false, error: 'Sheet not found: ' + sheetName };
  var headers = getHeaders(sh);
  var idCol   = headers.indexOf('ID');
  if (idCol === -1) return { success: false, error: 'No ID column' };
  var all = sh.getDataRange().getValues();
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][idCol]) === String(id)) {
      data['수정시각'] = new Date().toLocaleString('ko-KR');
      var row = headers.map(function(h, j) { return data[h] !== undefined ? data[h] : all[i][j]; });
      sh.getRange(i+1, 1, 1, headers.length).setValues([row]);
      return { success: true };
    }
  }
  return { success: false, error: 'Row not found: ' + id };
}

function deleteById(sheetName, id) {
  var sh = getSheet(sheetName);
  if (!sh) return { success: false, error: 'Sheet not found: ' + sheetName };
  var headers = getHeaders(sh);
  var idCol   = headers.indexOf('ID');
  if (idCol === -1) return { success: false, error: 'No ID column' };
  var all = sh.getDataRange().getValues();
  for (var i = all.length - 1; i >= 1; i--) {
    if (String(all[i][idCol]) === String(id)) { sh.deleteRow(i+1); return { success: true }; }
  }
  return { success: false, error: 'Row not found: ' + id };
}

// ── 전체 교체 ──────────────────────────────────────────────
function replaceAll(sheetName, rows) {
  var sh = getSheet(sheetName);
  if (!sh) return { success: false, error: 'Sheet not found: ' + sheetName };
  if (!rows || !rows.length) return { success: true, rows: 0 };
  var headers = getHeaders(sh);
  var lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow-1, sh.getLastColumn()).clearContent();
  var data = rows.map(function(obj) {
    return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  });
  if (data.length > 0) sh.getRange(2, 1, data.length, headers.length).setValues(data);
  return { success: true, rows: data.length };
}

// ══════════════════════════════════════════════════════════════
// JSON → Google Drive 저장/로드
// ══════════════════════════════════════════════════════════════
function saveJSONtoDrive(body) {
  var memberId   = body.memberId;
  var memberName = body.memberName;
  var fileType   = body.fileType;
  var jsonData   = body.jsonData;
  var author     = body.author || 'System';

  if (!memberId || !memberName || !fileType || !jsonData) {
    return { success: false, error: '필수 항목 없음 (memberId, memberName, fileType, jsonData)' };
  }

  var fileName   = fileType + '_' + memberId + '.json';
  var rootFolder   = getOrCreateFolder('NumberOne ADC', DriveApp.getRootFolder());
  var memberFolder = getOrCreateFolder(memberName + '(' + memberId + ')', rootFolder);

  var existFiles = memberFolder.getFilesByName(fileName);
  while (existFiles.hasNext()) { existFiles.next().setTrashed(true); }

  var blob = Utilities.newBlob(
    JSON.stringify(jsonData, null, 2),
    'application/json',
    fileName
  );
  var file    = memberFolder.createFile(blob);
  var fileUrl = file.getUrl();
  var fileId  = file.getId();

  appendRow('JSONLog', {
    '멤버ID':   memberId,
    '한글이름':  memberName,
    '파일종류':  fileType,
    '파일명':   fileName,
    'Drive링크': fileUrl,
    '저장일시':  new Date().toLocaleString('ko-KR'),
    '작성자':   author
  });

  return { success: true, fileName: fileName, url: fileUrl, fileId: fileId };
}

function loadJSONfromDrive(p) {
  var memberId   = p.memberId;
  var memberName = p.memberName;
  var fileType   = p.fileType;

  if (!memberId || !fileType) {
    return { found: false, error: '필수 항목 없음 (memberId, fileType)' };
  }

  var fileName = fileType + '_' + memberId + '.json';
  var rootFolders = DriveApp.getRootFolder().getFoldersByName('NumberOne ADC');
  if (!rootFolders.hasNext()) return { found: false, error: 'NumberOne ADC 폴더 없음' };
  var rootFolder  = rootFolders.next();

  var memberFolderName = memberName ? memberName + '(' + memberId + ')' : null;
  var memberFolder     = null;

  if (memberFolderName) {
    var dirs = rootFolder.getFoldersByName(memberFolderName);
    if (dirs.hasNext()) memberFolder = dirs.next();
  }

  if (!memberFolder) {
    var allFolders = rootFolder.getFolders();
    while (allFolders.hasNext()) {
      var f = allFolders.next();
      if (f.getName().indexOf('(' + memberId + ')') !== -1) { memberFolder = f; break; }
    }
  }

  if (!memberFolder) return { found: false, error: '멤버 폴더 없음: ' + memberId };

  var files = memberFolder.getFilesByName(fileName);
  if (!files.hasNext()) return { found: false, error: '파일 없음: ' + fileName };

  var content = files.next().getBlob().getDataAsString();
  try {
    return { found: true, data: JSON.parse(content) };
  } catch(e) {
    return { found: false, error: 'JSON 파싱 실패: ' + e.toString() };
  }
}

// ══════════════════════════════════════════════════════════════
// PDF → Google Drive 저장
// ══════════════════════════════════════════════════════════════
function savePDFtoDrive(body) {
  var memberId   = body.memberId;
  var memberName = body.memberName;
  var fileType   = body.fileType;
  var base64Data = body.base64Data;
  var author     = body.author || 'System';

  if (!memberId || !memberName || !fileType || !base64Data) {
    return { success: false, error: '필수 항목 없음 (memberId, memberName, fileType, base64Data)' };
  }

  var today    = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  var fileName = fileType + '_' + today + '.pdf';
  var rootFolder   = getOrCreateFolder('NumberOne ADC', DriveApp.getRootFolder());
  var memberFolder = getOrCreateFolder(memberName + '(' + memberId + ')', rootFolder);

  // ★ 같은 이름의 예전 파일이 있으면 먼저 삭제 (안 그러면 같은 이름 파일이 중복 생성돼서
  //   나중에 Drive에서 옛날 버전을 잘못 열어보는 문제가 생김)
  var existFiles = memberFolder.getFilesByName(fileName);
  while (existFiles.hasNext()) { existFiles.next().setTrashed(true); }

  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    'application/pdf',
    fileName
  );
  var file    = memberFolder.createFile(blob);
  var fileUrl = file.getUrl();

  appendRow('PDFLog', {
    '멤버ID':   memberId,
    '한글이름':  memberName,
    '파일종류':  fileType,
    '파일명':   fileName,
    'Drive링크': fileUrl,
    '저장일시':  new Date().toLocaleString('ko-KR'),
    '작성자':   author
  });

  return { success: true, fileName: fileName, url: fileUrl };
}

// ══════════════════════════════════════════════════════════════
// 출결 중복 제거
// ══════════════════════════════════════════════════════════════
function deduplicateAttendance() {
  var sh = getSheet('출결');
  if (!sh) return { success: false, error: '출결 시트 없음' };

  var headers = getHeaders(sh);
  var dateCol = headers.indexOf('날짜');
  var midCol  = headers.indexOf('멤버ID');
  var modCol  = headers.indexOf('수정시각');
  var all     = sh.getDataRange().getValues();

  // 날짜+멤버ID별 최신 행만 유지
  var seen  = {}; // key → 최신 행 인덱스
  var dups  = []; // 삭제할 행 번호 (내림차순)

  for (var i = 1; i < all.length; i++) {
    var rowRaw  = all[i][dateCol];
    var rowDate = rowRaw instanceof Date
      ? Utilities.formatDate(rowRaw, 'America/New_York', 'yyyy-MM-dd')
      : String(rowRaw).slice(0, 10);
    var rowMid  = String(all[i][midCol]);
    var key     = rowDate + '_' + rowMid;

    if (!rowDate || !rowMid) continue;

    if (seen[key] !== undefined) {
      // 이미 있으면 수정시각 비교해서 오래된 것 삭제
      var prevIdx  = seen[key];
      var prevTime = String(all[prevIdx - 1][modCol]);
      var curTime  = String(all[i][modCol]);
      if (curTime >= prevTime) {
        // 현재 행이 더 최신 → 이전 행 삭제
        dups.push(prevIdx);
        seen[key] = i + 1;
      } else {
        // 이전 행이 더 최신 → 현재 행 삭제
        dups.push(i + 1);
      }
    } else {
      seen[key] = i + 1;
    }
  }

  // 내림차순으로 삭제 (위에서 삭제하면 인덱스 밀림)
  dups.sort(function(a, b) { return b - a; });
  dups.forEach(function(rowNum) { sh.deleteRow(rowNum); });

  return { success: true, removed: dups.length };
}

// ── GET 핸들러에 dedup 액션 추가 ──────────────────────────────
function getOrCreateFolder(name, parent) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

// ── 유틸 ──────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}
function getHeaders(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}
function sheetToObjects(sh) {
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var headers = vals[0];
  var result  = [];
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (!row.some(function(c) { return c !== ''; })) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) { obj[headers[j]] = row[j]; }
    result.push(obj);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════
// PCSP 문서 생성 — 템플릿 파일 없이 코드로 직접 생성 (PCSP_Sample.docx 구조 기준)
// 템플릿 파일 관리/손상 위험을 원천 제거하기 위해 DocumentApp API로 문서를 처음부터 구성함
// ══════════════════════════════════════════════════════════════

function fillPCSP(data) {
  try {
    var memberName = data.memberName || 'Unknown';
    var memberId   = data.memberId  || 'Unknown';
    var p          = data.pcsp;

    var rootF = DriveApp.getFoldersByName('NumberOne ADC').hasNext()
      ? DriveApp.getFoldersByName('NumberOne ADC').next()
      : DriveApp.createFolder('NumberOne ADC');
    var folderName = memberName + '(' + memberId + ')';
    var memberFolder = rootF.getFoldersByName(folderName).hasNext()
      ? rootF.getFoldersByName(folderName).next()
      : rootF.createFolder(folderName);

    var docName = 'PCSP_' + memberName + '_' + (p.wdate||'');

    // ★ 같은 이름의 예전 문서가 있으면 먼저 삭제 (중복 파일로 헛갈리는 문제 방지)
    var oldDocs = memberFolder.getFilesByName(docName);
    while (oldDocs.hasNext()) { oldDocs.next().setTrashed(true); }

    var doc  = DocumentApp.create(docName);
    var body = doc.getBody();
    body.setMarginTop(36).setMarginBottom(36).setMarginLeft(50).setMarginRight(50);

    // ── 스타일 헬퍼 ──────────────────────────────────────────
    function title(text) {
      var el = body.appendParagraph(text);
      el.setHeading(DocumentApp.ParagraphHeading.TITLE);
      return el;
    }
    function section(text) {
      var el = body.appendParagraph(text);
      el.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      el.editAsText().setBold(true).setForegroundColor('#D85A30');
      return el;
    }
    function subsection(text) {
      var el = body.appendParagraph(text);
      el.editAsText().setBold(true).setFontSize(11);
      return el;
    }
    function field(label, value) {
      var el = body.appendParagraph(label + ': ' + (value || '—'));
      var t = el.editAsText();
      t.setBold(0, label.length, true);
      return el;
    }
    function yn(val, label) {
      var yes = val === 'Yes' ? '☑' : '☐';
      var no  = val === 'Yes' ? '☐' : '☑';
      return yes + ' Yes   ' + no + ' No' + (label ? ' — ' + label : '');
    }
    function note(text) {
      var el = body.appendParagraph(text);
      el.editAsText().setItalic(true).setFontSize(9).setForegroundColor('#666666');
      return el;
    }
    function spacer() { body.appendParagraph(''); }
    function makeTable(rows) {
      // rows: array of [label, value] pairs → 2-column table
      var tbl = body.appendTable(rows.map(function(r){ return [String(r[0]), String(r[1] != null ? r[1] : '—')]; }));
      for (var i = 0; i < tbl.getNumRows(); i++) {
        var labelCell = tbl.getCell(i, 0);
        labelCell.setWidth(180);
        labelCell.editAsText().setBold(true);
      }
      return tbl;
    }

    // ══════════════════════════════════════════════════════════
    // 헤더
    // ══════════════════════════════════════════════════════════
    var hdr = body.appendParagraph('Number One Adult Daycare');
    hdr.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('Person Centered Service Plan (PCSP)').editAsText().setBold(true).setFontSize(13);
    body.appendParagraph('161-22 Northern Blvd 1FL, Flushing, NY 11358 · 718-799-0248').editAsText().setFontSize(9).setForegroundColor('#666666');
    spacer();

    // ── PCSP Completion Information ──
    section('PCSP Completion Information');
    makeTable([
      ['Person Completing PCSP', p.writer],
      ['Date of PCSP Completion', p.wdate],
    ]);
    spacer();

    // ── 7.1 Participant Demographic/Contact Info ──
    section('SADC/SADS Participant Information');
    subsection('Participant Demographic and Contact Information');
    var fullName = ((p.nameLast||'') + ', ' + (p.nameFirst||'')).replace(/^,\s*|,\s*$/g,'');
    makeTable([
      ['Full Name', fullName],
      ['Date of Birth', p.dob],
      ['Address', p.addr],
      ['Phone', p.phone],
      ['Email', p.email || 'N/A'],
      ['Preferred Language', p.lang],
      ['Gender', p.gender],
      ['Gender Identity', p.genderid],
      ['Does the participant live with someone?', yn(p.livewith)],
      ['If yes, does that person support the participant\'s care?', yn(p.caresupp)],
      ['Name(s) of person(s) lived with & relationship', p.livewithname],
    ]);
    spacer();

    // ── 7.2 Primary Insurance ──
    subsection('Primary Insurance / MLTC Plan');
    makeTable([
      ['MLTC Plan / Insurance Co.', p.ins],
      ['Medicaid / Insurance ID', p.medicaid + (p.mltc && p.mltc !== p.medicaid ? ' / ' + p.mltc : '')],
    ]);
    spacer();

    // ── 7.3 Secondary Insurance (있을 때만) ──
    if (p.ins2 || p.ins2id) {
      subsection('Secondary / Back-Up Insurance / MLTC Plan');
      makeTable([
        ['MLTC Plan / Insurance Co.', p.ins2],
        ['Insurance/Medicaid ID', p.ins2id],
      ]);
      spacer();
    }

    // ── 7.4 Primary Care Manager ──
    subsection('Primary Care Manager');
    makeTable([
      ['Full Name', p.cm1name],
      ['Phone', p.cm1phone],
      ['Email', p.cm1email],
    ]);
    spacer();

    // ── 7.5 Secondary Care Manager (있을 때만) ──
    if (p.cm2name) {
      subsection('Secondary / Back-Up Care Manager');
      makeTable([
        ['Full Name', p.cm2name],
        ['Phone', p.cm2phone],
        ['Email', p.cm2email],
      ]);
      spacer();
    }

    // ── 7.6 Primary Care Physician ──
    subsection('Primary Care Physician');
    makeTable([
      ['Full Name', p.pcpname],
      ['Phone', p.pcpphone],
      ['Email', p.pcpemail || 'N/A'],
    ]);
    spacer();

    // ── 7.7 Schedule ──
    subsection('SADC Attendance Schedule');
    makeTable([
      ['Days of Attendance', (p.days||[]).join(', ')],
      ['Time', p.time],
      ['Method of Transportation', p.transport],
    ]);
    spacer();

    // ── Contact Information ──
    section('Contact Information');
    var contacts = (p.contacts || []).filter(function(c){ return c && c.name; });
    if (!contacts.length) {
      note('No contacts recorded');
    } else {
      contacts.forEach(function(c, i) {
        subsection('Contact ' + (i+1));
        makeTable([
          ['Name', c.name],
          ['Contact Type', c.type],
          ['Relationship to Participant', c.rel],
          ['Phone', c.phone],
          ['Email', c.email || 'N/A'],
        ]);
      });
    }
    spacer();

    // ══════════════════════════════════════════════════════════
    // Participant Health Information
    // ══════════════════════════════════════════════════════════
    section('Participant Health Information');

    subsection('Pertinent Diagnoses');
    body.appendParagraph(p.diag || '—');
    spacer();

    subsection('Medications');
    makeTable([['Requires medication assistance at SADC?', yn(p.medassist, p.medassist === 'Yes' ? p.medlevel : '')]]);
    body.appendParagraph(p.meds || '—');
    spacer();

    subsection('Other Health Information');
    makeTable([
      ['Allergies (severity & emergency response)', p.allergy || 'None'],
      ['Dietary Restrictions/Requirements', p.diet || 'None'],
      ['Nutrition (Preferences/Special Diet)', p.nutrition || 'None'],
      ['Can SADC accommodate nutrition preference?', yn(p.nutr_acc)],
      ['How accommodated / alternative', p.nutr_how],
    ]);
    spacer();

    subsection('Capacity for Independence');
    makeTable([
      ['Able to communicate needs?', yn(p.comm)],
      ['If no, why', p.comm === 'No' ? p.comm_why : ''],
      ['Able to make own decisions?', yn(p.decision)],
      ['If no, why', p.decision === 'No' ? p.decision_why : ''],
      ['Can be left alone/unsupervised?', yn(p.alone)],
      ['If no, why', p.alone === 'No' ? p.alone_why : ''],
      ['Has pain and/or sensory needs?', yn(p.pain)],
      ['If yes, describe needs & assistance', p.pain === 'Yes' ? (p.pain_desc || p.cap_desc) : ''],
    ]);
    spacer();

    subsection('Functional Assessment / Staff Intervention');
    var adlRows = [['ADL', 'Level of Care', 'Assistive Technology/Device']];
    (p.adl || []).forEach(function(a) {
      adlRows.push([a.item, a.level || '—', a.device || 'none']);
    });
    var adlTbl = body.appendTable(adlRows);
    adlTbl.getRow(0).editAsText().setBold(true);
    spacer();

    subsection('Personal Care Assistance Preference');
    makeTable([
      ['Preference on who provides personal care?', yn(p.carepref, p.carepref === 'Yes' ? p.carepref_desc : '')],
      ['Can SADC accommodate this preference?', yn(p.carepref_acc)],
      ['If no, participant notified & offered alternative provider?', p.carepref_acc === 'No' ? yn(p.carepref_notified) : ''],
    ]);
    spacer();

    // ══════════════════════════════════════════════════════════
    // Risk Management
    // ══════════════════════════════════════════════════════════
    section('Risk Management and Safeguards');
    var risks = (p.risks || []).filter(function(r){ return r && r.risk; });
    if (!risks.length) {
      note('No known risks');
    } else {
      risks.forEach(function(r, i) {
        if (i > 0) spacer();
        makeTable([
          ['Risk', r.risk],
          ['Trigger(s)', r.trigger],
          ['Known Response(s)', r.response],
          ['Measure(s) in Place', r.measure],
          ['Safeguard(s)', r.safeguard],
        ]);
      });
    }
    spacer();

    // ══════════════════════════════════════════════════════════
    // Preferences, Strengths, Needs
    // ══════════════════════════════════════════════════════════
    section('Preferences and Strengths/Needs');
    subsection('Preferences');
    body.appendParagraph(p.prefs || '—');
    spacer();
    subsection('Strengths & Needs');
    body.appendParagraph((p.strengths || '—') + '\n\n' + (p.needs || ''));
    spacer();

    // ══════════════════════════════════════════════════════════
    // Goals & Activities
    // ══════════════════════════════════════════════════════════
    section('Goals & Activities');

    subsection('Goals');
    var goals = (p.goals || []).filter(function(g){ return g && g.goal; });
    if (!goals.length) {
      note('No goals recorded');
    } else {
      goals.forEach(function(g, i) {
        if (i > 0) spacer();
        makeTable([
          ['Goal', g.goal],
          ['Outcome Criteria', g.outcome],
          ['Actions and/or Steps', g.actions],
          ['Related Activity(s)', g.activities],
        ]);
      });
    }
    spacer();

    subsection('SADC/SADS Activities');
    body.appendParagraph(p.sadc_act || '—');
    spacer();

    subsection('Community Activities');
    var commActs = (p.community || []).filter(function(c){ return c && c.activity; });
    if (!commActs.length) {
      note('No community activities recorded');
    } else {
      commActs.forEach(function(c, i) {
        if (i > 0) spacer();
        makeTable([
          ['Community Activity', c.activity],
          ['Details', c.details],
          ['Location', c.location],
          ['Day, Time, & Frequency', c.schedule],
          ['Materials Needed', c.materials],
          ['Transportation Method', c.transport],
          ['Supports Needed', c.supports],
        ]);
      });
    }
    spacer();

    subsection('Work/Volunteer Interests');
    var workLabel = { work:'Yes – Work Only', volunteer:'Yes – Volunteer Only', both:'Yes – Work & Volunteer', no:'No – Not Interested', na:'N/A – Participant is unable to do so' }[p.work] || p.work;
    makeTable([
      ['Interested in working/volunteering?', workLabel],
      ['Details', p.work === 'na' ? p.work_na_desc : p.work_desc],
    ]);
    spacer();

    // ══════════════════════════════════════════════════════════
    // Modifications to Participant Rights
    // ══════════════════════════════════════════════════════════
    section('Modifications to Participant Rights');

    subsection('HCBS Final Rule Rights');
    var hcbsRows = [['Participant Right', 'Modification Needed?', 'Justification & Details']];
    (p.hcbs_rights || []).forEach(function(r) {
      hcbsRows.push([r.right, yn(r.modified), r.modified === 'Yes' ? (r.desc||'') : '']);
    });
    if (hcbsRows.length > 1) {
      var hcbsTbl = body.appendTable(hcbsRows);
      hcbsTbl.getRow(0).editAsText().setBold(true);
    }
    spacer();

    subsection('Other Participant Rights');
    var otherRights = (p.other_rights || []).filter(function(r){ return r && r.right && r.modified === 'Yes'; });
    if (!otherRights.length) {
      note('No other rights modifications');
    } else {
      var otherRows = [['Participant Right', 'Modification Needed?', 'Justification & Details']];
      otherRights.forEach(function(r) {
        var details = [];
        if (r.desc)       details.push('Modification: ' + r.desc);
        if (r.dx)         details.push('Diagnosis/Condition: ' + r.dx);
        if (r.prior)      details.push('Positive Interventions Used Before Modification: ' + r.prior);
        if (r.dataReview) details.push('Data Collection & Review Method: ' + r.dataReview);
        if (r.timeframe)  details.push('Timeframe for Review: ' + r.timeframe);
        if (r.noHarm)     details.push('Assurance of No Harm: ' + r.noHarm);
        otherRows.push([r.right, yn(r.modified), details.join('\n')]);
      });
      var otherTbl = body.appendTable(otherRows);
      otherTbl.getRow(0).editAsText().setBold(true);
    }
    spacer();

    // ══════════════════════════════════════════════════════════
    // Acknowledgement
    // ══════════════════════════════════════════════════════════
    section('PCSP Acknowledgement');
    body.appendParagraph('I agree with what is written in this person centered service plan and acknowledge that I, the participant, lead the person centered planning process. I understand my rights and/or I have someone I trust who can help me with them. This includes the right to integrate with and be a part of my community, separate from the Social Adult Day Care and Social Adult Day Services I am choosing to receive. I acknowledge that I was offered options to integrate with and be part of my community, and my decisions on goals or activities related to this are documented in this plan. I understand that my plan will be reviewed regularly, that I can ask for it to be reviewed sooner, and whom to speak to about having my plan reviewed and updated. I agree to this plan being shared with the people that need it to provide my services.')
      .editAsText().setFontSize(9);
    spacer();

    // 서명
    var sigTable = body.appendTable([['Participant or Designated Representative Signature:', 'Date:']]);
    sigTable.getCell(0,0).editAsText().setBold(true);
    sigTable.getCell(0,1).editAsText().setBold(true);

    if (data.sigBase64 && data.sigBase64.length > 10) {
      try {
        var sigBlob = Utilities.newBlob(Utilities.base64Decode(data.sigBase64), 'image/png', 'signature.png');
        var sigCell = sigTable.getCell(0, 0);
        var sigPara = sigCell.appendParagraph('');
        sigPara.appendInlineImage(sigBlob).setWidth(150).setHeight(40);
      } catch(sigErr) {
        Logger.log('서명 삽입 오류: ' + sigErr);
      }
    }
    sigTable.getCell(0,1).appendParagraph(p.sigdate || p.wdate || '');

    doc.saveAndClose();

    // 최종 파일을 멤버 폴더로 이동
    var docFile = DriveApp.getFileById(doc.getId());
    docFile.setName(docName);
    memberFolder.addFile(docFile);
    DriveApp.getRootFolder().removeFile(docFile);

    var pdfBlob   = docFile.getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    return { success: true, pdfBase64: pdfBase64, docId: docFile.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}


// ══════════════════════════════════════════════════════════════
// Claude AI — PCSP 자동완성
// ══════════════════════════════════════════════════════════════
function callClaudeForPCSP(data) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { success: false, error: 'API 키가 설정되지 않았습니다.' };

    var payload = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: data.prompt }]
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    if (result.content && result.content[0]) {
      return { success: true, text: result.content[0].text };
    }
    return { success: false, error: JSON.stringify(result) };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
function aiReadAuth(body) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { success: false, error: 'API 키 없음' };
    var payload = { model:'claude-haiku-4-5-20251001', max_tokens:1000,
      messages:[{role:'user', content:[
        {type:'document', source:{type:'base64', media_type:'application/pdf', data:body.base64Data}},
        {type:'text', text:body.prompt}
      ]}]};
    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-beta':'pdfs-2024-09-25'},
      payload:JSON.stringify(payload), muteHttpExceptions:true
    });
    var result = JSON.parse(response.getContentText());
    if (result.content && result.content[0]) {
      var clean = result.content[0].text.replace(/```json|```/g,'').trim();
      return { success:true, result:JSON.parse(clean) };
    }
    return { success:false, error:JSON.stringify(result) };
  } catch(e) { return { success:false, error:e.toString() }; }
}
function dailyBackup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  var backupName = '[백업] 넘버원데이케어 ' + dateStr;

  // 백업 폴더 (없으면 생성)
  var folders = DriveApp.getFoldersByName('넘버원_백업');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('넘버원_백업');

  // 스프레드시트 사본 생성
  var file = DriveApp.getFileById(SPREADSHEET_ID);
  file.makeCopy(backupName, folder);

  // 30일 이상 된 백업 자동 삭제
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < cutoff && f.getName().indexOf('[백업]') === 0) {
      f.setTrashed(true);
    }
  }
}
