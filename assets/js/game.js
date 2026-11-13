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
    birdPet: loadFrames('assets/characters/bird', 7),
    animations: {
        idle: loadFrames('assets/characters/iddle', 7),
        jump: loadFrames('assets/characters/jump', 4),
        run: loadFrames('assets/characters/run', 8),
        down: [loadImg('assets/characters/down-1.png')],
        fly: loadFrames('assets/characters/fly', 6)
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

// 3. State Pemain, Pet Bird & Kamera
let cameraX = 0;
const player = {
    x: 200,
    y: 400,
    w: 172,
    h: 215,
    flyW: 250,       // Dimensi proporsional saat menunggangi burung (4:3)
    flyH: 190,
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
    invulnTimer: 0,
    isFlying: false,
    flyCooldown: 0,  // Cooldown jika tertabrak saat terbang
    frameIndex: 0,
    frameTimer: 0,
    frameInterval: 5
};

const petBird = {
    unlocked: false,
    x: 100,
    y: 300,
    w: 135,
    h: 100,
    facingRight: true,
    frameIndex: 0,
    frameTimer: 0
};

function spawnExplosion(centerX, centerY, size = 180) {
    explosions.push({
        x: centerX - size / 2,
        y: centerY - size / 2,
        size: size,
        frameIndex: 0,
        frameTimer: 0
    });
}

function toggleFlyMode() {
    if (!petBird.unlocked || player.flyCooldown > 0) return;

    const currentW = player.isFlying ? player.flyW : player.w;
    const currentH = player.isFlying ? player.flyH : player.h;
    spawnExplosion(player.x + currentW / 2, player.y + currentH / 2, 200);

    if (!player.isFlying) {
        // Aktifkan Mode Terbang & angkat posisi ke atas
        player.isFlying = true;
        player.grounded = false;
        player.vy = 0;
        player.y = Math.max(120, player.y - 160);
        player.state = 'fly';
        player.frameIndex = 0;
    } else {
        // Nonaktifkan Mode Terbang & kembalikan pet di posisi Deidara
        player.isFlying = false;
        player.vy = 0;
        player.state = 'jump';
        petBird.x = player.x - 80;
        petBird.y = player.y - 40;
    }
}

function resetGame() {
    levelMap = [];
    coins = [];
    enemies = [];
    explosions = [];
    score = 0;
    lives = 3;
    nextCoinStartTile = 6;
    enemySpawnTimer = 45;
    generateChunks(25);
    
    player.x = 200;
    player.y = 400;
    player.vx = 0;
    player.vy = 0;
    player.invulnTimer = 0;
    player.isFlying = false;
    player.flyCooldown = 0;
    
    petBird.unlocked = false;
    cameraX = 0;
}

resetGame();

// 4. Input Keyboard (Panah untuk gerak, D untuk toggle terbang)
const keys = {};
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyD' && !e.repeat) {
        toggleFlyMode();
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Helper ikon hati
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
    if (player.flyCooldown > 0) player.flyCooldown--;

    // Buka Pet Bird saat skor mencapai 500
    if (score >= 500 && !petBird.unlocked) {
        petBird.unlocked = true;
        petBird.x = player.x - 100;
        petBird.y = player.y - 60;
        spawnExplosion(petBird.x + petBird.w / 2, petBird.y + petBird.h / 2, 140);
    }

    // --- LOGIKA PERGERAKAN: MODE TERBANG VS MODE DARAT ---
    if (player.isFlying) {
        player.vx = 0;
        player.vy = 0;
        const flySpeed = 11;

        if (keys['ArrowRight']) { player.vx = flySpeed; player.facingRight = true; }
        if (keys['ArrowLeft'])  { player.vx = -flySpeed; player.facingRight = false; }
        if (keys['ArrowUp'])    { player.vy = -flySpeed; }
        if (keys['ArrowDown'])  { player.vy = flySpeed; }

        player.x += player.vx;
        player.y += player.vy;

        // Batasi area terbang agar tidak keluar layar atas atau menembus tanah
        if (player.y < 30) player.y = 30;
        if (player.y + player.flyH > GROUND_Y) player.y = GROUND_Y - player.flyH;
        if (player.x < cameraX) player.x = cameraX;

        player.grounded = false;
        player.state = 'fly';
        player.frameTimer++;
        if (player.frameTimer >= 5) {
            player.frameTimer = 0;
            player.frameIndex = (player.frameIndex + 1) % assets.animations.fly.length;
        }
    } else {
        const isCrouching = (keys['ArrowDown'] || keys['KeyS']) && player.grounded && player.state !== 'jump_prep';

        player.vx = 0;
        if (!isCrouching) {
            if (keys['ArrowRight']) { player.vx = player.speed; player.facingRight = true; }
            if (keys['ArrowLeft'])  { player.vx = -player.speed; player.facingRight = false; }
        } else {
            if (keys['ArrowRight']) player.facingRight = true;
            if (keys['ArrowLeft'])  player.facingRight = false;
        }

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

        if (!player.wasGrounded && player.grounded) {
            player.state = 'land';
            player.stateTimer = 7;
        }

        if (player.y > canvas.height) {
            resetGame();
            return;
        }

        // Manajemen Animasi Darat
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

    // Update Pet Bird (Mengikuti di belakang atas saat Deidara di darat)
    if (petBird.unlocked && !player.isFlying) {
        const targetX = player.facingRight ? player.x - 110 : player.x + player.w - 25;
        const targetY = player.y - 50 + Math.sin(Date.now() * 0.006) * 12;
        petBird.x += (targetX - petBird.x) * 0.08;
        petBird.y += (targetY - petBird.y) * 0.08;
        petBird.facingRight = player.facingRight;

        petBird.frameTimer++;
        if (petBird.frameTimer >= 4) {
            petBird.frameTimer = 0;
            petBird.frameIndex = (petBird.frameIndex + 1) % assets.birdPet.length;
        }
    }

    // Hitbox Dinamis Pemain
    const activeW = player.isFlying ? player.flyW : player.w;
    const activeH = player.isFlying ? player.flyH : player.h;
    const isCrouching = !player.isFlying && (keys['ArrowDown'] || keys['KeyS']) && player.grounded;
    
    const hitMargin = 22;
    const crouchOffset = isCrouching ? activeH * 0.45 : 0;
    const hitTop = player.y + hitMargin + crouchOffset;
    const hitBottom = player.y + activeH - hitMargin;
    const hitLeft = player.x + hitMargin;
    const hitRight = player.x + activeW - hitMargin;

    // Deteksi Pengambilan Koin
    for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (!c.collected &&
            hitLeft < c.x + COIN_SIZE &&
            hitRight > c.x &&
            hitTop < c.y + COIN_SIZE &&
            hitBottom > c.y) {
            c.collected = true;
            score += 100;
        }
    }
    if (coins.length > 0 && coins[0].x < cameraX - 200) coins.shift();

    // Spawning Musuh Burung (Ditambah jalur udara atas saat Deidara terbang)
    enemySpawnTimer--;
    if (enemySpawnTimer <= 0) {
        const flyHeights = player.isFlying 
            ? [GROUND_Y - 160, GROUND_Y - 340, GROUND_Y - 520, GROUND_Y - 680]
            : [GROUND_Y - 155, GROUND_Y - 265];
        const randomY = flyHeights[Math.floor(Math.random() * flyHeights.length)];
        enemies.push({
            x: cameraX + canvas.width + 100,
            y: randomY,
            w: 195,
            h: 145,
            speed: 7.5 + Math.random() * 4,
            frameIndex: 0,
            frameTimer: 0
        });
        enemySpawnTimer = player.isFlying 
            ? 75 + Math.floor(Math.random() * 10) // Sedikit lebih sering saat di udara
            : 110 + Math.floor(Math.random() * 50);
    }

    // Update Musuh & Cek Tabrakan
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= e.speed;

        e.frameTimer++;
        if (e.frameTimer >= 4) {
            e.frameTimer = 0;
            e.frameIndex = (e.frameIndex + 1) % assets.flyEnemy.length;
        }

        const eMargin = 22;
        const isColliding = 
            hitLeft < e.x + e.w - eMargin &&
            hitRight > e.x + eMargin &&
            hitTop < e.y + e.h - eMargin &&
            hitBottom > e.y + eMargin;

        if (isColliding) {
            spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, 180);
            enemies.splice(i, 1);

            if (player.invulnTimer <= 0) {
                lives--;
                player.invulnTimer = 50;

                // Jika tertabrak saat mode terbang: jatuh ke tanah & cooldown terbang
                if (player.isFlying) {
                    player.isFlying = false;
                    player.flyCooldown = 300; // ~5 detik tidak bisa terbang
                    player.vy = 2;
                    player.state = 'jump';
                    petBird.x = player.x - 80;
                    petBird.y = player.y - 40;
                }

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

    // Update Animasi Ledakan
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

    if (player.x - cameraX > canvas.width * 0.35) {
        cameraX = player.x - canvas.width * 0.35;
    }

    const neededTiles = Math.ceil((cameraX + canvas.width) / TILE_SIZE) + 8;
    generateChunks(neededTiles);
}

// 6. Render Grafis
// 6. Render Grafis (Dioptimalkan untuk 60 FPS stabil)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // A. Background Parallax & Mirror Looping
    if (isReady(assets.bg)) {
        const bgParallax = cameraX * 0.5;
        const startBgIndex = Math.floor(bgParallax / canvas.width);

        for (let i = startBgIndex; i <= startBgIndex + 1; i++) {
            const drawX = (i * canvas.width) - bgParallax;
            if (Math.abs(i) % 2 === 1) {
                ctx.save();
                ctx.translate(drawX + canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(assets.bg, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            } else {
                ctx.drawImage(assets.bg, drawX, 0, canvas.width, canvas.height);
            }
        }
    }

    // B. Render Dunia
    ctx.save();
    ctx.translate(-cameraX, 0);

    const startTile = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endTile = Math.ceil((cameraX + canvas.width) / TILE_SIZE);

    if (isReady(assets.ground)) {
        for (let i = startTile; i <= endTile; i++) {
            if (levelMap[i] === 1) {
                ctx.drawImage(assets.ground, i * TILE_SIZE, GROUND_Y, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Gambar Koin
    if (isReady(assets.coin)) {
        const spinScaleX = Math.cos((Date.now() * 0.005) % (Math.PI * 2));
        for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            if (!c.collected && c.x + COIN_SIZE >= cameraX && c.x <= cameraX + canvas.width) {
                ctx.save();
                ctx.translate(c.x + COIN_SIZE / 2, c.y + COIN_SIZE / 2);
                ctx.scale(spinScaleX, 1);
                ctx.drawImage(assets.coin, -COIN_SIZE / 2, -COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
                ctx.restore();
            }
        }
    }

    // Gambar Pet Bird
    if (petBird.unlocked && !player.isFlying) {
        const birdSprite = assets.birdPet[petBird.frameIndex];
        if (isReady(birdSprite)) {
            ctx.save();
            if (player.flyCooldown > 0) ctx.globalAlpha = 0.55;
            if (!petBird.facingRight) {
                ctx.translate(petBird.x + petBird.w, petBird.y);
                ctx.scale(-1, 1);
                ctx.drawImage(birdSprite, 0, 0, petBird.w, petBird.h);
            } else {
                ctx.drawImage(birdSprite, petBird.x, petBird.y, petBird.w, petBird.h);
            }
            ctx.restore();
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

    // Gambar Karakter
    const animKey = (player.state === 'jump_prep' || player.state === 'land') ? 'jump' : player.state;
    const currentSprite = assets.animations[animKey][player.frameIndex];

    if (isReady(currentSprite)) {
        ctx.save();
        if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }
        const drawW = player.isFlying ? player.flyW : player.w;
        const drawH = player.isFlying ? player.flyH : player.h;
        const renderY = player.isFlying ? player.y : player.y + player.feetOffset;

        if (!player.facingRight) {
            ctx.translate(player.x + drawW, renderY);
            ctx.scale(-1, 1);
            ctx.drawImage(currentSprite, 0, 0, drawW, drawH);
        } else {
            ctx.drawImage(currentSprite, player.x, renderY, drawW, drawH);
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

    // C. HUD Ringan (Tanpa strokeText yang berat)
    if (isReady(assets.coin)) {
        ctx.drawImage(assets.coin, 40, 36, 48, 48);
    }
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(score, 105, 77); // Bayangan sederhana
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, 102, 74);

    for (let i = 0; i < 3; i++) {
        drawHeart(64 + i * 56, 105, 42, i < lives);
    }

    if (petBird.unlocked) {
        ctx.font = 'bold 26px sans-serif';
        if (player.flyCooldown > 0) {
            const sec = Math.ceil(player.flyCooldown / 60);
            ctx.fillStyle = '#f39c12';
            ctx.fillText(`BIRD COOLDOWN: ${sec}s`, 40, 195);
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(player.isFlying ? '[D] TURUN' : '[D] TERBANG READY', 40, 195);
        }
    }
}

// 7. Game Loop Utama
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();