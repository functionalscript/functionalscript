/**
 * Three players shuffle and deal a 52-card deck on secp256k1 with no
 * dealer: Alice, Bob and Carol each lock every card with a secret and
 * shuffle, in turn, then each player's two hole cards and five table cards
 * are opened.
 *
 * **One step per click.** A turn locks 52 cards, a scalar multiplication
 * each, so the page takes the protocol one turn at a time; each step shows
 * the deck it produced, and the reader watches the cards become unreadable.
 *
 * **The point of view is a display choice, not a secret.** The demo holds
 * every key, so it can draw the table as any player sees it; in a real game
 * each player's secret never leaves their machine.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Point } from '../secp/types.ts'
 * @import { DemoState, Deck, Key } from './types.ts'
 */

import { withInputs } from '../../website/demo/sharing/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.js'
import { pureOk } from '../../effects/module.f.mjs'
import { codePoints, hexDigitsValue } from '../../text/ascii/module.f.js'
import { ok, error } from '../../types/result/module.f.js'
import { button, caption, inputField, option, refusal, selectField } from '../../website/demo/module.f.mjs'
import { secp256k1 } from '../secp/module.f.mjs'
import { lockAndShuffle, mentalPoker, unlockAll } from './module.f.mjs'

const { deck, key, open } = mentalPoker(secp256k1)

export const players = /** @type {const} */ (['Alice', 'Bob', 'Carol'])

export const views = /** @type {const} */ (['Table', ...players, 'Showdown'])

/** The inputs a player types: a change to one starts the game over. */
const fields = /** @type {const} */ (['alice', 'aliceSeed', 'bob', 'bobSeed', 'carol', 'carolSeed'])

const deckSize = 52

/** Cards dealt to each player; the five after them go on the table. */
const holeCards = 2

/** A card's name: its rank, then its suit. Clubs come first, deuce to ace.
 * @type {(i: number) => string}
 */
export const cardName = i => `${'23456789TJQKA'[i % 13]}${'♣♦♥♠'[(i - i % 13) / 13]}`

/** @type {(text: string) => bigint | null} */
const hex = text => hexDigitsValue(codePoints(text))

/** Each player's key and shuffle seed, or the first input that is refused.
 * @type {(state: DemoState) => Result<readonly (readonly [Key, bigint])[], string>}
 */
export const setup = state => {
    const inputs = [[state.alice, state.aliceSeed], [state.bob, state.bobSeed], [state.carol, state.carolSeed]]
    /** @type {(i: number) => Result<readonly (readonly [Key, bigint])[], string>} */
    const parse = i => {
        if (i === inputs.length) { return ok([]) }
        const [secretText, seedText] = inputs[i]
        const secret = hex(secretText)
        const k = secret === null ? null : key(secret)
        if (k === null) { return error(`${players[i]}'s secret must be a hexadecimal number from 1 to n − 1.`) }
        const seed = hex(seedText)
        if (seed === null) { return error(`${players[i]}'s shuffle seed must be a hexadecimal number.`) }
        const rest = parse(i + 1)
        return rest[0] === 'error' ? rest : ok([[k, seed], ...rest[1]])
    }
    return parse(0)
}

/** Open the shuffled deck's top cards: two for each player, then the table.
 * Every lock is removed; for a player's card the others remove theirs first
 * and hand it on, and its owner removes the last one alone.
 * @type {(keys: readonly Key[], plain: Deck, shuffled: Deck) => readonly number[]}
 */
const deal = (keys, plain, shuffled) => {
    const openAll = unlockAll(keys)
    return shuffled.slice(0, players.length * holeCards + 5).map(card => assertNotNullish(open(plain)(openAll(card))))
}

/** What the next click does, by the steps already taken.
 * @type {(state: DemoState) => string}
 */
const nextLabel = ({ decks, dealt }) =>
    decks.length === 0 ? 'Encode the deck'
        : decks.length <= players.length ? `${players[decks.length - 1]} locks and shuffles`
            : dealt === null ? 'Deal' : 'Dealt'

/** @type {(state: DemoState, event: DemoEvent) => DemoState} */
export const transition = (state, event) => {
    if (event.kind === 'start') { return state }
    if (event.kind === 'input') {
        const { name, value } = event
        if (name === 'view') { return { ...state, view: value } }
        return fields.some(f => f === name) ? { ...state, [name]: value, decks: [], dealt: null } : state
    }
    if (event.name === 'reset') { return { ...state, decks: [], dealt: null } }
    const s = setup(state)
    if (event.name !== 'next' || s[0] === 'error' || state.dealt !== null) { return state }
    const { decks } = state
    if (decks.length === 0) { return { ...state, decks: [assertNotNullish(deck(deckSize))] } }
    const last = decks[decks.length - 1]
    if (decks.length <= players.length) {
        const [k, seed] = s[1][decks.length - 1]
        return { ...state, decks: [...decks, lockAndShuffle(k)(seed)(last)] }
    }
    return { ...state, dealt: deal(s[1].map(([k]) => k), decks[0], last) }
}

/** A locked card by the first hex digits of its `x`.
 * @type {(card: Point) => string}
 */
const lockedName = card => `${assertNotNullish(card)[0].toString(16).padStart(64, '0').slice(0, 8)}…`

/** @type {(decks: readonly Deck[]) => readonly Element[]} */
const deckRows = decks => decks.flatMap((d, i) => [
    caption(i === 0 ? 'Plain deck, top 8 of 52:' : `After ${players.slice(0, i).join(', ')} locked and shuffled:`),
    ['pre', d.slice(0, 8).map(i === 0 ? (_, j) => cardName(j) : lockedName).join('  ')],
])

/** The dealt cards a point of view shows, the rest face down.
 * @type {(view: string, dealt: readonly number[]) => readonly Element[]}
 */
const table = (view, dealt) => {
    /** @type {(visible: boolean) => (i: number) => string} */
    const show = visible => i => visible ? cardName(i) : '🂠'
    const tableCards = dealt.slice(players.length * holeCards)
    return [
        ...players.map((name, p) => /** @type {Element} */ (['p', `${name}: `,
            ['code', dealt.slice(p * holeCards, (p + 1) * holeCards).map(show(view === name || view === 'Showdown')).join(' ')]])),
        ['p', 'Table: ', ['code', tableCards.map(show(true)).join(' ')]],
    ]
}

/** The steps taken so far and the button for the next one.
 * @type {(state: DemoState) => readonly Element[]}
 */
const game = state => [
    ['p', button('next', nextLabel(state), state.dealt !== null), ' ', button('reset', 'Start over', state.decks.length === 0)],
    ...deckRows(state.decks),
    ...(state.dealt === null ? [] : [
        selectField({ name: 'view', label: 'Point of view' }, views.map(v => option(v, v, v === state.view))),
        ...table(state.view, state.dealt),
    ]),
]

/** @type {Demo<DemoState, DemoEvent>} */
const definition = {
    init: {
        alice: 'a11ce', aliceSeed: '5eed1',
        bob: 'b0b', bobSeed: '5eed2',
        carol: 'ca801', carolSeed: '5eed3',
        view: 'Table',
        decks: [],
        dealt: null,
    },
    update: state => event => pureOk(transition(state, event)),
    view: state => {
        const s = setup(state)
        return ['div',
            ['p', 'Mental poker deals cards with no dealer: each player locks every card with a secret number and shuffles the deck, in turn, so no one knows where any card is. A card is opened for its owner when the other players remove their locks; the owner removes the last one alone.'],
            ...players.flatMap((name, p) => {
                const field = /** @type {const} */ (['alice', 'bob', 'carol'])[p]
                return [
                    inputField({ name: field, label: `${name}'s secret (hex)` }, state[field]),
                    inputField({ name: `${field}Seed`, label: `${name}'s shuffle seed (hex)` }, state[`${field}Seed`]),
                ]
            }),
            ...(s[0] === 'error' ? [refusal(s[1])] : game(state)),
            ['p', 'Players here are trusted to shuffle and unlock honestly; proofs that they did are future work.'],
        ]
    },
}

export const demo = withInputs(definition, [...fields, 'view'], { view: [...views] })
