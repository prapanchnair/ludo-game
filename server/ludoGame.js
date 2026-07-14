const BOARD = require('../public/js/board');

const MAX_PLAYERS = 4;
const SEAT_ORDER = BOARD.COLORS; // ['red','green','yellow','blue']

class LudoGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'finished'
    this.players = []; // { id, name, color, connected }
    this.tokens = {}; // color -> [stepsTaken x4]
    BOARD.COLORS.forEach((c) => {
      this.tokens[c] = [0, 0, 0, 0];
    });
    this.turnIndex = 0; // index into this.players
    this.dice = null; // last rolled value
    this.hasRolled = false;
    this.movable = []; // token indexes movable with current dice for current player
    this.consecutiveSixes = 0;
    this.winners = []; // colors in finishing order
    this.log = [];
    this.gamesPlayed = 0; // used to rotate who starts each new game
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 50) this.log.shift();
  }

  findPlayer(playerId) {
    return this.players.find((p) => p.id === playerId);
  }

  addPlayer(playerId, name) {
    const existing = this.findPlayer(playerId);
    if (existing) {
      existing.connected = true;
      existing.name = name || existing.name;
      this.addLog(`${existing.name} reconnected.`);
      return existing;
    }
    if (this.phase !== 'lobby') {
      throw new Error('Game already in progress — cannot join now.');
    }
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full (4 players max).');
    }
    const color = SEAT_ORDER[this.players.length];
    const player = { id: playerId, name: name || color, color, connected: true };
    this.players.push(player);
    this.addLog(`${player.name} joined as ${color}.`);
    return player;
  }

  disconnectPlayer(playerId) {
    const p = this.findPlayer(playerId);
    if (!p) return;
    p.connected = false;
    this.addLog(`${p.name} disconnected.`);
    if (this.phase === 'lobby') {
      // free the seat entirely so someone else can take the color
      this.players = this.players.filter((pl) => pl.id !== playerId);
    }
  }

  resetRoom() {
    this.reset();
    this.addLog('Room was reset. Waiting for players to join.');
  }

  startGame(playerId) {
    if (this.phase !== 'lobby') throw new Error('Game already started.');
    if (this.players.length < 2) throw new Error('Need at least 2 players to start.');
    this.phase = 'playing';
    this.turnIndex = 0;
    this.dice = null;
    this.hasRolled = false;
    this.movable = [];
    this.consecutiveSixes = 0;
    this.gamesPlayed++;
    this.addLog('Game started. ' + this.currentPlayer().name + ' goes first.');
  }

  playAgain(playerId) {
    if (this.phase !== 'finished') throw new Error('Game is not over yet.');
    if (this.players.length < 2) throw new Error('Need at least 2 players to start.');
    BOARD.COLORS.forEach((c) => {
      this.tokens[c] = [0, 0, 0, 0];
    });
    this.winners = [];
    this.dice = null;
    this.hasRolled = false;
    this.movable = [];
    this.consecutiveSixes = 0;
    this.turnIndex = this.gamesPlayed % this.players.length;
    this.gamesPlayed++;
    this.phase = 'playing';
    this.addLog('New game started. ' + this.currentPlayer().name + ' goes first.');
  }

  currentPlayer() {
    return this.players[this.turnIndex];
  }

  activePlayers() {
    return this.players.filter((p) => this.winners.indexOf(p.color) === -1);
  }

  advanceTurn() {
    this.dice = null;
    this.hasRolled = false;
    this.movable = [];
    this.consecutiveSixes = 0;
    if (this.players.length === 0) return;
    let attempts = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      attempts++;
    } while (
      this.winners.indexOf(this.players[this.turnIndex].color) !== -1 &&
      attempts <= this.players.length
    );
  }

  computeMovable(color, diceValue) {
    const movable = [];
    const myTokens = this.tokens[color];
    for (let i = 0; i < 4; i++) {
      const steps = myTokens[i];
      if (steps === 0) {
        if (diceValue !== 6) continue;
        movable.push(i);
        continue;
      }
      if (steps >= BOARD.TOTAL_STEPS) continue; // already finished
      const dest = steps + diceValue;
      if (dest > BOARD.TOTAL_STEPS) continue; // overshoot, needs exact count
      if (this.isBlockedByOpponent(color, dest)) continue;
      movable.push(i);
    }
    return movable;
  }

  // True if destination path cell holds 2+ of the *same* opposing color (a blockade).
  isBlockedByOpponent(color, destSteps) {
    const info = BOARD.cellForToken(color, destSteps);
    if (info.type !== 'path') return false;
    for (const other of BOARD.COLORS) {
      if (other === color) continue;
      const count = this.countAt(other, info.pathIndex);
      if (count >= 2) return true;
    }
    return false;
  }

  countAt(color, pathIndex) {
    let count = 0;
    this.tokens[color].forEach((steps) => {
      if (steps >= 1 && steps < BOARD.HOME_COLUMN_START) {
        const idx = (BOARD.START_OFFSET[color] + steps - 1) % 52;
        if (idx === pathIndex) count++;
      }
    });
    return count;
  }

  rollDice(playerId) {
    if (this.phase !== 'playing') throw new Error('Game is not in progress.');
    const player = this.currentPlayer();
    if (!player || player.id !== playerId) throw new Error('Not your turn.');
    if (this.hasRolled) throw new Error('You already rolled this turn.');

    const value = 1 + Math.floor(Math.random() * 6);
    this.dice = value;
    this.hasRolled = true;

    if (value === 6) {
      this.consecutiveSixes++;
    } else {
      this.consecutiveSixes = 0;
    }

    if (this.consecutiveSixes === 3) {
      this.addLog(`${player.name} rolled three 6s in a row — turn forfeited.`);
      this.movable = [];
      return { value, forfeited: true, needsAdvance: true };
    }

    this.movable = this.computeMovable(player.color, value);
    this.addLog(`${player.name} rolled a ${value}.`);

    if (this.movable.length === 0) {
      this.addLog(`${player.name} has no valid moves.`);
      return { value, noMoves: true, needsAdvance: true };
    }

    return { value, movable: this.movable };
  }

  moveToken(playerId, tokenIndex) {
    if (this.phase !== 'playing') throw new Error('Game is not in progress.');
    const player = this.currentPlayer();
    if (!player || player.id !== playerId) throw new Error('Not your turn.');
    if (!this.hasRolled) throw new Error('Roll the dice first.');
    if (this.movable.indexOf(tokenIndex) === -1) throw new Error('That token cannot move.');

    const color = player.color;
    const steps = this.tokens[color][tokenIndex];
    const dest = steps === 0 ? 1 : steps + this.dice;
    this.tokens[color][tokenIndex] = dest;

    let captured = false;
    const info = BOARD.cellForToken(color, dest);
    if (info.type === 'path' && !BOARD.isSafePathIndex(info.pathIndex)) {
      for (const other of BOARD.COLORS) {
        if (other === color) continue;
        this.tokens[other].forEach((otherSteps, otherIdx) => {
          if (otherSteps >= 1 && otherSteps < BOARD.HOME_COLUMN_START) {
            const idx = (BOARD.START_OFFSET[other] + otherSteps - 1) % 52;
            if (idx === info.pathIndex) {
              this.tokens[other][otherIdx] = 0;
              captured = true;
              this.addLog(`${player.name}'s token captured an opponent's ${other} token!`);
            }
          }
        });
      }
    }

    let finishedToken = dest >= BOARD.TOTAL_STEPS;
    if (finishedToken) {
      this.addLog(`${player.name} brought a token home!`);
    }

    const wonGame = finishedToken && this.tokens[color].every((s) => s >= BOARD.TOTAL_STEPS);
    if (wonGame && this.winners.indexOf(color) === -1) {
      this.winners.push(color);
      this.addLog(`${player.name} (${color}) finished all tokens and wins!`);
      if (this.winners.length >= this.players.length - 1 || this.players.length <= 1) {
        this.phase = 'finished';
      }
    }

    this.movable = [];
    const rolledSix = this.dice === 6;
    const extraTurn = rolledSix || captured || finishedToken;

    if (this.phase === 'finished') {
      this.dice = null;
      this.hasRolled = false;
      return { captured, finishedToken, wonGame, needsAdvance: false };
    }

    let needsAdvance = false;
    if (extraTurn) {
      this.dice = null;
      this.hasRolled = false;
      if (!rolledSix) this.consecutiveSixes = 0;
      this.addLog(`${player.name} gets another turn.`);
    } else {
      needsAdvance = true;
    }

    return { captured, finishedToken, wonGame, needsAdvance };
  }

  getState(forPlayerId) {
    return {
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
        isYou: p.id === forPlayerId
      })),
      tokens: this.tokens,
      currentColor: this.players[this.turnIndex] ? this.players[this.turnIndex].color : null,
      currentPlayerId: this.players[this.turnIndex] ? this.players[this.turnIndex].id : null,
      dice: this.dice,
      hasRolled: this.hasRolled,
      movable: this.movable,
      winners: this.winners,
      log: this.log.slice(-15)
    };
  }
}

module.exports = { LudoGame, MAX_PLAYERS };
