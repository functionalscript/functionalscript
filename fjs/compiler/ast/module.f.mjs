/**
 * AST types and helpers for a parsed module.
 *
 * @module
 *
 * @import { Array, Unknown } from '../../media/datajs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstAccess, AstArray, AstBinary, AstBitnot, AstCall, AstConditional, AstConst, AstBody, AstEntry, AstFunction, AstItem, AstMember, AstModule, AstModuleRef, AstNeg, AstObject, AstSpread, AstThrow, BinaryTag, Anchors } from './types.ts'
 * @import { _Lazy, _OperandStack, _Reach, _RefNode, _RunState } from './private.ts'
 */

import { concat, empty, flat, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'
import { error, mapOk, ok, okList, okThen } from '../../types/result/module.f.mjs'
import { concat as stringConcat } from '../../types/string/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { lazyOp2Id } from '../../edag/module.f.mjs'

const { hasOwn } = Object

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
 * The own property `key` of `base`, or `undefined` where there is none —
 * never the prototype chain: a member of an object, an element or the
 * `length` of an array, a code unit or the `length` of a string; a number, a
 * boolean and a bigint have none, and neither have `null` and `undefined`,
 * which `Object` boxes to an empty object. `key` is read as JavaScript
 * reads one, so `0` and `"0"` name the same element.
 *
 * @type {(base: Unknown, key: string | number) => Unknown}
 */
export const _own = (base, key) => {
    /** @type {{ readonly [k in string]?: Unknown }} */
    const object = Object(base)
    return hasOwn(object, key) ? object[key] : undefined
}

/**
 * A property access on a value: the own property, as {@link _own} reads it,
 * of a base that has properties — a `null` or `undefined` base is the
 * failure JavaScript throws for, and the one failure a data module can
 * make.
 *
 * @type {(key: string | number) => (base: Unknown) => Result<Unknown, string>}
 */
const ownProperty = key => base => base === null || base === undefined
    ? error(`cannot read property "${key}" of ${base}`)
    : ok(_own(base, key))

/** @type {(key: string) => (value: Unknown) => readonly [string, Unknown]} */
const keyed = key => value => [key, value]

/**
 * Whether an item or an entry is a spread, `['...', v]`, rather than a
 * value or a member.
 *
 * @type {(item: AstItem | AstEntry) => item is AstSpread}
 */
export const isSpread = item => item instanceof Array && item[0] === '...'

/** The node an item evaluates: itself, or a spread's operand. @type {(item: AstItem) => AstConst} */
export const itemOperand = item => isSpread(item) ? item[1] : item

/** Whether an entry is a member, `[':', name, value]`, rather than a spread. @type {(entry: AstEntry) => entry is AstMember} */
const isMember = entry => !isSpread(entry)

/**
 * The members among an object's entries, in order, the spreads left out:
 * for a reader of the keys an object literal writes, which a spread does
 * not spell. Exported for the transpiler, which reads the keys of the
 * result object it built itself, one member per export and no spread.
 *
 * @type {(entries: readonly AstEntry[]) => readonly AstMember[]}
 */
export const members = entries => entries.filter(isMember)

/** @type {(items: List<readonly Unknown[]>) => Unknown} */
const arrayOf = items => toArray(items).flat()

/**
 * The refusal of a spread whose operand is not iterable: every value but an
 * array and a string, as JavaScript's `GetIterator` refuses it with a
 * `TypeError` — a FunctionalScript object cannot define `Symbol.iterator`.
 */
const notIterable = 'a spread of a value that is not iterable'

/**
 * The values a spread's operand yields: an array's elements in index order,
 * or a string's code points, each a string of its own — what JavaScript's
 * iterator of each yields.
 *
 * @type {(value: Unknown) => Result<readonly Unknown[], string>}
 */
const iterated = value =>
    value instanceof Array ? ok(value)
    : typeof value === 'string' ? ok([...value])
    : error(notIterable)

/** An object of its entries' properties in order: a repeated key keeps its first position and takes its last value. @type {(properties: readonly (readonly (readonly [string, Unknown])[])[]) => Unknown} */
const objectOf = properties => fromEntries(properties.flat())

/**
 * The properties a spread's operand contributes, as `CopyDataProperties`
 * copies them: its own enumerable string-keyed properties in own-property
 * order — an object's, an array's elements by index, a string's code units —
 * and none from `null`, `undefined`, a boolean, a number or a `bigint`.
 * Never a failure, unlike an array's spread: `{ ...null }` is `{}`.
 *
 * @type {(value: Unknown) => readonly (readonly [string, Unknown])[]}
 */
const copied = value => value === null || value === undefined
    ? []
    : Object.entries(/** @type {{ readonly [k in string]?: Unknown }} */ (Object(value)))

/**
 * The properties an entry adds to an object, by the evaluator given first:
 * a member's one, or the ones a spread's operand contributes, {@link copied}.
 *
 * @type {(evaluate: (ast: AstConst) => Result<Unknown, string>) => (entry: AstEntry) => Result<readonly (readonly [string, Unknown])[], string>}
 */
const entryProperties = evaluate => entry => isSpread(entry)
    ? mapOk(copied)(evaluate(entry[1]))
    : mapOk(value => [keyed(entry[1])(value)])(evaluate(entry[2]))

/** One value, as the values an item adds to an array. @type {(value: Unknown) => readonly Unknown[]} */
const single = value => [value]

/**
 * The values one item adds to an array, by the evaluator given first: its
 * own value, or the values a spread's operand yields, {@link iterated}.
 *
 * @type {(evaluate: (ast: AstConst) => Result<Unknown, string>) => (item: AstItem) => Result<readonly Unknown[], string>}
 */
const itemValues = evaluate => item => isSpread(item)
    ? okThen(iterated)(evaluate(item[1]))
    : mapOk(single)(evaluate(item))

/** @type {(state: _RunState) => (djs: Unknown) => _RunState} */
const evaluated = state => djs => ({ ...state, consts: concat(state.consts)([djs]) })

/** @type {(ast: AstConst) => (state: _RunState) => Result<_RunState, string>} */
const foldOp = ast => state => mapOk(evaluated(state))(toDjs(state)(ast))

/** @type {(acc: Result<_RunState, string>, ast: AstConst) => Result<_RunState, string>} */
const entryStep = (acc, ast) => okThen(foldOp(ast))(acc)

/**
 * The refusal of a function where a value is wanted: this evaluator computes
 * the value a module denotes, and no value here is a function.
 *
 * It named the EDAG as the place functions go while that was the only output
 * holding one. It is not any more — `fjs compile` writes the module itself
 * under a JavaScript name
 * ([`../serializer`](../serializer/module.f.mjs)) — so the message says what
 * is missing and leaves the choice of output to the compiler's own
 * documentation.
 */
const noFunctionValue = 'a function has no value'

/**
 * The refusal of a call where a value is wanted: this evaluator computes
 * the value a module denotes and has no function to apply, so what a call
 * returns is not a value it can reach. Interpreting a call is
 * [`../todo/interpret-edag.md`](../todo/interpret-edag.md)'s.
 */
const noCallValue = 'a call has no value'

/**
 * The refusal of a binary operator, a conditional or a bitwise not where
 * a value is wanted: `+` alone needs `ToPrimitive` to decide number or
 * string, and folding every other operator while leaving `+` a node would
 * draw an inconsistent line, so this evaluator answers none of them — the
 * lazy ones and the conditional included, whose `ToBoolean` is a question
 * of the same kind — see {@link AstBinary}'s own comment in `./types.ts`. `run` reaches this
 * exactly where it reaches {@link noFunctionValue}/{@link noCallValue}: a
 * node whose value is the EDAG's to give, not this reader's.
 */
const noOperatorValue = 'an operator has no value'

/**
 * The refusal of a value this evaluator has no number for: a container.
 *
 * Converting one is `ToPrimitive`, JavaScript's own machinery — `valueOf`,
 * then `toString`, and a `TypeError` where neither answers with a
 * primitive. Which of those a value reaches depends on what it holds, so
 * saying in advance that a container converts means assuming what may be
 * in it. This refuses instead. The numbers JavaScript would give — `-[1]`
 * is `-1`, `-{}` is `NaN` — wait on that machinery being written rather
 * than reasoned about.
 */
const noNumber = 'no number for this value'

/**
 * The failure a `throw` makes of the value it established: what the value
 * outputs report for a module whose load throws, as they report a read of
 * `null`. The thrown value is no observation of the language's
 * ([spec: failure is one outcome](../../../spec/README.md#failure-is-one-outcome)),
 * so the message is a diagnostic: a primitive as DataJS spells it, a
 * container by its kind.
 *
 * @type {(value: Unknown) => Result<never, string>}
 */
const thrown = value => error(`throw ${value !== null && typeof value === 'object'
    ? (value instanceof Array ? 'an array' : 'an object')
    : stringConcat(leafSerialize(value))}`)

/**
 * A value negated, as JavaScript's unary `-` negates it: a bigint stays a
 * bigint, and every other primitive converts — `-null` is `-0`, `-"2"` is
 * `-2`, `-true` is `-1`, `-undefined` is `NaN`. `Number` is total over
 * those five and cannot throw, which is what makes this total without
 * knowing anything about the value beyond its type.
 *
 * Anything else is {@link noNumber}'s.
 *
 * @type {(value: Unknown) => Result<Unknown, string>}
 */
const negated = value => {
    if (typeof value === 'bigint') { return ok(-value) }
    if (value === null) { return ok(-0) }
    switch (typeof value) {
        case 'number': case 'string': case 'boolean': case 'undefined': { return ok(-Number(value)) }
        default: { return error(noNumber) }
    }
}

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
    if (isBinary(ast)) { return error(noOperatorValue) }
    switch (ast[0]) {
        case 'aref': { return ok(state.args[ast[1]]) }
        case 'cref': { return ok(last(null)(take(ast[1] + 1)(state.consts))) }
        case 'array': { return mapOk(arrayOf)(okList(ast[1].map(itemValues(toDjs(state))))) }
        case 'object': { return mapOk(objectOf)(okList(ast[1].map(entryProperties(toDjs(state))))) }
        case '=>':
        case 'arg':
        case 'rest':
        case 'fref': { return error(noFunctionValue) }
        case '()': { return error(noCallValue) }
        case '-': { return okThen(negated)(toDjs(state)(ast[1])) }
        case '~': case '?:': { return error(noOperatorValue) }
        // the operand is established first, as JavaScript establishes it,
        // and its own failure is the one reported where it has one
        case 'throw': { return okThen(thrown)(toDjs(state)(ast[1])) }
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
 * module denote a graph rather than a tree.
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
 * @type {(lazy: _Lazy) => (ast: AstConst) => List<Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional | AstThrow>>}
 */
const operandsOf = lazy => ast => {
    /** @type {_OperandStack} */
    let stack = { top: ast, rest: null }
    /** @type {List<Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional | AstThrow>>} */
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
            case '-': case '~': case 'throw': { stack = { top: node[1], rest }; break }
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
 * @type {(lazy: _Lazy) => (ast: Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional | AstThrow>) => List<_RefNode>}
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
        // before the read
        case '.': { return refsOf(lazy)(ast[1]) }
        // a function names what it captures, the enclosing scope's own
        // references, which it establishes when it is made — the captures
        // its body reads, since an unused alias of one names nothing
        case '=>': {
            const captures = ast[3]
            return captures === undefined ? empty : flat(readCaptures(ast).map(i => refsOf(lazy)(captures[i])))
        }
        // its arguments are its own
        case 'arg':
        case 'rest': { return empty }
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

/** @type {(ast: Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional>) => boolean} */
const operandReadsRest = ast => {
    if (ast === null || typeof ast !== 'object') { return false }
    switch (ast[0]) {
        case 'rest': { return true }
        case 'array': { return readsRest(ast[1].map(itemOperand)) }
        case 'object': { return readsRest(entryOperands(ast[1])) }
        case '()': { return readsRest([ast[1], ...ast[2].map(itemOperand)]) }
        case '.': { return readsRest([ast[1]]) }
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
 * import, a slot of its frame or the arguments is that node, not a node of
 * its own.
 *
 * @type {(ast: AstConst) => boolean}
 */
const isAlias = ast => ast !== null && typeof ast === 'object' && ['cref', 'aref', 'fref', 'rest', 'arg'].includes(ast[0])

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
 * themselves the same way, which the graph holds through them. `run`
 * evaluates every entry and `transpile` reads every import whether the
 * export reaches them or not, so a compiler that follows references alone
 * would drop what this names, and anchors it instead.
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
