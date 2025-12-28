// @ts-nocheck
// =============================================
// 環境設定（開発/本番切り替え）
// =============================================

// シートID
// 開発用
const SHEET_TINSALO = "1qoMLt0l2C4p5X2Z7hJxjvIKBvI9I_VG48SVVoPCzGG8";
// 本番用（コメントアウト）
// const SHEET_TINSALO = "1CDLY39QuWYcMrZKjRYqUCHqglqh7-PVTlL0LEwiGGzQ";

// シート名
const SHEET_NAME_TOP10 = "昨日のTOP10";
const SHEET_NAME_MATOME = "まとめ";
const SHEET_NAME_ITIRAN = "一覧";
const SHEET_NAME_MONTHLY = "月間レポート";
const SHEET_NAME_DAILY_TWEETS = "日次ツイート蓄積";

// =============================================
// 月間レポート設定
// =============================================
const MONTHLY_TARGET_ACCOUNT = "対象アカウントID"; // 対象アカウントID（@なし）

// 日次ツイート蓄積シート 列定義
const DAILY_CLM_DATE = 1;       // 日付
const DAILY_CLM_TWEET_ID = 2;   // ツイートID
const DAILY_CLM_URL = 3;        // URL
const DAILY_CLM_TEXT = 4;       // テキスト
const DAILY_CLM_LIKE = 5;       // いいね
const DAILY_CLM_RT = 6;         // RT
const DAILY_CLM_REPLY = 7;      // リプライ
const DAILY_CLM_CREATED = 8;    // 作成日時
const DAILY_ROW_HEADER = 1;     // ヘッダー行
const DAILY_ROW_START = 2;      // データ開始行

// 日付フォーマット
const DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss[Z]";
const DATE_FORMAT_ITIRAN = "YYYY/MM/DD";

// ちんサロ　一覧
const ITIRAN_ROW_HEDDER = 2; // ヘッダー行
const ITIRAN_CLM_NAME = 1; // アカウント名
const ITIRAN_CLM_ID = 2; // Twitter ID
const ITIRAN_CLM_USERID = 3; // ユーザーID
const ITIRAN_CLM_FOLLOWER = 6; // フォロワー

// ちんサロ　まとめ
const MATOME_ROW_S = 3; // 行開始
const MATOME_ICON = 2; // アイコン
const MATOME_ID = 4; // Twitter ID
const MATOME_SLACK = 5; // SLACK メンバーID

// ちんサロ　【累計】フォロワーランキング
const RUIKEI_CLM_ID = 4 // Twitter ID
const RUIKEI_CLM_RANK = 6 // ランキング

// ちんサロ　昨日のTOP10
const TOP10_ROW_S = 3; // 行開始
const TOP10_ROW_E = 12; // 行終了
const TOP10_CLM_S = 2; // 列開始
const TOP10_CLM_NEXT = 15; // 次の列までの間隔（14列+余白1列）

const TOP10_DATE = 2; // 日付
const TOP10_ICON = 3; // アイコン
const TOP10_ACCOUNT_NAME = 4; // アカウント名
const TOP10_ACCOUNT_ID = 5; // アカウントID
const TOP10_FOLLOWER = 6; // 獲得フォロワー
const TOP10_FOLLOWERALL = 7; // 総フォロワー
const TOP10_USER_ID = 8; // ユーザーID
const TOP10_URL = 9; // URL
const TOP10_TEXT = 10; // 内容
const TOP10_LIKE = 11; // いいね
const TOP10_RT = 12; // RT
const TOP10_REPLY = 13; // リプライ
const TOP10_TWEET_COUNT = 14; // 取得ツイート数
const TOP10_EVALUATION = 15; // AI評価

// キリ番判定
const KIRIBAN_CHECK_RANGE = 7; // 過去何日分まで判定に使用するか
const KIRIBAN_MESSAGE = "{{mention}}\n{{threshold}}名達成おめでとうございます！\n次は{{threshold_next}}名目指して頑張りましょう。\nコツコツ交流しながら継続していけば必ず達成できます♪";

const KIRIBAN_MESSAGE_1000_KIRIBAN = "{{mention}}\nついに！1000フォロワー達成おめでとう！\n最初はポストへの反応も少なくて、投稿を考えるのも大変で何度も心が折れそうになったこともあったはず。\nそれでもあきらめずに頑張ってきたのはエライ！{{mention}}さんの頑張りが実った瞬間だね♪\n次は5000人を目指して頑張ろう。\n「目指せ5000人将」の部屋で管理人の <@U03MNTAU79D> さんが待ってるよ\nぜひ目標フォロワー数を広言してみてね。\nそして月2回の5000人将MTGにも参加してみて！\nこれからも一緒に頑張ろう！";
const KIRIBAN_MESSAGE_1000_CHEER = "みんな―聞いて！！\n{{mention}}さんがフォロワー1000名達成したよ。\n「金の卵」を無事卒業！\nこれからは「5000人将軍」を目指していく。\nこれからもぜひ応援していこう！\n{{mention}}さんぜひ喜びのお言葉を👇\n";

const KIRIBAN_MESSAGE_5000_KIRIBAN = "{{mention}}\nついに！ついに！5000フォロワー達成おめでとう！\nここまでの道のりは簡単じゃなかったはず。\n自分の勝ちパターンを見つけて実力をつけてきたからこそ得られた成果だね。\n次はいよいよ10000人を目指して頑張ろう。\nSNSをやるうえでは１つの到達点の万垢。\nここまでつけてきた実力をアウトプットすることでさらにレベルをUPしていこう。サロン内での講師もおススメ。\n適切にアウトプットができる。\nチャレンジしたい方はさとちんまで連絡してみてね。これからも一緒に頑張ろう！\n";
const KIRIBAN_MESSAGE_5000_CHEER = "みんな―聞いて！！\n{{mention}}さんがフォロワー5000名達成したよ。\n運用の実力がついた証。\nつぎは頂（いただき）の万垢へ！\nこれからもぜひ応援していこう！\n{{mention}}さんぜひ喜びのお言葉を👇";

const KIRIBAN_MESSAGE_10000_KIRIBAN = "{{mention}}\nついに！ついに！ついに！\n10000フォロワー達成おめでとう！\nもう！ホントにおめでとう！！\nSNSをやる人なら誰しもが目指す万垢。\nそれでも到達できるのは全体の２％。\nそこに到達できた{{mention}}の実力は本物だよ\nこれからはその影響力を行使してさらに飛躍していきましょう！\nつぎの目標はもちろん20000名だよね♪\nこれからも一緒に頑張ろう！";
const KIRIBAN_MESSAGE_10000_CHEER = "みんな―聞いて！！\n{{mention}}さんがフォロワー10000名達成したよ。\nSNSを頑張る人なら目指す万垢をついに達成！\nこれからの活躍が楽しみだね！\nこれからもぜひ応援していこう！\n{{mention}}さんぜひ喜びのお言葉を👇";

// Slack Webhook URL
// スクリプトプロパティから取得するか、以下に設定
const SLACK_POSTSHARE = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"; // 06ポスト共有
const SLACK_CHEER = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"; // 09応援依頼
const SLACK_KIRIBAN = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"; // #15 キリ番

const IMAGE_NOTHING = ""; // 画像なし
const IMAGE_KIRIBAN1000 = "1NXJsmBeMILhwFU_4qnW5H3EtW2bBdrun"; // 画像_キリ番1000
const IMAGE_KIRIBAN5000 = "1NaQxvAB44QfJYctEU9LUuquczOMdTbN0"; // 画像_キリ番5000
const IMAGE_KIRIBAN10000 = "1NVjgjbeAq1Xoj23jIEs-lOz9NlGiZKR8"; // 画像_キリ番10000
const IMAGE_CHEER1000 = "1NSrcFE8fSs6EIw14DvlpuekF4LegWk5Q"; // 画像_応援1000
const IMAGE_CHEER5000 = "1NPOjdwHDiNOHOf0RfZmXbOVcHZfyRdIb"; // 画像_応援5000
const IMAGE_CHEER10000 = "1NS9iSgYv7FLGwD9oampCEGgaxK4KjA3X"; // 画像_応援10000

// 大量フォロワー獲得
const OVER_FOLLOWER = 500;
const MESSAGE_500OVER = "昨日" + OVER_FOLLOWER + "人以上フォロワーが伸びたポストを紹介するよ。みんな参考にしよう♡\n{{mention}}　+{{count}}名\n{{postUrl}}\n簡単に解説してくれたら、僕は嬉しいなあ♡"

// No.1ポストシェア
const MESSAGE_POSTSHARE_HEADER = "昨日のサロン全体のフォロワー伸びは{{count}}人でした。\nそして昨日爆伸びだったポストを紹介するよ。みんな参考にしよう♡\nそれぞれの階層１～３位をピックアップ。\n解説はコメント欄を確認してね。\n";
const MESSAGE_POSTSHARE_10000 = "①フォロワー１００００以上\n＜影響力の行使＞いざインフルエンサー\n"
const MESSAGE_POSTSHARE_5000 = "②フォロワー５００１～９９９９以下\n＜みんなでGO万垢＞アウトプットして駆け上がれ\n"
const MESSAGE_POSTSHARE_1000 = "③フォロワー１００１～５０００\n＜実力の確定＞目指せ５０００人将\n"
const MESSAGE_POSTSHARE_UNDER1000 = "④フォロワー１０００以下として\n＜認知獲得＞金の卵\n"
const MESSAGE_POSTSHARE_MAPPING = "{{mention}}　+{{count}}名\n{{postUrl}}\n"

const MESSAGE_POSTSHARE_FOOTER = "\n\n他の方のRANKはこちらから\nhttps://docs.google.com/spreadsheets/d/1CDLY39QuWYcMrZKjRYqUCHqglqh7-PVTlL0LEwiGGzQ/edit#gid=2005564833\n【24年度の伸びたポスト＆伸びリスト】\nhttps://docs.google.com/spreadsheets/d/1vH5WrRReAt20prQlpwhqHcEAYgcPZu2FZx2MhaIbJJw/edit?usp=sharing\n【23年度の伸びたポスト＆伸びリスト】\nhttps://docs.google.com/spreadsheets/d/1w-03s5A_5EBWzwerwpyEKjF4Ty26qupOHxogt4eodU0/edit?usp=sharing"

// OAuth1 認証キー(BEARER_TOKEN)
const AUTH = "Bearer " + PropertiesService.getScriptProperties().getProperty("BEARER_TOKEN");
var options = {
  "method": "get",
  "muteHttpExceptions":true,
  "headers": {
    "authorization": AUTH
  },
};

/**
 * slackにメッセージを送る
 * url web Hook URL
 * message slackで表示するメッセージ
 * create 2024.9.10
 * author みっちー
 */
function sendToSlack(url, message, image_id) {
  // postするdata
  var data;
  var image_url;

  // 画像なし
  if (image_id == IMAGE_NOTHING) {
    data = {
      "text" : message,
      "unfurl_links": true,
    };
  }
  // 画像あり
  else {
    image_url = "https://drive.google.com/uc?id=" + image_id;

    data = {
      "text" : message,
      "unfurl_links": true,
      "attachments": [{
          "fields": [
              {
                  "title": "達成画像",
                  "value": "image",
              }],
          "image_url": image_url
      }]
    };
  }

  var payload = JSON.stringify(data);

  var options = {
    "method" : "POST",
    "contentType" : "application/json",
    "payload" : payload
  };

  UrlFetchApp.fetch(url, options);
}