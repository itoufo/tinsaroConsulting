// Popup スクリプト - スプレッドシート連携版

// ========== デバッグ ==========
function debugLog(label, data) {
  console.log(`[X-Analytics] ${label}:`, data);
}

// ========== 状態管理 ==========
let accounts = [];       // 設定シートのアカウント一覧
let tasks = [];          // タスク一覧（スプシから取得）
let currentPageData = null;

// ========== DOM要素 ==========
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// 収集タブ
const collectStatus = document.getElementById('collectStatus');
const accountSelect = document.getElementById('accountSelect');
const refreshAccountsBtn = document.getElementById('refreshAccountsBtn');
const loadTasksBtn = document.getElementById('loadTasksBtn');
const tweetPreview = document.getElementById('tweetPreview');

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
async function loadSettings() {
  debugLog('loadSettings', 'Loading from storage...');
  const result = await chrome.storage.local.get(['gasUrl', 'lastAccount', 'tasks']);
  debugLog('loadSettings result', result);

  if (result.gasUrl) {
    gasUrlInput.value = result.gasUrl;
    // GAS URLが設定されていればアカウント一覧を取得
    loadAccounts();
  } else {
    accountSelect.innerHTML = '<option value="">-- GAS URLを設定してください --</option>';
    showStatus(collectStatus, 'GAS URLを設定してください', 'error');
  }

  // ローカルに保存されたタスクがあれば復元
  if (result.tasks) {
    tasks = result.tasks;
    renderTasks();
  }

  // 最後に選択したアカウントを復元
  if (result.lastAccount) {
    setTimeout(() => {
      accountSelect.value = result.lastAccount;
    }, 500);
  }
}

async function saveTasks() {
  await chrome.storage.local.set({ tasks });
  renderTasks();
}

async function saveSettings() {
  await chrome.storage.local.set({ gasUrl: gasUrlInput.value.trim() });
  showStatus(collectStatus, '設定を保存しました', 'success');
  // 設定保存後にアカウント一覧を更新
  loadAccounts();
}

// ========== ステータス表示 ==========
function showStatus(element, message, type = 'info') {
  element.textContent = message;
  element.className = `status ${type}`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

// ========== アカウント一覧取得 ==========
async function loadAccounts() {
  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) {
    accountSelect.innerHTML = '<option value="">-- GAS URLを設定してください --</option>';
    return;
  }

  accountSelect.innerHTML = '<option value="">-- 読み込み中 --</option>';
  showStatus(collectStatus, 'アカウント一覧を取得中...', 'info');

  try {
    const url = `${gasUrl}?action=getSettings`;
    const response = await fetch(url);
    const data = await response.json();

    debugLog('loadAccounts', data);

    if (data.success && data.accounts) {
      accounts = data.accounts;

      if (accounts.length === 0) {
        accountSelect.innerHTML = '<option value="">-- 設定シートにアカウントを登録してください --</option>';
        showStatus(collectStatus, '設定シートにアカウントを登録してください', 'error');
      } else {
        accountSelect.innerHTML = accounts.map(acc =>
          `<option value="${acc.accountName}">${acc.accountName}</option>`
        ).join('');
        showStatus(collectStatus, `${accounts.length}件のアカウントを読み込みました`, 'success');
      }
    } else {
      accountSelect.innerHTML = '<option value="">-- 取得失敗 --</option>';
      showStatus(collectStatus, `エラー: ${data.error || 'unknown'}`, 'error');
    }
  } catch (error) {
    debugLog('loadAccounts error', error);
    accountSelect.innerHTML = '<option value="">-- 取得失敗 --</option>';
    showStatus(collectStatus, `取得失敗: ${error.message}`, 'error');
  }
}

// ========== 収集タブ: タスク読み込み ==========
async function loadTasksFromSheet() {
  const username = accountSelect.value;
  if (!username) {
    showStatus(collectStatus, 'アカウントを選択してください', 'error');
    return;
  }

  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) {
    showStatus(collectStatus, 'GAS URLを設定してください', 'error');
    return;
  }

  // 最後に選択したアカウントを保存
  await chrome.storage.local.set({ lastAccount: username });

  loadTasksBtn.disabled = true;
  loadTasksBtn.textContent = '読み込み中...';
  showStatus(collectStatus, 'スプレッドシートからタスクを取得中...', 'info');

  try {
    const url = `${gasUrl}?action=getExistingPosts&username=${encodeURIComponent(username)}`;
    debugLog('loadTasksFromSheet URL', url);

    const response = await fetch(url);
    const data = await response.json();

    debugLog('loadTasksFromSheet result', data);

    if (data.success) {
      // スプレッドシートのデータをタスク形式に変換
      tasks = data.posts.map(post => ({
        postId: post.postId,
        accountId: username,
        text: post.text,
        createdAt: post.createdAt,
        analyticsUrl: post.analyticsUrl,
        statusUrl: `https://x.com/${username}/status/${post.postId}`,
        // プロフクリック数が入っていれば完了、空欄なら未完了
        status: post.isCollected ? 'completed' : 'pending',
        data: post.isCollected ? { profileClicks: post.profileClicks } : null
      }));

      // サマリー表示
      document.getElementById('tweetCount').textContent = data.totalPosts;
      document.getElementById('pendingCount').textContent = data.pendingCount;
      document.getElementById('completedCount').textContent = data.collectedCount;

      tweetPreview.classList.remove('hidden');
      showStatus(collectStatus,
        `${data.totalPosts}件のポスト（未収集: ${data.pendingCount}件）`,
        data.pendingCount > 0 ? 'info' : 'success'
      );

      // タスクを保存
      saveTasks();
    } else {
      showStatus(collectStatus, `エラー: ${data.error || 'unknown'}`, 'error');
      tweetPreview.classList.add('hidden');
    }
  } catch (error) {
    debugLog('loadTasksFromSheet error', error);
    showStatus(collectStatus, `取得失敗: ${error.message}`, 'error');
    tweetPreview.classList.add('hidden');
  } finally {
    loadTasksBtn.disabled = false;
    loadTasksBtn.textContent = 'タスクを読み込む';
  }
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
    showStatus(tasksStatus, 'タスクがありません。収集タブでタスクを読み込んでください', 'info');
    taskList.innerHTML = '';
    sendAllBtn.disabled = true;
    return;
  }

  if (pending === 0) {
    showStatus(tasksStatus, '全て収集完了！', 'success');
  } else {
    showStatus(tasksStatus, `${pending}件のAnalyticsデータを収集してください`, 'info');
  }

  // 送信ボタンは常に有効（完了分を送信できる）
  sendAllBtn.disabled = completed === 0;

  // タスクリストを描画（未完了を先に表示）
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  taskList.innerHTML = sortedTasks.map((task, index) => `
    <div class="task-item ${task.status}">
      <div class="task-status ${task.status}"></div>
      <div class="task-info">
        <div class="task-text">${escapeHtml(task.text || '(本文なし)')}</div>
        <div class="task-meta">
          ${task.createdAt || '-'}
          ${task.status === 'completed' ? `| プロフ: ${formatNumber(task.data?.profileClicks)}` : '| 未収集'}
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
    task.data = {
      ...data,
      tweetText: task.text || data.tweetText,
      accountId: task.accountId || data.accountId
    };

    debugLog('autoSaveToTask', { postId: data.postId, profileClicks: data.profileClicks });

    saveTasks();
    showStatus(currentStatus, 'タスクに自動保存しました', 'success');

    // 即座にシートに送信
    sendSingleToSheet(task);
  } else {
    showStatus(currentStatus, 'タスクに該当するポストがありません（手動保存で送信可能）', 'info');
  }
}

// ========== 単一タスクをシートに送信 ==========
async function sendSingleToSheet(task) {
  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) return;

  try {
    const sendData = {
      ...task.data,
      tweetText: task.text || task.data?.tweetText,
      accountId: task.accountId || task.data?.accountId,
      postId: task.postId,
      createdAt: task.createdAt
    };

    debugLog('sendSingleToSheet', sendData);

    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendData),
      mode: 'no-cors'
    });

    showStatus(currentStatus, 'シートに送信しました', 'success');
  } catch (error) {
    debugLog('sendSingleToSheet error', error);
  }
}

function saveCurrentToTask() {
  if (!currentPageData) return;

  // 既存タスクを探す
  const taskIndex = tasks.findIndex(t => t.postId === currentPageData.postId);

  if (taskIndex >= 0) {
    const task = tasks[taskIndex];
    task.status = 'completed';
    task.data = {
      ...currentPageData,
      tweetText: task.text || currentPageData.tweetText,
      accountId: task.accountId || currentPageData.accountId
    };
    sendSingleToSheet(task);
  } else {
    // 新規タスクとして追加してシートに送信
    const newTask = {
      postId: currentPageData.postId,
      accountId: currentPageData.accountId,
      text: currentPageData.tweetText || '',
      createdAt: new Date().toLocaleDateString('ja-JP'),
      analyticsUrl: `https://x.com/i/account_analytics/content/${currentPageData.postId}`,
      statusUrl: currentPageData.url,
      status: 'completed',
      data: currentPageData
    };
    tasks.push(newTask);
    sendSingleToSheet(newTask);
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
      const sendData = {
        ...task.data,
        tweetText: task.text || task.data?.tweetText,
        accountId: task.accountId || task.data?.accountId,
        postId: task.postId,
        createdAt: task.createdAt
      };

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

// ========== 設定シートを開く ==========
async function openSettingsSheet() {
  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) {
    showStatus(collectStatus, 'GAS URLを設定してください', 'error');
    return;
  }

  try {
    const url = `${gasUrl}?action=getSettingsUrl`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.settingsUrl) {
      chrome.tabs.create({ url: data.settingsUrl });
    } else {
      showStatus(collectStatus, 'エラー: 設定シートURLを取得できません', 'error');
    }
  } catch (error) {
    showStatus(collectStatus, `エラー: ${error.message}`, 'error');
  }
}

// ========== イベントリスナー ==========
loadTasksBtn.addEventListener('click', loadTasksFromSheet);
refreshAccountsBtn.addEventListener('click', loadAccounts);
clearTasksBtn.addEventListener('click', clearTasks);
sendAllBtn.addEventListener('click', sendAllToSheet);
refreshDataBtn.addEventListener('click', collectCurrentPageData);
saveCurrentBtn.addEventListener('click', saveCurrentToTask);
saveSettingsBtn.addEventListener('click', saveSettings);
document.getElementById('openSettingsSheetBtn').addEventListener('click', openSettingsSheet);

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  collectCurrentPageData();
});
