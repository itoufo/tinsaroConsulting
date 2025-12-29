/**
 * X(Twitter) ツイート分析 GAS
 *
 * 【初期設定】
 * 1. スクリプトプロパティに BEARER_TOKEN を設定
 *    - ファイル > プロジェクトの設定 > スクリプトプロパティ
 *    - プロパティ名: BEARER_TOKEN
 *    - 値: X Developer Portalで取得したBearer Token
 *
 * 2. 「設定」シートのA列に対象アカウントのユーザー名を入力（@なし、複数可）
 *    - A2: account1
 *    - A3: account2
 *    - A4: account3
 *    ...
 *
 * 3. 毎日自動実行するトリガーを設定
 *    - 編集 > 現在のプロジェクトのトリガー > トリガーを追加
 *    - 関数: dailyFetch
 *    - イベントソース: 時間主導型
 *    - 時間ベースのトリガー: 日付ベースのタイマー
 *
 * 【シート構成】
 * - 設定: A列にアカウント名を記載
 * - {アカウント名}_{YYYY-MM}: 月別のツイートデータ
 */

// ========== 定数 ==========
const SPREADSHEET_ID = '1SF4IBNl_7zD560zpt0Q0rq8WknVOxerYz1kuCfhcoUE';
const SHEET_NAME_SETTINGS = '設定';
const SHEET_NAME_MANUAL = 'マニュアル';

// 判定基準
const PROFILE_CLICK_RATE_THRESHOLDS = {
  EXCELLENT: 0.05,  // ◎ 5%以上
  GOOD: 0.03,       // ○ 3%以上
  FAIR: 0.02,       // △ 2%以上
};

const FOLLOW_RATE_THRESHOLDS = {
  EXCELLENT: 0.03,  // ◎ 3%以上
  GOOD: 0.02,       // ○ 2%以上
  FAIR: 0.01,       // △ 1%以上
};

// ========== メイン関数 ==========

/**
 * 毎日実行用の関数（トリガーで呼び出し）
 */
function dailyFetch() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initializeSheets(ss);

  const usernames = getAccountList(ss);

  if (usernames.length === 0) {
    Logger.log('エラー: 設定シートにユーザー名を入力してください');
    return;
  }

  // 過去24時間のツイートを取得
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 各アカウントについて処理
  usernames.forEach(username => {
    try {
      Logger.log(`処理中: ${username}`);
      fetchAndSaveTweets(ss, username, yesterday, now);
    } catch (error) {
      Logger.log(`エラー (${username}): ${error.message}`);
    }
    // API制限対策
    Utilities.sleep(2000);
  });
}

/**
 * 初回実行用（過去7日分を取得）
 */
function initialFetch() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initializeSheets(ss);

  const usernames = getAccountList(ss);

  if (usernames.length === 0) {
    Logger.log('エラー: 設定シートにユーザー名を入力してください');
    return;
  }

  // 過去7日分のツイートを取得
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 各アカウントについて処理
  usernames.forEach(username => {
    try {
      Logger.log(`処理中: ${username}`);
      fetchAndSaveTweets(ss, username, weekAgo, now);
    } catch (error) {
      Logger.log(`エラー (${username}): ${error.message}`);
    }
    // API制限対策
    Utilities.sleep(2000);
  });
}

/**
 * 手動実行用（テスト）
 */
function manualFetch() {
  dailyFetch();
}

// ========== シート初期化 ==========

/**
 * 初期化（最初に実行してください）
 * マニュアルシートと設定シートを作成します
 */
function initialize() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initializeSheets(ss);
  Logger.log('初期化が完了しました。設定シートにアカウント名を入力してください。');
}

/**
 * シートを初期化（設定・マニュアル）
 */
function initializeSheets(ss) {
  initializeSettingsSheet(ss);
  initializeManualSheet(ss);
}

/**
 * 設定シートを初期化
 */
function initializeSettingsSheet(ss) {
  let settingsSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_NAME_SETTINGS);
    settingsSheet.getRange('A1').setValue('対象ユーザー名（@なし）');
    settingsSheet.getRange('A1').setFontWeight('bold');
    settingsSheet.setColumnWidth(1, 200);
  }
}

/**
 * マニュアルシートを初期化
 */
function initializeManualSheet(ss) {
  let manualSheet = ss.getSheetByName(SHEET_NAME_MANUAL);
  if (manualSheet) {
    return; // 既に存在する場合はスキップ
  }

  manualSheet = ss.insertSheet(SHEET_NAME_MANUAL);

  // タイトル
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
    ['   ※ Bearer Token は https://developer.twitter.com/ で取得できます'],
    [''],
    ['2. 対象アカウントの設定'],
    ['   - 「設定」シートのA列にユーザー名を入力（@なし）'],
    ['   - 複数アカウントを登録可能（1行1アカウント）'],
    ['   - 例: A2に「account1」、A3に「account2」...'],
    [''],
    ['3. 自動実行トリガーの設定（任意）'],
    ['   - メニュー「拡張機能」→「Apps Script」を開く'],
    ['   - 左側の時計アイコン「トリガー」をクリック'],
    ['   - 「トリガーを追加」をクリック'],
    ['   - 実行する関数: dailyFetch'],
    ['   - イベントのソース: 時間主導型'],
    ['   - 時間ベースのトリガーのタイプ: 日付ベースのタイマー'],
    ['   - 時刻を選択: お好みの時刻'],
    [''],
    ['【実行関数】'],
    ['・initialize: 初期設定（最初に実行）- マニュアル・設定シートを作成'],
    ['・dailyFetch: 過去24時間のツイートを取得（毎日実行用）'],
    ['・initialFetch: 過去7日分のツイートを取得（初回データ取得用）'],
    ['・manualFetch: dailyFetch と同じ（手動テスト用）'],
    ['・recalculateMetrics: プロクリ率・フォロー率を再計算'],
    ['・setBearerToken: ダイアログからBearer Tokenを設定'],
    [''],
    ['【シート構成】'],
    ['・設定: 対象アカウントを記載'],
    ['・マニュアル: このシート'],
    ['・{アカウント名}_{YYYY-MM}: 月別のツイートデータ'],
    ['  例: satochin_2024-12, satochin_2025-01'],
    [''],
    ['【データ列の説明】'],
    ['・日付: ツイート投稿日'],
    ['・種類: 手動入力（通常/企画/引用RT など）'],
    ['・ツイート本文: ツイートの内容'],
    ['・インプ数: インプレッション数'],
    ['・いいね数: いいねの数'],
    ['・プロフクリック数: プロフィールクリック数（※API制限で取得不可、手動入力）'],
    ['・詳細クリック: 詳細クリック数（※API制限で取得不可、手動入力）'],
    ['・プロクリ率: プロフクリック数 ÷ インプ数'],
    ['・プロクリ判定: ◎5%以上 / ○3%以上 / △2%以上 / ✕2%未満'],
    ['・RT数: リツイート数'],
    ['・リプ数: リプライ数'],
    ['・リプした数: 手動入力'],
    ['・フォロワー数: 取得時点のフォロワー数'],
    ['・フォロー率: フォロワー増加数 ÷ プロフクリック数'],
    ['・フォロー率判定: ◎3%以上 / ○2%以上 / △1%以上 / ✕1%未満'],
    ['・フォロワー増加数（日）: 前日からの増加数'],
    ['・フォロワー増加数（週）: 7日前からの増加数'],
    ['・ツイートURL: ツイートへのリンク'],
    [''],
    ['【注意事項】'],
    ['・プロフクリック数と詳細クリック数はX API v2では取得できません'],
    ['・正確な値が必要な場合は、X Analytics から手動で入力してください'],
    ['・手動入力後に recalculateMetrics を実行すると判定が再計算されます'],
    ['・API制限があるため、多数のアカウントを登録する場合は注意してください'],
  ];

  manualSheet.getRange(2, 1, manual.length, 1).setValues(manual);

  // 列幅調整
  manualSheet.setColumnWidth(1, 800);

  // シートを先頭に移動
  ss.setActiveSheet(manualSheet);
  ss.moveActiveSheet(1);

  Logger.log('マニュアルシートを作成しました');
}

/**
 * 設定シートからアカウントリストを取得
 */
function getAccountList(ss) {
  const settingsSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);
  const lastRow = settingsSheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = settingsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return values
    .map(row => row[0])
    .filter(val => val && val.toString().trim() !== '');
}

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
 */
function getOrCreateMonthlySheet(ss, username, date) {
  const sheetName = getMonthlySheetName(username, date);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = [
      'ポストID',           // 1
      '投稿日付',           // 2
      '取得日付',           // 3
      '種類',               // 4
      'ツイート本文',       // 5
      'インプ数',           // 6
      'いいね数',           // 7
      'プロフクリック数',   // 8
      '詳細クリック',       // 9
      'プロクリ率',         // 10
      'プロクリ判定',       // 11
      'RT数',               // 12
      'リプ数',             // 13
      'リプした数',         // 14
      'フォロワー数',       // 15
      'フォロー率',         // 16
      'フォロー率判定',     // 17
      'フォロワー増加数（日）', // 18
      'フォロワー増加数（週）', // 19
      'ツイートURL',        // 20
      'AnalyticsURL'        // 21
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // 列幅調整
    sheet.setColumnWidth(1, 180);  // ポストID
    sheet.setColumnWidth(2, 100);  // 投稿日付
    sheet.setColumnWidth(3, 130);  // 取得日付
    sheet.setColumnWidth(4, 60);   // 種類
    sheet.setColumnWidth(5, 400);  // ツイート本文
    sheet.setColumnWidth(20, 300); // ツイートURL

    Logger.log(`シート作成: ${sheetName}`);
  }

  return sheet;
}

// ========== X API関連 ==========

/**
 * Bearer Tokenを取得
 */
function getBearerToken() {
  const token = PropertiesService.getScriptProperties().getProperty('BEARER_TOKEN');
  if (!token) {
    throw new Error('BEARER_TOKENがスクリプトプロパティに設定されていません');
  }
  return token;
}

/**
 * ユーザーIDを取得
 */
function getUserId(username) {
  const token = getBearerToken();
  const url = `https://api.twitter.com/2/users/by/username/${username}`;

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (json.errors) {
    throw new Error(`ユーザー取得エラー: ${json.errors[0].message}`);
  }

  return json.data.id;
}

/**
 * ユーザーのフォロワー数を取得
 */
function getFollowerCount(userId) {
  const token = getBearerToken();
  const url = `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`;

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (json.errors) {
    throw new Error(`フォロワー数取得エラー: ${json.errors[0].message}`);
  }

  return json.data.public_metrics.followers_count;
}

/**
 * ツイートを取得
 */
function getTweets(userId, startTime, endTime) {
  const token = getBearerToken();
  const tweets = [];
  let paginationToken = null;

  do {
    let url = `https://api.twitter.com/2/users/${userId}/tweets?` +
      `tweet.fields=created_at,public_metrics,text` +
      `&start_time=${startTime.toISOString()}` +
      `&end_time=${endTime.toISOString()}` +
      `&max_results=100` +
      `&exclude=retweets,replies`;

    if (paginationToken) {
      url += `&pagination_token=${paginationToken}`;
    }

    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.errors) {
      Logger.log(`ツイート取得エラー: ${json.errors[0].message}`);
      break;
    }

    if (json.data) {
      tweets.push(...json.data);
    }

    paginationToken = json.meta?.next_token;

    // API制限対策
    Utilities.sleep(1000);

  } while (paginationToken);

  return tweets;
}

// ========== データ処理 ==========

/**
 * ツイートを取得してスプレッドシートに保存
 */
function fetchAndSaveTweets(ss, username, startTime, endTime) {
  try {
    // ユーザーID取得
    const userId = getUserId(username);
    Logger.log(`ユーザーID (${username}): ${userId}`);

    // 現在のフォロワー数を取得
    const currentFollowers = getFollowerCount(userId);
    Logger.log(`現在のフォロワー数 (${username}): ${currentFollowers}`);

    // ツイート取得
    const tweets = getTweets(userId, startTime, endTime);
    Logger.log(`取得ツイート数 (${username}): ${tweets.length}`);

    if (tweets.length === 0) {
      Logger.log(`新しいツイートはありません (${username})`);
      return;
    }

    // ツイートを月ごとにグループ化
    const tweetsByMonth = {};
    tweets.forEach(tweet => {
      const createdAt = new Date(tweet.created_at);
      const monthKey = getMonthlySheetName(username, createdAt);
      if (!tweetsByMonth[monthKey]) {
        tweetsByMonth[monthKey] = [];
      }
      tweetsByMonth[monthKey].push(tweet);
    });

    // 月ごとにシートに保存
    for (const monthKey in tweetsByMonth) {
      const monthTweets = tweetsByMonth[monthKey];
      const sampleDate = new Date(monthTweets[0].created_at);
      const sheet = getOrCreateMonthlySheet(ss, username, sampleDate);

      // 前日のフォロワー数を取得（シートから）
      const previousFollowers = getPreviousFollowerCount(sheet);
      const dailyFollowerIncrease = previousFollowers ? currentFollowers - previousFollowers : 0;

      // 週間フォロワー増加数
      const weeklyFollowerIncrease = getWeeklyFollowerIncrease(sheet, currentFollowers);

      // 既存のツイートURLを取得（重複防止）
      const existingUrls = getExistingTweetUrls(sheet);

      // データを整形
      const newRows = [];
      monthTweets.forEach(tweet => {
        const tweetUrl = `https://twitter.com/${username}/status/${tweet.id}`;

        // 重複チェック
        if (existingUrls.has(tweetUrl)) {
          return;
        }

        const metrics = tweet.public_metrics;
        const impressions = metrics.impression_count || 0;
        const likes = metrics.like_count || 0;
        const retweets = metrics.retweet_count || 0;
        const replies = metrics.reply_count || 0;

        // プロフィールクリック数は X API v2 では取得不可（0として記録）
        const profileClicks = 0;
        const detailClicks = 0;

        // プロクリ率計算
        const profileClickRate = impressions > 0 ? profileClicks / impressions : 0;
        const profileClickRateJudgment = getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS);

        // フォロー率計算
        const followRate = profileClicks > 0 ? dailyFollowerIncrease / profileClicks : 0;
        const followRateJudgment = getJudgment(followRate, FOLLOW_RATE_THRESHOLDS);

        const createdAt = new Date(tweet.created_at);
        const postedDateStr = Utilities.formatDate(createdAt, 'Asia/Tokyo', 'yyyy/MM/dd');
        const collectedDateStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

        const analyticsUrl = `https://x.com/i/account_analytics/content/${tweet.id}`;

        newRows.push([
          tweet.id,                                   // 1: ポストID
          postedDateStr,                              // 2: 投稿日付
          collectedDateStr,                           // 3: 取得日付
          '',                                         // 4: 種類（手動入力）
          tweet.text,                                 // 5: ツイート本文
          impressions,                                // 6: インプ数
          likes,                                      // 7: いいね数
          profileClicks,                              // 8: プロフクリック数
          detailClicks,                               // 9: 詳細クリック
          profileClickRate,                           // 10: プロクリ率
          profileClickRateJudgment,                   // 11: プロクリ判定
          retweets,                                   // 12: RT数
          replies,                                    // 13: リプ数
          0,                                          // 14: リプした数（手動入力）
          currentFollowers,                           // 15: フォロワー数
          followRate,                                 // 16: フォロー率
          followRateJudgment,                         // 17: フォロー率判定
          dailyFollowerIncrease,                      // 18: フォロワー増加数（日）
          weeklyFollowerIncrease,                     // 19: フォロワー増加数（週）
          tweetUrl,                                   // 20: ツイートURL
          analyticsUrl                                // 21: AnalyticsURL
        ]);
      });

      if (newRows.length > 0) {
        // 日付順（古い順）にソート（投稿日付は2列目=index 1）
        newRows.sort((a, b) => new Date(a[1]) - new Date(b[1]));

        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);

        // フォーマット設定
        formatDataSheet(sheet, lastRow + 1, newRows.length);

        Logger.log(`${newRows.length}件のツイートを追加しました (${monthKey})`);
      }
    }

  } catch (error) {
    Logger.log(`エラー (${username}): ${error.message}`);
    throw error;
  }
}

/**
 * 前日のフォロワー数を取得
 */
function getPreviousFollowerCount(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null;
  }

  // フォロワー数は15列目
  const followerCount = sheet.getRange(lastRow, 15).getValue();
  return followerCount || null;
}

/**
 * 週間フォロワー増加数を計算
 */
function getWeeklyFollowerIncrease(sheet, currentFollowers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return 0;
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 7日前のデータを探す（15列まで取得）
  const data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();

  for (let i = data.length - 1; i >= 0; i--) {
    const rowDate = new Date(data[i][1]); // 投稿日付は2列目（index 1）
    if (rowDate <= weekAgo) {
      const weekAgoFollowers = data[i][14]; // フォロワー数は15列目（index 14）
      if (weekAgoFollowers) {
        return currentFollowers - weekAgoFollowers;
      }
      break;
    }
  }

  // 7日前のデータがない場合は最初のデータとの差分
  if (data.length > 0 && data[0][14]) {
    return currentFollowers - data[0][14];
  }

  return 0;
}

/**
 * 既存のツイートURLを取得（重複防止用）
 */
function getExistingTweetUrls(sheet) {
  const lastRow = sheet.getLastRow();
  const urls = new Set();

  if (lastRow > 1) {
    // ツイートURLは20列目
    const urlColumn = sheet.getRange(2, 20, lastRow - 1, 1).getValues();
    urlColumn.forEach(row => {
      if (row[0]) {
        urls.add(row[0]);
      }
    });
  }

  return urls;
}

/**
 * 判定を返す
 */
function getJudgment(rate, thresholds) {
  if (rate >= thresholds.EXCELLENT) return '◎';
  if (rate >= thresholds.GOOD) return '○';
  if (rate >= thresholds.FAIR) return '△';
  return '✕';
}

/**
 * データシートのフォーマット設定
 */
function formatDataSheet(sheet, startRow, numRows) {
  // プロクリ率（10列目）とフォロー率（16列目）をパーセント表示
  sheet.getRange(startRow, 10, numRows, 1).setNumberFormat('0.00%');
  sheet.getRange(startRow, 16, numRows, 1).setNumberFormat('0.00%');

  // 数値列のフォーマット
  sheet.getRange(startRow, 6, numRows, 4).setNumberFormat('#,##0');  // インプ〜詳細クリック (6-9)
  sheet.getRange(startRow, 12, numRows, 4).setNumberFormat('#,##0'); // RT〜フォロワー数 (12-15)
  sheet.getRange(startRow, 18, numRows, 2).setNumberFormat('#,##0'); // フォロワー増加数 (18-19)
}

// ========== ユーティリティ ==========

/**
 * スクリプトプロパティにBEARER_TOKENを設定（初回のみ手動実行）
 */
function setBearerToken() {
  const token = Browser.inputBox('Bearer Tokenを入力してください');
  if (token && token !== 'cancel') {
    PropertiesService.getScriptProperties().setProperty('BEARER_TOKEN', token);
    Logger.log('Bearer Tokenを設定しました');
  }
}

/**
 * 既存データのプロフクリック数・詳細クリック数を手動更新用
 * X Analyticsからデータをコピペした後に実行
 */
function recalculateMetrics() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    // 設定シート以外の月別シートを処理
    if (sheetName === SHEET_NAME_SETTINGS) return;
    if (sheetName === SHEET_NAME_MANUAL) return;
    if (!sheetName.includes('_')) return; // アカウント_年-月 形式でなければスキップ

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, 1, lastRow - 1, 19).getValues();

    data.forEach((row, index) => {
      const impressions = row[5];      // インプ数（6列目、index 5）
      const profileClicks = row[7];    // プロフクリック数（8列目、index 7）
      const dailyFollowerIncrease = row[17]; // フォロワー増加数（日）（18列目、index 17）

      // プロクリ率再計算
      if (impressions > 0) {
        const profileClickRate = profileClicks / impressions;
        sheet.getRange(index + 2, 10).setValue(profileClickRate);
        sheet.getRange(index + 2, 11).setValue(getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS));
      }

      // フォロー率再計算
      if (profileClicks > 0) {
        const followRate = dailyFollowerIncrease / profileClicks;
        sheet.getRange(index + 2, 16).setValue(followRate);
        sheet.getRange(index + 2, 17).setValue(getJudgment(followRate, FOLLOW_RATE_THRESHOLDS));
      }
    });

    Logger.log(`指標を再計算しました: ${sheetName}`);
  });
}

// ========== Web API ==========

/**
 * Chrome拡張機能からのPOSTリクエストを処理
 * Web Appとしてデプロイ後に使用
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = saveAnalyticsFromExtension(data);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエスト
 * action=getTweets&username=xxx&days=7 でツイート一覧を取得
 */
function doGet(e) {
  try {
    Logger.log('doGet called with params: ' + JSON.stringify(e.parameter));

    const action = e.parameter.action;

    if (action === 'getTweets') {
      const username = e.parameter.username;
      const days = parseInt(e.parameter.days) || 7;

      Logger.log('getTweets: username=' + username + ', days=' + days);

      if (!username) {
        return jsonResponse({ success: false, error: 'username is required' });
      }

      const result = getTweetsForExtension(username, days);
      Logger.log('getTweetsForExtension result: ' + JSON.stringify(result));
      return jsonResponse(result);
    }

    if (action === 'getAccounts') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const accounts = getAccountList(ss);
      return jsonResponse({ success: true, accounts: accounts });
    }

    return jsonResponse({ status: 'ok', message: 'X Analytics API is running' });
  } catch (error) {
    Logger.log('doGet error: ' + error.toString() + ' | Stack: ' + error.stack);
    return jsonResponse({ success: false, error: error.message || error.toString() });
  }
}

/**
 * JSON レスポンスを返す
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 拡張機能用: ツイート一覧を取得してAnalytics URLを生成
 */
function getTweetsForExtension(username, days) {
  try {
    Logger.log('getTweetsForExtension: start - username=' + username + ', days=' + days);

    const userId = getUserId(username);
    Logger.log('getTweetsForExtension: userId=' + userId);

    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    Logger.log('getTweetsForExtension: startTime=' + startTime.toISOString() + ', endTime=' + now.toISOString());

    const tweets = getTweets(userId, startTime, now);
    Logger.log('getTweetsForExtension: got ' + (tweets ? tweets.length : 0) + ' tweets');

    // Analytics URL付きのリストを作成
    const tweetList = tweets.map(tweet => {
      const createdAt = new Date(tweet.created_at);
      return {
        postId: tweet.id,
        text: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        createdAt: Utilities.formatDate(createdAt, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
        analyticsUrl: `https://x.com/i/account_analytics/content/${tweet.id}?referrerUrl=%2Fi%2Faccount_analytics%2Fcontent%3F`,
        statusUrl: `https://x.com/${username}/status/${tweet.id}`,
        metrics: tweet.public_metrics
      };
    });

    Logger.log('getTweetsForExtension: returning ' + tweetList.length + ' tweets');

    return {
      success: true,
      username: username,
      count: tweetList.length,
      tweets: tweetList
    };
  } catch (error) {
    Logger.log('getTweetsForExtension error: ' + error.toString() + ' | Stack: ' + error.stack);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * 拡張機能から受け取ったAnalyticsデータを保存
 */
function saveAnalyticsFromExtension(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // アカウントIDの検証
  if (!data.accountId) {
    return { success: false, error: 'アカウントIDがありません' };
  }

  // ポストIDの検証
  if (!data.postId) {
    return { success: false, error: 'ポストIDがありません' };
  }

  // 設定シートに登録されているアカウントか確認
  const registeredAccounts = getAccountList(ss);
  if (!registeredAccounts.includes(data.accountId)) {
    // 登録されていない場合は警告を返すが、処理は続行
    Logger.log(`警告: ${data.accountId} は設定シートに登録されていません`);
  }

  // 月別シートを取得または作成
  const now = new Date();
  const sheet = getOrCreateMonthlySheet(ss, data.accountId, now);

  // 既存のポストIDを確認（重複防止）
  const existingPostIds = getExistingPostIds(sheet);
  if (existingPostIds.has(data.postId)) {
    // 既存データを更新
    return updateExistingPost(sheet, data, existingPostIds.get(data.postId));
  }

  // 新規データを追加
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');

  // プロクリ率計算
  const impressions = data.impressions || 0;
  const profileClicks = data.profileClicks || 0;
  const profileClickRate = impressions > 0 ? profileClicks / impressions : 0;
  const profileClickRateJudgment = getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS);

  // フォロー率計算（新規フォロー / プロフクリック）
  const newFollows = data.newFollows || 0;
  const followRate = profileClicks > 0 ? newFollows / profileClicks : 0;
  const followRateJudgment = getJudgment(followRate, FOLLOW_RATE_THRESHOLDS);

  const tweetUrl = data.url || `https://x.com/${data.accountId}/status/${data.postId}`;
  const analyticsUrl = `https://x.com/i/account_analytics/content/${data.postId}`;

  // 投稿日付（APIから取得したcreatedAtがあれば使用、なければ取得日付）
  const postedDateStr = data.createdAt || dateStr;
  const collectedDateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

  const newRow = [
    data.postId,                       // 1: ポストID
    postedDateStr,                     // 2: 投稿日付
    collectedDateStr,                  // 3: 取得日付
    '',                                // 4: 種類（手動入力）
    data.tweetText || '',              // 5: ツイート本文
    impressions,                       // 6: インプ数
    data.likes || 0,                   // 7: いいね数
    profileClicks,                     // 8: プロフクリック数
    0,                                 // 9: 詳細クリック
    profileClickRate,                  // 10: プロクリ率
    profileClickRateJudgment,          // 11: プロクリ判定
    data.reposts || 0,                 // 12: RT数
    data.replies || 0,                 // 13: リプ数
    0,                                 // 14: リプした数（手動入力）
    0,                                 // 15: フォロワー数（後で取得）
    followRate,                        // 16: フォロー率
    followRateJudgment,                // 17: フォロー率判定
    newFollows,                        // 18: フォロワー増加数（日）= 新規フォロー
    0,                                 // 19: フォロワー増加数（週）
    tweetUrl,                          // 20: ツイートURL
    analyticsUrl                       // 21: AnalyticsURL
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);

  // フォーマット設定
  formatDataSheet(sheet, lastRow + 1, 1);

  return {
    success: true,
    message: `データを保存しました: ${data.accountId}/${data.postId}`,
    sheetName: sheet.getName()
  };
}

/**
 * 既存のポストIDを取得（行番号とセットで）
 */
function getExistingPostIds(sheet) {
  const lastRow = sheet.getLastRow();
  const postIds = new Map();

  if (lastRow > 1) {
    // ポストIDは1列目
    const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    idColumn.forEach((row, index) => {
      if (row[0]) {
        postIds.set(row[0].toString(), index + 2);
      }
    });

    // URLからもポストIDを抽出（フォールバック、ツイートURLは20列目）
    const numCols = sheet.getLastColumn();
    if (numCols >= 20) {
      const urlColumn = sheet.getRange(2, 20, lastRow - 1, 1).getValues();
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
 * 既存のポストデータを更新
 */
function updateExistingPost(sheet, data, rowIndex) {
  // 更新する列のみ上書き
  const impressions = data.impressions || 0;
  const profileClicks = data.profileClicks || 0;

  sheet.getRange(rowIndex, 6).setValue(impressions);           // インプ数
  sheet.getRange(rowIndex, 7).setValue(data.likes || 0);       // いいね数
  sheet.getRange(rowIndex, 8).setValue(profileClicks);         // プロフクリック数
  sheet.getRange(rowIndex, 12).setValue(data.reposts || 0);    // RT数
  sheet.getRange(rowIndex, 13).setValue(data.replies || 0);    // リプ数
  sheet.getRange(rowIndex, 18).setValue(data.newFollows || 0); // フォロワー増加数（日）

  // 取得日付を更新（3列目）
  const collectedDateStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.getRange(rowIndex, 3).setValue(collectedDateStr);

  // プロクリ率再計算
  const profileClickRate = impressions > 0 ? profileClicks / impressions : 0;
  sheet.getRange(rowIndex, 10).setValue(profileClickRate);
  sheet.getRange(rowIndex, 11).setValue(getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS));

  // フォロー率再計算
  const newFollows = data.newFollows || 0;
  const followRate = profileClicks > 0 ? newFollows / profileClicks : 0;
  sheet.getRange(rowIndex, 16).setValue(followRate);
  sheet.getRange(rowIndex, 17).setValue(getJudgment(followRate, FOLLOW_RATE_THRESHOLDS));

  return {
    success: true,
    message: `データを更新しました: ${data.accountId}/${data.postId}`,
    updated: true
  };
}
