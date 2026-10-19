/**
 * The runtime as a value: `fjs/js/runtime` printed as Rust
 * ([`fjs/js/runtime/README.md`](../../../js/runtime/README.md), "How NaNVM
 * finds it").
 *
 * The module's `runtime` export is printed by the ordinary backend as any
 * module is ([`../module.f.mjs`](../module.f.mjs)'s `itemTagged`), a scope
 * that evaluates, into `pub fn runtime<A: IStaticFunction>() ->
 * Result<Any<A>, Any<A>>`: the object of two functions, `static` and
 * `dot`, which whoever runs compiled modules builds once and hands each as
 * its parameter. Two things are this printer's own. Every static body —
 * the function the module's `statics` export holds at an id, `Object.is`
 * — carries the NativeFunction text of its id in place of its body's,
 * since a static function is the built-in, not its body, and `String(f)`
 * of one is observable; the ordinary backend takes it as the text a caller
 * gives a node. A member body's text is observable nowhere, since the
 * language never reads a member as a value, so `member` keeps its
 * bodies' texts and the printer does not read it. And the scope is printed
 * with no runtime in it: a member call or a read of a static function the
 * runtime defines is refused by the backend, naming it, since the core may
 * not use what it defines — a body reaches a native through an intrinsic,
 * `slice`, and another body by reading it as a value — where the native
 * static `Object.entries`, which `statics` lists as itself, is the
 * closure the value holds.
 *
 * Refused too, before the backend sees the module: a module without a
 * `runtime` export or a `statics` export that is an object literal, an
 * entry that is no function, a body
 * under a path `nanvm-lib` binds natively, and one function two ids name,
 * which JavaScript keeps apart and which could carry only one of the two
 * texts
 * ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * A built-in is found through an import's read of its export object,
 * `{ f }.f`, which the lowering spells an import as and which folds to
 * `f`. Any other export is the module's own, for its types and its proof.
 *
 * @module
 *
 * @import { Exp } from '../../../edag/types.ts'
 * @import { Use } from '../../../edag/rust/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _BuiltIn, _Resolved, _Table } from './private.ts'
 */

import { error, mapOk, ok, okList, okThen } from '../../../types/result/module.f.js'
import { useLinesTagged } from '../../../edag/rust/module.f.mjs'
import { generatedHeader } from '../../../media/rust/item/module.f.js'
import { tagged, untagged } from '../../../text/marked/module.f.mjs'
import { isNative } from '../../../js/static/module.f.js'
import { isStatic, nativeFunctionText, staticPath } from '../../../edag/module.f.mjs'
import { itemTagged } from '../module.f.mjs'

/**
 * A module-level node the `statics` table holds, resolved: a function,
 * which is a built-in; a native static the table lists as itself,
 * `Object.entries`, which is no built-in of the module's; or anything
 * else, which is no built-in. An import is read off its export object by a literal key,
 * `{ f }.f`, and folds to the property's value, resolved in turn.
 *
 * @type {(node: Exp) => _Resolved}
 */
const resolve = node => {
    if (!(node instanceof Array)) { return ['other', node] }
    const [id, a, key] = /** @type {readonly any[]} */ (node)
    if (id === '=>') { return ['function', node] }
    if (isStatic(node) && isNative(staticPath(node[0]))) { return ['native', node] }
    if (id === '.' && node.length === 3 && typeof key === 'string') {
        const property = literalProperties(a)?.find(p => p[1] === key)
        return property === undefined ? ['other', node] : resolve(/** @type {Exp} */ (property[2]))
    }
    return ['other', node]
}

/**
 * The properties of an object literal written out, each `[':', key, value]`
 * with a literal key, a key written twice kept at its last writing, as the
 * EDAG means it; or `null` for any other node, a spread or a computed key
 * among them. A member of an object literal is a property or a spread,
 * each an array, so its tag is read as one.
 *
 * @type {(node: unknown) => readonly (readonly any[])[] | null}
 */
const literalProperties = node => {
    if (!(node instanceof Array) || node[0] !== '{}') { return null }
    const properties = /** @type {readonly (readonly any[])[]} */ (node[1])
    return properties.every(p => p[0] === ':' && typeof p[1] === 'string')
        ? properties.filter((p, i) => properties.findLastIndex(q => q[1] === p[1]) === i)
        : null
}

/**
 * The built-ins the `statics` export holds: each key an id a static path
 * admits, `Object.is` — which `fjs/js/runtime/types.ts` pins, so the
 * printer takes the keys as given — and each entry resolving to a function
 * node, the body carrying the NativeFunction text of the id — or, at a
 * path `nanvm-lib` binds natively, the native static as itself, passed
 * over, since `nanvm-lib` writes it. Or the refusal: a value that is no
 * object literal, an entry that is no function, a body at a native path.
 *
 * @type {(table: unknown) => Result<readonly _BuiltIn[], readonly unknown[]>}
 */
const builtIns = table => {
    const entries = literalProperties(table)
    if (entries === null) { return error(['no `statics` export of an object literal', table]) }
    /** @type {(property: readonly any[]) => Result<readonly _BuiltIn[], readonly unknown[]>} */
    const builtIn = ([, id, node]) => {
        const [kind, resolved] = resolve(node)
        return isNative(staticPath(id))
            ? kind === 'native' ? ok([]) : error(['a body for a static every executor binds natively', id])
            : kind === 'function' ? ok([{ name: id, node: resolved }])
            : error(['a built-in that is no function', id])
    }
    return mapOk((/** @type {readonly (readonly _BuiltIn[])[]} */ lists) => lists.flat())(okList(entries.map(builtIn)))
}

/**
 * The module's `runtime` export, the value, and every built-in its
 * `statics` export names, {@link builtIns}. Or the refusal: a module that
 * is no object of exports, one without the `runtime` export or the
 * `statics` export, what {@link builtIns} refuses, and one function two
 * ids name, which JavaScript keeps apart, `isNaN` and `Number.isNaN`,
 * and which could carry only one text.
 *
 * @type {(root: Exp) => Result<_Table, readonly unknown[]>}
 */
const table = root => {
    const exports = literalProperties(root)
    if (exports === null) { return error(['the runtime module is no object of exports', root]) }
    const runtime = exports.find(p => p[1] === 'runtime')
    if (runtime === undefined) { return error(['no `runtime` export', root]) }
    const statics = exports.find(p => p[1] === 'statics')
    if (statics === undefined) { return error(['no `statics` export of an object literal', root]) }
    return okThen((/** @type {readonly _BuiltIn[]} */ all) => {
        const twice = all.find((b, i) => all.findIndex(c => c.node === b.node) !== i)
        return twice === undefined ? ok(/** @type {_Table} */ ({ builtIns: all, value: /** @type {Exp} */ (runtime[2]) }))
            : error(['a function two built-ins name; JavaScript keeps them apart', twice.name])
    })(builtIns(statics[2]))
}

/**
 * The runtime as a value, tagged, with the names it spells: the `runtime`
 * export object printed by the ordinary backend with no runtime in its
 * scope, every static body carrying the NativeFunction text of its id.
 *
 * @type {(sections: _Table) => Result<{ readonly lines: readonly string[], readonly uses: readonly Use[], readonly bound: string }, readonly unknown[]>}
 */
const valueLines = ({ builtIns, value }) => {
    /** @type {(node: Exp) => string | undefined} */
    const text = node => {
        const named = builtIns.find(b => b.node === node)
        return named === undefined ? undefined : nativeFunctionText(`${named.name.split('.').at(-1)}`)
    }
    return mapOk((/** @type {{ readonly lines: readonly string[], readonly uses: { readonly vm: readonly string[], readonly unstable: readonly string[] }, readonly bound: string }} */ { lines, uses, bound }) => ({
        lines: [
            tagged('comment')('/// The runtime as a value: the `runtime` export of `fjs/js/runtime`, its `static` and `dot`'),
            tagged('comment')('/// functions over the tables they close over, as the ordinary backend prints any module — every'),
            tagged('comment')('/// static body a closure carrying the NativeFunction text of its id, `Object.entries` the built-in'),
            tagged('comment')('/// itself. Built once by whoever runs compiled modules and handed to each as its parameter'),
            tagged('comment')('/// (`fjs/js/runtime/README.md`).'),
            ...lines,
        ],
        uses: [...uses.vm.map(n => /** @type {Use} */ (['vm', n])), ...uses.unstable.map(n => /** @type {Use} */ (['unstable', n]))],
        bound,
    }))(itemTagged('runtime', text, null)(value))
}

/**
 * The runtime of the module `root` as Rust, tagged, or the refusal: the
 * generated header, the `use` lines for every name the value spells, and
 * the value, {@link valueLines}.
 *
 * @type {(root: Exp) => Result<string, readonly unknown[]>}
 */
export const generateRuntimeTagged = root => okThen((/** @type {_Table} */ sections) =>
    mapOk((/** @type {{ readonly lines: readonly string[], readonly uses: readonly Use[], readonly bound: string }} */ { lines, uses, bound }) => [
        tagged('comment')(generatedHeader('`npm run gen` from `fjs/js/runtime/module.f.js`', 'change the runtime and regenerate')),
        '',
        ...useLinesTagged({ vm: names(uses)('vm'), unstable: names(uses)('unstable') }, bound),
        '',
        ...lines,
        '',
    ].join('\n'))(valueLines(sections)))(table(root))

/**
 * The names spelled from `module`, each once, sorted.
 *
 * @type {(uses: readonly Use[]) => (module: Use[0]) => readonly string[]}
 */
const names = uses => module => [...new Set(uses.filter(([m]) => m === module).map(([, name]) => name))].toSorted()

/**
 * {@link generateRuntimeTagged} as plain text, with a refusal as text:
 * `[reason, detail]` pairs joined as `../module.f.mjs` joins its own.
 *
 * @type {(root: Exp) => Result<string, string>}
 */
export const generateRuntime = root => {
    const result = generateRuntimeTagged(root)
    return result[0] === 'ok' ? ok(untagged(result[1])) : error(result[1].map(String).join(': '))
}
