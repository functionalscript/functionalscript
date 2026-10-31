/**
 * Three players shuffle and deal a 52-card deck on secp256k1 with no
 * dealer: Alice, Bob and Carol each lock every card with a secret and
 * shuffle, in turn. Then each player's two pocket cards are dealt, and the
 * flop, the turn and the river are opened, each a step of its own.
 *
 * **The table is opened street by street.** The cryptography could open
 * every card in one pass, since locks commute; the game cannot, because a
 * table card opened before its betting round is information too early, and a
 * hand everyone folds leaves the rest of the table unopened for good.
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
 * @import { DemoState, Deck, Key, Pocket } from './types.ts'
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

/** Cards dealt to each player; the table's cards come after them. */
const pocketCards = 2

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

/** The table's streets, in order: each opens its count of cards, after a
 * betting round, from the deck below the pocket cards.
 */
export const streets = /** @type {const} */ ([['Flop', 3], ['Turn', 1], ['River', 1]])

/** How many table cards the streets before street `i` open.
 * @type {(i: number) => number}
 */
const streetsBefore = i => streets.slice(0, i).reduce((sum, [, count]) => sum + count, 0)

/** The street a table of `board` opens next; `undefined` once the river is out.
 * @type {(board: readonly number[]) => (typeof streets)[number] | undefined}
 */
const nextStreet = board => streets.find((_, i) => streetsBefore(i) === board.length)

/** Deal the pocket cards from the top of the shuffled deck, two per player.
 * The other players remove their locks from each card and hand it on; the
 * owner removes the last lock alone.
 * @type {(keys: readonly Key[], plain: Deck, shuffled: Deck) => readonly Pocket[]}
 */
const dealPockets = (keys, plain, shuffled) => shuffled.slice(0, players.length * pocketCards).map((card, i) => {
    const owner = (i - i % pocketCards) / pocketCards
    const handed = unlockAll(keys.filter((_, p) => p !== owner))(card)
    return { handed, card: assertNotNullish(open(plain)(keys[owner].unlock(handed))) }
})

/** Open the next street: every player removes their lock.
 * @type {(keys: readonly Key[], plain: Deck, shuffled: Deck, board: readonly number[]) => readonly number[]}
 */
const dealStreet = (keys, plain, shuffled, board) => {
    const first = players.length * pocketCards + board.length
    const [, count] = assertNotNullish(nextStreet(board))
    return [...board, ...shuffled.slice(first, first + count).map(card => assertNotNullish(open(plain)(unlockAll(keys)(card))))]
}

/** What the next click does, by the steps already taken; `null` once the
 * river is out.
 * @type {(state: DemoState) => string | null}
 */
const nextLabel = ({ decks, pockets, board }) =>
    decks.length === 0 ? 'Encode the deck'
        : decks.length <= players.length ? `${players[decks.length - 1]} locks and shuffles`
            : pockets === null ? 'Deal pocket cards'
                : nextStreet(board)?.[0] ?? null

/** The state with no deck: where a change of input starts the game over.
 * @type {(state: DemoState) => DemoState}
 */
const restart = state => ({ ...state, decks: [], pockets: null, board: [] })

/** @type {(state: DemoState, event: DemoEvent) => DemoState} */
export const transition = (state, event) => {
    if (event.kind === 'start') { return state }
    if (event.kind === 'input') {
        const { name, value } = event
        if (name === 'view') { return { ...state, view: value } }
        return fields.some(f => f === name) ? restart({ ...state, [name]: value }) : state
    }
    if (event.name === 'reset') { return restart(state) }
    const s = setup(state)
    if (event.name !== 'next' || s[0] === 'error' || nextLabel(state) === null) { return state }
    const { decks, pockets, board } = state
    if (decks.length === 0) { return { ...state, decks: [assertNotNullish(deck(deckSize))] } }
    const last = decks[decks.length - 1]
    if (decks.length <= players.length) {
        const [k, seed] = s[1][decks.length - 1]
        return { ...state, decks: [...decks, lockAndShuffle(k)(seed)(last)] }
    }
    const keys = s[1].map(([k]) => k)
    return pockets === null
        ? { ...state, pockets: dealPockets(keys, decks[0], last) }
        : { ...state, board: dealStreet(keys, decks[0], last, board) }
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

/** The cards dealt so far as `view` sees them, the rest face down. Each
 * pocket card is shown as its owner receives it, still under the owner's
 * lock: that is all anyone else ever sees of it.
 * @type {(view: string, pockets: readonly Pocket[], board: readonly number[]) => readonly Element[]}
 */
const table = (view, pockets, board) => [
    caption('Pocket cards, as handed to their owners, and opened:'),
    ...players.map((name, p) => {
        const own = pockets.slice(p * pocketCards, (p + 1) * pocketCards)
        const visible = view === name || view === 'Showdown'
        return /** @type {Element} */ (['p', `${name}: `,
            ['code', own.map(({ handed }) => lockedName(handed)).join(' ')], ' → ',
            ['code', own.map(({ card }) => visible ? cardName(card) : '🂠').join(' ')]])
    }),
    caption('Table:'),
    ['p', ['code', [...board.map(cardName), ...Array.from({ length: streetsBefore(streets.length) - board.length }, () => '🂠')].join(' ')]],
]

/** The steps taken so far and the button for the next one.
 * @type {(state: DemoState) => readonly Element[]}
 */
const game = state => {
    const label = nextLabel(state)
    return [
        ['p', button('next', label ?? 'Hand dealt', label === null), ' ', button('reset', 'Start over', state.decks.length === 0)],
        ...deckRows(state.decks),
        ...(state.pockets === null ? [] : [
            selectField({ name: 'view', label: 'Point of view' }, views.map(v => option(v, v, v === state.view))),
            ...table(state.view, state.pockets, state.board),
        ]),
    ]
}

/** @type {Demo<DemoState, DemoEvent>} */
const definition = {
    init: {
        alice: 'a11ce', aliceSeed: '5eed1',
        bob: 'b0b', bobSeed: '5eed2',
        carol: 'ca801', carolSeed: '5eed3',
        view: 'Table',
        decks: [],
        pockets: null,
        board: [],
    },
    update: state => event => pureOk(transition(state, event)),
    view: state => {
        const s = setup(state)
        return ['div',
            ['p', 'Mental poker deals cards with no dealer: each player locks every card with a secret number and shuffles the deck, in turn, so no one knows where any card is. A pocket card is handed to its owner once the other players remove their locks; the owner removes the last one alone. Table cards are opened by everyone, street by street.'],
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
