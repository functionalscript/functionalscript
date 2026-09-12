/**
 * @import { Ast, Meta } from '../../ast/types.ts'
 * @import { Rule } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { repeatFrom0 } from '../../module.f.mjs'
import { parser } from '../../ll1/module.f.mjs'
import { content, id, mergeTrivia, newLine, number, operator, operators, slash, token, ws } from './module.f.mjs'

const cp = /**@type {const}*/({ id: 'cp' })

/** @type {(s: string) => readonly Meta<typeof cp>[]} */
const cps = s => toArray(stringToCodePointList(s)).map(symbol => ({ symbol, meta: cp }))

/**
 * The node at a position no mapping filled: an array the machine built.
 *
 * @type {<T extends readonly unknown[]>(node: T | Meta<unknown>) => T}
 */
const unmapped = node => {
    assert(node instanceof Array)
    return node
}

/**
 * The text under a node: its input symbols in order, a variant's tag
 * passed over.
 *
 * @type {(node: Ast<Rule, unknown> | string) => readonly number[]}
 */
const symbols = node =>
    typeof node === 'string' ? [] :
    node instanceof Array ? node.flatMap(symbols) :
    [node.symbol]

/**
 * A variant's node, read untyped: its tag and the branch's node.
 *
 * @type {(node: unknown) => readonly [string, unknown]}
 */
const branch = node => {
    assert(node instanceof Array && node.length === 2 && typeof node[0] === 'string')
    return [node[0], node[1]]
}

/** @type {(node: unknown) => readonly unknown[]} */
const items = node => {
    assert(node instanceof Array)
    return node
}

const parseToken = parser(token)

/**
 * One token read from `text` at `start`: its kind — `slash`'s own branch
 * for a comment or an operator — its text, and where it ended.
 *
 * @type {(text: string, start?: number) => readonly [string, string, number]}
 */
const read = (text, start = 0) => {
    const [node, end] = unwrap(parseToken(cps(text), start))
    const [tag, child] = unmapped(node)
    const kind = tag !== 'slash' ? tag : unmapped(unmapped(child)[1])[0]
    return [kind, codePointListToString(symbols(node)), end]
}

export const proof = {
    // The grammar is LL(1) as one token, and refused as a whole file: in
    // `repeatFrom0(token)` a token's follow set is the next token's first
    // set, and a greedy token conflicts with the token after it.
    ll1: () => {
        parser(token)
        parser(ws)
        parser(newLine)
        parser(id)
        parser(number)
        parser(slash)
        parser(operator)
        parser(content)
    },
    // Every kind reads its whole token and no more: the text is the symbols
    // under the node, and the end is where the next token begins.
    // a run of trivia is `nl` if any of it is
    mergeTrivia: () => {
        assertEq(mergeTrivia('ws', 'ws'), 'ws')
        assertEq(mergeTrivia('ws', 'nl'), 'nl')
        assertEq(mergeTrivia('nl', 'ws'), 'nl')
        assertEq(mergeTrivia('nl', 'nl'), 'nl')
    },
    kinds: {
        number: () => {
            assertStructurallySame(read('123 '), ['number', '123', 3])
            assertStructurallySame(read('0'), ['number', '0', 1])
            assertStructurallySame(read('1n;'), ['number', '1n', 2])
            assertStructurallySame(read('1.5e-3+'), ['number', '1.5e-3', 6])
            assertStructurallySame(read('7E+2'), ['number', '7E+2', 4])
        },
        string: () => {
            assertStructurallySame(read('"a\\n\\u0041"x'), ['string', '"a\\n\\u0041"', 11])
            assertStructurallySame(read('"é😀"'), ['string', '"é😀"', 4])
        },
        id: () => {
            assertStructurallySame(read('abc$_9 '), ['id', 'abc$_9', 6])
            assertStructurallySame(read('_'), ['id', '_', 1])
            assertStructurallySame(read('$1'), ['id', '$1', 2])
        },
        // The four tokens `/` begins: one symbol after it decides.
        slash: () => {
            assertStructurallySame(read('/x'), ['divide', '/', 1])
            assertStructurallySame(read('/=x'), ['assign', '/=', 2])
            assertStructurallySame(read('// c\nx'), ['oneline', '// c', 4])
            assertStructurallySame(read('//'), ['oneline', '//', 2])
            assertStructurallySame(read('/* a **/ b'), ['multiline', '/* a **/', 8])
            assertStructurallySame(read('/* x\ny*/'), ['multiline', '/* x\ny*/', 8])
            assertStructurallySame(read('/**/'), ['multiline', '/**/', 4])
            // a `/` inside the body is content: only `*/` ends the comment
            assertStructurallySame(read('/* a/b */'), ['multiline', '/* a/b */', 9])
            assertStructurallySame(read('/* ../../x.ts */'), ['multiline', '/* ../../x.ts */', 16])
            assertStructurallySame(read('/*/ */'), ['multiline', '/*/ */', 6])
        },
        // A block comment the input ends inside is read to the end and its
        // tag says so, which is how the layer above tells it from one that
        // closed: after `/*`, after a `*`, and after content.
        unterminated: () => {
            assertStructurallySame(read('/*'), ['multiline', '/*', 2])
            assertStructurallySame(read('/* x *'), ['multiline', '/* x *', 6])
            assertStructurallySame(read('/* x'), ['multiline', '/* x', 4])
            const [node] = unwrap(parseToken(cps('/* x *')))
            // `slash`, then its `multiline` branch: `*` and `content`.
            const [, slashNode] = branch(node)
            const [, multiline] = branch(items(slashNode)[1])
            const [, c0] = items(multiline)
            // ` `, `x` and ` ` are `other`, each followed by more content;
            // `*` is `star`, and what follows it at the end of input is
            // `unterminated`.
            const [t1, o1] = branch(c0)
            const [t2, o2] = branch(items(o1)[1])
            const [t3, o3] = branch(items(o2)[1])
            const [t4, s] = branch(items(o3)[1])
            assertStructurallySame([t1, t2, t3, t4], ['other', 'other', 'other', 'star'])
            assertStructurallySame(items(s)[1], ['unterminated', []])
        },
        operator: () => {
            assertStructurallySame(read('>>>= '), ['operator', '>>>=', 4])
            assertStructurallySame(read('=>'), ['operator', '=>', 2])
            assertStructurallySame(read('?.x'), ['operator', '?.', 2])
            assertStructurallySame(read('...'), ['operator', '.', 1])
            assert(operators.every(w => read(w)[1] === w))
        },
        trivia: () => {
            assertStructurallySame(read('  '), ['ws', ' ', 1])
            assertStructurallySame(read('\t'), ['ws', '\t', 1])
            assertStructurallySame(read('\n\n'), ['newLine', '\n', 1])
            assertStructurallySame(read('\r'), ['newLine', '\r', 1])
        },
    },
    // Tokens are read one after another from where the last one ended,
    // and two that the classical grammar's poison branch rejected read as
    // two: the layer above refuses them for standing side by side.
    adjacent: () => {
        assertStructurallySame(read('123abc'), ['number', '123', 3])
        assertStructurallySame(read('123abc', 3), ['id', 'abc', 6])
        assertStructurallySame(read('00'), ['number', '0', 1])
        assertStructurallySame(read('00', 1), ['number', '0', 2])
        assertStructurallySame(read('1.5n'), ['number', '1.5', 3])
        assertStructurallySame(read('1.5n', 3), ['id', 'n', 4])
        assertStructurallySame(read('a-1', 1), ['operator', '-', 2])
    },
    // What is no token fails where it fails: a symbol no token begins
    // with, the end of input, a fraction with no digits, a string the
    // input ends inside.
    failure: () => {
        assertStructurallySame(parseToken(cps('@')), ['error', 0])
        assertStructurallySame(parseToken(cps('')), ['error', 0])
        assertStructurallySame(parseToken(cps('0.')), ['error', 2])
        assertStructurallySame(parseToken(cps('1e')), ['error', 2])
        assertStructurallySame(parseToken(cps('"abc')), ['error', 4])
        assertStructurallySame(parseToken(cps('"\\x"')), ['error', 2])
    },
    throw: {
        wholeFile: () => parser(repeatFrom0(token)),
    },
}
