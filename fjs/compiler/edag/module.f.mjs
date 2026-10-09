/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Exp, Index, Op12, Op2, Spread, StepOver } from '../../edag/types.ts'
 * @import { AstAccess, AstBinary, AstBitnot, AstNot, AstTypeof, AstInstanceOf, AstNumber, AstKey, AstBody, AstCall, AstConditional, AstConst, AstEntry, AstFunction, AstGuardedCall, AstImport, AstItem, AstModule, AstNeg, AstSpread, AstStep, AstThrow } from '../ast/types.ts'
 * @import { _ImportSource, _Source } from '../source/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { EdagValue } from '../../edag/value/types.ts'
 * @import { Unknown as JsonUnknown } from '../../media/json/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Binding, _Entries, _Link, _Lowered, _LoweredEntry, _LoweredItem, _LoweredOver, _LowerResults, _LowerWork, _Nodes, _Resolved } from './private.ts'
 */

import { anchors, isBinary, isInlinedCall, isLazy, isSpread, readCaptures } from '../ast/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { fromValue } from '../../edag/module.f.mjs'
import { _attributeError, _fileError, _importSources, _missingExport, _rootSource, _parseJson, _parseModule } from '../source/module.f.mjs'
import { foldStep, mapStep, pureError, pureOk, step } from '../../effects/module.f.mjs'
import { at, setReplace } from '../../types/ordered_map/module.f.mjs'
import { drop, includes } from '../../types/list/module.f.mjs'
import { assertNotNullish, todo } from '../../asserts/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

const args = /** @type {const} */ (['args'])

/**
 * `undefined` is tagged in an EDAG, because a bare one is a missing tuple
 * position.
 *
 * A node per occurrence, as a body's `rest` is, and for the same reason: a
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
const parameter = ({ name }, i) => name === null ? ['.', args, i] : ['.', ['.', args, i], name]

/** A value that floats nothing. @type {(exp: Exp) => _Lowered} */
const plain = exp => ({ exp, anchors: [] })

/** What several lowered values float, in their order. @type {(xs: readonly _LoweredOver<unknown>[]) => readonly Exp[]} */
const floated = xs => xs.flatMap(x => x.anchors)

/**
 * A value under what it floats: the value alone where nothing is floated,
 * and otherwise the comma establishing the floated roots first — the form
 * a scope's root takes, and a lazy operand's, the two positions that open a
 * block ({@link parts}).
 *
 * @type {(x: _Lowered) => Exp}
 */
const anchoring = ({ exp, anchors }) => anchors.length === 0 ? exp : [',', [...anchors, exp]]

/**
 * A call's EDAG, by what it calls.
 *
 * A call `isInlinedCall` admits — no arguments, a parameterless function
 * written at the call, reading no rest array — is its body where the call
 * stands: the body is lowered as a scope of its own over the enclosing
 * scope's nodes for its captures, in place of a frame, so a slot read is
 * the enclosing node itself and the sharing the body spells is the
 * enclosing scope's. What the body anchors, the `const`s its value does
 * not reach, floats out of the call to the nearest block root
 * ({@link parts}); nothing else changes, and nothing observes the function
 * that was written — `isInlinedCall` has the argument. `(() => [1, 2])()`
 * is the array, and the module holding it hashes as the module holding the
 * array does.
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
 * The arguments are an item list in both, the list `[]` would hold, which
 * is no node of its own: `f(a, b)` is `['()', f, [a, b]]`.
 *
 * @type {(nodes: _Nodes) => (ast: AstCall) => _Lowered}
 */
const call = nodes => ast => {
    const [, callee, args] = ast
    if (isInlinedCall(ast)) {
        const [, , body, captures] = /** @type {AstFunction} */ (callee)
        return parts(body, (captures ?? []).map(c => lower(nodes)(c).exp))
    }
    const items = args.map(lowerItem(nodes))
    const list = items.map(x => x.exp)
    if (callee !== null && typeof callee === 'object' && callee[0] === '.' && callee.length === 3) {
        const base = lower(nodes)(callee[1])
        const key = lowerKey(nodes)(callee[2])
        return { exp: ['.', base.exp, key.exp, ['|()', list]], anchors: [...base.anchors, ...key.anchors, ...floated(items)] }
    }
    const f = lower(nodes)(callee)
    return { exp: ['()', f.exp, list], anchors: [...f.anchors, ...floated(items)] }
}

/**
 * A spread's EDAG: the EDAG's spread, `['...', exp]`, over its operand's —
 * what the operand floats floating with it.
 *
 * @type {(nodes: _Nodes) => (spread: AstSpread) => _LoweredOver<Spread>}
 */
const lowerSpread = nodes => ([, operand]) => {
    const { exp, anchors } = lower(nodes)(operand)
    return { exp: ['...', exp], anchors }
}

/** An item's EDAG: a value's, or a spread's, {@link lowerSpread}. @type {(nodes: _Nodes) => (item: AstItem) => _LoweredItem} */
const lowerItem = nodes => item => isSpread(item) ? lowerSpread(nodes)(item) : lower(nodes)(item)

/**
 * A lazy item's EDAG, an argument inside a chain's region: what its
 * lowering floats is anchored where the item stands, by the comma
 * {@link anchoring} puts under it, as a lazy operand's is — the step runs
 * only where the chain's guard lets it, so nothing of the item's may be
 * established before the guard.
 *
 * @type {(nodes: _Nodes) => (item: AstItem) => Exp | Spread}
 */
const lazyItem = nodes => item => {
    const { exp, anchors } = lowerItem(nodes)(item)
    return exp instanceof Array && exp[0] === '...' ? ['...', anchoring({ exp: exp[1], anchors })] : anchoring({ exp, anchors })
}

/**
 * A key's EDAG, {@link AstKey}: a constant as it is, and the conversion
 * the EDAG's own `['Number', exp]` over its operand's — what the operand
 * floats floating with it, as an eager operand's does: the key of a plain
 * access is evaluated wherever the access is, and what it floats may be
 * established ahead of the base, an order failure equivalence leaves free
 * ([spec](../../../spec/README.md#failure-is-one-outcome)).
 *
 * @type {(nodes: _Nodes) => (key: AstKey) => _LoweredOver<Index>}
 */
const lowerKey = nodes => key => {
    if (!(key instanceof Array)) { return { exp: key, anchors: [] } }
    const { exp, anchors } = lower(nodes)(key[1])
    return { exp: ['Number', exp], anchors }
}

/**
 * A key inside a chain's region, established only where the guard lets
 * the chain go on, as a step's argument is, {@link lazyItem}: what its
 * operand floats anchored under the conversion — the EDAG's index takes
 * the conversion and no other node, so the comma stands in its operand.
 *
 * @type {(nodes: _Nodes) => (key: AstKey) => Index}
 */
const lazyKey = nodes => key => {
    if (!(key instanceof Array)) { return key }
    return ['Number', anchoring(lower(nodes)(key[1]))]
}

/**
 * An access's EDAG, plain or guarded: its base eager, and its key and
 * steps as {@link lowerKey}, {@link lazyKey} and {@link lowerStep} say —
 * the key of a plain access eager, a guarded access's inside the region
 * its guard opens.
 *
 * @type {(nodes: _Nodes) => (ast: AstAccess | Extract<AstConst, readonly ['?.', ...unknown[]]>) => _Lowered}
 */
const access = nodes => ast => {
    const base = lower(nodes)(ast[1])
    const step = lowerStep(nodes)(ast[3])
    if (ast[0] === '?.') { return { exp: stepped(['?.', base.exp, lazyKey(nodes)(ast[2])], step), anchors: base.anchors } }
    const key = lowerKey(nodes)(ast[2])
    return { exp: stepped(['.', base.exp, key.exp], step), anchors: [...base.anchors, ...key.anchors] }
}

/**
 * A chain's steps lowered, the AST's shape being the EDAG's: each key a
 * lazy one, {@link lazyKey}, and each call step's arguments lazy,
 * {@link lazyItem}.
 *
 * @type {(nodes: _Nodes) => (step: AstStep | undefined) => StepOver<Exp, Index> | undefined}
 */
const lowerStep = nodes => step => {
    if (step === undefined) { return undefined }
    const next = lowerStep(nodes)(step[2])
    if (step[0] === '|.') {
        const key = lazyKey(nodes)(step[1])
        return next === undefined ? ['|.', key] : ['|.', key, next]
    }
    const items = step[1].map(lazyItem(nodes))
    return /** @type {StepOver<Exp, Index>} */ (next === undefined ? [step[0], items] : [step[0], items, next])
}

/**
 * A chain node over its steps, where it has any: the AST's shape is the
 * EDAG's, and which lambda the steps are is the parser's by construction,
 * which the proofs validate.
 *
 * @type {(node: readonly unknown[], step: StepOver<Exp, Index> | undefined) => Exp}
 */
const stepped = (node, step) => /** @type {Exp} */ (step === undefined ? node : [...node, step])

/**
 * A guarded call's EDAG: its callee eager, its arguments and its steps
 * lazy, inside the region the guard opens, {@link lazyItem} and
 * {@link lowerStep}.
 *
 * @type {(nodes: _Nodes) => (ast: AstGuardedCall) => _Lowered}
 */
const guardedCall = nodes => ast => {
    const f = lower(nodes)(ast[1])
    return { exp: stepped(['?.()', f.exp, ast[2].map(lazyItem(nodes))], lowerStep(nodes)(ast[3])), anchors: f.anchors }
}

/**
 * An entry's EDAG: a member's, the EDAG's property over its value's, or
 * a spread's, {@link lowerSpread}.
 *
 * @type {(nodes: _Nodes) => (entry: AstEntry) => _LoweredEntry}
 */
const lowerEntry = nodes => entry => {
    if (isSpread(entry)) { return lowerSpread(nodes)(entry) }
    const { exp, anchors } = lower(nodes)(entry[2])
    return { exp: [':', entry[1], exp], anchors }
}

/**
 * A function's EDAG, `['=>', length, slots, body]`, in the scope `nodes` names: its
 * captures lowered here, each to the node the enclosing scope has for it,
 * and its body a scope of its own over them.
 *
 * The frame holds each distinct node among them once, in the order the body
 * first names them — two bindings reaching one node, a `const` and its
 * alias, are one value and so one slot, and so are two nodes the EDAG
 * analysis merges, `o[0]` read by two `const`s ({@link slotKeys}) — and a
 * capture whose node is a
 * primitive is no slot at all: the primitive is written into the body where
 * the capture is read, as it is wherever a `const` holding one is read,
 * since it has nothing to share and nothing to compute. Nor is a capture
 * the body never reads, `readCaptures`: one the parser listed for an
 * unused alias, `const x = c;`, which the body drops — whether written in
 * the body or in a call inlined into it — so that no slot is left that
 * nothing reads, and the enclosing scope anchors the `const` instead. A
 * function whose frame is left with nothing has no slots.
 *
 * Inside the body a slot is one node, `['frame', i]`, however many
 * references reach it — the node `rest` is, for the rest arguments.
 *
 * @type {(nodes: _Nodes) => (length: number, body: AstBody, captures: readonly AstConst[]) => Exp}
 */
const fn = nodes => (length, body, captures) => {
    const read = readCaptures(['=>', length, body, captures])
    const outer = captures.map(c => lower(nodes)(c).exp)
    const candidates = outer.filter((n, i) => n instanceof Array && read.includes(i))
    const keys = slotKeys(candidates)
    /** Each candidate's first twin: the candidate whose slot it reads. */
    const firsts = keys.map(k => keys.indexOf(k))
    const slots = candidates.filter((_, i) => firsts[i] === i)
    /** @type {readonly Exp[]} */
    const reads = slots.map((_, i) => ['frame', i])
    /** @type {(n: typeof candidates[number]) => Exp} */
    const slotRead = n => reads[slots.indexOf(candidates[firsts[candidates.indexOf(n)]])]
    const inner = outer.map(n => candidates.includes(n) ? slotRead(n) : n)
    return ['=>', length, slots, scope(body, inner)]
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
    const { root, nodes: table } = unwrap(analysis(['[]', /** @type {readonly Exp[]} */ (nodes)]))
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
 * @type {(nodes: _Nodes) => (ast: Exclude<AstConst, AstNeg | AstBitnot | AstNot | AstTypeof | AstInstanceOf | AstNumber | AstBinary | AstConditional | AstThrow>) => _Lowered}
 */
const lowerLeaf = nodes => ast => {
    if (ast === undefined) { return plain(undefinedNode()) }
    if (ast === null || typeof ast !== 'object') { return plain(ast) }
    switch (ast[0]) {
        case 'aref': { return plain(nodes.parameters[ast[1]]) }
        case 'cref': { return plain(nodes.consts[ast[1]]) }
        case 'array': {
            const items = ast[1].map(lowerItem(nodes))
            return { exp: ['[]', items.map(x => x.exp)], anchors: floated(items) }
        }
        case 'object': {
            const entries = ast[1].map(lowerEntry(nodes))
            return { exp: ['{}', entries.map(x => x.exp)], anchors: floated(entries) }
        }
        // a function's body is a scope of its own: it names its arguments,
        // one node however many references reach them, and nothing outside
        case '=>': { return plain(fn(nodes)(ast[1], ast[2], ast[3] ?? [])) }
        case 'arg': { return plain(['arg', ast[1]]) }
        case 'rest': { return plain(nodes.args) }
        case 'fref': { return plain(nodes.frame[ast[1]]) }
        // the function itself, the EDAG's own node, which a nested
        // function's capture of it lowers to as a slot of the parent's scope
        case 'self': { return plain(['self']) }
        // the `entry` helper, the EDAG's own node for it — a fresh one per
        // helper written, as every arrow is a node of its own
        case 'entry': { return plain(['entry']) }
        case '()': { return call(nodes)(ast) }
        case '?.()': { return guardedCall(nodes)(ast) }
        // an access, plain or guarded: the EDAG's own form already, its key
        // a constant or the conversion and its steps, where it has any, the
        // continuation the parser folded ({@link access}). Out of this
        // frame, as a guarded call is: it is one of the few a nested
        // container costs per level.
        default: { return access(nodes)(ast) }
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
 * `op3`, `['?:', c, t, e]`, three operands lowered the same way. The
 * `Number` conversion is the EDAG's own `['Number', v]`, an `op1` like
 * `~`, and folds no more than `~` does: what a value converts to is the
 * interpreter's question. A
 * `throw` is the EDAG's own `['throw', v]`, an `op1` over its value, the
 * node a body or a module that ends in the statement is.
 *
 * What an operand floats — the anchors of a call inlined inside it,
 * {@link call} — floats on through an eager position, and stops at a lazy
 * one: the right operand of `&&`, `||` or `??` and an arm of `?:` is a
 * block root, established only when the operator decides to, so what its
 * inlined body anchors is anchored there, by the comma {@link anchoring}
 * puts under the operand, and never before the operator.
 *
 * @type {(nodes: _Nodes) => (ast: AstConst) => _Lowered}
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
            if (isBinary(ast)) {
                work = { kind: 'expand', ast: ast[1], rest: { kind: 'expand', ast: ast[2], rest: { kind: 'binary', tag: ast[0], rest } } }
                continue
            }
            switch (ast[0]) {
                case '-': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'neg', rest } }; break }
                case '~': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'bitnot', rest } }; break }
                case '!': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'not', rest } }; break }
                case 'typeof': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'typeof', rest } }; break }
                case 'instanceof': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'instanceof', name: ast[2], rest } }; break }
                case 'Number': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'Number', rest } }; break }
                case 'throw': { work = { kind: 'expand', ast: ast[1], rest: { kind: 'throw', rest } }; break }
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
            const { exp, anchors } = operand.top
            /** @type {Exp} */
            const value = typeof exp === 'number' || typeof exp === 'bigint' ? -exp : ['-', exp]
            results = { top: { exp: value, anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'bitnot') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a bitwise not', root])
            results = { top: { exp: ['~', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'not') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a logical not', root])
            results = { top: { exp: ['!', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'typeof') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a typeof', root])
            results = { top: { exp: ['typeof', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'instanceof') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for an instanceof', root])
            // the constructor name is carried across as it is: the EDAG's
            // own node names it, and nothing folds
            results = { top: { exp: ['instanceof', operand.top.exp, work.name], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'Number') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no operand for a Number conversion', root])
            results = { top: { exp: ['Number', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'throw') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const operand = assertNotNullish(results, ['no value for a throw', root])
            results = { top: { exp: ['throw', operand.top.exp], anchors: operand.top.anchors }, rest: operand.rest }
            work = rest
            continue
        }
        if (work.kind === 'ternary') {
            /** @type {_LowerWork} */
            const rest = work.rest
            const otherwise = assertNotNullish(results, ['no else arm for a conditional', root])
            const then = assertNotNullish(otherwise.rest, ['no then arm for a conditional', root])
            const condition = assertNotNullish(then.rest, ['no condition for a conditional', root])
            results = { top: { exp: ['?:', condition.top.exp, anchoring(then.top), anchoring(otherwise.top)], anchors: condition.top.anchors }, rest: condition.rest }
            work = rest
            continue
        }
        /** @type {_LowerWork} */
        const rest = work.rest
        const tag = work.tag
        const right = assertNotNullish(results, ['no right operand for', tag, root])
        const left = assertNotNullish(right.rest, ['no left operand for', tag, root])
        // named as the two node kinds a binary tag makes, since the EDAG
        // union also holds a three-tuple whose last position is a name
        /** @type {Op2 | Op12} */
        const lazyExp = [tag, left.top.exp, anchoring(right.top)]
        /** @type {Op2 | Op12} */
        const eager = [tag, left.top.exp, right.top.exp]
        results = {
            top: isLazy(tag)
                ? { exp: lazyExp, anchors: left.top.anchors }
                : { exp: eager, anchors: [...left.top.anchors, ...right.top.anchors] },
            rest: left.rest,
        }
        work = rest
    }
    return assertNotNullish(results, ['no result lowering', root]).top
}

/**
 * The entries of a body, each lowered over the entries before it, under
 * the arguments node that body names: a fresh one per function, since a
 * node belongs to one scope and two bodies naming one `['args']` is no
 * EDAG. Beside each entry's node, what lowering it floated.
 *
 * @type {(parameters: readonly Exp[], args: Exp, frame: readonly Exp[]) => (body: AstBody) => _Entries}
 */
const entries = (parameters, args, frame) => body => body.reduce(
    /** @type {(acc: _Entries, ast: AstConst) => _Entries} */
    ((acc, ast) => {
        const { exp, anchors } = lower({ parameters, consts: acc.nodes, args, frame })(ast)
        return { nodes: [...acc.nodes, exp], floated: [...acc.floated, anchors] }
    }),
    { nodes: [], floated: [] })

/**
 * What a scope anchors before its value, in order: for each entry, what
 * its lowering floated — the anchors of the calls inlined in it, established
 * where the entry is — and then the entry itself where it is one `anchors`
 * names, an entry the value does not reach.
 *
 * @type {(e: _Entries, consts: readonly number[]) => readonly Exp[]}
 */
const anchored = ({ nodes, floated }, consts) => nodes.flatMap((node, i) => [...floated[i], ...(consts.includes(i) ? [node] : [])])

/**
 * A body as a value and what it anchors: its entries lowered in order, each
 * `cref` taking the node of the entry it names, each `fref` the node
 * `frame` has for its slot, the last entry's node the value, and what the
 * value does not reach the anchors, as a module's unreached entries are.
 *
 * A module and a function body are the same shape and the same rule, and
 * `anchors` reads a body out of a module, so the body is handed over as one
 * that imports nothing: a function names no import, a reference out of it
 * being a capture, read through its frame — or, for a body a call inlines,
 * the enclosing scope's node itself.
 *
 * @type {(body: AstBody, frame: readonly Exp[]) => _Lowered}
 */
const parts = (body, frame) => {
    const e = entries([], ['rest'], frame)(body)
    const { consts } = anchors([[], body])([])
    return { exp: e.nodes[e.nodes.length - 1], anchors: anchored(e, consts) }
}

/** A body as one node: its value under its anchors, {@link parts}. @type {(body: AstBody, frame: readonly Exp[]) => Exp} */
const scope = (body, frame) => anchoring(parts(body, frame))

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
    const e = entries(imports, args, [])(module[1])
    const { consts, imports: unbound } = anchors(module)(imports)
    return anchoring({ exp: e.nodes[e.nodes.length - 1], anchors: [...unbound.map(i => imports[i]), ...anchored(e, consts)] })
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
 * Whether a module's computation ends in a `throw`, past its evaluation
 * sequence: a module whose body ends in the statement in place of its
 * exports ([spec: module structure](../../../spec/README.md#module-structure)).
 * Such a module fails at every load and exports nothing.
 *
 * @type {(module: Exp) => boolean}
 */
export const _moduleThrows = module => module instanceof Array
    && (module[0] === 'throw' || (module[0] === ',' && _moduleThrows(module[1][module[1].length - 1])))

/**
 * The statically known exports at a module boundary, past its evaluation
 * sequence: none for a module that throws, since nothing is exported by a
 * load that never completes. A malformed boundary is an internal compiler
 * error.
 *
 * @type {(module: Exp) => readonly (readonly [':', string, Exp])[]}
 */
export const _moduleExports = module => {
    if (module instanceof Array) {
        if (module[0] === ',') { return _moduleExports(module[1][module[1].length - 1]) }
        if (module[0] === 'throw') { return [] }
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
 * A module that throws is its own selection: selecting anything from it is
 * the same failure, and the throw is what the computation is.
 *
 * @type {(module: Exp) => Exp}
 */
export const _defaultExport = module => {
    if (_moduleThrows(module)) { return module }
    const members = _moduleExports(module)
    if (members.length !== 1 || members[0][1] !== 'default') { return ['.', module, 'default'] }
    if (module instanceof Array && module[0] === ',') {
        const operands = module[1]
        return [',', [...operands.slice(0, -1), _defaultExport(operands[operands.length - 1])]]
    }
    return members[0][2]
}

// ── resolution ────────────────────────────────────────────────────────────────

/** JSON has no function leaves, so the function hook is unreachable. */
const jsonLiteral = fromValue(todo)

/**
 * A JSON document's value as an EDAG: a tree with JSON's leaves, its
 * members in the order the reader built them. `transpile` reads a `.json`
 * import as a value, so the linker does too.
 *
 * `fromValue` allows arbitrary hook expressions. JSON never reaches its hook,
 * so only literal value nodes are constructed and the narrower cast holds.
 *
 * @type {(value: JsonUnknown) => EdagValue}
 */
export const jsonValue = value => /** @type {EdagValue} */ (jsonLiteral(value))

/**
 * A module's EDAG recorded under its identity, and the chain of imports left as
 * it was before the module was entered.
 *
 * @type {(id: string) => (context: _Link) => (edag: Exp) => readonly [_Link, _Resolved]}
 */
const completed = id => context => edag => {
    /** @type {_Resolved} */
    const resolved = {
        exports: edag,
        bindings: _moduleExports(edag).map(([, key]) => [key, key === 'default' ? _defaultExport(edag) : ['.', edag, key]]),
    }
    return [{
        complete: setReplace(id)(resolved)(context.complete),
        stack: drop(1)(context.stack),
    }, resolved]
}

/** @type {(id: string) => (context: _Link) => (value: JsonUnknown) => readonly [_Link, _Resolved]} */
const completedJson = id => context => value => completed(id)(context)(['{}', [[':', 'default', jsonValue(value)]]])

/** Require the selected export even if its binding is unused. @type {(source: _ImportSource) => (binding: _Binding) => Effect<ReadFile | ResolveFileModule, _Binding, ParseError>} */
const linkImport = source => ({ context, bound }) => step(link(source)(context), ([linked, resolved]) => {
    const selected = source.name === null ? resolved.exports : resolved.bindings.find(([key]) => key === source.name)?.[1]
    return selected === undefined
        ? pureError(_missingExport(source))
        : pureOk({ context: linked, bound: [...bound, selected] })
})

/**
 * A parsed module linked: its imports resolved in source order, each to its
 * own EDAG, and the module lowered over them — the binding happens where a
 * reference is lowered, so the graph is built once, with the imported
 * module's node where its parameter would be.
 *
 * @type {(source: _Source) => (context: _Link) => (module: AstModule) => Effect<ReadFile | ResolveFileModule, readonly [_Link, _Resolved], ParseError>}
 */
const linkModule = source => context => module => mapStep(
    foldStep(_importSources(source)(module[0]), { context, bound: [] }, linkImport),
    ({ context: linked, bound }) => completed(source.id)(linked)(lowered(bound)(module)))

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
    if (includes(id)(context.stack)) { return pureError(_fileError(path)('circular dependency')) }
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
    ? mapStep(_parseJson(source.path), jsonValue)
    : mapStep(link(source)({ complete: null, stack: null }), edagOf))
