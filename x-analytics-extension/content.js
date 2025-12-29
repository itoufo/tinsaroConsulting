// X Analytics データ取得スクリプト

// ========== APIレスポンス インターセプト ==========

// キャプチャしたAPIデータを保存
let capturedAnalyticsData = null;

/**
 * ページコンテキストにスクリプトを注入してfetch/XHRをインターセプト
 */
function injectInterceptor() {
  const script = document.createElement('script');
  script.textContent = `
(function() {
  // インターセプト済みフラグ
  if (window.__xAnalyticsIntercepted) return;
  window.__xAnalyticsIntercepted = true;

  console.log('[X-Analytics] Injecting API interceptor');

  // fetch をインターセプト
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = args[0]?.toString() || '';

      // Analytics API のレスポンスをキャプチャ
      if (url.includes('TweetActivityQuery') ||
          url.includes('ContentAnalytics') ||
          url.includes('account_analytics') ||
          url.includes('/i/api/') ||
          (url.includes('/graphql/') && url.includes('Analytics'))) {

        const clone = response.clone();
        clone.json().then(data => {
          console.log('[X-Analytics] Captured fetch response:', url.substring(0, 100));
          const analyticsData = findMetricsInResponse(data);
          if (analyticsData) {
            console.log('[X-Analytics] Found analytics data:', analyticsData);
            window.dispatchEvent(new CustomEvent('xAnalyticsData', { detail: analyticsData }));
          }
        }).catch(() => {});
      }
    } catch (e) {}

    return response;
  };

  // XMLHttpRequest をインターセプト
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const url = this._url || '';

        if (url.includes('TweetActivityQuery') ||
            url.includes('ContentAnalytics') ||
            url.includes('account_analytics') ||
            url.includes('/i/api/') ||
            (url.includes('/graphql/') && url.includes('Analytics'))) {

          const data = JSON.parse(this.responseText);
          console.log('[X-Analytics] Captured XHR response:', url.substring(0, 100));
          const analyticsData = findMetricsInResponse(data);
          if (analyticsData) {
            console.log('[X-Analytics] Found analytics data (XHR):', analyticsData);
            window.dispatchEvent(new CustomEvent('xAnalyticsData', { detail: analyticsData }));
          }
        }
      } catch (e) {}
    });

    return originalSend.apply(this, args);
  };

  // メトリクスを探す関数
  function findMetricsInResponse(obj, depth = 0) {
    if (depth > 20 || !obj || typeof obj !== 'object') return null;

    // 直接メトリクスがある場合
    if (obj.impression_count !== undefined || obj.impressions !== undefined) {
      return {
        impressions: obj.impression_count ?? obj.impressions,
        profileClicks: obj.user_profile_clicks ?? obj.profile_clicks,
        likes: obj.like_count ?? obj.favorite_count ?? obj.likes,
        replies: obj.reply_count ?? obj.replies,
        reposts: obj.retweet_count ?? obj.reposts,
        newFollows: obj.follows ?? obj.new_follows,
        bookmarks: obj.bookmark_count ?? obj.bookmarks,
        shares: obj.share_count ?? obj.shares,
        detailClicks: obj.detail_expands ?? obj.detail_clicks,
        engagements: obj.engagements ?? obj.engagement_count,
        videoViews: obj.video_view_count ?? obj.media_views
      };
    }

    // organic_metrics を探す
    if (obj.organic_metrics) {
      return findMetricsInResponse(obj.organic_metrics, depth + 1);
    }
    if (obj.non_public_metrics) {
      const m = findMetricsInResponse(obj.non_public_metrics, depth + 1);
      if (m) return m;
    }

    // 配列
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = findMetricsInResponse(item, depth + 1);
        if (result) return result;
      }
      return null;
    }

    // 再帰探索（有望なキーを優先）
    const priorityKeys = ['metrics', 'analytics', 'activity', 'data', 'result', 'tweet', 'content', 'core', 'views'];
    for (const key of priorityKeys) {
      if (obj[key]) {
        const result = findMetricsInResponse(obj[key], depth + 1);
        if (result) return result;
      }
    }

    // 残りのキー
    for (const key of Object.keys(obj)) {
      if (!priorityKeys.includes(key)) {
        const result = findMetricsInResponse(obj[key], depth + 1);
        if (result) return result;
      }
    }

    return null;
  }

  console.log('[X-Analytics] API interceptor ready');
})();
`;

  // head が存在すればhead、なければdocumentElementに追加
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// ページコンテキストからのデータを受信
window.addEventListener('xAnalyticsData', (event) => {
  capturedAnalyticsData = event.detail;
  console.log('[X-Analytics] Received analytics data from page context:', capturedAnalyticsData);
});

// インターセプターを注入
injectInterceptor();

/**
 * キャプチャしたAPIデータを取得
 */
function getCapturedApiData() {
  return capturedAnalyticsData;
}

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

  // まずキャプチャしたAPIデータを確認
  const apiData = getCapturedApiData();
  if (apiData && apiData.impressions !== undefined) {
    console.log('[X-Analytics] Using captured API data (raw numbers):', apiData);
    return {
      impressions: apiData.impressions,
      likes: apiData.likes,
      replies: apiData.replies,
      reposts: apiData.reposts,
      engagementRate: null,
      profileClicks: apiData.profileClicks,
      newFollows: apiData.newFollows,
      bookmarks: apiData.bookmarks,
      shares: apiData.shares,
      mediaViews: apiData.videoViews,
      detailClicks: apiData.detailClicks
    };
  }

  console.log('[X-Analytics] No API data captured, using DOM scraping (K/M suffix supported)');

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
 * K = 1000, M = 1000000 に対応
 */
function parseValue(value) {
  if (!value || value === '-') {
    return null;
  }

  // パーセントの場合
  if (value.includes('%')) {
    return value; // そのまま文字列で返す
  }

  // カンマ区切りを除去
  let cleanValue = value.replace(/,/g, '').trim();

  // K/M サフィックスの処理
  const kMatch = cleanValue.match(/^([\d.]+)\s*[Kk]$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  const mMatch = cleanValue.match(/^([\d.]+)\s*[Mm]$/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1]) * 1000000);
  }

  const parsed = parseInt(cleanValue, 10);
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

// ========== 自動収集機能 ==========

/**
 * Analyticsページを検出して自動でタスクに保存
 */
async function autoCollectOnAnalyticsPage() {
  const url = window.location.href;
  const analyticsMatch = url.match(/x\.com\/i\/account_analytics\/content\/(\d+)/);

  if (!analyticsMatch) {
    return; // Analyticsページではない
  }

  console.log('[X-Analytics] Analytics page detected, waiting for data to load...');

  // ページの読み込みを待つ
  await waitForData();

  const result = collectAllData();
  console.log('[X-Analytics] Collected data:', result);

  if (!result.success) {
    console.log('[X-Analytics] Failed to collect:', result.error);
    return;
  }

  // ストレージからタスクを取得して更新
  const storage = await chrome.storage.local.get(['tasks']);
  const tasks = storage.tasks || [];

  const taskIndex = tasks.findIndex(t => t.postId === result.data.postId);

  if (taskIndex >= 0) {
    const task = tasks[taskIndex];
    task.status = 'completed';
    task.data = {
      ...result.data,
      tweetText: task.text || result.data.tweetText,
      accountId: task.accountId || result.data.accountId
    };

    await chrome.storage.local.set({ tasks });
    console.log('[X-Analytics] Task auto-saved:', task.postId);

    // 通知バッジを表示
    showNotification('データを取得しました');
  } else {
    console.log('[X-Analytics] No matching task found for postId:', result.data.postId);
  }
}

/**
 * データが読み込まれるまで待機
 */
function waitForData(maxWait = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = () => {
      // インプレッション数などが表示されているかチェック
      const hasData = document.querySelector('[class*="font-semibold"]') ||
                      document.querySelector('[class*="grid"]');

      if (hasData || Date.now() - startTime > maxWait) {
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

/**
 * 画面に通知を表示
 */
function showNotification(message) {
  const existing = document.getElementById('x-analytics-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'x-analytics-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #1da1f2, #9333ea);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ページ読み込み完了時に自動収集
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(autoCollectOnAnalyticsPage, 1000);
  });
} else {
  setTimeout(autoCollectOnAnalyticsPage, 1000);
}

// SPA対応: URL変更を監視
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('[X-Analytics] URL changed:', lastUrl);
    setTimeout(autoCollectOnAnalyticsPage, 1500);
  }
}).observe(document.body, { subtree: true, childList: true });

// コンソールにロード完了を表示
console.log('[X-Analytics] Extension loaded');
