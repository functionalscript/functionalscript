/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstBinary, AstBitnot, AstBody, AstConditional, AstConst, AstImport, AstMember, AstModule, AstNeg } from '../ast/types.ts'
 * @import { _Source } from '../transpiler/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Entry } from '../../types/object/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Binding, _Link, _LowerResults, _LowerWork, _Nodes, _Resolved } from './private.ts'
 */

import { anchors } from '../ast/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { _attributeError, _importSources, _rootSource, _parseJson, _parseModule } from '../transpiler/module.f.mjs'
import { foldStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { at, setReplace } from '../../types/ordered_map/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { definedEntries } from '../../types/object/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

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
const parameter = (_, i) => ['.', ['.', args, i], 'default']

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
 * A function's EDAG, `['=>', 0, frame, body]`, in the scope `nodes` names:
 * its count `0`, since a rest parameter or none counts nothing towards a
 * `length` (`spec/README.md`, Functions); its captures lowered here, each
 * to the node the enclosing scope has for it; and its body a scope of its
 * own over them.
 *
 * The frame holds each distinct node among them once, in the order the body
 * first names them — two bindings reaching one node, a `const` and its
 * alias, are one value and so one slot, and so are two nodes the EDAG
 * analysis merges, `o[0]` read by two `const`s ({@link slotKeys}) — and a
 * capture whose node is a
 * primitive is no slot at all: the primitive is written into the body where
 * the capture is read, as it is wherever a `const` holding one is read,
 * since it has nothing to share and nothing to compute. A function whose
 * frame is left with nothing has a `null` one.
 *
 * Inside the body a slot is one node, `['.', ['frame'], i]`, however many
 * references reach it, over one `['frame']` for the body — the node
 * `args` is, for the arguments.
 *
 * @type {(nodes: _Nodes) => (body: AstBody, captures: readonly AstConst[]) => Exp}
 */
const fn = nodes => (body, captures) => {
    const outer = captures.map(lower(nodes))
    const candidates = outer.filter(n => n instanceof Array)
    const keys = slotKeys(candidates)
    /** Each candidate's first twin: the candidate whose slot it reads. */
    const firsts = keys.map(k => keys.indexOf(k))
    const slots = candidates.filter((_, i) => firsts[i] === i)
    /** @type {Exp} */
    const frameNode = ['frame']
    /** @type {readonly Exp[]} */
    const reads = slots.map((_, i) => ['.', frameNode, i])
    /** @type {(n: typeof candidates[number]) => Exp} */
    const read = n => reads[slots.indexOf(candidates[firsts[candidates.indexOf(n)]])]
    const inner = outer.map(n => n instanceof Array ? read(n) : n)
    return ['=>', 0, slots.length === 0 ? null : ['[]', slots], scope(body, inner)]
}

/**
 * Which of `nodes` are one value: the entry the EDAG analysis gives each —
 * one entry for one node reached twice, and for two nodes it merges, a
 * read spelled the same over the same inputs — so that a frame holds no two
 * slots a writer or an executor would see as one. The analysis owns that
 * rule, so it is asked rather than restated; a lone node is its own.
 *
 * @type {(nodes: readonly Exp[]) => readonly unknown[]}
 */
const slotKeys = nodes => {
    if (nodes.length < 2) { return nodes }
    const { root, nodes: table } = analysis(['[]', /** @type {readonly Exp[]} */ (nodes)])
    const items = /** @type {readonly (readonly [string, number])[]} */ (table[/** @type {readonly [string, number]} */ (root)[1]][1])
    return items.map(([, i]) => i)
}

/**
 * One entry's EDAG, its own operator/negation/bitwise-not chain excepted —
 * every other node, lowered exactly as {@link lower} always did, recursing
 * back into {@link lower} itself for whatever it holds: a container, a
 * call, or a chain of accesses nests only as deep as the source that built
 * it, a separate, narrower concern than an operator chain's unbounded
 * length ({@link lower}'s own comment has why that one gets an explicit
 * stack instead).
 *
 * @type {(nodes: _Nodes) => (ast: Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional>) => Exp}
 */
const lowerLeaf = nodes => ast => {
    if (ast === undefined) { return undefinedNode() }
    if (ast === null || typeof ast !== 'object') { return ast }
    switch (ast[0]) {
        case 'aref': { return nodes.parameters[ast[1]] }
        case 'cref': { return nodes.consts[ast[1]] }
        case 'array': { return ['[]', ast[1].map(lower(nodes))] }
        case 'object': { return ['{}', ast[1].map(property(lower(nodes)))] }
        // a function's body is a scope of its own: it names its arguments,
        // one node however many references reach them, and nothing outside
        case '=>': { return fn(nodes)(ast[1], ast[2] ?? []) }
        case 'args': { return nodes.args }
        case 'fref': { return nodes.frame[ast[1]] }
        case '()': { return call(nodes)(ast[1], ast[2]) }
        // the EDAG's own form already, its key a constant the parser admitted
        default: { return ['.', lower(nodes)(ast[1]), ast[2]] }
    }
}

/**
 * One entry's EDAG. A reference is the node it names — a `const` is one
 * node however many references reach it, which is how the sharing a module
 * spells survives into the graph — and an object's members are written as
 * they stand, a repeated key twice, since the constructor applies them in
 * order and the later wins.
 *
 * An operator, a negation, a bitwise not or a conditional is walked with
 * an explicit stack rather than recursion: a source expression nests a
 * chain of these as deep as it is long, left-associative for every binary
 * operator and right-associative for `-`/`~`/`**`/`?:`, and
 * {@link evaluate} in `../parser/module.f.mjs` already resolves the same
 * shape this way, over its own `_Stack`, for the identical reason.
 *
 * `op12` of one operand, the EDAG's unary minus, folds away over a numeric
 * literal: negating one is exact arithmetic — total, and answered without
 * knowing anything else about the program — so the graph holds the number
 * and every reader sees the leaf it saw before there was an operator. A
 * `-` over anything else stays a node, and binary `-` never folds: folding
 * one would mean saying what a string or a container converts to, which is
 * `ToPrimitive`'s and depends on what the value holds — the readers that
 * want a number work it out where a number is wanted. Every other binary
 * operator and the bitwise not are the EDAG's own `op1`/`op2` shapes
 * already, both operands lowered and nothing folded — the lazy `&&`, `||`
 * and `??` the same `op2` as the eager ones, laziness being the EDAG's
 * positional rule and no shape of its own — and the conditional its
 * `op3`, `['?:', c, t, e]`, three operands lowered the same way.
 *
 * @type {(nodes: _Nodes) => (ast: AstConst) => Exp}
 */
const lower = nodes => root => {
    /** @type {_LowerWork} */
    let work = { kind: 'expand', ast: root, rest: null }
    /** @type {_LowerResults} */
    let results = null
    while (work !== null) {
        if (work.kind === 'expand') {
            /** @type {AstConst} */
            const ast = work.ast
            /** @type {_LowerWork} */
            const rest = work.rest
            if (ast === null || typeof ast !== 'object') {
                results = { top: lowerLeaf(nodes)(ast), rest: results }
                work = rest
                continue
            }
            switch (ast[0]) {
                case '-': {
                    if (ast.length !== 2) {
                        work = { kind: 'expand', ast: ast[1], rest: { kind: 'expand', ast: ast[2], rest: { kind: 'binary', tag: ast[0], rest } } }
                        break
                    }
                    work = { kind: 'expand', ast: ast[1], rest: { kind: 'neg', rest } }
                    break
                }
                case '~': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'bitnot', rest } }; break }
                case '*': case '/': case '%': case '**':
                case '+':
                case '===': case '!==': case '<': case '<=': case '>': case '>=':
                case '&': case '|': case '^': case '<<': case '>>': case '>>>':
                case '&&': case '||': case '??': {
                    work = { kind: 'expand', ast: ast[1], rest: { kind: 'expand', ast: ast[2], rest: { kind: 'binary', tag: ast[0], rest } } }
                    break
                }
                case '?:': {
                    work = { kind: 'expand', ast: ast[1], rest: { kind: 'expand', ast: ast[2], rest: { kind: 'expand', ast: ast[3], rest: { kind: 'ternary', rest } } } }
                    break
                }
                default: {
                    results = { top: lowerLeaf(nodes)(ast), rest: results }
                    work = rest
                }
            }
            continue
        }
        if (work.kind === 'neg') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a negation', root])
            /** @type {Exp} */
            const value = typeof operand.top === 'number' || typeof operand.top === 'bigint' ? -operand.top : ['-', operand.top]
            results = { top: value, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'bitnot') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a bitwise not', root])
            results = { top: ['~', operand.top], rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'ternary') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const otherwise = assertNotNullish(results, ['no else arm for a conditional', root])
            const then = assertNotNullish(otherwise.rest, ['no then arm for a conditional', root])
            const condition = assertNotNullish(then.rest, ['no condition for a conditional', root])
            results = { top: ['?:', condition.top, then.top, otherwise.top], rest: condition.rest }
            work = rest
            continue
        }
        /** @type {_LowerWork} */
        const rest = work.rest
        const tag = work.tag
        const right = assertNotNullish(results, ['no right operand for', tag, root])
        const left = assertNotNullish(right.rest, ['no left operand for', tag, root])
        results = { top: [tag, left.top, right.top], rest: left.rest }
        work = rest
    }
    return assertNotNullish(results, ['no result lowering', root]).top
}

/**
 * One entry of a body, folded over the entries before it, under the
 * arguments node that body names: a fresh one per function, since a node
 * belongs to one scope and two bodies naming one `['args']` is no EDAG.
 *
 * @type {(parameters: readonly Exp[], args: Exp, frame: readonly Exp[]) => (consts: readonly Exp[], ast: AstConst) => readonly Exp[]}
 */
const entry = (parameters, args, frame) => (consts, ast) => [...consts, lower({ parameters, consts, args, frame })(ast)]

/**
 * A body as one node: its entries lowered in order, each `cref` taking the
 * node of the entry it names, each `fref` the node `frame` has for its
 * slot, and the last entry's node the value — with what that value does
 * not reach anchored by the comma, as a module's unreached entries are.
 *
 * A module and a function body are the same shape and the same rule, and
 * `anchors` reads a body out of a module, so the body is handed over as one
 * that imports nothing: a function names no import, a reference out of it
 * being a capture, read through its frame.
 *
 * @type {(body: AstBody, frame: readonly Exp[]) => Exp}
 */
const scope = (body, frame) => {
    const nodes = body.reduce(entry([], ['args'], frame), [])
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
    const nodes = module[1].reduce(entry(imports, args, []), [])
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

/**
 * The statically known exports at a module boundary, past its evaluation
 * sequence. A malformed boundary is an internal compiler error.
 *
 * @type {(module: Exp) => readonly (readonly [':', string, Exp])[]}
 */
export const _moduleExports = module => {
    if (module instanceof Array) {
        if (module[0] === ',') { return _moduleExports(module[1][module[1].length - 1]) }
        if (module[0] === '{}' && module[1].every(p => p[0] === ':' && typeof p[1] === 'string')) {
            return /** @type {readonly (readonly [':', string, Exp])[]} */ (module[1])
        }
    }
    throw 'expected a module export object'
}

/**
 * Select a default value while evaluating the whole module. The default-only
 * shape keeps its normalized spelling; a named module keeps its complete
 * computation under the access, including unselected initializers. A missing
 * default projects to undefined here; import linking checks presence separately.
 *
 * @type {(module: Exp) => Exp}
 */
export const _defaultExport = module => {
    const members = _moduleExports(module)
    if (members.length !== 1 || members[0][1] !== 'default') { return ['.', module, 'default'] }
    if (module instanceof Array && module[0] === ',') {
        const operands = module[1]
        return [',', [...operands.slice(0, -1), _defaultExport(operands[operands.length - 1])]]
    }
    return members[0][2]
}

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

/**
 * A module's EDAG recorded under its identity, and the chain of imports left as
 * it was before the module was entered.
 *
 * @type {(id: string) => (context: _Link) => (edag: Exp) => readonly [_Link, _Resolved]}
 */
const completed = id => context => edag => {
    const resolved = { exports: edag, default: _moduleExports(edag).some(([, key]) => key === 'default') ? _defaultExport(edag) : undefined }
    return [{
        complete: setReplace(id)(resolved)(context.complete),
        stack: drop(1)(context.stack),
    }, resolved]
}

/** @type {(id: string) => (context: _Link) => (value: JsonUnknown) => readonly [_Link, _Resolved]} */
const completedJson = id => context => value => completed(id)(context)(['{}', [[':', 'default', jsonEdag(value)]]])

/** One import resolved, with a default export required even if its binding is unused. @type {(source: _Source) => (binding: _Binding) => Effect<ReadFile | ResolveFileModule, _Binding, ParseError>} */
const linkImport = source => ({ context, bound }) => step(link(source)(context), ([linked, resolved]) =>
    resolved.default === undefined
        ? pureError({ message: 'module has no default export', metadata: null, path: source.path })
        : pureOk({ context: linked, bound: [...bound, resolved.default] }))

/**
 * A parsed module linked: its imports resolved in source order, each to its
 * own EDAG, and the module lowered over them — the binding happens where a
 * reference is lowered, so the graph is built once, with the imported
 * module's node where its parameter would be.
 *
 * @type {(source: _Source) => (context: _Link) => (module: AstModule) => Effect<ReadFile | ResolveFileModule, readonly [_Link, _Resolved], ParseError>}
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
 * @type {(source: _Source) => (context: _Link) => Effect<ReadFile | ResolveFileModule, readonly [_Link, _Resolved], ParseError>}
 */
const link = source => context => {
    const { id, path, json } = source
    // the import's own contract, checked before the file's state: a file
    // met before is refused all the same when this import misspells it
    const mismatch = _attributeError(source)
    if (mismatch !== null) { return pureError(mismatch) }
    if (includes(id)(context.stack)) { return pureError({ message: 'circular dependency', metadata: null, path }) }
    const done = at(id)(context.complete)
    if (done !== null) { return pureOk([context, done]) }
    const entered = { ...context, stack: { first: id, tail: context.stack } }
    return json
        ? mapStep(_parseJson(path), completedJson(id)(entered))
        : step(_parseModule(path), linkModule(source)(entered))
}

/** @type {(linked: readonly [_Link, _Resolved]) => Exp} */
const edagOf = ([, resolved]) => resolved.exports

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
