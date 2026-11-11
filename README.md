# SHED

A cross-platform (iOS / Android / Web) mobile app for the card game
**Shithead / Shed**, built with React Native + Expo + TypeScript.

> Original rules as spake by Jake the Elder. Long live Jake.

## What's in the app

- 2–6 player **pass-and-play** local multiplayer on one device
- Mix any number of **humans and bots**; every campaign host has their own
  play style, from a beginner to Greg, who thinks ahead
- Full ruleset:
  - Meets-or-beats
  - Power cards: **2** (reset), **7** (force ≤7), **8** (invisible/skip), **10** (burn)
  - **Four-of-a-kind burns** (with 8s in the middle still counting)
  - **Three phases**: hand → face-up → face-down (blind flip)
  - Lowest non-power card starts; draw-to-3 from draw pile
- Pre-game **swap** screen (each player can trade hand ↔ face-up)
- Tap a card to select it, or **hold** one to select every card of its rank
- Pass-the-device privacy gates so humans don't see each other's hands
- **Rule variants** — each campaign table unlocks as a free-play preset
  once you beat it (Justin's Schism, Super Tens, the Outlaw Pass's
  stick-up, Chaos Shed's jokers, the Second Schism, the Council of
  Schisms) with a variant badge
  and an auto-generated rules summary
- Interactive **tutorial** and rules reference screen
- Background **jazz radio**: several streamed stations, HTTPS on native
- **Campaign** on a 16-bit fairytale map you pan across (forest, canyon,
  volcano, lake, marsh, mountains): eight tables from Jake's Classic
  to the Council of Schisms, story cinematics, named hosts with table talk
  and end-of-game lines, nodes that unlock in order. It ends on "to be
  continued" for now; Chris the Scribe's finale isn't built yet
- **Game over** screen with final standings and per-game stats, and an
  in-game **log** of every play
- **Achievements**, remembered on the device
- **Records**: games played, win rate and best streak, a leaderboard by
  player name (friends and hosts alike) and your last 30 games
- **Save and resume**: the game in progress is saved after every play, so
  a refresh or restart picks it back up from Home; Settings has a way to
  leave the table
- Card **sound effects**
- Free play **remembers your last table**: the variant and who sat where
- A **Home screen set at the table**: first-person art of the campaign
  place you've reached (Jake's moonlit wood, the village tavern, the
  heretics' cathedral, Greg's machine hall, the saloon, the twins' big
  top, Justin's cell, the Council table), which moves on as you beat tables; Settings can pin any scene
  you've unlocked
- **Settings** that stick: sound effects on or off, the radio station and
  a normal or fast **game speed** for bot turns
- Pure, fully tested **game engine** (no UI dependency)

### Not yet (deliberate)

- Online multiplayer / accounts (engine is decoupled to make this easy later)
- Haptics
- Spectator mode

## Setup

```bash
# from the project root
npm install
npm start
```

Then:
- Press **i** for iOS simulator (macOS + Xcode required)
- Press **a** for Android emulator (Android Studio required)
- Press **w** for web (opens in browser)
- Scan the QR with **Expo Go** on a physical device

### Repainting the campaign map

```bash
pip install pillow
python3 scripts/map/build_overworld.py
```

Regenerates `assets/map/` and `src/campaign/overworld.json`. See
docs/design/campaign-lore.md (The Campaign Map) for how to add a node.

### Running tests

```bash
npm test
```

The engine tests cover all power cards, rule variants (reverse rank ordered
vs wild, Super Tens, Hard Eights, triple-8 burn, Chaos Shed's jokers), edge cases
(8 in four-of-a-kind, 10 on 7, face-down failed flips), starting-player logic,
and full integration scenarios.

## Project layout

```
.
├── app/                        Expo Router screens (file-based)
│   ├── _layout.tsx             Stack navigator, theme, fonts, radio
│   ├── index.tsx               Home
│   ├── campaign.tsx            The map, panned both ways, with the campaign nodes
│   ├── cinematic.tsx           Story cutscenes (captioned scenes)
│   ├── setup.tsx               The table from above: pick it, seat the players
│   ├── swap.tsx                Pre-game card swap (per player)
│   ├── game.tsx                Main table
│   ├── game-over.tsx           Standings, stats, the host's last word
│   ├── achievements.tsx        Every achievement and how to earn it
│   ├── records.tsx             Totals, leaderboard and recent games
│   ├── rules.tsx               Rules reference
│   └── tutorial.tsx            Interactive tutorial
├── src/
│   ├── engine/                 Pure game logic — no React, no I/O
│   │   ├── types.ts            Card, Player, RuleConfig, GameState, GameEvent
│   │   ├── cards.ts            Deck creation (jokers too), shuffle, labels
│   │   ├── rules.ts            Power cards, meets-or-beats, burns, card worth
│   │   ├── engine.ts           createGame, playCards, pickupPile, etc.
│   │   └── __tests__/          Jest unit tests
│   ├── ai/
│   │   └── bot.ts              The bots: the swap, six play styles, joker targets
│   ├── campaign/
│   │   ├── presets.ts          Rule-variant presets and the ladder order
│   │   ├── characters.ts       Hosts, portraits, table talk, end lines
│   │   ├── story.ts            Cutscene scenes, keyed by preset
│   │   ├── mapMeta.ts          Per-node map labels and taglines
│   │   ├── homeScenes.ts       Home screen scenes and which one shows
│   │   ├── overworld.json      Node positions (generated by scripts/map)
│   │   ├── ruleSummary.ts      Human-readable variant diff
│   │   └── tutorial.ts         Tutorial lesson definitions
│   ├── table/                  The table screen's logic, kept out of the UI
│   │   ├── describeEvents.ts   Captions and summaries from engine events
│   │   ├── tableTalk.ts        What the hosts say after a turn, and heckles
│   │   ├── stickUp.ts          Which stick-ups get the wanted-poster panel
│   │   ├── useBotAutoplay.ts   Plays bot turns at a readable pace
│   │   ├── pacing.ts           Bot-turn timings for each game speed
│   │   ├── handLayout.ts       When a big hand switches to small cards
│   │   ├── seatLayout.ts       Who sits where on the setup screen's table
│   │   └── useAutoClear.ts     Retires short-lived UI state
│   ├── achievements/
│   │   └── achievements.ts     What each achievement is and how it's detected
│   ├── records/
│   │   └── records.ts          What a finished game adds to the record book
│   ├── store/                  Zustand stores
│   │   ├── gameStore.ts        Wraps the engine for the current game
│   │   │                       (saved on device, so it can be resumed)
│   │   ├── campaignStore.ts    Campaign progress (saved on device)
│   │   ├── achievementStore.ts Unlocked achievements (saved on device)
│   │   ├── recordStore.ts      The record book (saved on device)
│   │   ├── profileStore.ts     Player name and settings (saved on device)
│   │   ├── radioStore.ts       The jazz radio
│   │   └── tutorialStore.ts    Tutorial progress
│   ├── audio/
│   │   └── sfx.ts              Card sound effects
│   ├── components/             Shared UI (cards, opponents, pile, hand,
│   │                           turn banner, caption, gates, dialogue,
│   │                           stick-up panel, game log, badges, toasts)
│   └── testing/                Seeded random and image stub for Jest
├── assets/                     Splash art, story art, portraits, map, audio
├── docs/design/                Rules, variants, strategy, campaign lore
├── scripts/map/                Paints the overworld map
├── .github/workflows/          Web build deployed to GitHub Pages on push
├── jest.config.js
├── tsconfig.json               strict mode, @/* alias to src/*
├── babel.config.js
├── app.json                    Expo config, scheme "shed"
├── app.config.js               Web base path for GitHub Pages builds
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

## Tweaking the bots

`src/ai/bot.ts` is small and self-contained; each style is described in
its doc comment. Every bot swaps its three most useful cards face-up before
the deal (novices keep what they were dealt), then plays by its style:

| Style | How it plays | Who |
|-------|--------------|-----|
| strategic | Lowest ordinary card first, all copies; power cards saved | Jake, free-play bots |
| sharp | Plays every option out in dozens of reshuffled deals of the cards it can't see, and picks what wins most | Greg |
| schemer | Strategic, but loots small piles with 2s or 10s in them while the deck lasts, then burns | the Bandit Chief, Tati |
| coward | The smallest card it can play (a 2 counts as small) | Justin, the Lookout, the Acolyte |
| reckless | The biggest ordinary card it can play; throws jokers at once | Gio, the Zealot |
| novice | One legal card at random | the Spreading's pupils |

A host's style is `botStyle` in src/campaign/characters.ts. Against three
strategic bots (a fair share is 25%), sharp wins about a third of its
games, strategic, schemer and coward a fifth to a quarter, reckless about
a tenth (a fifth with jokers) and novices rarely. Free-play bots are
strategic. The style ideas came from docs/design/strategy.md.

## License

For Cousin Jake. Use freely.

## References

- [How to play Shithead](https://cardgames101.com/learn-to-play-the-card-game/shithead)
- [Video walkthrough](https://youtu.be/JZ_Qd5KTy3k?si=3Xt4eJHNrmY2sNoy)