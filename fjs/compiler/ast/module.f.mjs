/**
 * AST types and helpers for a parsed module.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { AstBinary, AstInstanceOf, AstKey, AstCall, AstConditional, AstConst, AstBody, AstEntry, AstFunction, AstItem, AstModule, AstModuleRef, AstNeg, AstSpread, AstStep, AstThrow, AstUnary, BinaryTag, UnaryTag, Anchors } from './types.ts'
 * @import { _Lazy, _OperandStack, _RefNode, _Sweep } from './private.ts'
 */

import { concat, empty, flat, map, toArray } from '../../types/list/module.f.mjs'
import { isStatic, lazyOp2Id } from '../../edag/module.f.mjs'

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
 * The eager binary layers, tightest first: one record per level, each
 * operator keyed by a name no other layer uses and valued by its tag,
 * which is also its token. The one statement of their precedence — the
 * grammar builds its ladder from it and the writer the parentheses it
 * needs. The `-` here is subtraction, sharing a token and nothing else
 * with the negation prefix, {@link AstNeg}. `instanceof` is a relational
 * operator, one level with `<` and left-associative as it is, though its
 * node is {@link AstInstanceOf}, not a binary one. `==` and `!=` are not
 * this language's, per `spec/todo/2340-operators.md`. `**` is in
 * no layer: it is right-associative and read inside the operand, so each
 * side places it, tightest of all, where it builds its own structure.
 * Pinned beside {@link binaryTags} in `./types.ts`.
 */
export const eagerLayers = /** @type {const} */ ([
    { mul: '*', div: '/', mod: '%' },
    { add: '+', sub: '-' },
    { left: '<<', right: '>>', unsigned: '>>>' },
    { lt: '<', le: '<=', gt: '>', ge: '>=', instanceof: 'instanceof' },
    { eq: '===', ne: '!==' },
    { and: '&' },
    { xor: '^' },
    { or: '|' },
])

/**
 * The lazy layers above {@link eagerLayers}, tightest first, as they are
 * keyed. `??` shares a level with `||` and mixes with neither it nor `&&`
 * bare — a refusal the grammar states, not an order.
 */
export const lazyLayers = /** @type {const} */ ([
    { logicalAnd: '&&' },
    { logicalOr: '||', nullish: '??' },
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
 * Every unary operator's tag, {@link UnaryTag} at run time — pinned to it in
 * `./types.ts` as {@link binaryTags} is to its own: the prefixes `-`, `~`,
 * `!` and `typeof`, and the `Number` and `String` conversions, each a node
 * of one operand. `instanceof` is not one: its node carries the constructor
 * name too. Nor is `throw`, which ends a body rather than computing a value.
 */
export const unaryTags = /** @type {const} */ (['-', '~', '!', 'typeof', 'Number', 'String'])

/**
 * Whether a node is a unary operator, {@link AstUnary} or the parser's own
 * node of the same shape: a tag of {@link unaryTags} and one operand. The
 * arity is what tells the negation `['-', a]` from a subtraction.
 *
 * @param {readonly unknown[]} node
 * @returns {node is readonly [UnaryTag, unknown]}
 */
export const isUnary = node => node.length === 2 && unaryTags.some(tag => tag === node[0])

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
 * The operand a key holds: the conversion of a computed key,
 * `a[Number(i)]`, and none for a constant.
 *
 * @type {(key: AstKey) => readonly AstConst[]}
 */
const keyOperands = key => key instanceof Array ? [key] : []

/**
 * The operands a chain's steps hold, in the order written: each property
 * step's computed key, and each call step's arguments, a spread's operand
 * among them. Every one of them is lazy — a chain's guard decides whether
 * the step runs — so a reader counts them as it counts a lazy operator's
 * right operand.
 *
 * @type {(step: AstStep | undefined) => readonly AstConst[]}
 */
export const stepOperands = step => {
    if (step === undefined) { return [] }
    if (step[0] === '|.') { return [...keyOperands(step[1]), ...stepOperands(step[2])] }
    return [...step[1].map(itemOperand), ...stepOperands(step[2])]
}

/**
 * The lazy operands of a chain node: the steps', a guarded access's
 * computed key, and a guarded call's own arguments — the operands an
 * optional node skips when its value is nullish, which is what makes them
 * lazy. An access's base, a plain access's key and a guarded call's callee
 * are eager and not among them, {@link chainEager}.
 *
 * @type {(ast: Extract<AstConst, readonly ['.' | '?.' | '?.()', ...unknown[]]>) => readonly AstConst[]}
 */
const chainOperands = ast => {
    switch (ast[0]) {
        case '?.()': { return [...ast[2].map(itemOperand), ...stepOperands(ast[3])] }
        case '?.': { return [...keyOperands(ast[2]), ...stepOperands(ast[3])] }
        default: { return stepOperands(ast[3]) }
    }
}

/**
 * The eager operands of a chain node: its base or callee, and a plain
 * access's computed key, established after the base whatever the steps
 * after it do.
 *
 * @type {(ast: Extract<AstConst, readonly ['.' | '?.' | '?.()', ...unknown[]]>) => readonly AstConst[]}
 */
const chainEager = ast => ast[0] === '.' ? [ast[1], ...keyOperands(ast[2])] : [ast[1]]

// ── reaching ──────────────────────────────────────────────────────────────────

/** The bit of a body index, in a set of indices spelled as a bigint. @type {(i: number) => bigint} */
const bit = i => 1n << BigInt(i)

/**
 * Every node an object's entries hold, as written: a member's key and its
 * value, a shadowed member's among them, and a spread's operand — what the
 * EDAG constructor takes, since it applies every entry and evaluates each.
 *
 * @type {(entries: readonly AstEntry[]) => readonly AstConst[]}
 */
const entryOperands = entries => entries.flatMap(entry => isSpread(entry) ? [entry[1]] : [entry[1], entry[2]])

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
 * @type {(lazy: _Lazy) => (ast: AstConst) => List<Exclude<AstConst, AstUnary | AstInstanceOf | AstBinary | AstConditional | AstThrow>>}
 */
const operandsOf = lazy => ast => {
    /** @type {_OperandStack} */
    let stack = { top: ast, rest: null }
    /** @type {List<Exclude<AstConst, AstUnary | AstInstanceOf | AstBinary | AstConditional | AstThrow>>} */
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
            // a prefix operator's operand, a conversion's and a `throw`'s
            // value are established whatever comes of them: eager, as an
            // operator's operand is; an `instanceof`'s one operand likewise,
            // its constructor name metadata, not an operand
            case '-': case '~': case '!': case 'typeof': case 'instanceof': case 'Number': case 'String': case 'throw': { stack = { top: node[1], rest }; break }
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
 * @type {(lazy: _Lazy) => (ast: Exclude<AstConst, AstUnary | AstInstanceOf | AstBinary | AstConditional | AstThrow>) => List<_RefNode>}
 */
const refsOfOperand = lazy => ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    // a static function names nothing, as the `entry` helper below: a
    // function of its parameters alone
    if (isStatic(ast)) { return empty }
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
        // an access reaches its base, whole, and a plain access its
        // computed key: the EDAG establishes both before the read; a
        // chain's steps, a guarded access's key and a guarded call's
        // arguments are its lazy operands, which `lazy` counts or not
        case '.': case '?.': case '?.()': { return flat([...chainEager(ast), ...lazy(chainOperands(ast))].map(refsOf(lazy))) }
        // a function names what it captures, the enclosing scope's own
        // references, which it establishes when it is made — the captures
        // its body reads, since an unused alias of one names nothing
        case '=>': {
            const captures = ast[3]
            return captures === undefined ? empty : flat(readCaptures(ast).map(i => refsOf(lazy)(captures[i])))
        }
        // its arguments and itself are its own, and the `entry` helper
        // names nothing: a function of its parameters alone
        case 'arg':
        case 'rest':
        case 'self':
        case 'entry': { return empty }
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

/** @type {(ast: Exclude<AstConst, AstUnary | AstInstanceOf | AstBinary | AstConditional>) => boolean} */
const operandReadsRest = ast => {
    if (ast === null || typeof ast !== 'object') { return false }
    switch (ast[0]) {
        case 'rest': { return true }
        case 'array': { return readsRest(ast[1].map(itemOperand)) }
        case 'object': { return readsRest(entryOperands(ast[1])) }
        case '()': { return readsRest([ast[1], ...ast[2].map(itemOperand)]) }
        case '.': case '?.': case '?.()': { return readsRest([...chainEager(ast), ...chainOperands(ast)]) }
        case '=>': { return readsRest(ast[3] ?? []) }
        default: { return false }
    }
}

/**
 * The references a body makes, read as `lazy` says, each entry's in the
 * body's order, and which entries a reference reaches: every entry of the
 * body is established — the value, and the ones the value does not reach,
 * which the lowering anchors — so each entry's references count, but for
 * one established only by what it anchors, which counts only that,
 * {@link sideRefs}: an alias, which is the node it names and no code of
 * its own, unless the alias is the value read; and a call inlined that no
 * reference reaches, whose value nothing reads, so its body anchors
 * what it must with no value to reach. `value` says whether the value is
 * read. A reference is resolved to the node it names, `imports` resolving
 * an import's, so a slot of the body's frame reached through an alias is
 * that slot.
 *
 * The sweep runs from the value back: a reference names an earlier entry
 * — the parser refuses a `const` naming itself or a later one — so by the
 * time it arrives at an entry every reference to it has been seen.
 *
 * @type {(lazy: _Lazy, imports: readonly unknown[], value: boolean) => (body: AstBody) => _Sweep}
 */
const sweep = (lazy, imports, value) => body => {
    const resolve = resolved(imports, body.reduce(nodeEntry(imports), []))
    /** @type {(acc: _Sweep, e: AstConst, i: number) => _Sweep} */
    const step = (acc, e, i) => {
        const valued = value && i === body.length - 1
        const whole = valued || (!isAlias(e) && ((acc.read & bit(i)) !== 0n || inlinedCall(e) === null))
        // forced once: a reference list is lazy, and forcing it again sweeps
        // every body nested in the entry again
        const made = toArray(map(resolve)(whole ? refsOf(lazy)(e) : sideRefs(lazy)(e)))
        return { read: made.reduce(reachStep, acc.read), refs: concat(made)(acc.refs) }
    }
    return body.reduceRight(step, { read: value ? bit(body.length - 1) : 0n, refs: empty })
}

/** The references a body makes, {@link sweep}, resolved through its own entries. @type {(lazy: _Lazy, value?: boolean) => (body: AstBody) => List<_RefNode>} */
const bodyRefs = (lazy, value = true) => body => sweep(lazy, [], value)(body).refs

/**
 * The captures a function's body reads, by index into its captures, each
 * once in the order the body first names them: the slots of its frame. A
 * capture the parser listed that the body names only through an unused
 * alias, `const x = c;` or `const x = (() => c)();` and nothing more, is
 * not among them — the alias is dropped, so nothing reads the slot, and the
 * enclosing scope's `const` is anchored there as one nothing reaches. Read
 * anywhere counts: a lazy position, and a nested function's captures.
 *
 * @type {(ast: AstFunction) => readonly number[]}
 */
export const readCaptures = ([, , body]) =>
    toArray(bodyRefs(every)(body)).flatMap(ref => ref[0] === 'fref' ? [ref[1]] : []).filter((i, k, all) => all.indexOf(i) === k)

/**
 * The references a call the lowering inlines makes, read as `lazy` says:
 * the body's, {@link bodyRefs}, with a slot of the body's frame followed
 * into the capture it holds — its value's among them where `value` says
 * the value is read.
 *
 * @type {(lazy: _Lazy, value?: boolean) => (ast: AstCall) => List<_RefNode>}
 */
const inlinedRefs = (lazy, value = true) => ([, callee]) => {
    const [, , body, captures = []] = /** @type {AstFunction} */ (callee)
    /** @type {(ref: _RefNode) => List<_RefNode>} */
    const captured = ref => ref[0] === 'fref' ? refsOf(lazy)(captures[ref[1]]) : empty
    return flat(map(captured)(bodyRefs(lazy, value)(body)))
}

/**
 * What an entry establishes that nothing reads, beside any node it names:
 * nothing for a bare reference, and for a call inlined, what its body
 * anchors as one whose value nothing reads — the `const`s nothing reaches,
 * the value among them, which the lowering floats out of the call where it
 * stands. A call that answers a reference, {@link answered}, anchors only
 * what its body holds beside it.
 *
 * @type {(lazy: _Lazy) => (ast: AstConst) => List<_RefNode>}
 */
const sideRefs = lazy => ast => {
    const call = inlinedCall(ast)
    return call === null ? empty : inlinedRefs(lazy, false)(call)
}

/** @type {(reachable: bigint, ref: _RefNode) => bigint} */
const reachStep = (reachable, [kind, i]) => kind === 'cref' ? reachable | bit(i) : reachable

/** @type {(args: bigint, ref: _RefNode) => bigint} */
const argStep = (args, [kind, i]) => kind === 'aref' ? args | bit(i) : args

/** The indices a set of `n` leaves out. @type {(set: bigint) => (n: number) => readonly number[]} */
const missing = set => n => Array.from({ length: n }, (_, i) => i).filter(i => (set & bit(i)) === 0n)

/** The tags of a bare reference: an entry, an import, a slot of the frame, the arguments, a parameter, the function itself. @type {readonly string[]} */
const references = ['cref', 'aref', 'fref', 'rest', 'arg', 'self']

/** `ast` where it is a call the lowering inlines, {@link isInlinedCall}, and `null` for any other entry. @type {(ast: AstConst) => AstCall | null} */
const inlinedCall = ast => ast !== null && typeof ast === 'object' && ast[0] === '()' && isInlinedCall(ast) ? ast : null

/**
 * The reference a call inlined answers, where its body's value is a node
 * the body does not make: a slot of its frame, read directly, through the
 * body's own aliases, or through a call inlined in the body — followed into
 * the capture it holds, a reference of the scope around the call. `null`
 * where the body makes its value.
 *
 * @type {(ast: AstCall) => AstConst | null}
 */
const answered = ([, callee]) => {
    const [, , body, captures = []] = /** @type {AstFunction} */ (callee)
    /** @type {(v: AstConst) => AstConst | null} */
    const follow = v => {
        if (v === null || typeof v !== 'object') { return null }
        switch (v[0]) {
            case 'cref': { return follow(body[v[1]]) }
            case 'fref': { return captures[v[1]] }
            case '()': {
                const inner = isInlinedCall(v) ? answered(v) : null
                return inner === null ? null : follow(inner)
            }
            default: { return null }
        }
    }
    return follow(body[body.length - 1])
}

/**
 * The reference an entry is, where it names a node rather than making one:
 * the entry itself, a bare reference — a `const` naming another entry, an
 * import, a slot of its frame, the arguments or the function itself is that
 * node — or the reference a call inlined answers, {@link answered}: `const
 * u = (() => t)();` is `t`, as `const u = t;` is, and evaluates nothing of
 * its own. `null` for every other entry.
 *
 * @type {(ast: AstConst) => AstConst | null}
 */
const named = ast => {
    if (ast === null || typeof ast !== 'object') { return null }
    if (references.includes(ast[0])) { return ast }
    const call = inlinedCall(ast)
    const inner = call === null ? null : answered(call)
    return inner === null ? null : named(inner)
}

/** Whether an entry is an alias: the node it names, not a node of its own, {@link named}. @type {(ast: AstConst) => boolean} */
const isAlias = ast => named(ast) !== null

/** The first import standing for the same node as import `k`, which `imports` says by identity. @type {(imports: readonly unknown[]) => (k: number) => AstModuleRef} */
const importNode = imports => k => ['aref', imports.indexOf(imports[k])]

/**
 * One entry's node as a reference: the entry itself, or through an alias
 * the node it names, {@link named} — an alias names an earlier entry, so
 * its node is known by the time the fold arrives at it.
 *
 * @type {(imports: readonly unknown[]) => (ast: AstConst, i: number, nodes: readonly _RefNode[]) => _RefNode}
 */
const nodeOf = imports => (ast, i, nodes) => {
    const target = named(ast)
    if (target === null || typeof target !== 'object') { return ['cref', i] }
    switch (target[0]) {
        case 'cref': { return nodes[target[1]] }
        case 'aref': { return importNode(imports)(target[1]) }
        case 'fref': { return target }
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
 * a node: a `const` that is an alias, {@link named} — a bare reference, or
 * a call inlined that answers one — is the node it names and is no code of
 * its own, and two imports are one node where `imports` holds one value
 * for both — as the linker binds two imports of one module — so `const b =
 * a; export default a;` anchors nothing, `const c = [a]` beside the alias
 * anchors `c` alone, and `const t = n.x; const u = (() => t)(); export
 * default 1;` anchors `t`, where it stands. What a call inlined anchors
 * beside the node it answers is established all the same, so what that
 * reaches is reached ({@link sideRefs}).
 *
 * A member a later duplicate shadows counts: the value drops it, but an
 * EDAG's object constructor applies every member written and evaluates
 * each, so what its reference names is in the graph, not dropped.
 *
 * A call inlined that nothing reaches anchors no node of its own: whatever
 * node it answers is its body's, so its body anchors what it must as one
 * whose value nothing reads, `calls`, the value among it unless the body's
 * other anchors reach it. `value` false reads the body that way: its last
 * entry is one more `const` nothing reaches.
 *
 * @type {(module: AstModule, value?: boolean) => (imports: readonly unknown[]) => Anchors}
 */
export const anchors = ([specifiers, body], value = true) => imports => {
    const { read, refs } = sweep(established, imports, value)(body)
    const unread = missing(read)(body.length).filter(i => !isAlias(body[i]))
    const reachedImports = toArray(refs).reduce(argStep, 0n)
    return {
        consts: unread.filter(i => inlinedCall(body[i]) === null),
        calls: unread.filter(i => inlinedCall(body[i]) !== null),
        imports: missing(reachedImports)(specifiers.length).filter(k => imports.indexOf(imports[k]) === k),
    }
}
