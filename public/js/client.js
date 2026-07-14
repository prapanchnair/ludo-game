(function () {
  const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== name);
    });
  }

  const loginForm = document.getElementById('login-form');
  const nameInput = document.getElementById('name-input');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const startBtn = document.getElementById('start-btn');
  const playerListEl = document.getElementById('player-list');
  const playersSidebarEl = document.getElementById('players-sidebar');
  const turnBanner = document.getElementById('turn-banner');
  const diceEl = document.getElementById('dice');
  const winnerBanner = document.getElementById('winner-banner');
  const playAgainBtn = document.getElementById('play-again-btn');
  const logList = document.getElementById('log-list');
  const toast = document.getElementById('toast');
  const svg = document.getElementById('board-svg');
  const loginResetBtn = document.getElementById('login-reset-btn');
  const lobbyResetBtn = document.getElementById('lobby-reset-btn');
  const gameResetBtn = document.getElementById('game-reset-btn');

  const NS = 'http://www.w3.org/2000/svg';
  let myPlayerId = localStorage.getItem('ludoPlayerId') || null;
  let myColor = null;
  let boardDrawn = false;
  let latestState = null;
  let isRolling = false;
  let rollCycleInterval = null;
  let hasJoined = false;
  const ROLL_ANIM_MS = 250;

  const socket = io();

  socket.on('connect_error', () => {
    loginError.textContent = 'Could not reach server.';
  });

  socket.on('error_msg', (msg) => {
    if (screens.login.classList.contains('hidden')) {
      toast.textContent = msg;
      setTimeout(() => { toast.textContent = ''; }, 3000);
    } else {
      loginError.textContent = msg;
    }
  });

  socket.on('joined', ({ playerId, color }) => {
    myPlayerId = playerId;
    myColor = color;
    hasJoined = true;
    localStorage.setItem('ludoPlayerId', playerId);
  });

  socket.on('state', (state) => {
    if (!hasJoined) return; // ignore ambient broadcasts until we've actually joined
    latestState = state;
    const me = state.players.find((p) => p.isYou);
    if (!me) {
      // Our seat is gone (e.g. someone reset the room) — back to login.
      hasJoined = false;
      loginError.textContent = 'The room was reset. Please join again.';
      showScreen('login');
      return;
    }
    myColor = me.color;
    render(state);
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    socket.emit('join', {
      password: passwordInput.value,
      name: nameInput.value,
      playerId: myPlayerId
    });
  });

  startBtn.addEventListener('click', () => socket.emit('start_game'));
  playAgainBtn.addEventListener('click', () => socket.emit('play_again'));

  loginResetBtn.addEventListener('click', () => {
    loginError.textContent = '';
    if (!confirm('Reset the room? This clears all players and ends any game in progress.')) return;
    socket.emit('reset_room', { password: passwordInput.value });
  });
  [lobbyResetBtn, gameResetBtn].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Reset the room? This clears all players and ends any game in progress.')) return;
      socket.emit('reset_room');
    });
  });
  diceEl.addEventListener('click', () => {
    if (isRolling) return;
    if (!latestState || latestState.phase !== 'playing') return;
    if (latestState.currentPlayerId !== myPlayerId) return;
    if (latestState.hasRolled) return;
    playRollAnimation();
    socket.emit('roll_dice');
  });

  function playRollAnimation() {
    isRolling = true;
    diceEl.classList.add('rolling');
    rollCycleInterval = setInterval(() => {
      diceEl.textContent = String(1 + Math.floor(Math.random() * 6));
    }, 40);
    setTimeout(() => {
      clearInterval(rollCycleInterval);
      rollCycleInterval = null;
      diceEl.classList.remove('rolling');
      isRolling = false;
      diceEl.classList.add('settle');
      setTimeout(() => diceEl.classList.remove('settle'), 250);
      if (latestState) renderGame(latestState);
    }, ROLL_ANIM_MS);
  }

  function render(state) {
    if (state.phase === 'lobby') {
      showScreen('lobby');
      renderLobby(state);
      return;
    }
    showScreen('game');
    if (!boardDrawn) {
      drawStaticBoard();
      boardDrawn = true;
    }
    renderGame(state);
  }

  function renderLobby(state) {
    playerListEl.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot ${p.color}"></span> ${p.name}${p.isYou ? ' (you)' : ''}${p.connected ? '' : ' — disconnected'}`;
      playerListEl.appendChild(li);
    });
    startBtn.disabled = state.players.length < 2;
  }

  function renderGame(state) {
    playersSidebarEl.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = [
        !p.connected ? 'disconnected' : '',
        p.color === state.currentColor ? 'current-turn' : ''
      ].join(' ').trim();
      li.innerHTML = `<span class="dot ${p.color}"></span> ${p.name}${p.isYou ? ' (you)' : ''}`;
      playersSidebarEl.appendChild(li);
    });

    const isMyTurn = state.currentPlayerId === myPlayerId;
    const currentPlayer = state.players.find((p) => p.color === state.currentColor);

    const canRoll = state.phase === 'playing' && isMyTurn && !state.hasRolled;

    if (state.phase === 'finished') {
      turnBanner.textContent = 'Game over';
      winnerBanner.classList.remove('hidden');
      const names = state.winners.map((c) => {
        const p = state.players.find((pl) => pl.color === c);
        return p ? p.name : c;
      });
      winnerBanner.textContent = `🏆 Winner: ${names[0]}${names.length > 1 ? ' (then ' + names.slice(1).join(', ') + ')' : ''}`;
      playAgainBtn.classList.remove('hidden');
    } else {
      winnerBanner.classList.add('hidden');
      playAgainBtn.classList.add('hidden');
      turnBanner.textContent = currentPlayer
        ? `${isMyTurn ? "Your" : currentPlayer.name + "'s"} turn (${state.currentColor})`
        : '';
    }

    if (!isRolling) {
      diceEl.textContent = state.dice != null ? state.dice : '?';
      diceEl.classList.toggle('dice-active', canRoll);
    }
    BOARD.COLORS.forEach((c) => diceEl.classList.remove(`dice-${c}`));
    if (state.currentColor) diceEl.classList.add(`dice-${state.currentColor}`);

    logList.innerHTML = '';
    state.log.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      logList.appendChild(li);
    });

    drawTokens(state, isMyTurn && !isRolling);
  }

  // ---- Board drawing ----

  function rect(x, y, w, h, cls) {
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    if (cls) el.setAttribute('class', cls);
    svg.appendChild(el);
    return el;
  }

  function poly(points, cls) {
    const el = document.createElementNS(NS, 'polygon');
    el.setAttribute('points', points.map((p) => p.join(',')).join(' '));
    el.setAttribute('class', cls);
    svg.appendChild(el);
    return el;
  }

  function line(x1, y1, x2, y2, cls) {
    const el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', x1);
    el.setAttribute('y1', y1);
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
    el.setAttribute('class', cls);
    svg.appendChild(el);
    return el;
  }

  function drawStaticBoard() {
    svg.innerHTML = '';
    rect(0, 0, 15, 15, 'cell-path');

    const corners = {
      red: [0, 0],
      green: [9, 0],
      yellow: [9, 9],
      blue: [0, 9]
    };
    Object.entries(corners).forEach(([color, [x, y]]) => {
      rect(x, y, 6, 6, `base-${color}`);
      rect(x + 1, y + 1, 4, 4, 'base-inner');
    });

    BOARD.PATH.forEach(([r, c], idx) => {
      const safe = BOARD.isSafePathIndex(idx);
      rect(c, r, 1, 1, safe ? 'cell-safe' : 'cell-path');
    });

    BOARD.COLORS.forEach((color) => {
      BOARD.HOME_COLUMN[color].forEach(([r, c]) => {
        rect(c, r, 1, 1, `cell-home-${color}`);
      });
    });

    poly([[7, 7], [8, 7], [7.5, 7.5]], 'cell-home-green');
    poly([[8, 7], [8, 8], [7.5, 7.5]], 'cell-home-yellow');
    poly([[8, 8], [7, 8], [7.5, 7.5]], 'cell-home-blue');
    poly([[7, 8], [7, 7], [7.5, 7.5]], 'cell-home-red');

    // Unused corner cells of the center 3x3 — mark as inaccessible with a
    // diagonal ray continuing outward from the board's center.
    const blockedCorners = [
      { x: 6, y: 6, from: [7, 7], to: [6, 6] },
      { x: 8, y: 6, from: [8, 7], to: [9, 6] },
      { x: 6, y: 8, from: [7, 8], to: [6, 9] },
      { x: 8, y: 8, from: [8, 8], to: [9, 9] }
    ];
    blockedCorners.forEach(({ x, y, from, to }) => {
      rect(x, y, 1, 1, 'cell-path');
      line(from[0], from[1], to[0], to[1], 'cell-blocked-line');
    });

    const tokenLayer = document.createElementNS(NS, 'g');
    tokenLayer.setAttribute('id', 'token-layer');
    svg.appendChild(tokenLayer);
  }

  const STACK_OFFSETS = [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]];
  const FINISH_OFFSETS = [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]];

  function drawTokens(state, isMyTurn) {
    const layer = document.getElementById('token-layer');
    layer.innerHTML = '';

    BOARD.COLORS.forEach((color) => {
      const steps = state.tokens[color];
      steps.forEach((s, tokenIndex) => {
        const info = BOARD.cellForToken(color, s);
        let cx, cy;
        if (info.type === 'base') {
          const [r, c] = BOARD.BASE_SLOTS[color][tokenIndex];
          cx = c + 0.5;
          cy = r + 0.5;
        } else if (info.type === 'finished') {
          const [ox, oy] = FINISH_OFFSETS[tokenIndex];
          cx = 7.5 + ox;
          cy = 7.5 + oy;
        } else {
          const [r, c] = info.coord;
          const [ox, oy] = STACK_OFFSETS[tokenIndex];
          cx = c + 0.5 + ox * 0.4;
          cy = r + 0.5 + oy * 0.4;
        }

        const isMovable = isMyTurn && color === myColor && state.movable.indexOf(tokenIndex) !== -1;
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', 0.32);
        circle.setAttribute('class', `token${isMovable ? ' movable' : ''}`);
        circle.setAttribute('fill', `var(--${color})`);
        if (isMovable) {
          circle.addEventListener('click', () => socket.emit('move_token', { tokenIndex }));
        }
        layer.appendChild(circle);
      });
    });
  }
})();
