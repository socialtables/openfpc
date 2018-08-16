import * as tf from "@tensorflow/tfjs";

const INPUT_IMG_WIDTH = 256;
const INPUT_IMG_HEIGHT = 256;

const NUM_CLASSIFIABLE_OBJECTS = 5;


const input = tf.input({shape: [INPUT_IMG_WIDTH, INPUT_IMG_HEIGHT, 1]});

const oneByone = tf.layers.conv2d({
    kernelSize: 1,
    filters: 8,
    strides: 1
});

const threeBythree = tf.layers.conv2d({
    kernelSize: 3,
    filters: 16,
    strides: 1
});

const fiveByfive = tf.layers.conv2d({
    kernelSize: 5,
    filters: 24,
    strides: 1
});

const maxPool = tf.layers.maxPooling2d({
    poolSize: [2, 2],
    strides: [2, 2]
});

const denseLayer = tf.layers.dense({
    units: NUM_CLASSIFIABLE_OBJECTS,
    activation: "softmax"
});


// Construct the inception module graph
const oneByoneRoute = oneByone.apply(input);
const threeBythreeRoute = threeBythree.apply(input);
const fiveByfiveRoute = fiveByfive.apply(input);
const output = denseLayer.apply(maxPool.apply(fiveByfiveRoute.apply(threeBythreeRoute.apply(oneByoneRoute))));


// Create the model based on the inputs.
const model = tf.model({inputs: input, outputs: output});

export default model;