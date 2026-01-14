// AI Research Paper Helper - API Utility Module
// Handles all communication with the backend API

const API_TIMEOUT = 30000; // 30 seconds

class APIClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    setBaseUrl(url) {
        this.baseUrl = url;
    }

    async request(endpoint, data = null, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: options.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: data ? JSON.stringify(data) : undefined,
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeout);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }

            throw error;
        }
    }

    // Health check
    async health() {
        return this.request('/health', null, { method: 'GET' });
    }

    // Summarization
    async summarize(data) {
        return this.request('/summarize', {
            title: data.title,
            content: data.content,
            abstract: data.abstract,
            page_type: data.pageType
        });
    }

    // Equation explanation
    async explainEquation(data) {
        return this.request('/explain-equations', {
            equation: data.equation,
            context: data.context,
            format: data.format
        });
    }

    // Key points extraction
    async extractKeypoints(data) {
        return this.request('/extract-key-points', {
            title: data.title,
            content: data.content,
            abstract: data.abstract
        });
    }

    // RAG - Index paper
    async indexPaper(data) {
        return this.request('/rag/index', {
            title: data.title,
            content: data.content,
            paper_id: data.paperId || data.url
        });
    }

    // RAG - Query
    async ragQuery(data) {
        return this.request('/rag/query', {
            query: data.query,
            paper_id: data.paperId,
            top_k: data.topK || 5
        });
    }
}

// Singleton instance
const apiClient = new APIClient();

// Export for use in other modules
if (typeof module !== 'undefined') {
    module.exports = { APIClient, apiClient };
}
