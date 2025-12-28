// X Analytics データ取得スクリプト

/**
 * URLからポスト情報を取得
 */
function getPostInfo() {
  const url = window.location.href;

  // パターン1: Analytics専用ページ
  // https://x.com/i/account_analytics/content/1977442895788736963?...
  const analyticsMatch = url.match(/x\.com\/i\/account_analytics\/content\/(\d+)/);
  if (analyticsMatch) {
    const postId = analyticsMatch[1];
    // アカウントIDはHTMLから取得
    const accountId = getAccountIdFromPage();
    return {
      accountId: accountId,
      postId: postId,
      url: `https://x.com/${accountId}/status/${postId}`,
      pageType: 'analytics'
    };
  }

  // パターン2: ツイート詳細ページ
  // https://x.com/username/status/1234567890
  const statusMatch = url.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status\/(\d+)/);
  if (statusMatch) {
    return {
      accountId: statusMatch[1],
      postId: statusMatch[2],
      url: url,
      pageType: 'status'
    };
  }

  return null;
}

/**
 * ページ内のHTMLからアカウントIDを取得
 */
function getAccountIdFromPage() {
  // 方法1: プロフィールリンクから取得
  // <a href="https://x.com/itoWalker" ...>
  const profileLinks = document.querySelectorAll('a[href^="https://x.com/"]');
  for (const link of profileLinks) {
    const href = link.getAttribute('href');
    // /status/ を含まないプロフィールリンクを探す
    const match = href.match(/x\.com\/([^\/\?]+)$/);
    if (match && match[1] !== 'i' && match[1] !== 'home' && match[1] !== 'search') {
      return match[1];
    }
  }

  // 方法2: ステータスリンクから取得
  // <a href="https://x.com/username/status/xxx" ...>
  const statusLinks = document.querySelectorAll('a[href*="/status/"]');
  for (const link of statusLinks) {
    const href = link.getAttribute('href');
    const match = href.match(/x\.com\/([^\/]+)\/status\/\d+/);
    if (match) {
      return match[1];
    }
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
    mediaViews: null,       // メディアの再生数
    detailClicks: null      // 詳細クリック
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
    'プロフクリック': 'profileClicks',
    '新しいフォロー': 'newFollows',
    'ブックマーク': 'bookmarks',
    '共有された回数': 'shares',
    '共有': 'shares',
    'メディアの再生数': 'mediaViews',
    'メディア再生数': 'mediaViews',
    '詳細のクリック数': 'detailClicks',
    '詳細クリック': 'detailClicks'
  };

  // 方法1: muted-foreground クラスのラベルを探す
  const labels = document.querySelectorAll('p[class*="muted-foreground"], p[class*="text-\\[10px\\]"]');
  labels.forEach(labelEl => {
    const labelText = labelEl.textContent.trim();

    for (const [label, key] of Object.entries(labelMap)) {
      if (labelText.includes(label)) {
        // 親要素から値を取得
        const parent = labelEl.closest('div');
        if (parent) {
          const valueEl = parent.querySelector('p[class*="font-semibold"], p[class*="subtext"]');
          if (valueEl && valueEl !== labelEl) {
            const value = valueEl.textContent.trim();
            if (data[key] === null) {
              data[key] = parseValue(value);
            }
          }
        }
        break;
      }
    }
  });

  // 方法2: grid構造から探す（フォールバック）
  if (data.impressions === null) {
    const gridContainers = document.querySelectorAll('.grid, [class*="grid"]');
    gridContainers.forEach(grid => {
      const items = grid.querySelectorAll(':scope > div');
      items.forEach(item => {
        const texts = item.querySelectorAll('p');
        let labelText = '';
        let valueText = '';

        texts.forEach(p => {
          const text = p.textContent.trim();
          // 数値っぽいかどうかで判定
          if (/^[\d,\.%\-]+$/.test(text) || text === '-') {
            valueText = text;
          } else {
            labelText = text;
          }
        });

        if (labelText && valueText) {
          for (const [label, key] of Object.entries(labelMap)) {
            if (labelText.includes(label)) {
              if (data[key] === null) {
                data[key] = parseValue(valueText);
              }
              break;
            }
          }
        }
      });
    });
  }

  // 方法3: 全テキストから探す（最終フォールバック）
  if (data.impressions === null) {
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
      const childPs = div.querySelectorAll(':scope > p');
      if (childPs.length === 2) {
        const first = childPs[0].textContent.trim();
        const second = childPs[1].textContent.trim();

        // どちらかがラベル、どちらかが値
        for (const [label, key] of Object.entries(labelMap)) {
          if (second.includes(label)) {
            if (data[key] === null) {
              data[key] = parseValue(first);
            }
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
 * ツイート本文を取得
 */
function getTweetText() {
  // line-clamp-3 クラスを持つ要素を探す
  const textEl = document.querySelector('[class*="line-clamp"]');
  if (textEl) {
    return textEl.textContent.trim();
  }

  // dir="auto" を持つ要素を探す
  const autoDir = document.querySelector('div[dir="auto"]');
  if (autoDir) {
    return autoDir.textContent.trim();
  }

  return null;
}

/**
 * 全データを収集
 */
function collectAllData() {
  const postInfo = getPostInfo();

  if (!postInfo) {
    return {
      success: false,
      error: 'Analytics ページまたはツイートページではありません。'
    };
  }

  if (!postInfo.accountId) {
    return {
      success: false,
      error: 'アカウントIDが取得できませんでした。ページを再読み込みしてください。',
      postId: postInfo.postId
    };
  }

  const analytics = scrapeAnalyticsData();
  const tweetText = getTweetText();

  return {
    success: true,
    data: {
      ...postInfo,
      ...analytics,
      tweetText: tweetText,
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
