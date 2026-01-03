/**
 * Main.js - GAS直接実行関数（トリガー・手動実行用）
 */

/**
 * 初期化（最初に実行）
 * 設定用スプレッドシートにマニュアルシートと設定シートを作成
 */
function initialize() {
  const ss = SpreadsheetApp.openById(SETTINGS_SPREADSHEET_ID);
  initializeSheets(ss);
  Logger.log('初期化が完了しました。設定シートにアカウント名と転記先スプレッドシートIDを入力してください。');
}

/**
 * 月次実行用の関数（毎月月初にトリガーで呼び出し）
 * 前月分のツイートを取得
 */
function monthlyFetch() {
  const accountSettings = getAccountSettings();

  if (accountSettings.size === 0) {
    Logger.log('エラー: 設定シートにアカウントを登録してください');
    return;
  }

  const { start, end } = getPreviousMonthRange();
  Logger.log(`取得期間: ${formatDate(start)} 〜 ${formatDate(end)}`);

  // フォロワー数一覧を取得
  const followerData = getFollowerListData();
  Logger.log(`フォロワー数一覧: ${followerData.userRows.size}アカウント, ${followerData.dateColumns.size}日分`);

  processAllAccounts(accountSettings, start, end, followerData);
}

/**
 * 前月の期間（月初0:00〜月末23:59:59）を取得
 * @returns {Object} { start: Date, end: Date }
 */
function getPreviousMonthRange() {
  const now = new Date();

  // 前月の1日 0:00:00
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);

  // 前月の最終日 23:59:59
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * 初回実行用（過去7日分を取得）
 */
function initialFetch() {
  const accountSettings = getAccountSettings();

  if (accountSettings.size === 0) {
    Logger.log('エラー: 設定シートにアカウントを登録してください');
    return;
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const followerData = getFollowerListData();
  processAllAccounts(accountSettings, weekAgo, now, followerData);
}

/**
 * 手動実行用（テスト）
 */
function manualFetch() {
  monthlyFetch();
}

/**
 * 全アカウントを処理
 * @param {Map} accountSettings - アカウント設定
 * @param {Date} startTime - 開始日時
 * @param {Date} endTime - 終了日時
 * @param {Object} followerData - フォロワー数一覧データ
 */
function processAllAccounts(accountSettings, startTime, endTime, followerData) {
  accountSettings.forEach((config, username) => {
    try {
      Logger.log(`処理中: ${username} -> ${config.spreadsheetId}`);
      const ss = SpreadsheetApp.openById(config.spreadsheetId);
      fetchAndSaveTweets(ss, username, startTime, endTime, followerData);
    } catch (error) {
      Logger.log(`エラー (${username}): ${error.message}`);
    }
    Utilities.sleep(2000); // API制限対策
  });
}

/**
 * ツイートを取得してスプレッドシートに保存
 * @param {Spreadsheet} ss - スプレッドシート
 * @param {string} username - ユーザー名
 * @param {Date} startTime - 開始日時
 * @param {Date} endTime - 終了日時
 * @param {Object} followerData - フォロワー数一覧データ
 */
function fetchAndSaveTweets(ss, username, startTime, endTime, followerData) {
  // ユーザー情報取得
  const userId = getUserId(username);
  Logger.log(`ユーザーID (${username}): ${userId}`);

  // ツイート取得
  const tweets = getTweets(userId, startTime, endTime);
  Logger.log(`取得ツイート数 (${username}): ${tweets.length}`);

  if (tweets.length === 0) {
    Logger.log(`新しいツイートはありません (${username})`);
    return;
  }

  // 月ごとにグループ化
  const tweetsByMonth = groupTweetsByMonth(tweets, username);

  // 月ごとにシートに保存
  for (const monthKey in tweetsByMonth) {
    const monthTweets = tweetsByMonth[monthKey];
    const sampleDate = new Date(monthTweets[0].created_at);
    const sheet = getOrCreateMonthlySheet(ss, username, sampleDate);

    saveTweetsToSheet(sheet, monthTweets, username, followerData);
  }
}

/**
 * ツイートを月ごとにグループ化
 * @param {Object[]} tweets - ツイート配列
 * @param {string} username - ユーザー名
 * @returns {Object} 月別ツイート
 */
function groupTweetsByMonth(tweets, username) {
  const tweetsByMonth = {};

  tweets.forEach(tweet => {
    const createdAt = new Date(tweet.created_at);
    const monthKey = getMonthlySheetName(username, createdAt);
    if (!tweetsByMonth[monthKey]) {
      tweetsByMonth[monthKey] = [];
    }
    tweetsByMonth[monthKey].push(tweet);
  });

  return tweetsByMonth;
}

/**
 * ツイートをシートに保存
 * @param {Sheet} sheet - シート
 * @param {Object[]} tweets - ツイート配列
 * @param {string} username - ユーザー名
 * @param {Object} followerData - フォロワー数一覧データ
 */
function saveTweetsToSheet(sheet, tweets, username, followerData) {
  const existingUrls = getExistingTweetUrls(sheet);
  const newRows = [];

  tweets.forEach(tweet => {
    const tweetUrl = `https://twitter.com/${username}/status/${tweet.id}`;
    if (existingUrls.has(tweetUrl)) return; // 重複スキップ

    const metrics = tweet.public_metrics;
    const createdAt = new Date(tweet.created_at);

    // 投稿日のフォロワー数を取得
    const followerCount = getFollowerCountByDate(followerData, username, createdAt) || '';

    newRows.push([
      tweet.id,                                              // ポストID
      formatDate(createdAt),                                 // 投稿日付
      formatDateTime(new Date()),                            // 取得日付
      '',                                                    // 種類
      tweet.text,                                            // ツイート本文
      metrics.impression_count || 0,                         // インプ数
      metrics.like_count || 0,                               // いいね数
      '',                                                    // プロフクリック数（空欄=未収集）
      '',                                                    // 詳細クリック（空欄=未収集）
      '',                                                    // プロクリ率
      '',                                                    // プロクリ判定
      metrics.retweet_count || 0,                            // RT数
      metrics.reply_count || 0,                              // リプ数
      '',                                                    // リプした数
      followerCount,                                         // フォロワー数（投稿日時点）
      '',                                                    // フォロー率
      '',                                                    // フォロー率判定
      '',                                                    // フォロワー増加数（日）
      '',                                                    // フォロワー増加数（週）
      tweetUrl,                                              // ツイートURL
      `https://x.com/i/account_analytics/content/${tweet.id}` // AnalyticsURL
    ]);
  });

  if (newRows.length > 0) {
    // 日付順にソート
    newRows.sort((a, b) => new Date(a[1]) - new Date(b[1]));

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    formatDataSheet(sheet, lastRow + 1, newRows.length);

    Logger.log(`${newRows.length}件のツイートを追加しました`);
  }
}

/**
 * 既存データのプロクリ率・フォロー率を再計算
 * 全アカウントの転記先スプレッドシートを処理
 */
function recalculateMetrics() {
  const accountSettings = getAccountSettings();

  if (accountSettings.size === 0) {
    Logger.log('設定シートにアカウントが登録されていません');
    return;
  }

  accountSettings.forEach((config, username) => {
    try {
      Logger.log(`処理中: ${username}`);
      const ss = SpreadsheetApp.openById(config.spreadsheetId);

      ss.getSheets().forEach(sheet => {
        const sheetName = sheet.getName();
        if (!sheetName.includes('_')) return;

        recalculateSheetMetrics(sheet);
        Logger.log(`再計算完了: ${sheetName}`);
      });
    } catch (error) {
      Logger.log(`エラー (${username}): ${error.message}`);
    }
  });
}

/**
 * シートの指標を再計算
 * @param {Sheet} sheet - シート
 */
function recalculateSheetMetrics(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.DAILY_FOLLOWER_INCREASE).getValues();

  data.forEach((row, index) => {
    const impressions = row[COLUMNS.IMPRESSIONS - 1];
    const profileClicks = row[COLUMNS.PROFILE_CLICKS - 1];
    const dailyFollowerIncrease = row[COLUMNS.DAILY_FOLLOWER_INCREASE - 1];
    const rowNum = index + 2;

    // プロクリ率
    if (impressions > 0 && profileClicks) {
      const rate = calcProfileClickRate(profileClicks, impressions);
      sheet.getRange(rowNum, COLUMNS.PROFILE_CLICK_RATE).setValue(rate);
      sheet.getRange(rowNum, COLUMNS.PROFILE_CLICK_JUDGMENT).setValue(
        getJudgment(rate, PROFILE_CLICK_RATE_THRESHOLDS)
      );
    }

    // フォロー率
    if (profileClicks > 0 && dailyFollowerIncrease) {
      const rate = calcFollowRate(dailyFollowerIncrease, profileClicks);
      sheet.getRange(rowNum, COLUMNS.FOLLOW_RATE).setValue(rate);
      sheet.getRange(rowNum, COLUMNS.FOLLOW_RATE_JUDGMENT).setValue(
        getJudgment(rate, FOLLOW_RATE_THRESHOLDS)
      );
    }
  });
}
