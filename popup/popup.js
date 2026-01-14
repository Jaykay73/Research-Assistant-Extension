// AI Research Paper Helper - Popup Script
// Handles popup UI logic and communication with background script

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check backend status
    await checkBackendStatus();

    // Get current tab info
    await detectCurrentPage();

    // Load recent papers
    await loadRecentPapers();

    // Set up event listeners
    setupEventListeners();

    // Load settings
    await loadSettings();
}

async function checkBackendStatus() {
    const indicator = document.getElementById('status-indicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');

    try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_BACKEND' });

        if (response.success) {
            dot.classList.add('online');
            dot.classList.remove('offline');
            text.textContent = 'Connected';
        } else {
            dot.classList.add('offline');
            dot.classList.remove('online');
            text.textContent = 'Offline';
        }
    } catch (error) {
        dot.classList.add('offline');
        text.textContent = 'Error';
    }
}

async function detectCurrentPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    const detectionCard = document.getElementById('detection-card');
    const detectionIcon = document.getElementById('detection-icon');
    const pageType = document.getElementById('page-type');
    const pageTitle = document.getElementById('page-title');

    try {
        // Try to get page data from content script
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });

        if (response?.success && response.data) {
            const data = response.data;

            detectionCard.classList.add('supported');
            detectionIcon.textContent = getPageIcon(data.pageType);
            pageType.textContent = formatPageType(data.pageType);
            pageTitle.textContent = data.title || 'Untitled';

            // Enable action buttons
            enableActionButtons(true);
        } else {
            showUnsupportedPage();
        }
    } catch (error) {
        // Content script not loaded
        showUnsupportedPage();
    }
}

function getPageIcon(pageType) {
    const icons = {
        arxiv: '📚',
        medium: '📝',
        blog: '📰',
        unknown: '📄'
    };
    return icons[pageType] || icons.unknown;
}

function formatPageType(pageType) {
    const types = {
        arxiv: 'arXiv Paper Detected',
        medium: 'Medium Article Detected',
        blog: 'Blog Post Detected',
        unknown: 'Unknown Page'
    };
    return types[pageType] || types.unknown;
}

function showUnsupportedPage() {
    const detectionIcon = document.getElementById('detection-icon');
    const pageType = document.getElementById('page-type');
    const pageTitle = document.getElementById('page-title');

    detectionIcon.textContent = '🔍';
    pageType.textContent = 'No Research Content Detected';
    pageTitle.textContent = 'Navigate to arXiv, Medium, or a research blog';

    enableActionButtons(false);
}

function enableActionButtons(enabled) {
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
        btn.disabled = !enabled;
    });

    document.getElementById('ask-btn').disabled = !enabled;
    document.getElementById('quick-question').disabled = !enabled;
}

function setupEventListeners() {
    // Action buttons
    document.getElementById('btn-summarize').addEventListener('click', handleSummarize);
    document.getElementById('btn-equations').addEventListener('click', handleEquations);
    document.getElementById('btn-keypoints').addEventListener('click', handleKeypoints);
    document.getElementById('btn-sidebar').addEventListener('click', handleOpenSidebar);

    // Q&A
    document.getElementById('ask-btn').addEventListener('click', handleQuickQuestion);
    document.getElementById('quick-question').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleQuickQuestion();
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    document.getElementById('cancel-settings').addEventListener('click', closeSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
}

async function handleSummarize() {
    showLoading();

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });

        if (!pageData?.success) {
            throw new Error('Could not get page data');
        }

        const response = await chrome.runtime.sendMessage({
            type: 'GET_SUMMARY',
            data: pageData.data
        });

        if (response.success) {
            // Open sidebar to show results
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
            window.close();
        } else {
            showError(response.error);
        }
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

async function handleEquations() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
        // Switch to equations tab would be handled by content script
        window.close();
    } catch (error) {
        showError('Could not open equations view');
    }
}

async function handleKeypoints() {
    showLoading();

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });

        if (!pageData?.success) {
            throw new Error('Could not get page data');
        }

        const response = await chrome.runtime.sendMessage({
            type: 'EXTRACT_KEYPOINTS',
            data: pageData.data
        });

        if (response.success) {
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
            window.close();
        } else {
            showError(response.error);
        }
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

async function handleOpenSidebar() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
        window.close();
    } catch (error) {
        showError('Could not open sidebar');
    }
}

async function handleQuickQuestion() {
    const input = document.getElementById('quick-question');
    const responseDiv = document.getElementById('quick-response');
    const query = input.value.trim();

    if (!query) return;

    showLoading();

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'RAG_QUERY',
            data: { query, topK: 3 }
        });

        if (response.success) {
            responseDiv.innerHTML = `
        <p>${response.data.answer}</p>
        ${response.data.sources?.length ?
                    `<small style="color: var(--text-muted)">Based on ${response.data.sources.length} source(s)</small>` :
                    ''}
      `;
            responseDiv.classList.add('visible');
        } else {
            responseDiv.innerHTML = `<p style="color: var(--error)">${response.error}</p>`;
            responseDiv.classList.add('visible');
        }
    } catch (error) {
        responseDiv.innerHTML = `<p style="color: var(--error)">Failed to get answer</p>`;
        responseDiv.classList.add('visible');
    } finally {
        hideLoading();
    }
}

async function loadRecentPapers() {
    const recentList = document.getElementById('recent-list');

    try {
        const stored = await chrome.storage.local.get('recentPapers');
        const papers = stored.recentPapers || [];

        if (papers.length === 0) {
            recentList.innerHTML = '<p class="empty-state">No papers analyzed yet</p>';
            return;
        }

        recentList.innerHTML = papers.slice(0, 5).map(paper => `
      <div class="recent-item" data-url="${paper.url}">
        <div class="recent-item-icon">${getPageIcon(paper.pageType)}</div>
        <div class="recent-item-info">
          <div class="recent-item-title">${paper.title}</div>
          <div class="recent-item-meta">${formatDate(paper.analyzedAt)}</div>
        </div>
      </div>
    `).join('');

        // Add click handlers
        recentList.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => {
                chrome.tabs.create({ url: item.dataset.url });
            });
        });
    } catch (error) {
        console.error('Failed to load recent papers', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get('settings');
        const settings = stored.settings || {};

        document.getElementById('api-mode').value = settings.apiMode || 'hybrid';
        document.getElementById('backend-url').value = settings.backendUrl || 'http://localhost:8000';
        document.getElementById('auto-analyze').checked = settings.autoAnalyze || false;
    } catch (error) {
        console.error('Failed to load settings', error);
    }
}

function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

async function saveSettings() {
    const settings = {
        apiMode: document.getElementById('api-mode').value,
        backendUrl: document.getElementById('backend-url').value,
        autoAnalyze: document.getElementById('auto-analyze').checked
    };

    try {
        await chrome.storage.local.set({ settings });
        await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', data: settings });
        closeSettings();
    } catch (error) {
        showError('Failed to save settings');
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const responseDiv = document.getElementById('quick-response');
    responseDiv.innerHTML = `<p style="color: var(--error)">${message}</p>`;
    responseDiv.classList.add('visible');
}
