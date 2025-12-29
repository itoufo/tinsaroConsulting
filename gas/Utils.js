/**
 * Utils.js - ユーティリティ関数
 */

/**
 * 率に基づいて判定を返す
 * @param {number} rate - 率
 * @param {Object} thresholds - 閾値
 * @returns {string} 判定（◎○△✕）
 */
function getJudgment(rate, thresholds) {
  if (rate >= thresholds.EXCELLENT) return '◎';
  if (rate >= thresholds.GOOD) return '○';
  if (rate >= thresholds.FAIR) return '△';
  return '✕';
}

/**
 * 日付をフォーマット
 * @param {Date} date - 日付
 * @param {string} format - フォーマット
 * @returns {string} フォーマット済み文字列
 */
function formatDate(date, format = 'yyyy/MM/dd') {
  return Utilities.formatDate(date, 'Asia/Tokyo', format);
}

/**
 * 日付と時刻をフォーマット
 * @param {Date} date - 日付
 * @returns {string} フォーマット済み文字列
 */
function formatDateTime(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}

/**
 * スクリプトプロパティにBEARER_TOKENを設定（ダイアログ版）
 */
function setBearerToken() {
  const token = Browser.inputBox('Bearer Tokenを入力してください');
  if (token && token !== 'cancel') {
    PropertiesService.getScriptProperties().setProperty('BEARER_TOKEN', token);
    Logger.log('Bearer Tokenを設定しました');
  }
}

/**
 * プロクリ率を計算
 * @param {number} profileClicks - プロフクリック数
 * @param {number} impressions - インプレッション数
 * @returns {number} プロクリ率
 */
function calcProfileClickRate(profileClicks, impressions) {
  return impressions > 0 ? profileClicks / impressions : 0;
}

/**
 * フォロー率を計算
 * @param {number} newFollows - 新規フォロー数
 * @param {number} profileClicks - プロフクリック数
 * @returns {number} フォロー率
 */
function calcFollowRate(newFollows, profileClicks) {
  return profileClicks > 0 ? newFollows / profileClicks : 0;
}
