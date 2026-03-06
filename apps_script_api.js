/**
 * DFKD UI 카탈로그 — JSON API 전용
 *
 * GitHub Pages에서 호스팅하는 프론트엔드가 이 API를 호출합니다.
 *
 * 엔드포인트:
 *   GET  ?api=all        → 카테고리 + UI목록 + 상태관리 전체 반환
 *   POST                 → 상태 업데이트
 */

var CACHE_TTL = 300; // 5분

// ────────────────────────────────────────
// GET: JSON API
// ────────────────────────────────────────
function doGet(e) {
  var api = e && e.parameter && e.parameter.api;

  // CORS 헤더가 필요하지만 Apps Script는 직접 설정 불가
  // → fetch 시 mode: 'cors'가 아닌 기본값 사용, 응답은 redirect로 처리됨

  if (api === 'all') {
    return serveAll();
  }

  // 기본: 안내 메시지
  return ContentService.createTextOutput(JSON.stringify({
    error: 'api 파라미터가 필요합니다. 예: ?api=all'
  })).setMimeType(ContentService.MimeType.JSON);
}

function serveAll() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('api_all');

  if (cached) {
    return ContentService.createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);
  }

  var categories = sheetToObjects('카테고리');
  var entries = sheetToObjects('UI목록');
  var statuses = sheetToObjects('상태관리');

  var result = JSON.stringify({
    categories: categories,
    entries: entries,
    statuses: statuses
  });

  // 전체 응답 캐싱
  try {
    cache.put('api_all', result, CACHE_TTL);
  } catch (e) {
    // 100KB 초과 시 캐시 생략
  }

  return ContentService.createTextOutput(result)
    .setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────
// Sheets 데이터 읽기
// ────────────────────────────────────────
function sheetToObjects(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }

  return result;
}

// ────────────────────────────────────────
// POST: 상태 업데이트
// ────────────────────────────────────────
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('상태관리');
  var data = JSON.parse(e.postData.contents);

  if (!data['UI이름']) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'UI이름 필수' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var values = sheet.getRange('A:A').getValues();
  var rowIdx = -1;
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === data['UI이름']) {
      rowIdx = i + 1;
      break;
    }
  }

  if (rowIdx === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: '항목 없음: ' + data['UI이름'] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data['상태'] !== undefined) sheet.getRange(rowIdx, 4).setValue(data['상태']);
  if (data['담당자'] !== undefined) sheet.getRange(rowIdx, 5).setValue(data['담당자']);
  if (data['메모'] !== undefined) sheet.getRange(rowIdx, 6).setValue(data['메모']);
  if (data['수정안URL'] !== undefined) sheet.getRange(rowIdx, 7).setValue(data['수정안URL']);

  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  sheet.getRange(rowIdx, 8).setValue(today);

  // 캐시 무효화
  CacheService.getScriptCache().remove('api_all');

  return ContentService.createTextOutput(JSON.stringify({ ok: true, 'UI이름': data['UI이름'] }))
    .setMimeType(ContentService.MimeType.JSON);
}
