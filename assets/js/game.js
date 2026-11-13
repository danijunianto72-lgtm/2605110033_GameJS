const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 1. Pemuatan Aset
const loadImg = (src) => {
    const img = new Image();
    img.src = src;
    return img;
};

const loadFrames = (pathPrefix, count) => 
    Array.from({ length: count }, (_, i) => loadImg(`${pathPrefix}-${i + 1}.png`));

const assets = {
    bg: loadImg('assets/objects/background.png'),
    ground: loadImg('assets/objects/ground.png'),
    coin: loadImg('assets/objects/coin.png'),
    explosion: loadFrames('assets/objects/explosion', 5),
    flyEnemy: loadFrames('assets/enemys/flyEnemy', 6),
    animations: {
        idle: loadFrames('assets/characters/iddle', 7),
        jump: loadFrames('assets/characters/jump', 4),
        run: loadFrames('assets/characters/run', 8),
        down: [loadImg('assets/characters/down-1.png')]
    }
};

const isReady = (img) => img && img.complete && img.naturalWidth > 0;

// 2. Konfigurasi Dunia & Entitas
const TILE_SIZE = 240;
const GROUND_Y = 840;
const COIN_SIZE = 56;

let levelMap = [];
let coins = [];
let enemies = [];
let explosions = [];
let score = 0;
let lives = 3;
let nextCoinStartTile = 6;
let enemySpawnTimer = 0;


function spawnCoinPattern(startTile) {
    const count = 6;
    const spacing = 85;
    const coinY = GROUND_Y - 75;

    for (let i = 0; i < count; i++) {
        const coinX = (startTile * TILE_SIZE) + (i * spacing);

        coins.push({
            x: coinX,
            y: coinY,
            collected: false
        });
    }

    return 3;
}


function generateChunks(targetCount) {
    while (levelMap.length < targetCount) {
        if (levelMap.length < 10) {
            levelMap.push(1);
        } else {
            const prevTile = levelMap[levelMap.length - 1];
            const nextTile = (prevTile === 0) ? 1 : (Math.random() < 0.25 ? 0 : 1);
            levelMap.push(nextTile);
        }

        if (levelMap.length >= nextCoinStartTile) {
            const spanTiles = spawnCoinPattern(nextCoinStartTile);
            nextCoinStartTile += spanTiles + 2;
        }
    }
}

// 3. State Pemain & Kamera
let cameraX = 0;
const player = {
    x: 200,
    y: 400,
    w: 172,          // Diperbesar dari 128 (tetap rasio 4:5)
    h: 215,          // Diperbesar dari 160
    feetOffset: 24,
    vx: 0,
    vy: 0,
    speed: 10,
    jumpForce: -25,
    gravity: 1.1,
    grounded: false,
    wasGrounded: false,
    facingRight: true,
    state: 'idle',
    stateTimer: 0,
    invulnTimer: 0, // Waktu kebal sesaat setelah terkena musuh
    frameIndex: 0,
    frameTimer: 0,
    frameInterval: 5
};

function resetGame() {
    levelMap = [];
    coins = [];
    enemies = [];
    explosions = [];
    score = 0;
    lives = 3;
    nextCoinStartTile = 6;
    enemySpawnTimer = 90;
    generateChunks(25);
    player.x = 200;
    player.y = 400;
    player.vx = 0;
    player.vy = 0;
    player.invulnTimer = 0;
    cameraX = 0;
}

resetGame();

// 4. Input Keyboard
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Helper menggambar ikon hati vektor
function drawHeart(x, y, size, filled) {
    ctx.save();
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 1.4, x, y + size);
    ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 1.4, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
    ctx.closePath();
    ctx.fillStyle = filled ? '#e74c3c' : 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
}

// 5. Logika Update & Fisika
function update() {
    player.wasGrounded = player.grounded;
    if (player.invulnTimer > 0) player.invulnTimer--;

    // Status jongkok (hanya aktif saat menapak tanah dan tidak sedang ancang-ancang lompat)
    const isCrouching = (keys['ArrowDown'] || keys['KeyS']) && player.grounded && player.state !== 'jump_prep';

    // Pergerakan Horizontal
    player.vx = 0;
    if (!isCrouching) {
        if (keys['ArrowRight'] || keys['KeyD']) {
            player.vx = player.speed;
            player.facingRight = true;
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            player.vx = -player.speed;
            player.facingRight = false;
        }
    } else {
        // Izinkan berbalik arah hadap saat jongkok
        if (keys['ArrowRight'] || keys['KeyD']) player.facingRight = true;
        if (keys['ArrowLeft'] || keys['KeyA']) player.facingRight = false;
    }

    // Trigger Lompat (Hanya bisa lompat jika tidak sedang jongkok)
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && player.grounded && !isCrouching && player.state !== 'jump_prep') {
        player.state = 'jump_prep';
        player.stateTimer = 0;
    }

    if (player.state === 'jump_prep') {
        player.stateTimer++;
        if (player.stateTimer >= 6) {
            player.vy = player.jumpForce;
            player.grounded = false;
            player.state = 'jump';
        }
    }

    player.vy += player.gravity;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < cameraX) player.x = cameraX;

    // Deteksi Pijakan Tanah
    const centerFootX = player.x + player.w / 2;
    const tileIndex = Math.floor(centerFootX / TILE_SIZE);
    const hasGroundBelow = levelMap[tileIndex] === 1;

    if (hasGroundBelow && player.y + player.h >= GROUND_Y && player.y + player.h <= GROUND_Y + player.vy + 25 && player.vy >= 0) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.grounded = true;
    } else {
        player.grounded = false;
    }

    // Hitbox Dinamis Pemain (Memendek 45% dari atas saat jongkok)
    const hitMargin = 20;
    const crouchOffset = isCrouching ? player.h * 0.45 : 0;
    const hitTop = player.y + hitMargin + crouchOffset;
    const hitBottom = player.y + player.h - hitMargin;
    const hitLeft = player.x + hitMargin;
    const hitRight = player.x + player.w - hitMargin;

    // Deteksi Pengambilan Koin
    for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (!c.collected &&
            hitLeft < c.x + COIN_SIZE &&
            hitRight > c.x &&
            hitTop < c.y + COIN_SIZE &&
            hitBottom > c.y) {
            c.collected = true;
            score += 10;
        }
    }
    if (coins.length > 0 && coins[0].x < cameraX - 200) coins.shift();

    // Spawning & Update Musuh Burung (Terbang lurus dari kanan ke kiri)
    enemySpawnTimer--;
    if (enemySpawnTimer <= 0) {
        // Ketinggian terbang burung (bawah untuk dilompati, tengah/atas untuk dijongkoki)
        const flyHeights = [GROUND_Y - 155, GROUND_Y - 265];
        const randomY = flyHeights[Math.floor(Math.random() * flyHeights.length)];
        enemies.push({
            x: cameraX + canvas.width + 100,
            y: randomY,
            w: 185,
            h: 155,
            speed: 7 + Math.random() * 3,
            frameIndex: 0,
            frameTimer: 0
        });
        enemySpawnTimer = 110 + Math.floor(Math.random() * 80);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= e.speed;

        // Animasi kepak sayap burung (6 frame)
        e.frameTimer++;
        if (e.frameTimer >= 4) {
            e.frameTimer = 0;
            e.frameIndex = (e.frameIndex + 1) % assets.flyEnemy.length;
        }

        // Cek Tabrakan dengan Hitbox Dinamis Pemain
        const eMargin = 22;
        const isColliding = 
            hitLeft < e.x + e.w - eMargin &&
            hitRight > e.x + eMargin &&
            hitTop < e.y + e.h - eMargin &&
            hitBottom > e.y + eMargin;

        if (isColliding) {
            explosions.push({
                x: e.x + e.w / 2 - 80,
                y: e.y + e.h / 2 - 80,
                size: 160,
                frameIndex: 0,
                frameTimer: 0
            });
            enemies.splice(i, 1);

            if (player.invulnTimer <= 0) {
                lives--;
                player.invulnTimer = 50;
                if (lives <= 0) {
                    resetGame();
                    return;
                }
            }
            continue;
        }

        if (e.x + e.w < cameraX - 200) {
            enemies.splice(i, 1);
        }
    }

    // Update Animasi Ledakan (eksplosion-1 sampai 5 lalu hilang)
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.frameTimer++;
        if (exp.frameTimer >= 4) {
            exp.frameTimer = 0;
            exp.frameIndex++;
            if (exp.frameIndex >= assets.explosion.length) {
                explosions.splice(i, 1);
            }
        }
    }

    if (!player.wasGrounded && player.grounded) {
        player.state = 'land';
        player.stateTimer = 7;
    }

    if (player.y > canvas.height) {
        resetGame();
        return;
    }

    if (player.x - cameraX > canvas.width * 0.35) {
        cameraX = player.x - canvas.width * 0.35;
    }

    const neededTiles = Math.ceil((cameraX + canvas.width) / TILE_SIZE) + 8;
    generateChunks(neededTiles);

    // Manajemen State & Frame Animasi Karakter
    const prevState = player.state;
    if (player.state === 'jump_prep') {
        player.frameIndex = player.stateTimer < 3 ? 0 : 1;
    } else if (!player.grounded) {
        player.state = 'jump';
        player.frameIndex = 2;
    } else if (isCrouching) {
        player.state = 'down';
        player.frameIndex = 0;
    } else if (player.state === 'land') {
        player.frameIndex = 3;
        player.stateTimer--;
        if (player.stateTimer <= 0) {
            player.state = player.vx !== 0 ? 'run' : 'idle';
        }
    } else {
        player.state = player.vx !== 0 ? 'run' : 'idle';
        if (prevState !== player.state) {
            player.frameIndex = 0;
            player.frameTimer = 0;
        }
        player.frameTimer++;
        if (player.frameTimer >= player.frameInterval) {
            player.frameTimer = 0;
            player.frameIndex = (player.frameIndex + 1) % assets.animations[player.state].length;
        }
    }
}

// 6. Render Grafis
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // A. Background Parallax & Mirror Looping
    if (isReady(assets.bg)) {
        const bgParallax = cameraX * 0.5;
        const startBgIndex = Math.floor(bgParallax / canvas.width);

        for (let i = startBgIndex; i <= startBgIndex + 1; i++) {
            const drawX = (i * canvas.width) - bgParallax;
            ctx.save();
            if (Math.abs(i) % 2 === 1) {
                ctx.translate(drawX + canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(assets.bg, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.drawImage(assets.bg, drawX, 0, canvas.width, canvas.height);
            }
            ctx.restore();
        }
    }

    // B. Render Dunia
    ctx.save();
    ctx.translate(-cameraX, 0);

    const startTile = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endTile = Math.ceil((cameraX + canvas.width) / TILE_SIZE);

    for (let i = startTile; i <= endTile; i++) {
        if (levelMap[i] === 1 && isReady(assets.ground)) {
            ctx.drawImage(assets.ground, i * TILE_SIZE, GROUND_Y, TILE_SIZE, TILE_SIZE);
        }
    }

    // Gambar Koin (Rotasi 0 - 360 derajat)
    const spinAngle = (Date.now() * 0.005) % (Math.PI * 2);
    const spinScaleX = Math.cos(spinAngle);

    for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (!c.collected && c.x + COIN_SIZE >= cameraX && c.x <= cameraX + canvas.width) {
            if (isReady(assets.coin)) {
                ctx.save();
                ctx.translate(c.x + COIN_SIZE / 2, c.y + COIN_SIZE / 2);
                ctx.scale(spinScaleX, 1);
                ctx.drawImage(assets.coin, -COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
                ctx.restore();
            }
        }
    }

    // Gambar Musuh Burung
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const enemySprite = assets.flyEnemy[e.frameIndex];
        if (isReady(enemySprite)) {
            ctx.drawImage(enemySprite, e.x, e.y, e.w, e.h);
        }
    }

    // Gambar Karakter (Efek berkedip transparan saat kebal setelah hit)
    const animKey = (player.state === 'jump_prep' || player.state === 'land') ? 'jump' : player.state;
    const currentSprite = assets.animations[animKey][player.frameIndex];

    if (isReady(currentSprite)) {
        ctx.save();
        if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }
        const renderY = player.y + player.feetOffset;
        if (!player.facingRight) {
            ctx.translate(player.x + player.w, renderY);
            ctx.scale(-1, 1);
            ctx.drawImage(currentSprite, 0, 0, player.w, player.h);
        } else {
            ctx.drawImage(currentSprite, player.x, renderY, player.w, player.h);
        }
        ctx.restore();
    }

    // Gambar Efek Ledakan
    for (let i = 0; i < explosions.length; i++) {
        const exp = explosions[i];
        const expSprite = assets.explosion[exp.frameIndex];
        if (isReady(expSprite)) {
            ctx.drawImage(expSprite, exp.x, exp.y, exp.size, exp.size);
        }
    }

    ctx.restore();

    // C. HUD Skor & Stok 3 Hati
    ctx.save();
    if (isReady(assets.coin)) {
        ctx.drawImage(assets.coin, 40, 36, 48, 48);
    }
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 6;
    ctx.strokeText(score, 102, 74);
    ctx.fillText(score, 102, 74);

    for (let i = 0; i < 3; i++) {
        drawHeart(64 + i * 56, 105, 42, i < lives);
    }
    ctx.restore();
}

// 7. Game Loop Utama
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();