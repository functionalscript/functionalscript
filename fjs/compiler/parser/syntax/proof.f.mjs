/**
 * @import { Primitive } from '../../../media/datajs/types.ts'
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Node } from './types.ts'
 */

import { parseSyntax } from './module.f.mjs'
import { tokenizeString } from '../proof.f.mjs'
import { _valueKinds } from '../grammar/module.f.mjs'
import { fromEntries } from '../../../types/object/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(kind: 'null' | 'true' | 'false' | 'undefined' | 'eof' | ';', line: number) => DjsTokenWithMetadata} */
const proofKind = (kind, line) => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 }, newline: false })

/** @type {(value: string, line: number) => DjsTokenWithMetadata} */
const proofId = (value, line) => ({ token: { kind: 'id', value }, metadata: { path: 'a.js', line, column: 1 }, newline: false })

/**
 * A source value of every kind in {@link _valueKinds}, and the primitive it
 * folds to: keyed by the list, so a kind added there is a sample missing
 * here, and the switch that converts each kind is run once per kind.
 *
 * @type {{ readonly [k in (typeof _valueKinds)[number]]: readonly [string, Primitive] }}
 */
const valueSamples = {
    Infinity: ['Infinity', Infinity],
    NaN: ['NaN', NaN],
    false: ['false', false],
    null: ['null', null],
    true: ['true', true],
    undefined: ['undefined', undefined],
    number: ['1.5', 1.5],
    string: ['"a"', 'a'],
    bigint: ['7n', 7n],
}

/**
 * The value a block's final `return` holds, the block being a function's
 * body: what a proof of the syntax tree pins, the statement's own token
 * being a position and not a shape.
 *
 * @type {(node: Node) => Node}
 */
const returned = node => {
    assert(node[0] === '=>')
    const body = node[2]
    assert(body[0] === 'block')
    const last = body[1][body[1].length - 1]
    assert(last[0] === 'return')
    return last[1].value
}

export const proof = {
    // One token that is a whole value, of each kind, folded to its primitive.
    primitives: fromEntries(_valueKinds.map(kind => [kind, () => {
        const [source, expected] = valueSamples[kind]
        const { exported } = unwrap(parseSyntax(tokenizeString(`export default ${source};`)))
        assert(exported !== null)
        assertStructurallySame(exported.value, ['primitive', expected])
    }])),
    // The syntax tree of a function's block body: its statements in order,
    // each a record, and the value its `return` holds — pinned before the
    // fold, which lowers it, can erase it.
    blocks: {
            // Literal expectations pin syntax before lowering can erase it.
            explicitReturn: () => {
                const expression = unwrap(parseSyntax(tokenizeString('export default () => 7;')))
                const block = unwrap(parseSyntax(tokenizeString('export default () => { return 7; };')))
                assert(expression.exported !== null && block.exported !== null)
                assertStructurallySame(expression.exported.value, ['=>', [], ['primitive', 7]])
                assertStructurallySame(returned(block.exported.value), ['primitive', 7])
            },
            orderedDeclarations: () => {
                const { exported } = unwrap(parseSyntax(tokenizeString(
                    'export default () => { const x = 1; const y = 2; return [x, y]; };')))
                assert(exported !== null && exported.value[0] === '=>')
                const body = exported.value[2]
                assert(body[0] === 'block')
                const [first, second, last] = body[1]
                assert(first[0] === 'const' && second[0] === 'const' && last[0] === 'return')
                assertStructurallySame(first[1].name.token, { kind: 'id', value: 'x' })
                assertStructurallySame(second[1].name.token, { kind: 'id', value: 'y' })
                assertStructurallySame(first[1].value, ['primitive', 1])
                assertStructurallySame(second[1].value, ['primitive', 2])
                assertEq(first[1].name.metadata.column, 30)
                assertEq(second[1].name.metadata.column, 43)
                // each statement begins at its keyword and ended with its `;`
                assertEq(first[1].start.metadata.column, 24)
                assertEq(last[1].start.metadata.column, 50)
                assertStructurallySame([first[1].semicolon, second[1].semicolon, last[1].semicolon], [true, true, true])
                const array = last[1].value
                assert(array[0] === 'array')
                const [x, y] = array[1]
                assert(x[0] === 'ref' && y[0] === 'ref')
                assertStructurallySame(x[1].token, first[1].name.token)
                assertStructurallySame(y[1].token, second[1].name.token)
            },
            nestedBlocks: () => {
                const { exported } = unwrap(parseSyntax(tokenizeString(
                    'export default () => { return () => { return 7; }; };')))
                assert(exported !== null)
                assertStructurallySame(returned(returned(exported.value)), ['primitive', 7])
            },
            // A block's last statement is tagged by its keyword: a `throw`
            // is recorded as a `return` is, beginning at the keyword, its
            // value's first token kept for the line the fold asks of it.
            thrown: () => {
                const { exported, thrown } = unwrap(parseSyntax(tokenizeString('export default () => { const x = 1; throw x; };')))
                assert(exported !== null && thrown === null && exported.value[0] === '=>')
                const body = exported.value[2]
                assert(body[0] === 'block')
                const [first, last] = body[1]
                assert(first[0] === 'const' && last[0] === 'throw')
                assert(last[1].value[0] === 'ref')
                assertEq(last[1].start.metadata.column, 37)
                assertEq(last[1].first.metadata.column, 43)
                assertEq(last[1].semicolon, true)
            },
    },
    // A module ending in `throw` records it where its default would be, the
    // declarations before it kept with their export markers.
    thrownModule: () => {
        const source = unwrap(parseSyntax(tokenizeString('export const a = 1;\nthrow a')))
        assertEq(source.exported, null)
        assert(source.thrown !== null)
        assert(source.thrown.value[0] === 'ref')
        assertEq(source.thrown.semicolon, false)
        assertEq(source.thrown.start.metadata.line, 2)
        assertStructurallySame(source.consts.map(c => c.exported), [true])
        const plain = unwrap(parseSyntax(tokenizeString('throw 1;')))
        assertStructurallySame([plain.exported, plain.consts], [null, []])
        assert(plain.thrown !== null)
        const exported = unwrap(parseSyntax(tokenizeString('export default 1;')))
        assertEq(exported.thrown, null)
    },
    // A module's statements as records, each with its export marker.
    namedExports: {
        syntax: () => {
            const source = unwrap(parseSyntax(tokenizeString('const x=1; export const a=x; const y=a; export const b=y;')))
            assertEq(source.exported, null)
            assertStructurallySame(source.consts.map(c => c.exported), [false, true, false, true])
            assertStructurallySame(source.consts.map(c => c.declaration.name.token), [
                { kind: 'id', value: 'x' }, { kind: 'id', value: 'a' }, { kind: 'id', value: 'y' }, { kind: 'id', value: 'b' },
            ])
        },
    },
    // The tokenizer's EOF contract, checked through the parser rather than
    // through `splitEof` alone.
    //
    // The parser requires exactly one `eof`, in final position, because the
    // backend synthesizes its own logical end and a second marker would be a
    // symbol the grammar has no rule for. Neither stream can come from the
    // tokenizer, so only a hand-built list reaches these.
    eofContract: [
        () => {
            const wellFormed = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1),
            ]
            assertEq(parseSyntax(wellFormed)[0], 'ok')
        },
        () => {
            // no `eof`: the state machine read this as a complete module
            const noEof = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1),
            ]
            const [tag, value] = parseSyntax(noEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
        () => {
            // a second `eof`: likewise invisible to the state machine
            const twoEof = [
                proofId('export', 1), proofId('default', 1),
                proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1), proofKind('eof', 2),
            ]
            const [tag, value] = parseSyntax(twoEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'end-of-input token is not final')
        },
        () => {
            const [tag, value] = parseSyntax([])
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
    ],
    // A lexical failure ends the token stream at an `error` token and emits no
    // `eof`. `splitEof` reads a missing `eof` that way rather than as a broken
    // tokenizer contract, and reports the error where it happened — so that
    // reading is pinned here against the real tokenizer, alongside the position
    // the current parser reports for the same input.
    lexicalErrorStreamShape: [
        () => {
            const tokens = tokenizeString('const a = "abc')
            assertEq(tokens.length, 1)
            assertEq(tokens[0].token.kind, 'error')
            assertEq(tokens[0].metadata.column, 11)
        },
        () => {
            const [tag, value] = parseSyntax(tokenizeString('const a = "abc'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
            assertEq(value.metadata?.column, 11)
        },
        () => {
            // anchored at the `/*` that was never closed, not at the end of
            // input — the same convention the unterminated string above uses
            const [tag, value] = parseSyntax(tokenizeString('const a = /* x'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.column, 11)
        },
    ],
}
