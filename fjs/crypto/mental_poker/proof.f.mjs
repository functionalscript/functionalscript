/**
 * @import { DemoState } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { runPure } from '../../effects/module.f.mjs'
import { curve, eq, secp256k1 } from '../secp/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'
import { cardBits, lockAndShuffle, maxDeckSize, mentalPoker, shuffle, unlockAll } from './module.f.mjs'
import { cardName, demo, setup, transition } from './demo.f.mjs'

const { deck, key, open } = mentalPoker(secp256k1)
const n = secp256k1.nf.p

/** A passphrase one byte longer than a bit vector holds. */
const tooLong = `${'é'.repeat(Number(maxLengthBytes) / 2)}a`

/** @type {(state: DemoState, name: string) => DemoState} */
const click = (state, name) => transition(state, { kind: 'click', name })

/** @type {(state: DemoState, name: string, value: string) => DemoState} */
const input = (state, name, value) => transition(state, { kind: 'input', name, value })

/** @type {(state: DemoState) => string} */
const text = state => JSON.stringify(demo.view(state))

/** A card as the view writes it: its face, then its lock box.
 * @type {(face: string, locks: string) => string}
 */
const shown = (face, locks) => `["code","${face}"]," ",["svg",{"viewBox":"0 0 36 14","width":"36","height":"14","role":"img","aria-label":"${locks}"`

/** The first card of a pocket row, after the cards handed to its owner.
 * @type {(face: string) => string}
 */
const dealt = face => `" →"," ",["code","${face}"]`

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
        // A field too small for every card is refused: on this curve,
        // `x = 23` would be `x = 0`, card 0's point, again.
        const toy = mentalPoker(curve({ p: 23n, c: [4n, 1n], g: [0n, 2n], n: 29n }))
        assertEq(assertNotNullish(toy.deck(1)).length, 1)
        assertEq(toy.deck(24), null)
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
            const [[alice, seed]] = assertOk(setup(init))
            // Independent vectors from Python's hashlib: SHA-512 of
            // `shuffle:alice`, and 1 + SHA-512 of `lock:alice` mod (n - 1).
            assertEq(seed, 0x173_f3ba_9eaa_2404_daa4_e1b9_dfbf_0108_1054_37df_5899_d6d6_4604_30d7_0acf_a1da_3b6f_90e8_544f_abd5_77b6_08df_6146_4290_a3f2_0039_f41b_cd0a_ed65_866d_6862_abd0n)
            const { g, mul } = secp256k1
            assert(eq(alice.lock(g))(mul(0x75a9_4906_ea10_180b_bff3_f908_6611_be4f_b7e0_a9d7_f952_f877_ad57_2e84_5ae1_9159n)(g)))
            assertEq(assertError(setup({ ...init, bob: tooLong })), `Bob's passphrase is too long: more than ${maxLengthBytes} UTF-8 bytes.`)
        },
        refused: () => {
            const state = input(demo.init, 'alice', tooLong)
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
            // Nothing is drawn before the first step.
            assert(!text(init).includes('Plain deck'))
            assert(!text(init).includes('After Alice'))
            const encoded = click(init, 'next')
            assertEq(encoded.decks.length, 1)
            const plain = text(encoded)
            assert(!plain.includes('After Alice'))
            // The legend names each player's section of a lock box.
            assert(plain.includes('"Locks:"," ",["svg",{"viewBox":"0 0 36 14","width":"36","height":"14","role":"img","aria-label":"locked by Alice"'))
            assert(plain.includes('" Carol"]'))
            assert(plain.includes(shown('2♣', 'no locks')))
            assert(plain.includes(shown('9♣', 'no locks')))
            assert(!plain.includes(shown('T♣', 'no locks')))
            assert(plain.includes('Alice locks and shuffles'))
            const afterAlice = click(encoded, 'next')
            // Only Alice knows the order her turn made.
            assert(text(afterAlice).includes(shown('🂠', 'locked by Alice')))
            assert(!text(input(afterAlice, 'view', 'Alice')).includes(shown('🂠', 'locked by Alice')))
            // Bob is handed Alice's deck face down: he knows how he moved the
            // cards, not which card is where.
            const afterBob = click(afterAlice, 'next')
            assertEq(text(input(afterBob, 'view', 'Bob')).split(shown('🂠', 'locked by Alice, Bob')).length - 1, 8)
            assert(text(input(afterBob, 'view', 'Alice')).includes(shown('🂠', 'locked by Alice, Bob')))
            const shuffled = click(afterBob, 'next')
            assertEq(shuffled.decks.length, 4)
            assert(text(shuffled).includes(shown('🂠', 'locked by Alice, Bob, Carol')))
            assert(text(shuffled).includes('Deal pocket cards'))
            const pocketed = click(shuffled, 'next')
            const pockets = assertNotNullish(pocketed.pockets)
            assertEq(pockets.length, 6)
            // A handed card is still under its owner's lock.
            assert(pockets.every(({ handed }) => open(assertNotNullish(deck(52)))(handed) === null))
            const names = pockets.map(({ card }) => cardName(card))
            const before = text(pocketed)
            assert(before.includes(shown('🂠', 'locked by Alice')))
            assert(before.includes(shown('🂠', 'locked by Bob')))
            assert(!before.includes(dealt(names[0])))
            assert(before.includes('"Flop"'))
            // The point of view is a radio group, the chosen one checked.
            assert(before.includes('"id":"view-Table","name":"view","value":"Table","checked":""'))
            const alice = text(input(pocketed, 'view', 'Alice'))
            assert(alice.includes('"id":"view-Alice","name":"view","value":"Alice","checked":""'))
            assert(!alice.includes('"value":"Table","checked"'))
            assert(alice.includes(dealt(names[0])))
            assert(!alice.includes(dealt(names[2])))
            assert(alice.includes(dealt('🂠')))
            // No point of view sees past another player's shuffle.
            assert(!alice.includes(shown(names[0], 'locked by Alice, Bob, Carol')))
            assert(!alice.includes('Showdown'))
            // The streets open three cards, then one, then one.
            const flop = click(pocketed, 'next')
            assertEq(flop.board.length, 3)
            assert(text(flop).includes(shown(cardName(flop.board[0]), 'no locks')))
            assert(text(flop).includes('"Turn"'))
            const turn = click(flop, 'next')
            assertEq(turn.board.length, 4)
            assert(text(turn).includes('"River"'))
            const river = click(turn, 'next')
            assertEq(river.board.length, 5)
            assert(text(river).includes('"Showdown"'))
            assert(!text(river).includes(dealt(names[2])))
            // At the showdown every owner removes their last lock in public.
            const showdown = click(river, 'next')
            assert(showdown.showdown)
            const shownDown = text(showdown)
            assert(names.every(name => shownDown.includes(shown(name, 'no locks'))))
            assert(!shownDown.includes(dealt('🂠')))
            assert(shownDown.includes('Hand over'))
            assertEq(click(showdown, 'next'), showdown)
            // Every card dealt is a different card.
            assertEq(new Set([...pockets.map(({ card }) => card), ...river.board]).size, 11)
            // A typed change starts the game over; so does the button.
            assertStructurallySame(input(river, 'bob', 'robert').decks, [])
            const reset = click(showdown, 'reset')
            assertEq(reset.pockets, null)
            assert(!reset.showdown)
            assertStructurallySame(reset.board, [])
        },
    },
    throw: {
        // A negative seed would read before the list's start.
        negativeSeed: () => shuffle(-1n)([1, 2, 3]),
    },
}
