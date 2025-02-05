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
