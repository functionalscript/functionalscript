/** Explicit octal literals share radix decoding and strict token boundaries. */
import { assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { stringToList } from '../../text/utf16/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { tokenize } from './module.f.mjs'

/** @type {(source: string) => readonly import('../../ebnf/lib/js/types.ts').JsToken[]} */
const tokens = source => toArray(tokenize(stringToList(source))('octal.f.js')).map(record => record.token)

export const proof = /** @type {const} */ ({
    numbersKeepTheirSpellingAndBigintsDecodeExactly: () => {
        for (const source of ['0o0','0O7','0o17','0O7_7','0o0007','0o400000000000000001']) {
            assertStructurallySame(tokens(source), [{ kind: 'number', value: source }, { kind: 'eof' }])
        }
        for (const [source, value] of /** @type {const} */ ([
            ['0o0n',0n], ['0O17n',15n], ['0o7_7n',63n],
            ['0O400000000000000001n',0x20_0000_0000_0001n],
        ])) { assertStructurallySame(tokens(source), [{ kind: 'bigint', value }, { kind: 'eof' }]) }
    },
    malformedAndLegacyLiteralsAreRejected: () => {
        for (const source of ['0o','0O','0on','0O8','0o78','0o1e2','0o1abc','0o1n2','0o_7','0o7_','0o7__1','0o7_n','017','00','08','09','017n','00n']) {
            assertEq(tokens(source).some(token => token.kind === 'error'), true, source)
        }
    },
})
