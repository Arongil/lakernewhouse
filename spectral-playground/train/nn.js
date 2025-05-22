/* Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

/**
 * A node in a neural network. Each node has a state
 * (total input, output, and their respectively derivatives) which changes
 * after every forward and back propagation run.
 */
class Node {
  constructor(id, activation, initZero = false) {
    this.id = id;
    this.inputLinks = [];
    this.bias = initZero ? 0 : 0.1;
    this.outputs = [];
    this.totalInput = 0;
    this.output = 0;
    this.outputDer = 0;
    this.inputDer = 0;
    this.accInputDer = 0;
    this.numAccumulatedDers = 0;
    this.activation = activation;
  }

  /** Recomputes the node's output and returns it. */
  updateOutput() {
    // Stores total input into the node.
    this.totalInput = this.bias;
    for (let j = 0; j < this.inputLinks.length; j++) {
      let link = this.inputLinks[j];
      this.totalInput += link.weight * link.source.output;
    }
    this.output = this.activation.output(this.totalInput);
    return this.output;
  }
}

/** Built-in error functions */
const Errors = {
  SQUARE: {
    error: (output, target) => 0.5 * Math.pow(output - target, 2),
    der: (output, target) => output - target
  }
};

/** Polyfill for TANH */
Math.tanh = Math.tanh || function(x) {
  if (x === Infinity) {
    return 1;
  } else if (x === -Infinity) {
    return -1;
  } else {
    let e2x = Math.exp(2 * x);
    return (e2x - 1) / (e2x + 1);
  }
};

/** Built-in activation functions */
const Activations = {
  TANH: {
    output: x => Math.tanh(x),
    der: x => {
      let output = Activations.TANH.output(x);
      return 1 - output * output;
    }
  },
  RELU: {
    output: x => Math.max(0, x),
    der: x => x <= 0 ? 0 : 1
  },
  SIGMOID: {
    output: x => 1 / (1 + Math.exp(-x)),
    der: x => {
      let output = Activations.SIGMOID.output(x);
      return output * (1 - output);
    }
  },
  LINEAR: {
    output: x => x,
    der: x => 1
  }
};

/** Build-in regularization functions */
const RegularizationFunction = {
  L1: {
    output: w => Math.abs(w),
    der: w => w < 0 ? -1 : (w > 0 ? 1 : 0)
  },
  L2: {
    output: w => 0.5 * w * w,
    der: w => w
  }
};

/**
 * A link in a neural network. Each link has a weight and a source and
 * destination node. Also it has an internal state (error derivative
 * with respect to a particular input) which gets updated after
 * a run of back propagation.
 */
class Link {
  constructor(source, dest, regularization, initZero = false) {
    this.id = source.id + "-" + dest.id;
    this.source = source;
    this.dest = dest;
    this.weight = initZero ? 0 : Math.random() - 0.5;
    this.isDead = false;
    this.errorDer = 0;
    this.accErrorDer = 0;
    this.numAccumulatedDers = 0;
    this.regularization = regularization;
  }
}

/**
 * Builds a neural network.
 */
function buildNetwork(networkShape, activation, outputActivation, regularization, inputIds, initZero = false) {
  let numLayers = networkShape.length;
  let id = 1;
  let network = [];
  
  for (let layerIdx = 0; layerIdx < numLayers; layerIdx++) {
    let isOutputLayer = layerIdx === numLayers - 1;
    let isInputLayer = layerIdx === 0;
    let currentLayer = [];
    network.push(currentLayer);
    let numNodes = networkShape[layerIdx];
    
    for (let i = 0; i < numNodes; i++) {
      let nodeId = id.toString();
      if (isInputLayer) {
        nodeId = inputIds[i];
      } else {
        id++;
      }
      let node = new Node(nodeId, isOutputLayer ? outputActivation : activation, initZero);
      currentLayer.push(node);
      
      if (layerIdx >= 1) {
        // Add links from nodes in the previous layer to this node.
        for (let j = 0; j < network[layerIdx - 1].length; j++) {
          let prevNode = network[layerIdx - 1][j];
          let link = new Link(prevNode, node, regularization, initZero);
          prevNode.outputs.push(link);
          node.inputLinks.push(link);
        }
      }
    }
  }
  return network;
}

/**
 * Runs a forward propagation of the provided input through the provided
 * network.
 */
function forwardProp(network, inputs) {
  let inputLayer = network[0];
  if (inputs.length !== inputLayer.length) {
    throw new Error("The number of inputs must match the number of nodes in" +
        " the input layer");
  }
  
  // Update the input layer.
  for (let i = 0; i < inputLayer.length; i++) {
    let node = inputLayer[i];
    node.output = inputs[i];
  }
  
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    // Update all the nodes in this layer.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.updateOutput();
    }
  }
  return network[network.length - 1][0].output;
}

/**
 * Runs a backward propagation using the provided target and the
 * computed output of the previous call to forward propagation.
 */
function backProp(network, target, errorFunc) {
  // The output node is a special case. We use the user-defined error
  // function for the derivative.
  let outputNode = network[network.length - 1][0];
  outputNode.outputDer = errorFunc.der(outputNode.output, target);

  // Go through the layers backwards.
  for (let layerIdx = network.length - 1; layerIdx >= 1; layerIdx--) {
    let currentLayer = network[layerIdx];
    // Compute the error derivative of each node with respect to:
    // 1) its total input
    // 2) each of its input weights.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      node.inputDer = node.outputDer * node.activation.der(node.totalInput);
      node.accInputDer += node.inputDer;
      node.numAccumulatedDers++;
    }

    // Error derivative with respect to each weight coming into the node.
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        link.errorDer = node.inputDer * link.source.output;
        link.accErrorDer += link.errorDer;
        link.numAccumulatedDers++;
      }
    }
    if (layerIdx === 1) {
      continue;
    }
    let prevLayer = network[layerIdx - 1];
    for (let i = 0; i < prevLayer.length; i++) {
      let node = prevLayer[i];
      // Compute the error derivative with respect to each node's output.
      node.outputDer = 0;
      for (let j = 0; j < node.outputs.length; j++) {
        let output = node.outputs[j];
        node.outputDer += output.weight * output.dest.inputDer;
      }
    }
  }
}

/**
 * Updates the weights of the network using the previously accumulated error
 * derivatives.
 */
function updateWeights(network, learningRate, regularizationRate) {
  for (let layerIdx = 1; layerIdx < network.length; layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      // Update the node's bias.
      if (node.numAccumulatedDers > 0) {
        node.bias -= learningRate * node.accInputDer / node.numAccumulatedDers;
        node.accInputDer = 0;
        node.numAccumulatedDers = 0;
      }
      // Update the weights coming into this node.
      for (let j = 0; j < node.inputLinks.length; j++) {
        let link = node.inputLinks[j];
        if (link.isDead) {
          continue;
        }
        let regulDer = link.regularization ?
            link.regularization.der(link.weight) : 0;
        if (link.numAccumulatedDers > 0) {
          // Update the weight based on dE/dw.
          link.weight = link.weight -
              (learningRate / link.numAccumulatedDers) * link.accErrorDer;
          // Further update the weight based on regularization.
          let newLinkWeight = link.weight -
              (learningRate * regularizationRate) * regulDer;
          if (link.regularization === RegularizationFunction.L1 &&
              link.weight * newLinkWeight < 0) {
            // The weight crossed 0 due to the regularization term. Set it to 0.
            link.weight = 0;
            link.isDead = true;
          } else {
            link.weight = newLinkWeight;
          }
          link.accErrorDer = 0;
          link.numAccumulatedDers = 0;
        }
      }
    }
  }
}

/** Iterates over every node in the network. */
function forEachNode(network, ignoreInputs, accessor) {
  for (let layerIdx = ignoreInputs ? 1 : 0;
      layerIdx < network.length;
      layerIdx++) {
    let currentLayer = network[layerIdx];
    for (let i = 0; i < currentLayer.length; i++) {
      let node = currentLayer[i];
      accessor(node);
    }
  }
}

/** Returns the output node in the network. */
function getOutputNode(network) {
  return network[network.length - 1][0];
}

// Export all the necessary components
export {
  Node,
  Link,
  Errors,
  Activations,
  RegularizationFunction,
  buildNetwork,
  forwardProp,
  backProp,
  updateWeights,
  forEachNode,
  getOutputNode
}; 