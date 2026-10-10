import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { lexeme, unitAt, units, utf16 } from './module.f.mjs'

const [a, b, c] = units('abc')

/** A leaf of an output alphabet: its mapping replaced what it consumed. */
const mapped = { symbol: 0x61, meta: { id: 'text', value: 'a' } }

export const proof = {
    // One symbol per code unit, so an astral character is two and a lone
    // surrogate is one, and the text's length is the input's.
    units: () => {
        assertStructurallySame(units('a😀').map(({ symbol }) => symbol), [0x61, 0xD83D, 0xDE00])
        assertStructurallySame(units('\ud800').map(({ symbol }) => symbol), [0xD800])
        assertStructurallySame(units(''), [])
    },
    // Every leaf carries the one shared record, and it names the alphabet.
    metadata: () => {
        const symbols = units('ab')
        assert(symbols[0].meta === utf16 && symbols[1].meta === utf16)
        assertEq(utf16.id, 'utf16')
    },
    // A leaf is told by its `id`, so a record carrying more beside it — a
    // position, say — is a leaf of this alphabet too; and the code units
    // at both ends of the range are units.
    unitAt: () => {
        assertEq(unitAt(a), 0x61)
        assertEq(unitAt({ symbol: 0x62, meta: { id: 'utf16', position: 7 } }), 0x62)
        assertEq(unitAt({ symbol: 0, meta: utf16 }), 0)
        assertEq(unitAt({ symbol: 0xFFFF, meta: utf16 }), 0xFFFF)
    },
    // The text under a subtree, in the shapes a parse builds: a string's
    // or a repeat's array, a tuple, a variant with its tag passed over, an
    // empty node, and any nesting of them. `units` and `lexeme` are
    // inverses, a lone surrogate included.
    lexeme: () => {
        assertEq(lexeme(a), 'a')
        assertEq(lexeme([]), '')
        assertEq(lexeme([a, b, c]), 'abc')
        assertEq(lexeme(['tag', a]), 'a')
        assertEq(lexeme(['tag', [a, b]]), 'ab')
        assertEq(lexeme([a, ['tag', [b, ['inner', c]]], []]), 'abc')
        assertEq(lexeme([a, b]), 'ab')
        assertEq(lexeme(units('a😀\ud800')), 'a😀\ud800')
    },
    throw: {
        unitAt: {
            // a node is not a leaf
            node: () => unitAt([a]),
            // what is not a leaf at all
            null: () => unitAt(null),
            number: () => unitAt(0x61),
            string: () => unitAt('a'),
            // a mapped leaf has no source to give back
            mapped: () => unitAt(mapped),
            noMeta: () => unitAt({ symbol: 0x61 }),
            nullMeta: () => unitAt({ symbol: 0x61, meta: null }),
            stringMeta: () => unitAt({ symbol: 0x61, meta: 'utf16' }),
            // a `symbol` that spells no code unit
            noSymbol: () => unitAt({ meta: utf16 }),
            negative: () => unitAt({ symbol: -1, meta: utf16 }),
            negativeZero: () => unitAt({ symbol: -0, meta: utf16 }),
            fraction: () => unitAt({ symbol: 0.5, meta: utf16 }),
            outOfRange: () => unitAt({ symbol: 0x1_0000, meta: utf16 }),
            notANumber: () => unitAt({ symbol: NaN, meta: utf16 }),
            bigint: () => unitAt({ symbol: 0x61n, meta: utf16 }),
        },
        lexeme: {
            // a mapped leaf, alone or at depth
            mapped: () => lexeme(mapped),
            mappedAtDepth: () => lexeme([a, ['tag', [b, mapped]]]),
            // a string anywhere but a variant's tag
            bareString: () => lexeme('tag'),
            stringAfterLeaf: () => lexeme([a, 'tag']),
            tagAlone: () => lexeme(['tag']),
            tagWithTwo: () => lexeme(['tag', a, b]),
            tagged: () => lexeme(['tag', 'inner']),
        },
    },
}
