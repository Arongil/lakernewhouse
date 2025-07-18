// Gradient Transformation Playground
// Interactive visualization of how optimizers transform gradient singular values

class GradientPlayground {
    constructor() {
        this.rawHistogram = null;
        this.transformedHistogram = null;
        this.currentColors = [];
        
        // Desmos calculator instance
        this.calculator = null;
        
        // Canvas contexts
        this.rawCanvas = document.getElementById('raw-canvas');
        this.transformedCanvas = document.getElementById('transformed-canvas');
        this.rawCtx = this.rawCanvas.getContext('2d');
        this.transformedCtx = this.transformedCanvas.getContext('2d');
        
        // Control elements
        this.accumSelect = document.getElementById('accum');
        this.stepSelect = document.getElementById('step');
        this.layerSelect = document.getElementById('layer');
        this.matrixSelect = document.getElementById('matrix');
        this.warning = document.getElementById('odd-warning');
        
        // Preset buttons
        this.sgdBtn = document.getElementById('sgd-btn');
        this.muonBtn = document.getElementById('muon-btn');
        this.reversoBtn = document.getElementById('reverso-btn');
        
        // Histogram parameters
        this.numBins = 50;
        this.minLogValue = -6; // 10^-6
        this.maxLogValue = 0;  // 10^0
        
        this.init();
    }
    
    async init() {
        this.initDesmos();
        this.setupEventListeners();
        await this.loadDefaultData();
        this.setDefaultPolynomial();
    }
    
    initDesmos() {
        const elt = document.getElementById('calculator');
        this.calculator = Desmos.GraphingCalculator(elt, {
            keypad: true,
            settingsMenu: false,
            expressions: true,
            zoomButtons: true,
            expressionsTopbar: true,
            pointsOfInterest: false,
            trace: false,
            border: false,
            lockViewport: false,
            expressionsCollapsed: false,
            autosize: true
        });
        
        // Set up the initial function
        this.calculator.setExpression({
            id: 'polynomial',
            latex: 'f(x) = x',
            color: '#4a90e2'
        });
        
        // Set up viewport
        this.calculator.setMathBounds({
            left: -1.5,
            right: 1.5,
            bottom: -1.5,
            top: 1.5
        });
        
        // Listen for expression changes with debouncing
        this.lastExpressionState = null;
        this.updateTimeout = null;
        
        this.calculator.observeEvent('change', () => {
            // Debounce updates to prevent lag
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
            }
            
            this.updateTimeout = setTimeout(() => {
                this.onPolynomialChange();
            }, 500);
        });
    }
    
    setupEventListeners() {
        this.sgdBtn.addEventListener('click', () => this.setSGD());
        this.muonBtn.addEventListener('click', () => this.setMuon());
        this.reversoBtn.addEventListener('click', () => this.setReverso());
        
        // Auto-reload when controls change
        [this.accumSelect, this.stepSelect, this.layerSelect, this.matrixSelect].forEach(select => {
            select.addEventListener('change', () => this.loadData());
        });
    }
    
    async loadDefaultData() {
        await this.loadData();
    }
    
    async loadData() {
        const accum = this.accumSelect.value;
        const step = this.stepSelect.value;
        const layer = this.layerSelect.value;
        const matrix = this.matrixSelect.value;
        
        try {
            const response = await fetch(`histograms/raw_grad_accum${accum}_step${step}_block${layer}_${matrix}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load histogram data: ${response.status}`);
            }
            
            this.rawHistogram = await response.json();
            this.generateColors();
            this.renderRawHistogram();
            this.updateTransformedHistogram();
        } catch (error) {
            console.error('Error loading histogram data:', error);
            // Try loading step 0 if the selected step doesn't exist
            if (step !== '0') {
                this.stepSelect.value = '0';
                await this.loadData();
            }
        }
    }
    
    generateColors() {
        // Generate a smooth color gradient for the histogram bars
        this.currentColors = [];
        for (let i = 0; i < this.numBins; i++) {
            const ratio = i / (this.numBins - 1);
            // Create a color gradient from blue to red
            const r = Math.floor(255 * ratio);
            const g = Math.floor(100 * (1 - ratio));
            const b = Math.floor(255 * (1 - ratio));
            this.currentColors.push(`rgb(${r},${g},${b})`);
        }
    }
    
    renderRawHistogram() {
        if (!this.rawHistogram) return;
        
        const canvas = this.rawCanvas;
        const ctx = this.rawCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, width, height);
        
        // Find max value for scaling
        const maxValue = Math.max(...this.rawHistogram);
        if (maxValue === 0) return;
        
        // Calculate bar dimensions
        const barWidth = width / this.numBins;
        const padding = 20;
        const graphHeight = height - 2 * padding;
        
        // Draw bars
        for (let i = 0; i < this.numBins; i++) {
            const barHeight = (this.rawHistogram[i] / maxValue) * graphHeight;
            const x = i * barWidth;
            const y = height - padding - barHeight;
            
            ctx.fillStyle = this.currentColors[i];
            ctx.fillRect(x, y, barWidth, barHeight);
        }
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - padding);
        ctx.lineTo(width, height - padding);
        ctx.moveTo(0, padding);
        ctx.lineTo(0, height - padding);
        ctx.stroke();
    }
    
    onPolynomialChange() {
        // Get the polynomial expression from Desmos
        const expressions = this.calculator.getExpressions();
        const polynomialExpr = expressions.find(expr => expr.id === 'polynomial');
        
        if (polynomialExpr && polynomialExpr.latex) {
            // Check if expression actually changed
            if (this.lastExpressionState === polynomialExpr.latex) {
                return; // No change, skip update
            }
            
            this.lastExpressionState = polynomialExpr.latex;
            this.validatePolynomial(polynomialExpr.latex);
            this.updateTransformedHistogram();
        }
    }
    
    validatePolynomial(latex) {
        // Simple validation - check if polynomial is odd
        // This is a heuristic check - for production would need more robust validation
        const isOdd = this.checkIfOdd(latex);
        
        if (isOdd) {
            this.warning.style.display = 'none';
        } else {
            this.warning.style.display = 'block';
        }
    }
    
    checkIfOdd(latex) {
        // Heuristic check for odd functions
        // Look for only odd powers of x and no constant term
        const simplified = latex.replace(/\s/g, '').toLowerCase();
        
        // If it's just x or -x, it's odd
        if (simplified === 'f(x)=x' || simplified === 'f(x)=-x') {
            return true;
        }
        
        // Check for common odd polynomial patterns
        const oddPatterns = [
            /x\^3/, /x\^5/, /x\^7/, /x\^9/,  // odd powers
            /x\*\*3/, /x\*\*5/, /x\*\*7/, /x\*\*9/  // alternate notation
        ];
        
        const evenPatterns = [
            /x\^2/, /x\^4/, /x\^6/, /x\^8/,  // even powers
            /x\*\*2/, /x\*\*4/, /x\*\*6/, /x\*\*8/,  // alternate notation
            /\+\d/, /\-\d(?![.*x])/  // constant terms
        ];
        
        // If it has even patterns, it's not odd
        for (let pattern of evenPatterns) {
            if (pattern.test(simplified)) {
                return false;
            }
        }
        
        // If it has odd patterns or is linear, assume it's odd
        return true;
    }
    
    evaluatePolynomial(x) {
        // Always use direct evaluation for better performance
        return this.evaluatePolynomialDirect(x);
    }
    
    evaluatePolynomialDirect(x) {
        // Cache the current polynomial type for performance
        if (!this.cachedPolynomialType || this.lastExpressionState !== this.cachedExpressionState) {
            this.cachePolynomialType();
        }
        
        switch (this.cachedPolynomialType) {
            case 'sgd':
                return x;
            case 'muon':
                return this.muonTransform(x);
            case 'reverso':
                return this.reversoTransform(x);
            case 'cubic':
                return this.evaluateCachedCubic(x);
            case 'custom':
                return this.evaluateCustomPolynomial(x);
            default:
                return x;
        }
    }
    
    cachePolynomialType() {
        // Get the current polynomial expression
        const expressions = this.calculator.getExpressions();
        const polynomialExpr = expressions.find(expr => expr.id === 'polynomial');
        
        if (!polynomialExpr || !polynomialExpr.latex) {
            this.cachedPolynomialType = 'sgd';
            this.cachedExpressionState = '';
            return;
        }
        
        const latex = polynomialExpr.latex.toLowerCase();
        this.cachedExpressionState = latex;
        
        // Determine polynomial type and cache coefficients
        if (latex.includes('f(x)=x') || latex === 'f(x) = x' || latex.includes('f(x)=1x') || latex.includes('f(x) = 1x')) {
            this.cachedPolynomialType = 'sgd';
        } else if (latex.includes('g(g(g(g(g(g(g(g(g(g(x))))))))))') || latex.includes('f(x)=g(g(g(g(g(g(g(g(g(g(x))))))))))')) {
            this.cachedPolynomialType = 'muon';
        } else if (latex.includes('q_3(q_2(q_1(x)))') || latex.includes('f(x)=q_3(q_2(q_1(x)))')) {
            this.cachedPolynomialType = 'reverso';
        } else if (latex.includes('x^3') || latex.includes('x**3')) {
            this.cachedPolynomialType = 'cubic';
            this.cacheCubicCoefficients(latex);
        } else {
            this.cachedPolynomialType = 'custom';
            this.parseCustomPolynomial(latex);
        }
        
    }
    
    cacheCubicCoefficients(latex) {
        try {
            // Extract coefficient patterns
            const cubicMatch = latex.match(/([+-]?\s*\d*\.?\d*)\s*\*?\s*x\^?3/);
            const linearMatch = latex.match(/([+-]?\s*\d*\.?\d*)\s*\*?\s*x(?!\^)/);
            
            this.cachedCubicCoeff = cubicMatch ? parseFloat(cubicMatch[1].replace(/\s/g, '')) || 1 : 0;
            this.cachedLinearCoeff = linearMatch ? parseFloat(linearMatch[1].replace(/\s/g, '')) || 1 : 1;
        } catch (error) {
            this.cachedCubicCoeff = 0;
            this.cachedLinearCoeff = 1;
        }
    }
    
    evaluateCachedCubic(x) {
        return this.cachedLinearCoeff * x + this.cachedCubicCoeff * Math.pow(x, 3);
    }
    
    parseCustomPolynomial(latex) {
        // Simple parser for custom polynomials
        // Extract terms like ax^n
        this.customTerms = [];
        
        try {
            // Match patterns like "2.5*x^3", "-1.2x^5", "x", etc.
            const termPattern = /([+-]?\s*\d*\.?\d*)\s*\*?\s*x(\^(\d+))?/g;
            let match;
            
            while ((match = termPattern.exec(latex)) !== null) {
                const coeff = parseFloat(match[1].replace(/\s/g, '')) || 1;
                const power = match[3] ? parseInt(match[3]) : 1;
                this.customTerms.push({ coeff, power });
            }
            
            // If no terms found, default to identity
            if (this.customTerms.length === 0) {
                this.customTerms = [{ coeff: 1, power: 1 }];
            }
        } catch (error) {
            this.customTerms = [{ coeff: 1, power: 1 }];
        }
    }
    
    evaluateCustomPolynomial(x) {
        let result = 0;
        for (const term of this.customTerms) {
            result += term.coeff * Math.pow(x, term.power);
        }
        return result;
    }
    
    muonTransform(x) {
        // Muon: 10 iterations of g(x) = 3/2 * x - 1/2 * x^3
        let result = x;
        for (let i = 0; i < 10; i++) {
            const newResult = 1.5 * result - 0.5 * Math.pow(result, 3);
            
            // Check for problematic values at each iteration
            if (!isFinite(newResult) || isNaN(newResult)) {
                console.warn(`Muon transform produced NaN/Inf at iteration ${i}, input=${x}, prev_result=${result}, new_result=${newResult}`);
                return result; // Return last valid result
            }
            
            result = newResult;
            
            // Prevent runaway values
            if (Math.abs(result) > 100) {
                console.warn(`Muon transform diverged at iteration ${i}, input=${x}, result=${result}`);
                return Math.sign(x); // Return normalized value
            }
        }
        return result;
    }
    
    reversoTransform(x) {
        // Reverso: q3(q2(q1(x))) where each qi is a polynomial approximation
        const q1 = (t) => 3.86045 * t - 7.84417 * Math.pow(t, 3) + 5.10904 * Math.pow(t, 5);
        const q2 = (t) => 3.4686 * t - 4.56855 * Math.pow(t, 3) + 2.12725 * Math.pow(t, 5);
        const q3 = (t) => 1.9806 * t - 3.12452 * Math.pow(t, 3) + 1.2417 * Math.pow(t, 5);
        
        return q3(q2(q1(x)));
    }
    
    // --- Binning and Unbinning Utilities ---
    binIndexToValue(binIndex) {
        // Bin centers in log space
        const binWidth = (this.maxLogValue - this.minLogValue) / this.numBins;
        const logValue = this.minLogValue + (binIndex + 0.5) * binWidth;
        return Math.pow(10, logValue);
    }
    
    valueToBinIndex(value) {
        const logValue = Math.log10(Math.abs(value));
        const binWidth = (this.maxLogValue - this.minLogValue) / this.numBins;
        let binIndex = Math.floor((logValue - this.minLogValue) / binWidth);
        if (binIndex < 0) binIndex = 0;
        if (binIndex >= this.numBins) binIndex = this.numBins - 1;
        return binIndex;
    }
    
    transformHistogram() {
        if (!this.rawHistogram) return null;
        const transformed = new Array(this.numBins).fill(0);
        const actualBins = Math.min(this.numBins, this.rawHistogram.length);
        for (let i = 0; i < actualBins; i++) {
            if (!this.rawHistogram[i] || this.rawHistogram[i] === 0) continue;
            // Use binIndexToValue for forward mapping
            const value = this.binIndexToValue(i);
            const transformedValue = this.evaluatePolynomial(value);
            if (!isFinite(transformedValue) || isNaN(transformedValue)) continue;
            if (transformedValue === 0) continue;
            const absTransformed = Math.abs(transformedValue);
            if (absTransformed <= 0 || !isFinite(absTransformed)) continue;
            // Use valueToBinIndex for reverse mapping
            const binIndex = this.valueToBinIndex(absTransformed);
            if (binIndex >= 0 && binIndex < this.numBins) {
                transformed[binIndex] += this.rawHistogram[i];
            }
        }
        return transformed;
    }
    
    updateTransformedHistogram() {
        this.transformedHistogram = this.transformHistogram();
        this.renderTransformedHistogram();
    }
    
    renderTransformedHistogram() {
        if (!this.transformedHistogram) {
            console.log('No transformed histogram to render');
            return;
        }
        
        const canvas = this.transformedCanvas;
        const ctx = this.transformedCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, width, height);
        
        // Find max value for scaling - filter out NaN values
        const validValues = this.transformedHistogram.filter(val => isFinite(val) && !isNaN(val));
        const maxValue = validValues.length > 0 ? Math.max(...validValues) : 0;
        if (maxValue === 0) {
            // Draw axes even if empty
            this.drawAxes(ctx, width, height, 20);
            return;
        }
        
        // Calculate bar dimensions
        const barWidth = width / this.numBins;
        const padding = 20;
        const graphHeight = height - 2 * padding;
        
        // Draw bars with gradient colors
        for (let i = 0; i < this.numBins; i++) {
            if (this.transformedHistogram[i] > 0) {
                const barHeight = (this.transformedHistogram[i] / maxValue) * graphHeight;
                const x = i * barWidth;
                const y = height - padding - barHeight;
                
                // Create gradient for this bar based on contributing original bins
                ctx.fillStyle = this.currentColors[i];
                ctx.fillRect(x, y, barWidth, barHeight);
            }
        }
        
        // Draw axes
        this.drawAxes(ctx, width, height, padding);
    }
    
    drawAxes(ctx, width, height, padding) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height - padding);
        ctx.lineTo(width, height - padding);
        ctx.moveTo(0, padding);
        ctx.lineTo(0, height - padding);
        ctx.stroke();
    }
    
    // Preset polynomial functions
    setSGD() {
        this.calculator.setExpression({
            id: 'polynomial',
            latex: 'f(x) = x',
            color: '#4a90e2'
        });
    }
    
    setMuon() {
        // Muon: 5 compositions of g(x) = 3.4445x - 4.7750x^3 + 2.0315x^5
        const muonFunction = 'f(x) = g(g(g(g(g(x)))))';
        const helperFunction = 'g(x) = 3.4445x - 4.7750x^3 + 2.0315x^5';
        
        this.calculator.setExpression({
            id: 'helper',
            latex: helperFunction,
            color: '#28a745',
            hidden: true
        });
        
        this.calculator.setExpression({
            id: 'polynomial',
            latex: muonFunction,
            color: '#4a90e2'
        });
    }
    
    setReverso() {
        // Reverso: composition of three polynomial approximations
        const q1 = 'q_1(x) = 3.86045x - 7.84417x^3 + 5.10904x^5';
        const q2 = 'q_2(x) = 3.4686x - 4.56855x^3 + 2.12725x^5';
        const q3 = 'q_3(x) = 1.9806x - 3.12452x^3 + 1.2417x^5';
        const reversoFunction = 'f(x) = q_3(q_2(q_1(x)))';
        
        this.calculator.setExpression({
            id: 'q1',
            latex: q1,
            color: '#dc3545',
            hidden: true
        });
        
        this.calculator.setExpression({
            id: 'q2',
            latex: q2,
            color: '#dc3545',
            hidden: true
        });
        
        this.calculator.setExpression({
            id: 'q3',
            latex: q3,
            color: '#dc3545',
            hidden: true
        });
        
        this.calculator.setExpression({
            id: 'polynomial',
            latex: reversoFunction,
            color: '#4a90e2'
        });
    }
    
    setDefaultPolynomial() {
        // Set default to Muon as requested
        this.setMuon();
    }
}

// Initialize the playground when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.gradientPlayground = new GradientPlayground();
});