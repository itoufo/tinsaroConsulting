/**
 * Settings.js - 設定シート操作
 */

/**
 * 設定シートからアカウント設定を取得
 * @returns {Map<string, {spreadsheetId: string, spreadsheetUrl: string}>}
 */
function getAccountSettings() {
  const ss = SpreadsheetApp.openById(SETTINGS_SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);

  if (!settingsSheet) {
    return new Map();
  }

  const lastRow = settingsSheet.getLastRow();
  const settings = new Map();

  if (lastRow < 2) {
    return settings;
  }

  const values = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  values.forEach(row => {
    const accountName = row[0]?.toString().trim();
    const spreadsheetId = row[1]?.toString().trim();

    if (accountName && spreadsheetId) {
      settings.set(accountName, {
        spreadsheetId: spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      });
    }
  });

  return settings;
}

/**
 * アカウント名のリストを取得
 * @returns {string[]}
 */
function getAccountList() {
  const settings = getAccountSettings();
  return Array.from(settings.keys());
}

/**
 * 設定シートのURLを取得
 * @returns {string}
 */
function getSettingsUrl() {
  return `https://docs.google.com/spreadsheets/d/${SETTINGS_SPREADSHEET_ID}`;
}

/**
 * フォロワー数一覧シートからデータを取得
 * @returns {Object} { dateColumns: Map<string, number>, userRows: Map<string, number>, data: any[][] }
 */
function getFollowerListData() {
  const ss = SpreadsheetApp.openById(FOLLOWER_LIST_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(FOLLOWER_LIST_SHEET_NAME);

  if (!sheet) {
    throw new Error(`シート「${FOLLOWER_LIST_SHEET_NAME}」が見つかりません`);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 6) {
    throw new Error('フォロワー数一覧シートにデータがありません');
  }

  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // 1行目から日付列のマッピングを作成（F列=6列目以降）
  const dateColumns = new Map();
  const headerRow = allData[0];
  for (let col = 5; col < headerRow.length; col++) {
    const cellValue = headerRow[col];
    if (cellValue instanceof Date) {
      const dateKey = formatDate(cellValue);
      dateColumns.set(dateKey, col);
    } else if (typeof cellValue === 'string' && cellValue.match(/\d{4}\/\d{2}\/\d{2}/)) {
      dateColumns.set(cellValue, col);
    }
  }

  // 2行目以降からユーザー行のマッピングを作成（B列=ツイッターID）
  const userRows = new Map();
  for (let row = 1; row < allData.length; row++) {
    const twitterId = allData[row][1]?.toString().trim();
    if (twitterId) {
      userRows.set(twitterId, row);
    }
  }

  return { dateColumns, userRows, data: allData };
}

/**
 * 特定ユーザーの特定日のフォロワー数を取得
 * @param {Object} followerData - getFollowerListData()の戻り値
 * @param {string} username - ツイッターID
 * @param {Date} date - 日付
 * @returns {number|null} フォロワー数（データがない場合はnull）
 */
function getFollowerCountByDate(followerData, username, date) {
  const { dateColumns, userRows, data } = followerData;

  const dateKey = formatDate(date);
  const col = dateColumns.get(dateKey);
  const row = userRows.get(username);

  if (col === undefined || row === undefined) {
    return null;
  }

  const value = data[row][col];
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  // カンマ区切りの数値を処理
  if (typeof value === 'string') {
    return parseInt(value.replace(/,/g, ''), 10) || null;
  }

  return value;
}

/**
 * 全アカウントの転記先スプレッドシートへの権限を確認
 * 初回設定時に実行してください
 */
function verifyAllPermissions() {
  const ss = SpreadsheetApp.openById(SETTINGS_SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);
  const lastRow = settingsSheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('設定シートにアカウントが登録されていません');
    return [];
  }

  const values = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const results = [];

  values.forEach((row, index) => {
    const accountName = row[0]?.toString().trim();
    const spreadsheetId = row[1]?.toString().trim();
    const rowNum = index + 2;

    if (!accountName || !spreadsheetId) {
      results.push({ row: rowNum, status: '未設定', message: 'アカウント名またはスプレッドシートIDが空です' });
      settingsSheet.getRange(rowNum, 3).setValue('❌ 未設定');
      return;
    }

    try {
      const targetSs = SpreadsheetApp.openById(spreadsheetId);
      const testSheet = targetSs.getSheets()[0];

      // 書き込みテスト
      const testCell = testSheet.getRange(1, 100);
      const originalValue = testCell.getValue();
      testCell.setValue('権限テスト');
      testCell.setValue(originalValue);

      Logger.log(`✅ ${accountName}: 権限OK (${targetSs.getName()})`);
      settingsSheet.getRange(rowNum, 3).setValue('✅ OK');
      results.push({ row: rowNum, status: 'OK', message: targetSs.getName() });
    } catch (error) {
      Logger.log(`❌ ${accountName}: ${error.message}`);
      settingsSheet.getRange(rowNum, 3).setValue('❌ エラー');
      results.push({ row: rowNum, status: 'エラー', message: error.message });
    }
  });

  Logger.log('権限確認完了');
  return results;
}
