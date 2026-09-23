/**
 * The syntax reader's proof: what the tree it builds keeps before the fold
 * erases it, and the token stream's end-of-input contract, which the
 * reader alone checks — the rest of the parser's proof, every case that
 * reads a name or an AST, is [`../proof.f.mjs`](../proof.f.mjs).
 *
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 */

import { readFromTokens } from './module.f.mjs'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(s: string) => readonly DjsTokenWithMetadata[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s))(''))

/** @type {(kind: 'ws' | 'nl' | 'null' | 'true' | 'false' | 'undefined' | 'eof' | ';', line: number) => DjsTokenWithMetadata} */
const proofKind = (kind, line) => ({ token: { kind }, metadata: { path: 'a.js', line, column: 1 } })

/** @type {(value: string, line: number) => DjsTokenWithMetadata} */
const proofId = (value, line) => ({ token: { kind: 'id', value }, metadata: { path: 'a.js', line, column: 1 } })

export const proof = {
    sourceBlocks: {
        // Literal expectations pin syntax before lowering can erase it.
        explicitReturn: () => {
            const expression = unwrap(readFromTokens(tokenizeString('export default () => 7;')))
            const block = unwrap(readFromTokens(tokenizeString('export default () => { return 7; };')))
            assertStructurallySame(expression.exported, ['=>', ['names', []], ['primitive', 7]])
            assertStructurallySame(block.exported, ['=>', ['names', []], ['block', [['return', ['primitive', 7]]]]])
        },
        orderedDeclarations: () => {
            const { exported } = unwrap(readFromTokens(tokenizeString(
                'export default () => { const x = 1; const y = 2; return [x, y]; };')))
            assert(exported !== null && exported[0] === '=>')
            const body = exported[2]
            assert(body[0] === 'block')
            const [first, second, last] = body[1]
            assert(first[0] === 'const' && second[0] === 'const' && last[0] === 'return')
            assertStructurallySame(first[1].name.token, { kind: 'id', value: 'x' })
            assertStructurallySame(second[1].name.token, { kind: 'id', value: 'y' })
            assertStructurallySame(first[1].value, ['primitive', 1])
            assertStructurallySame(second[1].value, ['primitive', 2])
            assertEq(first[1].name.metadata.column, 30)
            assertEq(second[1].name.metadata.column, 43)
            const returned = last[1]
            assert(returned[0] === 'array')
            const [x, y] = returned[1]
            assert(x[0] === 'ref' && y[0] === 'ref')
            assertStructurallySame(x[1].token, first[1].name.token)
            assertStructurallySame(y[1].token, second[1].name.token)
        },
        nestedBlocks: () => {
            const { exported } = unwrap(readFromTokens(tokenizeString(
                'export default () => { return () => { return 7; }; };')))
            assertStructurallySame(exported, ['=>', ['names', []], ['block', [
                ['return', ['=>', ['names', []], ['block', [['return', ['primitive', 7]]]]]],
            ]]])
        },
        syntaxRefusals: () => {
            for (const source of [
                'export default () => {};',
                'export default () => { return; };',
                'export default () => { return 7 };',
                'export default () => { return 7; const x = 1; };',
                'export default () => { return 7; return 8; };',
                'export default ()\n=> 7;',
                'export default () => { return\n7; };',
                'export default () => { return /*\n*/ 7; };',
            ]) {
                assertEq(readFromTokens(tokenizeString(source))[0], 'error')
                assertEq(readFromTokens(tokenizeString(source))[0], 'error')
            }
            // A line break inside the returned group is still admitted.
            const source = 'export default () => { return (\n7\n); };'
            assertEq(readFromTokens(tokenizeString(source))[0], 'ok')
            assertEq(readFromTokens(tokenizeString(source))[0], 'ok')
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
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1),
            ]
            assertEq(readFromTokens(wellFormed)[0], 'ok')
        },
        () => {
            // no `eof`: the state machine read this as a complete module
            const noEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1),
            ]
            const [tag, value] = readFromTokens(noEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'missing end-of-input token')
        },
        () => {
            // a second `eof`: likewise invisible to the state machine
            const twoEof = [
                proofId('export', 1), proofKind('ws', 1), proofId('default', 1),
                proofKind('ws', 1), proofKind('null', 1), proofKind(';', 1), proofKind('eof', 1), proofKind('eof', 2),
            ]
            const [tag, value] = readFromTokens(twoEof)
            assert(tag === 'error', tag)
            assertEq(value.message, 'end-of-input token is not final')
        },
        () => {
            const [tag, value] = readFromTokens([])
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
            const [tag, value] = readFromTokens(tokenizeString('const a = "abc'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.line, 1)
            assertEq(value.metadata?.column, 11)
        },
        () => {
            // anchored at the `/*` that was never closed, not at the end of
            // input — the same convention the unterminated string above uses
            const [tag, value] = readFromTokens(tokenizeString('const a = /* x'))
            assert(tag === 'error', tag)
            assertEq(value.metadata?.column, 11)
        },
    ],
}
