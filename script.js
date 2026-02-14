const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const overlay = document.getElementById('overlay');

const imgs = {
    surprise: document.getElementById('img-surprise'),
    stop: document.getElementById('img-stop'),
    wolf: document.getElementById('img-wolf'),
    middle: document.getElementById('img-middle'),
    like: document.getElementById('img-like')
};

let detector = null;

function hideAll() {
    Object.values(imgs).forEach(img => img.style.display = 'none');
}

function updatePos(id, x, y) {
    hideAll();
    const img = imgs[id];
    img.style.display = 'block';
    // Mobilde ve Masaüstünde doğru hizalama
    img.style.left = `${(1 - x) * window.innerWidth - (img.clientWidth / 2)}px`;
    img.style.top = `${y * window.innerHeight - (img.clientHeight + 40)}px`;
}

async function startMode(mode) {
    overlay.style.display = 'none';
    mode === 'HAND' ? initHands() : initFace();
}

function initHands() {
    detector = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    detector.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
            const h = results.multiHandLandmarks[0];
            const x = h[9].x; const y = h[9].y;

            const indexUp = h[8].y < h[6].y;
            const midUp = h[12].y < h[10].y;
            const ringUp = h[16].y < h[14].y;
            const pinkyUp = h[20].y < h[18].y;
            const thumbUp = h[4].y < h[3].y;

            // Hareket Kontrolleri
            if (indexUp && midUp && ringUp && pinkyUp) updatePos('stop', x, y);
            else if (indexUp && pinkyUp && !midUp && !ringUp) updatePos('wolf', x, y);
            else if (midUp && !indexUp && !ringUp) updatePos('middle', x, y);
            else if (thumbUp && !indexUp && !midUp) updatePos('like', x, y);
            else hideAll();

            drawConnectors(canvasCtx, h, HAND_CONNECTIONS, {color: '#00f2ff', lineWidth: 3});
        } else { hideAll(); }
    });
    startCam();
}

function initFace() {
    detector = new FaceMesh({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });

    detector.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const f = results.multiFaceLandmarks[0];
            const mouthDist = Math.abs(f[14].y - f[13].y);
            if (mouthDist > 0.08) updatePos('surprise', f[1].x, f[1].y);
            else hideAll();
            drawConnectors(canvasCtx, f, FACEMESH_CONTOURS, {color: '#ffffff22', lineWidth: 1});
        } else { hideAll(); }
    });
    startCam();
}

function startCam() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            await detector.send({image: videoElement});
        },
        // Mobilde 480x640 dikey, PC'de 1280x720 yatay
        width: isMobile ? 480 : 1280,
        height: isMobile ? 640 : 720
    });
    camera.start();
}