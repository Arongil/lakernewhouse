import {
  buildNetwork,
  Activations,
  Errors,
  RegularizationFunction,
  forwardProp,
  backProp,
  updateWeights
} from 'nn.js';

// Setup canvas for loss plotting
const canvas = document.getElementById('lossPlot');
const ctx = canvas.getContext('2d');

// Set canvas size to match display size
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Loss plotting functions
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawAxes() {
    ctx.beginPath();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.moveTo(50, 20);
    ctx.lineTo(50, canvas.height - 30);
    
    // X-axis
    ctx.moveTo(50, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    
    // Draw the axes
    ctx.stroke();
    
    // Add ticks and labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Roboto';
    ctx.textAlign = 'right';
    
    // Y-axis ticks (log scale)
    const logMin = -4; // 1e-4
    const logMax = 0;  // 1e0
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
        const logValue = logMin + (logMax - logMin) * i / numTicks;
        const y = canvas.height - 30 - (i * (canvas.height - 50) / numTicks);
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(50, y);
        ctx.stroke();
        ctx.fillText(`${(10 ** logValue).toFixed(1)}e${logValue}`, 43, y + 4);
    }
    
    // X-axis ticks (log scale)
    ctx.textAlign = 'center';
    const xTicks = [1, 10, 100, 1000];
    for (const tick of xTicks) {
        const x = 50 + (Math.log10(tick) / Math.log10(epochs)) * (canvas.width - 70);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 30);
        ctx.lineTo(x, canvas.height - 25);
        ctx.stroke();
        ctx.fillText(tick.toString(), x, canvas.height - 15);
    }
    
    // Axis labels
    ctx.textAlign = 'center';
    ctx.fillText('Loss', 10, canvas.height / 2);
    ctx.fillText('Epoch', canvas.width / 2, canvas.height - 10);
}

function plotLoss(epoch, loss, maxLoss) {
    // Convert to log scale
    const logEpoch = Math.log10(epoch + 1); // +1 to handle epoch 0
    const logLoss = Math.log10(Math.max(loss, 1e-4)); // Clamp minimum loss for log scale
    
    const x = 50 + (logEpoch / Math.log10(epochs)) * (canvas.width - 70);
    const y = canvas.height - 30 - ((logLoss + 4) / 4) * (canvas.height - 50); // Scale to fit -4 to 0 range
    
    if (epoch === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else {
        ctx.lineTo(x, y);
    }
    
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Training parameters
let learningRate = 0.01;
let momentum = 0.9;
const epochs = 1000;
const beta2 = 0.95; // Fixed beta2 for Adam

// Setup controls
const lrSlider = document.getElementById('learningRate');
const momentumSlider = document.getElementById('momentum');
const trainButton = document.getElementById('trainButton');
const lrValue = document.getElementById('lrValue');
const momentumValue = document.getElementById('momentumValue');
const sgdButton = document.getElementById('sgdButton');
const adamButton = document.getElementById('adamButton');
const lrScheduleSelect = document.getElementById('lrSchedule');

// Optimizer selection
let selectedOptimizer = 'sgd';

function selectOptimizer(optimizer) {
    selectedOptimizer = optimizer;
    sgdButton.classList.toggle('selected', optimizer === 'sgd');
    adamButton.classList.toggle('selected', optimizer === 'adam');
}

sgdButton.addEventListener('click', () => selectOptimizer('sgd'));
adamButton.addEventListener('click', () => selectOptimizer('adam'));

lrSlider.addEventListener('input', (e) => {
    learningRate = parseFloat(e.target.value);
    lrValue.textContent = learningRate.toFixed(3);
});

momentumSlider.addEventListener('input', (e) => {
    momentum = parseFloat(e.target.value);
    momentumValue.textContent = momentum.toFixed(2);
});

// Adam optimizer implementation
class AdamOptimizer {
    constructor(learningRate, beta1, beta2) {
        this.learningRate = learningRate;
        this.beta1 = beta1;
        this.beta2 = beta2;
        this.m = new Map(); // First moment for weights
        this.v = new Map(); // Second moment for weights
        this.t = 0; // Time step
    }

    initializeMomentum(node) {
        // Initialize momentum for weights
        if (!this.m.has(node.id)) {
            this.m.set(node.id, node.inputLinks.map(() => 0));
            this.v.set(node.id, node.inputLinks.map(() => 0));
        }
    }

    applyGradients(node) {
        this.initializeMomentum(node);
        this.t += 1;

        // Update weight moments
        const m = this.m.get(node.id);
        const v = this.v.get(node.id);
        
        // Update each weight
        for (let i = 0; i < node.inputLinks.length; i++) {
            const link = node.inputLinks[i];
            if (link.isDead) continue;

            // Update moments
            const newM = m[i] * this.beta1 + link.accErrorDer * (1 - this.beta1);
            const newV = v[i] * this.beta2 + link.accErrorDer * link.accErrorDer * (1 - this.beta2);
            
            // Compute bias-corrected moments
            const mHat = newM / (1 - Math.pow(this.beta1, this.t));
            const vHat = newV / (1 - Math.pow(this.beta2, this.t));
            
            // Update weight
            link.weight -= this.learningRate * mHat / (Math.sqrt(vHat) + 1e-8);
            
            // Store updated moments
            m[i] = newM;
            v[i] = newV;
        }

        // Reset accumulated derivatives
        for (const link of node.inputLinks) {
            link.accErrorDer = 0;
            link.numAccumulatedDers = 0;
        }
    }
}

// Matrix multiplication helper
function matmul(A, B) {
    const m = A.length;
    const n = B[0].length;
    const p = A[0].length;
    const result = Array(m).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < p; k++) {
                result[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return result;
}

// Matrix transpose helper
function transpose(A) {
    return A[0].map((_, i) => A.map(row => row[i]));
}

// Matrix norm helper
function matrixNorm(A) {
    let sum = 0;
    for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < A[0].length; j++) {
            sum += A[i][j] * A[i][j];
        }
    }
    return Math.sqrt(sum);
}

// Newton-Schulz iteration for orthogonalization
function zeropower_via_newtonschulz5(G, steps) {
    const a = 3.4445;
    const b = -4.7750;
    const c = 2.0315;
    
    let X = G.map(row => row.map(val => val));
    
    // Ensure spectral norm is at most 1
    const norm = matrixNorm(X);
    X = X.map(row => row.map(val => val / (norm + 1e-7)));
    
    // Perform the NS iterations
    for (let step = 0; step < steps; step++) {
        const XT = transpose(X);
        const A = matmul(X, XT);
        const A2 = matmul(A, A);
        const B = A.map((row, i) => 
            row.map((val, j) => b * val + c * A2[i][j])
        );
        const BX = matmul(B, X);
        X = X.map((row, i) => 
            row.map((val, j) => a * val + BX[i][j])
        );
    }
    
    return X;
}

class MuonOptimizer {
    constructor(learningRate, momentum, nesterov = true, nsSteps = 5) {
        this.learningRate = learningRate;
        this.momentum = momentum;
        this.nesterov = nesterov;
        this.nsSteps = nsSteps;
        this.momentumBuffers = new Map();
    }

    initializeMomentum(node) {
        if (!this.momentumBuffers.has(node.id)) {
            this.momentumBuffers.set(node.id, {
                weights: node.inputLinks.map(() => 0)
            });
        }
    }

    applyGradients(node) {
        this.initializeMomentum(node);
        const buffer = this.momentumBuffers.get(node.id);

        // Update momentum buffer for weights
        for (let i = 0; i < node.inputLinks.length; i++) {
            const link = node.inputLinks[i];
            if (link.isDead) continue;

            // Update momentum
            buffer.weights[i] = buffer.weights[i] * this.momentum + 
                              link.accErrorDer * (1 - this.momentum);
            
            // Get gradient (with Nesterov if enabled)
            const grad = this.nesterov ? 
                link.accErrorDer * (1 - this.momentum) + buffer.weights[i] :
                buffer.weights[i];

            // Orthogonalize the update
            const orthogonalized = zeropower_via_newtonschulz5([[grad]], this.nsSteps)[0][0];
            const update = -this.learningRate * orthogonalized;
            console.log(grad, "-", orthogonalized);
            
            // Apply the update
            link.weight += orthogonalized;
        }

        // Reset accumulated derivatives
        for (const link of node.inputLinks) {
            link.accErrorDer = 0;
            link.numAccumulatedDers = 0;
        }
    }
}

async function train() {
    // Create network
    const network = buildNetwork(
        [2, 4, 1],
        Activations.RELU,
        Activations.LINEAR,
        RegularizationFunction.L2,
        ['input1', 'input2']
    );

    // Create optimizer
    const optimizer = selectedOptimizer === 'adam' 
        ? new AdamOptimizer(learningRate, momentum, beta2)
        : selectedOptimizer === 'muon'
        ? new MuonOptimizer(learningRate, momentum, true, 5)
        : null;

    // XOR training data
    const trainingData = [
        { input: [0, 0], target: 0 },
        { input: [0, 1], target: 1 },
        { input: [1, 0], target: 1 },
        { input: [1, 1], target: 0 }
    ];

    // Initialize plotting
    clearCanvas();
    drawAxes();
    let maxLoss = 0;

    // Training loop
    for (let epoch = 0; epoch < epochs; epoch++) {
        let totalError = 0;
        
        // Calculate current learning rate based on schedule
        let currentLR = learningRate;
        if (lrScheduleSelect.value === 'linear') {
            currentLR = learningRate * (1 - epoch / epochs);
        }
        
        // Train on each example
        for (const example of trainingData) {
            // Forward pass
            const output = forwardProp(network, example.input);
            
            // Compute error
            const error = Errors.SQUARE.error(output, example.target);
            totalError += error;
            
            // Backward pass
            backProp(network, example.target, Errors.SQUARE);
            
            // Update weights based on selected optimizer
            if (selectedOptimizer === 'sgd') {
                updateWeights(network, currentLR, momentum);
            } else if (selectedOptimizer === 'adam') {
                optimizer.learningRate = currentLR;
                // Update each layer's nodes
                for (let i = 1; i < network.length; i++) {
                    for (const node of network[i]) {
                        node.weights = optimizer.applyGradients(node);
                    }
                }
            } else if (selectedOptimizer === 'muon') {
                optimizer.learningRate = currentLR;
                // Update each layer's nodes
                for (let i = 1; i < network.length; i++) {
                    for (const node of network[i]) {
                        node.weights = optimizer.applyGradients(node);
                    }
                }
            }
        }
        
        const averageError = totalError / trainingData.length;
        maxLoss = Math.max(maxLoss, averageError);
        
        // Update plot
        plotLoss(epoch, averageError, maxLoss);
        
        // Allow UI to update
        if (epoch % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}

trainButton.addEventListener('click', train);

// Update optimizer selection
const muonButton = document.getElementById('muonButton');
muonButton.addEventListener('click', () => selectOptimizer('muon')); 