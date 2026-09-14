/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstConst, AstImport, AstMember, AstModule } from '../ast/types.ts'
 * @import { _Source } from '../transpiler/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Entry } from '../../types/object/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Binding, _Link, _Nodes } from './private.ts'
 */

import { unreached } from '../ast/module.f.mjs'
import { _attributeError, _importPath, _parseJson, _parseModule } from '../transpiler/module.f.mjs'
import { error, mapOk, ok } from '../../types/result/module.f.mjs'
import { foldStep, mapStep, pure, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { at, setReplace } from '../../types/ordered_map/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'

const args = /** @type {const} */ (['args'])

/** `undefined` is tagged in an EDAG, because a bare one is a missing tuple position. */
const undefinedNode = /** @type {const} */ (['undefined'])

/** Import `i` as the module's EDAG sees it: a property of the arguments. @type {(imported: AstImport, i: number) => Exp} */
const parameter = (_, i) => ['.', args, i]

/** @type {(lower: (ast: AstConst) => Exp) => (member: AstMember) => readonly [':', string, Exp]} */
const property = lower => ([key, value]) => [':', key, lower(value)]

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
    if (ast === undefined) { return undefinedNode }
    if (ast === null || typeof ast !== 'object') { return ast }
    switch (ast[0]) {
        case 'aref': { return nodes.parameters[ast[1]] }
        case 'cref': { return nodes.consts[ast[1]] }
        case 'array': { return ['[]', ast[1].map(lower(nodes))] }
        case 'object': { return ['{}', ast[1].map(property(lower(nodes)))] }
        // the EDAG's own form already, its key a constant the parser admitted
        default: { return ['.', lower(nodes)(ast[1]), ast[2]] }
    }
}

/** @type {(parameters: readonly Exp[]) => (consts: readonly Exp[], ast: AstConst) => readonly Exp[]} */
const entry = parameters => (consts, ast) => [...consts, lower({ parameters, consts })(ast)]

/** A refusal with no position: the module parsed, and what it lacks has no token. @type {(message: string) => Result<never, ParseError>} */
const refuse = message => error({ message, metadata: null })

/**
 * The module as an EDAG over the nodes given for its imports, or the
 * refusal. The body is lowered entry by entry, each `cref` taking the node
 * of the entry it names, and the last entry's node is the export.
 *
 * Refused is a module whose export does not reach every import and every
 * `const`: `transpile` reads each import and `run` evaluates each entry
 * whether the export needs them or not, so a missing file or a bad module
 * behind an unused import fails the compile today, and an EDAG that follows
 * references alone would drop it without a word. The issue keeps that
 * behaviour by refusing the module until EDAG can anchor a computation
 * whose value nothing takes; nothing decides here whether the dropped
 * part could fail, only whether it is reached.
 *
 * @type {(imports: readonly Exp[]) => (module: AstModule) => Result<Exp, ParseError>}
 */
const lowered = imports => module => {
    const [specifiers, body] = module
    const { consts, imports: unbound } = unreached(module)
    if (unbound.length !== 0) { return refuse(`unreachable import "${specifiers[unbound[0]].specifier}"`) }
    if (consts.length !== 0) { return refuse(`unreachable const ${consts[0]}`) }
    const nodes = body.reduce(entry(imports), [])
    return ok(nodes[nodes.length - 1])
}

/** @type {(imports: readonly AstImport[]) => (edag: Exp) => Unresolved} */
const over = imports => edag => ({ imports, edag })

/**
 * The module as an EDAG over its imports, before any of them is read: each
 * import is its parameter node, and the specifiers ride beside the graph
 * for the resolution to read.
 *
 * @type {(module: AstModule) => Result<Unresolved, ParseError>}
 */
export const unresolved = module => mapOk(over(module[0]))(lowered(module[0].map(parameter))(module))

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
 * A module's EDAG recorded under its path, and the chain of imports left as
 * it was before the module was entered.
 *
 * @type {(path: string) => (context: _Link) => (edag: Exp) => readonly [_Link, Exp]}
 */
const completed = path => context => edag => [{
    complete: setReplace(path)(boxed(edag))(context.complete),
    stack: drop(1)(context.stack),
}, edag]

/** @type {(path: string) => (context: _Link) => (value: JsonUnknown) => readonly [_Link, Exp]} */
const completedJson = path => context => value => completed(path)(context)(jsonEdag(value))

/** @type {(bound: readonly Exp[]) => (linked: readonly [_Link, Exp]) => _Binding} */
const appended = bound => ([context, edag]) => ({ context, bound: [...bound, edag] })

/** One import resolved and its EDAG appended to the module's bound imports. @type {(source: _Source) => (binding: _Binding) => Effect<ReadFile, _Binding, ParseError>} */
const linkImport = source => ({ context, bound }) => mapStep(link(source)(context), appended(bound))

/** An import as a file to read: its specifier resolved against the importer's path, and what it is. @type {(path: string) => (imported: AstImport) => _Source} */
const sourceOf = path => ({ specifier, json }) => ({ path: _importPath(path)(specifier), json })

/**
 * A parsed module linked: its imports resolved in source order, each to its
 * own EDAG, and the module lowered over them — the binding happens where a
 * reference is lowered, so the graph is built once, with the imported
 * module's node where its parameter would be.
 *
 * @type {(path: string) => (context: _Link) => (module: AstModule) => Effect<ReadFile, readonly [_Link, Exp], ParseError>}
 */
const linkModule = path => context => module => step(
    foldStep(pureOk(module[0].map(sourceOf(path))), { context, bound: [] }, linkImport),
    ({ context: linked, bound }) => pure(mapOk(completed(path)(linked))(inModule(path)(lowered(bound)(module)))))

/** A refusal of a module named for the module, which the refusal alone does not know. @type {(path: string) => (result: Result<Exp, ParseError>) => Result<Exp, ParseError>} */
const inModule = path => result => result[0] === 'error' ? error({ ...result[1], path }) : result

/**
 * The file at `path` resolved to its EDAG within one link: a module met
 * again is the node it resolved to the first time, so a diamond of imports
 * joins at one node, and a module met again while it is still being entered
 * is a cycle. A JSON module is read as a document, as its import says with
 * `with { type: "json" }`; a `.json` file imported without it, or another
 * file imported with it, is refused as JavaScript refuses it.
 *
 * @type {(source: _Source) => (context: _Link) => Effect<ReadFile, readonly [_Link, Exp], ParseError>}
 */
const link = ({ path, json }) => context => {
    if (includes(path)(context.stack)) { return pureError({ message: 'circular dependency', metadata: null, path }) }
    const done = at(path)(context.complete)
    if (done !== null) { return pureOk([context, done[0]]) }
    const mismatch = _attributeError({ path, json })
    if (mismatch !== null) { return pureError(mismatch) }
    const entered = { ...context, stack: { first: path, tail: context.stack } }
    return json
        ? mapStep(_parseJson(path), completedJson(path)(entered))
        : step(_parseModule(path), linkModule(path)(entered))
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
 * @type {(path: string) => Effect<ReadFile, Exp, ParseError>}
 */
export const resolve = path => mapStep(link({ path, json: path.endsWith('.json') })({ complete: null, stack: null }), edagOf)
