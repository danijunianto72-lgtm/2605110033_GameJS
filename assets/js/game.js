const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'medium';

// 1. Pemuatan Aset Dunia & Karakter
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
    bullet: loadFrames('assets/objects/bullet', 2),
    explosion: loadFrames('assets/objects/explosion', 5),
    flyEnemy: loadFrames('assets/enemys/flyEnemy', 6),
    birdPet: loadFrames('assets/characters/bird', 7),
    animations: {
        idle: loadFrames('assets/characters/iddle', 7),
        jump: loadFrames('assets/characters/jump', 4),
        run: loadFrames('assets/characters/run', 8),
        down: [loadImg('assets/characters/down-1.png')],
        fly: loadFrames('assets/characters/fly', 6),
        attack: loadFrames('assets/characters/attack', 2),
        skill1: [loadImg('assets/characters/skill-1.png')]
    }
};

const isReady = (img) => img && img.complete && img.naturalWidth > 0;

// 2. Konfigurasi Dunia & Entitas
const TILE_SIZE = 240;
const GROUND_Y = 840;
const COIN_SIZE = 56;

let ultCutin = { active: false, timer: 0, maxTimer: 95, played: false };
// Tambahkan di bagian deklarasi variabel global (sekitar baris 42)
let warningMsg = { text: '', timer: 0 };

function showWarning(text) {
    warningMsg.text = text;
    warningMsg.timer = 30; // Tampil sekitar 1.8 detik
}
let levelMap = [];
let coins = [];
let enemies = [];
let bullets = [];
let explosions = [];
let score = 0;
let lives = 3;
let isPaused = false;
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
    w: 200,
    h: 250,
    flyW: 250,
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
    flyCooldown: 0,
    shootCooldown: 0,
    skill1Cooldown: 0,
    actionTimer: 0,
    actionType: null,
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

function togglePause() {
    isPaused = !isPaused;
}
function activateBirdMount() {
    spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, 220);
    player.isFlying = true;
    player.grounded = false;
    player.actionType = null;
    player.vy = 0;
    player.y = Math.max(120, player.y - 160);
    player.state = 'fly';
    player.frameIndex = 0;
} 
function toggleFlyMode() {
    if (isPaused || ultCutin.active) return;
    if (!petBird.unlocked) {
        showWarning('Dapatkan skor 500 untuk membuka Ultimate!');
        return;
    }
    if (player.flyCooldown > 0) return;

    if (!player.isFlying) {
        // Jika pertama kali menggunakan Ultimate di sesi ini, jalankan Cut-In dulu
        if (!ultCutin.played) {
            ultCutin.played = true;
            ultCutin.active = true;
            ultCutin.timer = ultCutin.maxTimer;
            return;
        }
        activateBirdMount();
    } else {
        spawnExplosion(player.x + player.flyW / 2, player.y + player.flyH / 2, 200);
        player.isFlying = false;
        player.vy = 0;
        player.state = 'jump';
        petBird.x = player.x - 80;
        petBird.y = player.y - 40;
    }
}

function triggerSkill1() {
    if (isPaused) return;
    if (score < 250) {
        showWarning('Dapatkan skor 250 untuk membuka Skill 1!');
        return;
    }
    if (player.isFlying || player.skill1Cooldown > 0) return;

    player.skill1Cooldown = 360;
    player.actionType = 'skill1';
    player.actionTimer = 24;
    player.invulnTimer = 150;

    const centerX = player.x + player.w / 2;
    const centerY = player.y + player.h / 2;

    spawnExplosion(centerX, centerY, 420);
    spawnExplosion(centerX - 140, centerY + 20, 240);
    spawnExplosion(centerX + 140, centerY + 20, 240);

    const blastRadius = 420;
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const eCenterX = e.x + e.w / 2;
        const eCenterY = e.y + e.h / 2;
        if (Math.hypot(eCenterX - centerX, eCenterY - centerY) <= blastRadius) {
            spawnExplosion(eCenterX, eCenterY, 180);
            enemies.splice(i, 1);
            score += 25;
        }
    }
}
function shootBullet() {
    if (isPaused || player.shootCooldown > 0) return;

    player.shootCooldown = 22;
    if (!player.isFlying) {
        player.actionType = 'attack';
        player.actionTimer = 10;
    }

    const activeW = player.isFlying ? player.flyW : player.w;
    const activeH = player.isFlying ? player.flyH : player.h;
    const dir = player.facingRight ? 1 : -1;

    bullets.push({
        x: player.facingRight ? player.x + activeW - 20 : player.x - 100,
        y: player.y + activeH * 0.42,
        w: 84,
        h: 56,
        vx: dir * 20,
        facingRight: player.facingRight,
        frameIndex: 0,
        frameTimer: 0
    });
}

function resetGame() {
    levelMap = [];
    coins = [];
    enemies = [];
    bullets = [];
    explosions = [];
    score = 0;
    lives = 3;
    isPaused = false;
    nextCoinStartTile = 6;
    enemySpawnTimer = 45;
    generateChunks(25);
    ultCutin = { active: false, timer: 0, maxTimer: 95, played: false };
    
    player.x = 200;
    player.y = 400;
    player.vx = 0;
    player.vy = 0;
    player.invulnTimer = 0;
    player.isFlying = false;
    player.flyCooldown = 0;
    player.shootCooldown = 0;
    player.skill1Cooldown = 0;
    player.actionType = null;
    
    petBird.unlocked = false;
    cameraX = 0;
}

resetGame();

// 4. Input Keyboard & Hubungkan Kontrol Tombol HUD
const keys = {};
window.addEventListener('keydown', (e) => {
    if (!e.repeat) {
        if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
        if (e.code === 'KeyD') toggleFlyMode();
        if (e.code === 'KeyF') shootBullet();
        if (e.code === 'KeyG') triggerSkill1();
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

initHUDControls(canvas, keys, {
    skill1: triggerSkill1,
    ultimate: toggleFlyMode,
    attack: shootBullet,
    pause: togglePause
});

// 5. Logika Update & Fisika
function update() {
  if (warningMsg.timer > 0) warningMsg.timer--;
  if (ultCutin.active) {
    ultCutin.timer--;
    if (ultCutin.timer <= 0) {
        ultCutin.active = false;
        activateBirdMount(); // Begitu cut-in selesai, langsung naik burung!
    }
    return; // Bekukan pergerakan musuh & dunia selama cut-in berlangsung
}
    if (isPaused) return;

    player.wasGrounded = player.grounded;
    if (player.invulnTimer > 0) player.invulnTimer--;
    if (player.flyCooldown > 0) player.flyCooldown--;
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (player.skill1Cooldown > 0) player.skill1Cooldown--;
    if (player.actionTimer > 0) {
        player.actionTimer--;
        if (player.actionTimer <= 0) player.actionType = null;
    }

    if (score >= 500 && !petBird.unlocked) {
        petBird.unlocked = true;
        petBird.x = player.x - 100;
        petBird.y = player.y - 60;
        spawnExplosion(petBird.x + petBird.w / 2, petBird.y + petBird.h / 2, 140);
    }

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

        const prevState = player.state;
        if (player.actionType === 'skill1') {
            player.state = 'skill1';
            player.frameIndex = 0;
        } else if (player.actionType === 'attack') {
            player.state = 'attack';
            player.frameIndex = player.actionTimer > 5 ? 0 : 1;
        } else if (player.state === 'jump_prep') {
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

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.frameTimer++;
        if (b.frameTimer >= 3) {
            b.frameTimer = 0;
            b.frameIndex = (b.frameIndex + 1) % assets.bullet.length;
        }

        let bulletHit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                bulletHit = true;
                e.hp--;
                e.hitFlash = 6;

                if (e.hp <= 0) {
                    spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, 190);
                    enemies.splice(j, 1);
                    score += 25;
                } else {
                    spawnExplosion(b.x + b.w / 2, b.y + b.h / 2, 100);
                }
                break;
            }
        }

        if (bulletHit || b.x > cameraX + canvas.width + 150 || b.x + b.w < cameraX - 150) {
            bullets.splice(i, 1);
        }
    }

    const activeW = player.isFlying ? player.flyW : player.w;
    const activeH = player.isFlying ? player.flyH : player.h;
    const isCrouching = !player.isFlying && (keys['ArrowDown'] || keys['KeyS']) && player.grounded;
    
    const hitMargin = 22;
    const crouchOffset = isCrouching ? activeH * 0.45 : 0;
    const hitTop = player.y + hitMargin + crouchOffset;
    const hitBottom = player.y + activeH - hitMargin;
    const hitLeft = player.x + hitMargin;
    const hitRight = player.x + activeW - hitMargin;

    for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (!c.collected &&
            hitLeft < c.x + COIN_SIZE &&
            hitRight > c.x &&
            hitTop < c.y + COIN_SIZE &&
            hitBottom > c.y) {
            c.collected = true;
            score +=1000;
        }
    }
    if (coins.length > 0 && coins[0].x < cameraX - 200) coins.shift();

    enemySpawnTimer--;
    if (enemySpawnTimer <= 0) {
        const flyHeights = player.isFlying 
            ? [GROUND_Y - 160, GROUND_Y - 340, GROUND_Y - 520, GROUND_Y - 680]
            : [GROUND_Y - 180, GROUND_Y - 300];
        const randomY = flyHeights[Math.floor(Math.random() * flyHeights.length)];
        enemies.push({
            x: cameraX + canvas.width + 100,
            y: randomY,
            w: 195,
            h: 165,
            hp: 2,
            hitFlash: 0,
            speed: 8 + Math.random() * 4,
            frameIndex: 0,
            frameTimer: 0
        });
        enemySpawnTimer = player.isFlying 
            ? 30 + Math.floor(Math.random() * 40)
            : 45 + Math.floor(Math.random() * 70);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= e.speed;
        if (e.hitFlash > 0) e.hitFlash--;

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

                if (player.isFlying) {
                    player.isFlying = false;
                    player.flyCooldown = 300;
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

    for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        const bSprite = assets.bullet[b.frameIndex];
        if (isReady(bSprite)) {
            ctx.save();
            if (!b.facingRight) {
                ctx.translate(b.x + b.w, b.y);
                ctx.scale(-1, 1);
                ctx.drawImage(bSprite, 0, 0, b.w, b.h);
            } else {
                ctx.drawImage(bSprite, b.x, b.y, b.w, b.h);
            }
            ctx.restore();
        }
    }

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const enemySprite = assets.flyEnemy[e.frameIndex];
        if (isReady(enemySprite)) {
            ctx.save();
            if (e.hitFlash > 0) ctx.globalAlpha = 0.5;
            ctx.drawImage(enemySprite, e.x, e.y, e.w, e.h);
            ctx.restore();
        }
    }

    const animKey = (player.state === 'jump_prep' || player.state === 'land') ? 'jump' : player.state;
    const currentSprite = assets.animations[animKey][player.frameIndex];

    if (isReady(currentSprite)) {
        ctx.save();
        if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.45;
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

    for (let i = 0; i < explosions.length; i++) {
        const exp = explosions[i];
        const expSprite = assets.explosion[exp.frameIndex];
        if (isReady(expSprite)) {
            ctx.drawImage(expSprite, exp.x, exp.y, exp.size, exp.size);
        }
    }

    ctx.restore();

    // C. Panggil Renderer HUD dari js/hud.js
    drawHUD(ctx, {
        score,
        lives,
        coinImg: assets.coin,
        player,
        petBird,
        isPaused,
        warningMsg,
        ultCutin
    });
}

// 7. Game Loop Utama
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();