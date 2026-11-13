// Pemuatan Aset Ikon HUD
const loadHudImg = (name) => {
    const img = new Image();
    img.src = `assets/objects/${name}.png`;
    return img;
};

const hudAssets = {
    kiri: loadHudImg('kiri'),
    kanan: loadHudImg('kanan'),
    jump: loadHudImg('jump'),
    down: loadHudImg('down'),
    attack: loadHudImg('attack'),
    skill: loadHudImg('skill'),
    ultimate: loadHudImg('ultimate'),
    pause: loadHudImg('pause'),
    vignate: loadHudImg('vignate')

};

// Koordinat & Ukuran Tombol HUD (Resolusi 1920x1080)
const hudButtons = {
    // Kanan Atas: Skill 1 (G), Ultimate/Fly (D), Pause (P/Esc)
    skill1:   { x: 1360, y: 35,  w: 130, h: 130, action: 'skill1',   hold: false, alpha: 1.0 },
    ultimate: { x: 1525, y: 35,  w: 130, h: 130, action: 'ultimate', hold: false, alpha: 1.0 },
    pause:    { x: 1730, y: 40,  w: 110, h: 110, action: 'pause',    hold: false, alpha: 0.9 },

    // Kiri Bawah: Navigasi Horizontal (Opacity dikurangi agar tidak menghalangi layar)
    left:     { x: 65,   y: 830, w: 175, h: 175, key: 'ArrowLeft',   hold: true,  alpha: 0.55 },
    right:    { x: 275,  y: 830, w: 175, h: 175, key: 'ArrowRight',  hold: true,  alpha: 0.55 },

    // Kanan Bawah: Aksi Utama (Opacity dikurangi agar bersih)
    attack:   { x: 1470, y: 650, w: 155, h: 155, action: 'attack',   hold: false, alpha: 0.6 },
    down:     { x: 1340, y: 845, w: 150, h: 150, key: 'ArrowDown',   hold: true,  alpha: 0.55 },
    jump:     { x: 1620, y: 785, w: 200, h: 200, key: 'ArrowUp',     hold: true,  alpha: 0.55 }
};

function drawHeart(ctx, x, y, size, filled) {
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
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
}

function drawHudBtn(ctx, img, btn, isDisabled = false, cooldownSec = 0) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.save();
    // Jika terkunci/cooldown, kurangi opacity lebih dalam; jika aktif, gunakan alpha bawaan tombol
    ctx.globalAlpha = isDisabled ? (btn.alpha * 0.4) : btn.alpha;
    ctx.drawImage(img, btn.x, btn.y, btn.w, btn.h);
    ctx.restore();

    if (cooldownSec > 0) {
        ctx.save();
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#111';
        ctx.fillText(cooldownSec, btn.x + btn.w / 2 + 3, btn.y + btn.h / 2 + 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(cooldownSec, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.restore();
    }
}

// Fungsi Utama Render HUD
function drawHUD(ctx, state) {
    const { score, lives, coinImg, player, petBird, isPaused, warningMsg } = state;

    // 1. Kiri Atas: Skor & 3 Nyawa Hati
    if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
        ctx.drawImage(coinImg, 45, 38, 54, 54);
    }
    ctx.save();
    ctx.font = 'bold 46px sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText(score, 115, 84);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score, 112, 81);
    ctx.restore();

    for (let i = 0; i < 3; i++) {
        drawHeart(ctx, 72 + i * 64, 115, 48, i < lives);
    }

    // 2. Kanan Atas: Skill 1 (Syarat Skor 250), Ultimate (Syarat Skor 500), & Pause
    const skill1Locked = score < 250;
    const skill1Disabled = skill1Locked || player.isFlying || player.skill1Cooldown > 0;
    const skill1Cd = player.skill1Cooldown > 0 ? Math.ceil(player.skill1Cooldown / 60) : 0;
    drawHudBtn(ctx, hudAssets.skill, hudButtons.skill1, skill1Disabled, skill1Cd);

    const ultDisabled = !petBird.unlocked || player.flyCooldown > 0;
    const ultCd = player.flyCooldown > 0 ? Math.ceil(player.flyCooldown / 60) : 0;
    drawHudBtn(ctx, hudAssets.ultimate, hudButtons.ultimate, ultDisabled, ultCd);

    drawHudBtn(ctx, hudAssets.pause, hudButtons.pause, false, 0);

    // 3. Kiri Bawah: Tombol Kiri & Kanan (Semi-Transparan)
    drawHudBtn(ctx, hudAssets.kiri, hudButtons.left);
    drawHudBtn(ctx, hudAssets.kanan, hudButtons.right);

    // 4. Kanan Bawah: Tombol Attack, Down, & Jump (Semi-Transparan)
    drawHudBtn(ctx, hudAssets.attack, hudButtons.attack, player.shootCooldown > 0);
    drawHudBtn(ctx, hudAssets.down, hudButtons.down, player.isFlying);
    drawHudBtn(ctx, hudAssets.jump, hudButtons.jump);

    // 5. Pesan Peringatan Skor (Muncul sementara saat skill terkunci dipaksa pencet)
    if (warningMsg && warningMsg.timer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, warningMsg.timer / 20); // Fade out halus
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';

        const textWidth = ctx.measureText(warningMsg.text).width;
        const boxW = textWidth + 60;
        const boxH = 66;
        const boxX = 960 - boxW / 2;
        const boxY = 195;

        // Latar pill gelap elegan
        ctx.fillStyle = 'rgba(15, 15, 20, 0.8)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 16);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f1c40f';
        ctx.stroke();

        ctx.fillStyle = '#f1c40f';
        ctx.fillText(warningMsg.text, 960, boxY + 45);
        ctx.restore();
    }
// 6. Efek Ultimate Cut-In (Layar meredup + Gambar meluncur dari kiri)
    if (ultCutin && ultCutin.active) {
        const progress = 1 - (ultCutin.timer / ultCutin.maxTimer); // 0.0 -> 1.0
        
        // Layar memudar gelap secara halus
        const darkAlpha = progress < 0.15 ? (progress / 0.15) * 0.72 : 0.72;
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${darkAlpha})`;
        ctx.fillRect(0, 0, 1920, 1080);

        // Animasi meluncur masuk dari kiri (Ease-Out Cubic)
        // Animasi meluncur masuk dari kiri (Ukuran proporsional 40% lebar layar)
        if (hudAssets.vignate && hudAssets.vignate.complete && hudAssets.vignate.naturalWidth > 0) {
            const slideT = Math.min(1, progress / 0.35);
            const easeOut = 1 - Math.pow(1 - slideT, 3);
            
            const imgW = 760; // Diperkecil dari 1280 agar pas seperti referensi
            const imgH = 570; // Menjaga rasio 4:3 (760 x 570)
            const startX = -imgW;
            const targetX = 0;
            const currentX = startX + (targetX - startX) * easeOut;
            const posY = (1080 - imgH) / 2; // Tepat di tengah vertikal (255px)

            ctx.drawImage(hudAssets.vignate, currentX, posY, imgW, imgH);
        }
        ctx.restore();
    }
    // 6. Overlay Layar Saat Pause Aktif
    if (isPaused) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, 1920, 1080);

        ctx.font = 'bold 84px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('GAME PAUSED', 960, 510);

        ctx.font = 'bold 34px sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText('Klik tombol Pause atau tekan [P] untuk melanjutkan', 960, 580);
        ctx.restore();
    }
}

// Inisialisasi Interaksi Klik / Touch pada Tombol HUD
function initHUDControls(canvas, keys, callbacks) {
    const getCanvasCoords = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handlePress = (clientX, clientY) => {
        const pos = getCanvasCoords(clientX, clientY);
        for (const key in hudButtons) {
            const btn = hudButtons[key];
            if (pos.x >= btn.x && pos.x <= btn.x + btn.w && pos.y >= btn.y && pos.y <= btn.y + btn.h) {
                if (btn.hold) {
                    keys[btn.key] = true;
                } else if (callbacks[btn.action]) {
                    callbacks[btn.action]();
                }
            }
        }
    };

    const handleRelease = () => {
        for (const key in hudButtons) {
            const btn = hudButtons[key];
            if (btn.hold) keys[btn.key] = false;
        }
    };

    canvas.addEventListener('mousedown', (e) => handlePress(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleRelease);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            handlePress(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', handleRelease);
}