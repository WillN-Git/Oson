import "./style.css";
import * as THREE from 'three';


let threeScene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera, clock: THREE.Clock;
let screenWidth: number, screenHeight: number;

let videoInput: HTMLVideoElement;
let particles: any;
let videoWidth: number, videoHeight: number, imageCache: ImageData;

// Canvas
const canvasElement = document.createElement("canvas");
const canvasContext = canvasElement.getContext("2d");

// Audio
let audioSource: THREE.Audio, audioAnalyser: THREE.AudioAnalyser;
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
  threeScene = new THREE.Scene(); // Create the Scene
  threeScene.background = new THREE.Color(0x111111);

  // Renderer
  renderer = new THREE.WebGLRenderer();
  document.getElementById("content")?.appendChild(renderer.domElement);

  // Clock
  clock = new THREE.Clock();

  initializeCamera();

  handleResize();

  // Check for media devices and get the user's media if available
  // @ts-ignore
  const mediaDevicesAvailable = navigator.mediaDevices || ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
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
 * Responsiable to create and play audio
 */
const initializeAudio = (): void => {
  const audioListener = new THREE.AudioListener();
  audioSource = new THREE.Audio(audioListener);
  const audioLoader = new THREE.AudioLoader();

  audioLoader.load('assets/demo9.mp3', (buffer: THREE.AudioBuffer) => {
    audioSource.setBuffer(buffer);
    audioSource.setLoop(true);
    audioSource.setVolume(0.5);
    audioSource.play();
  });

  audioAnalyser = new THREE.AudioAnalyser(audioSource, fftSize);
} 


/**
 * Responsible to create particles
 */
const createParticles = (): void => {
  const imageData = getImageData(videoInput);
  const geometry = new THREE.Geometry();
  // @ts-ignore
  geometry.morphAttributes = {}; // This is necessary to avoid error.

  const material = new THREE.PointsMaterial({
    size: 1,
    color: 0xff3b6c,
    sizeAttenuation: false
  });

  // console.log(imageData);
  
  for (let y=0; y < imageData.height; y++) {
    for (let x=0; x < imageData.width; x++) {
        const vertex = new THREE.Vector3(
            x - imageData.width / 2,
            -y + imageData.height / 2,
            0
        );
        geometry.vertices.push(vertex);
    }
  }

  particles = new THREE.Points(geometry, material);
  threeScene.add(particles);
}

const getImageData = (frame: HTMLVideoElement, useCache: boolean = true): ImageData => {
  if(useCache && imageCache) {
    return imageCache;
  }

  const width = frame.videoWidth;
  const height = frame.videoHeight;
  
  canvasElement.width = width;
  canvasElement.height = height;

  canvasContext?.translate(width, 0);
  canvasContext?.scale(-1, -1);
  
  canvasContext?.drawImage(frame, 0, 0);
  imageCache = canvasContext?.getImageData(0, 0, videoWidth, videoHeight) as ImageData;

  return imageCache;
}

const getFrequencyRangeValue = (data: Uint8Array, freqRange: number[]): number => {
  const nyquist = 48000 / 2;
  const lowIndex = Math.round(freqRange[0] / nyquist * data.length);
  const highIndex = Math.round(freqRange[1] / nyquist * data.length);
  let total = 0;
  let numFrequencies = 0;

  for (let i = lowIndex; i <= highIndex; i++) {
      total += data[i];
      numFrequencies += 1;
  }
  return (total / numFrequencies) / 255;
};

const draw = (t: any = null) => {
  clock.getDelta();
  // const time = clock.elapsedTime;

  let r = 0, g = 0, b = 0;

  // audio
  if (audioAnalyser) {
      // analyser.getFrequencyData() would be an array with a size of half of fftSize.
      const data = audioAnalyser.getFrequencyData();

      const bass = getFrequencyRangeValue(data, frequencyRange.bass);
      const mid = getFrequencyRangeValue(data, frequencyRange.mid);
      const treble = getFrequencyRangeValue(data, frequencyRange.treble);

      r = bass;
      g = mid;
      b = treble;
  }

  // video
  if (particles) {
      particles.material.color.r = 1 - r;
      particles.material.color.g = 1 - g;
      particles.material.color.b = 1 - b;

      const density = 2;
      const useCache = parseInt(t) % 2 === 0;  // To reduce CPU usage.
      const imageData = getImageData(videoInput, useCache);
      for (let i = 0; i < particles.geometry.vertices.length; i++) {
          const particle = particles.geometry.vertices[i];
          if (i % density !== 0) {
              particle.z = 10000;
              continue;
          }
          let index = i * 4;
          let gray = (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3;
          let threshold = 300;
          if (gray < threshold) {
              if (gray < threshold / 3) {
                  particle.z = gray * r * 5;

              } else if (gray < threshold / 2) {
                  particle.z = gray * g * 5;

              } else {
                  particle.z = gray * b * 5;
              }
          } else {
              particle.z = 10000;
          }
      }
      particles.geometry.verticesNeedUpdate = true;
  }

  renderer.render(threeScene, camera);

  requestAnimationFrame(draw);
};


const handleResize = (): void => {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(screenWidth, screenHeight);

  camera.aspect = screenWidth / screenHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", handleResize);

initialize();
