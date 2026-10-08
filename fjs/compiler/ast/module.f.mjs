/**
 * AST types and helpers for a parsed module.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { AstBinary, AstBitnot, AstNot, AstTypeof, AstCall, AstConditional, AstConst, AstBody, AstEntry, AstFunction, AstItem, AstModule, AstModuleRef, AstNeg, AstSpread, AstStep, AstThrow, BinaryTag, Anchors } from './types.ts'
 * @import { _Lazy, _OperandStack, _Reach, _RefNode } from './private.ts'
 */

import { concat, empty, flat, map, toArray } from '../../types/list/module.f.mjs'
import { lazyOp2Id } from '../../edag/module.f.mjs'

/**
 * Every binary operator's tag, {@link BinaryTag} at run time — pinned to it
 * in `./types.ts`, so a tag added to one and not the other is a type error.
 * What reads a binary node asks {@link isBinary} instead of listing the
 * tags again, so a new operator is written here and in the grammar, and
 * nowhere a missed `case` would read it as something else.
 */
export const binaryTags = /** @type {const} */ ([
    '*', '/', '%', '**',
    '+', '-',
    '===', '!==', '<', '<=', '>', '>=',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??',
])

/**
 * Whether a node is a binary operator, {@link AstBinary} or the parser's
 * own node of the same shape: a tag of {@link binaryTags} and two operands.
 * The arity is what tells a subtraction from the negation `['-', a]`.
 *
 * @param {readonly unknown[]} node
 * @returns {node is readonly [BinaryTag, unknown, unknown]}
 */
export const isBinary = node => node.length === 3 && binaryTags.some(tag => tag === node[0])

/**
 * Whether a binary operator establishes its right operand only when the
 * left decides nothing — `&&`, `||` and `??`, the EDAG's `lazyOp2Id` and
 * no copy of it.
 *
 * @type {(tag: BinaryTag) => boolean}
 */
export const isLazy = tag => lazyOp2Id.some(lazy => lazy === tag)

/**
 * Whether an item or an entry is a spread, `['...', v]`, rather than a
 * value or a member.
 *
 * @type {(item: AstItem | AstEntry) => item is AstSpread}
 */
export const isSpread = item => item instanceof Array && item[0] === '...'

/** The node an item evaluates: itself, or a spread's operand. @type {(item: AstItem) => AstConst} */
export const itemOperand = item => isSpread(item) ? item[1] : item

/**
 * The operands a chain's steps hold, in the order written: each call
 * step's arguments, a spread's operand among them; a property step holds
 * none, its key being a constant. Every one of them is lazy — a chain's
 * guard decides whether the step runs — so a reader counts them as it
 * counts a lazy operator's right operand.
 *
 * @type {(step: AstStep | undefined) => readonly AstConst[]}
 */
export const stepOperands = step => {
    if (step === undefined) { return [] }
    if (step[0] === '|.') { return stepOperands(step[2]) }
    return [...step[1].map(itemOperand), ...stepOperands(step[2])]
}

/**
 * The lazy operands of a chain node: the steps' arguments, and a guarded
 * call's own — the operands an optional node skips when its value is
 * nullish, which is what makes them lazy. An access's base, and a guarded
 * call's callee, are eager and not among them.
 *
 * @type {(ast: Extract<AstConst, readonly ['.' | '?.' | '?.()', ...unknown[]]>) => readonly AstConst[]}
 */
const chainOperands = ast => ast[0] === '?.()' ? [...ast[2].map(itemOperand), ...stepOperands(ast[3])] : stepOperands(ast[3])

// ── reaching ──────────────────────────────────────────────────────────────────

/** The bit of a body index, in a set of indices spelled as a bigint. @type {(i: number) => bigint} */
const bit = i => 1n << BigInt(i)

/**
 * Every node an object's entries hold, as written: a member's value, a
 * shadowed member's among them, and a spread's operand — what the EDAG
 * constructor takes, since it applies every entry and evaluates each.
 *
 * @type {(entries: readonly AstEntry[]) => readonly AstConst[]}
 */
const entryOperands = entries => entries.map(entry => isSpread(entry) ? entry[1] : entry[2])

/**
 * The operands an EDAG establishes only when an operator decides to — the
 * right operand of `&&`, `||` and `??`, and both arms of `?:` — read as
 * none: what the EDAG establishes unconditionally, which {@link anchors}
 * asks. A reference there is no guarantee the `const` it names is
 * evaluated, so such a `const` keeps its anchor.
 *
 * @type {_Lazy}
 */
const established = () => []

/**
 * The same operands, every one counted: what a body names anywhere in it,
 * which {@link readsRest} and {@link readCaptures} ask, and neither
 * establishing decides.
 *
 * @type {_Lazy}
 */
const every = operands => operands

/** The stack with one more operand on top. @type {(s: _OperandStack, operand: AstConst) => _OperandStack} */
const pushed = (s, operand) => ({ top: operand, rest: s })

/**
 * The stack with `operands` on top of it, the first of them uppermost —
 * so they are popped in the order written, as the recursive walk read
 * them.
 *
 * @type {(operands: readonly AstConst[], rest: _OperandStack) => _OperandStack}
 */
const pushedAll = (operands, rest) => operands.reduceRight(pushed, rest)

/**
 * The operands a chain of operator/negation/bitwise-not/conditional nodes
 * bottoms out at, `ast` itself included when it is none of them — every
 * branch {@link refsOf} would otherwise recurse straight through to reach
 * its operands, and so the one shape a source expression can nest
 * arbitrarily deep through, left-associative chains of `+`/`*`/`&&`/… and
 * right-associative ones of `-`/`~`/`**`/`?:` alike.
 *
 * A heap-allocated cons-list stack in place of the recursion every one of
 * those nodes would otherwise call {@link refsOf} through, so a chain
 * however many terms long costs stack frames on the heap rather than the JS
 * call stack — the shape {@link evaluate} in `../parser/module.f.mjs`
 * already resolves a value's own operators with, over its own `_Stack`. A
 * `while` loop reassigning `stack`/`bottom` rather than a recursive walk:
 * nothing here is mutated in place, only rebound, `stack`'s own cons cells
 * each built once and never revisited.
 *
 * Which operands a node contributes is `lazy`'s where the readers differ:
 * a lazy operator's conditionally established ones — the right operand of
 * `&&`/`||`/`??` and both arms of `?:` — where the left operand, the
 * condition and a prefix operator's operand, established whatever the
 * value, are every reader's.
 *
 * @type {(lazy: _Lazy) => (ast: AstConst) => List<Exclude<AstConst, AstNeg | AstBitnot | AstNot | AstTypeof | AstBinary | AstConditional | AstThrow>>}
 */
const operandsOf = lazy => ast => {
    /** @type {_OperandStack} */
    let stack = { top: ast, rest: null }
    /** @type {List<Exclude<AstConst, AstNeg | AstBitnot | AstNot | AstTypeof | AstBinary | AstConditional | AstThrow>>} */
    let bottom = empty
    while (stack !== null) {
        const node = stack.top
        /** @type {_OperandStack} */
        const rest = stack.rest
        if (node === null || typeof node !== 'object') { bottom = concat(bottom)([node]); stack = rest; continue }
        if (isBinary(node)) {
            // the left operand on top, so it is the next popped — the
            // order the recursive walk read the two in. A lazy operator's
            // left operand is established whatever it decides; the right
            // one is `lazy`'s to count
            stack = { top: node[1], rest: isLazy(node[0]) ? pushedAll(lazy([node[2]]), rest) : { top: node[2], rest } }
            continue
        }
        switch (node[0]) {
            // a prefix operator's operand and a `throw`'s value are
            // established whatever comes of them: eager, as an operator's
            // operand is
            case '-': case '~': case '!': case 'typeof': case 'throw': { stack = { top: node[1], rest }; break }
            // the condition is established whatever it decides, as a lazy
            // operator's left operand is; the arms are `lazy`'s
            case '?:': { stack = { top: node[1], rest: pushedAll(lazy([node[2], node[3]]), rest) }; break }
            default: { bottom = concat(bottom)([node]); stack = rest }
        }
    }
    return bottom
}

/**
 * The references one entry makes directly: its `cref`s and `aref`s, however
 * deep inside its own literals, and nothing behind them — a referenced
 * `const` is an entry of its own, visited once as such, which is what keeps
 * this a walk over the syntax rather than over the value's paths. A
 * literal is read whole, every member and every item, since the EDAG
 * constructs it before any read of it; which lazy operands count is
 * `lazy`'s.
 *
 * @type {(lazy: _Lazy) => (ast: AstConst) => List<_RefNode>}
 */
const refsOf = lazy => ast => flat(map(refsOfOperand(lazy))(operandsOf(lazy)(ast)))

/**
 * One operand {@link operandsOf} bottomed out at: never itself an operator,
 * negation or bitwise not, so every branch here may recurse through
 * {@link refsOf} exactly as it always did — a container, a call, or an
 * access chain nests only as deep as the source that built it, which is a
 * separate, narrower concern than an operator chain's unbounded length.
 *
 * @type {(lazy: _Lazy) => (ast: Exclude<AstConst, AstNeg | AstBitnot | AstNot | AstTypeof | AstBinary | AstConditional | AstThrow>) => List<_RefNode>}
 */
const refsOfOperand = lazy => ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    switch (ast[0]) {
        // a spread's operand is reached where the spread stands
        case 'array': { return flat(ast[1].map(itemOperand).map(refsOf(lazy))) }
        // every entry written, a shadowed member and a spread's operand
        // included: the EDAG's object constructor applies each
        case 'object': { return flat(entryOperands(ast[1]).map(refsOf(lazy))) }
        // a call reaches its callee and every argument, each written where
        // it stands: what the call *returns* is not reachable from the
        // syntax at all, which is why a module holding one has no value —
        // except the call the lowering inlines, which is its body where the
        // call stands
        case '()': { return isInlinedCall(ast) ? inlinedRefs(lazy)(ast) : flat([ast[1], ...ast[2].map(itemOperand)].map(refsOf(lazy))) }
        // an access reaches its base, whole: the EDAG establishes the base
        // before the read; a chain's steps, and a guarded call's arguments,
        // are its lazy operands, which `lazy` counts or not
        case '.': case '?.': case '?.()': { return flat([ast[1], ...lazy(chainOperands(ast))].map(refsOf(lazy))) }
        // a function names what it captures, the enclosing scope's own
        // references, which it establishes when it is made — the captures
        // its body reads, since an unused alias of one names nothing
        case '=>': {
            const captures = ast[3]
            return captures === undefined ? empty : flat(readCaptures(ast).map(i => refsOf(lazy)(captures[i])))
        }
        // its arguments and itself are its own
        case 'arg':
        case 'rest':
        case 'self': { return empty }
        // a slot of its frame is a reference too, one the sweep of the body
        // ignores and the sweep of a scope the body is inlined into follows
        // into the capture the slot holds ({@link inlinedRefs})
        default: { return [ast] }
    }
}

/**
 * Whether a call is one the lowering inlines: a call, with no arguments, of
 * a function written at the call and nowhere else, which takes no
 * parameter and reads no rest array — `(() => { const x = f(); return [x,
 * x]; })()`, the idiom for a `const` inside an expression, an arm of a
 * conditional say, where no statement can stand.
 *
 * Such a call denotes its body where the call stands. Nothing observes the
 * function: it is called once and compared with nothing, so it mints no
 * identity the program could see, and its body evaluates exactly once, as
 * a body of the enclosing scope would; a slot of its frame is the
 * enclosing scope's own node, so what the body shares stays shared and
 * nothing else is. An argument list that is not empty would have to be
 * evaluated for what it establishes, `(() => 1)(null.x)` throws, and a
 * body reading its own rest array names something the enclosing scope
 * does not hold, so both stay calls. A function with fixed parameters
 * binds names, so a `length` above zero stays a call too.
 *
 * @type {(ast: AstCall) => boolean}
 */
export const isInlinedCall = ([, callee, args]) =>
    args.length === 0 && callee !== null && typeof callee === 'object' && callee[0] === '=>' && callee[1] === 0 && !readsRest(callee[2])

/**
 * Whether a body reads its own rest array: an `['rest']` in one of its
 * entries, outside a nested function's body — that one's rest is its own —
 * and in a nested function's captures, which name this body's.
 *
 * @type {(body: AstBody) => boolean}
 */
const readsRest = body => body.some(entry => toArray(operandsOf(every)(entry)).some(operandReadsRest))

/** @type {(ast: Exclude<AstConst, AstNeg | AstBitnot | AstNot | AstTypeof | AstBinary | AstConditional>) => boolean} */
const operandReadsRest = ast => {
    if (ast === null || typeof ast !== 'object') { return false }
    switch (ast[0]) {
        case 'rest': { return true }
        case 'array': { return readsRest(ast[1].map(itemOperand)) }
        case 'object': { return readsRest(entryOperands(ast[1])) }
        case '()': { return readsRest([ast[1], ...ast[2].map(itemOperand)]) }
        case '.': case '?.': case '?.()': { return readsRest([ast[1], ...chainOperands(ast)]) }
        case '=>': { return readsRest(ast[3] ?? []) }
        default: { return false }
    }
}

/**
 * The references a body makes, read as `lazy` says: every entry of the
 * body is established — the value, and the ones the value does not reach,
 * which the lowering anchors — so each entry's references count, but a
 * bare alias's, which is the node it names and no code of its own, unless
 * the alias is the value. A reference to a body `const` is resolved to the
 * node it names, so a slot of the body's frame reached through an alias is
 * that slot.
 *
 * @type {(lazy: _Lazy) => (body: AstBody) => List<_RefNode>}
 */
const bodyRefs = lazy => body => {
    const nodes = body.reduce(nodeEntry([]), [])
    return map(resolved([], nodes))(flat(body.filter((e, i) => i === body.length - 1 || !isAlias(e)).map(refsOf(lazy))))
}

/**
 * The captures a function's body reads, by index into its captures, each
 * once in the order the body first names them: the slots of its frame. A
 * capture the parser listed that the body names only through an unused
 * alias, `const x = c;` and nothing more, is not among them — the alias
 * is dropped, so nothing reads the slot, and the enclosing scope's `const`
 * is anchored there as one nothing reaches. Read anywhere counts: a lazy
 * position, and a nested function's captures.
 *
 * @type {(ast: AstFunction) => readonly number[]}
 */
export const readCaptures = ([, , body]) =>
    toArray(bodyRefs(every)(body)).flatMap(ref => ref[0] === 'fref' ? [ref[1]] : []).filter((i, k, all) => all.indexOf(i) === k)

/**
 * The references a call the lowering inlines makes, read as `lazy` says:
 * the body's, {@link bodyRefs}, with a slot of the body's frame followed
 * into the capture it holds.
 *
 * @type {(lazy: _Lazy) => (ast: AstCall) => List<_RefNode>}
 */
const inlinedRefs = lazy => ([, callee]) => {
    const [, , body, captures = []] = /** @type {AstFunction} */ (callee)
    /** @type {(ref: _RefNode) => List<_RefNode>} */
    const captured = ref => ref[0] === 'fref' ? refsOf(lazy)(captures[ref[1]]) : empty
    return flat(map(captured)(bodyRefs(lazy)(body)))
}

/** @type {(reachable: bigint, ref: _RefNode) => bigint} */
const reachStep = (reachable, [kind, i]) => kind === 'cref' ? reachable | bit(i) : reachable

/**
 * One entry of the sweep from the export downwards: an entry a reference
 * reaches is reachable, and a reachable entry's own references count and
 * make their targets reachable. A `cref` names an earlier entry — the
 * parser refuses a `const` naming itself or a later one — so by the time
 * the sweep arrives at an entry every reference to it has been seen.
 *
 * @type {(refs: (ast: AstConst) => List<_RefNode>) => (reach: _Reach, ast: AstConst, i: number) => _Reach}
 */
const reachEntry = refs => (reach, ast, i) => {
    if ((reach.reachable & bit(i)) === 0n) { return reach }
    const made = toArray(refs(ast))
    return { reachable: made.reduce(reachStep, reach.reachable), refs: concat(reach.refs)(made) }
}

/**
 * The sweep from the export downwards over a whole body: which entries it
 * reaches, and every reference those entries make, read as `lazy` says.
 *
 * @type {(lazy: _Lazy) => (body: AstBody) => _Reach}
 */
const reach = lazy => body =>
    body.reduceRight(reachEntry(refsOf(lazy)), { reachable: bit(body.length - 1), refs: empty })

/** @type {(args: bigint, ref: _RefNode) => bigint} */
const argStep = (args, [kind, i]) => kind === 'aref' ? args | bit(i) : args

/** The indices a set of `n` leaves out. @type {(set: bigint) => (n: number) => readonly number[]} */
const missing = set => n => Array.from({ length: n }, (_, i) => i).filter(i => (set & bit(i)) === 0n)

/**
 * Whether an entry is a bare reference: a `const` naming another entry, an
 * import, a slot of its frame, the arguments or the function itself is that
 * node, not a node of its own.
 *
 * @type {(ast: AstConst) => boolean}
 */
const isAlias = ast => ast !== null && typeof ast === 'object' && ['cref', 'aref', 'fref', 'rest', 'arg', 'self'].includes(ast[0])

/** The first import standing for the same node as import `k`, which `imports` says by identity. @type {(imports: readonly unknown[]) => (k: number) => AstModuleRef} */
const importNode = imports => k => ['aref', imports.indexOf(imports[k])]

/**
 * One entry's node as a reference: the entry itself, or through an alias
 * the node it names — an alias names an earlier entry, so its node is known
 * by the time the fold arrives at it.
 *
 * @type {(imports: readonly unknown[]) => (ast: AstConst, i: number, nodes: readonly _RefNode[]) => _RefNode}
 */
const nodeOf = imports => (ast, i, nodes) => {
    if (ast === null || typeof ast !== 'object') { return ['cref', i] }
    switch (ast[0]) {
        case 'cref': { return nodes[ast[1]] }
        case 'aref': { return importNode(imports)(ast[1]) }
        case 'fref': { return ast }
        default: { return ['cref', i] }
    }
}

/** @type {(imports: readonly unknown[]) => (nodes: readonly _RefNode[], ast: AstConst, i: number) => readonly _RefNode[]} */
const nodeEntry = imports => (nodes, ast, i) => [...nodes, nodeOf(imports)(ast, i, nodes)]

/** A reference by the node it reaches, aliases and imports resolved; a slot of the frame is its own node. @type {(imports: readonly unknown[], nodes: readonly _RefNode[]) => (ref: _RefNode) => _RefNode} */
const resolved = (imports, nodes) => ref =>
    ref[0] === 'cref' ? nodes[ref[1]] : ref[0] === 'aref' ? importNode(imports)(ref[1]) : ref

/**
 * What an EDAG of the module anchors, by index: exactly the code the graph
 * would not otherwise hold — the body entries no chain of references from
 * the export leads to, and the imports likewise, read as the EDAG
 * establishes them, {@link established}, less what those entries reach
 * themselves the same way, which the graph holds through them. Module
 * initialization evaluates every declaration and loads every import whether
 * the export reaches them or not. A compiler that follows references alone
 * would drop these computations; anchors retain them.
 *
 * Reached means reached through eager positions alone — a container item,
 * an access base, a call's callee and arguments, an operator's operand, a
 * lazy operator's left one, a conditional's condition — and never through
 * a lazy one, the right operand of `&&`/`||`/`??` or an arm of `?:`: a
 * reference there is established only when the operator decides to, where
 * the source's own `const c = null.x;` throws at load whatever later code
 * does with `c`. So `const c = null.x; export default [a && c, b && c];`
 * anchors `c`, and `[c, a && c]` does not, the array's item being one
 * eager path in; and an unreached entry excuses another's anchor only when
 * it reaches it eagerly — `const d = null.x; const c = a && d; export
 * default b && c;` anchors both, since anchoring `c` establishes `a && d`
 * and not `d`. The rule is
 * [`spec/todo/2340-operators.md`](../../../spec/todo/2340-operators.md)'s
 * subtraction, the comma's to generalize.
 *
 * Counted by node, not by entry, since it is the graph that holds or lacks
 * a node: a `const` that is a bare reference is the node it names and is
 * no code of its own, and two imports are one node where `imports` holds
 * one value for both — as the linker binds two imports of one module — so
 * `const b = a; export default a;` anchors nothing, and `const c = [a]`
 * beside the alias anchors `c` alone.
 *
 * A member a later duplicate shadows counts: the value drops it, but an
 * EDAG's object constructor applies every member written and evaluates
 * each, so what its reference names is in the graph, not dropped.
 *
 * @type {(module: AstModule) => (imports: readonly unknown[]) => Anchors}
 */
export const anchors = ([specifiers, body]) => imports => {
    const nodes = body.reduce(nodeEntry(imports), [])
    const { reachable, refs } = reach(established)(body)
    const unreached = missing(reachable)(body.length).filter(i => !isAlias(body[i]))
    const within = map(resolved(imports, nodes))(flat(unreached.map(i => refsOf(established)(body[i]))))
    const reachedWithin = toArray(within).reduce(reachStep, 0n)
    const reachedImports = toArray(concat(map(resolved(imports, nodes))(refs))(within)).reduce(argStep, 0n)
    return {
        consts: unreached.filter(i => (reachedWithin & bit(i)) === 0n),
        imports: missing(reachedImports)(specifiers.length).filter(k => imports.indexOf(imports[k]) === k),
    }
}
