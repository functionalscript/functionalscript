/**
 * Prepared FAST to Rust against the nanvm-lib API. Evaluation regions,
 * bindings, slots, memo lifetimes and transfers are fixed by common passes;
 * this module only spells those instructions and runtime operations.
 *
 * @module
 * @import { Block, Function as PreparedFunction, Memo, Statement, Value } from '../../js/ast/prepare/types.ts'
 * @import { BindingId, FunctionTarget, LoopTarget, Key, Step, Operator } from '../../js/ast/types.ts'
 * @import { Options, Printed, Scope, Use, Uses, External } from './types.ts'
 * @import { _Context, _Frame, _Names, _Output, _Task } from './private.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Stack } from '../../types/stack_walk/types.ts'
 */

import { f64Bits, i64Literal, stringLiteral, u64WordItems, utf16Units } from '../../media/rust/module.f.mjs'
import { indent } from '../../media/rust/item/module.f.js'
import { error, mapOk, ok, okList, okThen, unwrap } from '../../types/result/module.f.js'
import { intrinsicLength, isIntrinsic, isStatic, staticText } from '../../edag/module.f.mjs'
import { chunksText, tagged, untagged } from '../../text/marked/module.f.mjs'
import { _entryText, _hasEntryText, _intrinsicText } from '../../compiler/serializer/function_text/module.f.mjs'
import { _resolve } from '../../compiler/serializer/names/module.f.mjs'
import { pushAll, walk } from '../../types/stack_walk/module.f.js'
import { toArray as listToArray } from '../../types/list/alt/module.f.js'

const kw = tagged('keyword')

/** A literal word: `true`, `false`. */
const lit = tagged('literal')

/** A Rust string literal, with its quotes. */
const str = tagged('string')

/** A slice literal over hex items, `&[0x1, 0x2]`, each item a number. @type {(items: readonly string[]) => string} */
const slice = items => `&[${items.map(item => num(item)).join(', ')}]`

/** A number literal: an `f64`'s bits, an `i64`. */
const num = tagged('number')

/**
 * Text spelling no `nanvm_lib` name of its own.
 *
 * @type {<T>(text: T) => Printed<T>}
 */
const code = text => [text, []]

/** Import metadata is a set, so deep expressions do not copy repeated names. @type {(uses: readonly Use[]) => readonly Use[]} */
const uniqueUses = uses => [...new Map(uses.map(use => [`${use[0]}:${use[1]}`, use])).values()]

/**
 * A name of `nanvm_lib`'s `module`, spelled: its text is the name, and it
 * is the name's one use.
 *
 * @type {(module: Use[0]) => (name: string) => Printed<string>}
 */
const named = module => name => [name, [[module, name]]]

/** An item of `nanvm_lib::vm`, spelled. */
const vm = named('vm')

/** A helper of `nanvm_lib::vm::unstable`, spelled. */
const unstable = named('unstable')

/**
 * Pieces of text one after another, with every name any of them spells.
 *
 * @type {(parts: readonly (string | Printed<string>)[]) => Printed<string>}
 */
const cat = parts => {
    const printed = parts.map(p => typeof p === 'string' ? code(p) : p)
    return [printed.map(([text]) => text).join(''), uniqueUses(printed.flatMap(([, uses]) => uses))]
}

/**
 * A call of `vm`'s conversion trait `trait`'s method `method`, as the
 * suffix a receiver takes.
 *
 * @type {(method: string, trait: string) => Printed<string>}
 */
const conversion = (method, trait) => [`.${method}()`, [['vm', trait]]]

const toAny = conversion('to_any', 'ToAny')

const toArray = conversion('to_array', 'ToArray')

const toObject = conversion('to_object', 'ToObject')

/** `undefined`, the value an `args` read past the end answers too. */
const undefinedAny = cat([vm('Nullish'), '::Undefined', toAny])

/**
 * The `nanvm-lib` expression each unary operation prints as.
 *
 * @type {{ readonly [k in (Operator<Value>[0] | 'throw')]?: (a: string) => string | Printed<string> }}
 */
export const op1Rust = {
    '+': a => `Any::unary_plus(${a})`,
    '-': a => `<Any<A> as core::ops::Neg>::neg(${a})`,
    '!': a => `<Any<A> as core::ops::Not>::not(${a})`,
    '~': a => `Any::bitwise_not(${a})`,
    typeof: a => `Any::typeof_(${a})`,
    Number: a => `Any::number(${a})`,
    String: a => cat([`${a}.to_string().map(|v| v`, toAny, ')']),
    // The `Result` every operation answers, its `Err` arm: the thrown value
    // is the operand, and the enclosing `?` or function carries it out.
    throw: a => `Err(${a})`,
}

/**
 * The same, for the binary operations.
 *
 * An operator not yet implemented in `nanvm-lib` (such as `=>`) has every one
 * of its cases carry a `rust` reason in the corpus, and the test printer
 * comments the statement out rather than emit it — this entry only has to
 * read as the operation, not compile.
 *
 * Rust has no exponentiation operator, so `**` is printed as a call
 * (`Any::pow`) rather than an infix expression, following the
 * `Any::unary_plus` precedent for an operation with no Rust operator to
 * spell. The comparisons follow the same precedent for a different reason:
 * every operator here returns `Result<Any<A>, Any<A>>`, which a
 * `PartialOrd`-derived `<`/`<=`/`>`/`>=` on `Any<A>` would not give back.
 * `>>>` follows it for another reason: Rust has no unsigned-right-shift operator
 * at all (only `>>`, which is arithmetic on a signed type), so it is
 * `Any::unsigned_right_shift`.
 *
 * An entry that spells a `nanvm_lib` name answers it with its text, and
 * one that spells none answers the text alone.
 *
 * @type {{ readonly [k in (Operator<Value>[0] | 'throw')]?: (a: string, b: string) => string | Printed<string> }}
 */
export const op2Rust = {
    '*': (a, b) => `${a} * ${b}`,
    '/': (a, b) => `${a} / ${b}`,
    '**': (a, b) => `Any::pow(${a}, ${b})`,
    '-': (a, b) => `${a} - ${b}`,
    '+': (a, b) => `${a} + ${b}`,
    '%': (a, b) => `${a} % ${b}`,
    '&': (a, b) => `${a} & ${b}`,
    '|': (a, b) => `${a} | ${b}`,
    '^': (a, b) => `${a} ^ ${b}`,
    '<<': (a, b) => `${a} << ${b}`,
    '>>': (a, b) => `${a} >> ${b}`,
    '>>>': (a, b) => `Any::unsigned_right_shift(${a}, ${b})`,
    '<': (a, b) => `Any::lt(${a}, ${b})`,
    '<=': (a, b) => `Any::le(${a}, ${b})`,
    '>': (a, b) => `Any::gt(${a}, ${b})`,
    '>=': (a, b) => `Any::ge(${a}, ${b})`,
    // `==` on `Any` *is* JavaScript's `===`, but it yields a `bool` and so
    // pins neither operand's `A`; `nanvm_lib::vm::unstable`'s `strict_eq`
    // and `strict_ne` lift the answer into the `Result` every other
    // operator returns.
    '===': (a, b) => cat([unstable('strict_eq'), `(${a}, ${b})`]),
    '!==': (a, b) => cat([unstable('strict_ne'), `(${a}, ${b})`]),
}

/**
 * The same, for the one ternary operation (`?:`). Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 * Both arms arrive as Result-returning callables; `Any::conditional`
 * establishes the selected one.
 *
 * @type {{ readonly [k in (Operator<Value>[0] | 'throw')]?: (a: string, b: string, c: string) => string | Printed<string> }}
 */
export const op3Rust = {
    '?:': (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

/**
 * Admitted operation tags select their already established target spelling.
 * The serializer consumes prepared compiler IR; it does not readmit its schema.
 *
 * @template {string} K
 * @template T
 * @param {{ readonly [k in K]?: T }} table
 * @returns {(id: K) => Result<Printed<T>, readonly unknown[]>}
 */
const lookup = table => id => {
    return ok([/** @type {T} */ (table[id]), []])
}

/**
 * A printed value with `f` applied, its names kept.
 *
 * @type {<A, R>(f: (a: A) => R) => (ra: Result<Printed<A>, readonly unknown[]>) => Result<Printed<R>, readonly unknown[]>}
 */
const map1 = f => mapOk(([a, uses]) => [f(a), uses])

/**
 * Combines two printed values with `f`, short-circuiting on the first
 * `error` — the shape every multi-operand node below needs, since a
 * `nanvm-lib` call takes several already-printed pieces at once and any one
 * of them may be the refusal — and keeping the names both spell.
 *
 * @type {<A, B, R>(f: (a: A, b: B) => R) => (ra: Result<Printed<A>, readonly unknown[]>, rb: Result<Printed<B>, readonly unknown[]>) => Result<Printed<R>, readonly unknown[]>}
 */
const map2 = f => (ra, rb) => okThen(([a, ua]) => mapOk(([b, ub]) => /** @type {const} */ ([f(a, b), uniqueUses([...ua, ...ub])]))(rb))(ra)

/** The same, for three. @type {<A, B, C, R>(f: (a: A, b: B, c: C) => R) => (ra: Result<Printed<A>, readonly unknown[]>, rb: Result<Printed<B>, readonly unknown[]>, rc: Result<Printed<C>, readonly unknown[]>) => Result<Printed<R>, readonly unknown[]>} */
const map3 = f => (ra, rb, rc) => map2((a, [b, c]) => f(a, b, c))(ra, map2((b, c) => [b, c])(rb, rc))

/** The same, for four. @type {<A, B, C, D, R>(f: (a: A, b: B, c: C, d: D) => R) => (ra: Result<Printed<A>, readonly unknown[]>, rb: Result<Printed<B>, readonly unknown[]>, rc: Result<Printed<C>, readonly unknown[]>, rd: Result<Printed<D>, readonly unknown[]>) => Result<Printed<R>, readonly unknown[]>} */
const map4 = f => (ra, rb, rc, rd) => map2((a, [b, c, d]) => f(a, b, c, d))(ra, map3((b, c, d) => [b, c, d])(rb, rc, rd))

/**
 * Printed values as one list, with every name any of them spells, or the
 * first refusal.
 *
 * @template T
 * @param {readonly Result<Printed<T>, readonly unknown[]>[]} list
 * @returns {Result<Printed<readonly T[]>, readonly unknown[]>}
 */
const all = list => mapOk((/** @type {readonly Printed<T>[]} */ items) =>
    /** @type {const} */ ([items.map(([v]) => v), uniqueUses(items.flatMap(([, uses]) => uses))]))(okList(list))

/**
 * A printed value whose own value is printed text with names of its own,
 * as that text with both sets of names: what a piece built through
 * {@link cat} over printed operands answers.
 *
 * @type {(r: Result<Printed<string | Printed<string>>, readonly unknown[]>) => Result<Printed<string>, readonly unknown[]>}
 */
const flat = mapOk(([v, uses]) => {
    const [text, own] = typeof v === 'string' ? code(v) : v
    return [text, uniqueUses([...uses, ...own])]
})

/**
 * Printed text, with no name spelled.
 *
 * @type {(text: string) => Result<Printed<string>, readonly unknown[]>}
 */
const plain = text => ok(code(text))

const op1 = lookup(op1Rust)

const op2 = lookup(op2Rust)

const op3 = lookup(op3Rust)

/**
 * A call of the `vm::unstable` helper `name` building the string `v`:
 * `name("…")` over a Rust string literal, or, for a string no `&str` can
 * hold — one with a lone surrogate — `name_utf16(&[…])` over its UTF-16 code
 * units. Every string has a spelling, so none is refused.
 *
 * @type {(name: string) => (v: string) => Printed<string>}
 */
const stringCall = name => v => {
    const r = stringLiteral(v)
    return r[0] === 'ok' ? cat([unstable(name), `(${str(r[1])})`]) : cat([unstable(`${name}_utf16`), `(${slice(utf16Units(v))})`])
}

/**
 * Fixed argument `k` of the function being called, read from the `args`
 * parameter of the closure {@link closure} prints: `nanvm-lib`'s
 * `Array::argument`, `undefined` past the end of a short call, as
 * JavaScript binds a missing argument — one bounds check and one clone.
 *
 * @type {(k: number) => Printed<string>}
 */
const argRead = k => cat(['_args.argument(', num(`${k}`), ')'])

/**
 * A bigint through an i64 literal where it fits, or its sign and words.
 *
 * @type {(v: bigint) => Printed<string>}
 */
const bigintExpr = v => {
    const r = i64Literal(v)
    return r[0] === 'ok' ? cat([unstable('bigint_any'), `(${num(r[1])})`]) : cat([unstable('bigint_any_words'), `(${lit(`${v < 0n}`)}, ${slice(u64WordItems(v))})`])
}

/**
 * A number, as the `Any<A>` `f64_any` builds from its bits.
 *
 * @type {(v: number) => Printed<string>}
 */
const numberExpr = v => cat([unstable('f64_any'), `(${num(f64Bits(v))})`])

/** @type {(v: null | boolean | number | string | bigint | undefined) => Result<Printed<string>, readonly unknown[]>} */
const primitiveExpr = v => {
    if (v === undefined) { return ok(undefinedAny) }
    if (v === null) { return ok(cat([vm('Nullish'), '::Null', toAny])) }
    switch (typeof v) {
        case 'boolean': { return ok(cat([lit(`${v}`), toAny])) }
        case 'number': { return ok(numberExpr(v)) }
        case 'string': { return ok(stringCall('string_any')(v)) }
        case 'bigint': { return ok(bigintExpr(v)) }
        default: { throw ['not a primitive', v] }
    }
}

/**
 * An object key.
 *
 * An EDAG object key is an `exp` — one form for `a:`, `"a":`, and computed
 * `[exp]:` keys alike. A string literal is the `string_key` a property takes;
 * any other key converts before its property's value is evaluated.
 *
 * @type {(k: string) => Printed<string>}
 */
const literalKey = stringCall('string_key')

/**
 * A literal `.` index, as the `Any<A>` key `Any::dot` takes: a `number` or a
 * `string`, the two `Index` variants the read's own key type
 * (`number | string`) covers directly. The third, `['Number', exp]`, is an
 * operation, and the printer's own {@link index}.
 *
 * @type {(index: string | number) => Printed<string>}
 */
const literalIndex = index => typeof index === 'string' ? stringCall('string_any')(index) : numberExpr(index)

/** Stable local spelling by identity; underscore permits required unused values. @type {(s: _Context, id: BindingId) => string} */
const binding = (s, id) => /** @type {string} */ (/** @type {_Names} */ (s.names).bindings.get(id))

/** @type {(s: _Context, target: LoopTarget) => string} */
const loopLabel = (s, target) => /** @type {string} */ (/** @type {_Names} */ (s.names).loops.get(target))

/** A Rust block from target statement lines. @type {(parts: readonly string[]) => string} */
export const braced = parts => parts.length === 1 ? `{ ${parts[0]} }` : `{
${parts.flatMap(p => p.split('\n')).map(p => `${indent}${p}`).join('\n')}
}`

/** A target expression as a Result only where the parent needs one. @type {(result: boolean) => (v: string) => string} */
const pure = result => v => result ? `Ok(${v})` : v

/** An operation as its Result or the Any that successful evaluation supplies. @type {(result: boolean) => (v: string) => string} */
const fallible = result => v => result ? v : `(${v})?`

/** Pin the VM parameter even when a condition is only a primitive literal. @type {(value: string) => string} */
const truth = value => `Any::<A>::to_boolean(${value})`

/** Map's SameValueZero keys need a separate identity for IEEE negative zero. */
const negativeZero = {}

/** @type {(value: Value) => unknown} */
const valueKey = value => Object.is(value, -0) ? negativeZero : value

/** @type {(s: _Context, v: Value, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const expression = (s, v, result) => s.ready === undefined
    ? /** @type {Result<Printed<string>, readonly unknown[]>} */ (run({ kind: 'value', context: s, value: v, result }))
    : ok(/** @type {Printed<string>} */ (s.ready[result ? 1 : 0].get(valueKey(v))))

/** Immediate value spelling reads only its already completed children. @type {(s: _Context, v: Value, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const expressionReady = (s, v, result) => {
    if (!(v instanceof Array)) { return map1(pure(result))(primitiveExpr(v)) }
    switch (v[0]) {
        case 'ref': {
            const found = s.bindings.find(([id]) => id === v[1])
            return map1(pure(result))(ok(found === undefined ? code(`${binding(s, v[1])}.clone()`) : found[1]))
        }
        case 'demand': { return plain(fallible(result)(`${binding(s, v[1])}()`)) }
        case 'function': { return map1(pure(result))(closure(s, v[1])) }
        case 'block': {
            const b = v[1]
            if (b.statements.length === 0 && b.exit[0] === 'throw') {
                return map1(text => fallible(result)(`Err::<Any<A>, Any<A>>(${text})`))(expression(s, b.exit[1], false))
            }
            return b.statements.length === 0 && b.exit[0] === 'yield' && b.exit[1].length === 1
                ? expression(s, b.exit[1][0], result)
                : map1(parts => braced(parts))(block(s, b, result, false, true))
        }
        case 'if': {
            return flat(map3((/** @type {string} */ condition, /** @type {readonly string[]} */ yes, /** @type {readonly string[]} */ no) =>
                `${kw('if')} ${truth(condition)} ${braced(yes)} ${kw('else')} ${braced(no)}`)(
                expression(s, v[1], false), block(s, v[2], result, false, true), block(s, v[3], result, false, true)))
        }
        default: { return operation(s, v, result) }
    }
}

/** Resolve helper presentation symbols without introducing graph inspection. @type {(text: string) => string} */
const helperText = text => chunksText(_resolve([text], [], []))

/** Rust representation text for a callable. @type {(text: string) => string} */
const represented = text => `Some(${str(unwrap(stringLiteral(text)))})`

/** One callable's explicit invocation environment. @type {(s: _Context, fn: PreparedFunction) => _Context} */
const closureContext = (s, fn) => {
    const held = s.runtime === null ? null : `A::frame(_self)[${num(`${fn.captures.length}`)}]`
    const bindings = [
        ...fn.parameters.map((id, i) => /** @type {const} */ ([id, argRead(i)])),
        ...fn.captures.map((c, i) => /** @type {const} */ ([c.binding, code(`A::frame(_self)[${num(`${i}`)}].clone()`)])),
        ...(fn.self === null ? [] : [/** @type {const} */ ([fn.self, cat([vm('Function'), '::new(_self.clone())', toAny])])]),
    ]
    return { ...s, runtime: held, bindings }
}

/** @type {(s: _Context, fn: PreparedFunction) => Result<Printed<string>, readonly unknown[]>} */
const closure = (s, fn) => {
    const captured = fn.captures.map(c => expression(s, c.value, false))
    const values = s.runtime === null ? captured : [...captured, plain(`${s.runtime}.clone()`)]
    const inner = closureContext(s, fn)
    const rest = fn.rest === null ? [] : [`${kw('let')} ${binding(s, fn.rest)}: Any<A> = _args.rest(${num(`${fn.parameters.length}`)}).to_any();`]
    return flat(map2((/** @type {readonly string[]} */ captures, /** @type {readonly string[]} */ body) => cat([
        `A::static_function(|_self, _args| ${braced([...rest, ...body])}, ${num(`${fn.parameters.length}`)}, `,
        captures.length === 0 ? cat([vm('Array'), '::default()']) : cat([`[${captures.join(', ')}]`, toArray]),
        `, ${represented(s.text(fn))})`, toAny,
    ]))(all(values), block(inner, fn.body, true, true)))
}

/** An array's/call's prepared operands, each retained in its selected region. @type {(s: _Context, values: readonly (Value | readonly ['...', Value])[], result?: boolean) => Result<Printed<string>, readonly unknown[]>} */
const array = (s, values, result = false) => {
    if (values.some(v => v instanceof Array && v[0] === '...')) {
        return flat(map1((/** @type {readonly string[]} */ items) => cat([fallible(result)(`${unstable('spread_array')[0]}([${items.join(', ')}])`), ['', unstable('spread_array')[1]]]))(all(values.map(v =>
            v instanceof Array && v[0] === '...'
                ? flat(map1(x => cat([unstable('spread_item'), `(${x})?`]))(expression(s, v[1], false)))
                : flat(map1(x => cat([unstable('value_item'), `(${x})`]))(expression(s, /** @type {Value} */ (v), false)))))))
    }
    return map1(pure(result))(values.length === 0 ? ok(cat([vm('Array'), '::default()', toAny]))
        : flat(map1((/** @type {readonly string[]} */ items) => cat([`[${items.join(', ')}]`, toArray, toAny]))(all(values.map(v => expression(s, /** @type {Value} */ (v), false))))))
}

/** @type {(s: _Context, entries: readonly (readonly [':', Value, Value] | readonly ['...', Value])[]) => Result<Printed<string>, readonly unknown[]>} */
const object = (s, entries) => {
    if (entries.length === 0) { return ok(cat([vm('Object'), '::default()', toAny])) }
    const spread = entries.some(e => e[0] === '...' || typeof e[1] !== 'string')
    const members = entries.map(e => e[0] === '...'
        ? flat(map1(v => cat([unstable('spread_entries'), `(${v})`]))(expression(s, e[1], false)))
        : typeof e[1] === 'string'
            ? flat(map1(v => cat([spread ? unstable('property_item') : code(''), '(', literalKey(/** @type {string} */ (e[1])), `, ${v})`]))(expression(s, e[2], false)))
            : flat(map2((k, v) => cat([unstable('property_item'), `((${k}).to_string()?, ${v})`]))(expression(s, e[1], false), expression(s, e[2], false))))
    return flat(map1((/** @type {readonly string[]} */ items) => spread
        ? cat([unstable('spread_object'), `([${items.join(', ')}])`])
        : cat([`[${items.join(', ')}]`, toObject, toAny]))(all(members)))
}

/** @type {(s: _Context, k: Key<Value>) => Result<Printed<string>, readonly unknown[]>} */
const key = (s, k) => typeof k === 'string' || typeof k === 'number' ? ok(literalIndex(k)) : expression(s, k, false)

/** Peel value-only regions without consuming the host stack. @type {(v: Value) => Value} */
const thunkValue = v => {
    let current = v
    while (current instanceof Array && current[0] === 'block' && current[1].statements.length === 0 && current[1].exit[0] === 'yield' && current[1].exit[1].length === 1) {
        current = current[1].exit[1][0]
    }
    return current
}

/** A lazy demand reuses its callable; other operands return a Result. @type {(s: _Context, v: Value) => Result<Printed<string>, readonly unknown[]>} */
const thunk = (s, v) => {
    const value = thunkValue(v)
    return value instanceof Array && value[0] === 'demand' ? plain(binding(s, value[1])) : map1(text => `|| ${text}`)(expression(s, value, true))
}

/** Rust requires grouping a block or conditional on an infix left operand or method receiver. @type {(s: _Context, v: Value) => Result<Printed<string>, readonly unknown[]>} */
const grouped = (s, v) => {
    const value = thunkValue(v)
    const needsGroup = value instanceof Array && (value[0] === 'if' || value[0] === 'block' || value[0] === ',')
    return map1(text => needsGroup ? `(${text})` : text)(expression(s, v, false))
}

/** @type {(s: _Context, k: Key<Value>) => Result<Printed<string>, readonly unknown[]>} */
const keyThunk = (s, k) => map1(text => `|| Ok(${text})`)(key(s, k))

/** @type {(s: _Context, values: readonly (Value | readonly ['...', Value])[]) => Result<Printed<string>, readonly unknown[]>} */
const argumentThunk = (s, values) => map1(text => `|| ${text}`)(array(s, values, true))

/** Member/call continuation spelling follows its already resolved chain scope. @type {(s: _Context, step: Step<Value> | undefined, property: boolean, member: boolean) => Result<Printed<string>, readonly unknown[]>} */
const steps = (s, step, property, member) => ok(/** @type {Printed<string>} */ (/** @type {NonNullable<_Context['ready']>} */ (s.ready)[11 + (property ? 1 : 0) + (member ? 2 : 0)].get(step)))

/** @type {(s: _Context, step: Step<Value> | undefined, property: boolean, member: boolean) => Result<Printed<string>, readonly unknown[]>} */
const stepsReady = (s, step, property, member) => {
    if (step === undefined) { return plain('.end()') }
    if (step[0] === '|.') {
        return map2((k, rest) => `.dot(${k})${rest}`)(keyThunk(s, step[1]), steps(s, step[2], false, true))
    }
    if (member && s.runtime === null) { return error(['a member call with no runtime in scope; the core may not use what it defines', step]) }
    const terminal = step[0] === '|!()' || (step[0] === '|()' && property)
    const method = terminal ? 'end_call' : step[0] === '|()' ? 'call' : 'option_call'
    return map2((args, rest) => `.${method}(${member ? `&${s.runtime}, ` : ''}${args})${rest}`)(
        argumentThunk(s, step[1]), terminal ? plain('') : steps(s, step[2], false, false))
}

/** The target's runtime operation spelling; no placement or graph walk occurs here. @type {(s: _Context, n: Operator<Value>, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const operation = (s, n, result) => {
    const tag = n[0]
    if (isStatic([tag])) {
        if (s.runtime !== null) { return map1(fallible(result))(ok(cat([unstable('static_read'), `(&${s.runtime}, ${str(unwrap(stringLiteral(tag)))})`]))) }
        if (tag !== 'Object.entries') { return error(['a static function read with no runtime in scope; the core may not use what it defines', tag]) }
        return map1(pure(result))(ok(cat(['A::static_function(|_self, _args| Any::entries(', argRead(0), '), ', num('1'), ', ', vm('Array'), `::default(), ${represented(staticText('Object.entries'))})`, toAny])))
    }
    if (tag === 'entry' || tag === 'hasEntry') {
        const text = helperText(tag === 'entry' ? _entryText('helper') : _hasEntryText('helper'))
        return map1(pure(result))(ok(cat(['A::static_function(|_self, _args| ', tag === 'entry' ? 'Any::entry(' : 'Any::has_entry(', argRead(0), ', ', argRead(1), tag === 'entry' ? ')' : ').map(|v| v.to_any())', ', ', num('2'), ', ', vm('Array'), `::default(), ${represented(text)})`, toAny])))
    }
    if (isIntrinsic([tag])) {
        const id = /** @type {import('../../edag/types.ts').IntrinsicId} */ (tag)
        const length = intrinsicLength(id)
        const args = Array.from({ length: length - 1 }, (_, k) => argRead(k + 1))
        return map1(pure(result))(ok(cat(['A::static_function(|_self, _args| Any::dot(', argRead(0), ', ', stringCall('string_any')(id), ').end_call_native(|| Ok([', ...args.flatMap((x, k) => k === 0 ? [x] : [', ', x]), ']', toArray, toAny, ')), ', num(`${length}`), ', ', vm('Array'), `::default(), ${represented(helperText(_intrinsicText(id)('helper')))})`, toAny])))
    }
    switch (tag) {
        case 'array': { return array(s, n[1], result) }
        case 'object': { return map1(pure(result))(object(s, n[1])) }
        case '()': { return map1(fallible(result))(map2((fn, args) => `Any::call(${fn}, ${args})`)(expression(s, n[1], false), array(s, n[2]))) }
        case 'memberPresent': {
            if (s.runtime === null) { return error(['a member presence query with no runtime in scope; the core may not use what it defines', n]) }
            return map1(fallible(result))(map2((v, k) => `Any::member_present(${v}, ${k}, &${s.runtime})`)(expression(s, n[1], false), key(s, n[2])))
        }
        case '.': case '?.': case '?.()': {
            const open = tag === '.' ? map2((v, k) => `Any::dot(${v}, ${k})`)(expression(s, n[1], false), key(s, /** @type {Key<Value>} */ (n[2])))
                : tag === '?.' ? map2((v, k) => `Any::option_dot(${v}, ${k})`)(expression(s, n[1], false), keyThunk(s, /** @type {Key<Value>} */ (n[2])))
                : map2((v, args) => `Any::option_call(${v}, ${args})`)(expression(s, n[1], false), argumentThunk(s, /** @type {readonly (Value | readonly ['...', Value])[]} */ (n[2])))
            return map1(fallible(result))(map2((start, rest) => `${start}${rest}`)(open, steps(s, /** @type {Step<Value> | undefined} */ (n[3]), tag === '.', tag !== '?.()')))
        }
        case 'instanceof': { return map1(fallible(result))(flat(map1(v => cat([`Any::instanceof_(${v}, `, vm('Constructor'), `::${n[2]})`]))(expression(s, n[1], false)))) }
        // the naive spelling: the runtime's `in` body called with the key
        // and the value, which a VM may substitute natively (DESIGN.md §13)
        case 'in': {
            if (s.runtime === null) { return error(['an in operator with no runtime in scope; the core may not use what it defines', n]) }
            return map1(fallible(result))(flat(map1(v => cat([`Any::call((Any::dot(${s.runtime}.clone(), `, stringCall('string_any')('in'), ').end())?, [', stringCall('string_any')(n[1]), `, ${v}]`, toArray, toAny, ')']))(expression(s, n[2], false))))
        }
        case ',': {
            const values = n[1]
            return values.length === 0 ? map1(pure(result))(primitiveExpr(undefined))
                : map2((/** @type {readonly string[]} */ before, /** @type {string} */ last) => `{ ${before.map(text => `${text}; `).join('')}${last} }`)(all(values.slice(0, -1).map(v => expression(s, v, false))), expression(s, values[values.length - 1], result))
        }
        default: {
            const lazy = tag === '?:'
            const infix = n.length === 3 && ['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'].includes(tag)
            const eager = (/** @type {Value} */ v) => infix || tag === 'String' ? grouped(s, v) : expression(s, v, false)
            const rest = (/** @type {Value} */ v) => lazy ? thunk(s, v) : eager(v)
            return map1(fallible(result))(flat(n.length === 2 ? map2((fn, v) => fn(v))(op1(tag), eager(n[1]))
                : n.length === 3 ? map3((fn, a, b) => fn(a, b))(op2(tag), eager(n[1]), rest(n[2]))
                    : map4((fn, a, b, c) => fn(a, b, c))(op3(tag), expression(s, n[1], false), rest(n[2]), rest(n[3]))))
        }
    }
}

/** Borrowed trait objects keep memo dependency diamonds out of closure types. @type {(s: _Context, m: Memo) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const memo = (s, m) => map1((/** @type {readonly string[]} */ body) => [
    `${kw('let')} ${binding(s, m.valueSlot)} = std::cell::RefCell::new(None::<Any<A>>);`,
    `${kw('let')} ${binding(s, m.binding)}: &${kw('dyn')} Fn() -> Result<Any<A>, Any<A>> = &|| -> Result<Any<A>, Any<A>> ${braced([
        `${kw('if')} ${kw('let')} Some(value) = ${binding(s, m.valueSlot)}.borrow().as_ref() { ${kw('return')} Ok(value.clone()); }`,
        `${kw('let')} value: Any<A> = ${braced(body)};`,
        `*${binding(s, m.valueSlot)}.borrow_mut() = Some(value.clone());`,
        'Ok(value)',
    ])};`,
])(block(s, m.initializer, false, false, true))

/** A prepared instruction has exactly one Rust spelling. @type {(s: _Context, st: Statement) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const statement = (s, st) => ok(/** @type {Printed<readonly string[]>} */ (/** @type {NonNullable<_Context['ready']>} */ (s.ready)[10].get(st)))

/** @type {(s: _Context, st: Statement) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const statementReady = (s, st) => {
    switch (st[0]) {
        case 'define': case 'slot': { return map1(text => [text])(declaration(binding(s, st[1]), st[0] === 'slot' && st[3], expression(s, st[2], false))) }
        case 'write': { return map1(text => [`${binding(s, st[1])} = ${text};`])(expression(s, st[2], false)) }
        case 'memo': { return memo(s, st[1]) }
        case 'block': { return map1(parts => [braced(parts)])(block(s, st[1], false)) }
        case 'if': { return map3((condition, yes, no) => [`${kw('if')} ${truth(condition)} ${braced(yes)} ${kw('else')} ${braced(no)}`])(expression(s, st[1], false), block(s, st[2], false), block(s, st[3], false)) }
        case 'loop': { return map1(parts => [`'${loopLabel(s, st[1])}: ${kw('loop')} ${braced(parts)}`])(block(s, st[2], false)) }
        // `'while'`, the one statement left: `children` refuses any other
        default: {
            const w = st[1]
            return map3((initial, condition, body) => [
                `${kw('let')} ${w.mutable ? `${kw('mut')} ` : ''}${binding(s, w.slot)}: Any<A> = ${initial};`,
                `'${loopLabel(s, w.target)}: ${kw('while')} ${truth(condition)} ${braced(body)}`,
                `${kw('let')} ${binding(s, w.result)}: Any<A> = ${binding(s, w.slot)};`,
            ])(expression(s, w.initial, false), expression(s, w.condition, false), block(s, w.body, false))
        }
    }
}

/** One binding spelling for compiler temporaries and corpus-supplied names. @type {(name: string, mutable: boolean, value: Result<Printed<string>, readonly unknown[]>) => Result<Printed<string>, readonly unknown[]>} */
const declaration = (name, mutable, value) => map1(text => `${kw('let')} ${mutable ? `${kw('mut')} ` : ''}${name}: Any<A> = ${text};`)(value)

/** Final value regions share one lexical Rust block; resolved names need no nested braces. @type {(b: Block) => Block} */
const flattened = b => {
    let current = b
    /** @type {FunctionTarget | null} */
    let target = null
    /** @type {List<readonly Statement[]>} */
    let groups = null
    while (true) {
        groups = { first: current.statements, tail: groups }
        const exit = current.exit
        if (exit[0] === 'return') { target = exit[1] }
        const value = exit[0] === 'return' ? exit[2] : exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : undefined
        if (value instanceof Array && value[0] === 'block') {
            current = value[1]
            continue
        }
        return {
            statements: listToArray(groups).toReversed().flat(),
            exit: target !== null && exit[0] === 'yield' && exit[1].length === 1 ? ['return', target, exit[1][0]] : exit,
        }
    }
}

/** Block transfers use the targets already selected by preparation. @type {(s: _Context, b: Block, result: boolean, functionBody?: boolean, valueBlock?: boolean) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const block = (s, b, result, functionBody = false, valueBlock = false) => s.ready === undefined
    ? /** @type {Result<Printed<readonly string[]>, readonly unknown[]>} */ (run({ kind: 'block', context: s, block: b, result, functionBody, valueBlock }))
    : ok(/** @type {Printed<readonly string[]>} */ (s.ready[2 + (result ? 1 : 0) + (functionBody ? 2 : 0) + (valueBlock ? 4 : 0)].get(b)))

/** @type {(s: _Context, b: Block, result: boolean, functionBody: boolean, valueBlock: boolean) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const blockReady = (s, b, result, functionBody, valueBlock) => {
    const region = flattened(b)
    const exit = region.exit
    /** @type {Result<Printed<readonly string[]>, readonly unknown[]>} */
    const end = exit[0] === 'yield'
        ? exit[1].length === 0 ? ok(code([])) : map1(text => [text])(expression(s, exit[1][0], result))
        : exit[0] === 'continue' || exit[0] === 'break' ? ok(code([`${kw(exit[0])} '${loopLabel(s, exit[1])};`]))
            : exit[0] === 'throw' ? map1(text => [result ? `Err(${text})` : valueBlock ? `(Err::<Any<A>, Any<A>>(${text}))?` : `${kw('return')} Err(${text});`])(expression(s, exit[1], false))
                : map1(text => [functionBody ? text : `${kw('return')} ${text};`])(expression(s, exit[2], true))
    return map2((parts, last) => [...parts.flat(), ...last])(all(region.statements.map(st => statement(s, st))), end)
}

/** One value spelling request in a selected invocation context. @type {(context: _Context, value: Value, result?: boolean) => _Task} */
const valueTask = (context, value, result = false) => ({ kind: 'value', context, value, result })

/** One region spelling request, retaining its transfer context. @type {(context: _Context, b: Block, result?: boolean, functionBody?: boolean, valueBlock?: boolean) => _Task} */
const blockTask = (context, b, result = false, functionBody = false, valueBlock = false) => ({ kind: 'block', context, block: b, result, functionBody, valueBlock })

/** @type {(context: _Context, step: Step<Value> | undefined, property: boolean, member: boolean) => _Task} */
const stepTask = (context, step, property, member) => ({ kind: 'steps', context, step, property, member })

/** @type {(context: _Context, values: readonly (Value | readonly ['...', Value])[]) => readonly _Task[]} */
const itemTasks = (context, values) => values.map(v => valueTask(context, v instanceof Array && v[0] === '...' ? v[1] : /** @type {Value} */ (v)))

/** @type {(context: _Context, k: Key<Value>) => readonly _Task[]} */
const keyTasks = (context, k) => typeof k === 'string' || typeof k === 'number' ? [] : [valueTask(context, k)]

/** A demanded memo already supplies a callable, rather than a thunk body. @type {(context: _Context, v: Value) => readonly _Task[]} */
const thunkTasks = (context, v) => {
    const value = thunkValue(v)
    return value instanceof Array && value[0] === 'demand' ? [] : [valueTask(context, value, true)]
}

/** Immediate requests keep continuations on the explicit work stack. @type {(context: _Context, n: Operator<Value>, result: boolean) => readonly _Task[]} */
const operationTasks = (context, n, result) => {
    if (n.length === 1) { return [] }
    switch (n[0]) {
        case 'array': { return itemTasks(context, n[1]) }
        case 'object': { return n[1].flatMap(e => e[0] === '...' ? [valueTask(context, e[1])] : [...(typeof e[1] === 'string' ? [] : [valueTask(context, e[1])]), valueTask(context, e[2])]) }
        case '()': { return [valueTask(context, n[1]), ...itemTasks(context, n[2])] }
        case 'memberPresent': { return [valueTask(context, n[1]), ...keyTasks(context, n[2])] }
        case '.': case '?.': { return [valueTask(context, n[1]), ...keyTasks(context, n[2]), stepTask(context, /** @type {Step<Value> | undefined} */ (n[3]), n[0] === '.', true)] }
        case '?.()': { return [valueTask(context, n[1]), ...itemTasks(context, n[2]), stepTask(context, /** @type {Step<Value> | undefined} */ (n[3]), false, false)] }
        case 'instanceof': { return [valueTask(context, n[1])] }
        case 'in': { return [valueTask(context, n[2])] }
        case ',': { return n[1].map((v, i) => valueTask(context, v, i === n[1].length - 1 && result)) }
        case '?:': { return [valueTask(context, n[1]), ...thunkTasks(context, n[2]), ...thunkTasks(context, n[3])] }
        default: { return n.length === 2 ? [valueTask(context, n[1])] : [valueTask(context, n[1]), valueTask(context, n[2])] }
    }
}

/** Every dependency is target spelling, with no binding or placement decisions. @type {(task: _Task) => readonly _Task[]} */
const children = task => {
    const s = task.context
    switch (task.kind) {
        case 'value': {
            const v = task.value
            if (!(v instanceof Array)) { return [] }
            switch (v[0]) {
                case 'ref': case 'demand': { return [] }
                case 'function': { return [...v[1].captures.map(c => valueTask(s, c.value)), blockTask(closureContext(s, v[1]), v[1].body, true, true)] }
                case 'block': {
                    const b = v[1]
                    if (b.statements.length === 0 && b.exit[0] === 'throw') { return [valueTask(s, b.exit[1])] }
                    return b.statements.length === 0 && b.exit[0] === 'yield' && b.exit[1].length === 1
                        ? [valueTask(s, b.exit[1][0], task.result)] : [blockTask(s, b, task.result, false, true)]
                }
                case 'if': { return [valueTask(s, v[1]), blockTask(s, v[2], task.result, false, true), blockTask(s, v[3], task.result, false, true)] }
                default: { return operationTasks(s, v, task.result) }
            }
        }
        case 'block': {
            const region = flattened(task.block)
            const exit = region.exit
            const end = exit[0] === 'yield' ? exit[1].length === 0 ? [] : [valueTask(s, exit[1][0], task.result)]
                : exit[0] === 'return' ? [valueTask(s, exit[2], true)]
                    : exit[0] === 'throw' ? [valueTask(s, exit[1])] : []
            return [...region.statements.map(statement => /** @type {_Task} */ ({ kind: 'statement', context: s, statement })), ...end]
        }
        case 'statement': {
            const st = task.statement
            switch (st[0]) {
                case 'define': case 'slot': case 'write': { return [valueTask(s, st[2])] }
                case 'memo': { return [blockTask(s, st[1].initializer, false, false, true)] }
                case 'block': { return [blockTask(s, st[1])] }
                case 'if': { return [valueTask(s, st[1]), blockTask(s, st[2]), blockTask(s, st[3])] }
                case 'loop': { return [blockTask(s, st[2])] }
                case 'while': { return [valueTask(s, st[1].initial), valueTask(s, st[1].condition), blockTask(s, st[1].body)] }
                default: { throw ['not a statement', st] }
            }
        }
        // `'steps'`, the one kind left: every task is built in this module
        default: {
            const step = task.step
            if (step === undefined) { return [] }
            if (step[0] === '|.') { return [...keyTasks(s, step[1]), stepTask(s, step[2], false, true)] }
            if (task.member && s.runtime === null) { return [] }
            const terminal = step[0] === '|!()' || (step[0] === '|()' && task.property)
            return [...itemTasks(s, step[1]), ...(terminal ? [] : [stepTask(s, step[2], false, false)])]
        }
    }
}

/** A small fixed cache separates the spelling modes for the same child identity. @type {(task: _Task) => number} */
const taskKind = task => task.kind === 'value' ? task.result ? 1 : 0
    : task.kind === 'block' ? 2 + (task.result ? 1 : 0) + (task.functionBody ? 2 : 0) + (task.valueBlock ? 4 : 0)
        : task.kind === 'statement' ? 10 : 11 + (task.property ? 1 : 0) + (task.member ? 2 : 0)

/** @type {(task: _Task) => unknown} */
const taskInput = task => task.kind === 'value' ? valueKey(task.value) : task.kind === 'block' ? task.block : task.kind === 'statement' ? task.statement : task.step

/** Render one completed frame using only local child lookups. @type {(task: _Task, dependencies: readonly _Task[], values: readonly _Output[]) => Result<_Output, readonly unknown[]>} */
const completed = (task, dependencies, values) => {
    const ready = Array.from({ length: 15 }, (_, kind) => new Map(dependencies.flatMap((child, i) => taskKind(child) === kind ? [/** @type {const} */ ([taskInput(child), values[i]])] : [])))
    const s = { ...task.context, ready }
    switch (task.kind) {
        case 'value': { return expressionReady(s, task.value, task.result) }
        case 'block': { return blockReady(s, task.block, task.result, task.functionBody, task.valueBlock) }
        case 'statement': { return statementReady(s, task.statement) }
        // `'steps'`, the one kind left: every task is built in this module
        default: { return stepsReady(s, task.step, task.property, task.member) }
    }
}

/** The walk owns depth; each suspended frame holds only its immediate children. @type {(task: _Task) => Result<_Output, readonly unknown[]>} */
const spellingWalk = walk({
    enter: (/** @type {_Task} */ task) => {
        const dependencies = children(task)
        return dependencies.length === 0 ? completed(task, [], []) : ['push', { task, children: dependencies, index: 0, values: null }, dependencies[0]]
    },
    resume: (/** @type {_Frame} */ frame, /** @type {_Output} */ value) => {
        const values = { first: value, tail: frame.values }
        const index = frame.index + 1
        return index === frame.children.length
            ? completed(frame.task, frame.children, listToArray(values).toReversed())
            : ['push', { ...frame, index, values }, frame.children[index]]
    },
})

/** Identities in one instruction, including hidden storage and invocation names. @type {(task: _Task) => readonly BindingId[]} */
const instructionBindings = task => {
    if (task.kind === 'value') {
        const value = task.value
        if (!(value instanceof Array)) { return [] }
        if (value[0] === 'ref' || value[0] === 'demand') { return [value[1]] }
        if (value[0] !== 'function') { return [] }
        const fn = value[1]
        return [...fn.parameters, ...[fn.rest, fn.self].flatMap(id => id === null ? [] : [id]), ...fn.captures.map(c => c.binding)]
    }
    if (task.kind !== 'statement') { return [] }
    const st = task.statement
    switch (st[0]) {
        case 'define': case 'slot': case 'write': { return [st[1]] }
        case 'memo': { return [st[1].binding, st[1].valueSlot, st[1].doneSlot] }
        case 'while': { return [st[1].slot, st[1].result] }
        default: { return [] }
    }
}

/** @type {(task: _Task) => readonly LoopTarget[]} */
const instructionLoops = task => {
    if (task.kind === 'statement') {
        const st = task.statement
        return st[0] === 'loop' ? [st[1]] : st[0] === 'while' ? [st[1].target] : []
    }
    if (task.kind !== 'block') { return [] }
    const exit = flattened(task.block).exit
    return exit[0] === 'continue' || exit[0] === 'break' ? [exit[1]] : []
}

/** Debug indices keep familiar spellings; equal indices never alias identities. @type {<T extends { readonly index: number }>(ids: readonly T[], prefix: string) => ReadonlyMap<T, string>} */
const identityNames = (ids, prefix) => {
    const first = new Map(ids.toReversed().map(id => [id.index, id]))
    return new Map(ids.map((id, ordinal) => {
        const safe = Number.isSafeInteger(id.index) && id.index >= 0
        const base = safe ? `${prefix}${id.index}` : `${prefix}v${ordinal}`
        return [id, safe && first.get(id.index) !== id ? `${base}_${ordinal}` : base]
    }))
}

/** Target naming walks the prepared instructions, never the source graph. @type {(root: _Task) => _Names} */
const namesOf = root => {
    /** @type {Stack<_Task>} */
    let pending = { top: root, rest: null }
    /** @type {List<readonly BindingId[]>} */
    let bindings = null
    /** @type {List<readonly LoopTarget[]>} */
    let loops = null
    while (pending !== null) {
        /** @type {NonNullable<Stack<_Task>>} */
        const { top, rest } = pending
        bindings = { first: instructionBindings(top), tail: bindings }
        loops = { first: instructionLoops(top), tail: loops }
        pending = pushAll(children(top), rest)
    }
    return {
        bindings: identityNames([...new Set(listToArray(bindings).toReversed().flat())], '_b'),
        loops: identityNames([...new Set(listToArray(loops).toReversed().flat())], '_loop'),
    }
}

/** Allocate target names once, then render through the explicit spelling stack. @type {(root: _Task) => Result<_Output, readonly unknown[]>} */
const run = root => spellingWalk({ ...root, context: { ...root.context, names: namesOf(root) } })

/** Names used by the generated Rust text. @type {(uses: readonly Use[]) => Uses} */
const names = uses => ({
    vm: [...new Set(uses.filter(([m]) => m === 'vm').map(([, n]) => n))].toSorted(),
    unstable: [...new Set(uses.filter(([m]) => m === 'unstable').map(([, n]) => n))].toSorted(),
})

/** A prepared module/function body, retaining tagged text and import metadata. @type {(b: Block, options: Options, external?: readonly External[]) => Result<Scope, readonly unknown[]>} */
export const scopeTagged = (b, options, external = []) => mapOk((/** @type {Printed<readonly string[]>} */ [parts, uses]) => ({ lines: parts.flatMap(p => p.split('\n')), uses: names(uses) }))(block({ ...options, bindings: external.map(e => [e.binding, [e.text, e.uses ?? []]]) }, b, true))

/** The same prepared body as plain text. @type {(b: Block, options: Options, external?: readonly External[]) => Result<Scope, readonly unknown[]>} */
export const scope = (b, options, external = []) => mapOk(({ lines, uses }) => ({ lines: lines.map(untagged), uses }))(scopeTagged(b, options, external))

/** A prepared value, over externally established immutable bindings. @type {(v: Value, options: Options, external?: readonly External[], result?: boolean) => Result<Printed<string>, readonly unknown[]>} */
export const valueTagged = (v, options, external = [], result = false) => expression({ ...options, bindings: external.map(e => [e.binding, [e.text, e.uses ?? []]]) }, v, result)

/** A required binding under a caller-supplied target name, using ordinary declaration spelling. @type {(name: string, value: Value, options: Options, external?: readonly External[]) => Result<Printed<string>, readonly unknown[]>} */
export const bindingTagged = (name, value, options, external = []) => declaration(name, false, valueTagged(value, options, external))

/** Import lines for the VM names reported by the serializer. @type {(uses: Uses, bound: string) => readonly string[]} */
export const useLines = (uses, bound) => useLinesTagged(uses, bound).map(untagged)

/**
 *
 * @type {(uses: Uses, bound: string) => readonly string[]}
 */
export const useLinesTagged = ({ vm, unstable }, bound) => [
    ...(unstable.length === 0 ? [] : useLine('nanvm_lib::vm::unstable', unstable)),
    ...useLine('nanvm_lib::vm', [...new Set(['Any', bound, ...vm])].toSorted()),
]

/** rustfmt's default `max_width`, the column a line may not pass. */
const maxWidth = 100

/**
 * The width rustfmt keeps a braced `use` on one line within: two short of
 * {@link maxWidth}, since it budgets the list against the width less its
 * `};`, and a continuation line one short, which `cargo fmt --check` on
 * generated modules at the boundary showed — a 99-column `use` wrapped, a
 * 98-column one kept, a 100-column continuation line wrapped, a 99-column
 * one kept.
 */
const oneLineUseWidth = maxWidth - 2

/**
 * One `use` of `names` from `path`, as rustfmt lays it out at its default
 * width: one name bare, and several braced — on the one line where it
 * fits, and otherwise one name per comma on lines of their own, filled to
 * the width and indented one level, between the `{` and the `};`. A module
 * is generated for a workspace whose `cargo fmt --check` reads it, and a
 * generated function opts out with `#[rustfmt::skip]`, which a `use`
 * cannot.
 *
 * @type {(path: string, names: readonly string[]) => readonly string[]}
 */
const useLine = (path, names) => {
    if (names.length === 1) { return [`${kw('use')} ${path}::${names[0]};`] }
    const line = `use ${path}::{${names.join(', ')}};`
    return line.length <= oneLineUseWidth ? [`${kw('use')}${line.slice(3)}`] : [`${kw('use')} ${path}::{`, ...names.reduce(filled, []), '};']
}

/**
 * The lines of a wrapped `use` list with one more name: on the last line
 * where it still fits the width, and on a line of its own otherwise.
 *
 * @type {(rows: readonly string[], name: string) => readonly string[]}
 */
const filled = (rows, name) => {
    const last = rows.at(-1)
    const joined = `${last} ${name},`
    return last !== undefined && joined.length < maxWidth ? [...rows.slice(0, -1), joined] : [...rows, `    ${name},`]
}
