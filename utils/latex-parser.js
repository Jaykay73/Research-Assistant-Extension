// AI Research Paper Helper - LaTeX Parser
// Handles LaTeX and MathML parsing and normalization

const LaTeXParser = {
    /**
     * Common LaTeX symbols and their readable equivalents
     */
    symbolMap: {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
        '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
        '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
        '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
        '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
        '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
        '\\Psi': 'Ψ', '\\Omega': 'Ω',
        '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
        '\\sum': 'Σ', '\\prod': 'Π', '\\int': '∫',
        '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
        '\\pm': '±', '\\times': '×', '\\div': '÷', '\\cdot': '·',
        '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
        '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
        '\\forall': '∀', '\\exists': '∃', '\\neg': '¬',
        '\\wedge': '∧', '\\vee': '∨', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
        '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
        '\\ldots': '...', '\\cdots': '⋯', '\\vdots': '⋮',
        '\\sqrt': '√', '\\exp': 'exp', '\\log': 'log', '\\ln': 'ln',
        '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
        '\\lim': 'lim', '\\max': 'max', '\\min': 'min', '\\arg': 'arg'
    },

    /**
     * Parse LaTeX string to extract components
     */
    parse(latex) {
        const cleaned = this.clean(latex);

        return {
            original: latex,
            cleaned: cleaned,
            readable: this.toReadable(cleaned),
            variables: this.extractVariables(cleaned),
            operators: this.extractOperators(cleaned),
            functions: this.extractFunctions(cleaned),
            structure: this.analyzeStructure(cleaned)
        };
    },

    /**
     * Clean LaTeX string
     */
    clean(latex) {
        return latex
            .trim()
            .replace(/\\\[|\\\]/g, '') // Remove display math delimiters
            .replace(/\$\$?/g, '')     // Remove inline math delimiters
            .replace(/\\begin\{[^}]+\}/g, '') // Remove begin environments
            .replace(/\\end\{[^}]+\}/g, '')   // Remove end environments
            .replace(/&/g, ' ')        // Replace alignment characters
            .replace(/\\\\/g, ' ')     // Replace line breaks
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();
    },

    /**
     * Convert LaTeX to readable form
     */
    toReadable(latex) {
        let result = latex;

        // Replace symbols
        for (const [texCmd, symbol] of Object.entries(this.symbolMap)) {
            result = result.replace(new RegExp(texCmd.replace(/\\/g, '\\\\'), 'g'), symbol);
        }

        // Handle fractions
        result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

        // Handle superscripts and subscripts
        result = result.replace(/\^{([^}]+)}/g, '^($1)');
        result = result.replace(/_{([^}]+)}/g, '_($1)');
        result = result.replace(/\^(\w)/g, '^$1');
        result = result.replace(/_(\w)/g, '_$1');

        // Handle sqrt
        result = result.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
        result = result.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '$1√($2)');

        // Handle text
        result = result.replace(/\\text\{([^}]+)\}/g, '$1');
        result = result.replace(/\\mathrm\{([^}]+)\}/g, '$1');
        result = result.replace(/\\mathbf\{([^}]+)\}/g, '$1');

        // Clean up remaining backslashes
        result = result.replace(/\\[a-zA-Z]+/g, '');
        result = result.replace(/[{}]/g, '');

        return result.trim();
    },

    /**
     * Extract variable names from LaTeX
     */
    extractVariables(latex) {
        const variables = new Set();

        // Common variable patterns
        const patterns = [
            /\\mathbf\{(\w+)\}/g,
            /\\boldsymbol\{(\w+)\}/g,
            /\\vec\{(\w+)\}/g,
            /\\hat\{(\w+)\}/g,
            /([a-zA-Z])_\{?(\w+)?\}?/g
        ];

        // Greek letters
        for (const [cmd, symbol] of Object.entries(this.symbolMap)) {
            if (latex.includes(cmd)) {
                variables.add({ symbol, latex: cmd, type: 'greek' });
            }
        }

        // Latin letters (common in ML)
        const latinMatches = latex.match(/(?<![\\a-zA-Z])([a-zA-Z])(?![a-zA-Z])/g);
        if (latinMatches) {
            latinMatches.forEach(v => {
                if (!['d', 'e', 'i'].includes(v)) { // Skip common constants
                    variables.add({ symbol: v, latex: v, type: 'latin' });
                }
            });
        }

        return Array.from(variables);
    },

    /**
     * Extract operators from LaTeX
     */
    extractOperators(latex) {
        const operators = [];

        const opPatterns = {
            sum: /\\sum/g,
            product: /\\prod/g,
            integral: /\\int/g,
            limit: /\\lim/g,
            expectation: /\\mathbb\{E\}|\\E\b/g,
            probability: /\\mathbb\{P\}|\\Pr?\b/g,
            gradient: /\\nabla/g,
            argmax: /\\arg\s*\\max/g,
            argmin: /\\arg\s*\\min/g
        };

        for (const [name, pattern] of Object.entries(opPatterns)) {
            if (pattern.test(latex)) {
                operators.push(name);
            }
        }

        return operators;
    },

    /**
     * Extract function names from LaTeX
     */
    extractFunctions(latex) {
        const functions = [];

        const funcPatterns = {
            exponential: /\\exp|e\^/g,
            logarithm: /\\log|\\ln/g,
            softmax: /softmax/gi,
            sigmoid: /sigmoid|\\sigma/gi,
            relu: /relu/gi,
            tanh: /\\tanh|tanh/gi,
            loss: /\\mathcal\{L\}|loss/gi,
            norm: /\\|\s*\|.*?\|\s*\\||\|.*?\|/g
        };

        for (const [name, pattern] of Object.entries(funcPatterns)) {
            if (pattern.test(latex)) {
                functions.push(name);
            }
        }

        return functions;
    },

    /**
     * Analyze equation structure
     */
    analyzeStructure(latex) {
        const structure = {
            isEquation: latex.includes('='),
            isInequality: /[<>≤≥]/.test(latex),
            isDefinition: latex.includes(':=') || latex.includes('\\triangleq'),
            hasSummation: /\\sum/.test(latex),
            hasIntegral: /\\int/.test(latex),
            hasFraction: /\\frac/.test(latex),
            hasMatrix: /\\begin\{[pbvBV]?matrix\}/.test(latex),
            complexity: this.estimateComplexity(latex)
        };

        // Determine equation type
        if (structure.hasSummation && (latex.includes('loss') || latex.includes('\\mathcal{L}'))) {
            structure.type = 'loss_function';
        } else if (latex.includes('\\nabla') || latex.includes('\\partial')) {
            structure.type = 'gradient';
        } else if (latex.includes('\\mathbb{E}') || latex.includes('\\Pr')) {
            structure.type = 'probability';
        } else if (structure.hasMatrix) {
            structure.type = 'matrix_operation';
        } else if (structure.hasSummation) {
            structure.type = 'summation';
        } else {
            structure.type = 'general';
        }

        return structure;
    },

    /**
     * Estimate equation complexity (1-10)
     */
    estimateComplexity(latex) {
        let score = 1;

        // Length factor
        score += Math.min(3, Math.floor(latex.length / 50));

        // Nesting factor
        const depth = this.countNesting(latex);
        score += Math.min(2, depth);

        // Operator factor
        const opCount = (latex.match(/\\(sum|prod|int|lim|frac)/g) || []).length;
        score += Math.min(2, opCount);

        // Matrix factor
        if (/\\begin\{[pbvBV]?matrix\}/.test(latex)) score += 2;

        return Math.min(10, score);
    },

    /**
     * Count brace nesting depth
     */
    countNesting(latex) {
        let maxDepth = 0;
        let currentDepth = 0;

        for (const char of latex) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth--;
            }
        }

        return maxDepth;
    },

    /**
     * Parse MathML to extract content
     */
    parseMathML(mathml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(mathml, 'text/xml');

        // Extract text content
        const text = doc.documentElement.textContent;

        return {
            original: mathml,
            text: text.trim(),
            readable: text.trim()
        };
    }
};

// Export for use in content script
if (typeof module !== 'undefined') {
    module.exports = { LaTeXParser };
}
