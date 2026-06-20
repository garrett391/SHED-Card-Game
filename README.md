# SHED — v1 starter

A cross-platform (iOS / Android / Web) mobile app for the card game
**Shithead / Shed**, built with React Native + Expo + TypeScript.

> Original rules as spake by Cousin Jake. Long live Elder Jake.

## What's in v1

- 2–6 player **pass-and-play** local multiplayer on one device
- Mix any number of **humans and bots** (simple heuristic AI)
- Full ruleset:
  - Meets-or-beats
  - Power cards: **2** (reset), **7** (force ≤7), **8** (invisible/skip), **10** (burn)
  - **Four-of-a-kind burns** (with 8s in the middle still counting)
  - **Three phases**: hand → face-up → face-down (blind flip)
  - Lowest non-power card starts; draw-to-3 from draw pile
- Pre-game **swap** screen (each player can trade hand ↔ face-up)
- Pass-the-device privacy gates so humans don't see each other's hands
- Rules reference screen
- Pure, fully tested **game engine** (24 unit tests, no UI dependency)

### Not in v1 (deliberate)

- Online multiplayer / accounts (engine is decoupled to make this easy later)
- Animations, sound, haptics
- Stats / history / leaderboards
- Tutorials, rule variants
- Spectator mode

## Setup

```bash
cd shed-app
npm install
npm start
```

Then:
- Press **i** for iOS simulator (macOS + Xcode required)
- Press **a** for Android emulator (Android Studio required)
- Press **w** for web (opens in browser)
- Scan the QR with **Expo Go** on a physical device

### Running tests

```bash
npm test
```

The engine has 24 unit tests covering all power cards, edge cases (8 in
four-of-a-kind, 10 on 7, face-down failed flips), starting-player logic, and
full integration scenarios.

## Project layout

```
shed-app/
├── app/                        Expo Router screens (file-based)
│   ├── _layout.tsx             Stack navigator + theme
│   ├── index.tsx               Home
│   ├── setup.tsx               Pick players (human / bot, names)
│   ├── swap.tsx                Pre-game card swap (per player)
│   ├── game.tsx                Main table
│   ├── game-over.tsx           Winner / shithead announcement
│   └── rules.tsx               Rules reference
├── src/
│   ├── engine/                 Pure game logic — no React, no I/O
│   │   ├── types.ts            Card, Player, GameState, GameEvent
│   │   ├── cards.ts            Deck creation, shuffle, labels
│   │   ├── rules.ts            Power cards, meets-or-beats, 4-of-a-kind
│   │   ├── engine.ts           createGame, playCards, pickupPile, etc.
│   │   └── __tests__/          Jest unit tests
│   ├── ai/
│   │   └── bot.ts              Heuristic bot — easily swappable
│   ├── store/
│   │   └── gameStore.ts        Zustand store wrapping the engine
│   │   └── radioStore.ts       Zustand store wrapping the jazz radio
│   └── components/
│       ├── theme.ts            Colors + spacing tokens
│       ├── Button.tsx
│       ├── PlayingCard.tsx
│       ├── OpponentStrip.tsx   Compact opponent display
│       └── Center.tsx          Draw / pile / burned columns
├── jest.config.js
├── tsconfig.json               strict mode, @/* alias to src/*
├── babel.config.js
├── app.json                    Expo config, scheme "shed"
└── package.json
```

## Architecture

The **engine is pure**. `playCards(state, playerIdx, cardIds)` returns
`{ state, events }` — no mutation, no side effects, no React. This means:

- The same engine drives the UI today and could drive a Node/server-side
  authoritative game tomorrow.
- Every rule is unit-testable in isolation.
- The bot consumes the same `GameState` the UI does. You can swap it for
  MCTS, a neural network, or a remote player without touching the engine.

The **Zustand store** is the only mutable container. It wraps the engine
and adds UI-only state (selected card IDs, "hand revealed" flag for the
privacy gate, last events for the in-game banner).

Screens read from the store via selector hooks (`useGameStore(s => s.game)`)
and dispatch via action methods (`playSelected`, `pickup`, etc.).

## Extending toward online multiplayer

Because the engine is pure and serializable:

1. Replace `useGameStore.startGame` with a server-issued initial state.
2. Send player intent (e.g. `{ type: 'play', cardIds: [...] }`) to a
   server that runs `engine.playCards` authoritatively.
3. Broadcast the new `GameState` (or a delta) to all clients.
4. Clients render from whatever state arrives — no engine logic on the
   client at all if you want strict authority.

The `GameEvent` array returned from each engine action is designed to
power both the UI banner and a future replay / animation system.

## Tweaking the bot

`src/ai/bot.ts` is intentionally tiny (~50 lines) and self-contained.
Strategy notes are in the file's doc comment. To make it harder:

- Track opponent card counts and avoid playing 7s into someone with low cards
- Save 2s for when the pile is about to overwhelm you
- Hold a 10 until the pile is large
- Prefer to burn during your own extra turn so you don't gift the next player a clean pile

## License

For Cousin Jake. Use freely.
