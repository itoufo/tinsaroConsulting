// X Analytics データ取得スクリプト

/**
 * URLからアカウントIDとポストIDを取得
 */
function getPostInfo() {
  const url = window.location.href;
  // https://x.com/username/status/1234567890 の形式
  const match = url.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status\/(\d+)/);

  if (match) {
    return {
      accountId: match[1],
      postId: match[2],
      url: url
    };
  }
  return null;
}

/**
 * Analyticsデータをスクレイピング
 */
function scrapeAnalyticsData() {
  const data = {
    impressions: null,      // インプレッション数
    likes: null,            // いいね
    replies: null,          // 返信
    reposts: null,          // リポスト
    engagementRate: null,   // エンゲージメント率
    profileClicks: null,    // プロフィールへのアクセス数
    newFollows: null,       // 新しいフォロー
    bookmarks: null,        // ブックマーク
    shares: null,           // 共有された回数
    mediaViews: null        // メディアの再生数
  };

  // ラベルとデータのマッピング
  const labelMap = {
    'インプレッション': 'impressions',
    'インプレッション数': 'impressions',
    'いいね': 'likes',
    '返信': 'replies',
    'リポスト': 'reposts',
    'エンゲージメント率': 'engagementRate',
    'プロフィールへのアクセス数': 'profileClicks',
    'プロフィールへのアクセス': 'profileClicks',
    '新しいフォロー': 'newFollows',
    'ブックマーク': 'bookmarks',
    '共有された回数': 'shares',
    '共有': 'shares',
    'メディアの再生数': 'mediaViews',
    'メディア再生数': 'mediaViews'
  };

  // Analytics セクションを探す
  // 方法1: テキストラベルから探す
  const allText = document.querySelectorAll('p');
  allText.forEach(p => {
    const text = p.textContent.trim();

    for (const [label, key] of Object.entries(labelMap)) {
      if (text === label) {
        // 前の兄弟要素から数値を取得
        const parent = p.parentElement;
        if (parent) {
          const valueElement = parent.querySelector('p.font-semibold, p[class*="subtext"]');
          if (valueElement && valueElement !== p) {
            const value = valueElement.textContent.trim();
            data[key] = parseValue(value);
          }
        }
      }
    }
  });

  // 方法2: grid構造から探す（フォールバック）
  if (data.impressions === null) {
    const gridItems = document.querySelectorAll('.grid > div');
    gridItems.forEach(item => {
      const label = item.querySelector('p[class*="muted"], p[class*="text-\\[10px\\]"]');
      const value = item.querySelector('p[class*="font-semibold"], p[class*="subtext"]');

      if (label && value) {
        const labelText = label.textContent.trim();
        const valueText = value.textContent.trim();

        for (const [labelKey, dataKey] of Object.entries(labelMap)) {
          if (labelText.includes(labelKey)) {
            data[dataKey] = parseValue(valueText);
            break;
          }
        }
      }
    });
  }

  return data;
}

/**
 * 値をパース（数値、パーセント、"-"など）
 */
function parseValue(value) {
  if (!value || value === '-') {
    return null;
  }

  // パーセントの場合
  if (value.includes('%')) {
    return value; // そのまま文字列で返す
  }

  // カンマ区切りの数値
  const num = value.replace(/,/g, '');
  const parsed = parseInt(num, 10);

  return isNaN(parsed) ? value : parsed;
}

/**
 * 全データを収集
 */
function collectAllData() {
  const postInfo = getPostInfo();

  if (!postInfo) {
    return {
      success: false,
      error: 'ツイートページではありません。URLを確認してください。'
    };
  }

  const analytics = scrapeAnalyticsData();

  return {
    success: true,
    data: {
      ...postInfo,
      ...analytics,
      collectedAt: new Date().toISOString()
    }
  };
}

// メッセージリスナー（popupからの要求に応答）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectData') {
    const result = collectAllData();
    sendResponse(result);
  }
  return true; // 非同期レスポンスを許可
});

// コンソールにロード完了を表示
console.log('X Analytics Extension loaded');
