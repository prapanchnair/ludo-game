# Ludo

Password-gated online Ludo for 2-4 players. Server-authoritative (Node + Express + Socket.IO), plain HTML/SVG client, no build step.

## Run locally

```
npm install
npm start
```

Open http://localhost:3000 in a browser tab per player (or share your LAN IP, e.g. http://192.168.1.x:3000, with a friend on the same network).

Default room password is `ludo123`. Change it:

```
LUDO_PASSWORD=yourpassword npm start
```

Change the port with `PORT=8080 npm start`.

## How it works

- Everyone who joins with the correct password takes the next open seat (red, green, yellow, blue, in that order) in a single shared room.
- Any joined player can click "Start Game" once 2-4 players are in the lobby.
- Refreshing the page reconnects you to your existing seat (your player ID is kept in `localStorage`).
- Rules implemented: must roll a 6 to leave base, extra turn on 6/capture/reaching home, captures send opponents back to base except on the 8 safe cells, three 6s in a row forfeits the turn, first player to bring all 4 tokens home wins.
- Simplification: a stack of 2+ same-color tokens blocks opponents from *landing* on that cell, but doesn't block *passing through* it.

## Hosting beyond localhost

The app has no external dependencies (in-memory game state, single room), so deploying is just running `npm start` on a host and exposing the port — e.g. behind a reverse proxy (Caddy/Nginx) with HTTPS, or a small VPS/Fly.io/Render instance. Ask when you're ready to set that up.
