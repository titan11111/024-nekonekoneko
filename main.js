// ゲーム設定
const CONFIG = {
    GAME_TIME: 30,
    SPAWN_RATE: 800, 
    CAT_LIFETIME: 2000, 
    CLICKS_TO_CATCH: 3, 
    SCORE_NORMAL: 100,
    SCORE_PENALTY: -50,
    BOMB_COUNT: 3, 
    FEVER_THRESHOLD: 10, 
};

// 状態管理
let state = {
    score: 0,
    time: CONFIG.GAME_TIME,
    combo: 0,
    bombs: CONFIG.BOMB_COUNT,
    isPlaying: false,
    isFever: false,
    lastTime: 0,
    spawnTimer: 0
};

// DOM要素
const els = {
    stage: document.getElementById('gameStage'),
    obstacleLayer: document.getElementById('obstacleLayer'),
    score: document.getElementById('score'),
    time: document.getElementById('time'),
    combo: document.getElementById('combo'),
    bomb: document.getElementById('bomb'),
    startScreen: document.getElementById('startScreen'),
    gameOver: document.getElementById('gameOver'),
    finalScore: document.getElementById('finalScore'),
    rankText: document.getElementById('rankText'), // 新規追加
    startBtn: document.getElementById('startBtn'),
    playAgainBtn: document.getElementById('playAgainBtn')
};

// アセット定義（household_itemを追加）
const ASSETS = {
    goodCats: [
        'images/neko1.png', 'images/neko2.png', 'images/neko4.png', 
        'images/neko5.png', 'images/neko6.png', 'images/neko_transparent_4.png',
        'images/neko_transparent_5.png', 'images/neko_transparent_6.png'
    ],
    badCats: [
        'images/neko7.png', 'images/neko8.png', 'images/neko_resized_3.png'
    ],
    catchEffect: [
        'images/neko3.png', 'images/neko_jump_surprised_transparent_48.png'
    ],
    furniture: [ // 障害物用
        'images/household_item_1.png', 'images/household_item_2.png',
        'images/household_item_3.png', 'images/household_item_4.png',
        'images/household_item_5.png', 'images/household_item_6.png',
        'images/household_item_7.png', 'images/household_item_8.png'
    ],
    sounds: {
        hit: new Audio('audio/nyan.mp3'),
        catch: new Audio('audio/nyan2.mp3'),
        damage: new Audio('audio/nyan7.mp3'),
        spawn: new Audio('audio/nyan3.mp3'),
        combo: new Audio('audio/nyan4.mp3'),
        rare: new Audio('audio/nyan6.mp3'),
        finish: new Audio('audio/nyan9.mp3')
    }
};

function playSound(name) {
    const sound = ASSETS.sounds[name];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Audio play failed', e));
    }
}

// ランク判定ロジック
function getRank(score) {
    if (score < 1000) return "万年日直補佐";
    if (score < 3000) return "ベテラン給食当番";
    if (score < 5000) return "カレー守護神";
    return "伝説のネコ使い";
}

// 障害物（家具）の配置
function spawnObstacles() {
    els.obstacleLayer.innerHTML = ''; // リセット
    const itemCount = 5; // 配置する家具の数
    
    for (let i = 0; i < itemCount; i++) {
        const src = ASSETS.furniture[Math.floor(Math.random() * ASSETS.furniture.length)];
        const el = document.createElement('img');
        el.src = src;
        el.className = 'room-item';
        
        // ランダムな位置とサイズ
        const size = 100 + Math.random() * 100;
        el.style.width = size + 'px';
        el.style.left = Math.random() * (els.stage.clientWidth - size) + 'px';
        el.style.top = (els.stage.clientHeight / 2) + Math.random() * (els.stage.clientHeight / 2 - size) + 'px'; // 画面下半分を中心に配置
        el.style.opacity = '0.9';
        
        els.obstacleLayer.appendChild(el);
    }
}

// ゲームループ
function gameLoop(timestamp) {
    if (!state.isPlaying) return;

    if (!state.lastTime) state.lastTime = timestamp;
    const deltaTime = timestamp - state.lastTime;
    
    state.spawnTimer += deltaTime;
    
    const currentSpawnRate = state.isFever ? 200 : CONFIG.SPAWN_RATE;

    if (state.spawnTimer > currentSpawnRate) {
        spawnCat();
        state.spawnTimer = 0;
        if (CONFIG.SPAWN_RATE > 400) CONFIG.SPAWN_RATE -= 2;
    }

    state.lastTime = timestamp;
    requestAnimationFrame(gameLoop);
}

function startTimer() {
    const timerInterval = setInterval(() => {
        if (!state.isPlaying) {
            clearInterval(timerInterval);
            return;
        }
        state.time--;
        updateDisplay();
        
        if (state.time <= 0) {
            endGame();
        }
    }, 1000);
}

function spawnCat() {
    const isBad = Math.random() < 0.2; 
    const catSrc = isBad 
        ? ASSETS.badCats[Math.floor(Math.random() * ASSETS.badCats.length)]
        : ASSETS.goodCats[Math.floor(Math.random() * ASSETS.goodCats.length)];
    
    const cat = document.createElement('img');
    cat.src = catSrc;
    cat.className = 'target-cat';
    cat.dataset.hp = isBad ? 1 : CONFIG.CLICKS_TO_CATCH;
    cat.dataset.type = isBad ? 'bad' : 'good';
    
    const size = 100;
    const moveType = Math.random();
    
    cat.style.width = size + 'px';
    cat.style.transition = `transform ${CONFIG.CAT_LIFETIME/1000}s linear, opacity 0.5s`;

    if (moveType < 0.2) {
        // ダッシュ猫
        cat.classList.add('cat-dash');
        cat.style.left = els.stage.clientWidth + 'px'; 
        cat.style.top = Math.random() * (els.stage.clientHeight - size) + 'px';
    } else {
        const x = Math.random() * (els.stage.clientWidth - size);
        const y = Math.random() * (els.stage.clientHeight - size) + (size/2);
        cat.style.left = x + 'px';
        cat.style.top = y + 'px';
        
        if (moveType < 0.4) {
            cat.classList.add('cat-zigzag');
        } else {
            cat.style.transform = 'scale(0.1)';
            requestAnimationFrame(() => {
                cat.style.transform = 'scale(1.0)';
            });
        }
    }
    
    els.stage.appendChild(cat);
    
    cat.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        handleClick(cat, e.clientX, e.clientY);
    });

    setTimeout(() => {
        if (cat.parentNode) {
            cat.style.opacity = '0';
            setTimeout(() => cat.remove(), 500);
            if (cat.dataset.type === 'good' && cat.dataset.hp > 0) {
                resetCombo(); 
            }
        }
    }, CONFIG.CAT_LIFETIME);
}

function handleClick(cat, x, y) {
    if (!state.isPlaying) return;

    const type = cat.dataset.type;
    
    if (type === 'bad') {
        damagePenalty(x, y);
        cat.remove();
        return;
    }

    let hp = parseInt(cat.dataset.hp);
    hp--;
    cat.dataset.hp = hp;

    cat.style.filter = 'brightness(200%)';
    setTimeout(() => cat.style.filter = 'none', 100);
    
    if (!cat.classList.contains('cat-dash')) { 
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        cat.style.transform = `scale(1.0) translate(${offsetX}px, ${offsetY}px)`;
    }

    if (hp <= 0) {
        catchSuccess(cat, x, y);
    } else {
        playSound('hit');
    }
}

function catchSuccess(cat, x, y) {
    state.combo++;
    if (state.combo >= CONFIG.FEVER_THRESHOLD && !state.isFever) {
        startFever();
    }

    let multiplier = state.isFever ? 2 : 1;
    const bonus = Math.min(state.combo * 10, 500);
    const getPoint = (CONFIG.SCORE_NORMAL + bonus) * multiplier;
    state.score += getPoint;
    
    playSound('catch');
    if (state.combo % 5 === 0) playSound('combo');

    const surpriseSrc = ASSETS.catchEffect[Math.floor(Math.random() * ASSETS.catchEffect.length)];
    cat.src = surpriseSrc;
    cat.classList.remove('cat-dash', 'cat-zigzag'); 
    cat.style.transform = 'scale(1.2) rotate(360deg)';
    cat.style.opacity = '0';
    
    showFloatingText(x, y, `+${getPoint}`, '#ff8c00'); // オレンジ色
    
    updateDisplay();
    setTimeout(() => {
        if (cat.parentNode) cat.remove();
    }, 300);
}

function damagePenalty(x, y) {
    state.score += CONFIG.SCORE_PENALTY;
    state.time -= 3;
    playSound('damage');
    resetCombo();
    
    els.stage.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    setTimeout(() => els.stage.style.backgroundColor = 'transparent', 100);
    
    showFloatingText(x || els.stage.clientWidth/2, y || els.stage.clientHeight/2, "つまみ食い! -3秒", "red");
    updateDisplay();
}

function resetCombo() {
    state.combo = 0;
    if (state.isFever) {
        state.isFever = false;
        els.stage.classList.remove('fever-mode');
        CONFIG.SPAWN_RATE = 800;
    }
    updateDisplay();
}

function startFever() {
    state.isFever = true;
    els.stage.classList.add('fever-mode');
    playSound('rare');
    showFloatingText(els.stage.clientWidth/2, els.stage.clientHeight/2, "給食ラッシュ!!", "#ff00ff");
    setTimeout(() => {
        if (state.isFever) {
            state.isFever = false;
            els.stage.classList.remove('fever-mode');
        }
    }, 10000);
}

function triggerBomb() {
    if (!state.isPlaying || state.bombs <= 0) return;
    
    state.bombs--;
    updateDisplay();
    
    const flash = document.createElement('div');
    flash.className = 'bomb-flash'; // CSSで定義が必要（style.cssには既存である前提）
    els.stage.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
    
    const cats = document.querySelectorAll('.target-cat');
    let caughtCount = 0;
    
    cats.forEach(cat => {
        const type = cat.dataset.type;
        if (type === 'good') {
            const rect = cat.getBoundingClientRect();
            // 座標調整（簡易）
            catchSuccess(cat, rect.left, rect.top);
            caughtCount++;
        } else {
            cat.remove();
        }
    });
    
    if (caughtCount > 0) playSound('finish'); 
}

function showFloatingText(x, y, text, color = '#ffff00') {
    const el = document.createElement('div');
    el.textContent = text;
    el.className = 'float-text'; // クラスでスタイル指定
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    el.style.transition = 'top 1s, opacity 1s';
    
    document.body.appendChild(el); 
    
    requestAnimationFrame(() => {
        el.style.top = (y - 50) + 'px';
        el.style.opacity = '0';
    });
    
    setTimeout(() => el.remove(), 1000);
}

function updateDisplay() {
    els.score.textContent = state.score;
    els.time.textContent = Math.max(0, state.time);
    els.combo.textContent = state.combo;
    if(els.bomb) els.bomb.textContent = state.bombs;
}

function startGame() {
    state = {
        score: 0,
        time: CONFIG.GAME_TIME,
        combo: 0,
        bombs: CONFIG.BOMB_COUNT,
        isPlaying: true,
        isFever: false,
        lastTime: 0,
        spawnTimer: 0
    };
    CONFIG.SPAWN_RATE = 800;
    
    // リセット処理
    document.querySelectorAll('.target-cat').forEach(el => el.remove());
    
    // 障害物（家具）を配置
    spawnObstacles();
    
    els.startScreen.style.display = 'none';
    els.gameOver.style.display = 'none';
    els.stage.classList.remove('fever-mode');
    
    updateDisplay();
    playSound('spawn');
    
    startTimer();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    state.isPlaying = false;
    playSound('finish');
    
    els.finalScore.textContent = state.score;
    els.rankText.textContent = getRank(state.score); // ランク表示
    els.gameOver.style.display = 'flex';
}

// イベントリスナー
els.startBtn.addEventListener('click', startGame);
els.playAgainBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        triggerBomb();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (state.isPlaying) {
        e.preventDefault();
        triggerBomb();
    }
});
