/**
 * The empty reference map as the parser recognizes it
 * ([proposal](../../../../spec/todo/reference-map.md)): one function,
 * whole, compared with the canonical body as a syntax tree, up to a
 * consistent renaming of what it binds and to its layout. The body is too
 * long to match statement by statement as the `entry` helper is, so it is
 * written once here as source, parsed by the same grammar, and a candidate
 * is the map where the two trees are the same after {@link shape}. A
 * further admitted body is one more source.
 *
 * @module
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { BindingTarget, Node, ParameterList } from '../syntax/types.ts'
 */

import { assertOk } from '../../../asserts/module.f.js'
import { structurallySame } from '../../../types/object/structurally_same/module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'
import { stringToList } from '../../../text/utf16/module.f.js'
import { tokenize } from '../../tokenizer/module.f.mjs'
import { nameOf, parseSyntax } from '../syntax/module.f.mjs'

/**
 * The canonical body. It names itself, `empty`, so that a read of the
 * empty map answers the empty map; a candidate does so under the name its
 * own declaration binds.
 */
export const source = `const empty = (key, value) => {
    const ids = new WeakMap()
    let next = 1n
    const get = (node, i) => {
        while (true) {
            if (node === undefined) { return undefined }
            if (i === 1n) { return node.value }
            node = i & 1n ? node.one : node.zero
            i >>= 1n
        }
    }
    const set = (node, i, newValue) => {
        const { value, zero, one } = node ?? {}
        return i === 1n ? { value: newValue, zero, one } :
            i & 1n ? { value, zero, one: set(one, i >> 1n, newValue) } :
            { value, zero: set(zero, i >> 1n, newValue), one }
    }
    const make = root => {
        const self = (key, value) => {
            const existing = ids.get(key)
            const old = existing === undefined ? undefined : get(root, existing)
            if (value === undefined) { return [old, self] }
            const i = existing ?? next
            if (existing === undefined) { next += 1n }
            ids.set(key, i)
            return [old, make(set(root, i, value))]
        }
        return self
    }
    return value === undefined ? [undefined, empty] : make(undefined)(key, value)
}
`

/**
 * Whether an object of a tree is a token: the one that says whether a line
 * ends before it. An assignment's operator holds a token and is none.
 *
 * @type {(tree: object) => boolean}
 */
const isToken = tree => hasEntry(tree, 'newline')

/** What a tree says of its layout alone: where a statement starts and whether it ends with `;`, a `return`'s first token, a key's spelling. */
const layout = ['start', 'semicolon', 'first', 'spelling']

/**
 * The names a binding target binds, in order: a name's, or those an object
 * pattern binds directly, which is as deep as the canonical body's go; a
 * pattern any deeper is no part of the map, and its names stay unbound.
 *
 * @type {(target: BindingTarget) => readonly string[]}
 */
const bound = target => {
    if (target[0] === 'name') { return [nameOf(target[1])] }
    const entries = /** @type {readonly { readonly target?: unknown }[]} */ (target[2])
    return target[0] === 'object' ? entries.flatMap(entry => entry.target instanceof Array && entry.target[0] === 'name' ? [nameOf(entry.target[1])] : []) : []
}

/** The names a block's own declarations bind. @type {(statements: readonly (readonly [string, { readonly target: BindingTarget }])[]) => readonly string[]} */
const declared = statements => statements.flatMap(([tag, statement]) => tag === 'const' || tag === 'let' ? bound(statement.target) : [])

/**
 * A name as its binding's depth in `scope`, the innermost binding of the
 * name, so that two trees agree where they bind and read alike whatever
 * the names; a name nothing in the function binds stays the word it is.
 *
 * @type {(scope: readonly string[], token: ModuleTokenWithMetadata) => unknown}
 */
const named = (scope, token) => {
    const depth = scope.lastIndexOf(nameOf(token))
    return depth < 0 ? ['free', nameOf(token)] : ['bound', depth]
}

/**
 * How deep a tree is read. The canonical body is shallower, and a tree
 * that is deeper is not the map, so the reader stops there, `'deep'`: no
 * source, however nested, costs more than the map itself does.
 */
const limit = 48

/**
 * A syntax tree without its names and its layout, read `depth` levels
 * down. `scope` holds the names in scope, outermost first: a function adds
 * its parameters and a block its declarations, each visible throughout it.
 *
 * @type {(scope: readonly string[], depth: number) => (tree: unknown) => unknown}
 */
const shape = (scope, depth) => tree => {
    if (depth === 0) { return 'deep' }
    const inside = depth - 1
    if (tree instanceof Array) {
        switch (tree[0]) {
            case 'ref': case 'name': { return [tree[0], named(scope, tree[1])] }
            // a call statement binds nothing, and its target only marks where it starts
            case 'discard': { return ['discard'] }
            case 'assign': { return ['assign', shape(scope, inside)({ ...tree[1], name: null }), named(scope, tree[1].name)] }
            case '=>': {
                const list = /** @type {ParameterList} */ (tree[1])
                const inner = hasEntry(list, 'fixed') ? [...scope, ...list.fixed.flatMap(bound)] : scope
                return tree.map(shape(inner, inside))
            }
            case 'block': { return ['block', tree[1].map(shape([...scope, ...declared(tree[1])], inside))] }
            default: { return tree.map(shape(scope, inside)) }
        }
    }
    if (tree === null || typeof tree !== 'object') { return tree }
    // a token is its kind and what it spells, wherever it stands in the source
    if (isToken(tree)) {
        const { token } = /** @type {ModuleTokenWithMetadata} */ (tree)
        return ['token', token.kind, hasEntry(token, 'value') ? token.value : null]
    }
    return Object.fromEntries(Object.entries(tree)
        .filter(([key]) => !layout.includes(key) && !(key === 'key' && hasEntry(tree, 'spelling')))
        .map(([key, value]) => [key, shape(scope, inside)(value)]))
}

/** The canonical body's declaration, read from a module that exports it, the least a module is: its name and its function. */
const canonical = (() => {
    const { statements } = assertOk(parseSyntax(tokenize(stringToList(`${source}export default empty\n`))('ref_map')))
    const { target, value } = /** @type {{ readonly declaration: { readonly target: readonly ['name', ModuleTokenWithMetadata], readonly value: Node } }} */ (statements[0][1]).declaration
    return /** @type {const} */ ([nameOf(target[1]), value])
})()

/** {@link shape} of a function declared under `self`, the name its body may read as itself. @type {(node: unknown, self: string) => unknown} */
const shapeOf = (node, self) => shape([self], limit)(node)

const canonicalShape = shapeOf(canonical[1], canonical[0])

/**
 * Whether a function is the empty reference map: the canonical body under
 * any names, declared under `self`. A function no declaration names has no
 * `self`, and cannot be it.
 *
 * @type {(node: Extract<Node, readonly ['=>', ParameterList, Node]>, self: string | null) => boolean}
 */
export const isRefMap = (node, self) => self !== null && structurallySame(shapeOf(node, self), canonicalShape)

/**
 * Every name token a tree binds, for the reader to refuse a keyword among
 * them. @type {(tree: unknown) => readonly ModuleTokenWithMetadata[]}
 */
export const names = tree => {
    if (tree instanceof Array) { return tree[0] === 'name' ? [tree[1]] : tree.flatMap(names) }
    return tree === null || typeof tree !== 'object' || isToken(tree) ? [] : Object.values(tree).flatMap(names)
}

/**
 * Every block of a tree, each its statements, for the reader to hold to
 * JavaScript's line rules. @type {(tree: unknown) => readonly (readonly (readonly [string, object])[])[]}
 */
export const blocks = tree => {
    if (tree instanceof Array) { return [...tree[0] === 'block' ? [tree[1]] : [], ...tree.flatMap(blocks)] }
    return tree === null || typeof tree !== 'object' || isToken(tree) ? [] : Object.values(tree).flatMap(blocks)
}
