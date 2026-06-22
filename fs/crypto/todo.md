# Mental Poker

**Priority:** P3
**Status:** open

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

## Drop

A number of decks required to handle folds.

 0:    1: 1
 1:    2: 1  1
 2:    4: 1  2  1
 3:    8: 1  3  3   1
 4:   16: 1  4  6   4   1
 5:   32: 1  5 10  10   5   1
 6:   64: 1  6 15  20  15   6   1
 7:  128: 1  7 21  35  35  21   7   1
 8:  256: 1  8 28  56  70  56  28   8   1
 9:  512: 1  9 36  84 126 126  84  36   9  1
10: 1024: 1 10 45 120 210 252 210 120  45 10  1
11: 2048: 1 11 55 165 330 462 462 330 165 55 11 1

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

For 10 players we have 10^n = 1024 decks

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

---

# 666-crypto-sign-fromcurve. `sign` bypasses `fromCurve` and re-derives RFC6979 helpers

**Priority:** P4
**Status:** open

## Problem

`fs/crypto/sign/module.f.ts` already exposes the intended abstraction for "derive
the RFC6979 conversion helpers (`All`) from a `Curve`":

```ts
// fs/crypto/sign/module.f.ts:53
export const fromCurve = (c: Curve): All => all(c.nf.p)
```

But the module's primary in-module consumer, `sign`, ignores it and re-implements
the same derivation by hand:

```ts
// fs/crypto/sign/module.f.ts:141-156
export const sign = (c: Curve) => (hf: Sha2) => (x: bigint) => (m: Vec): Signature => {
    const { nf: { p: q, div }, g } = c   // :143 — pulls q out of the curve manually
    const a = all(q)                      // :144 — this is exactly fromCurve(c)
    const { bits2int } = a
    ...
    const hm = computeSync(hf)([m])
    const h = bits2int(hm) % q            // :156 — duplicates bits2octets' `bits2int(b) % q`
```

Two distinct duplications here:

1. **`const a = all(q)` where `q = c.nf.p` is precisely `fromCurve(c)`.** The
   knowledge of "how to get the subgroup order out of a `Curve`" now lives in two
   places. If `fromCurve` ever gains validation/caching, `sign` silently diverges.

2. **`bits2int(hm) % q` (`:156`) re-implements the "bits2int then extra modular
   reduction" step** that `all` already names internally for `bits2octets`:

   ```ts
   // fs/crypto/sign/module.f.ts:45-46
   // since z2 < 2*q, we can use simple mod with `z1 < q ? z1 : z1 - q`
   bits2octets: b => int2octets(bits2int(b) % q),
   ```

   RFC6979's "extra modular reduction" (documented in the comment at `:148-153`)
   thus appears twice, with the rationale comment split across the two sites.

## Proposal

1. **Make `fromCurve` the complete "curve → signing context" factory** so `sign`
   reads everything it needs from one place and never re-reaches into `c`.

   Rather than just swapping `all(q)` for `fromCurve(c)` and *still* hand-pulling
   the curve pieces, give `fromCurve` a **composite** result that holds the
   `q`-only RFC6979 helpers as a named field alongside the curve-derived inputs
   `sign` uses. Per review, prefer **composition over intersection/deriving** (no
   `&`) and embed the RFC6979 record as a field. Note `sign` reaches into the curve
   for three things — `div` via `nf` (`:186`), `g` (`:172`), and `mul` (`:172`,
   `c.mul(k)(g)`):

   ```ts
   export type Signer = {
       readonly rfc6979: Rfc6979   // the q-only conversions — was `All`
       readonly nf: Curve['nf']    // gives div, and q via nf.p
       readonly mul: Curve['mul']
       readonly g: Curve['g']
   }
   export const fromCurve = (c: Curve): Signer =>
       ({ rfc6979: all(c.nf.p), nf: c.nf, mul: c.mul, g: c.g })
   ```

   (Review also noted `All` deserves a clearer name. Renaming `All` → `Rfc6979`
   and using that as the field type is suggested; the rename is optional polish and
   can be split out if it churns proofs/imports.)

   Then `sign` reads from `fromCurve(c)` and passes the embedded record straight to
   `computeK`:

   ```ts
   const { rfc6979, nf: { div }, mul, g } = fromCurve(c)
   const { q, bits2int } = rfc6979
   ...
   const k = computeK(rfc6979)(hf)(x)(m)   // computeK keeps taking the RFC6979 record unchanged
   const rxy = mul(k)(g)
   ```

   ### Why composition (and why the curve pieces don't go on the RFC6979 record)

   Composition keeps the RFC6979 record **completely unchanged**, which matters
   because it is constructed and consumed on its own, with no curve in sight:

   - **`all` is called with a bare subgroup order.** `all(q: bigint)` derives the
     RFC6979 helpers from `q` alone, and is invoked that way both conceptually and
     in practice — e.g. `fs/crypto/sign/proof.f.ts` has `all(7n)`, `all(17n)`,
     `all(5n)`, `all(11n)`, `all(q)`. None of those callers has an `nf`/`g`/`mul`
     to supply. So the curve pieces live on `Signer`, not on the RFC6979 record.
   - **`mul` isn't on `nf` anyway.** `mul` is a field of `Curve`
     (`fs/crypto/secp/module.f.ts:44`, `mul: Fold<bigint, Point>`), not of the
     prime field `nf` — so `nf` + `g` alone wouldn't cover `sign`'s `c.mul(k)(g)`.

   `Signer` is therefore a plain record composing the unchanged RFC6979 helpers
   with `nf`/`mul`/`g`, and `computeK` continues to take just the RFC6979 record.

2. Add a named `bits2intModQ: (b: Vec) => bigint` to the RFC6979 record
   (`= b => bits2int(b) % q`), define `bits2octets = b => int2octets(bits2intModQ(b))`
   in terms of it, and use `rfc6979.bits2intModQ(hm)` in `sign`. The single comment
   about the conditional-subtraction reduction then has one home.

Part 1 is the separation-of-concerns fix: `fromCurve` already exists but is both
bypassed by `sign` and too thin to fully serve it; part 2 is a small DRY win
co-locating the RFC rationale.

## Tasks

- [ ] `fromCurve` returns a composite `Signer = { rfc6979, nf, mul, g }` (no `&`);
      `all` stays the unchanged `q`-only RFC6979 factory `computeK` uses
- [ ] `sign` reads only from `fromCurve(c)` — no direct `c.nf`/`c.mul`/`c.g` access
- [ ] add `bits2intModQ` to the RFC6979 record; express `bits2octets` and `sign`'s `h` through it
- [ ] (optional) rename `All` → `Rfc6979` for clarity; split out if it churns proofs/imports
- [ ] confirm `proof.f.ts` still covers all of `all`/`fromCurve`/`sign`

## Related

- `fs/crypto/sign/module.f.ts` — `all` (:32), `fromCurve` (:53), `sign` (:141)

---

