/**
 * AST types and helpers for a parsed module.
 *
 * @module
 *
 * @import { Array, Unknown } from '../../media/datajs/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { AstAccess, AstArray, AstBinary, AstBitnot, AstCall, AstConditional, AstConst, AstBody, AstFunction, AstItem, AstMember, AstModule, AstModuleRef, AstNeg, AstObject, AstSpread, AstThrow, BinaryTag, Import, Sharing, Anchors } from './types.ts'
 * @import { _Key, _Node, _OperandStack, _Reach, _Ref, _RefNode, _Routes, _RunState, _View } from './private.ts'
 */

import { concat, empty, flat, last, map, take, toArray } from '../../types/list/module.f.mjs'
import { fromEntries } from '../../types/object/module.f.mjs'
import { error, mapOk, ok, okList, okThen } from '../../types/result/module.f.mjs'
import { cmp as stringCmp, concat as stringConcat } from '../../types/string/module.f.mjs'
import { leafSerialize } from '../../media/datajs/serializer/module.f.mjs'
import { at as routesAt, empty as noRoutes, setReplace } from '../../types/ordered_map/module.f.mjs'
import { lazyOp2Id } from '../../edag/module.f.mjs'
import { arrayIndex } from '../../js/array_index/module.f.mjs'

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
 * Whether an item is a spread, `['...', v]`, rather than a value.
 *
 * @type {(item: AstItem) => item is AstSpread}
 */
export const isSpread = item => item instanceof Array && item[0] === '...'

/** The node an item evaluates: itself, or a spread's operand. @type {(item: AstItem) => AstConst} */
export const itemOperand = item => isSpread(item) ? item[1] : item

/** Whether an item list holds a spread, so that its items' positions are no indices. @type {(items: readonly AstItem[]) => boolean} */
const holdsSpread = items => items.some(isSpread)

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

/** @type {(members: List<readonly [string, Unknown]>) => Unknown} */
const objectOf = members => fromEntries(members)

/** A member with its value evaluated, by the evaluator given first. @type {(evaluate: (ast: AstConst) => Result<Unknown, string>) => (member: AstMember) => Result<readonly [string, Unknown], string>} */
const memberValue = evaluate => ([key, value]) => mapOk(keyed(key))(evaluate(value))

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
        case 'object': { return mapOk(objectOf)(okList(ast[1].map(memberValue(toDjs(state))))) }
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
 * Which operands a node contributes is the view's where the views differ:
 * a negation's, and a lazy operator's conditionally established ones — the
 * right operand of `&&`/`||`/`??` and both arms of `?:` — where the left
 * operand and the condition, established whatever the value, are every
 * view's.
 *
 * @type {(view: _View) => (ast: AstConst) => List<Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional | AstThrow>>}
 */
const operandsOf = view => ast => {
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
            // one is the view's to count
            stack = { top: node[1], rest: isLazy(node[0]) ? pushedAll(view.lazy([node[2]]), rest) : { top: node[2], rest } }
            continue
        }
        switch (node[0]) {
            // the view's own read of a negation's operand — `written`'s is
            // one operand, `value`'s none, negation being a primitive
            case '-': { stack = pushedAll(view.negated(node[1]), rest); break }
            // a `throw`'s value is established whatever comes of it, in
            // every view: eager, as an operator's operand is
            case '~': case 'throw': { stack = { top: node[1], rest }; break }
            // the condition is established whatever it decides, as a lazy
            // operator's left operand is; the arms are the view's
            case '?:': { stack = { top: node[1], rest: pushedAll(view.lazy([node[2], node[3]]), rest) }; break }
            default: { bottom = concat(bottom)([node]); stack = rest }
        }
    }
    return bottom
}

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
const refsOf = view => ast => flat(map(refsOfOperand(view))(operandsOf(view)(ast)))

/**
 * One operand {@link operandsOf} bottomed out at: never itself an operator,
 * negation or bitwise not, so every branch here may recurse through
 * {@link refsOf} exactly as it always did — a container, a call, or an
 * access chain nests only as deep as the source that built it, which is a
 * separate, narrower concern than an operator chain's unbounded length.
 *
 * @type {(view: _View) => (ast: Exclude<AstConst, AstNeg | AstBitnot | AstBinary | AstConditional | AstThrow>) => List<_Ref>}
 */
const refsOfOperand = view => ast => {
    if (ast === null || typeof ast !== 'object') { return empty }
    switch (ast[0]) {
        case 'array': { return flat(ast[1].map(itemRefs(view))) }
        case 'object': { return flat(view.members(ast[1]).map(refsOf(view))) }
        // a call reaches its callee and every argument, each written where
        // it stands: what the call *returns* is not reachable from the
        // syntax at all, which is why a module holding one has no value —
        // except the call the lowering inlines, which is its body where the
        // call stands
        case '()': { return isInlinedCall(ast) ? inlinedRefs(view)(ast) : flat([ast[1], ...ast[2].map(itemOperand)].map(refsOf(view))) }
        // an access reaches what its key names inside its base: the base's
        // reference, one key deeper — once the view has read the access
        case '.': {
            const read = view.through(ast)
            return read !== null && typeof read === 'object' && read[0] === '.'
                ? map(deeper(`${read[2]}`))(refsOf(view)(read[1]))
                : refsOf(view)(read)
        }
        // a function names what it captures, the enclosing scope's own
        // references, which it establishes when it is made — the captures
        // its body reads, since an unused alias of one names nothing
        case '=>': {
            const captures = ast[3]
            return captures === undefined ? empty : flat(readCaptures(ast).map(i => refsOf(view)(captures[i])))
        }
        // its arguments are its own
        case 'arg':
        case 'rest': { return empty }
        // a slot of its frame is a reference too, one the sweep of the body
        // ignores and the sweep of a scope the body is inlined into follows
        // into the capture the slot holds ({@link inlinedRefs})
        default: { return [{ ref: ast, keys: [] }] }
    }
}

/**
 * The references an array's item makes: a value's own, and what a spread's
 * operand contributes as the view reads it, {@link _View}'s `spread`.
 *
 * @type {(view: _View) => (item: AstItem) => List<_Ref>}
 */
const itemRefs = view => item => isSpread(item) ? view.spread(refsOf(view), item[1]) : refsOf(view)(item)

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
        case 'object': { return readsRest(ast[1].map(([, v]) => v)) }
        case '()': { return readsRest([ast[1], ...ast[2].map(itemOperand)]) }
        case '.': { return readsRest([ast[1]]) }
        case '=>': { return readsRest(ast[3] ?? []) }
        default: { return false }
    }
}

/**
 * The references a body makes, read as `view` says: every entry of the
 * body is established — the value, and the ones the value does not reach,
 * which the lowering anchors — so each entry's references count, but a
 * bare alias's, which is the node it names and no code of its own, unless
 * the alias is the value. A reference to a body `const` is resolved to the
 * node it names, so a slot of the body's frame reached through an alias is
 * that slot.
 *
 * @type {(view: _View) => (body: AstBody) => List<_Ref>}
 */
const bodyRefs = view => body => {
    const nodes = body.reduce(nodeEntry([]), [])
    return map(resolved([], nodes))(flat(body.filter((e, i) => i === body.length - 1 || !isAlias(e)).map(refsOf(view))))
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
    toArray(bodyRefs(every)(body)).flatMap(({ ref }) => ref[0] === 'fref' ? [ref[1]] : []).filter((i, k, all) => all.indexOf(i) === k)

/**
 * The references a call the lowering inlines makes, read as `view` says:
 * the body's, {@link bodyRefs}, with a slot of the body's frame followed
 * into the capture it holds, one key deeper by the keys the reference
 * applied.
 *
 * @type {(view: _View) => (ast: AstCall) => List<_Ref>}
 */
const inlinedRefs = view => ([, callee]) => {
    const [, , body, captures = []] = /** @type {AstFunction} */ (callee)
    /** @type {(r: _Ref) => List<_Ref>} */
    const captured = ({ ref, keys }) => ref[0] === 'fref' ? map(deeperBy(keys))(refsOf(view)(captures[ref[1]])) : empty
    return flat(map(captured)(bodyRefs(view)(body)))
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

/** A reference by the node it reaches, aliases and imports resolved; a slot of the frame is its own node. @type {(imports: readonly unknown[], nodes: readonly _RefNode[]) => (r: _Ref) => _Ref} */
const resolved = (imports, nodes) => ({ ref, keys }) => ({
    ref: ref[0] === 'cref' ? nodes[ref[1]] : ref[0] === 'aref' ? importNode(imports)(ref[1]) : ref,
    keys,
})

/**
 * What an EDAG of the module anchors, by index: exactly the code the graph
 * would not otherwise hold — the body entries no chain of references from
 * the export leads to, and the imports likewise, read as the EDAG
 * establishes them, {@link written}, less what those entries reach
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
 * and not `d`. The sharing sweep reads the same syntax with every position
 * counted, {@link value}: identity does not care which position a
 * reference is made from, only anchoring does. The rule is
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
const valueAt = keys => value => keys.reduce(_own, value)

/** Whether a literal is a container literal — an array or an object written out — rather than a primitive or a reference. @type {(ast: AstConst) => ast is AstArray | AstObject} */
const isContainerLiteral = ast => ast !== null && typeof ast === 'object' && (ast[0] === 'array' || ast[0] === 'object')

/**
 * Whether a key selects inside a container literal: every object, and an
 * array holding no spread. A spread puts its operand's elements where it
 * stands, how many is known only once the operand is evaluated, so no key
 * names an item: such an array is read whole, every item it may select.
 *
 * @type {(ast: AstArray | AstObject) => boolean}
 */
const selectable = ast => ast[0] === 'object' || !holdsSpread(ast[1])

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
    // an array {@link selectable} holds no spread
    : /** @type {AstConst} */ (ast[1][arrayIndex(key) ?? ast[1].length])

/**
 * What an access denotes once the keys that select inside a literal are
 * applied, for the value's view: the literal's item the key names, through
 * a chain of accesses — `[[x, x], 0][0]` is `[x, x]` — and through an
 * access the item itself is, `[{ a: z }.a][0]` being `z`; `undefined`
 * where the literal has none or the base is a primitive; the whole
 * literal where no key selects inside it, {@link selectable}; and the
 * access itself where the chain reaches a reference, whose value the
 * syntax does not hold — an access on a reference, on an access on one,
 * and so on.
 *
 * @type {(ast: AstAccess) => AstConst}
 */
const selected = ast => {
    const base = selectedOf(ast[1])
    if (base === null || typeof base !== 'object') { return undefined }
    if (isContainerLiteral(base)) { return selectable(base) ? selectedOf(literalAt(base, `${ast[2]}`)) : base }
    /** @type {AstAccess} */
    const access = ['.', base, ast[2]]
    return access
}

/** A node as the value's view reads it: an access {@link selected}, anything else itself. @type {(ast: AstConst) => AstConst} */
const selectedOf = ast => ast !== null && typeof ast === 'object' && ast[0] === '.' ? selected(ast) : ast

/**
 * The syntax as the EDAG establishes it, unconditionally: every member
 * written, a literal whole before it is read, a negation's operand
 * followed — the graph holds it as a node of its own, so a `const` nothing
 * but a negation reaches is reached all the same — and a lazy operand
 * not: the EDAG establishes `a && b`'s `b` only when `a` is truthy, so a
 * reference there is no guarantee the `const` it names is evaluated, and
 * {@link anchors} reads through this view exactly so that such a `const`
 * keeps its anchor. A spread's operand is read as it stands: what it
 * establishes, not which of its parts the array holds.
 *
 * @type {_View}
 */
const written = { members: memberValuesWritten, through: ast => ast, negated: operand => [operand], lazy: () => [], spread: (refs, operand) => refs(operand) }

/**
 * The syntax as the value has it: the last member per key, of a literal
 * only what the key selects, of a negation nothing — `-x` is a number
 * or a bigint whatever `x` was, so the operand is consumed and no part of
 * it is in the value. `const a = []; export default [-a, -a];` is
 * `[-0, -0]`, two primitives and no node shared between them — and of a
 * lazy operator every operand, since the value is whichever of them the
 * operator selects: `[a && c, b && c]` may hold `c` twice, and the sweep
 * says shared where it cannot say otherwise — and of a spread its operand's
 * elements, the route of one `null` key, each element, walked into it: an
 * array literal's items as they stand, `[x, ...[x]]` holding `x` twice, and
 * a reference's elements one key deeper, which the evaluated value expands
 * ({@link elementKeys}).
 *
 * @type {_View}
 */
const value = { members: memberValues, through: selected, negated: () => [], lazy: operands => operands, spread: (_, operand) => refsAlong(operand, [null]) }

/**
 * The syntax as written, every position counted: what the written view
 * reads, the lazy operands included — for a question about what a body
 * names anywhere in it, {@link readsRest}, which neither establishing nor
 * selecting decides.
 *
 * @type {_View}
 */
const every = { ...written, lazy: operands => operands }

/** A reference with keys beyond its own: the rest of a route that ran into it. @type {(keys: readonly _Key[]) => (ref: _Ref) => _Ref} */
const deeperBy = keys => ({ ref, keys: own }) => ({ ref, keys: [...own, ...keys] })

/**
 * The references an entry makes along one route: the route walked into
 * the entry's literals as far as they go, and every reference in what the
 * walk ends at — the literal the route selects, when the route is spent,
 * or the reference the route ran into, with the rest of the route as its
 * keys, since what those keys select lies behind that reference, or the
 * literal it ran into whole, where no key selects inside it
 * ({@link selectable}); a primitive the route runs into holds no
 * reference at all. An entry that
 * is an access on a literal is walked as what it selects, so a route into
 * `{ a: [x, x] }.a` reaches the array and not `x` one key deeper.
 *
 * A `null` key, each element, walks every item of an array literal. The
 * literal is an array: a spread's operand that is an object throws, and
 * the sweep reads only a module that evaluated.
 *
 * @type {(ast: AstConst, route: readonly _Key[]) => List<_Ref>}
 */
const refsAlong = (ast, route) => {
    const read = selectedOf(ast)
    if (route.length === 0 || !isContainerLiteral(read)) { return map(deeperBy(route))(refsOf(value)(read)) }
    if (!selectable(read)) { return refsOf(value)(read) }
    const [key, ...rest] = route
    return key === null
        ? flat(/** @type {AstArray} */ (read)[1].map(item => refsAlong(/** @type {AstConst} */ (item), rest)))
        : refsAlong(literalAt(read, key), rest)
}

/** @type {(ast: AstConst) => (route: readonly _Key[]) => List<_Ref>} */
const refsAlongEntry = ast => route => refsAlong(ast, route)

/** One route as text, for telling routes apart: each key by its length, so no key runs into the next, and each element by `*`, which no length begins with. @type {(route: readonly _Key[]) => string} */
const routeText = route => route.map(key => key === null ? '*' : `${key.length}:${key}`).join('')

/**
 * The routes to walk of those by which an entry is reached: the whole
 * entry alone, when it is reached whole, since every other route lies
 * within it; and otherwise each route once.
 *
 * @type {(routes: List<readonly _Key[]>) => readonly (readonly _Key[])[]}
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
 * The nodes a reference reaches, when they are containers: the `const` by
 * its index or the module by its id, and the keys from there — one node,
 * or one per element where a key is each element, {@link elementKeys}. A
 * reference reaching a leaf reaches nothing two references can share, and
 * is left out.
 *
 * @type {(imports: readonly Import[], consts: readonly Unknown[]) => (ref: _Ref) => readonly _Node[]}
 */
const containerNode = (imports, consts) => ({ ref: [kind, i], keys }) => {
    const [group, value] = kind === 'cref' ? [`const ${i}`, consts[i]] : [moduleGroup(imports[i].id), imports[i].value]
    return elementKeys(keys)(value)
        .filter(k => isContainer(valueAt(k)(value)))
        .map(k => ({ group, keys: k, aref: kind === 'aref' ? i : null }))
}

/**
 * The keys a reference's keys name in `value`, now that it is evaluated:
 * themselves, where none is each element, and otherwise one route per
 * element of the array the first such key stands on, its index in that
 * key's place. A string's elements are its code points, each a string, so
 * none is a node, and nothing else is spread in a module that evaluated.
 *
 * @type {(keys: readonly _Key[]) => (value: Unknown) => readonly (readonly string[])[]}
 */
const elementKeys = keys => value => {
    const i = keys.indexOf(null)
    if (i === -1) { return [/** @type {readonly string[]} */ (keys)] }
    const prefix = /** @type {readonly string[]} */ (keys.slice(0, i))
    const at = valueAt(prefix)(value)
    const length = at instanceof Array ? at.length : 0
    return Array.from({ length }, (_, j) => [...prefix, `${j}`, ...keys.slice(i + 1)]).flatMap(k => elementKeys(k)(value))
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
    const bindings = imports.filter((_, i) => nodes.some(n => n.aref === i))
    const reached = [...new Map(bindings.map(byId)).values()]
    // Routes are relative to each selected export. Different roots from one
    // module may share descendants even when their relative keys differ.
    const overlapping = bindings.some(m => reached.some(n => m.id === n.id && m.value !== n.value))
    /** @type {readonly string[]} */
    const reaches = [...reached.map(m => m.id), ...reached.flatMap(m => m.reaches)]
    const shared = overlapping || sorted.some(withinPrevious(sorted)) || repeats(reaches) || reached.some(m => m.shared)
    return { shared, reaches: shared ? [] : reaches }
}
