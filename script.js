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
let lastPos = { x: 0.5, y: 0.5 }; // Bug önleyici: Son konumu tutar
const lerpFactor = 0.3; // Yumuşatma çarpanı (0.1 çok yavaş, 0.9 çok hızlı)

function hideAll() {
    Object.values(imgs).forEach(img => img.style.display = 'none');
}

function updatePos(id, x, y) {
    // Bug önleme: Yeni konumu eski konumla harmanla (Lerp)
    lastPos.x = lastPos.x + (x - lastPos.x) * lerpFactor;
    lastPos.y = lastPos.y + (y - lastPos.y) * lerpFactor;

    const img = imgs[id];
    img.style.display = 'block';
    img.style.left = `${(1 - lastPos.x) * window.innerWidth - (img.clientWidth / 2)}px`;
    img.style.top = `${lastPos.y * window.innerHeight - (img.clientHeight + 40)}px`;
}

async function startMode(mode) {
    overlay.style.display = 'none';
    mode === 'HAND' ? initHands() : initFace();
}

// --- YÜZ MODU (BUG FİLTRELİ) ---
function initFace() {
    detector = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    
    detector.setOptions({ 
        maxNumFaces: 1, 
        refineLandmarks: true, 
        minDetectionConfidence: 0.6, // Güven eşiği artırıldı
        minTrackingConfidence: 0.6 
    });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            const f = results.multiFaceLandmarks[0];

            // Çizim Ayarları
            drawConnectors(canvasCtx, f, FACEMESH_TESSELATION, {color: '#00f2ff22', lineWidth: 0.5});
            drawConnectors(canvasCtx, f, FACEMESH_CONTOURS, {color: '#00f2ff', lineWidth: 1.5});

            // Ağız Kontrolü
            const mouthDist = Math.abs(f[14].y - f[13].y);
            if (mouthDist > 0.1) {
                updatePos('surprise', f[1].x, f[1].y);
            } else {
                hideAll();
            }
        } else {
            hideAll();
        }
    });
    startCam();
}

// --- EL MODU ---
function initHands() {
    detector = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    detector.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });

    detector.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
            const h = results.multiHandLandmarks[0];
            const x = h[9].x; const y = h[9].y;

            // Parmak Kontrolleri
            const indexUp = h[8].y < h[6].y;
            const midUp = h[12].y < h[10].y;
            const ringUp = h[16].y < h[14].y;
            const pinkyUp = h[20].y < h[18].y;
            const thumbUp = h[4].y < h[3].y;

            if (indexUp && midUp && ringUp && pinkyUp) updatePos('stop', x, y);
            else if (indexUp && pinkyUp && !midUp && !ringUp) updatePos('wolf', x, y);
            else if (midUp && !indexUp && !ringUp) updatePos('middle', x, y);
            else if (thumbUp && !indexUp && !midUp) updatePos('like', x, y);
            else hideAll();

            drawConnectors(canvasCtx, h, HAND_CONNECTIONS, {color: '#00f2ff', lineWidth: 4});
        } else { hideAll(); }
    });
    startCam();
}

function startCam() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    new Camera(videoElement, {
        onFrame: async () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            await detector.send({image: videoElement});
        },
        width: isMobile ? 480 : 1280,
        height: isMobile ? 640 : 720
    }).start();
}