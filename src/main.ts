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
const frequencyRange = { // Frequency ranges for audio analysis
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
  const fov = 45;  // Field of view set to 45°
  const aspect = screenWidth / screenHeight; // Aspect Ratio

  // Camera
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 10000);

  const z = Math.min(window.innerWidth, window.innerHeight);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);

  threeScene.add(camera); // Add Camera to the scene
}


/**
 * Responsible to create a new video element and set it to autoplay
 */
const initializeVideo = (): void => { // https://developer.mozilla.org/fr/docs/Web/API/MediaDevices/getUserMedia
  videoInput = document.getElementById("video") as HTMLVideoElement;
  videoInput.autoplay = true;

  navigator.mediaDevices.getUserMedia({audio: true, video: true})
    .then((stream) => {
        videoInput.srcObject = stream;
        videoInput.addEventListener("loadeddata", () => {
            videoWidth = videoInput.videoWidth;
            videoHeight = videoInput.videoHeight;

            // :point_right: createParticles() here
        });
    })
    .catch((error) => {
        console.log(error);
        document.getElementById("message")?.classList.remove("hidden"); // Show alert if user not allowed camera access
    });
}


/**
 * Responsible to create particles
 */
const createParticles = (): void => {

}