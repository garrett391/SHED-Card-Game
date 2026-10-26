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

Locked nodes are real people and real house rules. Nothing goes on the
ladder until both are known; there are no placeholder nodes.

| Node | Variant | Host | The corruption | Status |
|------|---------|------|----------------|--------|
| 1 | Jake's Classic | Jake the Elder | None — the pure teaching (tutorial/origin) | Locked |
| 2 | The Spreading | The Farmhand, the Noble, the Barkeep | None — Act II made playable: you teach three novice pupils | Locked |
| 3 | Justin's Schism | Justin | Hard 8s: "the old rules were too soft" | Locked |
| 4 | Super Tens | Greg the Computer Lord | Cheats, denies, rewrites reality verbally | Locked |
| 5 | Chaos Shed | Gio and Tati, the Chaos Twins | Two jokers: reverse play, swap hands (see below) | Locked |
| … | (open slots) | | | |
| Finale | (unnamed) | **Chris the Scribe** | Holds the pen. Rewrites rules MID-GAME. | Not built |

Chris is the finale, however many nodes come before him. The ladder ends
at Chaos Shed in the shipped game until the next real table is decided.

Removed (Oct 2026): The 69 (Nina), The OFCOM Standard (Trevor) and The
Backpacker's Codex (the Backpacker) were AI-generated filler from early
drafting and are gone from the game. The engine flags they used
(`sixNineReverse`, `tripleTransparentBurns`, `burnRankRestricted`,
`lastManStanding`) still exist and are tested, so a future real table can
reuse them. The 69 itself is a real house rule (game-rules-variations.md)
and is a candidate for a slot if a real host is attached to it.

Candidate material for the open slots (real, from our own notes):
- The 69: reverse rotation, or the 2-for-1 special.
- Wild / Tame Jokers.
- Unforced Play (invented by Christian the Davis?). Possibly Chris's base
  rule before the pen comes out.
- The Great Counselor / The Forerunner, Jake's tutor
  (storyboards/counsel-members.md): epilogue after Chris?

### Adding a node

Every per-node table is keyed by preset id, so a node is additive:
1. Preset in `RULE_PRESETS` and its id in `PRESET_ORDER` (presets.ts).
   Order there is the ladder order.
2. Map scene in `MAP_SCENES` (mapMeta.ts).
3. Host(s) in `CHARACTERS` and `VARIANT_OPPONENTS` (characters.ts), with
   portraits in assets/characters/.
4. Optional cinematic in `CINEMATICS` (story.ts).
5. Its region on the overworld map (see The Campaign Map).

## Chaos Shed — the Chaos Twins

Gio (red and blue jester) and Tati (purple and green). You face them
together. Voice: unhinged, Batman's-Joker energy: laughing at the rules,
delighted by fire, talking to the deck. No real-world location.

The joker edition, shipped Oct 2026 (`jokers: true` on the preset):
- Two jokers per deck (four with two decks): a red joker and a black joker.
- Both are wild (playable on anything) and invisible on the pile, like the
  8: the next player plays on whatever is under them.
- Red joker: reverses the direction of play.
- Black joker: swaps your hand with another player's, after you draw back
  up to three. You choose who; a blind face-down flip swaps with the next
  player. If the joker was your last card you're out and nothing swaps.
  Swapping for an empty hand can put you out.
- Bots save jokers for last and steal the smallest hand.

The 9 no longer reverses in Chaos Shed; it was a stand-in until jokers
existed.

## The Campaign Map

Shipped Oct 2026: a Super Mario World-style 16-bit overworld (repainted from 8-bit the same month). The three
heroes stand at the current node and the map climbs from the bottom:
Jake's old wood (forest and campfire), the village of The Spreading
(cottages, pond, wheat), Justin's chapel on a plateau with its graveyard,
Greg's machine keep in an ashland of lava, and Gio and Tati's carnival
(big top, checker plaza, balloons). Above the last node, a fog bank hides
the rest of the land, with Chris's tower and quill rising out of it. The
tower is scenery, not a node.

How it's built: `scripts/map/build_overworld.py` paints the land as pixel
art and writes `assets/map/overworld.png`, `assets/map/heroes.png` and the
node positions in `src/campaign/overworld.json`. app/campaign.tsx draws the
image and lays live node markers over it. To add a node, write a painter
for its region, add it to `REGIONS` in ladder order and re-run the script
(a test fails if the map and `PRESET_ORDER` disagree). The fog band moves
up as regions are added.

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

Decided (Oct 2026): the player does NOT pick one of the three. A "choose
your disciple" picker shipped briefly and was removed. It changed only a name
and a portrait, the cinematics always speak of the three as a group, and it
blocked the first deal on a choice with no basis. The player stands in for
the disciples as a whole; in campaign the human seat is named by the player
(default "Player 1"), same as free play. "You" was rejected as the default
because engine log lines read "You picks up the pile".

The disciple portraits (erich.png, nick.png, garrett.png in
assets/characters/) are kept for later use, e.g.:
- Interstitial narration voice between nodes ("Nick swore he saw Greg's
  sleeve move").
- Multiplayer seats when local multiplayer lands (three heroes, three seats).

## Structure notes

- Map direction: the overworld climbs UPWARD (start at the bottom) toward
  Chris's tower. A Dante-style descent would mean repainting the map.
- Pre-game dialogue: first visit to each node plays a short
  CharacterDialogue exchange (disciple vs. dissenter) before the deal.
  Beats live in src/campaign/story.ts, keyed by preset id.
- Post-game: the node's host speaks one line on the results screen, from
  `endLines` in characters.ts (a win pool and a loss pool). Jake has his;
  every other host still needs theirs.

## Open questions

- Inferno framing: full commit (circle numbers, "descend" language, map
  inversion) or just structural inspiration?
- Does beating Chris restore Jake's Classic as "the one true rule set", or
  is the ending that all schisms are legitimate tables? (The second reading
  is warmer and matches how card games actually live.)
- Chris's variant name: The Scribe's Edict? The Manuscript? Errata?
- ~~Do the three protagonists have distinct roles/personalities, or are they
  interchangeable player skins?~~ Neither: they're the story's collective
  protagonist, not a player choice (see The Protagonists).