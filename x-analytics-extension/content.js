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

  // __INITIAL_STATE__ にはツイートアナリティクスデータがないため、DOMスクレイピングを使用
  console.log('[X-Analytics] Using DOM scraping (K/M suffix supported)');

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
 * window.__INITIAL_STATE__ からデータを取得
 */
function getDataFromInitialState() {
  try {
    // scriptタグから __INITIAL_STATE__ を探す
    const scripts = document.querySelectorAll('script');
    let initialState = null;

    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>|$)/);
      if (match) {
        try {
          initialState = JSON.parse(match[1]);
          break;
        } catch (e) {
          console.log('[X-Analytics] Failed to parse __INITIAL_STATE__:', e);
        }
      }
    }

    // グローバル変数からも試す
    if (!initialState && window.__INITIAL_STATE__) {
      initialState = window.__INITIAL_STATE__;
    }

    if (!initialState) {
      console.log('[X-Analytics] __INITIAL_STATE__ not found');
      return null;
    }

    console.log('[X-Analytics] Found __INITIAL_STATE__, keys:', Object.keys(initialState));

    // デバッグ: 全体構造を出力
    debugLogStructure(initialState, '__INITIAL_STATE__', 0);

    // Analytics データを探す
    const analyticsData = findAnalyticsData(initialState);

    if (analyticsData) {
      console.log('[X-Analytics] Found analytics data:', analyticsData);
      return analyticsData;
    }

    return null;
  } catch (error) {
    console.log('[X-Analytics] Error getting __INITIAL_STATE__:', error);
    return null;
  }
}

/**
 * デバッグ用: オブジェクト構造をログ出力
 */
function debugLogStructure(obj, path, depth) {
  if (depth > 3 || !obj || typeof obj !== 'object') return;

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const val = obj[key];
    const currentPath = `${path}.${key}`;

    // 数値を含むキーを探す
    const interestingKeys = ['impression', 'profile', 'click', 'like', 'follow', 'view', 'engage', 'metric', 'count', 'analytics'];
    const isInteresting = interestingKeys.some(k => key.toLowerCase().includes(k));

    if (isInteresting) {
      console.log(`[X-Analytics DEBUG] ${currentPath}:`, typeof val === 'object' ? JSON.stringify(val).substring(0, 200) : val);
    }

    if (typeof val === 'object' && val !== null) {
      debugLogStructure(val, currentPath, depth + 1);
    }
  }
}

/**
 * 値を数値に変換（オブジェクトの場合はvalue等を探す）
 */
function extractNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseValue(val);
  if (typeof val === 'object') {
    // { value: 123 } や { count: 123 } のようなオブジェクト
    if (val.value !== undefined) return extractNumber(val.value);
    if (val.count !== undefined) return extractNumber(val.count);
    if (val.total !== undefined) return extractNumber(val.total);
    // 配列の場合は最初の要素
    if (Array.isArray(val) && val.length > 0) return extractNumber(val[0]);
  }
  return null;
}

/**
 * __INITIAL_STATE__ 内からアナリティクスデータを再帰的に探す
 */
function findAnalyticsData(obj, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== 'object') return null;

  // analytics関連のキーを探す
  const analyticsKeys = ['contentAnalytics', 'tweetAnalytics', 'analytics', 'metrics', 'organic_metrics'];

  for (const key of analyticsKeys) {
    if (obj[key]) {
      console.log('[X-Analytics] Found key:', key, obj[key]);
      return normalizeAnalyticsData(obj[key]);
    }
  }

  // impressions や profileClicks が直接あるか
  if (obj.impressions !== undefined || obj.impressionCount !== undefined) {
    console.log('[X-Analytics] Found impressions directly in object:', obj);
    return normalizeAnalyticsData(obj);
  }

  // 再帰的に探す
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const result = findAnalyticsData(obj[key], depth + 1);
      if (result) return result;
    }
  }

  return null;
}

/**
 * アナリティクスデータを正規化
 */
function normalizeAnalyticsData(obj) {
  console.log('[X-Analytics] Normalizing data:', JSON.stringify(obj).substring(0, 500));

  return {
    impressions: extractNumber(obj.impressions) || extractNumber(obj.impressionCount) || extractNumber(obj.impression_count),
    profileClicks: extractNumber(obj.profileClicks) || extractNumber(obj.profileClickCount) || extractNumber(obj.user_profile_clicks) || extractNumber(obj.profile_clicks),
    likes: extractNumber(obj.likes) || extractNumber(obj.likeCount) || extractNumber(obj.favorite_count) || extractNumber(obj.favourites_count),
    replies: extractNumber(obj.replies) || extractNumber(obj.replyCount) || extractNumber(obj.reply_count),
    reposts: extractNumber(obj.reposts) || extractNumber(obj.retweetCount) || extractNumber(obj.retweet_count),
    newFollows: extractNumber(obj.newFollows) || extractNumber(obj.follows) || extractNumber(obj.follow_count) || extractNumber(obj.new_follows),
    bookmarks: extractNumber(obj.bookmarks) || extractNumber(obj.bookmarkCount) || extractNumber(obj.bookmark_count),
    shares: extractNumber(obj.shares) || extractNumber(obj.shareCount) || extractNumber(obj.share_count)
  };
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
