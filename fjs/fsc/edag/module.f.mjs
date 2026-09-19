/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstBody, AstConst, AstImport, AstMember, AstModule } from '../ast/types.ts'
 * @import { _Source } from '../transpiler/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Entry } from '../../types/object/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Binding, _Link, _Nodes } from './private.ts'
 */

import { anchors } from '../ast/module.f.mjs'
import { _attributeError, _importSources, _rootSource, _parseJson, _parseModule } from '../transpiler/module.f.mjs'
import { foldStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { at, setReplace } from '../../types/ordered_map/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'

const args = /** @type {const} */ (['args'])

/**
 * `undefined` is tagged in an EDAG, because a bare one is a missing tuple
 * position.
 *
 * A node per occurrence, as a body's `args` is, and for the same reason: a
 * node belongs to one scope. As a module-level constant this was one node
 * for every `undefined` in a module, so
 * `export default [undefined, (...a) => undefined];` — ordinary source the
 * parser accepts and the writer spells — linked to a graph with one node
 * inside a function and outside it, which is no EDAG, and the analysis
 * threw on it
 * ([`fjs/edag/todo/scope-and-identity-free-nodes.md`](../../edag/todo/scope-and-identity-free-nodes.md)
 * asks whether the rule should reach a node like this one at all).
 *
 * Two occurrences in one scope are still one entry: the analysis merges
 * identity-free nodes there, and this one has no operands to tell apart.
 *
 * @type {() => Exp}
 */
const undefinedNode = () => ['undefined']

/** Import `i` as the module's EDAG sees it: a property of the arguments. @type {(imported: AstImport, i: number) => Exp} */
const parameter = (_, i) => ['.', args, i]

/** @type {(lower: (ast: AstConst) => Exp) => (member: AstMember) => readonly [':', string, Exp]} */
const property = lower => ([key, value]) => [':', key, lower(value)]

/**
 * A call's EDAG, by what it calls.
 *
 * A callee that is a property access is a **method call**: `a.b(c)` passes
 * `a` as the receiver, so the access owns the call and the two are one node,
 * `['.', a, 'b', ['|()', args]]`.
 *
 * Writing `['()', ['.', a, 'b'], args]` instead would be the *detached*
 * receiver, `(0, a.b)(c)` — the plain call over a complete access produces
 * an ordinary value and loses the base, which
 * [`../../edag/README.md`](../../edag/README.md)'s Chains table spells and
 * `chainsJs.receiver` in [`../../edag/proof.f.mjs`](../../edag/proof.f.mjs)
 * pins against JavaScript itself. Parentheses alone do not detach:
 * `(a.b)(c)` keeps the receiver and is this same node, so grouping spells
 * this one and not the other, which waits on the comma operator.
 *
 * Any other callee is the plain call, `['()', callee, args]`.
 *
 * The arguments are one array node in both, which is what the EDAG's call
 * takes: `exp0(...exp1)`, its second operand spread. A fresh node per call
 * site, since each call writes its own list.
 *
 * @type {(nodes: _Nodes) => (callee: AstConst, args: readonly AstConst[]) => Exp}
 */
const call = nodes => (callee, args) => {
    /** @type {Exp} */
    const spread = ['[]', args.map(lower(nodes))]
    return callee !== null && typeof callee === 'object' && callee[0] === '.'
        ? ['.', lower(nodes)(callee[1]), callee[2], ['|()', spread]]
        : ['()', lower(nodes)(callee), spread]
}

/**
 * One entry's EDAG. A reference is the node it names — a `const` is one
 * node however many references reach it, which is how the sharing a module
 * spells survives into the graph — and an object's members are written as
 * they stand, a repeated key twice, since the constructor applies them in
 * order and the later wins.
 *
 * @type {(nodes: _Nodes) => (ast: AstConst) => Exp}
 */
const lower = nodes => ast => {
    if (ast === undefined) { return undefinedNode() }
    if (ast === null || typeof ast !== 'object') { return ast }
    switch (ast[0]) {
        case 'aref': { return nodes.parameters[ast[1]] }
        case 'cref': { return nodes.consts[ast[1]] }
        case 'array': { return ['[]', ast[1].map(lower(nodes))] }
        case 'object': { return ['{}', ast[1].map(property(lower(nodes)))] }
        // a function's body is a scope of its own: it names its arguments,
        // one node however many references reach them, and nothing outside
        case '=>': { return ['=>', null, scope(ast[1])] }
        case 'args': { return nodes.args }
        case '()': { return call(nodes)(ast[1], ast[2]) }
        // `op12` of one operand, the EDAG's unary minus, folded away over a
        // numeric literal: negating one is exact arithmetic — total, and
        // answered without knowing anything else about the program — so the
        // graph holds the number and every reader sees the leaf it saw
        // before there was an operator.
        //
        // A `-` over anything else stays a node. Folding one would mean
        // saying what a string or a container converts to, which is
        // `ToPrimitive`'s and depends on what the value holds; the readers
        // that want a number work it out where a number is wanted.
        case '-': {
            const operand = lower(nodes)(ast[1])
            return typeof operand === 'number' || typeof operand === 'bigint' ? -operand : ['-', operand]
        }
        // the EDAG's own form already, its key a constant the parser admitted
        default: { return ['.', lower(nodes)(ast[1]), ast[2]] }
    }
}

/**
 * One entry of a body, folded over the entries before it, under the
 * arguments node that body names: a fresh one per function, since a node
 * belongs to one scope and two bodies naming one `['args']` is no EDAG.
 *
 * @type {(parameters: readonly Exp[], args: Exp) => (consts: readonly Exp[], ast: AstConst) => readonly Exp[]}
 */
const entry = (parameters, args) => (consts, ast) => [...consts, lower({ parameters, consts, args })(ast)]

/**
 * A body as one node: its entries lowered in order, each `cref` taking the
 * node of the entry it names, and the last entry's node the value — with
 * what that value does not reach anchored by the comma, as a module's
 * unreached entries are.
 *
 * A module and a function body are the same shape and the same rule, and
 * `anchors` reads a body out of a module, so the body is handed over as one
 * that imports nothing: a function names no import, a reference out of it
 * being a capture the parser refused.
 *
 * @type {(body: AstBody) => Exp}
 */
const scope = body => {
    const nodes = body.reduce(entry([], ['args']), [])
    const value = nodes[nodes.length - 1]
    const { consts } = anchors([[], body])([])
    return consts.length === 0 ? value : [',', [...consts.map(i => nodes[i]), value]]
}

/**
 * The module as an EDAG over the nodes given for its imports. The body is
 * lowered entry by entry, each `cref` taking the node of the entry it
 * names, and the last entry's node is the export.
 *
 * What the export does not reach is anchored, not dropped: `transpile`
 * reads each import and `run` evaluates each entry whether the export needs
 * them or not, so a missing file or a bad module behind an unused import
 * fails the compile, and an EDAG that followed references alone would drop
 * it without a word. The comma operation is the anchor — `[',', [...roots,
 * exported]]`, every operand evaluated and the last one's value taken — its
 * operands the roots of the unreached part in source order, the imports
 * before the entries, each a node the graph would not otherwise hold — an
 * alias is the node it names, and two imports bound to one module are one
 * node, which `imports` says by identity;
 * nothing decides here whether an anchored part could fail, only whether it
 * is reached. A module the export reaches entirely is its export's node.
 *
 * @type {(imports: readonly Exp[]) => (module: AstModule) => Exp}
 */
const lowered = imports => module => {
    const nodes = module[1].reduce(entry(imports, args), [])
    const exported = nodes[nodes.length - 1]
    const { consts, imports: unbound } = anchors(module)(imports)
    return unbound.length === 0 && consts.length === 0
        ? exported
        : [',', [...unbound.map(i => imports[i]), ...consts.map(i => nodes[i]), exported]]
}

/** @type {(imports: readonly AstImport[]) => (edag: Exp) => Unresolved} */
const over = imports => edag => ({ imports, edag })

/**
 * The module as an EDAG over its imports, before any of them is read: each
 * import is its parameter node, and the specifiers ride beside the graph
 * for the resolution to read.
 *
 * @type {(module: AstModule) => Unresolved}
 */
export const unresolved = module => over(module[0])(lowered(module[0].map(parameter))(module))

// ── resolution ────────────────────────────────────────────────────────────────

/** @type {(member: Entry<JsonUnknown>) => readonly [':', string, Exp]} */
const jsonMember = ([key, value]) => [':', key, jsonEdag(value)]

/**
 * A JSON document's value as an EDAG: a tree with JSON's leaves, its
 * members in the order the reader built them. `transpile` reads a `.json`
 * import as a value, so the linker does too.
 *
 * @type {(value: JsonUnknown) => Exp}
 */
const jsonEdag = value => {
    if (value === null || typeof value !== 'object') { return value }
    return value instanceof Array
        ? ['[]', value.map(jsonEdag)]
        : ['{}', definedEntries(value).map(jsonMember)]
}

/** An EDAG boxed for the record of resolved modules, which cannot hold a bare `null`. @type {(edag: Exp) => readonly [Exp]} */
const boxed = edag => [edag]

/**
 * A module's EDAG recorded under its identity, and the chain of imports left as
 * it was before the module was entered.
 *
 * @type {(id: string) => (context: _Link) => (edag: Exp) => readonly [_Link, Exp]}
 */
const completed = id => context => edag => [{
    complete: setReplace(id)(boxed(edag))(context.complete),
    stack: drop(1)(context.stack),
}, edag]

/** @type {(id: string) => (context: _Link) => (value: JsonUnknown) => readonly [_Link, Exp]} */
const completedJson = id => context => value => completed(id)(context)(jsonEdag(value))

/** @type {(bound: readonly Exp[]) => (linked: readonly [_Link, Exp]) => _Binding} */
const appended = bound => ([context, edag]) => ({ context, bound: [...bound, edag] })

/** One import resolved and its EDAG appended to the module's bound imports. @type {(source: _Source) => (binding: _Binding) => Effect<ReadFile | ResolveFileModule, _Binding, ParseError>} */
const linkImport = source => ({ context, bound }) => mapStep(link(source)(context), appended(bound))

/**
 * A parsed module linked: its imports resolved in source order, each to its
 * own EDAG, and the module lowered over them — the binding happens where a
 * reference is lowered, so the graph is built once, with the imported
 * module's node where its parameter would be.
 *
 * @type {(source: _Source) => (context: _Link) => (module: AstModule) => Effect<ReadFile | ResolveFileModule, readonly [_Link, Exp], ParseError>}
 */
const linkModule = source => context => module => step(
    foldStep(_importSources(source)(module[0]), { context, bound: [] }, linkImport),
    ({ context: linked, bound }) => pureOk(completed(source.id)(linked)(lowered(bound)(module))))

/**
 * The source resolved to its EDAG within one link: a module identity met
 * again is the node it resolved to the first time, so a diamond of imports
 * joins at one node, and a module met again while it is still being entered
 * is a cycle. A JSON module is read as a document, as its import says with
 * `with { type: "json" }`; a `.json` file imported without it, or another
 * file imported with it, is refused as JavaScript refuses it.
 *
 * @type {(source: _Source) => (context: _Link) => Effect<ReadFile | ResolveFileModule, readonly [_Link, Exp], ParseError>}
 */
const link = source => context => {
    const { id, path, json } = source
    // the import's own contract, checked before the file's state: a file
    // met before is refused all the same when this import misspells it
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return pureError(mismatch) }
    if (includes(id)(context.stack)) { return pureError({ message: 'circular dependency', metadata: null, path }) }
    const done = at(id)(context.complete)
    if (done !== null) { return pureOk([context, done[0]]) }
    const entered = { ...context, stack: { first: id, tail: context.stack } }
    return json
        ? mapStep(_parseJson(path), completedJson(id)(entered))
        : step(_parseModule(path), linkModule(source)(entered))
}

/** @type {(linked: readonly [_Link, Exp]) => Exp} */
const edagOf = ([, edag]) => edag

/**
 * The program at `path` as one EDAG: the module read and parsed, each of
 * its imports resolved the same way, recursively, and every import bound in
 * its parameter's place — a JSON module, imported `with { type: "json" }`,
 * as the tree its document denotes, as `transpile` reads one. A `.json`
 * root is a document, as it is for `transpile`. The result carries no path
 * and no parameter: the `Unresolved` layer is the compiler's, and is gone
 * once the link is done.
 *
 * Fails as `transpile` fails, with the same `ParseError`: a parse error
 * where its token is, and a missing file or a circular dependency with no
 * position; and as `unresolved` refuses, on a module whose export does not
 * reach every import and every `const`.
 *
 * @type {(path: string) => Effect<ReadFile | ResolveFileModule, Exp, ParseError>}
 */
export const resolve = path => step(_rootSource(path), source => source.json
    // The CLI extension selects JSON input even when realpath follows an alias
    // to a differently named file. Import attributes still use the target path.
    ? mapStep(_parseJson(source.path), jsonEdag)
    : mapStep(link(source)({ complete: null, stack: null }), edagOf))
