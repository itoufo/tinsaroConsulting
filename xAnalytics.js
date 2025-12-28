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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
      '日付',
      '種類',
      'ツイート本文',
      'インプ数',
      'いいね数',
      'プロフクリック数',
      '詳細クリック',
      'プロクリ率',
      'プロクリ判定',
      'RT数',
      'リプ数',
      'リプした数',
      'フォロワー数',
      'フォロー率',
      'フォロー率判定',
      'フォロワー増加数（日）',
      'フォロワー増加数（週）',
      'ツイートURL'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // 列幅調整
    sheet.setColumnWidth(1, 100);  // 日付
    sheet.setColumnWidth(2, 60);   // 種類
    sheet.setColumnWidth(3, 400);  // ツイート本文
    sheet.setColumnWidth(18, 300); // URL

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
        const dateStr = Utilities.formatDate(createdAt, 'Asia/Tokyo', 'yyyy/MM/dd');

        newRows.push([
          dateStr,                                    // 日付
          '',                                         // 種類（手動入力）
          tweet.text,                                 // ツイート本文
          impressions,                                // インプ数
          likes,                                      // いいね数
          profileClicks,                              // プロフクリック数
          detailClicks,                               // 詳細クリック
          profileClickRate,                           // プロクリ率
          profileClickRateJudgment,                   // プロクリ判定
          retweets,                                   // RT数
          replies,                                    // リプ数
          0,                                          // リプした数（手動入力）
          currentFollowers,                           // フォロワー数
          followRate,                                 // フォロー率
          followRateJudgment,                         // フォロー率判定
          dailyFollowerIncrease,                      // フォロワー増加数（日）
          weeklyFollowerIncrease,                     // フォロワー増加数（週）
          tweetUrl                                    // ツイートURL
        ]);
      });

      if (newRows.length > 0) {
        // 日付順（古い順）にソート
        newRows.sort((a, b) => new Date(a[0]) - new Date(b[0]));

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

  // フォロワー数は13列目
  const followerCount = sheet.getRange(lastRow, 13).getValue();
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

  // 7日前のデータを探す
  const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();

  for (let i = data.length - 1; i >= 0; i--) {
    const rowDate = new Date(data[i][0]);
    if (rowDate <= weekAgo) {
      const weekAgoFollowers = data[i][12];
      if (weekAgoFollowers) {
        return currentFollowers - weekAgoFollowers;
      }
      break;
    }
  }

  // 7日前のデータがない場合は最初のデータとの差分
  if (data.length > 0 && data[0][12]) {
    return currentFollowers - data[0][12];
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
    const urlColumn = sheet.getRange(2, 18, lastRow - 1, 1).getValues();
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
  // プロクリ率（8列目）とフォロー率（14列目）をパーセント表示
  sheet.getRange(startRow, 8, numRows, 1).setNumberFormat('0.00%');
  sheet.getRange(startRow, 14, numRows, 1).setNumberFormat('0.00%');

  // 数値列のフォーマット
  sheet.getRange(startRow, 4, numRows, 4).setNumberFormat('#,##0');  // インプ〜詳細クリック
  sheet.getRange(startRow, 10, numRows, 4).setNumberFormat('#,##0'); // RT〜フォロワー数
  sheet.getRange(startRow, 16, numRows, 2).setNumberFormat('#,##0'); // フォロワー増加数
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    // 設定シート以外の月別シートを処理
    if (sheetName === SHEET_NAME_SETTINGS) return;
    if (!sheetName.includes('_')) return; // アカウント_年-月 形式でなければスキップ

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();

    data.forEach((row, index) => {
      const impressions = row[3];      // インプ数
      const profileClicks = row[5];    // プロフクリック数
      const dailyFollowerIncrease = row[15]; // フォロワー増加数（日）

      // プロクリ率再計算
      if (impressions > 0) {
        const profileClickRate = profileClicks / impressions;
        sheet.getRange(index + 2, 8).setValue(profileClickRate);
        sheet.getRange(index + 2, 9).setValue(getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS));
      }

      // フォロー率再計算
      if (profileClicks > 0) {
        const followRate = dailyFollowerIncrease / profileClicks;
        sheet.getRange(index + 2, 14).setValue(followRate);
        sheet.getRange(index + 2, 15).setValue(getJudgment(followRate, FOLLOW_RATE_THRESHOLDS));
      }
    });

    Logger.log(`指標を再計算しました: ${sheetName}`);
  });
}
