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
