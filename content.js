// AI Research Paper Helper - Content Script
// Handles page detection, content extraction, and UI injection

(function () {
    'use strict';

    // Page type detection
    const PAGE_TYPES = {
        ARXIV: 'arxiv',
        MEDIUM: 'medium',
        BLOG: 'blog',
        ARTICLE: 'article',
        UNKNOWN: 'unknown'
    };

    // State
    let pageData = null;
    let sidebarInjected = false;
    let equationHighlightsActive = false;

    // Initialize on load
    init();

    function init() {
        const pageType = detectPageType();

        if (pageType === PAGE_TYPES.UNKNOWN) {
            console.log('AI Research Helper: Page type not supported');
            return;
        }

        console.log(`AI Research Helper: Detected ${pageType} page`);

        // Extract content based on page type
        pageData = extractContent(pageType);

        // Inject sidebar toggle button
        injectToggleButton();

        // Set up equation click handlers
        setupEquationHandlers();

        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener(handleMessage);

        // Notify background script
        chrome.runtime.sendMessage({
            type: 'PAGE_DETECTED',
            data: { pageType, url: window.location.href }
        });
    }

    function detectPageType() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        if (hostname.includes('arxiv.org')) {
            // If on PDF page, redirect to HTML view for full paper content
            if (pathname.includes('/pdf/')) {
                const arxivId = pathname.match(/\/pdf\/(\d+\.\d+)/)?.[1];
                if (arxivId) {
                    showNotification('Redirecting to HTML view for full paper...', 'info');
                    // Use ar5iv which renders arXiv papers as HTML
                    window.location.href = `https://ar5iv.labs.arxiv.org/html/${arxivId}`;
                    return PAGE_TYPES.UNKNOWN; // Will reinitialize after redirect
                }
            }
            if (pathname.includes('/abs/')) {
                return PAGE_TYPES.ARXIV;
            }
        }

        // ar5iv HTML view of arXiv papers
        if (hostname.includes('ar5iv.labs.arxiv.org') || hostname.includes('ar5iv.org')) {
            return PAGE_TYPES.ARXIV;
        }

        // Check for Medium - comprehensive detection
        // Detects: medium.com/@user, medium.com/publication, and custom domains
        const isMedium =
            hostname.includes('medium.com') ||
            hostname.includes('towardsdatascience.com') ||
            hostname.includes('levelup.gitconnected.com') ||
            hostname.includes('betterprogramming.pub') ||
            hostname.includes('javascript.plainenglish.io') ||
            hostname.includes('blog.devgenius.io') ||
            hostname.includes('ai.gopubby.com') ||
            hostname.includes('pub.towardsai.net') ||
            // This catches ALL Medium publications including medium.com/publication-name
            document.querySelector('meta[property="og:site_name"][content="Medium"]') !== null ||
            document.querySelector('meta[property="al:android:package"][content="com.medium.reader"]') !== null ||
            document.querySelector('script[src*="medium.com"]') !== null ||
            document.querySelector('link[href*="medium.com"]') !== null;

        if (isMedium) {
            return PAGE_TYPES.MEDIUM;
        }

        // Check for blog-like structure
        if (isBlogPage()) {
            return PAGE_TYPES.BLOG;
        }

        // Fallback: Check if page has any readable content
        if (isReadablePage()) {
            return PAGE_TYPES.ARTICLE;
        }

        return PAGE_TYPES.UNKNOWN;
    }

    function isReadablePage() {
        // Check if page has enough text content to be worth analyzing
        const bodyText = document.body?.innerText || '';
        const textLength = bodyText.length;

        // Minimum 1000 characters of text content
        if (textLength < 1000) return false;

        // Check for common content indicators
        const hasMainContent = document.querySelector('main, article, [role="main"], .content, .post, .entry, #content') !== null;
        const hasParagraphs = document.querySelectorAll('p').length >= 3;
        const hasHeadings = document.querySelectorAll('h1, h2, h3').length >= 1;

        // If it has structured content, it's readable
        if (hasMainContent && hasParagraphs) return true;
        if (hasParagraphs && hasHeadings) return true;

        // Even without structure, if there's a lot of text, consider it readable
        return textLength > 3000;
    }

    function isBlogPage() {
        // Heuristics for blog detection
        const hasArticle = document.querySelector('article') !== null;
        const hasLongContent = document.body.innerText.length > 3000;
        const hasHeadings = document.querySelectorAll('h1, h2, h3').length >= 2;

        // Also check for common blog indicators
        const hasBlogMeta = document.querySelector('meta[property="og:type"][content*="article"]') !== null;
        const hasPost = document.querySelector('.post, .post-content, .entry-content, .article-content') !== null;

        return (hasArticle && hasLongContent && hasHeadings) || (hasBlogMeta && hasLongContent) || hasPost;
    }

    function extractContent(pageType) {
        const extractors = {
            [PAGE_TYPES.ARXIV]: extractArxivContent,
            [PAGE_TYPES.MEDIUM]: extractMediumContent,
            [PAGE_TYPES.BLOG]: extractBlogContent,
            [PAGE_TYPES.ARTICLE]: extractArticleContent
        };

        const extractor = extractors[pageType];
        const content = extractor ? extractor() : null;

        if (content) {
            content.pageType = pageType;
            content.url = window.location.href;
            content.extractedAt = new Date().toISOString();
        }

        return content;
    }

    function extractArxivContent() {
        const title = document.querySelector('.title.mathjax')?.textContent?.replace('Title:', '').trim() ||
            document.querySelector('h1.title')?.textContent?.trim() || '';

        const abstract = document.querySelector('.abstract.mathjax')?.textContent?.replace('Abstract:', '').trim() ||
            document.querySelector('blockquote.abstract')?.textContent?.trim() || '';

        const authors = Array.from(document.querySelectorAll('.authors a'))
            .map(a => a.textContent.trim());

        // Extract sections from the page
        const sections = extractSections();

        // Extract equations (LaTeX)
        const equations = extractEquations();

        // Get full content
        const contentElement = document.querySelector('#content-inner') ||
            document.querySelector('.leftcolumn') ||
            document.querySelector('article');
        const content = contentElement?.innerText || '';

        return {
            title,
            abstract,
            authors,
            sections,
            equations,
            content,
            metadata: {
                arxivId: extractArxivId(),
                categories: extractCategories()
            }
        };
    }

    function extractArxivId() {
        const match = window.location.pathname.match(/\/(?:abs|pdf)\/(\d+\.\d+)/);
        return match ? match[1] : null;
    }

    function extractCategories() {
        const categoryElement = document.querySelector('.primary-subject');
        if (categoryElement) {
            return [categoryElement.textContent.trim()];
        }
        return [];
    }

    function extractMediumContent() {
        const title = document.querySelector('h1')?.textContent?.trim() || '';

        const article = document.querySelector('article');
        const paragraphs = article ?
            Array.from(article.querySelectorAll('p')).map(p => p.textContent.trim()).join('\n\n') : '';

        // Medium often has a subtitle
        const subtitle = document.querySelector('h2')?.textContent?.trim() || '';

        const author = document.querySelector('a[rel="author"]')?.textContent?.trim() || '';

        const sections = extractSections();
        const equations = extractEquations();

        return {
            title,
            abstract: subtitle,
            authors: author ? [author] : [],
            sections,
            equations,
            content: paragraphs,
            metadata: {
                platform: 'medium'
            }
        };
    }

    function extractBlogContent() {
        const title = document.querySelector('h1')?.textContent?.trim() ||
            document.querySelector('title')?.textContent?.trim() || '';

        const article = document.querySelector('article') ||
            document.querySelector('main') ||
            document.querySelector('.post-content') ||
            document.querySelector('.entry-content');

        const content = article?.innerText || document.body.innerText;

        // Try to find an abstract/intro
        const firstParagraphs = Array.from(document.querySelectorAll('article p, main p'))
            .slice(0, 3)
            .map(p => p.textContent.trim())
            .join(' ');

        const sections = extractSections();
        const equations = extractEquations();

        return {
            title,
            abstract: firstParagraphs.substring(0, 500),
            authors: [],
            sections,
            equations,
            content,
            metadata: {
                platform: 'blog'
            }
        };
    }

    function extractArticleContent() {
        // Universal article extractor for any webpage
        const title = extractBestTitle();
        const content = extractMainContent();
        const abstract = extractDescription();
        const author = extractAuthor();
        const sections = extractSections();
        const equations = extractEquations();

        return {
            title,
            abstract,
            authors: author ? [author] : [],
            sections,
            equations,
            content,
            metadata: {
                platform: 'article',
                domain: window.location.hostname,
                publishDate: extractPublishDate()
            }
        };
    }

    function extractBestTitle() {
        // Try multiple strategies to find the best title
        const h1 = document.querySelector('article h1, main h1, h1');
        if (h1) return h1.textContent.trim();

        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) return ogTitle.content;

        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) return twitterTitle.content;

        return document.title?.split(' | ')[0]?.split(' - ')[0]?.trim() || '';
    }

    function extractMainContent() {
        // Priority order for finding main content
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '#content',
            '.post',
            '.article'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText.length > 500) {
                return cleanContent(el.innerText);
            }
        }

        // Fallback: extract body content with noise removal
        return cleanContent(document.body.innerText);
    }

    function cleanContent(text) {
        // Remove common noise patterns
        return text
            .replace(/^\s*Share\s+(on\s+)?(Facebook|Twitter|LinkedIn|Email).*$/gmi, '')
            .replace(/^\s*(Subscribe|Sign up|Newsletter).*$/gmi, '')
            .replace(/^\s*Advertisement\s*$/gmi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function extractDescription() {
        // Try meta description first
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc?.content) return metaDesc.content;

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc?.content) return ogDesc.content;

        // Fallback to first paragraphs
        const paragraphs = document.querySelectorAll('article p, main p, .content p, p');
        const firstParas = Array.from(paragraphs)
            .slice(0, 3)
            .map(p => p.textContent.trim())
            .filter(t => t.length > 50)
            .join(' ');

        return firstParas.substring(0, 500);
    }

    function extractAuthor() {
        // Multiple strategies for finding author
        const selectors = [
            '[rel="author"]',
            '.author',
            '.byline',
            '[itemprop="author"]',
            '.author-name',
            '.post-author'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                return el.textContent.replace(/^by\s*/i, '').trim();
            }
        }

        // Try meta tags
        const metaAuthor = document.querySelector('meta[name="author"]');
        if (metaAuthor?.content) return metaAuthor.content;

        return '';
    }

    function extractPublishDate() {
        // Try multiple sources for publish date
        const timeEl = document.querySelector('time[datetime], [itemprop="datePublished"]');
        if (timeEl) {
            return timeEl.getAttribute('datetime') || timeEl.textContent.trim();
        }

        const metaDate = document.querySelector('meta[property="article:published_time"]');
        if (metaDate?.content) return metaDate.content;

        return null;
    }

    function extractSections() {
        const sections = [];
        const headings = document.querySelectorAll('h1, h2, h3, h4');

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const title = heading.textContent.trim();

            // Get content until next heading
            let content = '';
            let sibling = heading.nextElementSibling;

            while (sibling && !sibling.matches('h1, h2, h3, h4')) {
                content += sibling.textContent + '\n';
                sibling = sibling.nextElementSibling;
            }

            sections.push({
                level,
                title,
                content: content.trim(),
                index
            });
        });

        return sections;
    }

    function extractEquations() {
        const equations = [];

        // LaTeX equations (MathJax)
        const mathJaxElements = document.querySelectorAll('.MathJax, .MathJax_Display, script[type*="math/tex"]');
        mathJaxElements.forEach((el, index) => {
            let latex = '';

            if (el.tagName === 'SCRIPT') {
                latex = el.textContent;
            } else {
                // Try to get the original LaTeX from MathJax
                const script = el.querySelector('script[type*="math/tex"]');
                if (script) {
                    latex = script.textContent;
                } else {
                    // Fallback to alt text or title
                    latex = el.getAttribute('alt') || el.getAttribute('title') || el.textContent;
                }
            }

            if (latex) {
                equations.push({
                    id: `eq-${index}`,
                    latex: latex.trim(),
                    format: 'latex',
                    element: el,
                    context: getEquationContext(el)
                });
            }
        });

        // MathML equations
        const mathMLElements = document.querySelectorAll('math');
        mathMLElements.forEach((el, index) => {
            equations.push({
                id: `eq-mathml-${index}`,
                mathml: el.outerHTML,
                format: 'mathml',
                element: el,
                context: getEquationContext(el)
            });
        });

        return equations;
    }

    function getEquationContext(element) {
        // Get surrounding text for context
        const parent = element.closest('p, div, section');
        if (parent) {
            const text = parent.textContent;
            return text.substring(0, 500);
        }
        return '';
    }

    function injectToggleButton() {
        const button = document.createElement('button');
        button.id = 'ai-helper-toggle';
        button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    `;
        button.title = 'Toggle AI Research Helper';
        button.addEventListener('click', toggleSidebar);

        document.body.appendChild(button);
    }

    function toggleSidebar() {
        if (!sidebarInjected) {
            injectSidebar();
            sidebarInjected = true;
        }

        const sidebar = document.getElementById('ai-helper-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('visible');
        }
    }

    function injectSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'ai-helper-sidebar';
        sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>AI Research Helper</h2>
        <button class="close-btn" id="ai-helper-close">&times;</button>
      </div>
      <div class="sidebar-content">
        <div class="page-info">
          <span class="page-type-badge">${pageData?.pageType || 'unknown'}</span>
          <h3 class="paper-title">${pageData?.title || 'Untitled'}</h3>
        </div>
        
        <div class="action-buttons">
          <button id="analyze-btn" class="primary-btn">
            <span class="icon">🔍</span> Analyze Paper
          </button>
        </div>
        
        <div class="tabs">
          <button class="tab-btn active" data-tab="summary">Summary</button>
          <button class="tab-btn" data-tab="equations">Equations</button>
          <button class="tab-btn" data-tab="keypoints">Key Points</button>
          <button class="tab-btn" data-tab="qa">Ask Q&A</button>
        </div>
        
        <div class="tab-content">
          <div id="summary-tab" class="tab-panel active">
            <div class="summary-placeholder">
              Click "Analyze Paper" to generate summaries
            </div>
          </div>
          
          <div id="equations-tab" class="tab-panel">
            <div class="equations-list">
              ${pageData?.equations?.length ?
                `<p>Found ${pageData.equations.length} equations. Click on any equation in the page to get an explanation.</p>` :
                '<p>No equations detected on this page.</p>'
            }
            </div>
          </div>
          
          <div id="keypoints-tab" class="tab-panel">
            <div class="keypoints-placeholder">
              Click "Analyze Paper" to extract key points
            </div>
          </div>
          
          <div id="qa-tab" class="tab-panel">
            <div class="qa-container">
              <div class="qa-input-container">
                <textarea id="qa-input" placeholder="Ask a question about this paper..."></textarea>
                <button id="qa-submit" class="primary-btn">Ask</button>
              </div>
              <div id="qa-response" class="qa-response"></div>
            </div>
          </div>
        </div>
        
        <div id="loading-overlay" class="loading-overlay hidden">
          <div class="spinner"></div>
          <p class="loading-text">Analyzing...</p>
        </div>
      </div>
    `;

        document.body.appendChild(sidebar);

        // Set up event listeners
        setupSidebarEvents();
    }

    function setupSidebarEvents() {
        // Close button
        document.getElementById('ai-helper-close')?.addEventListener('click', toggleSidebar);

        // Analyze button
        document.getElementById('analyze-btn')?.addEventListener('click', analyzePaper);

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Q&A submit
        document.getElementById('qa-submit')?.addEventListener('click', submitQuestion);
        document.getElementById('qa-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuestion();
            }
        });
    }

    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-tab`);
        });
    }

    async function analyzePaper() {
        if (!pageData) {
            showError('No content to analyze');
            return;
        }

        showLoading('Analyzing paper...');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_PAGE',
                data: pageData
            });

            if (response.success) {
                displayResults(response.data);
            } else {
                showError(response.error || 'Analysis failed');
            }
        } catch (error) {
            showError('Failed to communicate with backend. Is the server running?');
        } finally {
            hideLoading();
        }
    }

    function displayResults(data) {
        // Display summaries
        if (data.summary) {
            const summaryTab = document.getElementById('summary-tab');
            summaryTab.innerHTML = `
        <div class="summary-section">
          <h4>TL;DR</h4>
          <ul class="tldr-list">
            ${data.summary.tldr?.map(point => `<li>${point}</li>`).join('') || '<li>No summary available</li>'}
          </ul>
        </div>
        
        <div class="summary-section">
          <h4>Technical Summary</h4>
          <p>${data.summary.technical || 'No technical summary available'}</p>
        </div>
        
        <div class="summary-section">
          <h4>Beginner-Friendly Explanation</h4>
          <p>${data.summary.beginner || 'No beginner explanation available'}</p>
        </div>
      `;
        }

        // Display key points
        if (data.keypoints) {
            const keypointsTab = document.getElementById('keypoints-tab');
            keypointsTab.innerHTML = `
        <div class="keypoints-section">
          <h4>Novel Contributions</h4>
          <ul>${data.keypoints.contributions?.map(c => `<li>${c}</li>`).join('') || '<li>None identified</li>'}</ul>
        </div>
        
        <div class="keypoints-section">
          <h4>Datasets Used</h4>
          <div class="chips">${data.keypoints.datasets?.map(d => `<span class="chip">${d}</span>`).join('') || '<span class="chip">None mentioned</span>'}</div>
        </div>
        
        <div class="keypoints-section">
          <h4>Evaluation Metrics</h4>
          <div class="chips">${data.keypoints.metrics?.map(m => `<span class="chip">${m}</span>`).join('') || '<span class="chip">None mentioned</span>'}</div>
        </div>
        
        <div class="keypoints-section">
          <h4>Key Concepts</h4>
          <div class="chips">${data.keypoints.concepts?.map(c => `<span class="chip tooltip" data-tooltip="${c.description || ''}">${c.name || c}</span>`).join('') || '<span class="chip">None identified</span>'}</div>
        </div>
      `;
        }

        // Show success message
        showNotification('Analysis complete!');
    }

    async function submitQuestion() {
        const input = document.getElementById('qa-input');
        const responseDiv = document.getElementById('qa-response');
        const query = input.value.trim();

        if (!query) return;

        showLoading('Searching paper...');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'RAG_QUERY',
                data: { query, topK: 5 }
            });

            if (response.success) {
                responseDiv.innerHTML = `
          <div class="qa-answer">
            <h5>Answer:</h5>
            <p>${response.data.answer}</p>
          </div>
          ${response.data.sources?.length ? `
            <div class="qa-sources">
              <h5>Sources:</h5>
              <ul>
                ${response.data.sources.map(s => `<li class="source-item">${s.text}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        `;
            } else {
                responseDiv.innerHTML = `<div class="error">${response.error}</div>`;
            }
        } catch (error) {
            responseDiv.innerHTML = `<div class="error">Failed to get answer</div>`;
        } finally {
            hideLoading();
        }
    }

    function setupEquationHandlers() {
        if (!pageData?.equations) return;

        pageData.equations.forEach(eq => {
            if (eq.element) {
                eq.element.classList.add('ai-helper-equation');
                eq.element.addEventListener('click', () => showEquationExplanation(eq));
            }
        });
    }

    async function showEquationExplanation(equation) {
        showLoading('Explaining equation...');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'EXPLAIN_EQUATION',
                data: {
                    equation: equation.latex || equation.mathml,
                    context: equation.context,
                    format: equation.format
                }
            });

            if (response.success) {
                showEquationPopup(equation.element, response.data);
            } else {
                showError(response.error);
            }
        } catch (error) {
            showError('Failed to explain equation');
        } finally {
            hideLoading();
        }
    }

    function showEquationPopup(element, explanation) {
        // Remove existing popups
        document.querySelectorAll('.equation-popup').forEach(p => p.remove());

        const popup = document.createElement('div');
        popup.className = 'equation-popup';
        popup.innerHTML = `
      <div class="equation-popup-header">
        <h4>Equation Explanation</h4>
        <button class="close-btn">&times;</button>
      </div>
      <div class="equation-popup-body">
        <div class="equation-readable">
          <strong>Readable form:</strong> ${explanation.readable || 'N/A'}
        </div>
        <div class="equation-meaning">
          <strong>What it represents:</strong> ${explanation.meaning || 'N/A'}
        </div>
        <div class="equation-variables">
          <strong>Variables:</strong>
          <ul>
            ${explanation.variables?.map(v => `<li><code>${v.symbol}</code>: ${v.description}</li>`).join('') || '<li>No variables identified</li>'}
          </ul>
        </div>
        <div class="equation-importance">
          <strong>Why it matters:</strong> ${explanation.importance || 'N/A'}
        </div>
      </div>
    `;

        // Position near the element
        const rect = element.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
        popup.style.left = `${rect.left + window.scrollX}px`;

        document.body.appendChild(popup);

        // Close button handler
        popup.querySelector('.close-btn').addEventListener('click', () => popup.remove());

        // Close on outside click
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target) && !element.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }

    function handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'GET_PAGE_DATA':
                sendResponse({ success: true, data: pageData });
                break;

            case 'TOGGLE_SIDEBAR':
                toggleSidebar();
                sendResponse({ success: true });
                break;

            case 'HIGHLIGHT_CONTRIBUTIONS':
                highlightContributions(message.data);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
        return true;
    }

    function highlightContributions(contributions) {
        // Create highlight overlay for key contributions
        contributions.forEach(contribution => {
            // Find matching text in the document
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(contribution.text)) {
                    const span = document.createElement('span');
                    span.className = 'ai-helper-highlight';
                    span.title = contribution.type;

                    const range = document.createRange();
                    const startIndex = node.textContent.indexOf(contribution.text);
                    range.setStart(node, startIndex);
                    range.setEnd(node, startIndex + contribution.text.length);
                    range.surroundContents(span);
                    break;
                }
            }
        });
    }

    // Utility functions
    function showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('.loading-text').textContent = text;
            overlay.classList.remove('hidden');
        }
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `ai-helper-notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

})();
