# Player Strategies
An attempt to lay out play style for bots and bosses

**Shipped Nov 2026** as bot styles in `src/ai/bot.ts` (see the README's
"Tweaking the bots" for who plays which):
- Dickhead → `reckless`: biggest card first. Playing literally every big
  card, 2s and 10s included, won under a tenth of its games against
  strategic bots, so it saves its 2s and 10s like anyone and throws
  jokers at once instead.
- Coward → `coward`, as written: a 2 counts as small.
- Schemer → `schemer`: "pick up the pile" became taking up small piles
  (3 cards or fewer) with a 2, 10 or joker in them, while the deck lasts
  and until their hand reaches 7. Late game, burns when able.
- Nick Strat isn't a style of its own: Nick sits on the player's side.
  Its core (watch the next player, play what they can't answer) is part of
  `sharp`, Greg's style, which plays out its options instead of following
  rules. The taunts would make good table talk.

## Dickhead Strat
### Early game
- Play largest available card
### Mid game
- Play largest available card
### Late game
- Play largest available card(s)

## Coward Strat
### Early game
- Play smallest available card
### Mid game
- Play smallest available card
### Late game
- Play smallest available card(s)

## Schemer Strat
### Early game
- Pick up pile ~~Play smallest available card(s)~~
### Mid game
- Pick up pile ~~Play largest available card~~
### Late game
- Burn pile when able
- Play smallest card(s) ~~Play smallest available card(s)~~

## Nick Strat
Card priority: K, Q, J, 9, 6, 5 ,4 ,3
Power card priority: 10, 8, 2, 7,

### Early game
- Log highest known card and all known power cards for each player. Taunt other players with  "you'll want to play your [card]" or "your [card] wont work on this one"
- When playing a card whos value is 6 or more, say "Sorry sorry sorry"
- On 3 & 4, play anything
- On 5, 6, and 7, play 7. if 7 not available, play anything
- If not me picks up the pile,  play higher card than highest card in previous pile
- When previous player picks up, play 7. if 7 unavailable, play lowest card
- Play any multiples first
- Once the final  card is taken from then  deck, say "Decks out. Harambe."
### Mid game
- if next player has only high cards, play 7
- if thext player has 7, play 9 or higher
- Burnign the pile is the lowest priority to minimize number of cards in the end game
### Late game
- Play order: middle, left, right
- Prioritize buring the pile
- Priorize scewring over the next player
- Prioritize cards lowest to highest 
