const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const overlay = document.getElementById('overlay');

const imgs = {
    special: document.getElementById('img-special'),
    surprise: document.getElementById('img-surprise'),
    stop: document.getElementById('img-stop'),
    wolf: document.getElementById('img-wolf'),
    middle: document.getElementById('img-middle'),
    like: document.getElementById('img-like')
};

let detector = null;
let lastPos = { x: 0.5, y: 0.5 };

function hideAll() { Object.values(imgs).forEach(img => img.style.display = 'none'); }

function updatePos(id, x, y) {
    lastPos.x = lastPos.x + (x - lastPos.x) * 0.3;
    lastPos.y = lastPos.y + (y - lastPos.y) * 0.3;
    const img = imgs[id];
    img.style.display = 'block';
    img.style.left = `${(1 - lastPos.x) * window.innerWidth - (img.clientWidth / 2)}px`;
    img.style.top = `${lastPos.y * window.innerHeight - (img.clientHeight + 50)}px`;
}

// Buton dinleyicilerini JS içinden ekleyelim (Daha garanti bir yöntem)
document.getElementById('hand-btn').addEventListener('click', () => startMode('HAND'));
document.getElementById('face-btn').addEventListener('click', () => startMode('FACE'));

async function startMode(mode) {
    overlay.style.display = 'none';
    if (mode === 'HAND') {
        initHands();
    } else {
        initFace();
    }
}

function initHands() {
    detector = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    detector.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7 });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        hideAll();
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            let specialCount = 0;
            let centerX = 0, centerY = 0;

            results.multiHandLandmarks.forEach((h) => {
                const indexUp = h[8].y < h[6].y;
                const midUp = h[12].y < h[10].y;
                const ringUp = h[16].y < h[14].y;
                const pinkyUp = h[20].y < h[18].y;

                // Çift El Özel Hareket: Sadece işaret parmağı havada
                if (indexUp && !midUp && !ringUp && !pinkyUp) specialCount++;

                centerX += h[9].x; centerY += h[9].y;

                // Tek el hareketleri
                if (results.multiHandLandmarks.length === 1) {
                    if (indexUp && midUp && ringUp && pinkyUp) updatePos('stop', h[9].x, h[9].y);
                    else if (indexUp && pinkyUp && !midUp && !ringUp) updatePos('wolf', h[9].x, h[9].y);
                    else if (midUp && !indexUp && !ringUp && !pinkyUp) updatePos('middle', h[9].x, h[9].y);
                    else if (h[4].y < h[3].y && !indexUp && !midUp) updatePos('like', h[9].x, h[9].y);
                }
                
                drawConnectors(canvasCtx, h, HAND_CONNECTIONS, {color: '#00f2ff', lineWidth: 4});
            });

            // 2 el de işaret parmağıysa Özel Görsel
            if (specialCount === 2) {
                updatePos('special', centerX / 2, centerY / 2);
            }
        }
    });
    startCam();
}

function initFace() {
    detector = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    detector.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.6 });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const f = results.multiFaceLandmarks[0];
            drawConnectors(canvasCtx, f, FACEMESH_CONTOURS, {color: '#00f2ff', lineWidth: 1.5});
            
            const mouthDist = Math.abs(f[14].y - f[13].y);
            if (mouthDist > 0.08) updatePos('surprise', f[1].x, f[1].y);
            else hideAll();
        } else { hideAll(); }
    });
    startCam();
}

function startCam() {
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            if (detector) await detector.send({image: videoElement});
        },
        width: 1280, height: 720
    });
    camera.start();
}