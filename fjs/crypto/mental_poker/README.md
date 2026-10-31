# Mental poker (`mental_poker`)

Shuffle and deal a deck with no trusted dealer: no player sees where any card
is, and a card is opened only for the player it is dealt to. The scheme is SRA
commutative encryption on an elliptic-curve group.

## How it works

1. **Encode.** Card `i` is the first curve point whose `x` is
   `i | nonce << 8`. Nobody knows a multiplier between two cards, which the
   scheme needs: a player who knew `card1 = k·card0` could find `card1` in any
   locked deck once `card0` is opened.
2. **Lock and shuffle.** Each player, in turn, multiplies every card by a
   secret `s` and permutes the deck. Locks commute: `a·(b·C) = b·(a·C)`.
3. **Open.** To open a card for a player, every other player multiplies it by
   their `s⁻¹ mod n` and hands it on; the player removes the last lock alone
   and finds the card in the plain deck. A card that still holds a lock is not
   in the plain deck, so `open` refuses it.

## API

- `mentalPoker(curve)` — `{ deck, key, open }` over a curve:
  - `deck(size)` — the plain deck, `size` in `0..0x100`, or `null`.
  - `key(secret)` — `{ lock, unlock }`, `secret` in `1..n-1`, or `null`.
  - `open(deck)(card)` — the card's index in the plain deck, or `null`.
- `shuffle(seed)(list)` — the permutation `seed` spells in the factorial number
  system.
- `lockAndShuffle(key)(seed)(deck)` — one player's turn.
- `unlockAll(keys)(card)` — remove several players' locks.

## Limits

Players are trusted to lock, shuffle and unlock honestly, and a player who
leaves stalls the game. Proofs of a correct shuffle and unlock, the message
protocol between players, and dropouts are the open tasks of
[`../todo/mental-poker.md`](../todo/mental-poker.md).
