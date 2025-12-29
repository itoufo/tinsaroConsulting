/**
 * Config.js - 定数・設定値
 */

// 設定用スプレッドシートID（ハードコーディング）
const SETTINGS_SPREADSHEET_ID = '1SF4IBNl_7zD560zpt0Q0rq8WknVOxerYz1kuCfhcoUE';

// シート名
const SHEET_NAME_SETTINGS = '設定';
const SHEET_NAME_MANUAL = 'マニュアル';

// プロフクリック率の判定基準
const PROFILE_CLICK_RATE_THRESHOLDS = {
  EXCELLENT: 0.05,  // ◎ 5%以上
  GOOD: 0.03,       // ○ 3%以上
  FAIR: 0.02,       // △ 2%以上
};

// フォロー率の判定基準
const FOLLOW_RATE_THRESHOLDS = {
  EXCELLENT: 0.03,  // ◎ 3%以上
  GOOD: 0.02,       // ○ 2%以上
  FAIR: 0.01,       // △ 1%以上
};

// データシートのカラム定義
const COLUMNS = {
  POST_ID: 1,
  POSTED_DATE: 2,
  COLLECTED_DATE: 3,
  TYPE: 4,
  TWEET_TEXT: 5,
  IMPRESSIONS: 6,
  LIKES: 7,
  PROFILE_CLICKS: 8,
  DETAIL_CLICKS: 9,
  PROFILE_CLICK_RATE: 10,
  PROFILE_CLICK_JUDGMENT: 11,
  RETWEETS: 12,
  REPLIES: 13,
  REPLY_COUNT: 14,
  FOLLOWERS: 15,
  FOLLOW_RATE: 16,
  FOLLOW_RATE_JUDGMENT: 17,
  DAILY_FOLLOWER_INCREASE: 18,
  WEEKLY_FOLLOWER_INCREASE: 19,
  TWEET_URL: 20,
  ANALYTICS_URL: 21,
};

// ヘッダー定義
const DATA_HEADERS = [
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
