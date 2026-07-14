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
  const logList = document.getElementById('log-list');
  const toast = document.getElementById('toast');
  const svg = document.getElementById('board-svg');

  const NS = 'http://www.w3.org/2000/svg';
  let myPlayerId = localStorage.getItem('ludoPlayerId') || null;
  let myColor = null;
  let boardDrawn = false;
  let latestState = null;

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
    localStorage.setItem('ludoPlayerId', playerId);
  });

  socket.on('state', (state) => {
    latestState = state;
    const me = state.players.find((p) => p.isYou);
    if (me) myColor = me.color;
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
  diceEl.addEventListener('click', () => {
    if (!latestState || latestState.phase !== 'playing') return;
    if (latestState.currentPlayerId !== myPlayerId) return;
    if (latestState.hasRolled) return;
    socket.emit('roll_dice');
  });

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
    } else {
      winnerBanner.classList.add('hidden');
      turnBanner.textContent = currentPlayer
        ? `${isMyTurn ? "Your" : currentPlayer.name + "'s"} turn (${state.currentColor})`
        : '';
    }

    diceEl.textContent = state.dice != null ? state.dice : '?';
    BOARD.COLORS.forEach((c) => diceEl.classList.remove(`dice-${c}`));
    if (state.currentColor) diceEl.classList.add(`dice-${state.currentColor}`);
    diceEl.classList.toggle('dice-active', canRoll);

    logList.innerHTML = '';
    state.log.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      logList.appendChild(li);
    });

    drawTokens(state, isMyTurn);
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
