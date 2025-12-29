// Popup スクリプト - タスク管理機能付き

// ========== デバッグ ==========
function debugLog(label, data) {
  console.log(`[X-Analytics] ${label}:`, data);
}

// ========== 状態管理 ==========
let tasks = [];
let fetchedTweets = [];
let currentPageData = null;
let usernameHistory = [];

// ========== DOM要素 ==========
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// 収集タブ
const collectStatus = document.getElementById('collectStatus');
const usernameInput = document.getElementById('username');
const daysSelect = document.getElementById('days');
const fetchTweetsBtn = document.getElementById('fetchTweetsBtn');
const tweetPreview = document.getElementById('tweetPreview');
const addToTasksBtn = document.getElementById('addToTasksBtn');

// タスクタブ
const tasksStatus = document.getElementById('tasksStatus');
const progressFill = document.getElementById('progressFill');
const taskList = document.getElementById('taskList');
const sendAllBtn = document.getElementById('sendAllBtn');
const clearTasksBtn = document.getElementById('clearTasksBtn');

// 現在のページタブ
const currentStatus = document.getElementById('currentStatus');
const currentData = document.getElementById('currentData');
const refreshDataBtn = document.getElementById('refreshDataBtn');
const saveCurrentBtn = document.getElementById('saveCurrentBtn');

// 設定タブ
const gasUrlInput = document.getElementById('gasUrl');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// ========== タブ切り替え ==========
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

    // タブ切り替え時の処理
    if (tab.dataset.tab === 'current') {
      collectCurrentPageData();
    } else if (tab.dataset.tab === 'tasks') {
      renderTasks();
    }
  });
});

// ========== ストレージ ==========
async function loadTasks() {
  debugLog('loadTasks', 'Loading from storage...');
  const result = await chrome.storage.local.get(['tasks', 'gasUrl', 'usernameHistory', 'lastUsername']);
  debugLog('loadTasks result', result);

  tasks = result.tasks || [];
  usernameHistory = result.usernameHistory || [];

  if (result.gasUrl) {
    gasUrlInput.value = result.gasUrl;
  }
  if (result.lastUsername) {
    usernameInput.value = result.lastUsername;
  }

  // ユーザー名履歴をdatalistに設定
  updateUsernameDatalist();
  renderTasks();
}

function updateUsernameDatalist() {
  const datalist = document.getElementById('usernameList');
  if (datalist) {
    datalist.innerHTML = usernameHistory.map(u => `<option value="${u}">`).join('');
  }
}

async function saveUsernameToHistory(username) {
  if (!username) return;

  // 重複を除去して先頭に追加
  usernameHistory = [username, ...usernameHistory.filter(u => u !== username)].slice(0, 10);
  await chrome.storage.local.set({
    usernameHistory: usernameHistory,
    lastUsername: username
  });
  updateUsernameDatalist();
}

async function saveTasks() {
  await chrome.storage.local.set({ tasks });
  renderTasks();
}

async function saveSettings() {
  await chrome.storage.local.set({ gasUrl: gasUrlInput.value.trim() });
  showStatus(collectStatus, '設定を保存しました', 'success');
}

// ========== ステータス表示 ==========
function showStatus(element, message, type = 'info') {
  element.textContent = message;
  element.className = `status ${type}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

// ========== 収集タブ: ツイート取得 ==========
async function fetchTweets() {
  const username = usernameInput.value.trim();
  const days = daysSelect.value;

  debugLog('fetchTweets', { username, days });

  if (!username) {
    showStatus(collectStatus, 'アカウント名を入力してください', 'error');
    return;
  }

  const gasUrl = gasUrlInput.value.trim();
  debugLog('GAS URL', gasUrl);

  if (!gasUrl) {
    showStatus(collectStatus, 'GAS URLを設定してください', 'error');
    return;
  }

  // ユーザー名を履歴に保存
  await saveUsernameToHistory(username);

  fetchTweetsBtn.disabled = true;
  fetchTweetsBtn.textContent = '取得中...';
  showStatus(collectStatus, 'ツイート一覧を取得中...', 'info');

  try {
    const url = `${gasUrl}?action=getTweets&username=${encodeURIComponent(username)}&days=${days}`;
    debugLog('Fetching URL', url);

    const response = await fetch(url);
    debugLog('Response status', response.status);
    debugLog('Response ok', response.ok);

    const responseText = await response.text();
    debugLog('Response text (raw)', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      debugLog('JSON parse error', parseError);
      throw new Error(`JSONパースエラー: ${responseText.substring(0, 200)}`);
    }

    debugLog('Parsed data', data);

    if (data.success) {
      if (!data.tweets) {
        debugLog('Warning', 'data.tweets is undefined');
        throw new Error('tweets配列がレスポンスに含まれていません');
      }

      fetchedTweets = data.tweets.map(t => ({
        ...t,
        accountId: username
      }));

      debugLog('fetchedTweets', fetchedTweets);

      // 既存タスクとの重複チェック
      const existingIds = new Set(tasks.map(t => t.postId));
      const newTweets = fetchedTweets.filter(t => !existingIds.has(t.postId));

      document.getElementById('tweetCount').textContent = fetchedTweets.length;
      document.getElementById('pendingCount').textContent = newTweets.length;
      document.getElementById('completedCount').textContent = fetchedTweets.length - newTweets.length;

      tweetPreview.classList.remove('hidden');
      showStatus(collectStatus, `${fetchedTweets.length}件のツイートを取得しました`, 'success');
    } else {
      debugLog('API returned error', data.error);
      showStatus(collectStatus, `エラー: ${data.error || 'unknown error'}`, 'error');
      tweetPreview.classList.add('hidden');
    }
  } catch (error) {
    debugLog('Fetch error', error);
    showStatus(collectStatus, `取得失敗: ${error.message}`, 'error');
    tweetPreview.classList.add('hidden');
  } finally {
    fetchTweetsBtn.disabled = false;
    fetchTweetsBtn.textContent = 'ツイート一覧を取得';
  }
}

function addToTasks() {
  const existingIds = new Set(tasks.map(t => t.postId));

  fetchedTweets.forEach(tweet => {
    if (!existingIds.has(tweet.postId)) {
      tasks.push({
        postId: tweet.postId,
        accountId: tweet.accountId,
        text: tweet.text,
        createdAt: tweet.createdAt,
        analyticsUrl: tweet.analyticsUrl,
        statusUrl: tweet.statusUrl,
        status: 'pending',  // pending, completed, error
        data: null
      });
    }
  });

  saveTasks();
  showStatus(collectStatus, 'タスクに追加しました', 'success');

  // タスクタブに切り替え
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tasks"]').classList.add('active');
  document.getElementById('tab-tasks').classList.add('active');
}

// ========== タスクタブ: レンダリング ==========
function renderTasks() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  document.getElementById('taskTotal').textContent = total;
  document.getElementById('taskPending').textContent = pending;
  document.getElementById('taskCompleted').textContent = completed;

  const progress = total > 0 ? (completed / total) * 100 : 0;
  progressFill.style.width = `${progress}%`;

  if (total === 0) {
    showStatus(tasksStatus, 'タスクがありません', 'info');
    taskList.innerHTML = '';
    sendAllBtn.disabled = true;
    return;
  }

  if (completed === total) {
    showStatus(tasksStatus, '全て取得完了！シートに送信できます', 'success');
  } else {
    showStatus(tasksStatus, `${pending}件のデータを取得してください`, 'info');
  }

  sendAllBtn.disabled = completed === 0;

  // タスクリストを描画
  taskList.innerHTML = tasks.map((task, index) => `
    <div class="task-item ${task.status}">
      <div class="task-status ${task.status}"></div>
      <div class="task-info">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          ${task.createdAt}
          ${task.status === 'completed' ? `| imp: ${formatNumber(task.data?.impressions)} | プロフ: ${formatNumber(task.data?.profileClicks)}` : ''}
        </div>
      </div>
      <a href="${task.analyticsUrl}" target="_blank" class="task-link">開く</a>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clearTasks() {
  if (confirm('全てのタスクをクリアしますか？')) {
    tasks = [];
    saveTasks();
  }
}

// ========== 現在のページタブ: データ取得 ==========
async function collectCurrentPageData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const isAnalyticsPage = tab.url.match(/x\.com\/i\/account_analytics\/content\/(\d+)/);

    if (!isAnalyticsPage) {
      showStatus(currentStatus, 'Analyticsページを開いてください', 'info');
      currentData.classList.add('hidden');
      saveCurrentBtn.disabled = true;
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'collectData' });

    if (response.success) {
      currentPageData = response.data;
      displayCurrentData(currentPageData);
      showStatus(currentStatus, 'データを取得しました', 'success');
      currentData.classList.remove('hidden');
      saveCurrentBtn.disabled = false;

      // 自動でタスクに保存
      autoSaveToTask(currentPageData);
    } else {
      showStatus(currentStatus, response.error, 'error');
      currentData.classList.add('hidden');
      saveCurrentBtn.disabled = true;
    }
  } catch (error) {
    showStatus(currentStatus, 'ページを再読み込みしてください', 'error');
    currentData.classList.add('hidden');
    saveCurrentBtn.disabled = true;
  }
}

function displayCurrentData(data) {
  document.getElementById('curAccountId').textContent = data.accountId || '-';
  document.getElementById('curPostId').textContent = data.postId || '-';
  document.getElementById('curImpressions').textContent = formatNumber(data.impressions);
  document.getElementById('curProfileClicks').textContent = formatNumber(data.profileClicks);
  document.getElementById('curLikes').textContent = formatNumber(data.likes);
  document.getElementById('curNewFollows').textContent = formatNumber(data.newFollows);
}

function autoSaveToTask(data) {
  // タスクリストに該当するポストがあれば自動で更新
  const taskIndex = tasks.findIndex(t => t.postId === data.postId);

  if (taskIndex >= 0) {
    const task = tasks[taskIndex];
    task.status = 'completed';
    // スクレイピングデータに元のタスク情報をマージ
    task.data = {
      ...data,
      // APIから取得した元のツイート本文を優先
      tweetText: task.text || data.tweetText,
      accountId: task.accountId || data.accountId
    };
    debugLog('autoSaveToTask merged', task.data);
    saveTasks();
    showStatus(currentStatus, 'タスクに自動保存しました', 'success');
  }
}

function saveCurrentToTask() {
  if (!currentPageData) return;

  // 既存タスクを探す
  const taskIndex = tasks.findIndex(t => t.postId === currentPageData.postId);

  if (taskIndex >= 0) {
    const task = tasks[taskIndex];
    task.status = 'completed';
    // スクレイピングデータに元のタスク情報をマージ
    task.data = {
      ...currentPageData,
      tweetText: task.text || currentPageData.tweetText,
      accountId: task.accountId || currentPageData.accountId
    };
  } else {
    // 新規タスクとして追加
    tasks.push({
      postId: currentPageData.postId,
      accountId: currentPageData.accountId,
      text: currentPageData.tweetText || '',
      createdAt: new Date().toLocaleDateString('ja-JP'),
      analyticsUrl: `https://x.com/i/account_analytics/content/${currentPageData.postId}`,
      statusUrl: currentPageData.url,
      status: 'completed',
      data: currentPageData
    });
  }

  saveTasks();
  showStatus(currentStatus, 'タスクに保存しました', 'success');
}

// ========== まとめて送信 ==========
async function sendAllToSheet() {
  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) {
    showStatus(tasksStatus, 'GAS URLを設定してください', 'error');
    return;
  }

  const completedTasks = tasks.filter(t => t.status === 'completed' && t.data);
  if (completedTasks.length === 0) {
    showStatus(tasksStatus, '送信するデータがありません', 'error');
    return;
  }

  sendAllBtn.disabled = true;
  sendAllBtn.textContent = '送信中...';
  showStatus(tasksStatus, `${completedTasks.length}件を送信中...`, 'info');

  let successCount = 0;
  let errorCount = 0;

  for (const task of completedTasks) {
    try {
      // 送信データを構築（元のタスク情報とスクレイピングデータをマージ）
      const sendData = {
        ...task.data,
        tweetText: task.text || task.data?.tweetText,
        accountId: task.accountId || task.data?.accountId,
        postId: task.postId,
        createdAt: task.createdAt  // 投稿日付（APIから取得）
      };
      debugLog('Sending to sheet', sendData);

      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendData),
        mode: 'no-cors'
      });
      successCount++;
    } catch (error) {
      errorCount++;
      debugLog('送信エラー', { postId: task.postId, error: error.message });
    }

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  showStatus(tasksStatus, `送信完了: ${successCount}件成功, ${errorCount}件失敗`, successCount > 0 ? 'success' : 'error');
  sendAllBtn.disabled = false;
  sendAllBtn.textContent = 'まとめて送信';
}

// ========== イベントリスナー ==========
fetchTweetsBtn.addEventListener('click', fetchTweets);
addToTasksBtn.addEventListener('click', addToTasks);
clearTasksBtn.addEventListener('click', clearTasks);
sendAllBtn.addEventListener('click', sendAllToSheet);
refreshDataBtn.addEventListener('click', collectCurrentPageData);
saveCurrentBtn.addEventListener('click', saveCurrentToTask);
saveSettingsBtn.addEventListener('click', saveSettings);

// Enterキーでツイート取得
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchTweets();
});

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  collectCurrentPageData();
});
