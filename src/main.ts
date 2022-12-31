import THREE from 'three';


let threeScene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera, clock: THREE.Clock;
let screenWidth: number, screenHeight: number;

let videoInput: HTMLVideoElement;
let particles: THREE.Object3D, videoWidth: number, videoHeight: number, imageCache: HTMLImageElement;

// Canvas
const canvasElement = document.createElement("canvas");
const canvasContext = canvasElement.getContext("2d");

const classNameForLoading: string = "loading";

// Audio
let audioSource: HTMLAudioElement, audioAnalyser: AnalyserNode;
const fftSize: number = 2048; // https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize
const frequencyRange = {
  bass: [20, 140],
  lowMid: [140, 400],
  mid: [400, 2600],
  highMid: [2600, 5200],
  treble: [5200, 14000],
};


/**
 * Responsible to set up the scene. It's the main function
 */
const initialize = (): void => {
}

/**
 * Create a perspective camera with a specified field of view, aspect ratio...
 */
const initializeCamera = (): void => {
}


/**
 * Responsible to create a new video element and set it to autoplay
 */
const initializeVideo = (): void => {

}