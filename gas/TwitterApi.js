/**
 * TwitterApi.js - X(Twitter) API連携
 */

/**
 * Bearer Tokenを取得
 * @returns {string}
 */
function getBearerToken() {
  const token = PropertiesService.getScriptProperties().getProperty('BEARER_TOKEN');
  if (!token) {
    throw new Error('BEARER_TOKENがスクリプトプロパティに設定されていません');
  }
  return token;
}

/**
 * ユーザー名からユーザーIDを取得
 * @param {string} username - ユーザー名（@なし）
 * @returns {string} ユーザーID
 */
function getUserId(username) {
  const token = getBearerToken();
  const url = `https://api.twitter.com/2/users/by/username/${username}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());

  if (json.errors) {
    throw new Error(`ユーザー取得エラー: ${json.errors[0].message}`);
  }

  return json.data.id;
}

/**
 * ユーザーのフォロワー数を取得
 * @param {string} userId - ユーザーID
 * @returns {number} フォロワー数
 */
function getFollowerCount(userId) {
  const token = getBearerToken();
  const url = `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics`;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true
  });

  const json = JSON.parse(response.getContentText());

  if (json.errors) {
    throw new Error(`フォロワー数取得エラー: ${json.errors[0].message}`);
  }

  return json.data.public_metrics.followers_count;
}

/**
 * ツイートを取得（ページネーション対応）
 * @param {string} userId - ユーザーID
 * @param {Date} startTime - 取得開始日時
 * @param {Date} endTime - 取得終了日時
 * @returns {Object[]} ツイートの配列
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

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': `Bearer ${token}` },
      muteHttpExceptions: true
    });

    const json = JSON.parse(response.getContentText());

    if (json.errors) {
      Logger.log(`ツイート取得エラー: ${json.errors[0].message}`);
      break;
    }

    if (json.data) {
      tweets.push(...json.data);
    }

    paginationToken = json.meta?.next_token;
    Utilities.sleep(1000); // API制限対策

  } while (paginationToken);

  return tweets;
}
