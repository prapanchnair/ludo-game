const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { LudoGame } = require('./server/ludoGame');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.LUDO_PASSWORD || 'ludo123';
const TURN_TRANSITION_MS = 900; // lets players see the rolled number before the turn moves on

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const game = new LudoGame();

function broadcastState() {
  for (const [id, socket] of io.of('/').sockets) {
    socket.emit('state', game.getState(socket.data.playerId));
  }
}

io.on('connection', (socket) => {
  socket.on('join', ({ password, name, playerId }) => {
    if (password !== PASSWORD) {
      socket.emit('error_msg', 'Incorrect password.');
      return;
    }
    const id = playerId && game.findPlayer(playerId) ? playerId : nanoid(12);
    try {
      const player = game.addPlayer(id, (name || '').trim().slice(0, 20));
      socket.data.playerId = player.id;
      socket.emit('joined', { playerId: player.id, color: player.color });
      broadcastState();
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('start_game', () => {
    if (!socket.data.playerId) return;
    try {
      game.startGame(socket.data.playerId);
      broadcastState();
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('play_again', () => {
    if (!socket.data.playerId) return;
    try {
      game.playAgain(socket.data.playerId);
      broadcastState();
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('roll_dice', () => {
    if (!socket.data.playerId) return;
    try {
      const result = game.rollDice(socket.data.playerId);
      broadcastState();
      if (result.needsAdvance) {
        setTimeout(() => {
          game.advanceTurn();
          broadcastState();
        }, TURN_TRANSITION_MS);
      }
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('move_token', ({ tokenIndex }) => {
    if (!socket.data.playerId) return;
    try {
      const result = game.moveToken(socket.data.playerId, tokenIndex);
      broadcastState();
      if (result.needsAdvance) {
        setTimeout(() => {
          game.advanceTurn();
          broadcastState();
        }, TURN_TRANSITION_MS);
      }
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('chat_message', ({ text } = {}) => {
    if (!socket.data.playerId) return;
    try {
      game.addChatMessage(socket.data.playerId, text);
      broadcastState();
    } catch (err) {
      socket.emit('error_msg', err.message);
    }
  });

  socket.on('reset_room', ({ password } = {}) => {
    if (!socket.data.playerId && password !== PASSWORD) {
      socket.emit('error_msg', 'Incorrect password.');
      return;
    }
    game.resetRoom();
    broadcastState();
  });

  socket.on('disconnect', () => {
    if (socket.data.playerId) {
      game.disconnectPlayer(socket.data.playerId);
      broadcastState();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Ludo server running at http://localhost:${PORT}`);
  console.log(`Room password: ${PASSWORD}`);
});
