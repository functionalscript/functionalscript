/**
 * The static runtime: `fjs/js/runtime` printed as static Rust functions,
 * the design of
 * [`nanvm/lib/todo/static-runtime.md`](../../../../nanvm/lib/todo/static-runtime.md).
 *
 * Where [`../module.f.mjs`](../module.f.mjs) prints a module as a scope
 * that *evaluates* — temporaries, and a closure with a frame for every
 * function — this printer reads the module at compile time and prints
 * items. Every module-level function is a static `fn` of its arguments
 * alone, with an accessor answering its descriptor, a
 * `&'static RuntimeFunction<A>` holding the built-in's name, code, length
 * and text; a frame slot is resolved here, to a function's accessor or an
 * inlined literal; and the `runtime` export object is read as the table of
 * built-ins, its `static` section naming each `Object.is`, its `member`
 * section `String.prototype.startsWith`, and printed nowhere. A built-in's
 * identity is its name, so a read of one costs nothing and holds nothing:
 * no evaluation, no holder, no `thread_local!`.
 *
 * What the runtime's module scope may hold is **functions and literals**,
 * and an import's read of its export object, `{ f }.f`, which the lowering
 * spells an import as and which folds to `f`. Anything else a body would
 * capture — an object, an array, an operation — is refused, naming the
 * node, as is a function a body makes at call time, which would need the
 * VM's `IStaticFunction` where every item is bound on `IVm` alone, and as
 * is a module exporting anything beside `runtime`, whose initializer the
 * lifting would drop, and a function no built-in reaches, which a property
 * written twice leaves behind
 * ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * A literal written twice under one key is its last value, as the EDAG
 * means it.
 *
 * @module
 *
 * @import { Exp } from '../../../edag/types.ts'
 * @import { Printed, Use } from '../../../edag/rust/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _BuiltIn, _Item, _Resolved } from './private.ts'
 */

import { error, mapOk, ok, okList, okThen, unwrap } from '../../../types/result/module.f.js'
import { atomExpr, holdsFunction, readsArgs, readsRest, restLine, statementsWith, useLinesTagged } from '../../../edag/rust/module.f.mjs'
import { operandsOf, visit } from '../../../edag/sharing/module.f.mjs'
import { tryFunctionText } from '../../serializer/module.f.mjs'
import { stringLiteral } from '../../../media/rust/module.f.mjs'
import { generatedHeader, indent } from '../../../media/rust/item/module.f.js'
import { tagged, untagged } from '../../../text/marked/module.f.mjs'
import { natives } from '../../../js/static/module.f.js'

const kw = tagged('keyword')
const lit = tagged('literal')

/** The bound of every item: a built-in needs no capability of the VM. */
const bound = 'IVm'

/**
 * A module-level node resolved at compile time: a function, which becomes
 * an item; a literal, inlined where a body reads it; or the refusal of
 * anything else, since the runtime's module scope holds functions and
 * literals. An import is read off its export object by a literal key,
 * `{ f }.f`, and folds to the property's value, resolved in turn.
 *
 * @type {(node: Exp) => Result<_Resolved, readonly unknown[]>}
 */
const resolve = node => {
    if (!(node instanceof Array)) { return ok(/** @type {const} */ (['literal', node])) }
    const [id, a, key] = /** @type {readonly any[]} */ (node)
    if (id === '=>') { return ok(/** @type {const} */ (['function', node])) }
    if (id === 'undefined') { return ok(/** @type {const} */ (['literal', node])) }
    if (id === '.' && node.length === 3 && typeof key === 'string') {
        const property = literalProperties(a)?.find(p => p[1] === key)
        return property === undefined ? refused(node) : resolve(/** @type {Exp} */ (property[2]))
    }
    return refused(node)
}

/** @type {(node: Exp) => Result<never, readonly unknown[]>} */
const refused = node => error(['no static Rust for a module-level node; the runtime holds functions and literals', node])

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
 * The built-ins of one section, `static` or `member`: an object of
 * namespaces, each an object of functions, each resolving to a function
 * node; `name` spells a built-in's name from its namespace and key.
 *
 * @type {(name: (namespace: string, key: string) => string, member: boolean) => (section: unknown) => Result<readonly _BuiltIn[], readonly unknown[]>}
 */
const builtIns = (name, member) => section => {
    const namespaces = literalProperties(section)
    if (namespaces === null) { return error(['a section of the runtime that is no object', section]) }
    return okList(namespaces.flatMap(([, namespace, functions]) => {
        const properties = literalProperties(functions)
        if (properties === null) { return [error(['a namespace of the runtime that is no object', namespace])] }
        return properties.map(([, key, node]) => okThen(
            /** @type {(resolved: _Resolved) => Result<_BuiltIn, readonly unknown[]>} */
            (resolved) => resolved[0] === 'function'
                ? ok({ name: name(namespace, key), node: resolved[1], member: member ? /** @type {const} */ ([namespace, key]) : null })
                : error(['a built-in that is no function', name(namespace, key)]))(resolve(node)))
    }))
}

/**
 * Every built-in the module's `runtime` export names, the `static` section's
 * then the `member` section's, either section absent for none; or the
 * refusal of a module without the export or with another beside it, whose
 * initializer the lifting would drop, or of a section that is not objects
 * of functions.
 *
 * @type {(root: Exp) => Result<readonly _BuiltIn[], readonly unknown[]>}
 */
const table = root => {
    const exports = literalProperties(root)
    if (exports === null) { return error(['no `runtime` export of objects', root]) }
    const others = exports.filter(p => p[1] !== 'runtime').map(p => p[1])
    if (others.length !== 0) { return error(['the runtime module exports `runtime` alone; the lifting would drop an export', others]) }
    const runtime = exports.find(p => p[1] === 'runtime')
    const sections = runtime === undefined ? null : literalProperties(runtime[2])
    if (sections === null) { return error(['no `runtime` export of objects', root]) }
    /** @type {(name: string) => unknown} */
    const section = name => sections.find(p => p[1] === name)?.[2] ?? ['{}', []]
    return okThen((/** @type {readonly _BuiltIn[]} */ statics) =>
        mapOk((/** @type {readonly _BuiltIn[]} */ members) => [...statics, ...members])(
            builtIns((type, key) => `${type}.prototype.${key}`, true)(section('member'))))(
        builtIns((namespace, key) => `${namespace}.${key}`, false)(section('static')))
}

/**
 * The Rust identifier of a built-in's name, `object_is` for `Object.is` and
 * `string_prototype_starts_with` for `String.prototype.startsWith`: each
 * part in snake case, the parts joined by one underscore. A word starts at
 * a capital between a lowercase letter and a lowercase letter, so that
 * `isNaN` is `is_nan` as Rust spells it and not `is_na_n`, which
 * `snakeCase` in `fjs/media/rust`, a word at every capital, would make of
 * it; the corpus keeps that spelling for its file names.
 *
 * @type {(name: string) => string}
 */
const identifier = name => name.split('.').map(snake).join('_')

/** @type {(part: string) => string} */
const snake = part => [...part].map((c, i) => {
    const lower = c.toLowerCase()
    const starts = c !== lower && i > 0 && isLower(part[i - 1]) && i + 1 < part.length && isLower(part[i + 1])
    return starts ? `_${lower}` : lower
}).join('')

/** @type {(c: string) => boolean} */
const isLower = c => c === c.toLowerCase() && c !== c.toUpperCase()

/**
 * The items of a module: every module-level function, the walk of one scope
 * stopping at each function's body, named by the table where a built-in
 * resolves to it and `f` with its index among the helpers otherwise.
 * Refused: a module-level node that is no function, no object, no import's
 * read and no `undefined` — an operation the lifting would drop
 * unevaluated — and a function no built-in reaches through its slots,
 * which a property written twice leaves behind, since nothing would print
 * it and the module would mean something else.
 *
 * @type {(root: Exp, builtIns: readonly _BuiltIn[]) => Result<readonly _Item[], readonly unknown[]>}
 */
const items = (root, builtIns) => {
    const nodes = visit(operandsOf)([])(root).map(([n]) => n).filter(n => n instanceof Array)
    const stray = nodes.find(n => !['=>', '{}', '.', 'undefined'].includes(n[0]))
    if (stray !== undefined) { return refused(/** @type {Exp} */ (stray)) }
    const functions = nodes.filter(n => n[0] === '=>')
    const reached = reach(builtIns.map(b => b.node), [])
    const dropped = functions.find(n => !reached.includes(n))
    if (dropped !== undefined) { return error(['a function no built-in reaches; a property written twice keeps its last value', dropped]) }
    const helpers = functions.filter(n => !builtIns.some(b => b.node === n))
    return ok(functions.map(node => {
        const named = builtIns.find(b => b.node === node)
        const name = named === undefined ? `f${helpers.indexOf(node)}` : named.name
        return { node, name, ident: identifier(name) }
    }))
}

/**
 * The functions `pending` and every function they reach through their
 * slots, transitively, each once: the items a module's built-ins need. A
 * slot that resolves to nothing an item may hold is left to `itemLines`
 * to refuse, naming it.
 *
 * @type {(pending: readonly (readonly unknown[])[], seen: readonly (readonly unknown[])[]) => readonly (readonly unknown[])[]}
 */
const reach = (pending, seen) => {
    if (pending.length === 0) { return seen }
    const [fn, ...rest] = pending
    if (seen.includes(fn)) { return reach(rest, seen) }
    const slots = /** @type {readonly Exp[]} */ (/** @type {readonly any[]} */ (fn)[2]).flatMap(slot => {
        const resolved = resolve(slot)
        return resolved[0] === 'ok' && resolved[1][0] === 'function' ? [resolved[1][1]] : []
    })
    return reach([...rest, ...slots], [...seen, fn])
}

/**
 * A built-in as a value, where a body reads one: the accessor's descriptor
 * wrapped as the `Function` it is, `Function::from(f0::<A>()).to_any()`,
 * one function however often it is read.
 *
 * @type {(ident: string) => Printed<string>}
 */
const reference = ident => [`Function::from(${ident}::<A>()).to_any()`, [['vm', 'Function'], ['vm', 'ToAny']]]

/**
 * The lines of one item, tagged, with the names they spell: the code, a
 * `fn` of the arguments alone whose body is the function's scope with its
 * frame slots resolved — a function's accessor, or a literal inlined — and
 * its `self` the item itself; then the accessor, `pub fn` answering the
 * descriptor as a promoted constant. Refused: a function a body makes at
 * call time, since an item is bound on `IVm` alone; a body the text writer
 * has no spelling for, since a built-in carries its text; and a slot that
 * resolves to nothing an item may hold. A slot that resolves to a function
 * names an item, since every module-level function is one.
 *
 * @type {(all: readonly _Item[]) => (item: _Item) => Result<Printed<readonly string[]>, readonly unknown[]>}
 */
const itemLines = all => ({ node, name, ident }) => {
    const [, length, slots, body] = /** @type {readonly any[]} */ (node)
    if (holdsFunction(body)) { return error(['no static Rust for a function a body makes at call time', name]) }
    const text = tryFunctionText(/** @type {Exp} */ (node))
    if (text[0] === 'error') { return error(['no text for a built-in', name, text[1]]) }
    /** @type {(fn: readonly unknown[]) => Printed<string>} */
    const itemReference = fn => reference(all.filter(i => i.node === fn)[0].ident)
    /** @type {(i: number) => Result<Printed<string>, readonly unknown[]>} */
    const frame = i => okThen(
        /** @type {(resolved: _Resolved) => Result<Printed<string>, readonly unknown[]>} */
        (resolved) => resolved[0] === 'function' ? ok(itemReference(resolved[1])) : atomExpr(resolved[1]))(resolve(slots[i]))
    const code = `${ident}_code`
    // always a `&str`: the writer escapes a lone surrogate, as `textExpr`
    // in `fjs/edag/rust` relies on too
    const literal = unwrap(stringLiteral(text[1]))
    return mapOk((/** @type {Printed<readonly string[]>} */ [statements, uses]) => {
        const rest = readsRest(body) ? [restLine(length)] : []
        const lines = [
            tagged('comment')(`/// \`${name}\``),
            '#[rustfmt::skip]',
            `${kw('fn')} ${code}<A: ${bound}>(${readsArgs(body) ? 'args' : '_args'}: Array<A>) -> Result<Any<A>, Any<A>> {`,
            ...[...rest.map(([line]) => line), ...statements].map(line => `${indent}${line}`),
            '}',
            '',
            '#[rustfmt::skip]',
            `${kw('pub')} ${kw('fn')} ${ident}<A: ${bound}>() -> &'static RuntimeFunction<A> {`,
            `${indent}&RuntimeFunction { name: ${lit(stringText(name))}, code: ${code}::<A>, length: ${lit(`${length}`)}, text: ${lit(literal)} }`,
            '}',
        ]
        return /** @type {Printed<readonly string[]>} */ ([lines, [...uses, ...rest.flatMap(([, u]) => u)]])
    })(statementsWith(frame, () => ok(itemReference(node)))(body))
}

/**
 * A name as a Rust string literal: identifiers and dots, which the literal
 * spells as they are.
 *
 * @type {(name: string) => string}
 */
const stringText = name => `"${name}"`

/**
 * The two tables, tagged: `statics`, every static built-in by its name —
 * the sections' and, from [`fjs/js/static`](../../../js/static/module.f.js),
 * the natives `nanvm-lib` writes by hand, `Object.entries` — and
 * `members`, every member built-in by its receiver type and key, each row
 * an accessor; the arrays `nanvm-lib`'s lookups search.
 *
 * @type {(builtIns: readonly _BuiltIn[], all: readonly _Item[]) => Printed<readonly string[]>}
 */
const tables = (builtIns, all) => {
    /** @type {(b: _BuiltIn) => string} */
    const accessor = b => all.filter(i => i.node === b.node)[0].ident
    const statics = [
        ...builtIns.filter(b => b.member === null).map(b => `(${lit(stringText(b.name))}, ${accessor(b)})`),
        ...natives.map(path => `(${lit(stringText(path.join('.')))}, ${identifier(path.join('.'))})`),
    ]
    const members = builtIns.flatMap(b => b.member === null ? [] : [`(${lit(stringText(b.member[0]))}, ${lit(stringText(b.member[1]))}, ${accessor(b)})`])
    /** @type {(name: string, row: string, rows: readonly string[]) => readonly string[]} */
    const fn = (name, row, rows) => [
        '#[rustfmt::skip]',
        `${kw('pub')} ${kw('fn')} ${name}<A: ${bound}>() -> [(${row}, Accessor<A>); ${lit(`${rows.length}`)}] {`,
        ...(rows.length === 0 ? [`${indent}[]`] : [`${indent}[`, ...rows.map(r => `${indent}${indent}${r},`), `${indent}]`]),
        '}',
    ]
    return [
        [...fn('statics', "&'static str", statics), '', ...fn('members', "&'static str, &'static str", members)],
        natives.map(path => /** @type {Use} */ (['vm', identifier(path.join('.'))])),
    ]
}

/**
 * The static runtime of the module `root`, tagged, or the refusal: the
 * generated header, the `use` lines for every name the items spell, each
 * item, and the tables.
 *
 * @type {(root: Exp) => Result<string, readonly unknown[]>}
 */
export const generateRuntimeTagged = root => okThen((/** @type {readonly _BuiltIn[]} */ builtIns) => okThen((/** @type {readonly _Item[]} */ all) =>
    mapOk((/** @type {readonly Printed<readonly string[]>[]} */ printed) => {
        const [tableLines, tableUses] = tables(builtIns, all)
        const uses = [...printed.flatMap(([, u]) => u), ...tableUses, ...skeletonUses]
        return [
            tagged('comment')(generatedHeader('`npm run gen` from `fjs/js/runtime/module.f.js`', 'change the runtime and regenerate')),
            '',
            ...useLinesTagged({ vm: names(uses)('vm'), unstable: names(uses)('unstable') }, bound),
            '',
            ...printed.flatMap(([lines]) => [...lines, '']),
            ...tableLines,
            '',
        ].join('\n')
    })(okList(all.map(itemLines(all)))))(items(root, builtIns)))(table(root))

/** The names the skeleton of every item and table spells. @type {readonly Use[]} */
const skeletonUses = [['vm', 'Any'], ['vm', 'Array'], ['vm', 'RuntimeFunction'], ['vm', 'Accessor']]

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
