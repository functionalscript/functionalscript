/**
 * The static runtime: `fjs/js/runtime` printed as static Rust functions
 * ([`fjs/js/runtime/README.md`](../../../js/runtime/README.md), "How NaNVM
 * finds it").
 *
 * Where [`../module.f.mjs`](../module.f.mjs) prints a module as a scope
 * that *evaluates* — temporaries, and a closure with a frame for every
 * function — this printer reads the module at compile time and prints
 * items. Every module-level function is a static `fn` of its arguments
 * alone. A static built-in, `Object.is`, and a helper a body reads as a
 * value get an accessor answering a descriptor, a
 * `&'static RuntimeFunction<A>` holding the built-in's name, code and
 * length, since a read of one is a `Function`; a member built-in,
 * `startsWith`, is the `fn` alone, of the receiver, answering `undefined`
 * or the function of the arguments, since the language never reads a
 * member as a value and a call step asks the code in those two steps. A
 * frame slot is resolved here, to a function's accessor or an inlined
 * literal; and the `runtime` export object is read as the table of
 * built-ins, its `static` section naming each `Object.is`, its `member`
 * section `startsWith`, and printed nowhere. A built-in's identity is its
 * name, so a read of one costs nothing and holds nothing: no evaluation,
 * no holder, no `thread_local!`.
 *
 * What the runtime's module scope may hold is **functions and literals**,
 * and an import's read of its export object, `{ f }.f`, which the lowering
 * spells an import as and which folds to `f`. Anything else a body would
 * capture — an object, an array, an operation — is refused, naming the
 * node, as is a function a static's body makes at call time, which would
 * need the VM's `IStaticFunction` where a static is bound on `IVm` alone;
 * a member is bound on `IStaticFunction`, since its answer is the function
 * of the arguments, a closure over the receiver. Refused too is a module
 * exporting anything beside `runtime`, whose initializer the
 * lifting would drop, a function no built-in reaches, which a property
 * written twice leaves behind, a function two built-ins name, which
 * JavaScript keeps apart, a member read as a value, which has no
 * descriptor to read, and two items printing one Rust name
 * ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 * A literal written twice under one key is its last value, as the EDAG
 * means it.
 *
 * @module
 *
 * @import { Exp } from '../../../edag/types.ts'
 * @import { Printed, Use } from '../../../edag/rust/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _BuiltIn, _Item, _Resolved, _Table } from './private.ts'
 */

import { error, mapOk, ok, okList, okThen } from '../../../types/result/module.f.js'
import { argNamed, atomExpr, holdsFunction, readsArgs, readsBeyondFirst, readsRest, restLine, statementsWith, useLinesTagged } from '../../../edag/rust/module.f.mjs'
import { operandsOf, visit } from '../../../edag/sharing/module.f.mjs'
import { builtInIdentifier } from '../../../media/rust/module.f.mjs'
import { generatedHeader, indent } from '../../../media/rust/item/module.f.js'
import { tagged, untagged } from '../../../text/marked/module.f.mjs'
import { isNative, natives } from '../../../js/static/module.f.js'

const kw = tagged('keyword')
const lit = tagged('literal')

/**
 * The bound of an item: a static or a helper needs no capability of the
 * VM; a member makes the function of the arguments, a closure over its
 * receiver, which is the VM's `IStaticFunction`.
 *
 * @type {(kind: _Item['kind']) => string}
 */
const bound = kind => kind === 'member' ? 'IStaticFunction' : 'IVm'

/**
 * A module-level node resolved at compile time: a function, which becomes
 * an item; a literal, inlined where a body reads it; a helper, `entry` or
 * `hasEntry`, which the module scope holds for `dot` and which no printed
 * item may capture ({@link itemLines}); or the refusal of anything else,
 * since the runtime's module scope holds functions, literals and the two
 * helpers. An import is read off its export object by a literal key,
 * `{ f }.f`, and folds to the property's value, resolved in turn.
 *
 * @type {(node: Exp) => Result<_Resolved, readonly unknown[]>}
 */
const resolve = node => {
    if (!(node instanceof Array)) { return ok(/** @type {const} */ (['literal', node])) }
    const [id, a, key] = /** @type {readonly any[]} */ (node)
    if (id === '=>') { return ok(/** @type {const} */ (['function', node])) }
    if (id === 'undefined') { return ok(/** @type {const} */ (['literal', node])) }
    if (id === 'entry' || id === 'hasEntry') { return ok(/** @type {const} */ (['helper', node])) }
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
 * The built-ins an object of the table holds, each resolving to a function
 * node, named by `name` from its key, `member` for the `member` section's;
 * or the refusal of a value that is no object literal, as `refused` says,
 * or of an entry that is no function.
 *
 * @type {(name: (key: string) => string, member: boolean) => (functions: unknown, refused: readonly unknown[]) => Result<readonly _BuiltIn[], readonly unknown[]>}
 */
const builtIns = (name, member) => (functions, refused) => {
    const properties = literalProperties(functions)
    if (properties === null) { return error(refused) }
    return okList(properties.map(([, key, node]) => okThen(
        /** @type {(resolved: _Resolved) => Result<_BuiltIn, readonly unknown[]>} */
        (resolved) => resolved[0] === 'function'
            ? ok({ name: name(key), node: resolved[1], member })
            : error(['a built-in that is no function', name(key)]))(resolve(node))))
}

/**
 * The `static` section's built-ins: an object of namespaces, each an
 * object of functions, named `Object.is`.
 *
 * @type {(section: unknown) => Result<readonly _BuiltIn[], readonly unknown[]>}
 */
const statics = section => {
    const namespaces = literalProperties(section)
    if (namespaces === null) { return error(['a section of the runtime that is no object', section]) }
    return mapOk((/** @type {readonly (readonly _BuiltIn[])[]} */ lists) => lists.flatMap(list => list))(okList(namespaces.map(([, namespace, functions]) =>
        builtIns(key => `${namespace}.${key}`, false)(functions, ['a namespace of the runtime that is no object', namespace]))))
}

/**
 * Every built-in the module's `runtime` export names, the `static` section's
 * then the `member` section's — an object of functions by name, `startsWith`
 * — either section absent for none, and the `dot` section, the dispatcher,
 * which is not printed: NaNVM's call step is native until the printer
 * compiles the table `dot` reads, and `dot` captures that table, which no
 * item may hold (`fjs/js/todo/runtime-members.md`). Or the refusal of a
 * module without the export or with another beside it, whose initializer
 * the lifting would drop, of a section that is not objects of functions,
 * of a `dot` that is no function, or of a body under a path `nanvm-lib`
 * binds natively, `Object.entries`: the represented executors answer such
 * a path natively before they ask the runtime, so a body there would be
 * NaNVM's alone, and the two would answer apart.
 *
 * @type {(root: Exp) => Result<_Table, readonly unknown[]>}
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
    const dot = sections.find(p => p[1] === 'dot')?.[2]
    if (dot !== undefined && !(dot instanceof Array && dot[0] === '=>')) { return error(['a `dot` section that is no function', dot]) }
    return okThen((/** @type {readonly _BuiltIn[]} */ bodies) => {
        const native = bodies.find(b => isNative(b.name.split('.')))
        if (native !== undefined) { return error(['a body for a static every executor binds natively', native.name]) }
        return mapOk((/** @type {readonly _BuiltIn[]} */ members) => /** @type {_Table} */ ({ builtIns: [...bodies, ...members], dot }))(
            builtIns(key => key, true)(section('member'), ['a section of the runtime that is no object', section('member')]))
    })(statics(section('static')))
}

/**
 * The items of a module: every module-level function, the walk of one scope
 * stopping at each function's body, a static or a member named by the
 * table where a built-in resolves to it — a member's identifier its name,
 * `starts_with` — and a helper, `f` with its index among
 * them, otherwise, the module's own. Refused: a module-level node that is
 * no function, no object, no import's read, no `undefined` and not the
 * `entry` helper, which `dot` reads and no item may hold — an
 * operation the lifting would drop unevaluated; an import's read that
 * resolves to nothing an item may hold, wherever it stands, since one a
 * property written twice left behind would otherwise go unchecked; a
 * function no built-in reaches through its slots, which such a property
 * leaves behind too, since nothing would print it and the module would
 * mean something else; a function two built-ins name, since JavaScript
 * keeps `isNaN` and `Number.isNaN` apart however alike; and two items
 * printing one Rust name, {@link printedNames} — a static and a member of
 * one type and key, or a member whose key ends in `Code`, say. The `dot`
 * dispatcher is no item: the one function no built-in reaches by design,
 * so a built-in naming the very function `dot` is, or capturing it in a
 * slot, is refused.
 *
 * @type {(root: Exp, table: _Table) => Result<readonly _Item[], readonly unknown[]>}
 */
const items = (root, { builtIns, dot }) => {
    const nodes = visit(operandsOf)([])(root).map(([n]) => n).filter(n => n instanceof Array)
    const stray = nodes.find(n => !['=>', '{}', '.', 'undefined', 'entry', 'hasEntry'].includes(n[0]))
    if (stray !== undefined) { return refused(/** @type {Exp} */ (stray)) }
    return okThen(/** @type {() => Result<readonly _Item[], readonly unknown[]>} */ () => {
        const shared = builtIns.find(b => b.node === dot)
        if (shared !== undefined) { return error(['a built-in naming the `dot` dispatcher; the dispatcher is no built-in', shared.name]) }
        const functions = nodes.filter(n => n[0] === '=>' && n !== dot)
        const reached = reach(builtIns.map(b => b.node), [])
        if (dot !== undefined && reached.some(n => n === dot)) { return error(['a body capturing the `dot` dispatcher; no built-in reaches it', 'dot']) }
        const dropped = functions.find(n => !reached.includes(n))
        if (dropped !== undefined) { return error(['a function no built-in reaches; a property written twice keeps its last value', dropped]) }
        const twice = builtIns.find((b, i) => builtIns.findIndex(c => c.node === b.node) !== i)
        if (twice !== undefined) { return error(['a function two built-ins name; JavaScript keeps them apart', twice.name]) }
        const helpers = functions.filter(n => !builtIns.some(b => b.node === n))
        const all = functions.map(node => {
            const named = builtIns.find(b => b.node === node)
            if (named === undefined) { return item(node, `f${helpers.indexOf(node)}`, `f${helpers.indexOf(node)}`, 'helper') }
            return item(node, named.name, named.name, named.member ? 'member' : 'static')
        })
        const names = all.flatMap(i => printedNames(i).map(n => /** @type {const} */ ([n, i])))
        const clash = names.find(([n], index) => names.findIndex(([m]) => m === n) !== index)
        return clash === undefined ? ok(all) : error(['two items of one Rust name', `${clash[0]} of ${clash[1].name}`])
    })(okList(nodes.filter(n => n[0] === '.').map(n => resolve(/** @type {Exp} */ (n)))))
}

/** An item, its identifier `builtInIdentifier`'s of `spelled`. @type {(node: readonly unknown[], name: string, spelled: string, kind: _Item['kind']) => _Item} */
const item = (node, name, spelled, kind) => ({ node, name, ident: builtInIdentifier(spelled), kind })

/**
 * The Rust names an item prints, which no two items may share: a member
 * its code's alone, its identifier; a static or a helper its accessor's,
 * the identifier, and its code's, `_code` after it.
 *
 * @type {(item: _Item) => readonly string[]}
 */
const printedNames = ({ ident, kind }) => kind === 'member' ? [ident] : [ident, `${ident}_code`]

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
 * its `self` the item itself; and, for a static or a helper, the accessor
 * after it, {@link accessorLines}. A member is its code alone, a `fn` of
 * its receiver, named by its identifier and bound on `IStaticFunction`,
 * since a call step asks the code for the function of the arguments, a
 * closure over the receiver, and nothing reads a member as a value.
 * Refused: a member body reading past its receiver — the arguments as a
 * list, the rest, or a second fixed argument — which a function of the
 * receiver alone has no spelling for; a function a static's or a
 * helper's body makes at call time, since those are bound on `IVm` alone;
 * a member read as a value, which has no descriptor to read; a slot that
 * holds `entry` or `hasEntry`, which `dot` alone reads and the printer
 * leaves out with it, so no printed item has a spelling for them; and a
 * slot that resolves to nothing an item may hold. A slot that resolves to
 * a function names an item, since every module-level function is one.
 *
 * @type {(all: readonly _Item[]) => (item: _Item) => Result<Printed<readonly string[]>, readonly unknown[]>}
 */
const itemLines = all => ({ node, name, ident, kind }) => {
    const [, length, slots, body] = /** @type {readonly any[]} */ (node)
    if (kind !== 'member' && holdsFunction(body)) { return error(['no static Rust for a function a body makes at call time', name]) }
    if (kind === 'member' && readsBeyondFirst(body)) { return error(['a member body reading past its receiver; a member is a function of its receiver alone', name]) }
    /** @type {(fn: readonly unknown[]) => Result<Printed<string>, readonly unknown[]>} */
    const itemReference = fn => {
        const read = all.filter(i => i.node === fn)[0]
        return read.kind === 'member' ? error(['a member read as a value; a member is the code a call step calls', read.name]) : ok(reference(read.ident))
    }
    /** @type {(i: number) => Result<Printed<string>, readonly unknown[]>} */
    const frame = i => okThen(
        /** @type {(resolved: _Resolved) => Result<Printed<string>, readonly unknown[]>} */
        (resolved) => resolved[0] === 'function' ? itemReference(resolved[1])
            : resolved[0] === 'helper' ? error(['a body capturing a helper; `entry` and `hasEntry` are `dot`\'s to read', name])
            : atomExpr(resolved[1]))(resolve(slots[i]))
    return okThen((/** @type {Printed<readonly string[]>} */ [statements, uses]) => {
        const rest = readsRest(body) ? [restLine(length)] : []
        const code = [
            tagged('comment')(`/// \`${name}\``),
            '#[rustfmt::skip]',
            `${kw('fn')} ${kind === 'member' ? ident : `${ident}_code`}<A: ${bound(kind)}>(${parameter(kind, body)}) -> Result<Any<A>, Any<A>> {`,
            ...[...rest.map(([line]) => line), ...statements].map(line => `${indent}${line}`),
            '}',
        ]
        /** @type {readonly Use[]} */
        const codeUses = [...uses, ...rest.flatMap(([, u]) => u), ['vm', bound(kind)]]
        return ok(/** @type {Printed<readonly string[]>} */ (kind === 'member'
            ? [code, codeUses]
            : [[...code, '', ...accessorLines(name, ident, length, kind === 'static')], [...codeUses, ['vm', 'Array'], ['vm', 'RuntimeFunction']]]))
    })(statementsWith(frame, () => itemReference(node), kind === 'member' ? argNamed('self_') : undefined)(body))
}

/**
 * The parameter of an item's function: a member takes its receiver,
 * `self_: Any<A>`, the one argument a body of the receiver has, and a
 * static or a helper the arguments of the call, `args: Array<A>`; either
 * underscored where the body never reads it.
 *
 * @type {(kind: _Item['kind'], body: Exp) => string}
 */
const parameter = (kind, body) => kind === 'member'
    ? `${readsArgs(body) ? 'self_' : '_self'}: Any<A>`
    : `${readsArgs(body) ? 'args' : '_args'}: Array<A>`

/**
 * The accessor of an item a body may read as a value, a static or a
 * helper: `fn` answering the descriptor as a promoted constant, `pub` for
 * a static, since compiled code reads it. A built-in's text is formed
 * from its name where it is read, so the descriptor carries none.
 *
 * @type {(name: string, ident: string, length: number, exported: boolean) => readonly string[]}
 */
const accessorLines = (name, ident, length, exported) => [
    '#[rustfmt::skip]',
    `${exported ? `${kw('pub')} ` : ''}${kw('fn')} ${ident}<A: ${bound('static')}>() -> &'static RuntimeFunction<A> {`,
    `${indent}&RuntimeFunction { name: ${lit(stringText(name))}, code: ${ident}_code::<A>, length: ${lit(`${length}`)} }`,
    '}',
]

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
 * the natives `nanvm-lib` writes by hand, `Object.entries` — each row an
 * accessor, and `members`, every member built-in by its name, each row
 * the code itself, a `MemberCode` bound on `IStaticFunction` as the code
 * is; the arrays
 * `nanvm-lib`'s lookups search, and the crate's own, where the accessors
 * are every compiled module's.
 *
 * @type {(builtIns: readonly _BuiltIn[], all: readonly _Item[]) => Printed<readonly string[]>}
 */
const tables = (builtIns, all) => {
    /** @type {(b: _BuiltIn) => string} */
    const ident = b => all.filter(i => i.node === b.node)[0].ident
    const statics = [
        ...builtIns.filter(b => !b.member).map(b => `(${lit(stringText(b.name))}, ${ident(b)})`),
        ...natives.map(path => `(${lit(stringText(path.join('.')))}, ${builtInIdentifier(path.join('.'))})`),
    ]
    const members = builtIns.filter(b => b.member).map(b => `(${lit(stringText(b.name))}, ${ident(b)})`)
    /** @type {(name: string, kind: _Item['kind'], row: string, rows: readonly string[]) => readonly string[]} */
    const fn = (name, kind, row, rows) => [
        '#[rustfmt::skip]',
        `${kw('pub')}(${kw('crate')}) ${kw('fn')} ${name}<A: ${bound(kind)}>() -> [(${row}); ${lit(`${rows.length}`)}] {`,
        ...(rows.length === 0 ? [`${indent}[]`] : [`${indent}[`, ...rows.map(r => `${indent}${indent}${r},`), `${indent}]`]),
        '}',
    ]
    return [
        [...fn('statics', 'static', "&'static str, Accessor<A>", statics), '', ...fn('members', 'member', "&'static str, MemberCode<A>", members)],
        natives.map(path => /** @type {Use} */ (['vm', builtInIdentifier(path.join('.'))])),
    ]
}

/**
 * The static runtime of the module `root`, tagged, or the refusal: the
 * generated header, the `use` lines for every name the items spell, each
 * item, and the tables.
 *
 * @type {(root: Exp) => Result<string, readonly unknown[]>}
 */
export const generateRuntimeTagged = root => okThen((/** @type {_Table} */ sections) => okThen((/** @type {readonly _Item[]} */ all) =>
    mapOk((/** @type {readonly Printed<readonly string[]>[]} */ printed) => {
        const [tableLines, tableUses] = tables(sections.builtIns, all)
        const uses = [...printed.flatMap(([, u]) => u), ...tableUses, ...skeletonUses]
        return [
            tagged('comment')(generatedHeader('`npm run gen` from `fjs/js/runtime/module.f.js`', 'change the runtime and regenerate')),
            '',
            ...useLinesTagged({ vm: names(uses)('vm'), unstable: names(uses)('unstable') }, bound('static')),
            '',
            ...printed.flatMap(([lines]) => [...lines, '']),
            ...tableLines,
            '',
        ].join('\n')
    })(okList(all.map(itemLines(all)))))(items(root, sections)))(table(root))

/** The names the two tables spell: their rows' types and the members' bound. @type {readonly Use[]} */
const skeletonUses = [['vm', 'Accessor'], ['vm', 'MemberCode'], ['vm', bound('member')]]

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
