# Shed — Campaign Lore Bible

Working document. Canon lives here; what ships lives in `src/campaign/story.ts`
(dialogue beats) and `src/campaign/characters.ts` (cast, quips, reactions).
Write freely here — nothing in this file is a commitment.

## The Story

**Act I — The Teaching.** Erich, Nick, and Garrett are students. Jake the
Elder comes into town and teaches them the ways of Shed, completely altering
their lives. They become disciples. Jake writes nothing down: the rules live
only in the telling ("as spake by Jake"). That oral tradition is what lets the
teachings drift in Act III, and what makes Chris's written copy matter in
Act IV.

**Act II — The Spreading.** The disciples go forth and spread the teachings
throughout the land. Things go well at first. Chris is one of the people they
teach (planned: he appears in the crowd of The Spreading), and he is the one
who starts writing the rules down.

**Act III — The Schisms.** Dissent emerges. The teachings fracture. Every
table now plays by its own corrupted rules. The disciples set out on a
campaign of redemption — a descent (Dante's Inferno structure, tentative)
through each schism, confronting its author at their own table, by their own
rules.

**Act IV — The Scribe.** At the bottom of the descent sits Chris — the one
who wrote the rules down. He holds the pen, and the pen is ultimate power:
he can rewrite the rules at any time, even mid-game.

## The Descent (boss ladder)

| Node | Variant | Dissenter | The corruption |
|------|---------------------|--------------------|----------------------------------------|
| 1 | Jake's Classic | Jake the Elder | None — the pure teaching (tutorial/origin) |
| 2 | The Spreading | The Farmhand, the Noble, the Barkeep | None — Act II made playable: you're the teacher now, at a table of three novice pupils |
| 3 | Justin's Schism | Justin | The first dissenter: "the old rules were too soft" |
| 4 | Super Tens | Greg the Computer Lord | Cheats, denies, rewrites reality verbally |
| 5 | Chaos Shed | The Chaos Twins | Chaos for its own sake (future: the joker edition) |
| 6 | The 69 | Nina | Inversion — reads everything upside down |
| 7 | The OFCOM Standard | Trevor | Bureaucratization of the sacred teachings |
| 8 | The Backpacker's Codex | The Backpacker | Syncretism — every corruption at once. The final trial. |
| 9 | (new variant, unnamed) | **Chris the Scribe** | Holds the pen. Rewrites rules MID-GAME. |

Open question: does Chris displace the Backpacker as the finale, or sit
after them as node 9? Current lean: node 9 — the Codex ("every rule at
once") is a fitting final exam before facing the one who wrote them.

## Chris the Scribe — boss design notes

Origin (real life): Chris was not taught by Jake. Nick and Garrett taught him
later, and he took off writing the rules down in his phone notes and sharing
them. Whenever anyone asks for the rules now, they get sent Chris's notes. So
the written rules everyone plays by are Chris's version, and whoever holds the
notes can change them. In-world, the notes need a medieval equivalent (a
ledger, a scroll, a book of rules) — undecided.

Real-life gimmick source: Chris often played when it wasn't his turn.

The gimmick is architecturally cheap: the engine reads `state.ruleConfig` on
every call and nothing assumes it is constant. A rewrite is: swap the config,
emit a `ruleRewritten` event, announce it loudly in the UI.

Design directions (pick one, tune in playtesting):
- **Reactive rewrites (current favorite):** whenever a rule hurts Chris, he
  rewrites THAT rule. Burn his pile with triple 8s → triple 8s no longer
  burn. You exploit 7-or-lower → 7s become normal. Sore loser with a pen.
- **Scheduled rewrites:** every N turns, one rule flips, telegraphed a turn
  in advance ("Chris uncaps the pen...").
- **Escalating rewrites:** starts as Jake's Classic (the original manuscript)
  and drifts one rule per rewrite toward hostile config.

Constraints to respect:
- Every rewrite must be announced (interstitial + table-talk bubble + log
  entry). Silent rule changes will read as bugs.
- Rewrites should never invalidate cards already on the pile — only future
  plays. (Engine handles this naturally; each play re-checks current config.)
- The player should be able to open the rules sheet mid-game and see the
  CURRENT ruleset (the rules screen already renders from ruleConfig).
- Consider a hard cap (e.g. 3 rewrites per game) so the fight is unfair in a
  fun way, not a fair way of being unfair.

## The Protagonists

Erich, Nick, and Garrett — the three students (see reference art: the
Ancient Learners' Deck). In the story art: Erich has the beard, Nick wears
glasses, Garrett is clean-shaven (middle of intro1.png).

Real life: Jake taught Erich, and Erich taught Nick and Garrett. The story
has all three learn from Jake because it reads better.

Shipped: the player chooses which disciple to play as on the campaign setup
screen (`HEROES` in characters.ts, `heroId` in campaignStore). It replaces
"Player 1" as the human's name in campaign games, with portraits in
assets/characters/ (erich.png, nick.png, garrett.png).

Other candidate uses:
- Interstitial narration voice between nodes ("Nick swore he saw Greg's
  sleeve move").
- Multiplayer seats when local multiplayer lands (three heroes, three seats).

## Structure notes

- Map direction: the current campaign map climbs UPWARD (start at bottom).
  A Dante descent inverts this — start at the top, scroll DOWN into the
  final table. Two-line change in app/campaign.tsx when the framing is
  locked in.
- Pre-game dialogue: first visit to each node plays a short
  CharacterDialogue exchange (disciple vs. dissenter) before the deal.
  Beats live in src/campaign/story.ts, keyed by preset id.
- Post-game: the node's host speaks one line on the results screen, from
  `endLines` in characters.ts (a win pool and a loss pool). Jake has his;
  every other host still needs theirs.
- The joker edition (Twin Aek reverses direction, Twin Yee swaps hands)
  remains foretold for Chaos Shed — Aek's quip already plants it.

## Open questions

- Inferno framing: full commit (circle numbers, "descend" language, map
  inversion) or just structural inspiration?
- Does beating Chris restore Jake's Classic as "the one true rule set", or
  is the ending that all schisms are legitimate tables? (The second reading
  is warmer and matches how card games actually live.)
- Chris's variant name: The Scribe's Edict? The Manuscript? Errata?
- Do the three protagonists have distinct roles/personalities, or are they
  interchangeable player skins?