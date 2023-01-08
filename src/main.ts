/**
 * Description: Audio visualizer
 * Author: Wilfried Ndefo
 * Inspired by : https://www.instagram.com/p/BzD7B7bB5kA/
 */

import "./style.css";
import {
  Audio,
  Scene,
  Color,
  Points,
  Camera,
  Vector3,
  AudioLoader,
  AudioAnalyser,
  AudioListener,
  WebGLRenderer,
  BufferGeometry,
  PointsMaterial,
  PerspectiveCamera,
  Float32BufferAttribute
} from 'three';

// Basics
let threeScene: Scene, renderer: WebGLRenderer;

// Camera
let camera: Camera;
const cameraNear: number = 0.1, cameraFar: number = 10000;

// Canvas
const canvasElement = document.createElement("canvas");
const canvasContext = canvasElement.getContext("2d");

// Window
let screenWidth: number, screenHeight: number;

// Particles
let particlesMesh: Points<BufferGeometry, PointsMaterial>, particlesVertices: number[] = [];

// Video
let videoInput: HTMLVideoElement;
let videoWidth: number, videoHeight: number, imageCache: ImageData;

// Audio
let audioSource: Audio; // Global audio source
let audioAnalyser: AudioAnalyser; // Analyser responsible to get data from the audio source

const fftSize: number = 2048; // https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize
const frequencyRange = { // Frequency ranges for audio analysis
  bass: [20, 140],
  lowMid: [140, 400],
  mid: [400, 2600],
  highMid: [2600, 5200],
  treble: [5200, 14000],
};


/**
 * Responsible to set up the scene. It's the main function.
 */
const initialize = (): void => {
  threeScene = new Scene();
  threeScene.background = new Color(0x111111);

  // Renderer
  renderer = new WebGLRenderer();
  document.getElementById("content")?.appendChild(renderer.domElement);

  initializeCamera();

  handleResize();

  // @ts-ignore
  // Check for media devices and get the user's media if available
  const mediaDevicesAvailable: MediaDevices | undefined = navigator.mediaDevices || ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
    getUserMedia: (c: MediaStreamConstraints) => {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            (navigator.mozGetUserMedia || navigator.webkitGetUserMedia).call(navigator, c, resolve, reject);
        });
    }
  } : null);

  if(mediaDevicesAvailable) {
    initializeAudio();
    initializeVideo();
  } else {
    document.getElementById("message")?.classList.remove("hidden");
  }

  draw();
}

/**
 * Create a perspective camera with a specified field of view, aspect ratio...
 */
const initializeCamera = (): void => {
  const fov = 45;  // Field of view set to 45°
  const aspect = screenWidth / screenHeight; // Aspect Ratio

  // Camera
  camera = new PerspectiveCamera(fov, aspect, cameraNear, cameraFar);
  camera.lookAt(0, 0, 0);

  const z = Math.min(window.innerWidth, window.innerHeight);
  camera.position.set(0, 0, z);

  threeScene.add(camera); // Add Camera to the scene
}

/**
 * Responsible to create a new video element.
 */
const initializeVideo = (): void => { // https://developer.mozilla.org/fr/docs/Web/API/MediaDevices/getUserMedia
  videoInput = document.getElementById("video") as HTMLVideoElement;
  videoInput.autoplay = true;

  navigator.mediaDevices.getUserMedia({audio: false, video: true})
    .then((stream) => {
        videoInput.srcObject = stream;
        videoInput.addEventListener("loadeddata", () => {
            videoWidth = videoInput.videoWidth;
            videoHeight = videoInput.videoHeight; 

            createParticles();
        });
    })
    .catch((error) => {
        console.log(error);
        document.getElementById("message")?.classList.remove("hidden"); // Show alert if user not allowed camera access
    });
}

/**
 * Responsible to create and handle audio.
 */
const initializeAudio = (): void => {
  const audioListener = new AudioListener();
  audioSource = new Audio(audioListener);

  // Load a sound and set it as the Audio object's buffer
  const audioLoader = new AudioLoader();

  audioLoader.load('assets/demo11.mp3', (buffer: AudioBuffer) => {
    audioSource.setBuffer(buffer);
    audioSource.setLoop(true);
    audioSource.setVolume(0.5);
    audioSource.play();
  });

  audioAnalyser = new AudioAnalyser(audioSource, fftSize);

  document.body.addEventListener('click', () => { // Handle pause and play sound
      if (audioSource) {
          (audioSource.isPlaying) ? audioSource.pause() : audioSource.play();
      }
  });
} 

/**
 * Responsible to create particles.
 */
const createParticles = (): void => {
  const imageData = getImageDataFromVideo(videoInput);
  const geometry = new BufferGeometry(); // geometry of the particles mesh
  geometry.morphAttributes = {}; // This is necessary to avoid error.

  const material = new PointsMaterial({size: 1, sizeAttenuation: false}); // Material for the particles mesh

  // console.log(imageData);
  
  // Generate vertices from image data
  for (let y=0; y < imageData.height; y++) {
    for (let x=0; x < imageData.width; x++) {
        const vertex = new Vector3(x - imageData.width / 2, -y + imageData.height / 2, 0);
        particlesVertices.push(vertex.x, vertex.y, vertex.z);
    }
  }

  // 3 because there are 3 values (components) per vertex
  geometry.setAttribute('position', new Float32BufferAttribute(particlesVertices, 3));
  particlesMesh = new Points(geometry, material);

  threeScene.add(particlesMesh);
}

/**
 * Returns image data from given video frame, 
 * or returns image data from image store in the cache for performances reasons.
 */
const getImageDataFromVideo = (frame: HTMLVideoElement, useCache: boolean = true): ImageData => {
  if(useCache && imageCache) {
    return imageCache;
  }

  const { videoWidth: width, videoHeight: height } = frame;
  
  // Adapt the canva to the video frame sizes
  canvasElement.width = width;
  canvasElement.height = height;

  // To flip camera shot
  canvasContext?.translate(width, 0);
  canvasContext?.scale(-1, 1);
  
  // Get the data of the video and send it to the cache for optimization
  canvasContext?.drawImage(frame, 0, 0);
  imageCache = canvasContext?.getImageData(0, 0, videoWidth, videoHeight) as ImageData;

  return imageCache;
}

/**
 * Returns the amount of energy (amplitude / volume) from [0, 1], at a specific frequency,
 * or the average amount of energy between a frequency range.
 * 
 * More explication about the process here 👇:
 * https://makersportal.com/blog/2018/9/13/audio-processing-in-python-part-i-sampling-and-the-fast-fourier-transform
 */
const getFrequencyRangeValue = (spectrum: Uint8Array, freqRange: number[]): number => {
  const nyquist = 48000 / 2; // Nyquist frequency

  // Scaling the frequency range to the spectrum domain
  const lowIndex = Math.round(freqRange[0] / nyquist * spectrum.length);
  const highIndex = Math.round(freqRange[1] / nyquist * spectrum.length);

  let totalOfDecibels = 0, frequenceCount = 0;

  for (let i = lowIndex; i <= highIndex; i++) {
      totalOfDecibels += spectrum[i];
      frequenceCount += 1;
  }

  return (totalOfDecibels / frequenceCount) / 255;
};

/**
 * Draw the visualizer.
 */
const draw = (deltaTime: DOMHighResTimeStamp = 0): void => {
  // Audio data for edit color of the particles mesh 
  let r = 0, g = 0, b = 0;
  
  if (audioAnalyser) {
      // analyser.getFrequencyData() would be an array with a size of half of fftSize.
      // Each item in the array represent the decibel value at a specific frequency (amplitude / volume)
      const data: Uint8Array = audioAnalyser.getFrequencyData();

      const bass = getFrequencyRangeValue(data, frequencyRange.bass);
      const mid = getFrequencyRangeValue(data, frequencyRange.mid);
      const treble = getFrequencyRangeValue(data, frequencyRange.treble);

      r = bass;
      g = mid;
      b = treble;
  }

  // Video
  if (particlesMesh) {
      // Set the mesh's color according to the frequency level
      particlesMesh.material.color.r = 1 - r;
      particlesMesh.material.color.g = 1 - g;
      particlesMesh.material.color.b = 1 - b;

      
      // @ts-ignore
      const useCache = parseInt(deltaTime) % 2 === 0;  // To reduce CPU usage.
      const imageData = getImageDataFromVideo(videoInput, useCache);
      const density = 2;

      for (let i = 0; i < particlesVertices.length / 3; i++) {

          let bounce = particlesMesh.geometry.attributes.position.getZ(i);
          if (i % density !== 0) {
              bounce = cameraFar;
              particlesMesh.geometry.attributes.position.setZ(i, bounce);
              continue;
          }

          // Set the z-position of a particle from its gray level
          let idxColor = i * 4;
          let grayScale = (imageData.data[idxColor] + imageData.data[idxColor + 1] + imageData.data[idxColor + 2]) / 3;
          const bouncingThreshold = 300;

          if (grayScale < bouncingThreshold) {
              if (grayScale < bouncingThreshold / 3) {
                  bounce = grayScale * r * 5;
              } else if (grayScale < bouncingThreshold / 2) {
                  bounce = grayScale * g * 5;
              } else {
                  bounce = grayScale * b * 5;
              }
          } else {
              bounce = cameraFar;
          }

          particlesMesh.geometry.attributes.position.setZ(i, bounce);
      }

      // After the first render
      particlesMesh.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(threeScene, camera);

  requestAnimationFrame(draw);
};

/**
 * Update the canvas size.
 */
const handleResize = (): void => {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(screenWidth, screenHeight);

  // @ts-ignore: https://threejs.org/docs/#api/en/cameras/PerspectiveCamera.aspect
  camera.aspect = screenWidth / screenHeight;
  // @ts-ignore: https://threejs.org/docs/#api/en/cameras/PerspectiveCamera.updateProjectionMatrix
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", handleResize);

window.addEventListener("load", initialize);
