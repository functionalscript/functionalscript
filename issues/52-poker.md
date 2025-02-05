# Mental Poker

Notes:

1. users should NOT know a multiplier (see [discrete logarithm problem](https://en.wikipedia.org/wiki/Discrete_logarithm)) between different cards. For example, if a user knows that a card # `0` multiplied by a number `N` becomes a card # `1` then they can find a card # `1`.

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
