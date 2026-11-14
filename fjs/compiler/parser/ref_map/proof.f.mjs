/**
 * The empty reference map's matcher: the canonical body under any names
 * and any layout is the map, and a body a step away is not.
 *
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Node, ParameterList } from '../syntax/types.ts'
 */
import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { stringToList } from '../../../text/utf16/module.f.js'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { nameOf, parseSyntax } from '../syntax/module.f.mjs'
import { blocks, isRefMap, names, source } from './module.f.mjs'

/** The function a module's first statement declares, and the name it is declared under. @type {(text: string) => readonly [Extract<Node, readonly ['=>', ParameterList, Node]>, string]} */
const declared = text => {
    const { statements } = assertOk(parseSyntax(tokenize(stringToList(text))('proof')))
    const { target, value } = /** @type {{ readonly declaration: { readonly target: readonly ['name', ModuleTokenWithMetadata], readonly value: Extract<Node, readonly ['=>', ParameterList, Node]> } }} */ (statements[0][1]).declaration
    return [value, nameOf(target[1])]
}

/** Whether the first function of `text` is the map under its own name. @type {(text: string) => boolean} */
const is = text => isRefMap(...declared(text))

/** @type {string} */
const canonical = `${source}export default empty\n`

export const proof = {
    // The canonical body is the map, under the name it is declared with
    // and no other; a function no declaration names is not.
    canonical: () => {
        const [node] = declared(canonical)
        assert(isRefMap(node, 'empty'))
        assert(!isRefMap(node, 'other'))
        assert(!isRefMap(node, null))
    },
    // Names are the candidate's own: the map's, a local's, one name used
    // where the canonical body reuses another, and a property bound under
    // a name that is not its key.
    renamed: () => {
        assert(is(canonical.replaceAll('empty', 'm')))
        assert(is(canonical.replaceAll('ids', 'table').replaceAll('existing', 'found').replaceAll('root', 'r')))
        assert(is(canonical
            .replace('const get = (node, i)', 'const get = (n, k)')
            .replace('if (node === undefined) { return undefined }', 'if (n === undefined) { return undefined }')
            .replace('if (i === 1n) { return node.value }', 'if (k === 1n) { return n.value }')
            .replace('node = i & 1n ? node.one : node.zero', 'n = k & 1n ? n.one : n.zero')
            .replace('i >>= 1n', 'k >>= 1n')))
        assert(is(canonical
            .replace('const { value, zero, one } = node ?? {}', 'const { value: v, zero, one } = node ?? {}')
            .replaceAll('{ value, zero', '{ value: v, zero')))
    },
    // Layout is the candidate's own too: semicolons, and one line or many.
    layout: () => {
        assert(is(canonical.replaceAll('1n\n', '1n;\n')))
        assert(is(canonical.replace('{ return undefined }', '{\n                return undefined;\n            }')))
    },
    // A step away is another function: a constant, an operator, a name
    // read in another's place, a statement more or fewer, a key.
    departures: () => {
        for (const [from, to] of [
            ['let next = 1n', 'let next = 2n'],
            ['i >>= 1n', 'i >>= 2n'],
            ['i >>= 1n', 'i <<= 1n'],
            ['[undefined, empty]', '[undefined, make]'],
            ['[old, self]', '[old, make]'],
            ['node = i & 1n', 'i = i & 1n'],
            ['ids.set(key, i)\n', ''],
            ['ids.set(key, i)\n', 'ids.set(key, i)\n            ids.set(key, i)\n'],
            ['node.value', 'node.zero'],
            ['{ value: newValue, zero, one }', '{ zero, value: newValue, one }'],
            ['new WeakMap()', 'new Map()'],
            ['(key, value) => {\n    const ids', '(value, key) => {\n    const ids'],
            ['const self = (key, value)', 'const self = (key, key)'],
        ]) {
            assert(canonical.includes(from), from)
            assert(!is(canonical.replace(from, to)), to)
        }
    },
    // Any function at all is answered, never failed on: patterns, a rest
    // property, a default, an assignment, a call statement, and a
    // parameter list that is none.
    others: () => {
        for (const text of [
            'const f = ({ a, ...r }, [b]) => { let c = a; c = b; f(c); return (a.b) => r }\nexport default f\n',
            'const f = (a, b = 1) => { const [c] = a; return c }\nexport default f\n',
            'const f = a => a\nexport default f\n',
        ]) { assert(!is(text), text) }
    },
    // A tree deeper than the map is not the map, and is not read past the
    // map's own depth, however deep it goes.
    deep: () => {
        const nested = '['.repeat(4_000) + ']'.repeat(4_000)
        assert(!is(`const f = (a, b) => ${nested}\nexport default f\n`))
        assert(!is(canonical.replace('ids.get(key)', `ids.get(${'['.repeat(100)}key${']'.repeat(100)})`)))
    },
    // What the reader checks of a body that is the map: every name it
    // binds, and every block's statements.
    read: () => {
        const [node] = declared(canonical)
        assertStructurallySame(names(node).map(nameOf), [
            'key', 'value', 'ids', 'next', 'get', 'node', 'i', 'set', 'node', 'i', 'newValue', 'value', 'zero', 'one',
            'make', 'root', 'self', 'key', 'value', 'existing', 'old', 'i',
        ])
        assertStructurallySame(blocks(node).map(block => block.map(([tag]) => tag)), [
            ['const', 'let', 'const', 'const', 'const', 'return'],
            ['while'],
            ['if', 'if', 'assign', 'assign'],
            ['return'],
            ['return'],
            ['const', 'return'],
            ['const', 'return'],
            ['const', 'const', 'if', 'const', 'if', 'const', 'return'],
            ['return'],
            ['assign'],
        ])
        assertEq(blocks(null).length, 0)
    },
}
