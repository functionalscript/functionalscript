/**
 * Prints an EDAG `Exp` as a Rust expression against the `nanvm-lib` API.
 *
 * Shared by two generators that print the same node shapes for two different
 * purposes: [`../../nanvm/rust/module.f.mjs`](../../nanvm/rust/module.f.mjs)
 * prints the operator conformance corpus as `nanvm-lib/tests/test/gen.corpus/`,
 * and [`../../compiler/rust/module.f.mjs`](../../compiler/rust/module.f.mjs) prints a
 * compiled module's EDAG as the `.rs` output of `fjs compile`. Both need the
 * same literal rendering, the same operator tables, and the same binding
 * mechanism — a `let` per node, one line, one expression, each referenced by
 * name where it is used ({@link printer}) — so that mechanism lives here
 * once rather than drifting between two copies.
 *
 * What stays with each caller: the corpus's own names for the nodes it
 * shares, via `data.shared`, and everything about *why* a printer is invoked
 * — a test case, a whole module's `pub fn module<A: IVm>() -> Result<Any<A>,
 * Any<A>>`, whose statements {@link scope} prints.
 *
 * The printer is also the one module that knows which `nanvm_lib` names its
 * text spells: every piece it prints carries them ({@link Printed}), each
 * recorded where it is spelled, so {@link scope} reports them beside the
 * lines and {@link useLines} turns them into the `use` lines a caller needs.
 * The corpus has no use for them: its files open with
 * `use crate::harness::*;`, a glob over the hand-written harness's
 * re-export of the same names, so that no generated file lists what it
 * uses — and that copy is checked, since a name it lacks fails `cargo test`.
 *
 * @module
 *
 * @import { Exp, Index, OpId, Primitive, Properties } from '../types.ts'
 * @import { Printed, Printer, Scope, Use, Uses } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { f64Bits, i64Literal, stringLiteral, u64Words, utf16Literal } from '../../media/rust/module.f.mjs'
import { error, mapOk, ok, okList, okThen, unwrap } from '../../types/result/module.f.mjs'
import { lazyOp2Id } from '../module.f.mjs'
import { isIndex, maxLength } from '../../types/function/length/module.f.mjs'
import { tryFunctionText } from '../../compiler/serializer/module.f.mjs'
import { tagged, untagged } from '../../text/marked/module.f.mjs'

// The printed text is tagged (`tagged` in `fjs/text/marked`): the words,
// literals and numbers of the Rust it prints say what they are, and the
// public functions answer the plain text, `untagged`, as they always have.
// `scopeTagged` and the tagged text of this module's other entry points are
// what a producer of marked text resolves its runs from. What tagged text is,
// why public text is never tagged, and why data cannot forge a tag:
// `fjs/text/marked/README.md`, §4.

/** A Rust keyword, as the text spells it. */
const kw = tagged('keyword')

/** A literal word: `true`, `false`. */
const lit = tagged('literal')

/** A Rust string literal, with its quotes. */
const str = tagged('string')

/** A number literal: an `f64`'s bits, an `i64`. */
const num = tagged('number')

/**
 * Text spelling no `nanvm_lib` name of its own.
 *
 * @type {(text: string) => Printed<string>}
 */
const code = text => [text, []]

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
    return [printed.map(([text]) => text).join(''), printed.flatMap(([, uses]) => uses)]
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
 * @type {{ readonly [k in OpId]?: (a: string) => string | Printed<string> }}
 */
export const op1Rust = {
    '+': a => `Any::unary_plus(${a})`,
    '-': a => `-(${a})`,
    '!': a => `!(${a})`,
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
 * `&&`/`||`/`??` follow it for a third reason: Rust's own `&&`/`||` take
 * `bool` operands, and `?` is Rust's own try-operator, unrelated to JS `??`
 * — so all three are `Any` methods, named for what they do rather than
 * reusing punctuation Rust already owns. Their right operand arrives here
 * already a thunk, `|| …`, since the three are {@link lazy}: the
 * `nanvm-lib` method takes it as an `impl FnOnce() -> Result<Any<A>,
 * Any<A>>` and establishes it only when the left decides nothing. `>>>`
 * follows it for a fourth reason: Rust has no unsigned-right-shift operator
 * at all (only `>>`, which is arithmetic on a signed type), so it is
 * `Any::unsigned_right_shift`.
 *
 * An entry that spells a `nanvm_lib` name answers it with its text, and
 * one that spells none answers the text alone.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string) => string | Printed<string> }}
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
    '&&': (a, b) => `Any::logical_and(${a}, ${b})`,
    '||': (a, b) => `Any::logical_or(${a}, ${b})`,
    '??': (a, b) => `Any::nullish_coalescing(${a}, ${b})`,
    // `==` on `Any` *is* JavaScript's `===`, but it yields a `bool` and so
    // pins neither operand's `A`; `nanvm_lib::vm::unstable`'s `strict_eq`
    // and `strict_ne` lift the answer into the `Result` every other
    // operator returns.
    '===': (a, b) => cat([unstable('strict_eq'), `(${a}, ${b})`]),
    '!==': (a, b) => cat([unstable('strict_ne'), `(${a}, ${b})`]),
    // `Object.is` is `SameValue`, which no Rust operator spells; like `===`
    // its `Any::same_value` answers a `bool`, and `object_is` lifts it into
    // the `Result` every operator returns.
    is: (a, b) => cat([unstable('object_is'), `(${a}, ${b})`]),
}

/**
 * The same, for the one ternary operation (`?:`) — another method, for the
 * same reason as `&&`/`||`/`??`: Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 * Both arms arrive as thunks, `?:` being {@link lazy}: `Any::conditional`
 * establishes the one its condition selects.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string, c: string) => string | Printed<string> }}
 */
export const op3Rust = {
    '?:': (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

/**
 * The operations that establish every operand after the first only
 * conditionally: `&&`, `||` and `??` establish the right operand only if the
 * left decides nothing, and `?:` establishes the one arm its condition
 * selects — the EDAG's positional laziness, as `op2Id` and `op3Id` in
 * [`../module.f.mjs`](../module.f.mjs) state it. The binary three are
 * `lazyOp2Id` from there rather than a copy, so the printer cannot thunk a
 * different set from the one the executor defers. In each the deciding
 * operand comes first and every later one is lazy, which is the rule the
 * printer prints by: a lazy operand is a thunk — `|| Ok(…)` around a value,
 * or an operation's own `Result` bare — the `impl FnOnce() ->
 * Result<Any<A>, Any<A>>` the four `nanvm-lib` methods take. The
 * signature is the guard: an operand printed as a value where a thunk is
 * due does not compile, so a printer that establishes one eagerly is caught
 * by `rustc` rather than trusted.
 *
 * The chain nodes have lazy positions of their own, {@link lazyOperandsOf}:
 * a `?.` or `?.()` node's key or arguments and its continuation's operands
 * are inside the region the node opens, and a `.` node's continuation is a
 * call whose arguments a throw at the access leaves untouched. They are
 * not in this list because their eager positions are not the first operand
 * alone — a `.` node's receiver *and* key are eager — so
 * {@link eagerOperandsOf} states each tag's rule.
 *
 * @type {readonly string[]}
 */
const lazy = [...lazyOp2Id, '?:']

/**
 * `true` for the tag of a node that opens a chain: `.`, `?.` and `?.()`,
 * the three whose last operand may be a continuation (`fjs/edag/README.md`,
 * Chains). Each prints as its `nanvm-lib` entry point — `Any::dot`,
 * `Any::option_dot`, `Any::option_call` — followed by one method per step
 * and closed by `.end()` or `.end_call(…)`: one expression, a method chain,
 * which binds tighter than any infix operator and so is atomic as an
 * operand.
 *
 * @type {(id: unknown) => boolean}
 */
const isChain = id => id === '.' || id === '?.' || id === '?.()'

/**
 * What a key names in this printer, or the refusal: a key with no entry is a
 * gap here, not a case to print a plausible wrong statement for — a `Result`
 * rather than a thrown value, since a gap in what `nanvm-lib` implements is
 * an ordinary, expected outcome for a compiler to report, not a bug in this
 * printer to panic over (`fjs/AGENTS.md` §1.5: FunctionalScript has no
 * `try`/`catch`, so a thrown value is never caught and recovered from by
 * FunctionalScript code — only `Result` is).
 *
 * @type {<K extends string, T>(table: { readonly [k in K]?: T }) => (id: K) => Result<Printed<T>, readonly unknown[]>}
 */
const lookup = table => id => {
    const v = table[id]
    return v === undefined ? error(['no Rust for', id]) : ok([v, []])
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
const map2 = f => (ra, rb) => okThen(([a, ua]) => mapOk(([b, ub]) => /** @type {const} */ ([f(a, b), [...ua, ...ub]]))(rb))(ra)

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
    /** @type {const} */ ([items.map(([v]) => v), items.flatMap(([, uses]) => uses)]))(okList(list))

/**
 * A printed value whose own value is printed text with names of its own,
 * as that text with both sets of names: what a piece built through
 * {@link cat} over printed operands answers.
 *
 * @type {(r: Result<Printed<string | Printed<string>>, readonly unknown[]>) => Result<Printed<string>, readonly unknown[]>}
 */
const flat = mapOk(([v, uses]) => {
    const [text, own] = typeof v === 'string' ? code(v) : v
    return [text, [...uses, ...own]]
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
    return r[0] === 'ok' ? cat([unstable(name), `(${str(r[1])})`]) : cat([unstable(`${name}_utf16`), `(${utf16Literal(v)})`])
}

/**
 * Fixed argument `k` of the function being called, read from the `args`
 * parameter of the closure {@link closure} prints: `undefined` past the end
 * of a short call, as JavaScript binds a missing argument.
 *
 * @type {(k: number) => Printed<string>}
 */
const argRead = k => cat([`args.clone().into_iter().${k === 0 ? 'next()' : `nth(${k})`}.unwrap_or_else(|| `, undefinedAny, ')'])

/**
 * A function's source text as the `Option<&'static str>` `IStaticFunction`
 * takes: `Some` over the FunctionalScript writer's spelling
 * (`tryFunctionText`, its captured slots `$0`, `$1`, …), always a `&str`
 * since the writer escapes a lone surrogate, and `None` for a body the
 * writer refuses. `None` is not a guess: the VM refuses the function's
 * `ToPrimitive` (`FUNCTION_TEXT`) rather than answer a text.
 *
 * @type {(e: Exp) => string}
 */
const textExpr = e => {
    const t = tryFunctionText(e)
    return t[0] === 'ok' ? `Some(${str(unwrap(stringLiteral(t[1])))})` : 'None'
}

/**
 * The same for a bigint: `bigint_any` over an `i64` literal where the value
 * fits one, and `bigint_any_words` over its sign and `u64` words where it does
 * not, so no bigint is refused.
 *
 * @type {(v: bigint) => Printed<string>}
 */
const bigintExpr = v => {
    const r = i64Literal(v)
    return r[0] === 'ok' ? cat([unstable('bigint_any'), `(${num(r[1])})`]) : cat([unstable('bigint_any_words'), `(${lit(`${v < 0n}`)}, ${u64Words(v)})`])
}

/**
 * A number, as the `Any<A>` `f64_any` builds from its bits.
 *
 * @type {(v: number) => Printed<string>}
 */
const numberExpr = v => cat([unstable('f64_any'), `(${num(f64Bits(v))})`])

/** @type {(v: Primitive) => Result<Printed<string>, readonly unknown[]>} */
const primitiveExpr = v => {
    if (v === null) { return ok(cat([vm('Nullish'), '::Null', toAny])) }
    switch (typeof v) {
        case 'boolean': { return ok(cat([lit(`${v}`), toAny])) }
        case 'number': { return ok(numberExpr(v)) }
        case 'string': { return ok(stringCall('string_any')(v)) }
        case 'bigint': { return ok(bigintExpr(v)) }
    }
}

/**
 * An object key.
 *
 * An EDAG object key is an `exp` — one form for `a:`, `"a":`, and computed
 * `[exp]:` keys alike. A string literal is the `string_key` a property takes;
 * any other key is computed, and `computed_item` coerces it.
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

/**
 * The indentation of one level of generated Rust: a scope's statements
 * inside their function, a block's lines inside its braces.
 */
export const indent = '    '

/**
 * A block's statements as one Rust block expression: `{ … }` around a
 * lone statement, or the statements one under another, indented, with the
 * braces on lines of their own — a closure's body, and a thunk's once it
 * holds a `let`. A statement is one line unless it holds a block of its
 * own, a function's closure, so the indentation is of lines.
 *
 * @type {(statements: readonly string[]) => string}
 */
export const braced = statements => statements.length === 1
    ? `{ ${statements[0]} }`
    : `{\n${lines(statements).map(l => `${indent}${l}`).join('\n')}\n}`

/**
 * The lines of a list of statements, one of which may span several.
 *
 * @type {(statements: readonly string[]) => readonly string[]}
 */
const lines = statements => statements.flatMap(s => s.split('\n'))

/**
 * `true` for a node whose construction evaluates no operands: `undefined`,
 * argument and frame reads, an empty array or object, and `() => undefined`
 * with no captures. A primitive is the other atom, and never a node
 * {@link visit} lists, so never asked. Every
 * other node holds its operands' text, and is a temporary of its scope
 * ({@link printer}); an atom is written where it stands, unless it is
 * reached from more than one place, when it is a temporary too, so that
 * an empty container's references share the one identity they do in
 * JavaScript.
 *
 * @type {(e: Exp) => boolean}
 */
const atomic = e => {
    const [id, a, b, c] = /** @type {readonly any[]} */ (e)
    return ['undefined', 'args', 'frame', 'arg', 'rest', 'self'].includes(id)
        || (['[]', '{}'].includes(id) && a.length === 0)
        || (id === '=>' && a === 0 && isSmallestLambda(b, c))
}

/**
 * `true` for a member of a literal rather than a value: a property,
 * `[':', key, value]`, or a spread, `['...', exp]`.
 *
 * @type {(e: unknown) => boolean}
 */
const isMember = e => e instanceof Array && [':', '...'].includes(e[0])

/**
 * An item list read as the operands it holds: each member's own, in its
 * place — a spread's operand, a property's key and value — and every other
 * item as itself. A member is no node: one pair object may stand in a
 * list twice, `[s, s]`, and its operand is then reached twice, so a walk
 * counts it per occurrence, as the printer prints it.
 *
 * @type {(list: readonly unknown[]) => readonly unknown[]}
 */
const members = list => list.flatMap(x => isMember(x) ? /** @type {readonly unknown[]} */ (x).slice(1) : [x])

/** @type {(e: Exp) => boolean} */
const isComma = e => e instanceof Array && e[0] === ','

/**
 * `true` for an object's entries holding a property whose key is not a
 * string literal: its key is coerced when the entry is built, which can
 * throw, so the entries go through `computed_item`'s `spread_object`.
 *
 * @type {(entries: readonly Properties[]) => boolean}
 */
const hasComputedKey = entries => entries.some(p => p[0] === ':' && typeof p[1] !== 'string')

/**
 * `true` for an item list holding a spread, an `[]` node's or a call's:
 * one that can throw, since a spread of what is not iterable does
 * (`Any::get_iterator`), where a list of values cannot.
 *
 * @type {(items: readonly unknown[]) => boolean}
 */
const hasSpread = items => items.some(x => x instanceof Array && x[0] === '...')

/**
 * `true` for a node that prints through an operation's `nanvm-lib` call,
 * answering a `Result`: a `.` read, a call, an operator node, or an array
 * holding a spread — every node but the value shapes, which construct an
 * `Any` directly.
 *
 * @type {(e: Exp) => boolean}
 */
const isOperation = e => e instanceof Array
    && (!['undefined', 'args', 'frame', 'arg', 'rest', 'self', 'entry', '[]', '{}', '=>', ',', ':', '...'].includes(e[0])
        || (e[0] === '[]' && hasSpread(/** @type {readonly unknown[]} */ (e[1]))))

/**
 * A comma's last operand, its value.
 *
 * @type {(e: Exp) => Exp}
 */
const last = e => {
    const operands = /** @type {readonly Exp[]} */ (/** @type {readonly any[]} */ (e)[1])
    return operands[operands.length - 1]
}

/**
 * The line binding a function's rest parameters, the arguments after its
 * `length` fixed ones, as the `Array<A>` a `['rest']` read clones.
 *
 * @type {(length: number) => Printed<string>}
 */
const restLine = length => cat([`${kw('let')} rest = args.clone().into_iter()${length === 0 ? '' : `.skip(${length})`}`, toArray, ';'])

/**
 * The printer for the EDAG under `root`, or the refusal of a shape this
 * printer has no `nanvm-lib` spelling for: a node shared but reached only
 * through lazy operands, or an empty comma. Never throws — every gap here
 * and below is an ordinary `Result`, since FunctionalScript has no
 * `try`/`catch` to recover a thrown value with (`fjs/AGENTS.md` §1.5), and
 * a node shape a caller's input happens to use is an expected outcome for
 * a compiler to report, not a bug in this printer to panic over. A caller
 * that wants the old throwing convenience —
 * `fjs/nanvm/rust/module.f.mjs`'s dev-tool generation over a fixed,
 * already-valid corpus, where a gap *is* a bug — wraps the `Result` with
 * `unwrap` itself.
 *
 * `shared` names the nodes the caller has already bound, the corpus's own
 * named values: each is its binding's `.clone()` wherever it stands, and
 * the walk stops at it, its construction being its binder's.
 *
 * Every other node with operands is a temporary of its scope — `let c0`,
 * `c1`, … in dependency order, one line, one expression — so a node's
 * text holds only atoms ({@link atomic}) and the names of the temporaries
 * before it, a name moved where it is the node's only reference and cloned
 * where it has more. An operation's `let` follows its call with `?`, so
 * the temporary is an `Any<A>` and a throw propagates to the enclosing
 * function, which answers the same `Result`; an operator's text is
 * parenthesized before the `?`, since `?` binds tighter than any infix
 * operator, and a `.` read or a call is a call already and needs none.
 * Every use
 * site fixes `A`, so no expression needs a turbofish: the operators take
 * `Any<A>` arguments and every `let` is annotated.
 *
 * The lines are a {@link block}'s: the scope's root binds every temporary
 * it reaches eagerly, then answers its own value, and a lazy operand's
 * thunk — itself a temporary, `let cN = || …;`, once it has a body of its
 * own — binds the temporaries only it reaches, inside its closure, so
 * nothing is established before the program establishes it. That is what
 * the refusal above checks: a node shared but eager from no block's root
 * has no block to bind it in — `[a && c, b && c]` establishes `c` in
 * either thunk or neither, and a `let` before the root would establish it
 * whatever `a` and `b` are. A node one thunk's root reaches eagerly, and
 * nothing outside that thunk reaches at all, binds in that thunk's block —
 * `true ? 1 : [c, c]` answers `1` without establishing `c`, and the else
 * arm's block establishes it exactly when the arm is taken — which is the
 * shape a `const` inside an arm lowers to: `true ? 1 : (() => { const c =
 * [1]; return [c, c]; })()`, its call inlined by
 * [`fjs/compiler/edag`](../../compiler/edag/module.f.mjs). Every other
 * shared node the lowering links is eager from the scope's root, an
 * implicitly shared node being a `const` referenced twice, which
 * JavaScript establishes at its declaration whatever the operators around
 * its uses do, and which the eager-restricted reference sweep of `anchors`
 * ([`fjs/compiler/ast`](../../compiler/ast/module.f.mjs)) anchors through
 * the comma root when reached only lazily — an eager reach, so the binding
 * is right again. An {@link atomic} node is the exception: its construction
 * establishes nothing the program could skip — `args` is the closure's
 * parameter, already bound, and `undefined` or an empty container is a
 * value no evaluation precedes — so one shared only through lazy operands
 * is not refused but bound by the scope's block before the root, where
 * every thunk reaching it clones the one binding. `(...a) => true ? a :
 * a` is the shape: its `args` is no `const` for `anchors` to anchor, and
 * needs none.
 *
 * `nested` is the corpus's mode: the root prints as one expression, its
 * operation the bare `Result<Any<A>, Any<A>>` the `nanvm-lib` call answers
 * — for a statement that consumes the `Result` itself, the corpus's
 * `check` — and every eager node where it stands, nested as the node is,
 * since a bare statement is one expression with no line before it to bind
 * on; only a lazy operand's nodes, which its thunk's block can bind, are
 * temporaries there. A composed operand is parenthesized then, since
 * `a * b * c` is not `a * (b * c)` — see {@link composed}.
 *
 * @type {(nested: boolean) => (shared: readonly (readonly[Exp, string])[]) => (root: Exp) => Result<Printer, readonly unknown[]>}
 */
const printer = nested => shared => root => {
    /** @type {(e: Exp) => boolean} */
    const isBound = e => shared.some(([n]) => n === e)
    /**
     * The nodes under `root` the caller has not bound, in dependency order,
     * each with how many places reach it — {@link visit}, stopping at a
     * bound node.
     */
    /** @type {(node: readonly unknown[]) => readonly unknown[]} */
    const children = node => isBound(/** @type {Exp} */ (/** @type {unknown} */ (node))) ? [] : operandsOf(node)
    const order = visit(children)([])(root).filter(([n]) => !isBound(n))
    const eager = eagerNodesOf(root)
    /** The argument lists the nodes under `root` hold, each a thunk's root ({@link argListsOf}). */
    const argLists = order.flatMap(([n]) => argListsOf(/** @type {readonly unknown[]} */ (/** @type {unknown} */ (n))))
    /** @type {(e: Exp) => boolean} */
    const isArgs = e => argLists.includes(e)
    /**
     * The nodes a thunk's root reaches eagerly: an argument list's items',
     * the list being no node, and any other root's own, {@link eagerNodesOf}.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const reached = e => isArgs(e) ? members(/** @type {readonly unknown[]} */ (e)).reduce(reach, []) : eagerNodesOf(e)
    /**
     * The nodes under a thunk's root, each with how many places reach it,
     * {@link visit}'s count: an argument list's items', the list being no
     * node, and any other root's own.
     *
     * @type {(e: Exp) => readonly (readonly [node: Exp, count: number])[]}
     */
    const visited = e => isArgs(e)
        ? members(/** @type {readonly unknown[]} */ (e)).reduce((/** @type {readonly (readonly [Exp, number])[]} */ v, child) => visit(children)(v)(child), [])
        : visit(children)([])(e)
    /**
     * The nodes a block over `e` holds: the ones `e` reaches eagerly,
     * {@link reached}, and the thunk over every lazy operand of an
     * operation among them, which the block makes where the operation is.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const held = e => {
        const r = reached(e)
        return [...r, ...r.flatMap(lazyOperandsOf)]
    }
    /**
     * Every lazy operand nothing establishes eagerly: the root of its
     * thunk's block. A lazy operand also reached eagerly is an ordinary
     * temporary, and its thunk answers the name.
     */
    const thunks = order.flatMap(([n]) => lazyOperandsOf(n)).filter(o => !eager.includes(o))
    /**
     * The thunk whose block binds a node the scope's root reaches only
     * through lazy operands: the one whose own root reaches the node
     * eagerly and outside which nothing reaches it — every place reaching
     * it under the thunk, counted as {@link visit} counted them under the
     * scope's root — so that a binding in that block is established
     * exactly when the program establishes the node. `undefined` where no
     * thunk is that: a node two thunks reach, or one a thunk is.
     *
     * @type {(n: Exp) => Exp | undefined}
     */
    const owner = n => thunks.find(t => reached(t).includes(n)
        && visited(t).some(([m, count]) => m === n && order.some(([o, total]) => o === n && total === count)))
    const lazyOnly = order.find(([n, count]) => count >= 2 && !eager.includes(n) && !atomic(n) && owner(n) === undefined)
    if (lazyOnly !== undefined) {
        return error(['no Rust for a shared node reached only through lazy operands; a `let` binding would establish what the program may not', lazyOnly[0]])
    }
    // `Exps` admits an empty operand list in the schema (shape-only, per
    // `fjs/edag/types.ts`), but the Rust backend has no value to give an
    // empty comma — `resolve` in `fjs/compiler/edag/module.f.mjs` never anchors
    // zero operands anyway, always the export among them, so refusing here
    // loses no real input.
    const emptyComma = order.find(([n]) => isComma(n) && /** @type {readonly any[]} */ (n)[1].length === 0)
    if (emptyComma !== undefined) { return error(['no Rust for an empty comma', emptyComma[0]]) }
    /** @type {(e: Exp) => boolean} */
    const isShared = e => order.some(([n, count]) => n === e && count >= 2)
    /**
     * `e` and the nodes printed where it is: through a comma, its last
     * operand, whose value the comma's is — unless that operand is shared,
     * when it is a temporary the comma answers by name.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const valueNodes = e => isArgs(e) || !isComma(e) || isShared(last(e)) ? [e] : [e, ...valueNodes(last(e))]
    /** @type {(e: Exp) => boolean} */
    const isThunk = e => thunks.includes(e)
    /**
     * The nodes printed where they stand as a block's own answer, never a
     * temporary: the scope's root, and — in the corpus's mode, where a
     * thunk stands in its statement — every thunk's root; otherwise a
     * thunk is a temporary of its own, `let cN = || …;`, and only what a
     * root answers through a comma stands.
     */
    const structural = [root, ...thunks].flatMap(valueNodes).filter(n => nested || !isThunk(n))
    /** The nodes printed where they stand, nested: every eager one in the corpus's mode; none otherwise. */
    const inline = nested ? eager : []
    /**
     * The operands before the last of every comma answering by its last
     * operand's value: established for what they anchor, referenced by
     * nothing, and so each a temporary named `_`.
     */
    const discarded = order.flatMap(([n]) => isComma(n) && !inline.includes(n)
        ? /** @type {readonly Exp[]} */ (/** @type {readonly any[]} */ (n)[1].slice(0, -1))
        : [])
    /**
     * The temporaries in dependency order, each with how many places
     * reference it by name: among the nodes, and each argument list right
     * before the chain holding it, after its items — a thunk's root, which
     * is a temporary as any thunk is, and reached from one place, unless it
     * is empty, an atom's thunk.
     *
     * @type {readonly (readonly [node: Exp, refs: number])[]}
     */
    const temporaries = order.flatMap(entry => [
        ...argListsOf(/** @type {readonly unknown[]} */ (/** @type {unknown} */ (entry[0])))
            .map(list => /** @type {readonly [Exp, number]} */ ([list, 1])),
        entry,
    ]).flatMap(([n, count]) =>
        (isArgs(n) ? /** @type {readonly unknown[]} */ (n).length === 0 : (atomic(n) && count < 2))
            || structural.includes(n) || inline.includes(n)
            ? []
            : [/** @type {readonly [Exp, number]} */ ([n, count - discarded.filter(d => d === n).length])])
    /** @type {(e: Exp) => boolean} */
    const isTemporary = e => temporaries.some(([n]) => n === e)
    /**
     * What the scope's own block holds, established before the root as a
     * `const` is at its declaration: what the root holds, and every shared
     * atom under it wherever it is reached — bound once by the scope, for
     * the thunks that reach it to clone, since binding one early
     * establishes nothing (see above).
     */
    const outer = [...held(root), ...order.flatMap(([n, count]) => atomic(n) && count >= 2 ? [n] : [])]
    /**
     * The temporaries `e`'s block binds, in dependency order: the ones it
     * holds — every one, for the scope's root; for a thunk's root, less the
     * ones the scope's block already holds — a value reached eagerly
     * elsewhere, a shared atom, and the thunks over that value's own lazy
     * operands, which the scope's block makes where the value is — and
     * less the thunk itself, the block's own answer.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const declaredBy = e => {
        const own = e === root ? outer : held(e)
        return temporaries.filter(([n]) => n !== e && own.includes(n) && (e === root || !outer.includes(n))).map(([n]) => n)
    }
    /**
     * The temporaries in the order their `let` lines print: a block's own,
     * a thunk's block's right after the thunk's own `let` — or, where the
     * thunk stands in its statement, in the statement's place.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const printOrder = e => [
        ...declaredBy(e).flatMap(n => isThunk(n) ? [n, ...printOrder(n)] : [n]),
        ...held(e).filter(n => n !== e && isThunk(n) && !isTemporary(n)).flatMap(printOrder),
    ]
    const named = printOrder(root).filter(n => temporaries.some(([m, refs]) => m === n && refs > 0))
    /**
     * A temporary's name: `c0`, `c1`, … in the order the `let` lines
     * print, or `_` for one nothing references, a comma's discarded
     * operand.
     *
     * @type {(n: Exp) => string}
     */
    const nameOf = n => {
        const i = named.indexOf(n)
        return i === -1 ? '_' : `c${i}`
    }
    /**
     * Every value printed by name where it is referenced: the caller's
     * bindings, and each temporary but a thunk — a closure, not an `Any`,
     * named by {@link lazyOperand} alone — moved where the reference is
     * its only one and cloned where it has more.
     *
     * @type {readonly (readonly [Exp, string])[]}
     */
    const bound = [...shared, ...temporaries.filter(([n]) => !isThunk(n)).map(([n, refs]) =>
        /** @type {readonly [Exp, string]} */ ([n, refs >= 2 ? `${nameOf(n)}.clone()` : nameOf(n)]))]
    /**
     * A node's text where it is referenced: a primitive's literal, a bound
     * node's name, and any other node's own construction — the scope's
     * root, a thunk's, or an eager node in the corpus's mode, nested as it
     * is.
     *
     * @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const b = bound.find(([n]) => n === e)
        return b === undefined ? node(e) : plain(b[1])
    }
    /**
     * A node's own construction, its operands referenced through {@link f}:
     * a value's, and an operation's bare `Result` — what a temporary's
     * `let` binds, with the `?` {@link letLine} adds, and what a node
     * printed where it stands is.
     *
     * @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const node = e => {
        const [id, a, b, c] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return ok(undefinedAny) }
        // The arguments a function was called with: the `args` parameter of
        // the closure {@link closure} prints, an `Array<A>` — as a value, an
        // `Rc`-cheap clone of it. An indexed read, `a[0]` or `a.length`, is
        // an ordinary `.` node over this, `Any::dot(…).end()` answering
        // `undefined` past the end as JavaScript does.
        if (id === 'args') { return ok(cat(['args.clone()', toAny])) }
        if (id === 'rest') { return ok(cat(['rest.clone()', toAny])) }
        if (id === 'arg') { return ok(argRead(a)) }
        // The `entry` helper as a value: the closure `A::static_function`
        // binds, as {@link closure} binds every function, answering
        // `Any::entry` of its two fixed arguments — `nanvm-lib`'s own
        // implementation of the helper's body — under the text the writer
        // gives the helper, {@link textExpr}, the one every function's
        // `ToPrimitive` answers with.
        if (id === 'entry') {
            return ok(cat(['A::static_function(|_self, args| Any::entry(', argRead(0), ', ', argRead(1), '), 2, ', vm('Array'), `::default(), ${textExpr(e)})`, toAny]))
        }
        // Slot `i` of the frame the function was built with, read through
        // the closure's `self_` parameter, {@link closure}: the `Array<A>`
        // {@link frameExpr} built, indexed directly — the slot exists, since
        // `checked` refuses a read past the slots, so no `undefined`
        // case as an `args` read has.
        if (id === 'frame') { return plain(`A::frame(self_)[${a}].clone()`) }
        // The function itself, as a value: the closure's `self_` parameter
        // wrapped as the `Function` it is, an `Rc`-cheap clone of the one
        // value every read of `self` is — the identity JavaScript gives a
        // function for its lifetime, which `nanvm-lib/todo/callable-function-objects.md`
        // asks for by threading that handle rather than rebuilding one.
        if (id === 'self') { return ok(cat([vm('Function'), '::new(self_.clone())', toAny])) }
        if (id === '[]' && !hasSpread(a)) { return arrayExpr(a) }
        if (id === '{}') {
            // The corpus's bare expression has no Result-returning scope
            // for computed_item's `?`. See todo/computed-key-corpus.md.
            if (nested && hasComputedKey(a)) { return error(['no Rust for computed object keys in corpus mode; use scope', e]) }
            return a.length === 0 ? ok(cat([vm('Object'), '::default()', toAny]))
                : hasSpread(a) || hasComputedKey(a) ? flat(map1((/** @type {readonly string[]} */ items) => cat([unstable('spread_object'), `([${items.join(', ')}])`]))(all(a.map(
                    (/** @type {Properties} */ p) => p[0] === '...' ? flat(map1(v => cat([unstable('spread_entries'), `(${v})`]))(f(p[1]))) : propertyExpr(unstable('property_item'))(p)))))
                : flat(map1((/** @type {readonly string[]} */ items) => cat([`[${items.join(', ')}]`, toObject, toAny]))(all(a.map(propertyExpr(code(''))))))
        }
        if (id === ',') {
            // A comma is its last operand's value, the operands before it
            // established in order — some purely for what they anchor, per
            // `resolve` — and discarded. Where it stands nested, in the
            // corpus's mode, that is a Rust block expression; each
            // discarded operand is bound to `let _: Any<A>` rather than
            // left a bare statement, since unbound and unused, rustc has
            // nothing to unify a generic constructor call's `A` against
            // (`Array::default()` needs one) and refuses to infer it.
            // Anywhere else the discarded operands are temporaries of the
            // block, named `_` ({@link nameOf}), and the comma is its last
            // operand's text.
            return inline.includes(e)
                ? map1((/** @type {readonly string[]} */ parts) => {
                    const before = parts.slice(0, -1).map(s => `${kw('let')} _: Any<A> = ${s}; `).join('')
                    return `{ ${before}${parts[parts.length - 1]} }`
                })(all(a.map(f)))
                : f(last(e))
        }
        if (id === '=>') {
            // A fragment has no complete graph for `checked`, so the
            // language's limit is checked here too; IStaticFunction's u32
            // holds every length it admits.
            if (a > maxLength) { return error([`a function length above ${maxLength}`, a]) }
            // A slot the frame does not have, likewise: `checked`
            // refuses it in a complete graph, and a fragment is refused
            // here, since the index the body would print panics in
            // `nanvm-lib` where the JavaScript executors throw.
            const past = slotReads(c).find(i => !isIndex(i) || i >= b.length)
            if (past !== undefined) { return error(['no Rust for a frame slot the frame does not have', past]) }
            // Only the corpus's expression mode has the `function_any`
            // harness helper. A module scope constructs every function
            // through the VM, including `() => undefined`.
            return nested && a === 0 && isSmallestLambda(b, c) ? plain('function_any()') : closure(a, c, textExpr(e))(frameExpr(b))
        }
        return bare(/** @type {readonly any[]} */ (e))
    }
    /**
     * An item list as the array it builds, an `[]` node's and a call's
     * arguments alike.
     *
     * @type {(a: readonly Exp[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const arrayExpr = a => a.length === 0
        ? ok(cat([vm('Array'), '::default()', toAny]))
        : flat(map1((/** @type {readonly string[]} */ items) => cat([`[${items.join(', ')}]`, toArray, toAny]))(all(a.map(f))))
    /**
     * An item list holding a spread, as the item array the
     * `vm::unstable` helpers take: `value_item(…)` for a value and
     * `spread_item(…)` for a spread's operand, in order.
     *
     * Every item is an operand of the list, evaluated before the helper
     * runs, so a later item that throws — `null.x` in `[...1, null.x]` — is
     * reported before the spread's own `TypeError`, where JavaScript stops at
     * the spread. That is one outcome (`spec/README.md`, "Failure is one
     * outcome"): the first failing operation is no observation, and the
     * reordering cannot make either program succeed, since every item is
     * evaluated when none throws. So no source-order barrier is imposed,
     * as none is for any other temporary.
     *
     * @type {(a: readonly any[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const itemsExpr = a => map1((/** @type {readonly string[]} */ items) => `[${items.join(', ')}]`)(all(a.map(x =>
        x instanceof Array && x[0] === '...'
            ? flat(map1(v => cat([unstable('spread_item'), `(${v})`]))(f(x[1])))
            : flat(map1(v => cat([unstable('value_item'), `(${v})`]))(f(x))))))
    /**
     * An item list holding a spread, as the array `spread_array` builds
     * from it, a `Result` since a spread may throw.
     *
     * @type {(a: readonly any[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const spreadArray = a => flat(map1(x => cat([unstable('spread_array'), `(${x})`]))(itemsExpr(a)))
    /**
     * A function, `['=>', length, slots, body]`, as a function value: a closure
     * bound through `IStaticFunction`, the `StaticCode<A>` signature's two
     * parameters, the EDAG's fixed parameter count, and its frame, the
     * `Array<A>` {@link frameExpr} prints from the slots in the scope around
     * it. Rest is
     * materialized once per invocation, after that fixed prefix. A
     * closure that captures nothing of Rust's coerces to the `fn` pointer
     * `StaticCode<A>` is, and rustc infers its parameters from it, so the
     * text declares no types.
     *
     * The body is a scope of its own, printed as one by {@link scope}: its
     * own temporaries, restarting at `c0`, and its own `Ok(…)`, every
     * operation inside propagating into the closure's `Result`; the
     * statements are {@link braced}, one under another once there is a
     * `let` among them. That is sound because the lowering shares no node
     * across a function boundary (`fjs/edag/analysis`'s scope rule), so
     * the closure references nothing of the scope around it — which is
     * also what lets it coerce.
     *
     * `args` is the closure's parameter, named `_args` where the body never
     * reads it — {@link readsArgs}, this body's own reads and not a nested
     * function's — and `self_`, through which the body reads its frame,
     * `_self` where it never does, {@link readsFrame}: an unused parameter
     * under `-D warnings` is otherwise an error in the crate the module
     * lands in.
     *
     * `text` is the function's source text, {@link textExpr}.
     *
     * @type {(length: number, body: Exp, text: string) => (frame: Result<Printed<string>, readonly unknown[]>) => Result<Printed<string>, readonly unknown[]>}
     */
    const closure = (length, body, text) => frame => flat(map2((/** @type {readonly string[]} */ lines, /** @type {string} */ fr) =>
        cat([`A::static_function(|${readsFrame(body) || readsSelf(body) ? 'self_' : '_self'}, ${readsArgs(body) ? 'args' : '_args'}| ${braced(lines)}, ${length}, ${fr}, ${text})`, toAny])
    )(reads('rest')(body) ? map2((/** @type {string} */ rest, /** @type {readonly string[]} */ s) => [rest, ...s])(ok(restLine(length)), statements(body)) : statements(body), frame))
    /**
     * A function's frame as the `Array<A>` its construction takes: the
     * empty `Array::default()` for no slots, and otherwise the slots, each
     * a value of the scope around the function, collected by `to_array`.
     *
     * @type {(slots: readonly Exp[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const frameExpr = slots => slots.length === 0
        ? ok(cat([vm('Array'), '::default()']))
        : flat(map1((/** @type {readonly string[]} */ xs) => cat([`[${xs.join(', ')}]`, toArray]))(all(slots.map(f))))
    /**
     * An operation — a `.` read, a call, or an operator node — as the bare
     * `Result<Any<A>, Any<A>>` its `nanvm-lib` call answers, or the
     * refusal: a block's own answer, or a `let`'s initializer before its
     * `?`.
     *
     * @type {(e: readonly any[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const bare = e => {
        const [id, a, b, c] = e
        // A chain: the node's entry point, then its continuation's steps,
        // then the exit — `Any::dot(a, key).end()` for a bare `a.b`, one
        // spelling whether or not a continuation follows. What the read
        // answers is the VM's: `null.a` throws when the module runs, as
        // JavaScript throws, and nothing here predicts it.
        if (isChain(id)) {
            const open = id === '.' ? map2((fa, k) => `Any::dot(${fa}, ${k})`)(f(a), index(b))
                : id === '?.' ? map2((fa, k) => `Any::option_dot(${fa}, ${k})`)(f(a), keyThunk(b))
                : map2((fa, t) => `Any::option_call(${fa}, ${t})`)(f(a), lazyOperand(b))
            return map2((o, rest) => `${o}${rest}`)(open, steps(id === '.')(c))
        }
        // A call, `['()', callee, args]`: `Any::call`, the callee a value
        // and the arguments the array their item list builds — the callee a
        // function, or `nanvm-lib` throws. Arguments holding a spread are
        // `spread_call`'s, which builds them first, so a spread's throw
        // comes before the call's.
        if (id === '()') {
            return hasSpread(b)
                ? flat(map2((fn, x) => cat([unstable('spread_call'), `(${fn}, ${x})`]))(operand(a), itemsExpr(b)))
                : map2((fn, x) => `Any::call(${fn}, ${x})`)(operand(a), arrayExpr(b))
        }
        // An array holding a spread, which may throw: `spread_array`.
        if (id === '[]') { return spreadArray(a) }
        // An instance check, `['instanceof', x, 'Array']`: the constructor
        // is a name, printed as the `Constructor` variant it names, never
        // an operand — before the generic operator path below, which would
        // print the name as a string literal.
        if (id === 'instanceof') {
            return flat(map1((/** @type {string} */ x) => cat([`Any::instanceof_(${x}, `, vm('Constructor'), `::${b})`]))(operand(a)))
        }
        // The first operand is established in every operation; the ones
        // after it are what a lazy operation establishes conditionally.
        const rest = lazy.includes(id) ? lazyOperand : operand
        return flat(e.length === 2 ? map2((fn, x) => fn(x))(op1(id), operand(a))
            : e.length === 3 ? map3((fn, x, y) => fn(x, y))(op2(id), operand(a), rest(b))
            : map4((fn, x, y, z) => fn(x, y, z))(op3(id), operand(a), rest(b), rest(c)))
    }
    /**
     * A continuation's steps as the methods they are, from the node's entry
     * point to the chain's exit: `.end()` where the continuation is absent,
     * `.end_call(…)` for a terminal step — `|!()`, and `|()` where a
     * receiver alone is live, `property`, since with no region open there
     * is no bit for `!` to clear — and `.call(…)`, `.dot(…)` or
     * `.option_call(…)` for a step the chain goes on from, in the state it
     * hands on. Which steps a state admits is the lambda type's method set
     * in `nanvm-lib`, so a step the README does not allow does not compile;
     * this printer only spells, and refuses a tag that is none of the four
     * rather than read it as one of them. A step's key is a thunk over a
     * literal or `Number(…)` cast, {@link keyThunk}, and its arguments a
     * {@link lazyOperand}:
     * both are inside the region, or after an access that may throw first.
     *
     * @type {(property: boolean) => (k: readonly any[] | undefined) => Result<Printed<string>, readonly unknown[]>}
     */
    const steps = property => k => {
        if (k === undefined) { return plain('.end()') }
        const [step, x, next] = k
        if (step === '|.') { return map2((key, rest) => `.dot(${key})${rest}`)(keyThunk(x), steps(false)(next)) }
        if (!['|()', '|?.()', '|!()'].includes(step)) { return error(['no Rust for a chain step', k]) }
        const terminal = step === '|!()' || (step === '|()' && property)
        if (terminal && next !== undefined) { return error(['a terminal step with a continuation', k]) }
        const method = terminal ? 'end_call' : step === '|()' ? 'call' : 'option_call'
        return map2((t, rest) => `.${method}(${t})${rest}`)(lazyOperand(x), terminal ? plain('') : steps(false)(next))
    }
    /**
     * A `.` node's index as the key `Any::dot` takes: a literal's
     * {@link literalIndex}, or the `Number(…)` cast of a sub-expression,
     * `Any::number(k)?`, which is an operand like any other, evaluated after
     * the receiver and before the access, with JavaScript's `Number(k)`
     * coercion (including bigint conversion).
     *
     * @type {(index: Index) => Result<Printed<string>, readonly unknown[]>}
     */
    const index = i => typeof i === 'object' ? f(i) : ok(literalIndex(i))
    /**
     * An index inside a region, as the thunk `option_dot` and the `|.` step
     * take: `|| Ok(…)` around a literal, which has nothing to bind and
     * cannot throw, and a `Number(…)` cast's own thunk, {@link lazyOperand},
     * since the cast and its operand are inside the region and run only if
     * the guard lets them.
     *
     * @type {(index: Index) => Result<Printed<string>, readonly unknown[]>}
     */
    const keyThunk = i => typeof i === 'object' ? lazyOperand(i) : ok(cat(['|| Ok(', literalIndex(i), ')']))
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>} */
    const operand = e => map1(s => composed(e) ? `(${s})` : s)(f(e))
    /**
     * `true` when a node prints as an operator expression where it stands:
     * an operation nested in the corpus's mode, and not one a name already
     * holds. Every other rendering is atomic — a literal, a name, a
     * constructor call, a method chain, a `(…)?` — and survives being an
     * operand as written. An operator expression does not: Rust parses
     * `a * b * c` to the left and binds a method call tighter than `*`, so
     * an unparenthesized composed operand is a different program from the
     * node it was printed from. A chain node is a method chain
     * (`Any::dot(…).end()`), which already binds tighter than any infix
     * operator, so it needs no parentheses either.
     *
     * @type {(e: Exp) => boolean}
     */
    const composed = e => isOperation(e) && bound.every(([n]) => n !== e) && !isChain(/** @type {readonly any[]} */ (e)[0])
        && /** @type {readonly any[]} */ (e)[0] !== '[]'
    /**
     * A lazy operand, as the thunk `nanvm-lib` takes: a closure answering
     * the `Result<Any<A>, Any<A>>` the operand's establishment is — the
     * operand's {@link block}, its own temporaries bound inside the closure
     * and its value the closure's answer, on one line where there is no
     * `let` to bind. Established only when the thunk is, whichever mode the
     * statement around it is in: the closure is a function of its own,
     * answering a `Result`, so an operation anywhere inside it lands its
     * throw in the closure's `Result`, never in the statement's. That is
     * what lets the corpus's bare `check` statements hold an operation in
     * a lazy position, where an eager position of theirs still cannot
     * (`../../nanvm/todo/corpus-as-conformance-vectors.md`).
     *
     * @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const thunk = e => map1((/** @type {readonly string[]} */ statements) => `|| ${statements.length === 1 ? statements[0] : braced(statements)}`)(block(e))
    /**
     * A lazy operand where its operation stands: its thunk's name, where
     * the thunk is a temporary of the block — one with a body of its own,
     * outside the corpus's mode — and the thunk itself otherwise: over an
     * atom, or over a value the block already holds by name.
     *
     * @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const lazyOperand = e => isThunk(e) && isTemporary(e) ? plain(nameOf(e)) : thunk(e)
    /**
     * A node as the `Result<Any<A>, Any<A>>` a function answers for it: an
     * operation's own, bare — `Ok((…)?)` would say the same, and clippy's
     * `needless_question_mark` refuses it — and `Ok(…)` of any other node's
     * value: a literal, a container, a function, or a name. A comma
     * answering by its last operand's value is that operand's `Result`.
     * What a thunk's closure answers, and what a block's last statement is.
     *
     * @type {(e: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const result = e => isArgs(e) ? argsResult(/** @type {readonly Exp[]} */ (/** @type {unknown} */ (e)))
        : isComma(e) && !inline.includes(e) ? result(last(e))
        : isOperation(e) && bound.every(([n]) => n !== e) ? bare(/** @type {readonly any[]} */ (e))
        : map1(s => `Ok(${s})`)(f(e))
    /**
     * A temporary's `let` line: a thunk's closure, its type the operation's
     * to infer; an operation's call followed by `?`, so the temporary is
     * the `Any<A>` it answers — an operator's text parenthesized first, a
     * chain's or a call's as it is — and any other node's construction
     * as it is.
     *
     * @type {(n: Exp) => Result<Printed<string>, readonly unknown[]>}
     */
    const letLine = n => isThunk(n)
        ? map1(s => `${kw('let')} ${nameOf(n)} = ${s};`)(thunk(n))
        : map1(s => `${kw('let')} ${nameOf(n)}: Any<A> = ${
            !isOperation(n) ? s : isChain(tagOf(n)) || tagOf(n) === '()' || tagOf(n) === '[]' ? `${s}?` : `(${s})?`};`)(node(n))
    /**
     * The `Result` an argument list's thunk answers: the array it builds,
     * `Ok(…)`, or `spread_array`'s own, which may throw, where it holds a
     * spread.
     *
     * @type {(a: readonly Exp[]) => Result<Printed<string>, readonly unknown[]>}
     */
    const argsResult = a => hasSpread(a)
        ? spreadArray(a)
        : map1(s => `Ok(${s})`)(arrayExpr(a))
    /**
     * The statements of `e`'s block: a `let` per temporary it binds, then
     * `e` as the `Result` the block answers — a closure's body, a thunk's,
     * or a compiled module's.
     *
     * @type {(e: Exp) => Result<Printed<readonly string[]>, readonly unknown[]>}
     */
    const block = e => map2((/** @type {readonly string[]} */ lets, /** @type {string} */ value) => [...lets, value])(
        all(declaredBy(e).map(letLine)), result(e))
    /**
     * One object property, `(key, value)` called through `call`: a tuple
     * for `to_object`, or `property_item(key, value)` beside a spread, whose
     * entries are `spread_entries(…)`'s, through `object_spread`. An object
     * spread never throws, so an object holding one is a value, as an object
     * without one is.
     *
     * Anything else in an entry's place is refused rather than read as a
     * property, which would take its second element as the key and print a
     * bare `undefined` as the value — text that looks like Rust and is not.
     *
     * @type {(call: Printed<string>) => (p: Properties) => Result<Printed<string>, readonly unknown[]>}
     */
    const propertyExpr = call => p => {
        if (p[0] !== ':') { return error(['not a property', p]) }
        const [, k, v] = p
        return typeof k === 'string'
            ? flat(map1(x => cat([call, '(', literalKey(k), `, ${x})`]))(f(v)))
            : flat(map2((x, y) => cat([unstable('computed_item'), `(${x}, ${y})?`]))(f(k), f(v)))
    }
    return ok({ f, block })
}

/**
 * A Rust expression for an EDAG node in the corpus's mode, its operation
 * the `Result` it answers and its eager nodes nested as written, over the
 * corpus's own named bindings: one operation per statement handed to a
 * checker.
 *
 * Constructing a computed-key object is refused in this mode: its key
 * coercion needs a Result-returning scope, which a bare corpus expression
 * does not supply. Use {@link scope} or {@link statementsOf} for it; corpus
 * integration is tracked in [computed-key-corpus](./todo/computed-key-corpus.md).
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => Result<string, readonly unknown[]>}
 */
export const expExpr = shared => e => mapOk((/** @type {Printed<string>} */ [text]) => untagged(text))(okThen(p => p.f(e))(printer(true)(shared)(e)))

/**
 * `true` for the operands of `() => undefined`: no slots and the
 * `undefined` node — the corpus helper's function shape.
 *
 * @type {(slots: readonly Exp[], body: Exp) => boolean}
 */
const isSmallestLambda = (slots, body) =>
    slots.length === 0 && body instanceof Array && body[0] === 'undefined'

/**
 * The same, for a node nothing shares — every node reached from exactly one
 * place.
 *
 * @type {(e: Exp) => Result<string, readonly unknown[]>}
 */
export const nodeExpr = expExpr([])

/**
 * `visited` with `root`'s subgraph folded in: every distinct node it reaches
 * — root included — paired with how many places have reached it, visiting a
 * node's own children only the first time that node is met, so a heavily
 * shared graph costs its node count and not the exponential a naive walk
 * would pay; a node met again only has its count bumped. The result lists a
 * node's dependencies before the node itself — full post-order — since a
 * node is only ever appended after the fold over its children returns,
 * which is exactly the order a `let`-binding printer needs: a shared node's
 * own initializer may reference an earlier shared node, and it must already
 * be bound by then.
 *
 * No step here mutates `visited` or anything reached from it — a lookup is
 * `Array#findIndex` and a bump rebuilds the list with `Array#map`, both
 * ordinary expressions over immutable arrays, the same idiom
 * {@link expExpr}'s own `shared.find` already reads by.
 *
 * `operands` says which of a node's items the walk descends into: a
 * scope's own, {@link operandsOf}, or every function body's too,
 * {@link withBodies}. Every question asked of a graph is asked of this
 * one walk — sharing, an `args` read, a function held — since any other
 * walk over a shared graph pays that exponential.
 *
 * @type {(operands: (node: readonly unknown[]) => readonly unknown[]) => (visited: readonly (readonly [node: Exp, count: number])[]) => (root: unknown) => readonly (readonly [node: Exp, count: number])[]}
 */
const visit = operands => visited => root => {
    if (!(root instanceof Array)) { return visited }
    const self = /** @type {unknown} */ (root)
    const i = visited.findIndex(([n]) => n === self)
    if (i !== -1) {
        return visited.map((v, j) => j === i ? /** @type {readonly [Exp, number]} */ ([v[0], v[1] + 1]) : v)
    }
    const withChildren = operands(root).reduce((/** @type {readonly (readonly [Exp, number])[]} */ v, child) => visit(operands)(v)(child), visited)
    return [...withChildren, /** @type {readonly [Exp, number]} */ ([/** @type {Exp} */ (self), 1])]
}

/**
 * Whether a scope reads its own arguments: an `['args']` node among the
 * distinct nodes {@link visit} reaches through {@link operandsOf}, which
 * stops at a nested function's body — that one's `args` is its own. A
 * module's own scope reading them is refused by `fjs/compiler/rust`: a module
 * has no arguments.
 *
 * @type {(root: Exp) => boolean}
 */
export const readsArgs = root => reads('args')(root) || reads('arg')(root) || reads('rest')(root)

/**
 * The same, for `['frame', i]`: whether a scope reads a slot of the frame
 * it was built with. A module's own scope reading one is refused by
 * `fjs/compiler/rust`: a module has no frame.
 *
 * @type {(root: Exp) => boolean}
 */
export const readsFrame = root => reads('frame')(root)

/**
 * The same, for `['self']`: whether a scope reads the function it is the
 * body of, through the closure's `self_` as a frame read does.
 *
 * @type {(root: Exp) => boolean}
 */
export const readsSelf = root => reads('self')(root)

/**
 * The indices a scope reads of its frame, one per distinct `['frame', i]`
 * node, a nested function's body left out as in {@link readsFrame}.
 *
 * @type {(root: Exp) => readonly number[]}
 */
const slotReads = root => visit(operandsOf)([])(root)
    .flatMap(([node]) => tagOf(node) === 'frame' ? [/** @type {number} */ (/** @type {readonly unknown[]} */ (/** @type {unknown} */ (node))[1])] : [])

/**
 * Whether a scope holds a node tagged `tag`, a nested function's body left
 * out, {@link readsArgs}.
 *
 * @type {(tag: string) => (root: Exp) => boolean}
 */
const reads = tag => root => visit(operandsOf)([])(root).some(([node]) => tagOf(node) === tag)

/**
 * The tag of a node {@link visit} listed — every one an array, a primitive
 * never being listed — as the walk's callers read it.
 *
 * @type {(node: Exp) => unknown}
 */
const tagOf = node => /** @type {readonly unknown[]} */ (/** @type {unknown} */ (node))[0]

/**
 * {@link operandsOf} and a function's body too: the walk over a whole
 * module, scopes and all.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const withBodies = node => node[0] === '=>' ? [...operandsOf(node), node[3]] : operandsOf(node)

/**
 * Whether an EDAG holds any `=>` node, nested bodies included: what decides
 * that the module printed from it bounds on `IStaticFunction`. The graph
 * determines the bound, not the text, which a string literal could spell.
 *
 * @type {(root: Exp) => boolean}
 */
export const holdsFunction = root => visit(withBodies)([])(root)
    .some(([node]) => tagOf(node) === '=>' || tagOf(node) === 'entry')

/**
 * The operands a walk descends into, read from a node's shape rather than
 * from every array it holds: an array, object, or comma node holds its
 * operands in a list, whose first item may be a string that spells a tag —
 * `['&&', c, c]` is three array items where `['&&', c, c]` a node is an
 * operation — so the list is read as a list, and every other node's
 * operands follow its tag. A spread and a property are members of a
 * list, not nodes, so a list is read through them, {@link members}.
 *
 * A `=>` node's slots are its operands, its body is not: the body is a
 * scope of its own, established when the function is called and not when
 * it is made, and shares no node with the scope around it — so a walk over
 * one scope stops at the function boundary, and {@link scope} walks the
 * body afresh as its own root.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const operandsOf = node => {
    const [id] = node
    return id === '=>' ? /** @type {readonly unknown[]} */ (node[2])
        : id === 'arg' || id === 'entry' ? []
        // the constructor name is metadata, not a string-literal operand
        : id === 'instanceof' ? [node[1]]
        : id === ',' ? /** @type {readonly unknown[]} */ (node[1])
        : id === '[]' || id === '{}' ? members(/** @type {readonly unknown[]} */ (node[1]))
        : id === '()' ? [node[1], ...members(/** @type {readonly unknown[]} */ (node[2]))]
        : isChain(id) ? [...eagerOperandsOf(node), ...chainLazy(one, items)(node)]
        : node.slice(1)
}

/**
 * What a continuation `k` holds, the step's own key or arguments, then its
 * continuation's, and nothing where there is none: `key` reads a `|.`
 * step's key and `args` a call step's item list. A continuation is not a
 * node: it is a lambda over the chain's current value
 * (`fjs/edag/README.md`, Chains), so a walk never lists it, only what it
 * holds, every item of which is inside the chain and so lazy.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (k: unknown) => readonly unknown[]}
 */
const stepOperands = (key, args) => k => {
    if (k === undefined) { return [] }
    const [step, x, next] = /** @type {readonly any[]} */ (k)
    return [...(step === '|.' ? key(x) : args(x)), ...stepOperands(key, args)(next)]
}

/**
 * What a chain node holds in its lazy positions, {@link lazyOperandsOf},
 * each key read by `key` and each argument list by `args`: a `?.` or `?.()`
 * node's key or arguments, inside the region its guard opens, and its
 * continuation's, {@link stepOperands}; a `.` node's continuation's, after
 * an access that may throw with them untouched; none for any other node.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (node: readonly unknown[]) => readonly unknown[]}
 */
const chainLazy = (key, args) => node => {
    const [id, , b, k] = node
    return id === '.' ? stepOperands(key, args)(k)
        : id === '?.' ? [...key(b), ...stepOperands(key, args)(k)]
        : id === '?.()' ? [...args(b), ...stepOperands(key, args)(k)]
        : []
}

/** A position read as one operand. @type {(x: unknown) => readonly unknown[]} */
const one = x => [x]

/** An item list read as its items, an argument list's walk. @type {(x: unknown) => readonly unknown[]} */
const items = x => members(/** @type {readonly unknown[]} */ (x))

/** A position left out. @type {(x: unknown) => readonly unknown[]} */
const none = () => []

/**
 * The argument lists a chain node holds in its lazy positions, each one
 * operand a thunk establishes as the array a call takes: not a node, so a
 * walk reads its items ({@link operandsOf}), and the printer knows it by
 * position, from here.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const argListsOf = chainLazy(none, one)

/**
 * The operands a node establishes unconditionally: a lazy operation's
 * first, a `.` node's receiver and key, a `?.` or `?.()` node's receiver
 * or callee alone — the guard decides whether anything after it runs — and
 * every operand of any other node.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const eagerOperandsOf = node => {
    const [id] = node
    return lazy.includes(/** @type {string} */ (id)) ? [node[1]]
        : id === '.' ? [node[1], node[2]]
        : id === '?.' || id === '?.()' ? [node[1]]
        : operandsOf(node)
}

/**
 * The distinct nodes an EDAG reaches from more than one place, in dependency
 * order — the generalization of a corpus's explicit, named `data.shared` to
 * a linked EDAG, where sharing is implicit: two references to one `const`
 * are the same `Exp` object by identity (see `fjs/compiler/edag/module.f.mjs`'s
 * `lower`), never restated as data.
 *
 * `root` itself is never "shared" by this count — nothing outside the graph
 * points at it, and the graph is acyclic, so it cannot reach itself — which
 * is why it never needs a binding of its own; a caller prints it as the
 * function's final, unbound expression.
 *
 * @type {(root: Exp) => readonly Exp[]}
 */
export const sharedNodesOf = root => visit(operandsOf)([])(root)
    .filter(([, count]) => count >= 2)
    .map(([node]) => node)

/**
 * `seen` with every node `root` establishes unconditionally folded in: the
 * nodes reached without passing through a lazy position — every operand
 * after the first of a {@link lazy} operation, and a chain's lazy
 * positions, {@link eagerOperandsOf}. A node is walked once, by identity,
 * as {@link visit} walks it.
 *
 * @type {(seen: readonly Exp[], root: unknown) => readonly Exp[]}
 */
const reach = (seen, root) => {
    if (!(root instanceof Array)) { return seen }
    const self = /** @type {Exp} */ (/** @type {unknown} */ (root))
    if (seen.includes(self)) { return seen }
    return eagerOperandsOf(root).reduce(reach, [...seen, self])
}

/**
 * The operands a node establishes only conditionally, the ones its thunks
 * establish: a lazy operation's operands after the first, and a chain's
 * lazy positions, {@link chainLazy}, an argument list as one operand —
 * the array its thunk establishes. What is not eager is lazy, and the two
 * lists together are {@link operandsOf}'s, an argument list read there as
 * its items.
 *
 * @type {(n: Exp) => readonly Exp[]}
 */
const lazyOperandsOf = n => {
    const node = /** @type {readonly any[]} */ (n)
    return /** @type {readonly Exp[]} */ (lazy.includes(node[0]) ? node.slice(2) : chainLazy(one, one)(node))
}

/**
 * The nodes an EDAG establishes unconditionally — reached from `root`
 * through eager positions alone — in walk order, `root` first. A node
 * {@link sharedNodesOf} lists that is not among these is reached only
 * through lazy operands, and a `let` binding for it before the root would
 * establish what the program may not: it binds in the block of the one
 * thunk that owns it, or the shape is refused, an {@link atomic} node
 * excepted, whose binding establishes nothing ({@link printer}).
 *
 * @type {(root: Exp) => readonly Exp[]}
 */
export const eagerNodesOf = root => reach([], root)

/**
 * The statements of one scope over the caller's own bindings, with the
 * names they spell.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (root: Exp) => Result<Printed<readonly string[]>, readonly unknown[]>}
 */
const blockOf = shared => root => okThen(p => p.block(root))(printer(false)(shared)(root))

/**
 * The statements of one scope over the caller's own bindings — a corpus
 * case's, over the group's shared values — as {@link scope} prints a
 * module's over none: a `let` per temporary, then the root as the
 * `Result` the scope answers.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
export const statementsOf = shared => root => mapOk((/** @type {Printed<readonly string[]>} */ [s]) => s.map(untagged))(blockOf(shared)(root))

/**
 * The statements of a scope's block — a compiled module's body, or a
 * function's — over no bindings but its own, with the names they spell.
 *
 * @type {(root: Exp) => Result<Printed<readonly string[]>, readonly unknown[]>}
 */
const statements = blockOf([])

/**
 * `true` when an operation stands in an eager position under `root`, a
 * node the caller has bound aside: what a bare statement cannot hold,
 * since an operation answers a `Result` where its operand position takes
 * an `Any`, and a bare statement has no line before it to bind the
 * temporary on. A lazy position holds one fine — its thunk's block binds
 * it — and so does a bound node, its binding's `.clone()` being a value.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (root: Exp) => boolean}
 */
export const nestsOperation = shared => root => eagerNodesOf(root).slice(1)
    .some(n => isOperation(n) && !shared.some(([s]) => s === n))

/**
 * The names of `module` among `uses`, sorted and without repeats.
 *
 * @type {(uses: readonly Use[]) => (module: Use[0]) => readonly string[]}
 */
const namesIn = uses => module => [...new Set(uses.flatMap(([m, n]) => m === module ? [n] : []))].toSorted()

/**
 * The lines of one scope — a compiled module's body, or a function's —
 * with the `nanvm_lib` names they spell, or
 * the refusal: a `let` per temporary, `c0`, `c1`, … in dependency order,
 * one line, one expression, then the root as the `Result` the scope's
 * function answers — an operation's own, `Ok(…)` of any other value —
 * every operation propagating with `?`. {@link printer} says which nodes
 * are temporaries and where each is bound; the caller lays the lines out
 * inside its function.
 *
 * A temporary is established before the root, so a shared operation that
 * throws does so before an operation that precedes it in the source: the
 * scope reports that failure where JavaScript reports the earlier one. The
 * two are one outcome — `spec/README.md`, "Failure is one outcome", names
 * the first failing operation as no language-level observation and allows
 * exactly this reordering. A temporary a lazy operand alone reaches is
 * bound inside that operand's thunk, so no failure the program skips is
 * run.
 *
 * Every operator prints, the lazy four included, and so does a function:
 * a `=>` node is a closure, its body a scope of its own printed by this
 * same function, and a call is `Any::call`. Nothing here polices an
 * operand's laziness: the `nanvm-lib` signature does, since a value
 * printed where a thunk is due does not compile.
 *
 * {@link visit} and {@link reach} recurse once per operand, so a scope
 * deep enough overflows the call stack before this function prints
 * anything — tracked with the other EDAG walks' recursion, not fixed here:
 * `../todo/stack-safety.md`.
 *
 * @type {(root: Exp) => Result<Scope, readonly unknown[]>}
 */
export const scope = root => mapOk(
    (/** @type {Scope} */ { lines, uses }) => ({ lines: lines.map(untagged), uses }))(scopeTagged(root))

/**
 * {@link scope} with its lines tagged, the text a producer of marked text
 * resolves its runs from (`fromTagged` in `fjs/text/marked`).
 *
 * @type {(root: Exp) => Result<Scope, readonly unknown[]>}
 */
export const scopeTagged = root => mapOk((/** @type {Printed<readonly string[]>} */ [s, uses]) =>
    ({ lines: lines(s), uses: { vm: namesIn(uses)('vm'), unstable: namesIn(uses)('unstable') } }))(statements(root))

/**
 * The `use` lines for a scope's names, {@link scope}'s `uses`, inside a
 * function bound on `bound`, spelled as rustfmt spells them,
 * {@link useLine}: the `vm::unstable` helpers' line, if any, then `vm`'s,
 * which always holds `Any` and the bound — every value is an `Any<A>`, and
 * every function is generic over it.
 *
 * @type {(uses: Uses, bound: string) => readonly string[]}
 */
export const useLines = (uses, bound) => useLinesTagged(uses, bound).map(untagged)

/**
 * {@link useLines} with the `use` of each tagged as a keyword.
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
    return line.length <= maxWidth ? [`${kw('use')}${line.slice(3)}`] : [`${kw('use')} ${path}::{`, ...names.reduce(filled, []), '};']
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
    return last !== undefined && joined.length <= maxWidth ? [...rows.slice(0, -1), joined] : [...rows, `    ${name},`]
}
