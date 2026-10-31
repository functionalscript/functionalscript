/**
 * Types for mental poker: commutative card encryption over an elliptic curve.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Point } from '../secp/types.ts'

/** A deck: plain cards, or cards locked by one or more players. */
export type Deck = readonly Point[]

/**
 * One player's key for one deck. `lock` multiplies a card by the player's
 * secret `s`, and `unlock` by `s⁻¹ mod n`. Locks commute, so the players
 * holding a card's locks may remove them in any order.
 */
export type Key = {
    readonly lock: (card: Point) => Point
    readonly unlock: (card: Point) => Point
}

/** Mental poker over one curve. */
export type MentalPoker = {
    /**
     * The plain deck of `size` cards, or `null` when `size` is outside
     * `0..0x100`. Card `i` is the first curve point whose `x` is
     * `i | nonce << 8`, so nobody knows a multiplier between two cards.
     */
    readonly deck: (size: number) => Nullable<Deck>
    /**
     * The key of a player's secret, or `null` unless the secret is in
     * `1..n-1`, where `n` is the curve's order.
     */
    readonly key: (secret: bigint) => Nullable<Key>
    /**
     * The index of a fully unlocked card in the plain `deck`, or `null` when
     * the card is not in it: it still holds a lock.
     */
    readonly open: (deck: Deck) => (card: Point) => Nullable<number>
}

/**
 * The demo's state: each player's secret and shuffle seed as typed, in
 * hexadecimal, the point of view the table is drawn from, and the decks so
 * far — the plain deck, then the deck after each player's turn — then the
 * pocket cards, two for each player in turn, once dealt, and the table's
 * cards opened so far.
 */
export type DemoState = {
    readonly alice: string
    readonly aliceSeed: string
    readonly bob: string
    readonly bobSeed: string
    readonly carol: string
    readonly carolSeed: string
    readonly view: string
    readonly decks: readonly Deck[]
    readonly pockets: Nullable<readonly Pocket[]>
    readonly board: readonly number[]
}

/**
 * A pocket card: `handed` is the card once the other players removed their
 * locks, under its owner's lock alone, and `card` its index once the owner
 * removed that one.
 */
export type Pocket = {
    readonly handed: Point
    readonly card: number
}
