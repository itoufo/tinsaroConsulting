// Popup スクリプト

let currentData = null;

// DOM要素
const statusEl = document.getElementById('status');
const dataSectionEl = document.getElementById('dataSection');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refreshBtn');
const gasUrlInput = document.getElementById('gasUrl');
const saveBtn = document.getElementById('saveBtn');

// ステータス表示
function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// データ表示
function displayData(data) {
  document.getElementById('accountId').textContent = data.accountId || '-';
  document.getElementById('postId').textContent = data.postId || '-';
  document.getElementById('tweetText').textContent = data.tweetText || '-';
  document.getElementById('impressions').textContent = formatNumber(data.impressions);
  document.getElementById('likes').textContent = formatNumber(data.likes);
  document.getElementById('reposts').textContent = formatNumber(data.reposts);
  document.getElementById('replies').textContent = formatNumber(data.replies);
  document.getElementById('profileClicks').textContent = formatNumber(data.profileClicks);
  document.getElementById('newFollows').textContent = formatNumber(data.newFollows);
  document.getElementById('bookmarks').textContent = formatNumber(data.bookmarks);
  document.getElementById('engagementRate').textContent = data.engagementRate || '-';

  dataSectionEl.classList.remove('hidden');
}

// 数値フォーマット
function formatNumber(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}

// データ取得
async function collectData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Analytics ページまたはツイートページをチェック
    const isAnalyticsPage = tab.url.match(/x\.com\/i\/account_analytics\/content\/\d+/);
    const isStatusPage = tab.url.match(/(?:x\.com|twitter\.com)\/[^\/]+\/status\/\d+/);

    if (!isAnalyticsPage && !isStatusPage) {
      showStatus('Analytics ページまたはツイートページを開いてください', 'error');
      dataSectionEl.classList.add('hidden');
      return;
    }

    // content scriptにメッセージを送信
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'collectData' });

    if (response.success) {
      currentData = response.data;
      displayData(currentData);

      if (!currentData.accountId) {
        showStatus('アカウントIDが取得できませんでした', 'error');
      } else if (currentData.impressions === null) {
        showStatus('Analyticsデータが見つかりません。ページをスクロールして表示してください', 'info');
      } else {
        showStatus('データを取得しました', 'success');
      }
    } else {
      showStatus(response.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('データ取得に失敗しました。ページを再読み込みしてください', 'error');
  }
}

// GASに送信
async function sendToGAS() {
  const gasUrl = gasUrlInput.value.trim();

  if (!gasUrl) {
    showStatus('GAS Web App URLを設定してください', 'error');
    return;
  }

  if (!currentData) {
    showStatus('送信するデータがありません', 'error');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = '送信中...';
  showStatus('シートに送信中...', 'info');

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(currentData),
      mode: 'no-cors' // GASはCORS制限があるため
    });

    // no-corsモードではレスポンスが読めないので、成功とみなす
    showStatus('送信しました！', 'success');
    sendBtn.textContent = '送信完了';

    // 3秒後にボタンを元に戻す
    setTimeout(() => {
      sendBtn.disabled = false;
      sendBtn.textContent = 'シートに送信';
    }, 3000);

  } catch (error) {
    console.error('Send error:', error);
    showStatus('送信に失敗しました: ' + error.message, 'error');
    sendBtn.disabled = false;
    sendBtn.textContent = 'シートに送信';
  }
}

// GAS URLを保存
function saveGasUrl() {
  const url = gasUrlInput.value.trim();
  chrome.storage.local.set({ gasUrl: url }, () => {
    showStatus('URLを保存しました', 'success');
  });
}

// GAS URLを読み込み
function loadGasUrl() {
  chrome.storage.local.get(['gasUrl'], (result) => {
    if (result.gasUrl) {
      gasUrlInput.value = result.gasUrl;
    }
  });
}

// イベントリスナー
sendBtn.addEventListener('click', sendToGAS);
refreshBtn.addEventListener('click', collectData);
saveBtn.addEventListener('click', saveGasUrl);

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadGasUrl();
  collectData();
});
