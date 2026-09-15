/**
 * AST types and helpers for the DJS representation.
 *
 * @module
 *
 * @import { Array, Unknown } from '../../media/datajs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstAccess, AstArray, AstConst, AstBody, AstMember, AstModule, AstModuleRef, AstObject, Import, Sharing, Anchors } from './types.ts'
 * @import { _Node, _Reach, _Ref, _Routes, _RunState, _View } from './private.ts'
 */

import { concat, empty, flat, fold, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.mjs'
import { cmp as stringCmp } from '../../types/string/module.f.mjs'
import { at as routesAt, empty as noRoutes, setReplace } from '../../types/ordered_map/module.f.mjs'

const { hasOwn } = Object

const { isInteger } = Number

/**
 * The own property `key` of `base`, or `undefined` where there is none —
 * never the prototype chain: a member of an object, an element or the
 * `length` of an array, a code unit or the `length` of a string; a number, a
 * boolean and a bigint have none, and neither have `null` and `undefined`,
 * which `Object` boxes to an empty object. `key` is read as JavaScript
 * reads one, so `0` and `"0"` name the same element.
 *
 * @type {(base: Unknown, key: string | number) => Unknown}
 */
const own = (base, key) => {
    /** @type {{ readonly [k in string]?: Unknown }} */
    const object = Object(base)
    return hasOwn(object, key) ? object[key] : undefined
}

/**
 * A property access on a value: the own property, as {@link own} reads it,
 * of a base that has properties — a `null` or `undefined` base is the
 * failure JavaScript throws for, and the one failure a data module can
 * make.
 *
 * @type {(key: string | number) => (base: Unknown) => Result<Unknown, string>}
 */
const ownProperty = key => base => base === null || base === undefined
    ? error(`cannot read property "${key}" of ${base}`)
    : ok(own(base, key))

/** @type {<T>(list: List<T>) => (value: T) => List<T>} */
const appended = list => value => ({ head: list, tail: [value] })

/**
 * The list so far with one more result's value, or the first failure.
 *
 * @template T
 * @param {Result<T, string>} item
 * @returns {(acc: Result<List<T>, string>) => Result<List<T>, string>}
 */
const collect = item => okThen(
    /** @type {(list: List<T>) => Result<List<T>, string>} */
    (list => mapOk(appended(list))(item))
)

/** @type {Result<List<Unknown>, string>} */
const noValues = ok(empty)

/** @type {Result<List<readonly [string, Unknown]>, string>} */
const noMembers = ok(empty)

/** @type {(key: string) => (value: Unknown) => readonly [string, Unknown]} */
const keyed = key => value => [key, value]

/** @type {(items: List<Unknown>) => Unknown} */
const arrayOf = items => toArray(items)

/** @type {(members: List<readonly [string, Unknown]>) => Unknown} */
const objectOf = members => fromEntries(members)

/** A member with its value evaluated, by the evaluator given first. @type {(evaluate: (ast: AstConst) => Result<Unknown, string>) => (member: AstMember) => Result<readonly [string, Unknown], string>} */
const memberValue = evaluate => ([key, value]) => mapOk(keyed(key))(evaluate(value))

/** @type {(state: _RunState) => (djs: Unknown) => _RunState} */
const evaluated = state => djs => ({ ...state, consts: concat(state.consts)([djs]) })

/** @type {(ast: AstConst) => (state: _RunState) => Result<_RunState, string>} */
const foldOp = ast => state => mapOk(evaluated(state))(toDjs(state)(ast))

/** @type {(acc: Result<_RunState, string>, ast: AstConst) => Result<_RunState, string>} */
const entryStep = (acc, ast) => okThen(foldOp(ast))(acc)

/**
 * The value of one entry, or the failure. An object's members are written
 * into a plain object in the order the syntax holds them, so the result is
 * the object JavaScript builds from the same literal: a repeated key keeps
 * its first position and takes its last value, and integer-like keys come
 * first. A property access reads its base's own property.
 *
 * @type {(state: _RunState) => (ast: AstConst) => Result<Unknown, string>}
 */
const toDjs = state => ast => {
    if (ast === null || typeof ast !== 'object') { return ok(ast) }
    switch (ast[0]) {
        case 'aref': { return ok(state.args[ast[1]]) }
        case 'cref': { return ok(last(null)(take(ast[1] + 1)(state.consts))) }
        case 'array': { return mapOk(arrayOf)(fold(collect)(noValues)(ast[1].map(toDjs(state)))) }
        case 'object': { return mapOk(objectOf)(fold(collect)(noMembers)(ast[1].map(memberValue(toDjs(state))))) }
        default: { return okThen(ownProperty(ast[2]))(toDjs(state)(ast[1])) }
    }
}

/**
 * Evaluates a module body against its imported modules and returns the
 * value of every entry, in order — the last is the value the module yields
 * — or the failure: a property read on `null` or `undefined`, which
 * JavaScript throws for and a data module has no way to catch.
 *
 * Entries are evaluated left to right, so a `cref` resolves to an already
 * evaluated entry. A reference is shared, not copied: two properties holding
 * the same `['cref', i]` deserialize to the same object, which is what lets a
 * DJS module denote a graph rather than a tree.
 *
 * @type {(body: AstBody) => (args: Array) => Result<readonly Unknown[], string>}
 */
export const values = body => args =>
    mapOk(consts)(body.reduce(entryStep, ok({ body, args, consts: null })))

/** @type {(state: _RunState) => readonly Unknown[]} */
const consts = state => toArray(state.consts)

/** @type {(all: readonly Unknown[]) => Unknown} */
const lastOf = all => all[all.length - 1]

/**
 * The value the module yields — the last entry of {@link values} — or the
 * failure.
 *
 * @type {(body: AstBody) => (args: Array) => Result<Unknown, string>}
 */
export const run = body => args => mapOk(lastOf)(values(body)(args))

// ── sharing ───────────────────────────────────────────────────────────────────

/** The bit of a body index, in a set of indices spelled as a bigint. @type {(i: number) => bigint} */
const bit = i => 1n << BigInt(i)

/**
 * The values an object's members leave in the value: one per key, the last
 * written. A member a later duplicate shadows is syntax the value never
 * holds, so a reference in it reaches nothing. `Map` keeps the last value
 * per key, as `fromEntries` does in `toDjs`.
 *
 * @type {(members: readonly AstMember[]) => readonly AstConst[]}
 */
const memberValues = members => [...new Map(members).values()]

/**
 * The values of an object's members as written, a shadowed member's among
 * them: what the EDAG constructor takes, since it applies every member and
 * evaluates each.
 *
 * @type {(members: readonly AstMember[]) => readonly AstConst[]}
 */
const memberValuesWritten = members => members.map(([, value]) => value)

/**
 * The references one entry makes directly: its `cref`s and `aref`s, however
 * deep inside its own literals, and nothing behind them — a referenced
 * `const` is an entry of its own, visited once as such, which is what keeps
 * this a walk over the syntax rather than over the value's paths. How the
 * syntax is read is the view's: which of an object's members count, and
 * what an access on a literal means — the value's view selects the item
 * the key names and drops the rest, the written view keeps the whole
 * literal, since the EDAG constructs it before the read.
 *
 * @type {(view: _View) => (ast: AstConst) => List<_Ref>}
 */
const refsOf = view => ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    switch (ast[0]) {
        case 'array': { return flat(ast[1].map(refsOf(view))) }
        case 'object': { return flat(view.members(ast[1]).map(refsOf(view))) }
        // an access reaches what its key names inside its base: the base's
        // reference, one key deeper — once the view has read the access
        case '.': {
            const read = view.through(ast)
            return read !== null && typeof read === 'object' && read[0] === '.'
                ? map(deeper(`${read[2]}`))(refsOf(view)(read[1]))
                : refsOf(view)(read)
        }
        default: { return [{ ref: ast, keys: [] }] }
    }
}

/** A reference one key deeper: the key as JavaScript reads it, so `0` and `"0"` are one. @type {(key: string) => (ref: _Ref) => _Ref} */
const deeper = key => ({ ref, keys }) => ({ ref, keys: [...keys, key] })

/** @type {(value: Unknown) => boolean} */
const isContainer = value => value !== null && typeof value === 'object'

/** @type {(reachable: bigint, ref: _Ref) => bigint} */
const reachStep = (reachable, { ref: [kind, i] }) => kind === 'cref' ? reachable | bit(i) : reachable

/**
 * One entry of the sweep from the export downwards: an entry a reference
 * reaches is reachable, and a reachable entry's own references count and
 * make their targets reachable. A `cref` names an earlier entry — the
 * parser refuses a `const` naming itself or a later one — so by the time
 * the sweep arrives at an entry every reference to it has been seen.
 *
 * @type {(refs: (ast: AstConst) => List<_Ref>) => (reach: _Reach, ast: AstConst, i: number) => _Reach}
 */
const reachEntry = refs => (reach, ast, i) => {
    if ((reach.reachable & bit(i)) === 0n) { return reach }
    const made = toArray(refs(ast))
    return { reachable: made.reduce(reachStep, reach.reachable), refs: concat(reach.refs)(made) }
}

/**
 * The sweep from the export downwards over a whole body: which entries it
 * reaches, and every reference those entries make, read as `view` says.
 *
 * @type {(view: _View) => (body: AstBody) => _Reach}
 */
const reach = view => body =>
    body.reduceRight(reachEntry(refsOf(view)), { reachable: bit(body.length - 1), refs: empty })

/** @type {(args: bigint, ref: _Ref) => bigint} */
const argStep = (args, { ref: [kind, i] }) => kind === 'aref' ? args | bit(i) : args

/** The indices a set of `n` leaves out. @type {(set: bigint) => (n: number) => readonly number[]} */
const missing = set => n => Array.from({ length: n }, (_, i) => i).filter(i => (set & bit(i)) === 0n)

/** Whether an entry is a bare reference: a `const` naming another entry or an import is that node, not a node of its own. @type {(ast: AstConst) => boolean} */
const isAlias = ast => ast !== null && typeof ast === 'object' && (ast[0] === 'cref' || ast[0] === 'aref')

/** The first import standing for the same node as import `k`, which `imports` says by identity. @type {(imports: readonly unknown[]) => (k: number) => AstModuleRef} */
const importNode = imports => k => ['aref', imports.indexOf(imports[k])]

/**
 * One entry's node as a reference: the entry itself, or through an alias
 * the node it names — an alias names an earlier entry, so its node is known
 * by the time the fold arrives at it.
 *
 * @type {(imports: readonly unknown[]) => (ast: AstConst, i: number, nodes: readonly AstModuleRef[]) => AstModuleRef}
 */
const nodeOf = imports => (ast, i, nodes) => {
    if (ast === null || typeof ast !== 'object') { return ['cref', i] }
    switch (ast[0]) {
        case 'cref': { return nodes[ast[1]] }
        case 'aref': { return importNode(imports)(ast[1]) }
        default: { return ['cref', i] }
    }
}

/** @type {(imports: readonly unknown[]) => (nodes: readonly AstModuleRef[], ast: AstConst, i: number) => readonly AstModuleRef[]} */
const nodeEntry = imports => (nodes, ast, i) => [...nodes, nodeOf(imports)(ast, i, nodes)]

/** A reference by the node it reaches, aliases and imports resolved. @type {(imports: readonly unknown[], nodes: readonly AstModuleRef[]) => (r: _Ref) => _Ref} */
const resolved = (imports, nodes) => ({ ref, keys }) => ({ ref: ref[0] === 'cref' ? nodes[ref[1]] : importNode(imports)(ref[1]), keys })

/**
 * What an EDAG of the module anchors, by index: exactly the code the graph
 * would not otherwise hold — the body entries no chain of references from
 * the export leads to, and the imports likewise, the sweep {@link sharing}
 * runs read for what it left out, less what those entries reach
 * themselves, which the graph holds through them. `run` evaluates every
 * entry and `transpile` reads every import whether the export reaches them
 * or not, so a compiler that follows references alone would drop what this
 * names, and anchors it instead.
 *
 * Counted by node, not by entry, since it is the graph that holds or lacks
 * a node: a `const` that is a bare reference is the node it names and is
 * no code of its own, and two imports are one node where `imports` holds
 * one value for both — as the linker binds two imports of one module — so
 * `const b = a; export default a;` anchors nothing, and `const c = [a]`
 * beside the alias anchors `c` alone.
 *
 * A member a later duplicate shadows counts here where it does not for
 * sharing: the value drops it, but an EDAG's object constructor applies
 * every member written and evaluates each, so what its reference names is
 * in the graph, not dropped.
 *
 * @type {(module: AstModule) => (imports: readonly unknown[]) => Anchors}
 */
export const anchors = ([specifiers, body]) => imports => {
    const nodes = body.reduce(nodeEntry(imports), [])
    const { reachable, refs } = reach(written)(body)
    const unreached = missing(reachable)(body.length).filter(i => !isAlias(body[i]))
    const within = map(resolved(imports, nodes))(flat(unreached.map(i => refsOf(written)(body[i]))))
    const reachedWithin = toArray(within).reduce(reachStep, 0n)
    const reachedImports = toArray(concat(map(resolved(imports, nodes))(refs))(within)).reduce(argStep, 0n)
    return {
        consts: unreached.filter(i => (reachedWithin & bit(i)) === 0n),
        imports: missing(reachedImports)(specifiers.length).filter(k => imports.indexOf(imports[k]) === k),
    }
}

/** Whether a list names something twice. @type {(xs: readonly string[]) => boolean} */
const repeats = xs => new Set(xs).size !== xs.length

/** @type {(m: Import) => readonly [string, Import]} */
const byId = m => [m.id, m]

/** The value a chain of keys reaches from a value, by own-property reads; `undefined` past the data. @type {(keys: readonly string[]) => (value: Unknown) => Unknown} */
const valueAt = keys => value => keys.reduce(own, value)

/** Whether a literal is a container literal — an array or an object written out — rather than a primitive or a reference. @type {(ast: AstConst) => ast is AstArray | AstObject} */
const isContainerLiteral = ast => ast !== null && typeof ast === 'object' && (ast[0] === 'array' || ast[0] === 'object')

/**
 * The position a key names in an array literal, or `undefined` when it
 * names none: only the canonical spelling of a non-negative integer is an
 * index — `'-1'`, `'01'`, `'1.5'`, `'1e3'` and `'length'` are properties an
 * array literal does not spell — and round-tripping the number back
 * through a string is what refuses every other spelling at once, as
 * `fjs/rtti/common` reads an index too.
 *
 * @type {(key: string) => number | undefined}
 */
const arrayIndex = key => {
    const n = Number(key)
    return isInteger(n) && n >= 0 && `${n}` === key ? n : undefined
}

/**
 * The literal one key into a container literal: an object's member of that
 * name, the last written, or an array's element at that index; `undefined`
 * where the literal has none — a member the object lacks, `length`, an
 * index past the end.
 *
 * @type {(ast: AstArray | AstObject, key: string) => AstConst}
 */
const literalAt = (ast, key) => ast[0] === 'object'
    ? ast[1].findLast(([name]) => name === key)?.[1]
    : ast[1][arrayIndex(key) ?? ast[1].length]

/**
 * What an access denotes once the keys that select inside a literal are
 * applied, for the value's view: the literal's item the key names, through
 * a chain of accesses — `[[x, x], 0][0]` is `[x, x]` — `undefined` where
 * the literal has none or the base is a primitive, and the access itself
 * on a reference, whose value the syntax does not hold.
 *
 * @type {(ast: AstAccess) => AstConst}
 */
const selected = ast => {
    const under = ast[1]
    const base = under !== null && typeof under === 'object' && under[0] === '.' ? selected(under) : under
    if (base === null || typeof base !== 'object') { return undefined }
    if (isContainerLiteral(base)) { return literalAt(base, `${ast[2]}`) }
    /** @type {AstAccess} */
    const access = ['.', base, ast[2]]
    return access
}

/** The syntax as the EDAG evaluates it: every member written, and a literal whole before it is read. @type {_View} */
const written = { members: memberValuesWritten, through: ast => ast }

/** The syntax as the value has it: the last member per key, and of a literal read only what the key selects. @type {_View} */
const value = { members: memberValues, through: selected }

/** A reference with keys beyond its own: the rest of a route that ran into it. @type {(keys: readonly string[]) => (ref: _Ref) => _Ref} */
const deeperBy = keys => ({ ref, keys: own }) => ({ ref, keys: [...own, ...keys] })

/**
 * The references an entry makes along one route: the route walked into
 * the entry's literals as far as they go, and every reference in what the
 * walk ends at — the literal the route selects, when the route is spent,
 * or the reference the route ran into, with the rest of the route as its
 * keys, since what those keys select lies behind that reference; a
 * primitive the route runs into holds no reference at all.
 *
 * @type {(ast: AstConst, route: readonly string[]) => List<_Ref>}
 */
const refsAlong = (ast, route) => route.length === 0 || !isContainerLiteral(ast)
    ? map(deeperBy(route))(refsOf(value)(ast))
    : refsAlong(literalAt(ast, route[0]), route.slice(1))

/** @type {(ast: AstConst) => (route: readonly string[]) => List<_Ref>} */
const refsAlongEntry = ast => route => refsAlong(ast, route)

/** One route as text, for telling routes apart: each key by its length, so no key runs into the next. @type {(route: readonly string[]) => string} */
const routeText = route => route.map(key => `${key.length}:${key}`).join('')

/**
 * The routes to walk of those by which an entry is reached: the whole
 * entry alone, when it is reached whole, since every other route lies
 * within it; and otherwise each route once.
 *
 * @type {(routes: List<readonly string[]>) => readonly (readonly string[])[]}
 */
const routesToWalk = routes => {
    const all = toArray(routes)
    return all.some(route => route.length === 0) ? [[]] : [...new Map(all.map(route => [routeText(route), route])).values()]
}

/** A reference to a `const` adds its keys to the routes by which that entry is reached. @type {(routes: _Routes['routes'], ref: _Ref) => _Routes['routes']} */
const routeStep = (routes, { ref: [kind, i], keys }) => kind === 'cref'
    ? setReplace(`${i}`)(concat(routesAt(`${i}`)(routes) ?? empty)([keys]))(routes)
    : routes

/**
 * One entry of the sweep the sharing decision runs, from the export
 * downwards: an entry no route reaches is not in the value; one that is
 * makes the references along its routes, each of which routes the entry it
 * names. A `cref` names an earlier entry, so by the time the sweep arrives
 * at an entry every route to it is known.
 *
 * @type {(state: _Routes, ast: AstConst, i: number) => _Routes}
 */
const routeEntry = (state, ast, i) => {
    const routes = routesAt(`${i}`)(state.routes)
    if (routes === null) { return state }
    const found = toArray(flat(routesToWalk(routes).map(refsAlongEntry(ast))))
    return { routes: found.reduce(routeStep, state.routes), refs: concat(state.refs)(found) }
}

/** The one route to an entry reached whole. @type {List<readonly string[]>} */
const whole = [[]]

/** The routes to the export: the whole of the last entry. @type {(body: AstBody) => _Routes} */
const exported = body => ({ routes: setReplace(`${body.length - 1}`)(whole)(noRoutes), refs: empty })

/** A module's group, apart from every `const`'s: a module's id may spell a number too. @type {(id: string) => string} */
const moduleGroup = id => `module ${id}`

/**
 * The node a reference reaches, when it is a container: the `const` by its
 * index or the module by its id, and the keys from there. A reference
 * reaching a leaf reaches nothing two references can share, and is left
 * out.
 *
 * @type {(imports: readonly Import[], consts: readonly Unknown[]) => (ref: _Ref) => readonly _Node[]}
 */
const containerNode = (imports, consts) => ({ ref: [kind, i], keys }) => {
    const [group, value] = kind === 'cref' ? [`const ${i}`, consts[i]] : [moduleGroup(imports[i].id), imports[i].value]
    return isContainer(valueAt(keys)(value)) ? [{ group, keys, aref: kind === 'aref' }] : []
}

/**
 * Nodes in one order: by group, then by keys, a prefix before what extends
 * it — so that two nodes one of which lies inside the other are adjacent
 * once sorted, and one pass over neighbours finds them all.
 *
 * @type {(a: _Node, b: _Node) => number}
 */
const byNode = (a, b) => {
    const group = stringCmp(a.group)(b.group)
    if (group !== 0) { return group }
    const n = Math.min(a.keys.length, b.keys.length)
    const i = a.keys.slice(0, n).findIndex(differsFrom(b.keys))
    return i === -1 ? a.keys.length - b.keys.length : stringCmp(a.keys[i])(b.keys[i])
}

/** Whether a key differs from the one at the same position in `keys`. @type {(keys: readonly string[]) => (key: string, i: number) => boolean} */
const differsFrom = keys => (key, i) => key !== keys[i]

/**
 * Whether the node at `i` is one an earlier reference reaches too: the same
 * node, or a node inside it — the previous one in the order, since a
 * prefix sorts right before what extends it.
 *
 * @type {(sorted: readonly _Node[]) => (node: _Node, i: number) => boolean}
 */
const withinPrevious = sorted => (node, i) => {
    if (i === 0) { return false }
    const previous = sorted[i - 1]
    return previous.group === node.group && previous.keys.every((k, n) => k === node.keys[n])
}

/**
 * What a module's syntax says about the graph its value denotes — decided
 * where sharing is spelled, a `const` or a module referenced twice, and
 * never by walking the value. A node two references reach is a container
 * `const` referenced twice from the parts of the module the export reaches,
 * a container module reached twice — along two import statements, or along
 * two import edges through other modules, which is what {@link Sharing}'s
 * `reaches` is for — or a reached module whose own value is shared. A leaf
 * referenced twice is two copies of a leaf, which is no sharing, and a
 * `const` the export never reaches is not part of the value at all.
 *
 * A property access is a reference to a node inside a `const` or a module,
 * by the keys it applies, and the values say whether that node is a leaf.
 * Two references reach one node when one's keys are the other's or a prefix
 * of them: `a` beside `a.x`, `a.x` twice, `a.x` beside `a.x.y`; `a.x`
 * beside `a.y` reach two nodes — one node under both would be a `const` or
 * a module referenced twice inside `a`, which the sweep counts there. And
 * an entry reached only through accesses is in the value only where they
 * select: the sweep walks each route into the entry's literals and counts
 * the references there, so what `a.other` holds is nothing to `a.selected`.
 *
 * Linear in the size of the module and in the modules it reaches, up to
 * the sort and the routes' map: each entry is read once, along each route
 * that reaches it, and a reference is counted rather than followed, so a
 * module that doubles a node at every `const` costs its length, not its
 * two-to-the-length; and a reached module lists each module it reaches
 * once, or is shared and lists none, so a diamond of modules is found at
 * its join and the lists stay sets.
 *
 * @type {(body: AstBody) => (imports: readonly Import[]) => (consts: readonly Unknown[]) => Sharing}
 */
export const sharing = body => imports => consts => {
    const nodes = toArray(body.reduceRight(routeEntry, exported(body)).refs).flatMap(containerNode(imports, consts))
    const sorted = nodes.toSorted(byNode)
    const reached = [...new Map(imports.map(byId)).values()].filter(m => nodes.some(n => n.aref && n.group === moduleGroup(m.id)))
    /** @type {readonly string[]} */
    const reaches = [...reached.map(m => m.id), ...reached.flatMap(m => m.reaches)]
    const shared = sorted.some(withinPrevious(sorted)) || repeats(reaches) || reached.some(m => m.shared)
    return { shared, reaches: shared ? [] : reaches }
}
