(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  const scoreElement = document.querySelector('#score');
  const highScoreElement = document.querySelector('#high-score');
  const stageElement = document.querySelector('#stage');
  const bossStatusElement = document.querySelector('#boss-status');
  const statusElement = document.querySelector('#game-status');
  const startButton = document.querySelector('#start-button');
  const pauseButton = document.querySelector('#pause-button');
  const restartButton = document.querySelector('#restart-button');
  const cellSize = 20;
  const columns = canvas.width / cellSize;
  const rows = canvas.height / cellSize;
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const highScoreKey = 'sunb0711-snake-high-score';
  let snake;
  let direction;
  let queuedDirection;
  let food;
  let enemies = [];
  let boss = null;
  let bossStage = 0;
  let foodsCollected = 0;
  let stage = 1;
  let score;
  let gameState = 'idle';
  let gameTimer = null;
  let enemyCycleTimer = null;
  let enemyRespawnTimer = null;

  function readHighScore() {
    try { return Number(localStorage.getItem(highScoreKey)) || 0; } catch { return 0; }
  }

  function writeHighScore(value) {
    try { localStorage.setItem(highScoreKey, String(value)); } catch { /* Storage is optional. */ }
  }

  function samePosition(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function randomPosition(blocked = []) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const candidate = { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) };
      if (!blocked.some((item) => samePosition(item, candidate))) return candidate;
    }
    return { x: 2, y: 2 };
  }

  function setStatus(message) {
    if (statusElement) statusElement.textContent = message;
  }

  function updateScore() {
    if (scoreElement) scoreElement.textContent = String(score);
    if (highScoreElement) highScoreElement.textContent = String(Math.max(readHighScore(), score));
    if (stageElement) stageElement.textContent = String(stage);
    if (bossStatusElement) bossStatusElement.textContent = boss ? `보스 HP ${boss.hp}` : '보스 없음';
  }

  function clearGameTimer() {
    if (gameTimer !== null) {
      window.clearInterval(gameTimer);
      gameTimer = null;
    }
  }

  function clearEnemyTimers() {
    if (enemyCycleTimer !== null) {
      window.clearTimeout(enemyCycleTimer);
      enemyCycleTimer = null;
    }
    if (enemyRespawnTimer !== null) {
      window.clearTimeout(enemyRespawnTimer);
      enemyRespawnTimer = null;
    }
  }

  function createEnemies(allowTargetOverlap = false) {
    const created = [];
    const blocked = allowTargetOverlap ? [] : [...snake, food];
    while (created.length < 5) {
      const position = randomPosition([...blocked, ...created.map((enemy) => enemy.position)]);
      created.push({ position, direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)], active: true, exploding: false });
    }
    return created;
  }

  function enemyOverlaps(position) {
    return snake.some((segment) => samePosition(segment, position)) || samePosition(food, position);
  }

  function scheduleEnemyCycle() {
    clearEnemyTimers();
    if (gameState !== 'running') return;
    enemyCycleTimer = window.setTimeout(explodeEnemies, 5000);
  }

  function explodeEnemies() {
    enemyCycleTimer = null;
    if (gameState !== 'running') return;
    enemies.forEach((enemy) => { enemy.active = false; enemy.exploding = true; });
    draw();
    enemyRespawnTimer = window.setTimeout(respawnEnemies, 2000);
  }

  function respawnEnemies() {
    enemyRespawnTimer = null;
    if (gameState !== 'running') return;
    enemies = createEnemies(true);
    enemies.forEach((enemy) => {
      if (enemyOverlaps(enemy.position)) {
        enemy.active = false;
        enemy.exploding = true;
      }
    });
    draw();
    scheduleEnemyCycle();
  }

  function spawnBossIfNeeded() {
    stage = Math.floor(foodsCollected / 5) + 1;
    if (stage % 5 !== 0 || bossStage === stage || boss) return;
    bossStage = stage;
    boss = {
      position: { x: columns - 4, y: Math.floor(rows / 2) },
      direction: 'left',
      hp: 5,
      active: true
    };
    setStatus('보스 출현 — 먹이 5개로 격파하세요.');
    updateScore();
  }

  function moveBoss() {
    if (!boss || !boss.active) return;
    if (Math.random() < 0.2) {
      boss.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
    }
    const vector = directions[boss.direction];
    boss.position = {
      x: (boss.position.x + vector.x + columns) % columns,
      y: (boss.position.y + vector.y + rows) % rows
    };
    const bossHit = snake.some((segment) => Math.abs(segment.x - boss.position.x) <= 1 && Math.abs(segment.y - boss.position.y) <= 1);
    if (bossHit) endGame();
  }

  function resetGame() {
    clearGameTimer();
    clearEnemyTimers();
    snake = [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }];
    direction = 'right';
    queuedDirection = 'right';
    score = 0;
    foodsCollected = 0;
    stage = 1;
    boss = null;
    bossStage = 0;
    food = randomPosition(snake);
    enemies = createEnemies();
    gameState = 'idle';
    updateScore();
    if (pauseButton) pauseButton.disabled = true;
    if (pauseButton) pauseButton.textContent = '일시정지';
    setStatus('시작을 눌러 출발하세요.');
    draw();
  }

  function setDirection(next) {
    if (!directions[next] || next === opposite[direction]) return;
    queuedDirection = next;
  }

  function readInput(key) {
    const inputs = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right'
    };
    return inputs[key];
  }

  function moveEnemies() {
    enemies.forEach((enemy) => {
      if (!enemy.active) return;
      if (Math.random() < 0.25) {
        enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
      }
      const vector = directions[enemy.direction];
      enemy.position = {
        x: (enemy.position.x + vector.x + columns) % columns,
        y: (enemy.position.y + vector.y + rows) % rows
      };
      if (snake.some((segment) => samePosition(segment, enemy.position))) endGame();
    });
  }

  function tick() {
    if (gameState !== 'running') return;
    direction = queuedDirection;
    const head = snake[0];
    const vector = directions[direction];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const hitWall = nextHead.x < 0 || nextHead.x >= columns || nextHead.y < 0 || nextHead.y >= rows;
    const hitSelf = snake.some((segment) => samePosition(segment, nextHead));
    if (hitWall || hitSelf) return endGame();
    if (enemies.some((enemy) => enemy.active && samePosition(enemy.position, nextHead))) return endGame();

    snake.unshift(nextHead);
    if (samePosition(nextHead, food)) {
      score += 10;
      foodsCollected += 1;
      if (boss) {
        boss.hp -= 1;
        if (boss.hp <= 0) {
          boss = null;
          setStatus('보스 격파 성공! 계속 탐사하세요.');
        }
      }
      food = randomPosition(snake);
      spawnBossIfNeeded();
      updateScore();
    } else {
      snake.pop();
    }
    moveEnemies();
    moveBoss();
    draw();
  }

  function startGame() {
    if (gameState === 'running') return;
    if (gameState === 'over') resetGame();
    gameState = 'running';
    clearGameTimer();
    gameTimer = window.setInterval(tick, 140);
    scheduleEnemyCycle();
    if (pauseButton) pauseButton.disabled = false;
    setStatus('탐사 중 — 먹이를 모으세요.');
    draw();
  }

  function togglePause() {
    if (gameState === 'running') {
      gameState = 'paused';
      clearGameTimer();
      clearEnemyTimers();
      if (pauseButton) pauseButton.textContent = '계속하기';
      setStatus('일시정지됨');
      draw();
    } else if (gameState === 'paused') {
      gameState = 'running';
      clearGameTimer();
      gameTimer = window.setInterval(tick, 140);
      scheduleEnemyCycle();
      if (pauseButton) pauseButton.textContent = '일시정지';
      setStatus('탐사 중 — 먹이를 모으세요.');
    }
  }

  function endGame() {
    gameState = 'over';
    clearGameTimer();
    clearEnemyTimers();
    const best = Math.max(readHighScore(), score);
    writeHighScore(best);
    updateScore();
    if (pauseButton) pauseButton.disabled = true;
    setStatus('게임 오버 — 재시작해서 다시 도전하세요.');
    draw();
  }

  function drawCell(position, color) {
    context.fillStyle = color;
    context.fillRect(position.x * cellSize + 1, position.y * cellSize + 1, cellSize - 2, cellSize - 2);
  }

  function draw() {
    context.fillStyle = '#03050f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(140, 231, 255, .08)';
    for (let x = 0; x <= columns; x += 1) {
      context.beginPath(); context.moveTo(x * cellSize, 0); context.lineTo(x * cellSize, canvas.height); context.stroke();
    }
    for (let y = 0; y <= rows; y += 1) {
      context.beginPath(); context.moveTo(0, y * cellSize); context.lineTo(canvas.width, y * cellSize); context.stroke();
    }
    drawCell(food, '#8ce7ff');
    snake.forEach((segment, index) => drawCell(segment, index === 0 ? '#a99bff' : '#6f77c8'));
    enemies.forEach((enemy) => {
      if (enemy.active) drawCell(enemy.position, '#ff7396');
      if (enemy.exploding) {
        context.beginPath();
        context.fillStyle = 'rgba(255, 177, 92, .75)';
        context.arc(enemy.position.x * cellSize + cellSize / 2, enemy.position.y * cellSize + cellSize / 2, cellSize * .65, 0, Math.PI * 2);
        context.fill();
      }
    });
    if (boss && boss.active) {
      const centerX = boss.position.x * cellSize + cellSize;
      const centerY = boss.position.y * cellSize + cellSize;
      context.fillStyle = '#ffca6b';
      context.beginPath();
      context.moveTo(centerX - cellSize * 1.4, centerY + cellSize);
      context.lineTo(centerX, centerY - cellSize * 1.4);
      context.lineTo(centerX + cellSize * 1.4, centerY + cellSize);
      context.closePath();
      context.fill();
      context.fillStyle = '#ff5f86';
      context.fillRect(centerX - cellSize * .55, centerY - cellSize * .25, cellSize * .35, cellSize * .35);
      context.fillRect(centerX + cellSize * .2, centerY - cellSize * .25, cellSize * .35, cellSize * .35);
    }
    if (gameState === 'paused' || gameState === 'over') {
      context.fillStyle = 'rgba(3, 5, 15, .65)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#edf3ff';
      context.font = 'bold 24px system-ui';
      context.textAlign = 'center';
      context.fillText(gameState === 'paused' ? '일시정지' : 'GAME OVER', canvas.width / 2, canvas.height / 2);
    }
  }

  document.addEventListener('keydown', (event) => {
    const next = readInput(event.key);
    if (next) { event.preventDefault(); setDirection(next); }
    if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  });
  document.querySelectorAll('[data-direction]').forEach((button) => {
    button.addEventListener('click', () => setDirection(button.dataset.direction));
  });
  if (startButton) startButton.addEventListener('click', startGame);
  if (pauseButton) pauseButton.addEventListener('click', togglePause);
  if (restartButton) restartButton.addEventListener('click', () => { resetGame(); startGame(); });

  resetGame();
})();
