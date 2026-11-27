/**
 * Prepared FAST to Rust against the nanvm-lib API. Evaluation regions,
 * bindings, slots, memo lifetimes and transfers are fixed by common passes;
 * this module only spells those instructions and runtime operations.
 *
 * @module
 * @import { Block, Function as PreparedFunction, Memo, Statement, Value } from '../../js/ast/prepare/types.ts'
 * @import { BindingId, FunctionTarget, LoopTarget, Entry, Item, Key, Step, Operator } from '../../js/ast/types.ts'
 * @import { Options, Printed, Scope, Use, Uses, External } from './types.ts'
 * @import { _Context, _Descriptor, _Definition, _Container, _ContainerItem, _ContainerLiteral, _ContainerVisit, _StaticBindings, _StaticValue, _Frame, _Names, _Output, _Task } from './private.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Stack } from '../../types/stack_walk/types.ts'
 * @import { PersistentMap } from '../../types/map/types.ts'
 */

import { asciiLiteral, f64Bits, i64Literal, stringLiteral, u64WordItems, utf16Units } from '../../media/rust/module.f.js'
import { indent } from '../../media/rust/item/module.f.js'
import { error, mapOk, ok, okList, okThen, unwrap } from '../../types/result/module.f.js'
import { helperLength, isHelper, isIntrinsic, isStatic, staticText } from '../../edag/module.f.js'
import { chunksText, tagged, untagged } from '../../text/marked/module.f.js'
import { _helperText } from '../../js/ast/serializer/intrinsic/module.f.js'
import { _resolve } from '../../js/ast/serializer/names/module.f.js'
import { pushAll, walk } from '../../types/stack_walk/module.f.js'
import { toArray as listToArray } from '../../types/list/alt/module.f.js'
import { generate } from '../../types/array/generate/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
import { assert } from '../../asserts/module.f.js'
import { empty, fromEntries, mapEntries, mapGet, mapHas, mapSet, size } from '../../types/map/module.f.js'
import { fromValues, values as setValues } from '../../types/set/module.f.js'

const kw = tagged('keyword')

/** A literal word: `true`, `false`. */
const lit = tagged('literal')

/** A Rust string literal, with its quotes. */
const str = tagged('string')

/** A number literal: an `f64`'s bits, an `i64`. */
const num = tagged('number')

/** A slice literal over hex items, `&[0x1, 0x2]`, each item a number. @type {(items: readonly string[]) => string} */
const slice = items => `&[${items.map(item => num(item)).join(', ')}]`

/**
 * Text spelling no `nanvm_lib` name of its own.
 *
 * @type {<T>(text: T) => Printed<T>}
 */
const code = text => [text, []]

/** Import metadata is a set, so deep expressions do not copy repeated names. @type {(uses: readonly Use[]) => readonly Use[]} */
const uniqueUses = uses => mapEntries(fromEntries(uses.map(use => [`${use[0]}:${use[1]}`, use]))).map(([, use]) => use)

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
    '!': a => `<&Any<A> as core::ops::Not>::not(&${a})`,
    '~': a => `Any::bitwise_not(${a})`,
    typeof: a => `Any::typeof_(&${a})`,
    Number: a => `Any::number(${a})`,
    BigInt: a => `Any::bigint(${a})`,
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
    const value = /** @type {T | undefined} */ (entry(table, id))
    assert(value !== undefined)
    return ok([value, []])
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

/** Load a native literal by its module-local descriptor. @type {(s: _Context, v: string | bigint) => Printed<string>} */
const loadLiteral = (s, v) => {
    const id = mapGet(/** @type {_Names} */ (s.names).literals, v)
    return cat([vm(typeof v === 'string' ? 'String' : 'BigInt'), `::from_static(&LITERAL_${id})`])
}

/** @type {(s: _Context, v: string) => Printed<string>} */
const stringKey = (s, v) => s.native ? loadLiteral(s, v) : stringCall('string_key')(v)

/** @type {(s: _Context, v: string) => Printed<string>} */
const stringAny = (s, v) => s.native ? cat([loadLiteral(s, v), toAny]) : stringCall('string_any')(v)

/** Stable local spelling by identity; underscore permits required unused values. @type {(s: _Context, id: BindingId) => string} */
const binding = (s, id) => /** @type {string} */ (mapGet(/** @type {_Names} */ (s.names).bindings, id))

/** @type {(s: _Context, target: LoopTarget) => string} */
const loopLabel = (s, target) => /** @type {string} */ (mapGet(/** @type {_Names} */ (s.names).loops, target))

/** A Rust block from target statement lines. @type {(parts: readonly string[]) => string} */
export const braced = parts => parts.length === 0 ? '{}' : parts.length === 1 ? `{ ${parts[0]} }` : `{
${parts.flatMap(p => p.split('\n')).map(p => `${indent}${p}`).join('\n')}
}`

/** A target expression as a Result only where the parent needs one. @type {(result: boolean) => (v: string) => string} */
const pure = result => v => result ? `Ok(${v})` : v

/** An operation as its Result or the Any that successful evaluation supplies. @type {(result: boolean) => (v: string) => string} */
const fallible = result => v => result ? v : `(${v})?`

/** Pin the VM parameter even when a condition is only a primitive literal. @type {(value: string) => string} */
const truth = value => `Any::<A>::to_boolean(&${value})`

/** Map's SameValueZero keys need a separate identity for IEEE negative zero. */
const negativeZero = {}

/** @type {(value: Value) => unknown} */
const valueKey = value => Object.is(value, -0) ? negativeZero : value

/** Read a child completed by the spelling stack. @type {(s: _Context, v: Value, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const expression = (s, v, result) => ok(/** @type {Printed<string>} */ (mapGet(/** @type {NonNullable<_Context['ready']>} */ (s.ready)[Number(result ? 1 : 0)], valueKey(v))))

/** @type {(s: _Context, id: BindingId) => BindingId} */
const originalBinding = (s, id) => s.ownership === undefined ? id : mapGet(s.ownership.aliases, id) ?? id

/** A local can be inspected in place. Supplied bindings may be arbitrary value expressions.
 * @type {(s: _Context, v: Value) => Result<Printed<string>, readonly unknown[]>} */
const inspectionOperand = (s, v) => v instanceof Array && v[0] === 'ref' && !s.bindings.some(([id]) => id === v[1])
    ? plain(binding(s, originalBinding(s, v[1])))
    : expression(s, v, false)

/** Source text retained by a callable. @type {(s: _Context, text: string) => Printed<string>} */
const represented = (s, text) => s.native
    ? cat(['Some(', loadLiteral(s, text), ')'])
    : code(`Some(${str(unwrap(stringLiteral(text)))})`)

/** @type {(s: _Context, fn: PreparedFunction) => _StaticBindings | undefined} */
const staticFrame = (s, fn) => s.moduleInit === true && s.names !== undefined ? mapGet(s.names.staticFunctions, fn) : undefined

/** A peer is supplied by the group on entry, so it occupies no frame slot.
 * @type {(fn: PreparedFunction, value: Value) => number} */
const peerIndex = (fn, value) => value instanceof Array && value[0] === 'ref' ? fn.group?.indexOf(value[1]) ?? -1 : -1

/** @type {(fn: PreparedFunction) => PreparedFunction['captures']} */
const frameCaptures = fn => fn.group === undefined ? fn.captures : fn.captures.filter(c => peerIndex(fn, c.value) < 0)

/** The concrete VM needs the trait in scope for its associated functions. @type {(s: _Context) => Printed<string>} */
const staticFunction = s => [s.native ? 'A::function_with_text' : 'A::static_function', s.native ? [['vm', 'IVm']] : []]

/** Block transfers use the targets already selected by preparation. @type {(s: _Context, b: Block | PreparedFunction, result: boolean, functionBody?: boolean, valueBlock?: boolean) => Printed<readonly string[]>} */
const completedBlock = (s, b, result, functionBody = false, valueBlock = false) => /** @type {Printed<readonly string[]>} */ (mapGet(/** @type {NonNullable<_Context['ready']>} */ (s.ready)[Number(2 + (result ? 1 : 0) + (functionBody ? 2 : 0) + (valueBlock ? 4 : 0))], b))

/** @type {(s: _Context, b: Block, result: boolean, functionBody?: boolean, valueBlock?: boolean) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const block = (s, b, result, functionBody, valueBlock) => ok(completedBlock(s, b, result, functionBody, valueBlock))

/** @type {(s: _Context, ref: _Descriptor) => string} */
const descriptorName = (s, ref) => `${ref.definition.kind.toUpperCase()}_${binding(s, ref.id).slice(2).toUpperCase()}`

/** @type {(s: _Context, ref: _Descriptor) => Printed<string>} */
const descriptorItem = (s, ref) => cat([vm('StaticAny'), `::${ref.definition.kind}(&${descriptorName(s, ref)})`])

/** @type {(v: _StaticValue) => v is _Descriptor} */
const isDescriptor = v => typeof v === 'object' && v !== null

/** @type {(s: _Context, v: _StaticValue) => Printed<string>} */
const staticItem = (s, v) => {
    if (isDescriptor(v)) { return descriptorItem(s, v) }
    const item = vm('StaticAny')
    if (v === undefined || v === null) {
        return cat([item, '::Nullish(', vm('Nullish'), v === null ? '::Null)' : '::Undefined)'])
    }
    if (typeof v === 'boolean') { return cat([item, `::Boolean(${lit(`${v}`)})`]) }
    if (typeof v === 'number') { return cat([item, `::Number(f64::from_bits(${num(f64Bits(v))}))`]) }
    const id = mapGet(/** @type {_Names} */ (s.names).literals, v)
    return cat([item, `::${typeof v === 'string' ? 'String' : 'BigInt'}(&LITERAL_${id})`])
}

/** One callable's explicit invocation environment. @type {(s: _Context, fn: PreparedFunction) => _Context} */
const closureContext = (s, fn) => {
    const captures = staticFrame(s, fn)
    const slots = frameCaptures(fn)
    const held = s.runtime === null || captures !== undefined ? null : `A::frame(_self)[${num(`${slots.length}`)}]`
    const bindings = [
        ...fn.parameters.map((id, i) => /** @type {const} */ ([id, argRead(i)])),
        ...slots.map((c, i) => /** @type {const} */ ([c.binding, fn.group !== undefined && captures !== undefined
            ? cat([staticItem(s, mapGet(captures, c.binding)), '.load()'])
            : cat([['A::frame', s.native ? [['vm', 'IVm']] : []], `(_self)[${num(`${i}`)}].clone()`])])),
        ...fn.captures.flatMap(c => {
            const i = peerIndex(fn, c.value)
            if (i < 0) { return [] }
            const value = captures === undefined
                ? cat([['A::group_member', s.native ? [['vm', 'IVm']] : []], `(_self, ${num(`${i}`)})`, toAny])
                : cat([staticItem(s, mapGet(/** @type {_Names} */ (s.names).staticBindings, /** @type {readonly BindingId[]} */ (fn.group)[Number(i)])), '.load()'])
            return [/** @type {const} */ ([c.binding, value])]
        }),
        ...(fn.self === null ? [] : [/** @type {const} */ ([fn.self, cat([vm('Function'), '::new(_self.clone())', toAny])])]),
    ]
    return { ...s, moduleInit: false, runtime: held, bindings, captures }
}

/** @type {(s: _Context, st: Statement) => _Descriptor | undefined} */
const namedDescriptor = (s, st) => {
    if (!s.moduleInit || s.names === undefined || st[0] !== 'define') { return undefined }
    const ref = mapGet(s.names.staticBindings, st[1])
    return isDescriptor(ref) && ref.id === st[1] ? ref : undefined
}

/** @type {(s: _Context, fn: PreparedFunction) => Printed<string>} */
const functionBody = (s, fn) => {
    const rest = fn.rest === null ? [] : [`${kw('let')} ${binding(s, fn.rest)}: Any<A> = _args.rest(${num(`${fn.parameters.length}`)}).to_any();`]
    const [lines, uses] = completedBlock(s, fn, true, true)
    return [braced([...rest, ...lines]), uses]
}

/** @type {(s: _Context, fn: PreparedFunction, name: string) => Printed<string>} */
const functionDeclaration = (s, fn, name) => {
    const names = /** @type {_Names} */ (s.names)
    const frame = /** @type {_StaticBindings} */ (mapGet(names.staticFunctions, fn))
    const id = mapGet(names.literals, s.text(fn))
    return cat([`${kw('static')} ${name}: `, vm('StaticFunction'),
        `<A> = StaticFunction { code: |_self, _args| `, functionBody(s, fn), `, length: ${num(`${fn.parameters.length}`)}, frame: &`, vm('StaticArray'), '(&[',
        ...(fn.group === undefined ? fn.captures : []).flatMap((c, i) => [i === 0 ? '' : ', ', staticItem(s, mapGet(frame, c.binding))]),
        `]), text: Some(&LITERAL_${id}) };`])
}

/** @type {(s: _Context, fn: PreparedFunction) => Result<Printed<string>, readonly unknown[]>} */
const closure = (s, fn) => {
    if (staticFrame(s, fn) !== undefined) {
        return ok(cat(['{ ', functionDeclaration(s, fn, 'VALUE'), ' ', vm('Function'), '::from_static(&VALUE)', toAny, ' }']))
    }
    const captured = fn.captures.map(c => expression(s, c.value, false))
    const values = s.runtime === null ? captured : [...captured, plain(`${s.runtime}.clone()`)]
    return flat(map2((/** @type {readonly string[]} */ captures, /** @type {string} */ body) => cat([
        staticFunction(s), `(|_self, _args| ${body}, ${num(`${fn.parameters.length}`)}, `,
        captures.length === 0 ? cat([vm('Array'), '::default()']) : cat([`[${captures.join(', ')}]`, toArray]),
        ', ', represented(s, s.text(fn)), ')', toAny,
    ]))(all(values), ok(functionBody(s, fn))))
}

/** Resolve helper presentation symbols without introducing graph inspection. @type {(text: string) => string} */
const helperText = text => chunksText(_resolve([text], [], []))

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

/** A primitive (including undefined) or a named descriptor contributes one static entry.
 * @type {(known: _StaticBindings, value: Item<Value>) => readonly _StaticValue[]} */
const staticEntry = (known, value) => {
    if (!(value instanceof Array)) { return [value] }
    return value[0] === 'ref' && mapHas(known, value[1]) ? [mapGet(known, value[1])] : []
}

/** Analyze immediate entries after any nested literal has been visited.
 * @type {(v: _ContainerLiteral, known: _StaticBindings, containers: _Names['containers'], functions: _Names['staticFunctions']) => _Container | null} */
const containerOf = (v, known, containers, functions) => {
    /** @type {(value: Item<Value>) => readonly _ContainerItem[]} */
    const item = value => {
        if (value instanceof Array && value[0] === 'function' && mapHas(functions, value[1])) {
            return [{ id: null, definition: { kind: 'Function', fn: value[1] } }]
        }
        const nested = mapGet(containers, value)
        return nested === undefined ? staticEntry(known, value) : [{ definition: nested, id: null }]
    }
    if (v[0] === 'array') {
        const items = v[1].flatMap(item)
        return items.length === v[1].length ? { kind: 'Array', items } : null
    }
    const entries = v[1]
    const fields = entries.flatMap(e => {
        if (e[0] !== ':' || typeof e[1] !== 'string') { return [] }
        const key = e[1]
        return item(e[2]).map(value => /** @type {const} */ ([key, value]))
    })
    return fields.length === entries.length ? { kind: 'Object', fields } : null
}

/** Emit a separate local static per inline occurrence. Keeping declarations side by side
 * bounds Rust expression depth even for deeply nested literal trees.
 * @type {(s: _Context, name: string, root: _Container) => Printed<string>} */
const containerDeclaration = (s, name, root) => {
    /** @type {Stack<readonly [string, _Container]>} */
    let pending = { top: [name, root], rest: null }
    /** @type {List<Printed<string>>} */
    let declarations = null
    let initializer = code('')
    let next = 0
    while (pending !== null) {
        /** @type {NonNullable<Stack<readonly [string, _Container]>>} */
        const { top: [local, container], rest } = pending
        pending = rest
        // Object.fromEntries retains the last value at the first position of each key.
        /** @type {readonly (readonly [string | null, _ContainerItem])[]} */
        const fields = container.kind === 'Array' ? container.items.map(v => /** @type {const} */ ([null, v]))
            : Object.entries(Object.fromEntries(container.fields))
        /** @type {List<Printed<string>>} */
        let items = null
        for (const [key, value] of fields) {
            let item
            if (typeof value === 'object' && value !== null && value.id === null) {
                const child = `ITEM_${next}`
                next += 1
                if (value.definition.kind === 'Function') {
                    declarations = { first: cat([functionDeclaration(s, value.definition.fn, child), ' ']), tail: declarations }
                } else { pending = { top: [child, value.definition], rest: pending } }
                item = cat([vm('StaticAny'), `::${value.definition.kind}(&${child})`])
            } else { item = staticItem(s, value) }
            const field = key === null ? item : cat([`(&LITERAL_${mapGet(/** @type {_Names} */ (s.names).literals, key)}, `, item, ')'])
            items = { first: cat([items === null ? '' : ', ', field]), tail: items }
        }
        const ty = vm(`Static${container.kind}`)
        const body = cat([ty, '(&[', ...listToArray(items).toReversed(), '])'])
        if (local === name) { initializer = body }
        else { declarations = { first: cat([`${kw('static')} ${local}: `, ty, '<A> = ', body, '; ']), tail: declarations } }
    }
    return cat([`${kw('static')} ${name}: `, vm(`Static${root.kind}`), '<A> = ',
        ...(declarations === null ? [initializer] : ['{ ', ...listToArray(declarations), initializer, ' }']), ';'])
}

/** @type {(s: _Context, entries: readonly Entry<Value>[]) => Result<Printed<string>, readonly unknown[]>} */
const object = (s, entries) => {
    if (entries.length === 0) { return ok(cat([vm('Object'), '::default()', toAny])) }
    const spread = entries.some(e => e[0] === '...' || typeof e[1] !== 'string')
    const members = entries.map(e => e[0] === '...'
        ? flat(map1(v => cat([unstable('spread_entries'), `(${v})`]))(expression(s, e[1], false)))
        : typeof e[1] === 'string'
            ? flat(map1(v => cat([spread ? unstable('property_item') : code(''), '(', stringKey(s, /** @type {string} */ (e[1])), `, ${v})`]))(expression(s, e[2], false)))
            : flat(map2((k, v) => cat([unstable('property_item'), `((${k}).to_string()?, ${v})`]))(expression(s, e[1], false), expression(s, e[2], false))))
    return flat(map1((/** @type {readonly string[]} */ items) => spread
        ? cat([unstable('spread_object'), `([${items.join(', ')}])`])
        : cat([`[${items.join(', ')}]`, toObject, toAny]))(all(members)))
}

/** @type {(s: _Context, k: Key<Value>) => Result<Printed<string>, readonly unknown[]>} */
const key = (s, k) => expression(s, k, false)

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
const steps = (s, step, property, member) => ok(/** @type {Printed<string>} */ (mapGet(/** @type {NonNullable<_Context['ready']>} */ (s.ready)[Number(11 + (property ? 1 : 0) + (member ? 2 : 0))], step)))

/** An immutable object's own literal key wins before runtime member dispatch.
 * @type {(s: _Context, n: Operator<Value>) => readonly Item<Value>[] | undefined} */
const ownCallArgs = (s, n) => {
    if (s.captures === undefined || n[0] !== '.' || typeof n[2] !== 'string') { return undefined }
    const step = /** @type {Step<Value> | undefined} */ (n[3])
    if (step?.length !== 2 || (step[0] !== '|()' && step[0] !== '|!()')) { return undefined }
    const [ref] = staticEntry(s.captures, n[1])
    return isDescriptor(ref) && ref.definition.kind === 'Object' && ref.definition.fields.some(([key]) => key === n[2]) ? step[1] : undefined
}

/** The target's runtime operation spelling; no placement or graph walk occurs here. @type {(s: _Context, n: Operator<Value>, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const operation = (s, n, result) => {
    const tag = n[0]
    if (isStatic([tag])) {
        if (s.runtime !== null) {
            const read = s.native
                ? cat([unstable('static_read_keys'), `(&${s.runtime}, `, stringKey(s, 'static'), ', ', stringKey(s, tag), ')'])
                : cat([unstable('static_read'), `(&${s.runtime}, ${str(unwrap(stringLiteral(tag)))})`])
            return map1(fallible(result))(ok(read))
        }
        if (tag !== 'Object.entries' && tag !== 'String.fromCharCode' && tag !== 'Math.trunc' && tag !== 'Math.floor' && tag !== 'Math.abs' && tag !== 'Math.sqrt' && tag !== 'Math.ceil' && tag !== 'Math.imul' && tag !== 'Math.max' && tag !== 'Math.min' && tag !== 'Math.clz32') { return error(['a static function read with no runtime in scope; the core may not use what it defines', tag]) }
        if (tag === 'String.fromCharCode') {
            return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| ', vm('String'), `::from_char_code(_args).map(|v| v.to_any()), 1, `, vm('Array'), '::default(), ', represented(s, staticText(tag)), ')', toAny])))
        }
        if (tag === 'Math.trunc' || tag === 'Math.floor' || tag === 'Math.abs' || tag === 'Math.sqrt' || tag === 'Math.ceil' || tag === 'Math.clz32') {
            const method = tag.slice(5)
            return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| ', argRead(0), `.to_number().map(|v| v.${method}().to_any()), 1, `, vm('Array'), '::default(), ', represented(s, staticText(tag)), ')', toAny])))
        }
        if (tag === 'Math.imul') {
            return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| ', argRead(0), '.to_number().and_then(|a| ', argRead(1), `.to_number().map(|b| a.imul(b).to_any())), 2, `, vm('Array'), '::default(), ', represented(s, staticText(tag)), ')', toAny])))
        }
        if (tag === 'Math.max' || tag === 'Math.min') {
            const method = tag.slice(5)
            const initial = tag === 'Math.min' ? 'INFINITY' : 'NEG_INFINITY'
            return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| _args.into_iter().try_fold(', vm('Number'), `::from(f64::${initial}), |current, value| value.to_number().map(|value| current.${method}(value))).map(|value| value.to_any()), 2, `, vm('Array'), '::default(), ', represented(s, staticText(tag)), ')', toAny])))
        }
        return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| Any::entries(', argRead(0), '), ', num('1'), ', ', vm('Array'), '::default(), ', represented(s, staticText('Object.entries')), ')', toAny])))
    }
    if (isHelper([tag])) {
        // the arity and the text are the helper table's; only the native
        // body is this writer's own
        const id = /** @type {import('../../edag/types.ts').HelperId} */ (tag)
        // the empty reference map is NaNVM's own, a new map wherever
        // the node is established, under the text the writer gives it
        if (id === 'refMap') {
            return map1(pure(result))(ok(cat([unstable(s.native ? 'ref_map_with_text' : 'ref_map'), '(', represented(s, helperText(_helperText(id)('helper'))), ')'])))
        }
        if (id === 'structEq') {
            if (s.runtime === null) { return error(['structEq requires the common runtime', tag]) }
            // Each helper has its own identity and source text, and captures the shared body.
            return map1(pure(result))(ok(cat([
                staticFunction(s), '(|_self, _args| Any::call(A::frame(_self)[0].clone(), _args', toAny,
                '), ', num('2'), `, [(Any::dot(${s.runtime}.clone(), `, stringAny(s, id), ').end())?]', toArray,
                ', ', represented(s, helperText(_helperText(id)('helper'))), ')', toAny,
            ])))
        }
        const length = helperLength(id)
        const args = generate(length - 1, k => argRead(k + 1))
        const native = id === 'entry' ? ['Any::entry(', argRead(0), ', ', argRead(1), ')']
            : id === 'hasEntry' ? ['Any::has_entry(', argRead(0), ', ', argRead(1), ').map(|v| v.to_any())']
            : ['Any::dot(', argRead(0), ', ', stringAny(s, id), ').end_call_native(|| Ok([', ...args.flatMap((x, k) => k === 0 ? [x] : [', ', x]), ']', toArray, toAny, '))']
        return map1(pure(result))(ok(cat([staticFunction(s), '(|_self, _args| ', ...native, ', ', num(`${length}`), ', ', vm('Array'), '::default(), ', represented(s, helperText(_helperText(id)('helper'))), ')', toAny])))
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
            const args = ownCallArgs(s, n)
            if (args !== undefined) {
                return map1(fallible(result))(map2((start, thunk) => `${start}.end_call_native(${thunk})`)(open, argumentThunk(s, args)))
            }
            return map1(fallible(result))(map2((start, rest) => `${start}${rest}`)(open, steps(s, /** @type {Step<Value> | undefined} */ (n[3]), tag === '.', tag !== '?.()')))
        }
        case 'instanceof': { return map1(fallible(result))(flat(map1(v => cat([`Any::instanceof_(&${v}, `, vm('Constructor'), `::${n[2]})`]))(inspectionOperand(s, n[1])))) }
        // the naive spelling: the runtime's `in` body called with the key
        // and the value, which a VM may substitute natively (DESIGN.md §13)
        case 'in': {
            if (s.runtime === null) { return error(['an in operator with no runtime in scope; the core may not use what it defines', n]) }
            return map1(fallible(result))(flat(map1(v => cat([`Any::call((Any::dot(${s.runtime}.clone(), `, stringAny(s, 'in'), ').end())?, [', stringAny(s, n[1]), `, ${v}]`, toArray, toAny, ')']))(expression(s, n[2], false))))
        }
        // Boolean is the shared `!!value` body. The tuple evaluates its
        // operand before lookup, with both outside the new bindings' scope.
        case 'Boolean': {
            if (s.runtime === null) { return error(['a Boolean operator with no runtime in scope; the core may not use what it defines', n]) }
            return map1(fallible(result))(flat(map1(v => cat(['{ ', kw('let'), ' (boolean_value, boolean_body) = (', v,
                `, (Any::dot(${s.runtime}.clone(), `, stringAny(s, 'Boolean'), ').end())?); ',
                'Any::call(boolean_body, [boolean_value]', toArray, toAny, ') }']))(expression(s, n[1], false))))
        }
        case ',': {
            const values = n[1]
            return values.length === 0 ? map1(pure(result))(primitiveExpr(undefined))
                : map2((/** @type {readonly string[]} */ before, /** @type {string} */ last) => `{ ${before.map(text => `${text}; `).join('')}${last} }`)(all(values.slice(0, -1).map(v => expression(s, v, false))), expression(s, values[Number(values.length - 1)], result))
        }
        default: {
            const lazy = tag === '?:'
            const infix = n.length === 3 && ['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'].includes(tag)
            const eager = (/** @type {Value} */ v) => infix || tag === 'String' ? grouped(s, v) : expression(s, v, false)
            const rest = (/** @type {Value} */ v) => lazy ? thunk(s, v) : eager(v)
            return map1(fallible(result))(flat(n.length === 2 ? map2((fn, v) => fn(v))(op1(tag), tag === 'typeof' || tag === '!' ? inspectionOperand(s, n[1]) : eager(n[1]))
                : n.length === 3 ? map3((fn, a, b) => fn(a, b))(op2(tag), eager(n[1]), rest(n[2]))
                    : map4((fn, a, b, c) => fn(a, b, c))(op3(tag), expression(s, n[1], false), rest(n[2]), rest(n[3]))))
        }
    }
}

/** Immediate value spelling reads only its already completed children. @type {(s: _Context, v: Value, result: boolean) => Result<Printed<string>, readonly unknown[]>} */
const expressionReady = (s, v, result) => {
    if (s.native && (typeof v === 'string' || typeof v === 'bigint')) {
        return map1(pure(result))(ok(cat([loadLiteral(s, v), toAny])))
    }
    if (!(v instanceof Array)) { return map1(pure(result))(primitiveExpr(v)) }
    const container = s.moduleInit ? mapGet(/** @type {_Names} */ (s.names).containers, v) : undefined
    if (container !== undefined) {
        return map1(pure(result))(ok(cat(['{ ', containerDeclaration(s, 'VALUE', container), ' ', vm(container.kind), '::from_static(&VALUE)', toAny, ' }'])))
    }
    switch (v[0]) {
        case 'ref': {
            const found = s.bindings.find(([id]) => id === v[1])
            if (found !== undefined) { return map1(pure(result))(ok(found[1])) }
            const id = originalBinding(s, v[1])
            const move = s.owner !== undefined && s.ownership !== undefined && mapGet(s.ownership.moves, id) === s.owner
            return map1(pure(result))(ok(code(`${binding(s, id)}${move ? '' : '.clone()'}`)))
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
                inspectionOperand(s, v[1]), block(s, v[2], result, false, true), block(s, v[3], result, false, true)))
        }
        default: { return operation(s, v, result) }
    }
}

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

/** A group member is always introduced by a required definition.
 * @type {(st: Statement) => PreparedFunction | null} */
const definedMember = st => st[0] === 'define' && st[2] instanceof Array && st[2][0] === 'function' && st[2][1].group !== undefined
    ? st[2][1] : null

/** @type {(s: _Context, statements: readonly Statement[]) => readonly _Task[]} */
const statementTasks = (s, statements) => statements.map((statement, i) => {
    const member = definedMember(statement)
    const ids = member?.group
    if (ids === undefined || statement[1] !== ids[0]) { return { kind: 'statement', context: s, statement } }
    const members = statements.slice(i, i + ids.length).map(st => /** @type {PreparedFunction} */ (definedMember(st)))
    return { kind: 'statement', context: s, statement, members }
})

/** One allocation carries every entry and its shared capture frame.
 * @type {(s: _Context, groupName: string, members: readonly PreparedFunction[]) => Result<Printed<string>, readonly unknown[]>} */
const groupDeclaration = (s, groupName, members) => {
    const frame = frameCaptures(members[0]).map(c => expression(s, c.value, false))
    const held = s.runtime === null ? frame : [...frame, plain(`${s.runtime}.clone()`)]
    const entries = members.map(fn => cat([vm('GroupEntry'), ' { code: |_self, _args| ', functionBody(s, fn),
        `, length: ${num(`${fn.parameters.length}`)}, text: Some(${str(unwrap(stringLiteral(s.text(fn))))}) }`]))
    return flat(map1((/** @type {readonly string[]} */ slots) => cat([
        `${kw('let')} ${groupName} = `, ['A::function_group', s.native ? [['vm', 'IVm']] : []], '(',
        `[${slots.join(', ')}]`,
        ', [', ...entries.flatMap((item, i) => [i === 0 ? '' : ', ', item]), ']);',
    ]))(all(held)))
}

/** A prepared instruction has exactly one Rust spelling. @type {(s: _Context, st: Statement) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const statement = (s, st) => ok(/** @type {Printed<readonly string[]>} */ (mapGet(/** @type {NonNullable<_Context['ready']>} */ (s.ready)[10], st)))

/** A statement loop and a terminal loop share their lexical target and body. @type {(s: _Context, loop: readonly ['loop', LoopTarget, Block]) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const loopText = (s, loop) => map1(parts => [`'${loopLabel(s, loop[1])}: ${kw('loop')} ${braced(parts)}`])(block(s, loop[2], false))

/** One binding spelling for compiler temporaries and corpus-supplied names. @type {(name: string, mutable: boolean, value: Result<Printed<string>, readonly unknown[]>) => Result<Printed<string>, readonly unknown[]>} */
const declaration = (name, mutable, value) => map1(text => `${kw('let')} ${mutable ? `${kw('mut')} ` : ''}${name}: Any<A> = ${text};`)(value)

/** @type {(s: _Context, st: Statement, members?: readonly PreparedFunction[]) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const statementReady = (s, st, members) => {
    if (st[0] === 'define' && s.ownership !== undefined && mapHas(s.ownership.aliases, st[1])) { return ok(code([])) }
    const ref = namedDescriptor(s, st)
    if (ref !== undefined) {
        const name = descriptorName(s, ref)
        const decl = ref.definition.kind === 'Function' ? functionDeclaration(s, ref.definition.fn, name) : containerDeclaration(s, name, ref.definition)
        return map2((item, local) => [item, local])(ok(decl),
            declaration(binding(s, ref.id), false, ok(cat([vm(ref.definition.kind), `::from_static(&${name})`, toAny]))))
    }
    const member = definedMember(st)
    if (member?.group !== undefined && st[0] === 'define') {
        const name = `_group${binding(s, member.group[0])}`
        const index = member.group.indexOf(st[1])
        const local = declaration(binding(s, st[1]), false, ok(cat([`${name}.group_member(${num(`${index}`)})`, toAny])))
        return members === undefined ? map1(value => [value])(local)
            : map2((decl, value) => [decl, value])(groupDeclaration(s, name, members), local)
    }
    switch (st[0]) {
        case 'define': case 'slot': { return map1(text => [text])(declaration(binding(s, st[1]), st[0] === 'slot' && st[3], expression(s, st[2], false))) }
        case 'write': { return map1(text => [`${binding(s, st[1])} = ${text};`])(expression(s, st[2], false)) }
        case 'memo': { return memo(s, st[1]) }
        case 'block': { return map1(parts => [braced(parts)])(block(s, st[1], false)) }
        case 'if': { return map3((condition, yes, no) => [`${kw('if')} ${truth(condition)} ${braced(yes)}${no.length === 0 ? '' : ` ${kw('else')} ${braced(no)}`}`])(inspectionOperand(s, st[1]), block(s, st[2], false), block(s, st[3], false)) }
        case 'loop': { return loopText(s, st) }
        // `'while'`, the one statement left: `children` refuses any other
        default: {
            const w = st[1]
            return map3((initial, condition, body) => [
                `${kw('let')} ${w.mutable ? `${kw('mut')} ` : ''}${binding(s, w.slot)}: Any<A> = ${initial};`,
                `'${loopLabel(s, w.target)}: ${kw('while')} ${truth(condition)} ${braced(body)}`,
                `${kw('let')} ${binding(s, w.result)}: Any<A> = ${binding(s, w.slot)};`,
            ])(expression(s, w.initial, false), inspectionOperand(s, w.condition), block(s, w.body, false))
        }
    }
}

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

/** @type {(s: _Context, b: Block, result: boolean, functionBody: boolean, valueBlock: boolean) => Result<Printed<readonly string[]>, readonly unknown[]>} */
const blockReady = (s, b, result, functionBody, valueBlock) => {
    const region = flattened(b)
    const exit = region.exit
    /** @type {Result<Printed<readonly string[]>, readonly unknown[]>} */
    const end = exit[0] === 'yield'
        ? exit[1].length === 0 ? ok(code([])) : map1(text => [text])(expression(s, exit[1][0], result))
        : exit[0] === 'loop' ? loopText(s, exit)
            : exit[0] === 'continue' || exit[0] === 'break' ? ok(code([`${kw(exit[0])} '${loopLabel(s, exit[1])};`]))
                : exit[0] === 'throw' ? map1(text => [result ? `Err(${text})` : valueBlock ? `(Err::<Any<A>, Any<A>>(${text}))?` : `${kw('return')} Err(${text});`])(expression(s, exit[1], false))
                    : map1(text => [functionBody ? text : `${kw('return')} ${text};`])(expression(s, exit[2], true))
    return map2((parts, last) => [...parts.flat(), ...last])(all(region.statements.map(st => statement(s, st))), end)
}

/** One value spelling request in a selected invocation context. @type {(context: _Context, value: Value, result?: boolean) => _Task} */
const valueTask = (context, value, result = false) => ({ kind: 'value', context, value, result })

/** One region spelling request, retaining its transfer context. @type {(context: _Context, b: Block, result?: boolean, functionBody?: boolean, valueBlock?: boolean) => _Task} */
const blockTask = (context, b, result = false, functionBody = false, valueBlock = false) => ({ kind: 'block', context, block: b, result, functionBody, valueBlock })

/** @type {(context: _Context, loop: readonly ['loop', LoopTarget, Block]) => readonly _Task[]} */
const loopTasks = (context, loop) => [blockTask({ ...context, moduleInit: false }, loop[2])]

/** @type {(context: _Context, step: Step<Value> | undefined, property: boolean, member: boolean) => _Task} */
const stepTask = (context, step, property, member) => ({ kind: 'steps', context, step, property, member })

/** @type {(context: _Context, values: readonly (Value | readonly ['...', Value])[]) => readonly _Task[]} */
const itemTasks = (context, values) => values.map(v => valueTask(context, v instanceof Array && v[0] === '...' ? v[1] : /** @type {Value} */ (v)))

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
        case 'object': { return n[1].flatMap(e => e[0] === '...' ? [valueTask(context, e[1])] : [valueTask(context, e[1]), valueTask(context, e[2])]) }
        case '()': { return [valueTask(context, n[1]), ...itemTasks(context, n[2])] }
        case 'memberPresent': { return [valueTask(context, n[1]), valueTask(context, n[2])] }
        case '.': case '?.': {
            const args = ownCallArgs(context, n)
            return [valueTask(context, n[1]), valueTask(context, n[2]), ...(args === undefined
                ? [stepTask(context, /** @type {Step<Value> | undefined} */ (n[3]), n[0] === '.', true)] : itemTasks(context, args))]
        }
        case '?.()': { return [valueTask(context, n[1]), ...itemTasks(context, n[2]), stepTask(context, /** @type {Step<Value> | undefined} */ (n[3]), false, false)] }
        case 'instanceof': { return [valueTask(context, n[1])] }
        case 'in': { return [valueTask(context, n[2])] }
        case ',': { return n[1].map((v, i) => valueTask(context, v, i === n[1].length - 1 && result)) }
        case '?:': { return [valueTask(context, n[1]), ...thunkTasks(context, n[2]), ...thunkTasks(context, n[3])] }
        default: { return n.length === 2 ? [valueTask(context, n[1])] : [valueTask(context, n[1]), valueTask(context, n[2])] }
    }
}

/** The same block may use different argument or capture slots in two functions.
 * @type {(s: _Context, fn: PreparedFunction) => _Task} */
const functionTask = (s, fn) => ({ kind: 'block', context: closureContext(s, fn), block: fn.body, callable: fn, result: true, functionBody: true, valueBlock: false })

/** Compile only the bodies owned by this literal. A named reference already has its declaration.
 * @type {(s: _Context, root: _Definition) => readonly _Task[]} */
const definitionTasks = (s, root) => {
    /** @type {List<_Task>} */
    let tasks = null
    /** @type {Stack<_Definition>} */
    let pending = { top: root, rest: null }
    while (pending !== null) {
        /** @type {NonNullable<Stack<_Definition>>} */
        const { top, rest } = pending
        pending = rest
        if (top.kind === 'Function') {
            const fn = top.fn
            tasks = { first: functionTask(s, fn), tail: tasks }
        } else {
            const items = top.kind === 'Array' ? top.items : top.fields.map(([, value]) => value)
            for (const value of items) {
                if (typeof value === 'object' && value !== null && value.id === null) {
                    pending = { top: value.definition, rest: pending }
                }
            }
        }
    }
    return listToArray(tasks)
}

/** Every dependency is target spelling, with no binding or placement decisions. @type {(task: _Task) => readonly _Task[]} */
const children = task => {
    const s = task.context
    switch (task.kind) {
        case 'value': {
            const v = task.value
            if (!(v instanceof Array)) { return [] }
            const container = s.moduleInit && s.names !== undefined ? mapGet(s.names.containers, v) : undefined
            if (container !== undefined) { return definitionTasks(s, container) }
            switch (v[0]) {
                case 'ref': case 'demand': { return [] }
                case 'function': { return [...v[1].captures.map(c => valueTask(s, c.value)), functionTask(s, v[1])] }
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
                    : exit[0] === 'throw' ? [valueTask(s, exit[1])] : exit[0] === 'loop' ? loopTasks(s, exit) : []
            return [...statementTasks(s, region.statements), ...end]
        }
        case 'statement': {
            const st = task.statement
            const ref = namedDescriptor(s, st)
            if (ref !== undefined) { return definitionTasks(s, ref.definition) }
            if (definedMember(st) !== null) {
                if (task.members === undefined) { return [] }
                return [...frameCaptures(task.members[0]).map(c => valueTask(s, c.value)), ...task.members.map(fn => functionTask(s, fn))]
            }
            switch (st[0]) {
                case 'define': case 'slot': case 'write': { return [valueTask({ ...s, owner: st }, st[2])] }
                case 'memo': { return [blockTask({ ...s, moduleInit: false }, st[1].initializer, false, false, true)] }
                case 'block': { return [blockTask(s, st[1])] }
                case 'if': { return [valueTask(s, st[1]), blockTask(s, st[2]), blockTask(s, st[3])] }
                case 'loop': { return loopTasks(s, st) }
                case 'while': {
                    const repeated = { ...s, moduleInit: false }
                    return [valueTask(repeated, st[1].initial), valueTask(repeated, st[1].condition), blockTask(repeated, st[1].body)]
                }
                default: { throw ['not a statement', st] }
            }
        }
        // `'steps'`, the one kind left: every task is built in this module
        default: {
            const step = task.step
            if (step === undefined) { return [] }
            if (step[0] === '|.') { return [valueTask(s, step[1]), stepTask(s, step[2], false, true)] }
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
const taskInput = task => task.kind === 'value' ? valueKey(task.value) : task.kind === 'block' ? task.callable ?? task.block : task.kind === 'statement' ? task.statement : task.step

/** Render one completed frame using only local child lookups. @type {(task: _Task, dependencies: readonly _Task[], values: readonly _Output[]) => Result<_Output, readonly unknown[]>} */
const completed = (task, dependencies, values) => {
    const ready = generate(15, kind => fromEntries(dependencies.flatMap((child, i) => taskKind(child) === kind ? [/** @type {const} */ ([taskInput(child), values[Number(i)]])] : [])))
    const s = { ...task.context, ready }
    switch (task.kind) {
        case 'value': { return expressionReady(s, task.value, task.result) }
        case 'block': { return blockReady(s, task.block, task.result, task.functionBody, task.valueBlock) }
        case 'statement': { return statementReady(s, task.statement, task.members) }
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
        const tail = entry(frame, 'values')
        assert(tail !== undefined)
        const values = /** @type {const} */ ({ first: value, tail })
        const index = frame.index + 1
        return index === frame.children.length
            ? completed(frame.task, frame.children, listToArray(values).toReversed())
            : ['push', { ...frame, index, values }, frame.children[Number(index)]]
    },
})

/** @type {(fn: PreparedFunction) => readonly BindingId[]} */
const invocationBindings = fn => [...fn.parameters, ...[fn.rest, fn.self].flatMap(id => id === null ? [] : [id]), ...fn.captures.map(c => c.binding)]

/** Identities in one instruction, including hidden storage and invocation names. @type {(task: _Task) => readonly BindingId[]} */
const instructionBindings = task => {
    if (task.kind === 'value') {
        const value = task.value
        if (!(value instanceof Array)) { return [] }
        if (value[0] === 'ref' || value[0] === 'demand') { return [value[1]] }
        return value[0] === 'function' ? invocationBindings(value[1]) : []
    }
    if (task.kind !== 'statement') { return [] }
    const st = task.statement
    if (task.members !== undefined) {
        return [.../** @type {readonly BindingId[]} */ (task.members[0].group), ...task.members.flatMap(invocationBindings)]
    }
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
    return exit[0] === 'continue' || exit[0] === 'break' || exit[0] === 'loop' ? [exit[1]] : []
}

/** Debug indices keep familiar spellings; equal indices never alias identities. @type {<T extends { readonly index: number }>(ids: readonly T[], prefix: string) => PersistentMap<T, string>} */
const identityNames = (ids, prefix) => {
    const first = fromEntries(ids.toReversed().map(id => [id.index, id]))
    return fromEntries(ids.map((id, ordinal) => {
        const safe = Number.isSafeInteger(id.index) && id.index >= 0
        const base = safe ? `${prefix}${id.index}` : `${prefix}v${ordinal}`
        return [id, safe && mapGet(first, id.index) !== id ? `${base}_${ordinal}` : base]
    }))
}

/** VM literals read by one instruction, including names introduced by the Rust backend.
 * @type {(task: _Task) => readonly (string | bigint)[]} */
const instructionLiterals = task => {
    if (task.kind !== 'value') { return [] }
    const v = task.value
    if (typeof v === 'string' || typeof v === 'bigint') { return [v] }
    if (!(v instanceof Array)) { return [] }
    const tag = v[0]
    if (tag === 'function') { return [task.context.text(v[1])] }
    if (isStatic(v)) { return task.context.runtime === null ? [staticText(v[0])] : ['static', tag] }
    if (isHelper(v)) {
        const text = helperText(_helperText(v[0])('helper'))
        return tag === 'structEq' || isIntrinsic([tag]) ? [tag, text] : [text]
    }
    if (tag === 'Boolean') { return [tag] }
    return tag === 'in' ? [tag, v[1]] : []
}

/** A nested function may need its enclosing function to pass the runtime on to it.
 * @type {(s: _Context, fn: PreparedFunction) => boolean} */
const bodyNeedsRuntime = (s, fn) => {
    if (s.runtime === null) { return false }
    /** @type {Stack<_Task>} */
    let pending = { top: blockTask(s, fn.body), rest: null }
    while (pending !== null) {
        /** @type {NonNullable<Stack<_Task>>} */
        const { top, rest } = pending
        if (top.kind === 'steps' && top.member && top.step !== undefined && top.step[0] !== '|.') { return true }
        if (top.kind === 'value' && top.value instanceof Array) {
            const v = top.value
            if (isStatic(v) || v[0] === 'structEq' || v[0] === 'in' || v[0] === 'Boolean' || v[0] === 'memberPresent') { return true }
        }
        pending = pushAll(children(top), rest)
    }
    return false
}

/** The complete frame must be expressible as static data, and the body may not
 * depend on a runtime argument supplied at module initialization.
 * @type {(s: _Context, known: _StaticBindings, fn: PreparedFunction) => _StaticBindings | null} */
const constantFrame = (s, known, fn) => {
    const slots = frameCaptures(fn)
    const frame = fromEntries(slots.flatMap(({ binding, value }) =>
        staticEntry(known, value).map(item => /** @type {const} */ ([binding, item]))))
    return size(frame) === slots.length && !bodyNeedsRuntime({ ...s, captures: frame }, fn) ? frame : null
}

/** Target naming walks the prepared instructions, never the source graph. @type {(root: _Task) => _Names} */
const namesOf = root => {
    /** @type {Stack<_Task | _ContainerVisit>} */
    let pending = { top: root, rest: null }
    /** @type {List<readonly BindingId[]>} */
    let bindings = null
    /** @type {List<readonly LoopTarget[]>} */
    let loops = null
    /** @type {PersistentMap<string | bigint, number>} */
    let literals = empty
    /** @type {PersistentMap<PreparedFunction, _StaticBindings>} */
    let staticFunctions = empty
    /** @type {_StaticBindings} */
    let staticBindings = empty
    /** @type {_Names['containers']} */
    let containers = empty
    while (pending !== null) {
        /** @type {NonNullable<Stack<_Task | _ContainerVisit>>} */
        const { top, rest } = pending
        if (top.kind === 'container') {
            const container = containerOf(top.value, staticBindings, containers, staticFunctions)
            if (container !== null) {
                containers = mapSet(containers, top.value, container)
                if (top.id !== null) { staticBindings = mapSet(staticBindings, top.id, { definition: container, id: top.id }) }
            }
            pending = rest
            continue
        }
        let tail = rest
        if (root.context.native) {
            if (top.context.moduleInit && top.kind === 'statement' && top.statement[0] === 'define') {
                if (top.members !== undefined) {
                    const members = top.members
                    const known = staticBindings
                    const frames = members.map(fn => constantFrame(top.context, known, fn))
                    if (frames.every(frame => frame !== null)) {
                        const ids = /** @type {readonly BindingId[]} */ (members[0].group)
                        for (let i = 0; i < members.length; i += 1) {
                            const fn = members[Number(i)]
                            const id = ids[Number(i)]
                            staticFunctions = mapSet(staticFunctions, fn, /** @type {_StaticBindings} */ (frames[Number(i)]))
                            staticBindings = mapSet(staticBindings, id, { id, definition: { kind: 'Function', fn } })
                            const text = top.context.text(fn)
                            if (!mapHas(literals, text)) { literals = mapSet(literals, text, size(literals)) }
                        }
                    }
                }
                const [, id, value] = top.statement
                for (const item of staticEntry(staticBindings, value)) {
                    staticBindings = mapSet(staticBindings, id, item)
                }
            }
            const v = top.kind === 'value' ? top.value : null
            if (top.context.moduleInit && v instanceof Array) {
                const owner = top.context.owner
                const def = owner?.[0] === 'define' && owner[2] === v ? owner[1] : null
                if (v[0] === 'function') {
                    const frame = constantFrame(top.context, staticBindings, v[1])
                    if (frame !== null) {
                        staticFunctions = mapSet(staticFunctions, v[1], frame)
                        if (def !== null) { staticBindings = mapSet(staticBindings, def, { id: def, definition: { kind: 'Function', fn: v[1] } }) }
                    }
                } else if (v[0] === 'array' || v[0] === 'object') {
                    tail = { top: { kind: 'container', value: v, id: def }, rest }
                }
            }
            for (const value of instructionLiterals(top)) {
                if (!mapHas(literals, value)) { literals = mapSet(literals, value, size(literals)) }
            }
        }
        bindings = { first: instructionBindings(top), tail: bindings }
        loops = { first: instructionLoops(top), tail: loops }
        pending = pushAll(children(top), tail)
    }
    return {
        literals, staticFunctions, staticBindings, containers,
        bindings: identityNames(setValues(fromValues(listToArray(bindings).toReversed().flat())), '_b'),
        loops: identityNames(setValues(fromValues(listToArray(loops).toReversed().flat())), '_loop'),
    }
}

/** Allocate target names once, then render through the explicit spelling stack. @type {(root: _Task) => Result<_Output, readonly unknown[]>} */
const run = root => spellingWalk({ ...root, context: { ...root.context, names: namesOf(root) } })

/** Names used by the generated Rust text. @type {(uses: readonly Use[]) => Uses} */
const names = uses => ({
    vm: setValues(fromValues(uses.filter(([m]) => m === 'vm').map(([, n]) => n))).toSorted(),
    unstable: setValues(fromValues(uses.filter(([m]) => m === 'unstable').map(([, n]) => n))).toSorted(),
})

/** Immutable module locals can share a name. Transfer ownership at a final,
 * unconditional capture, array item or call operand. Reads in other regions still count
 * against earlier moves. A module-level memo may keep a borrow alive.
 * @type {(root: _Task) => NonNullable<_Context['ownership']>} */
const moduleOwnership = root => {
    /** @type {PersistentMap<BindingId, BindingId>} */
    let aliases = empty
    /** @type {PersistentMap<BindingId, Statement | null>} */
    let moves = empty
    let borrowed = false
    for (const child of children(root)) {
        const st = child.kind === 'statement' ? child.statement : null
        const def = st !== null && st[0] === 'define' ? st : null
        const value = def?.[2]
        if (def !== null && value instanceof Array && value[0] === 'ref' && mapHas(moves, mapGet(aliases, value[1]) ?? value[1])) {
            aliases = mapSet(aliases, def[1], mapGet(aliases, value[1]) ?? value[1])
            continue
        }
        if (st?.[0] === 'memo') { borrowed = true }
        const operands = value instanceof Array && value[0] === 'function' ? value[1].captures.map(c => c.value)
            : value instanceof Array && value[0] === 'array' ? value[1]
                : value instanceof Array && value[0] === '()' ? [value[1], ...value[2]] : []
        const currentAliases = aliases
        const direct = fromValues(operands.flatMap(v => v instanceof Array && v[0] === 'ref' ? [mapGet(currentAliases, v[1]) ?? v[1]] : []))
        /** @type {PersistentMap<BindingId, boolean>} */
        let seen = empty
        /** @type {Stack<_Task>} */
        let pending = { top: child, rest: null }
        while (pending !== null) {
            /** @type {NonNullable<Stack<_Task>>} */
            const { top, rest } = pending
            const v = top.kind === 'value' ? top.value : undefined
            if (v instanceof Array && v[0] === 'ref') {
                const id = mapGet(aliases, v[1]) ?? v[1]
                if (mapHas(moves, id)) {
                    moves = mapSet(moves, id, !borrowed && mapHas(direct, id) && !mapHas(seen, id) ? def : null)
                    seen = mapSet(seen, id, true)
                }
            }
            // A function reads the outer locals only while constructing its frame.
            /** @type {readonly _Task[]} */
            const next = v instanceof Array && v[0] === 'function'
                ? v[1].captures.map(c => valueTask(top.context, c.value)) : children(top)
            pending = pushAll(next, rest)
        }
        if (def !== null) { moves = mapSet(moves, def[1], null) }
    }
    return { aliases, moves }
}

/** A prepared module/function body, retaining tagged text and import metadata. @type {(b: Block, options: Options, external?: readonly External[], native?: boolean) => Result<Scope, readonly unknown[]>} */
export const scopeTagged = (b, options, external = [], native = false) => {
    const task = blockTask({ ...options, native, moduleInit: native, bindings: external.map(e => [e.binding, [e.text, e.uses ?? []]]) }, b, true)
    const ids = namesOf(task)
    const declarations = mapEntries(ids.literals).map(([value, id]) => {
        const prefix = `${kw('static')} LITERAL_${id}: `
        if (typeof value === 'string') {
            const [tag, text] = asciiLiteral(value)
            return cat([prefix, vm('StaticString'), ' = ', ...tag === 'ok'
                ? [vm('ascii'), `(${str(text)});`]
                : [vm('utf16'), `(${slice(utf16Units(value))});`]])
        }
        return cat([prefix, vm('StaticBigInt'), ` = StaticBigInt { sign: nanvm_lib::sign::Sign::${value < 0n ? 'Negative' : 'Positive'}, words: ${slice(u64WordItems(value))} };`])
    })
    const rendered = /** @type {Result<Printed<readonly string[]>, readonly unknown[]>} */ (
        spellingWalk({ ...task, context: { ...task.context, names: ids, ownership: native ? moduleOwnership(task) : undefined } }))
    return mapOk((/** @type {Printed<readonly string[]>} */ [parts, uses]) => ({
        lines: [...declarations.map(([text]) => text), ...parts.flatMap(p => p.split('\n'))],
        uses: names([...uses, ...declarations.flatMap(([, imports]) => imports)]),
    }))(rendered)
}

/** The same prepared body as plain text. @type {(b: Block, options: Options, external?: readonly External[]) => Result<Scope, readonly unknown[]>} */
export const scope = (b, options, external = []) => mapOk(({ lines, uses }) => ({ lines: lines.map(untagged), uses }))(scopeTagged(b, options, external))

/** A prepared value, over externally established immutable bindings. @type {(v: Value, options: Options, external?: readonly External[], result?: boolean) => Result<Printed<string>, readonly unknown[]>} */
export const valueTagged = (v, options, external = [], result = false) => /** @type {Result<Printed<string>, readonly unknown[]>} */ (run(valueTask({ ...options, bindings: external.map(e => [e.binding, [e.text, e.uses ?? []]]) }, v, result)))

/** A required binding under a caller-supplied target name, using ordinary declaration spelling. @type {(name: string, value: Value, options: Options, external?: readonly External[]) => Result<Printed<string>, readonly unknown[]>} */
export const bindingTagged = (name, value, options, external = []) => declaration(name, false, valueTagged(value, options, external))

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
 *
 * @type {(uses: Uses, bound: string | null) => readonly string[]}
 */
export const useLinesTagged = ({ vm, unstable }, bound) => [
    ...(unstable.length === 0 ? [] : useLine('nanvm_lib::vm::unstable', unstable)),
    ...useLine('nanvm_lib::vm', setValues(fromValues(['Any', ...(bound === null ? [] : [bound]), ...vm])).toSorted()),
]

/** Import lines for the VM names reported by the serializer. @type {(uses: Uses, bound: string | null) => readonly string[]} */
export const useLines = (uses, bound) => useLinesTagged(uses, bound).map(untagged)
