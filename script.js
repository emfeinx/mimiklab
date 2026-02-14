const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const overlay = document.getElementById('overlay');

const imgs = {
    salute: document.getElementById('img-salute'),
    heart: document.getElementById('img-heart'),
    special: document.getElementById('img-special'),
    surprise: document.getElementById('img-surprise'),
    stop: document.getElementById('img-stop'),
    wolf: document.getElementById('img-wolf'),
    middle: document.getElementById('img-middle'),
    like: document.getElementById('img-like')
};

let hands = null;
let faceMesh = null;
let lastPos = { x: 0.5, y: 0.5 };
let currentFaceLandmarks = null; // Yüz verisini burada saklayacağız

function hideAll() { Object.values(imgs).forEach(img => img.style.display = 'none'); }

function updatePos(id, x, y) {
    lastPos.x = lastPos.x + (x - lastPos.x) * 0.3;
    lastPos.y = lastPos.y + (y - lastPos.y) * 0.3;
    const img = imgs[id];
    img.style.display = 'block';
    img.style.left = `${(1 - lastPos.x) * window.innerWidth - (img.clientWidth / 2)}px`;
    img.style.top = `${lastPos.y * window.innerHeight - (img.clientHeight + 50)}px`;
}

function getDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Buton Etkinleştirme
document.getElementById('hand-btn').addEventListener('click', () => startApp());
document.getElementById('face-btn').addEventListener('click', () => startApp());

async function startApp() {
    overlay.style.display = 'none';
    initModels();
}

function initModels() {
    // YÜZ MODELİ (Arka planda hep çalışacak)
    faceMesh = new FaceMesh({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5 });
    faceMesh.onResults(results => {
        if (results.multiFaceLandmarks) {
            currentFaceLandmarks = results.multiFaceLandmarks[0];
            // Yüz iskeletini çiz
            canvasCtx.save();
            drawConnectors(canvasCtx, currentFaceLandmarks, FACEMESH_CONTOURS, {color: '#00f2ff33', lineWidth: 1});
            canvasCtx.restore();
        }
    });

    // EL MODELİ
    hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7 });
    hands.onResults(results => {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        hideAll();

        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((h, index) => {
                const indexTip = h[8];
                let isSaluting = false;

                // --- ASKER SELAMI KONTROLÜ (YÜZ VE EL ÇAKIŞMASI) ---
                if (currentFaceLandmarks) {
                    const forehead = currentFaceLandmarks[10]; // Alın noktası
                    const distToForehead = getDist(indexTip, forehead);

                    // Eğer parmak ucu alna çok yakınsa ve el yatay duruyorsa
                    if (distToForehead < 0.12) {
                        updatePos('salute', forehead.x, forehead.y);
                        isSaluting = true;
                    }
                }

                if (!isSaluting) {
                    // Diğer jestler (Kalp, Stop vs. önceki kodla aynı)
                    const indexUp = h[8].y < h[6].y;
                    const midUp = h[12].y < h[10].y;
                    const ringUp = h[16].y < h[14].y;
                    const pinkyUp = h[20].y < h[18].y;

                    if (indexUp && midUp && ringUp && pinkyUp) updatePos('stop', h[9].x, h[9].y);
                    else if (indexUp && pinkyUp && !midUp) updatePos('wolf', h[9].x, h[9].y);
                    else if (midUp && !indexUp && !ringUp) updatePos('middle', h[9].x, h[9].y);
                    else if (h[4].y < h[3].y && !indexUp) updatePos('like', h[9].x, h[9].y);
                }

                drawConnectors(canvasCtx, h, HAND_CONNECTIONS, {color: '#00f2ff', lineWidth: 3});
            });
        }
    });

    startCam();
}

function startCam() {
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            // İki modeli de aynı karede çalıştır
            await faceMesh.send({image: videoElement});
            await hands.send({image: videoElement});
        },
        width: 1280, height: 720
    });
    camera.start();
}