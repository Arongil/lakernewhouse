// latex.js: Handles LaTeX navigation, rendering, and cross-references

let labelMap = {};
let currentChapterFile = null;

// Logical chapter map
const chapters = {
    'chapter1': {
        title: 'Introduction',
        file: 'chapter1.tex'
    },
    'chapter2': {
        title: 'Duality in Deep Learning',
        file: 'chapter2.tex'
    },
    'chapter3': {
        title: 'Training Transformers with Enforced Lipschitz Constants',
        file: 'chapter3.tex'
    }
};

// LaTeX macro definitions
const latexMacros = {
    '\\block': '\\mathsf{Block}',
    '\\identity': '\\mathsf{Identity}',
    '\\layernorm': '\\mathsf{LayerNorm}',
    '\\relu': '\\mathsf{ReLU}',
    '\\gelu': '\\mathsf{GELU}',
    '\\linear': '\\mathsf{Linear}',
    '\\conv': '\\mathsf{Conv2D}',
    '\\el': '\\mathcal{L}',
    '\\embed': '\\mathsf{Embed}',
    '\\argmax': '\\operatorname{arg\\,max}',
    '\\argmin': '\\operatorname{arg\\,min}',
    '\\defeq': '\\vcentcolon=',
    '\\weights': '\\mathcal{W}',
    '\\inputs': '\\mathcal{X}',
    '\\outputs': '\\mathcal{Y}',
    '\\softmax': '\\operatorname{softmax}',
    '\\dualize': '\\operatorname{dualize}',
    '\\bregman': '\\operatorname{bregman}',
    '\\kl': 'D_\\mathrm{KL}',
    '\\vect': '\\operatorname{vec}',
    '\\rms': '{\\operatorname{RMS}}',
    '\\abs': '\\vert #1 \\vert',
    '\\norm': '\\left\\lVert #1 \\right\\rVert',
    '\\out': '\\mathrm{out}',
    '\\inn': '\\mathrm{in}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\R': '\\mathbb{R}',
    '\\sign': '\\operatorname{sign}',
    '\\flatten': '\\operatorname{flatten}',
    '\\trace': '\\operatorname{tr}',
};

// Track figure numbering per chapter
let figureCounters = { 'chapter1.tex': 0, 'chapter2.tex': 0, 'chapter3.tex': 0 };
function getChapterNumber(file) {
    if (file === 'chapter1.tex') return 1;
    if (file === 'chapter2.tex') return 2;
    if (file === 'chapter3.tex') return 3;
    return '?';
}

// Process LaTeX content to HTML
async function processLatexContent(content) {
    // Remove LaTeX comments (lines starting with %)
    content = content.replace(/^%.*$/gm, '');

    // Remove \chapter and \label and \vspace
    content = content.replace(/\\chapter\{.*?\}/g, '');
    content = content.replace(/\\label\{.*?\}/g, '');
    content = content.replace(/\\vspace\{.*?\}/g, '');

    // Replace \textbf and \textit
    content = content.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
    content = content.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');

    // Replace itemize environments with HTML lists
    content = content.replace(/\\begin{itemize}/g, '<ul>');
    content = content.replace(/\\end{itemize}/g, '</ul>');
    content = content.replace(/\\item/g, '<li>');

    // Theorem, definition, note boxes
    content = content.replace(/\\begin{theorembox}(?:\[(.*?)\])?\n(.*?)\\end{theorembox}/gs, 
        (match, title, boxContent) => `
            <div class="box theorem-box">
                <div class="title">Theorem${title ? ': ' + title : ''}</div>
                <div class="content">${boxContent}</div>
            </div>
        `
    );
    content = content.replace(/\\begin{definitionbox}(?:\[(.*?)\])?\n(.*?)\\end{definitionbox}/gs,
        (match, title, boxContent) => `
            <div class="box definition-box">
                <div class="title">Definition${title ? ': ' + title : ''}</div>
                <div class="content">${boxContent}</div>
            </div>
        `
    );
    content = content.replace(/\\begin{notebox}(?:\[(.*?)\])?\n(.*?)\\end{notebox}/gs,
        (match, title, boxContent) => `
            <div class="box note-box">
                <div class="title">Note${title ? ': ' + title : ''}</div>
                <div class="content">${boxContent}</div>
            </div>
        `
    );

    // Replace multiple newlines with paragraph breaks
    content = content.replace(/\n{2,}/g, '</p><p>');
    // Wrap in <p> if not already inside a block element
    content = '<p>' + content + '</p>';
    // Remove <p> before block elements and after
    content = content.replace(/<p>(\s*<(div|ul|\/ul|\/div)[^>]*>)/g, '$1');
    content = content.replace(/(<\/div>|<\/ul>)\s*<\/p>/g, '$1');

    // Replace LaTeX-style quotes ``x'' with curly quotes
    content = content.replace(/``([^`]*)''/g, '“$1”');

    // Replace triple dash --- with em dash
    content = content.replace(/---/g, '—');

    // Replace tfrac with frac
    content = content.replace(/tfrac/g, 'frac');

    // Replace \% with %
    content = content.replace(/\\%/g, '%');

    // Replace enumerate environments with HTML ordered lists
    content = content.replace(/\\begin\{enumerate\}/g, '<ol>');
    content = content.replace(/\\end\{enumerate\}/g, '</ol>');
    // handle enumerate counter
    content = content.replace(/\\setcounter\{enumi\}\{(\d+)\}/g, function(match, n) {
        return `</ol><ol start="${n}">`;
    });

    // \item already replaced above, but ensure it works for ol too
    // Replace gather, gather*, equation, equation* environments with centered math block
    content = content.replace(/\\begin\{(gather\*?|equation\*?)\}([\s\S]*?)\\end\{\1\}/g, function(match, env, eqn) {
        if (env.startsWith('equation')) {
            return `\\[${eqn.trim()}\\]`;
        } else {
            return `\\begin{${env}}${eqn.trim()}\\end{${env}}`;
        }
    });

    // Replace proof environments with styled proof block (white box)
    content = content.replace(/\\begin\{proof\}([\s\S]*?)\\end\{proof\}/g, function(match, proofContent) {
        return `<div class=\"proof\"><span class=\"proof-label\"><em>Proof.</em></span> ${proofContent.trim()} <span class=\"qed\">&#9633;</span></div>`;
    });
    // Replace align, align* environments with centered math block (no $$, use \begin{align[*]} ... \end{align[*]})
    content = content.replace(/\\begin\{(align|aligned|gather|gather*)\}([\s\S]*?)\\end\{\1\}/g, function(match, env, eqn) {
        return `<div class="math-display">\\begin{${env}}${eqn.trim()}\\end{${env}}</div>`;
    });

    // Replace figure environments with HTML5 <figure> and numbering
    content = content.replace(/\\begin\{figure\}([\s\S]*?)\\end\{figure\}/g, function(match, figContent) {
        // Extract \includegraphics and \caption
        let imgMatch = figContent.match(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/);
        let captionMatch = figContent.match(/\\caption\{([^}]*)\}/);
        let imgTag = '';
        if (imgMatch) {
            let filename = imgMatch[1].trim();
            imgTag = `<img src="${filename}" alt="${filename}" style="max-width:100%;height:auto;">`;
        }
        let captionTag = '';
        let chapterNum = getChapterNumber(currentChapterFile);
        if (!(currentChapterFile in figureCounters)) figureCounters[currentChapterFile] = 0;
        figureCounters[currentChapterFile] += 1;
        let figNum = figureCounters[currentChapterFile];
        if (captionMatch) {
            captionTag = `<figcaption>Figure ${chapterNum}.${figNum}: ${captionMatch[1].trim()}</figcaption>`;
        } else {
            captionTag = `<figcaption>Figure ${chapterNum}.${figNum}</figcaption>`;
        }
        return `<figure style="text-align: justified;">${imgTag}${captionTag}</figure>`;
    });

    return content;
}

function fetchLabelMap() {
    return fetch('latex_src/label_map.json')
        .then(response => response.json())
        .then(map => { 
            labelMap = map; 
        });
}

function renderEnhancements(callback) {
    if (window.renderMathInElement) {
        renderMathInElement(document.getElementById('content'), {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            macros: latexMacros,
            throwOnError: false
        });
    } else {
        console.warn('[latex.js] renderMathInElement is NOT available');
    }
    // Add more dynamic enhancements here if needed
    if (typeof callback === 'function') callback();
}

function scrollToAnchor(anchor) {
    const hash = anchor || window.location.hash.substring(1);
    if (hash) {
        setTimeout(function() {
            var target = document.getElementById(hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                target.classList.add('highlight');
                setTimeout(() => target.classList.remove('highlight'), 2000);
            } else {
                console.warn('[latex.js] Anchor target not found:', hash);
            }
        }, 10);
    }
}

async function loadChapter(chapterFile, anchor) {
    currentChapterFile = chapterFile;
    const response = await fetch(`latex_src/${chapterFile}`);
    const rawLatex = await response.text();
    const html = await processLatexContent(rawLatex);
    document.getElementById('content').innerHTML = html;
    setTimeout(() => {
        renderEnhancements(() => {
            if (anchor) {
                scrollToAnchor(anchor);
            } else {
                // Restore scroll position after content is loaded and math is rendered
                const scrollY = parseInt(localStorage.getItem('lastScrollY') || '0', 10);
                document.documentElement.style.scrollBehavior = 'auto';
                window.scrollTo(0, scrollY);
                setTimeout(() => {
                    document.documentElement.style.scrollBehavior = '';
                }, 0);
            }
        });
    }, 10);
}

function loadChapterByName(chapterName, anchor) {
    const chapter = chapters[chapterName];
    if (!chapter) {
        console.error(`[latex.js] Chapter '${chapterName}' not found.`);
        return;
    }
    loadChapter(chapter.file, anchor);
}

function setupNavigation() {
    // Top chapter navigation
    document.querySelectorAll('.chapter-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const chapter = this.getAttribute('data-chapter');
            localStorage.setItem('lastChapter', chapter); // Save last viewed chapter
            loadChapterByName(chapter);
        });
    });
    // Cross-reference event delegation
    document.getElementById('content').addEventListener('click', function(e) {
        let cref = e.target.closest('.cref');
        if (cref) {
            e.preventDefault();
            const targetId = cref.getAttribute('data-target');
            const targetFile = labelMap[targetId];
            // Try to find the chapter name for the file
            let targetChapterName = null;
            for (const [name, ch] of Object.entries(chapters)) {
                if (ch.file === targetFile) {
                    targetChapterName = name;
                    break;
                }
            }
            if (targetFile && currentChapterFile !== targetFile && targetChapterName) {
                loadChapterByName(targetChapterName, targetId);
            } else {
                scrollToAnchor(targetId);
            }
        }
    });
    // Save scroll position and current chapter on scroll
    window.addEventListener('scroll', () => {
        localStorage.setItem('lastScrollY', window.scrollY);
        if (currentChapterFile) {
            localStorage.setItem('lastChapter', Object.keys(chapters).find(name => chapters[name].file === currentChapterFile));
        }
    });
}

// Initialization
function initLatexNavigation() {
    fetchLabelMap().then(() => {
        setupNavigation();
        renderEnhancements();
        // Restore last viewed chapter from localStorage, default to chapter1
        const lastChapter = localStorage.getItem('lastChapter');
        if (lastChapter) {
            loadChapterByName(lastChapter);
        } else {
            loadChapterByName('chapter1');
        }
        window.scrollTo(0, 0);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initLatexNavigation();
});

export { processLatexContent }; 