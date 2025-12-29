/**
 * WebApi.js - Chrome拡張機能向けAPI
 */

/**
 * GETリクエストハンドラ
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getTweets':
        return handleGetTweets(e.parameter);

      case 'getAccounts':
        return jsonResponse({ success: true, accounts: getAccountList() });

      case 'getSettings':
        return handleGetSettings();

      case 'getSettingsUrl':
        return jsonResponse({ success: true, settingsUrl: getSettingsUrl() });

      case 'getExistingPosts':
        return handleGetExistingPosts(e.parameter);

      default:
        return jsonResponse({ status: 'ok', message: 'X Analytics API is running' });
    }
  } catch (error) {
    Logger.log(`doGet error: ${error.toString()}`);
    return jsonResponse({ success: false, error: error.message || error.toString() });
  }
}

/**
 * POSTリクエストハンドラ
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = saveAnalyticsFromExtension(data);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

/**
 * JSONレスポンスを返す
 * @param {Object} data - レスポンスデータ
 * @returns {TextOutput} レスポンス
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== ハンドラ関数 ==========

/**
 * ツイート一覧取得ハンドラ
 */
function handleGetTweets(params) {
  const username = params.username;
  const days = parseInt(params.days) || 7;

  if (!username) {
    return jsonResponse({ success: false, error: 'username is required' });
  }

  return jsonResponse(getTweetsForExtension(username, days));
}

/**
 * 設定取得ハンドラ
 */
function handleGetSettings() {
  const settings = getAccountSettings();
  const accountList = [];

  settings.forEach((config, accountName) => {
    accountList.push({
      accountName: accountName,
      spreadsheetId: config.spreadsheetId,
      spreadsheetUrl: config.spreadsheetUrl
    });
  });

  return jsonResponse({
    success: true,
    settingsUrl: getSettingsUrl(),
    accounts: accountList
  });
}

/**
 * 既存ポスト取得ハンドラ
 */
function handleGetExistingPosts(params) {
  const username = params.username;

  if (!username) {
    return jsonResponse({ success: false, error: 'username is required' });
  }

  return jsonResponse(getExistingPostsForExtension(username));
}

// ========== API実装 ==========

/**
 * 拡張機能用: ツイート一覧を取得
 * @param {string} username - ユーザー名
 * @param {number} days - 取得日数
 * @returns {Object} 結果
 */
function getTweetsForExtension(username, days) {
  try {
    const userId = getUserId(username);
    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const tweets = getTweets(userId, startTime, now);

    const tweetList = tweets.map(tweet => {
      const createdAt = new Date(tweet.created_at);
      return {
        postId: tweet.id,
        text: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
        createdAt: formatDateTime(createdAt),
        analyticsUrl: `https://x.com/i/account_analytics/content/${tweet.id}`,
        statusUrl: `https://x.com/${username}/status/${tweet.id}`,
        metrics: tweet.public_metrics
      };
    });

    return {
      success: true,
      username: username,
      count: tweetList.length,
      tweets: tweetList
    };
  } catch (error) {
    Logger.log(`getTweetsForExtension error: ${error.toString()}`);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * 拡張機能用: 既存ポストの収集状態を取得
 * @param {string} username - ユーザー名
 * @returns {Object} 結果
 */
function getExistingPostsForExtension(username) {
  try {
    const accountSettings = getAccountSettings();
    const accountConfig = accountSettings.get(username);

    if (!accountConfig) {
      return {
        success: false,
        error: `アカウント「${username}」は設定シートに登録されていません`,
        settingsUrl: getSettingsUrl()
      };
    }

    const ss = SpreadsheetApp.openById(accountConfig.spreadsheetId);
    const posts = [];

    ss.getSheets().forEach(sheet => {
      const sheetName = sheet.getName();
      if (!sheetName.startsWith(username + '_')) return;

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      const data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.ANALYTICS_URL).getValues();

      data.forEach(row => {
        const postId = row[COLUMNS.POST_ID - 1]?.toString();
        if (!postId) return;

        const profileClicks = row[COLUMNS.PROFILE_CLICKS - 1];
        const isCollected = profileClicks !== '' && profileClicks !== null && profileClicks !== undefined;

        posts.push({
          postId: postId,
          createdAt: row[COLUMNS.POSTED_DATE - 1],
          text: row[COLUMNS.TWEET_TEXT - 1]?.toString().substring(0, 100) || '',
          analyticsUrl: row[COLUMNS.ANALYTICS_URL - 1] || `https://x.com/i/account_analytics/content/${postId}`,
          isCollected: isCollected,
          profileClicks: isCollected ? profileClicks : null
        });
      });
    });

    // 新しい順にソート
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      username: username,
      spreadsheetUrl: accountConfig.spreadsheetUrl,
      totalPosts: posts.length,
      collectedCount: posts.filter(p => p.isCollected).length,
      pendingCount: posts.filter(p => !p.isCollected).length,
      posts: posts
    };
  } catch (error) {
    Logger.log(`getExistingPostsForExtension error: ${error.toString()}`);
    return { success: false, error: error.message || error.toString() };
  }
}

/**
 * 拡張機能から受け取ったAnalyticsデータを保存
 * @param {Object} data - Analyticsデータ
 * @returns {Object} 結果
 */
function saveAnalyticsFromExtension(data) {
  // バリデーション
  if (!data.accountId) {
    return { success: false, error: 'アカウントIDがありません' };
  }
  if (!data.postId) {
    return { success: false, error: 'ポストIDがありません' };
  }

  // アカウント設定取得
  const accountSettings = getAccountSettings();
  const accountConfig = accountSettings.get(data.accountId);

  if (!accountConfig) {
    return {
      success: false,
      error: `アカウント「${data.accountId}」は設定シートに登録されていません`,
      settingsUrl: getSettingsUrl()
    };
  }

  // スプレッドシートを開く
  let ss;
  try {
    ss = SpreadsheetApp.openById(accountConfig.spreadsheetId);
  } catch (error) {
    return {
      success: false,
      error: `転記先スプレッドシートにアクセスできません: ${error.message}`,
      settingsUrl: getSettingsUrl()
    };
  }

  const sheet = getOrCreateMonthlySheet(ss, data.accountId, new Date());
  const existingPostIds = getExistingPostIds(sheet);

  // 既存データなら更新
  if (existingPostIds.has(data.postId)) {
    return updateExistingPost(sheet, data, existingPostIds.get(data.postId));
  }

  // 新規データを追加
  return insertNewPost(sheet, data);
}

/**
 * 新規ポストを挿入
 * @param {Sheet} sheet - シート
 * @param {Object} data - データ
 * @returns {Object} 結果
 */
function insertNewPost(sheet, data) {
  const impressions = data.impressions || 0;
  const profileClicks = data.profileClicks || 0;
  const newFollows = data.newFollows || 0;

  const profileClickRate = calcProfileClickRate(profileClicks, impressions);
  const followRate = calcFollowRate(newFollows, profileClicks);

  const newRow = [
    data.postId,
    data.createdAt || formatDate(new Date()),
    formatDateTime(new Date()),
    '',
    data.tweetText || '',
    impressions,
    data.likes || 0,
    profileClicks,
    0,
    profileClickRate,
    getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS),
    data.reposts || 0,
    data.replies || 0,
    0,
    0,
    followRate,
    getJudgment(followRate, FOLLOW_RATE_THRESHOLDS),
    newFollows,
    0,
    data.url || `https://x.com/${data.accountId}/status/${data.postId}`,
    `https://x.com/i/account_analytics/content/${data.postId}`
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);
  formatDataSheet(sheet, lastRow + 1, 1);

  return {
    success: true,
    message: `データを保存しました: ${data.accountId}/${data.postId}`,
    sheetName: sheet.getName()
  };
}

/**
 * 既存ポストを更新
 * @param {Sheet} sheet - シート
 * @param {Object} data - データ
 * @param {number} rowIndex - 行番号
 * @returns {Object} 結果
 */
function updateExistingPost(sheet, data, rowIndex) {
  const impressions = data.impressions || 0;
  const profileClicks = data.profileClicks || 0;
  const newFollows = data.newFollows || 0;

  // 各列を更新
  sheet.getRange(rowIndex, COLUMNS.COLLECTED_DATE).setValue(formatDateTime(new Date()));
  sheet.getRange(rowIndex, COLUMNS.IMPRESSIONS).setValue(impressions);
  sheet.getRange(rowIndex, COLUMNS.LIKES).setValue(data.likes || 0);
  sheet.getRange(rowIndex, COLUMNS.PROFILE_CLICKS).setValue(profileClicks);
  sheet.getRange(rowIndex, COLUMNS.RETWEETS).setValue(data.reposts || 0);
  sheet.getRange(rowIndex, COLUMNS.REPLIES).setValue(data.replies || 0);
  sheet.getRange(rowIndex, COLUMNS.DAILY_FOLLOWER_INCREASE).setValue(newFollows);

  // プロクリ率
  const profileClickRate = calcProfileClickRate(profileClicks, impressions);
  sheet.getRange(rowIndex, COLUMNS.PROFILE_CLICK_RATE).setValue(profileClickRate);
  sheet.getRange(rowIndex, COLUMNS.PROFILE_CLICK_JUDGMENT).setValue(
    getJudgment(profileClickRate, PROFILE_CLICK_RATE_THRESHOLDS)
  );

  // フォロー率
  const followRate = calcFollowRate(newFollows, profileClicks);
  sheet.getRange(rowIndex, COLUMNS.FOLLOW_RATE).setValue(followRate);
  sheet.getRange(rowIndex, COLUMNS.FOLLOW_RATE_JUDGMENT).setValue(
    getJudgment(followRate, FOLLOW_RATE_THRESHOLDS)
  );

  return {
    success: true,
    message: `データを更新しました: ${data.accountId}/${data.postId}`,
    updated: true
  };
}
