/*

Renders a histogram stored in histograms/raw_grad_step{step}_layer{layer}_{matrix}.json

and maps it through user-defined odd polynomial iteration, preserving the color gradient.

*/

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const CENTERX = WIDTH / 2;
const CENTERY = HEIGHT / 2;

// Get control elements
const accumSelect = document.getElementById('accum');
const stepSelect = document.getElementById('step');
const layerSelect = document.getElementById('layer');
const matrixSelect = document.getElementById('matrix');
const loadButton = document.getElementById('load');

async function loadHistogram(accum, step, layer, matrix) {
    // accum is 1, 4, 16
    // step is 0, 100, 200, 400, 800, 1600
    // layer is 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
    // matrix is q, k, v, c_proj, mlp_fc, mlp_proj
    const response = await fetch(`histograms/raw_grad_accum${accum}_step${step}_block${layer}_${matrix}.json`);
    const histogram = await response.json();
    return histogram;
}

async function renderHistogram(histogram, x, y, width, height) {
    // histogram has 50 bins between -6 and 0 in logspace (base 10)
    // each one should render as a blue bar

    // graph background
    fill(255, 255, 255);
    rect(x, y, width, height);

    stroke(0, 0, 0);
    line(x, y + height, x, y);
    line(x, y + height, x + width, y + height);
    strokeWeight(0);

    // Calculate dimensions for histogram
    const barWidth = width / histogram.length;
    
    // Find max value for scaling
    const maxValue = Math.max(...histogram);
    
    // Draw bars
    fill(0, 0, 255);  // Blue color
    for (let i = 0; i < histogram.length; i++) {
        const barHeight = (histogram[i] / maxValue) * height;
        const x = i * barWidth;
        const y = height - barHeight/2;
        rect(x + barWidth/2, y, barWidth + 1, barHeight);
    }
}

// Add click handler for load button
loadButton.addEventListener('click', async () => {
    const accum = parseInt(accumSelect.value);
    const step = parseInt(stepSelect.value);
    const layer = parseInt(layerSelect.value);
    const matrix = matrixSelect.value;
    
    const histogram = await loadHistogram(accum, step, layer, matrix);
    renderHistogram(histogram, 0, CENTERY, WIDTH/2, HEIGHT/2);
});
