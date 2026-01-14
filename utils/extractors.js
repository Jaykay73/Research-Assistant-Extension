// AI Research Paper Helper - Content Extractors
// Site-specific extraction strategies for arXiv, Medium, and blogs

const Extractors = {
    /**
     * Extract content from arXiv paper pages
     */
    arxiv: {
        detect(url, doc) {
            return url.includes('arxiv.org') &&
                (url.includes('/abs/') || url.includes('/pdf/'));
        },

        extract(doc) {
            // Title
            const title = this.extractTitle(doc);

            // Abstract
            const abstract = this.extractAbstract(doc);

            // Authors
            const authors = this.extractAuthors(doc);

            // ArXiv ID
            const arxivId = this.extractArxivId(window.location.pathname);

            // Categories
            const categories = this.extractCategories(doc);

            // Full content (for HTML pages)
            const content = this.extractFullContent(doc);

            // Sections
            const sections = this.extractSections(doc);

            return {
                title,
                abstract,
                authors,
                content,
                sections,
                metadata: {
                    arxivId,
                    categories,
                    source: 'arxiv'
                }
            };
        },

        extractTitle(doc) {
            const titleEl = doc.querySelector('.title.mathjax') ||
                doc.querySelector('h1.title');
            if (titleEl) {
                return titleEl.textContent.replace(/^Title:\s*/i, '').trim();
            }
            return doc.title || '';
        },

        extractAbstract(doc) {
            const abstractEl = doc.querySelector('.abstract.mathjax') ||
                doc.querySelector('blockquote.abstract');
            if (abstractEl) {
                return abstractEl.textContent.replace(/^Abstract:\s*/i, '').trim();
            }
            return '';
        },

        extractAuthors(doc) {
            const authorEls = doc.querySelectorAll('.authors a');
            return Array.from(authorEls).map(a => a.textContent.trim());
        },

        extractArxivId(pathname) {
            const match = pathname.match(/\/(?:abs|pdf)\/(\d+\.\d+)/);
            return match ? match[1] : null;
        },

        extractCategories(doc) {
            const categoryEl = doc.querySelector('.primary-subject');
            if (categoryEl) {
                return [categoryEl.textContent.trim()];
            }
            return [];
        },

        extractFullContent(doc) {
            const contentEl = doc.querySelector('#content-inner') ||
                doc.querySelector('.leftcolumn') ||
                doc.querySelector('article');
            return contentEl ? contentEl.innerText : '';
        },

        extractSections(doc) {
            const sections = [];
            const container = doc.querySelector('#content-inner') ||
                doc.querySelector('.leftcolumn');

            if (!container) return sections;

            const headings = container.querySelectorAll('h2, h3, h4');
            headings.forEach((heading, index) => {
                const level = parseInt(heading.tagName.charAt(1));
                const title = heading.textContent.trim();

                // Get content until next heading
                let content = '';
                let sibling = heading.nextElementSibling;
                while (sibling && !sibling.matches('h2, h3, h4')) {
                    content += sibling.textContent + '\n';
                    sibling = sibling.nextElementSibling;
                }

                sections.push({ level, title, content: content.trim(), index });
            });

            return sections;
        }
    },

    /**
     * Extract content from Medium articles
     */
    medium: {
        detect(url, doc) {
            return url.includes('medium.com') ||
                doc.querySelector('script[src*="medium.com"]') !== null;
        },

        extract(doc) {
            const title = this.extractTitle(doc);
            const subtitle = this.extractSubtitle(doc);
            const author = this.extractAuthor(doc);
            const content = this.extractContent(doc);
            const sections = this.extractSections(doc);
            const readingTime = this.extractReadingTime(doc);

            return {
                title,
                abstract: subtitle,
                authors: author ? [author] : [],
                content,
                sections,
                metadata: {
                    readingTime,
                    source: 'medium'
                }
            };
        },

        extractTitle(doc) {
            const h1 = doc.querySelector('article h1') || doc.querySelector('h1');
            return h1 ? h1.textContent.trim() : doc.title;
        },

        extractSubtitle(doc) {
            const subtitle = doc.querySelector('article h2');
            return subtitle ? subtitle.textContent.trim() : '';
        },

        extractAuthor(doc) {
            const authorEl = doc.querySelector('a[rel="author"]') ||
                doc.querySelector('[data-testid="authorName"]');
            return authorEl ? authorEl.textContent.trim() : '';
        },

        extractContent(doc) {
            const article = doc.querySelector('article');
            if (!article) return '';

            const paragraphs = article.querySelectorAll('p');
            return Array.from(paragraphs)
                .map(p => p.textContent.trim())
                .filter(text => text.length > 0)
                .join('\n\n');
        },

        extractSections(doc) {
            const sections = [];
            const article = doc.querySelector('article');
            if (!article) return sections;

            const headings = article.querySelectorAll('h1, h2, h3');
            headings.forEach((heading, index) => {
                if (index === 0) return; // Skip title

                const level = parseInt(heading.tagName.charAt(1));
                const title = heading.textContent.trim();

                let content = '';
                let sibling = heading.nextElementSibling;
                while (sibling && !sibling.matches('h1, h2, h3')) {
                    content += sibling.textContent + '\n';
                    sibling = sibling.nextElementSibling;
                }

                sections.push({ level, title, content: content.trim(), index });
            });

            return sections;
        },

        extractReadingTime(doc) {
            const timeEl = doc.querySelector('[aria-label*="min read"]') ||
                doc.querySelector('span:contains("min read")');
            if (timeEl) {
                const match = timeEl.textContent.match(/(\d+)\s*min/);
                return match ? parseInt(match[1]) : null;
            }
            return null;
        }
    },

    /**
     * Generic blog extractor
     */
    blog: {
        detect(url, doc) {
            // Heuristics for blog detection
            const hasArticle = doc.querySelector('article') !== null;
            const hasLongContent = doc.body.innerText.length > 3000;
            const hasHeadings = doc.querySelectorAll('h1, h2, h3').length >= 2;

            return hasArticle && hasLongContent && hasHeadings;
        },

        extract(doc) {
            const title = this.extractTitle(doc);
            const content = this.extractContent(doc);
            const abstract = this.extractAbstract(doc, content);
            const sections = this.extractSections(doc);
            const author = this.extractAuthor(doc);

            return {
                title,
                abstract,
                authors: author ? [author] : [],
                content,
                sections,
                metadata: {
                    source: 'blog',
                    domain: window.location.hostname
                }
            };
        },

        extractTitle(doc) {
            const h1 = doc.querySelector('article h1') ||
                doc.querySelector('h1') ||
                doc.querySelector('title');
            return h1 ? h1.textContent.trim() : '';
        },

        extractContent(doc) {
            const article = doc.querySelector('article') ||
                doc.querySelector('main') ||
                doc.querySelector('.post-content') ||
                doc.querySelector('.entry-content');
            return article ? article.innerText : doc.body.innerText;
        },

        extractAbstract(doc, content) {
            // Try meta description first
            const metaDesc = doc.querySelector('meta[name="description"]');
            if (metaDesc && metaDesc.content) {
                return metaDesc.content;
            }

            // Fall back to first few paragraphs
            const paragraphs = doc.querySelectorAll('article p, main p');
            const firstParas = Array.from(paragraphs)
                .slice(0, 3)
                .map(p => p.textContent.trim())
                .join(' ');

            return firstParas.substring(0, 500);
        },

        extractSections(doc) {
            const sections = [];
            const container = doc.querySelector('article') ||
                doc.querySelector('main');

            if (!container) return sections;

            const headings = container.querySelectorAll('h2, h3, h4');
            headings.forEach((heading, index) => {
                const level = parseInt(heading.tagName.charAt(1));
                const title = heading.textContent.trim();

                let content = '';
                let sibling = heading.nextElementSibling;
                while (sibling && !sibling.matches('h2, h3, h4')) {
                    content += sibling.textContent + '\n';
                    sibling = sibling.nextElementSibling;
                }

                sections.push({ level, title, content: content.trim(), index });
            });

            return sections;
        },

        extractAuthor(doc) {
            const authorEl = doc.querySelector('[rel="author"]') ||
                doc.querySelector('.author') ||
                doc.querySelector('.byline');
            return authorEl ? authorEl.textContent.replace(/^by\s*/i, '').trim() : '';
        }
    },

    /**
     * Detect page type and extract content
     */
    detectAndExtract(url, doc) {
        const extractorOrder = ['arxiv', 'medium', 'blog', 'universal'];

        for (const name of extractorOrder) {
            const extractor = this[name];
            if (extractor.detect(url, doc)) {
                return {
                    pageType: name,
                    ...extractor.extract(doc)
                };
            }
        }

        return {
            pageType: 'unknown',
            title: doc.title,
            content: doc.body.innerText,
            abstract: '',
            authors: [],
            sections: [],
            metadata: {}
        };
    },

    /**
     * Universal extractor for any webpage
     */
    universal: {
        detect(url, doc) {
            const bodyText = doc.body?.innerText || '';
            if (bodyText.length < 1000) return false;
            const hasParagraphs = doc.querySelectorAll('p').length >= 3;
            const hasContent = doc.querySelector('main, article, .content, #content') !== null;
            return hasParagraphs || hasContent || bodyText.length > 3000;
        },

        extract(doc) {
            const title = this.extractTitle(doc);
            const content = this.extractContent(doc);
            const abstract = this.extractAbstract(doc);
            const author = this.extractAuthor(doc);

            return {
                title,
                abstract,
                authors: author ? [author] : [],
                content,
                sections: [],
                metadata: { source: 'universal', domain: window.location.hostname }
            };
        },

        extractTitle(doc) {
            const h1 = doc.querySelector('article h1, main h1, h1');
            if (h1) return h1.textContent.trim();
            const ogTitle = doc.querySelector('meta[property="og:title"]');
            if (ogTitle?.content) return ogTitle.content;
            return doc.title?.split(' | ')[0]?.split(' - ')[0]?.trim() || '';
        },

        extractContent(doc) {
            const selectors = ['article', 'main', '[role="main"]', '.post-content', '.content', '#content'];
            for (const selector of selectors) {
                const el = doc.querySelector(selector);
                if (el && el.innerText.length > 500) return el.innerText.trim();
            }
            return doc.body.innerText;
        },

        extractAbstract(doc) {
            const metaDesc = doc.querySelector('meta[name="description"]');
            if (metaDesc?.content) return metaDesc.content;
            const ogDesc = doc.querySelector('meta[property="og:description"]');
            if (ogDesc?.content) return ogDesc.content;
            return '';
        },

        extractAuthor(doc) {
            const authorEl = doc.querySelector('[rel="author"], .author, .byline');
            if (authorEl) return authorEl.textContent.replace(/^by\s*/i, '').trim();
            const metaAuthor = doc.querySelector('meta[name="author"]');
            return metaAuthor?.content || '';
        }
    }
};

// Export for use in content script
if (typeof module !== 'undefined') {
    module.exports = { Extractors };
}
