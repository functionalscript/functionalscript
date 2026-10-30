/**
 * @import { DemoState } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { runPure } from '../../effects/module.f.mjs'
import { secp256k1 } from '../secp/module.f.mjs'
import { cardBits, lockAndShuffle, maxDeckSize, mentalPoker, shuffle, unlockAll } from './module.f.mjs'
import { cardName, demo, setup, transition } from './demo.f.mjs'

const { deck, key, open } = mentalPoker(secp256k1)
const n = secp256k1.nf.p

/** @type {(state: DemoState, name: string) => DemoState} */
const click = (state, name) => transition(state, { kind: 'click', name })

/** @type {(state: DemoState, name: string, value: string) => DemoState} */
const input = (state, name, value) => transition(state, { kind: 'input', name, value })

/** @type {(state: DemoState) => string} */
const text = state => JSON.stringify(demo.view(state))

export const proof = {
    deck: () => {
        const plain = assertNotNullish(deck(0x20))
        assertEq(plain.length, 0x20)
        plain.forEach((card, i) => assertEq(assertNotNullish(card)[0] & 0xffn, BigInt(i)))
        // Some index has no curve point at `x = i`, so its nonce is above 0.
        assert(plain.some(card => assertNotNullish(card)[0] >> cardBits !== 0n))
        assertEq(assertNotNullish(deck(maxDeckSize)).length, maxDeckSize)
        assertStructurallySame(deck(0), [])
        assertEq(deck(-1), null)
        assertEq(deck(maxDeckSize + 1), null)
        assertEq(deck(1.5), null)
    },
    key: () => {
        assertEq(key(0n), null)
        assertEq(key(n), null)
        const k = assertNotNullish(key(n - 1n))
        const card = assertNotNullish(deck(1))[0]
        assertStructurallySame(k.unlock(k.lock(card)), card)
    },
    shuffle: () => {
        assertStructurallySame(shuffle(0n)([]), [])
        assertStructurallySame(shuffle(0n)([1, 2, 3]), [1, 2, 3])
        assertStructurallySame(shuffle(1n)([1, 2, 3]), [2, 1, 3])
        assertStructurallySame(shuffle(5n)([1, 2, 3]), [3, 2, 1])
        // Seeds below 3! give each permutation once; 6 wraps to 0.
        const all = [0n, 1n, 2n, 3n, 4n, 5n].map(s => shuffle(s)([1, 2, 3]).join(''))
        assertEq(new Set(all).size, 6)
        assertStructurallySame(shuffle(6n)([1, 2, 3]), [1, 2, 3])
    },
    game: () => {
        const plain = assertNotNullish(deck(8))
        const alice = assertNotNullish(key(0xa11cen))
        const bob = assertNotNullish(key(0xb0bn))
        const carol = assertNotNullish(key(0xca801n))
        const shuffled = lockAndShuffle(carol)(3n)(lockAndShuffle(bob)(2n)(lockAndShuffle(alice)(1n)(plain)))
        // A locked card is not in the plain deck.
        assertEq(open(plain)(shuffled[0]), null)
        // Bob and Carol remove their locks; the card is still Alice's alone.
        const forAlice = unlockAll([carol, bob])(shuffled[0])
        assertEq(open(plain)(forAlice), null)
        const card = assertNotNullish(open(plain)(alice.unlock(forAlice)))
        // Locks commute: any order opens the same card.
        assertEq(open(plain)(unlockAll([alice, bob, carol])(shuffled[0])), card)
        // Every card is dealt once.
        const opened = shuffled.map(c => open(plain)(unlockAll([alice, bob, carol])(c)))
        assertEq(new Set(opened).size, 8)
        assert(opened.every(i => i !== null))
    },
    demo: {
        cardName: () => {
            assertEq(cardName(0), '2♣')
            assertEq(cardName(12), 'A♣')
            assertEq(cardName(13), '2♦')
            assertEq(cardName(51), 'A♠')
        },
        setup: () => {
            const { init } = demo
            assertEq(setup(init)[0], 'ok')
            assertEq(assertError(setup({ ...init, alice: 'x' })), "Alice's secret must be a hexadecimal number from 1 to n − 1.")
            assertEq(assertError(setup({ ...init, bob: '0' })), "Bob's secret must be a hexadecimal number from 1 to n − 1.")
            assertEq(assertError(setup({ ...init, carolSeed: '' })), "Carol's shuffle seed must be a hexadecimal number.")
        },
        refused: () => {
            const state = input(demo.init, 'alice', '')
            assert(text(state).includes('Refused:'))
            assertEq(click(state, 'next'), state)
        },
        events: () => {
            const { init } = demo
            assertEq(transition(init, { kind: 'start' }), init)
            assertStructurallySame(runPure(demo.update(init)({ kind: 'start' })), [['ok', init]])
            assertEq(input(init, 'decks', 'x'), init)
            assertEq(input(init, 'view', 'Bob').view, 'Bob')
            assertEq(click(init, 'unknown'), init)
        },
        play: () => {
            const { init } = demo
            assert(text(init).includes('Encode the deck'))
            const encoded = click(init, 'next')
            assertEq(encoded.decks.length, 1)
            assert(text(encoded).includes('2♣  3♣  4♣'))
            assert(text(encoded).includes('Alice locks and shuffles'))
            const shuffled = click(click(click(encoded, 'next'), 'next'), 'next')
            assertEq(shuffled.decks.length, 4)
            assert(text(shuffled).includes('After Alice, Bob, Carol locked and shuffled:'))
            assert(text(shuffled).includes('"Deal"'))
            const dealt = click(shuffled, 'next')
            const cards = assertNotNullish(dealt.dealt)
            assertEq(cards.length, 11)
            assertEq(new Set(cards).size, 11)
            assertEq(click(dealt, 'next'), dealt)
            const table = text(dealt)
            assert(table.includes('Dealt'))
            assert(table.includes(cardName(cards[6])))
            assert(!table.includes(cardName(cards[0])))
            const alice = text(input(dealt, 'view', 'Alice'))
            assert(alice.includes(cardName(cards[0])))
            assert(!alice.includes(cardName(cards[2])))
            const showdown = text(input(dealt, 'view', 'Showdown'))
            assert(cards.every(c => showdown.includes(cardName(c))))
            // A typed change starts the game over; so does the button.
            assertStructurallySame(input(dealt, 'bobSeed', '1').decks, [])
            assertEq(click(dealt, 'reset').dealt, null)
        },
    },
}
