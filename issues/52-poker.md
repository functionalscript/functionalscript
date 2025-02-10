# Mental Poker

Notes:

Users should NOT know a multiplier (see [discrete logarithm problem](https://en.wikipedia.org/wiki/Discrete_logarithm)) between different cards. For example, if a user knows that a card # `0` multiplied by a number `N` becomes a card # `1` then they can find a card # `1`.

See also

- https://github.com/kripod/mental-poker/blob/master/specs/thesis.pdf
- https://geometry.xyz/notebook/mental-poker-in-the-age-of-snarks-part-1
- https://www.cs.purdue.edu/homes/ninghui/courses/Fall05/lectures/355_Fall05_lect25.pdf

## API

```ts
type Game = {
    readonly me: User
    // user's public keys.
    // the list starts with a dealer.
    readonly userList: readonly bigint[]
}

type User = {
    readonly privateKey: PrivateKey
    readonly gamePrivateKey: PrivateKey
}

type PrivateKey = {}

type Result = {
    readonly state: State
    readonly send: readonly Message[]
}

const next = (game: Game) => (state: State) => (message: Message) => Result

type State = {

}
```

## Shuffle After Drop

Four cards: `X`, `Y`, `W`, `V`.

Alice's key is `A`.
Bob's key is `B`.
Charlie's key is `C`.

A card for Bob: Public information:
    1. Alice publishes: `X^A^B^C ^Ai = X^C^B`.
       - Bob knows `X^C`.
    2. Charlie publishes: `X^B^C ^Ci = X^B`.
       - Bob knows `X`.
A card for Alice:
    `Y^A^B^C^Bi^Ci = Y^A`.

`W^A^B^C` and `V^A^B^C` are cards that left.

Then Alice creates a new deck of cards, excludes `Y` and publishes shuffled [`X^A`, `V^A`, `W^A`].
Since Alice knows `X^B` she publishes `X^B^A` for Bob. Then, Bob creates [`X^A^B`, `V^A^B`, `W^A^B`], find and excludes `X^A^B` and publish shuffled [`V^A^B`, `W^A^B`].

Notes:
- there is no reason to shuffle it differently compare to previous shuffle.
- make sure that the public information about difference in shuffling doesn't reveal information about RND seed.
- if Charlie's cards and then dropped, the cards are back to the deck, because we don't know which card we should remove from the deck! The question is should we always return cards that folded?

## Using VDF (Verifiable Delay Function)

Using VDF to open cards even if a player is offline. All players encrypt cards and then decrypt required cards encrypt them with VDF and send to everyone. For example,

1. A, B, C - shuffle cards:
2. A and B decrypt and encrypt with VDF cards for C
3. A and C decrypt and encrypt with VDF cards for B
4. B and C decrypt and encrypt with VDF cards for A
5. A and B and C decrypt and encrypt with VDF community cards

Decrypt and encrypt with VDF means: a card is decrypted with the original key 'K' and then encrypted with a new unique key 'Ki'. This encrypted card then published for a next player. And the key 'Ki' is published as encrypted with VDF.

Users need to decrypt VDF values only if a player is dropped out.

Alice's keys:
- 'A' - the original key.
- 'A0', 'A1' - for Bob.
- 'A2', 'A3' - for Charlie.
- 'A4', 'A5', 'A6' - for community.

'A0',...,'A6' are published with different delays.

For blockchain implementation: the first observer who reveals VDF values receives a small amount.

## Opening Cards with ZK proof

1. Alice published shuffled `ca`: c^A = ca
2. Bob published shuffled `cab`: ca^B = cab

Opening for Alice:

1. Bob published `ca` associated with `cab`: cab^BR = ca
2. Alice unpacked `c` from `ca`: cab^AR = c

Opening for Bob:

1. Alice published `cb` associated with `cab`: cab^AR = cb
2. Alice unpacked `c` from `ca`: cab^AR = c

|A                 |         | B                   |
|------------------|---------|---------------------|
|                  |    G    |                     |
|a                 |         |                     |
|X = G^a           |  - X -> | X                   |
|k = rnd(q)        |         |                     |
|H = G^k           |  - H -> | H                   |
|c                 | <- c -  | c = rnd(q)          |
|s = (a*c + k) % q |  - s -> | check G^s = X^c * H |

`G^s = G^(ac + k) = (G^a)^c * G^k = X^c * H`

Alice should share `G^k` before she knows `c`!

o -> oA -> oAB -> oABC

---

| c0, c1, ...     |                 |                   |                |           |
| c0a = c0^a, ... |  - cIa , ... -> | cIa, ...          |                |           |
|                 |                 | cJab = cJa^b, ... | - cJab, ... -> | cJab, ... |

o
|A
v
oa   ob B(checks) oc  C(checks)   od   D(checks)
|B   ^            ^               ^
v    |A           |A              |A
oab               oac C(remember) oad  D(remember)
|C                ^               ^
v                 |B              |B
oabc                              oabd D(remember)
|D                                ^
v                                 |C
oabcd

----

o
| A
v
oa
| B
v
oab
| C
v
oabc
| D
v
oabcd

Open for A:
1. D decode an item from `oabc` and publish.
2. C decode an item from `oab` and publish.
3. B decode an item from `oa` and publish.
4. A decode an item from `o`.

If any of the players doesn't decode, then the player is excluded from the game.

Open for B:

1. D decode an item from `oabc` and publish.
2. C decode an item from `oab` and publish.
3. A decode an item from `ob` and publish.
4. B decode an item from `o`.

---

Circle

o -A-> oa --B-> oab --C-> oabc --D-> oabcd
       ob <-A-/           |          |
       oc <-A-- oac <-B---/          |
       od <-A-- oad <-B-- oabd <-C---/

0 -1- 01 -2- 012 -3- 0123 -4- 01234
      02 -1-
      03 -4- 034 -1- 0134 -2-
      04 -3-

0 -1- 01 -2- 012 -3- 0123 -4- 01234 -5- 012345 -6- 0123456 -7- 01234567 -8- 012345678
      02 -1-
      03 -4- 034 -1- 0134 -2-
      04 -3-
      05 -6- 056 -7- 0567 -8- 05678 -1- 015678 -2- 0125678 -3- 01235678 -4- 012345678
      06 -5-
      07 -8- 078 -5- 0578 -6-
      08 -7-

() - (0) - (01) - (012)
     (1)   (12)
     (2)   (02)

[]
[0] [1] [2] [3]
[01] [02] [03] [12] [13] [23]
[012] [013] [023] [123]
[0123]

14641

1
1  1
1  2  1
1  3  3   1
1  4  6   4   1
1  5 10  10   5   1
1  6 15  20  15   6   1
1  7 21  35  35  21   7   1
1  8 28  56  70  56  28   8  1
1  9 36  84 126 126  84  36  9  1
1 10 45 120 210 252 210 120 45 10 1 : 2^10 = 1024

|  |0  |1  |2  |3  |
|--|---|---|---|---|
|[]|[0]|[1]|[2]|[3]|

|   |0   |1   |2   |3   |
|---|----|----|----|----|
|[0]|    |[01]|[02]|[03]|
|[1]|[10]|    |[12]|[13]|
|[2]|[20]|[21]|    |[23]|
|[3]|[30]|[31]|[32]|    |

|    |0    |1    |2    |3    |
|----|-----|-----|-----|-----|
|[01]|     |     |[012]|[013]|
|[02]|     |[021]|     |[023]|
|[03]|     |[031]|[032]|     |
|[12]|[120]|     |     |[123]|
|[13]|[130]|     |[132]|     |
|[23]|[230]|[231]|     |     |

|     |0     |1     |2     |3     |
|-----|------|------|------|------|
|[012]|      |      |      |[0123]|
|[013]|      |      |[0132]|      |
|[023]|      |[0231]|      |      |
|[123]|[1230]|      |      |      |

--- open for 0 ---

|   |0   |1   |2   |3   |
|---|----|----|----|----|
|[0]|    |[01]|[02]|[03]|

|    |0    |1    |2    |3    |
|----|-----|-----|-----|-----|
|[01]|     |     |[012]|[013]|
|[02]|     |[021]|     |[023]|
|[03]|     |[031]|[032]|     |

|     |0     |1     |2     |3     |
|-----|------|------|------|------|
|[012]|      |      |      |[0123]|
|[013]|      |      |[0132]|      |
|[023]|      |[0231]|      |      |

