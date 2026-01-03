/**
 * Sheet.js - スプレッドシート操作
 */

/**
 * アカウント×月のシート名を生成
 * @param {string} username - アカウント名
 * @param {Date} date - 日付
 * @returns {string} シート名 (例: "account1_2024-12")
 */
function getMonthlySheetName(username, date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${username}_${year}-${month}`;
}

/**
 * アカウント×月のデータシートを取得（なければ作成）
 * @param {Spreadsheet} ss - スプレッドシート
 * @param {string} username - アカウント名
 * @param {Date} date - 日付
 * @returns {Sheet} シート
 */
function getOrCreateMonthlySheet(ss, username, date) {
  const sheetName = getMonthlySheetName(username, date);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
    sheet.getRange(1, 1, 1, DATA_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // 列幅調整
    sheet.setColumnWidth(COLUMNS.POST_ID, 180);
    sheet.setColumnWidth(COLUMNS.POSTED_DATE, 100);
    sheet.setColumnWidth(COLUMNS.COLLECTED_DATE, 130);
    sheet.setColumnWidth(COLUMNS.TYPE, 60);
    sheet.setColumnWidth(COLUMNS.TWEET_TEXT, 400);
    sheet.setColumnWidth(COLUMNS.TWEET_URL, 300);

    Logger.log(`シート作成: ${sheetName}`);
  }

  return sheet;
}

/**
 * データシートのフォーマット設定
 * @param {Sheet} sheet - シート
 * @param {number} startRow - 開始行
 * @param {number} numRows - 行数
 */
function formatDataSheet(sheet, startRow, numRows) {
  // パーセント表示
  sheet.getRange(startRow, COLUMNS.PROFILE_CLICK_RATE, numRows, 1).setNumberFormat('0.00%');
  sheet.getRange(startRow, COLUMNS.FOLLOW_RATE, numRows, 1).setNumberFormat('0.00%');

  // 数値フォーマット
  sheet.getRange(startRow, COLUMNS.IMPRESSIONS, numRows, 4).setNumberFormat('#,##0');
  sheet.getRange(startRow, COLUMNS.RETWEETS, numRows, 4).setNumberFormat('#,##0');
  sheet.getRange(startRow, COLUMNS.DAILY_FOLLOWER_INCREASE, numRows, 2).setNumberFormat('#,##0');
}

/**
 * 既存のツイートURLを取得（重複防止用）
 * @param {Sheet} sheet - シート
 * @returns {Set<string>} URL一覧
 */
function getExistingTweetUrls(sheet) {
  const lastRow = sheet.getLastRow();
  const urls = new Set();

  if (lastRow > 1) {
    const urlColumn = sheet.getRange(2, COLUMNS.TWEET_URL, lastRow - 1, 1).getValues();
    urlColumn.forEach(row => {
      if (row[0]) urls.add(row[0]);
    });
  }

  return urls;
}

/**
 * 既存のポストIDを取得（行番号とセットで）
 * @param {Sheet} sheet - シート
 * @returns {Map<string, number>} ポストID -> 行番号
 */
function getExistingPostIds(sheet) {
  const lastRow = sheet.getLastRow();
  const postIds = new Map();

  if (lastRow > 1) {
    const idColumn = sheet.getRange(2, COLUMNS.POST_ID, lastRow - 1, 1).getValues();
    idColumn.forEach((row, index) => {
      if (row[0]) {
        postIds.set(row[0].toString(), index + 2);
      }
    });

    // URLからもポストIDを抽出（フォールバック）
    const numCols = sheet.getLastColumn();
    if (numCols >= COLUMNS.TWEET_URL) {
      const urlColumn = sheet.getRange(2, COLUMNS.TWEET_URL, lastRow - 1, 1).getValues();
      urlColumn.forEach((row, index) => {
        if (row[0]) {
          const match = row[0].toString().match(/status\/(\d+)/);
          if (match && !postIds.has(match[1])) {
            postIds.set(match[1], index + 2);
          }
        }
      });
    }
  }

  return postIds;
}

/**
 * 前日のフォロワー数を取得
 * @param {Sheet} sheet - シート
 * @returns {number|null} フォロワー数
 */
function getPreviousFollowerCount(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const followerCount = sheet.getRange(lastRow, COLUMNS.FOLLOWERS).getValue();
  return followerCount || null;
}

/**
 * 週間フォロワー増加数を計算
 * @param {Sheet} sheet - シート
 * @param {number} currentFollowers - 現在のフォロワー数
 * @returns {number} 増加数
 */
function getWeeklyFollowerIncrease(sheet, currentFollowers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.FOLLOWERS).getValues();

  for (let i = data.length - 1; i >= 0; i--) {
    const rowDate = new Date(data[i][COLUMNS.POSTED_DATE - 1]);
    if (rowDate <= weekAgo) {
      const weekAgoFollowers = data[i][COLUMNS.FOLLOWERS - 1];
      if (weekAgoFollowers) {
        return currentFollowers - weekAgoFollowers;
      }
      break;
    }
  }

  // 7日前のデータがない場合は最初のデータとの差分
  if (data.length > 0 && data[0][COLUMNS.FOLLOWERS - 1]) {
    return currentFollowers - data[0][COLUMNS.FOLLOWERS - 1];
  }

  return 0;
}

/**
 * 設定シートを初期化
 * @param {Spreadsheet} ss - スプレッドシート
 */
function initializeSettingsSheet(ss) {
  let settingsSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_NAME_SETTINGS);
  }

  const headers = ['アカウント名（@なし）', '転記先スプレッドシートID', '権限確認'];
  settingsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  settingsSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  settingsSheet.setColumnWidth(1, 180);
  settingsSheet.setColumnWidth(2, 350);
  settingsSheet.setColumnWidth(3, 100);
  settingsSheet.setFrozenRows(1);
}

/**
 * マニュアルシートを初期化
 * @param {Spreadsheet} ss - スプレッドシート
 */
function initializeManualSheet(ss) {
  let manualSheet = ss.getSheetByName(SHEET_NAME_MANUAL);
  if (manualSheet) return;

  manualSheet = ss.insertSheet(SHEET_NAME_MANUAL);

  manualSheet.getRange('A1').setValue('X(Twitter) ツイート分析ツール マニュアル');
  manualSheet.getRange('A1').setFontSize(16).setFontWeight('bold');
  manualSheet.getRange('A1:F1').merge();

  const manual = [
    [''],
    ['【初期設定】'],
    ['1. Bearer Token の設定'],
    ['   - メニュー「拡張機能」→「Apps Script」を開く'],
    ['   - 左側の歯車アイコン「プロジェクトの設定」をクリック'],
    ['   - 「スクリプト プロパティ」セクションで「プロパティを追加」をクリック'],
    ['   - プロパティ: BEARER_TOKEN'],
    ['   - 値: X Developer Portal で取得した Bearer Token を入力'],
    [''],
    ['2. 対象アカウントの設定'],
    ['   - 「設定」シートのA列にユーザー名を入力（@なし）'],
    ['   - B列に転記先スプレッドシートIDを入力'],
    ['   - verifyAllPermissions() を実行して権限確認'],
    [''],
    ['【実行関数】'],
    ['・initialize: 初期設定（設定・マニュアルシートを作成）'],
    ['・monthlyFetch: 前月分のツイートを取得（毎月1日トリガー用）'],
    ['・initialFetch: 過去7日分のツイートを取得（初回用）'],
    ['・recalculateMetrics: プロクリ率・フォロー率を再計算'],
    ['・verifyAllPermissions: 権限確認'],
    [''],
    ['【Chrome拡張機能との連携】'],
    ['・プロフクリック数が空欄 = 未収集（タスク）'],
    ['・プロフクリック数に値あり = 収集済み'],
  ];

  manualSheet.getRange(2, 1, manual.length, 1).setValues(manual);
  manualSheet.setColumnWidth(1, 600);

  ss.setActiveSheet(manualSheet);
  ss.moveActiveSheet(1);

  Logger.log('マニュアルシートを作成しました');
}

/**
 * シートを初期化（設定・マニュアル）
 * @param {Spreadsheet} ss - スプレッドシート
 */
function initializeSheets(ss) {
  initializeSettingsSheet(ss);
  initializeManualSheet(ss);
}
