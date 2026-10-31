/**
 * Mental poker: players shuffle and deal a deck that none of them sees,
 * with no trusted dealer, using commutative encryption over an elliptic
 * curve (the SRA scheme on a curve group).
 *
 * Each player locks every card with their own secret and shuffles the deck,
 * in turn. A card is opened for a player when every other player removes
 * their lock and hands the card on; the player removes the last lock alone.
 * Players are assumed honest: proofs that a player shuffled or unlocked
 * correctly are future work (`todo/mental-poker.md`).
 *
 * @module
 *
 * @import { Curve, Point, Point2D } from '../secp/types.ts'
 * @import { Deck, Key, MentalPoker } from './types.ts'
 */

import { assert } from '../../asserts/module.f.js'
import { eq } from '../secp/module.f.mjs'

/** How many low bits of a card's `x` hold its index. */
export const cardBits = 8n

/** The largest deck: every index fits {@link cardBits}. */
export const maxDeckSize = 0x100

/**
 * Mental poker over the curve `c`. The curve's order `n` must be prime, as
 * it is for every named curve: over a composite `n`, a secret with no
 * inverse mod `n` makes `key` throw
 * ([`todo/composite-order.md`](./todo/composite-order.md)).
 *
 * @example
 *
 * ```js
 * const { deck, key, open } = mentalPoker(secp256k1)
 * const plain = deck(52) ?? []
 * const alice = key(0x1234n)
 * const bob = key(0x5678n)
 * // ...each player locks every card and shuffles the deck in turn...
 * // Bob removes his lock, and Alice opens the card alone.
 * const card = alice.unlock(bob.unlock(bob.lock(alice.lock(plain[7]))))
 * const index = open(plain)(card) // 7
 * ```
 *
 * @type {(c: Curve) => MentalPoker}
 */
export const mentalPoker = ({ pf: { p }, y, mul, nf: { p: n, reciprocal } }) => {
    /** Card `i` as a point, or `null` once its `x` would reach the field's
     * size `p`: past it, `x` would name the same point as `x - p`, another
     * card's.
     * @type {(i: bigint) => (nonce: bigint) => Point2D | null}
     */
    const encode = i => nonce => {
        const x = i | nonce << cardBits
        if (x >= p) {
            return null
        }
        const yx = y(x)
        return yx === null ? encode(i)(nonce + 1n) : [x, yx]
    }
    return {
        deck: size => {
            if (!Number.isInteger(size) || size < 0 || maxDeckSize < size) {
                return null
            }
            const cards = Array.from({ length: size }, (_, i) => encode(BigInt(i))(0n))
            return cards.every(card => card !== null) ? cards : null
        },
        key: secret => 0n < secret && secret < n
            ? { lock: mul(secret), unlock: mul(reciprocal(secret)) }
            : null,
        open: deck => card => {
            const i = deck.findIndex(eq(card))
            return i < 0 ? null : i
        },
    }
}

/**
 * A permutation of `list` chosen by `seed`, read as a number in the factorial
 * number system: its lowest digit, `seed % length`, picks the first item, and
 * the rest of the seed permutes the rest. Seeds below `length!` give every
 * permutation once; a larger seed gives the same one as `seed % length!`.
 *
 * @throws If `seed` is negative: a caller's mistake, which would otherwise
 * read before the list's start and return no permutation at all.
 *
 * @type {(seed: bigint) => <T>(list: readonly T[]) => readonly T[]}
 */
export const shuffle = seed => list => {
    assert(0n <= seed, ['negative shuffle seed', seed])
    if (list.length === 0) {
        return list
    }
    const length = BigInt(list.length)
    const i = Number(seed % length)
    return [list[i], ...shuffle(seed / length)([...list.slice(0, i), ...list.slice(i + 1)])]
}

/**
 * One player's turn of the shuffle: lock every card of `deck` with `key`,
 * then permute the deck by `seed`.
 *
 * @type {(key: Key) => (seed: bigint) => (deck: Deck) => Deck}
 */
export const lockAndShuffle = ({ lock }) => seed => deck => shuffle(seed)(deck.map(lock))

/**
 * Remove the locks of `keys` from `card`, in order. Locks commute, so any
 * order gives the same card.
 *
 * @type {(keys: readonly Key[]) => (card: Point) => Point}
 */
export const unlockAll = keys => card => keys.reduce((c, { unlock }) => unlock(c), card)
