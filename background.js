// AI Research Paper Helper - Background Service Worker
// Handles extension lifecycle, message passing, and API coordination

const API_BASE_URL = 'http://localhost:8000';

// Extension state management
const state = {
  currentPaper: null,
  isIndexed: false,
  settings: {
    apiMode: 'hybrid', // 'local', 'api', 'hybrid'
    summaryLevel: 'all',
    autoAnalyze: false
  }
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('AI Research Paper Helper installed');

  // Load saved settings
  const saved = await chrome.storage.local.get('settings');
  if (saved.settings) {
    Object.assign(state.settings, saved.settings);
  }
});

// Message handler for content script and popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'ANALYZE_PAGE':
      return await analyzePage(message.data);

    case 'GET_SUMMARY':
      return await getSummary(message.data);

    case 'EXPLAIN_EQUATION':
      return await explainEquation(message.data);

    case 'EXTRACT_KEYPOINTS':
      return await extractKeypoints(message.data);

    case 'RAG_QUERY':
      return await ragQuery(message.data);

    case 'INDEX_PAPER':
      return await indexPaper(message.data);

    case 'GET_STATE':
      return { success: true, data: state };

    case 'UPDATE_SETTINGS':
      state.settings = { ...state.settings, ...message.data };
      await chrome.storage.local.set({ settings: state.settings });
      return { success: true };

    case 'CHECK_BACKEND':
      return await checkBackendHealth();

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// API communication functions
async function apiRequest(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Backend not available' };
  }
}

async function analyzePage(pageData) {
  try {
    state.currentPaper = pageData;

    // Index the paper for RAG
    const indexResult = await indexPaper(pageData);

    // Get all analyses in parallel
    const [summary, keypoints] = await Promise.all([
      getSummary(pageData),
      extractKeypoints(pageData)
    ]);

    return {
      success: true,
      data: {
        summary: summary.data,
        keypoints: keypoints.data,
        indexed: indexResult.success
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getSummary(data) {
  try {
    const result = await apiRequest('/summarize', {
      title: data.title,
      content: data.content,
      abstract: data.abstract,
      pageType: data.pageType
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function explainEquation(data) {
  try {
    const result = await apiRequest('/explain-equations', {
      equation: data.equation,
      context: data.context,
      format: data.format // 'latex' or 'mathml'
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function extractKeypoints(data) {
  try {
    const result = await apiRequest('/extract-key-points', {
      title: data.title,
      content: data.content,
      abstract: data.abstract
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function indexPaper(data) {
  try {
    const result = await apiRequest('/rag/index', {
      title: data.title,
      content: data.content,
      paper_id: data.url  // Fixed: was paperId
    });
    state.isIndexed = true;
    state.currentPaper = data;  // Store for later queries
    return { success: true, data: result };
  } catch (error) {
    state.isIndexed = false;
    return { success: false, error: error.message };
  }
}

async function ragQuery(data) {
  try {
    // Don't check state.isIndexed - let the backend tell us if it's indexed
    // This handles cases where extension reloaded but backend still has the index
    const paperId = data.paperId || state.currentPaper?.url;

    if (!paperId) {
      throw new Error('No paper URL available. Please analyze a page first.');
    }

    const result = await apiRequest('/rag/query', {
      query: data.query,
      paper_id: paperId,  // Fixed: was paperId
      top_k: data.topK || 5  // Fixed: was topK
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = { state, handleMessage };
}
