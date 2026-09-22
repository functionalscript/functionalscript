/**
 * Prints an EDAG `Exp` as a Rust expression against the `nanvm-lib` API.
 *
 * Shared by two generators that print the same node shapes for two different
 * purposes: [`../../nanvm/rust/module.f.mjs`](../../nanvm/rust/module.f.mjs)
 * prints the operator conformance corpus as `nanvm-lib/tests/test/generated.rs`,
 * and [`../../fsc/rust/module.f.mjs`](../../fsc/rust/module.f.mjs) prints a
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
 * @module
 *
 * @import { Exp, Index, Primitive, Properties } from '../types.ts'
 * @import { OpId } from '../../nanvm/types.ts'
 * @import { Printer } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { f64Bits, i64Literal, stringLiteral } from '../../media/rust/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.mjs'

/**
 * The `nanvm-lib` expression each unary operation prints as.
 *
 * @type {{ readonly [k in OpId]?: (a: string) => string }}
 */
export const op1Rust = {
    '+': a => `Any::unary_plus(${a})`,
    '-': a => `-(${a})`,
    '!': a => `!(${a})`,
    '~': a => `Any::bitwise_not(${a})`,
    typeof: a => `Any::typeof_(${a})`,
    String: a => `${a}.to_string().map(|v| v.to_any())`,
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
 * `Any::unsigned_right_shift`. `own` follows it for a fifth: no Rust operator
 * spells a keyed property lookup at all, so it is `Any::own_property`.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string) => string }}
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
    own: (a, b) => `Any::own_property(${a}, ${b})`,
    // `==` on `Any` *is* JavaScript's `===`, but it yields a `bool` and so
    // pins neither operand's `A`; `nanvm_lib::vm::unstable`'s `strict_eq`
    // and `strict_ne` lift the answer into the `Result` every other
    // operator returns.
    '===': (a, b) => `strict_eq(${a}, ${b})`,
    '!==': (a, b) => `strict_ne(${a}, ${b})`,
}

/**
 * The same, for the one ternary operation (`?:`) — another method, for the
 * same reason as `&&`/`||`/`??`: Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 * Both arms arrive as thunks, `?:` being {@link lazy}: `Any::conditional`
 * establishes the one its condition selects.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string, c: string) => string }}
 */
export const op3Rust = {
    '?:': (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

/**
 * The operations that establish every operand after the first only
 * conditionally: `&&`, `||` and `??` establish the right operand only if the
 * left decides nothing, and `?:` establishes the one arm its condition
 * selects — the EDAG's positional laziness, as `op2Id` and `op3Id` in
 * [`../module.f.mjs`](../module.f.mjs) state it. In each the deciding
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
const lazy = ['&&', '||', '??', '?:']

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
 * @type {<K extends string, T>(table: { readonly [k in K]?: T }) => (id: K) => Result<T, readonly unknown[]>}
 */
const lookup = table => id => {
    const v = table[id]
    return v === undefined ? error(['no Rust for', id]) : ok(v)
}

/**
 * Combines two `Result`s with `f`, short-circuiting on the first `error` —
 * the shape every multi-operand node below needs, since a `nanvm-lib` call
 * takes several already-printed pieces at once and any one of them may be
 * the refusal.
 *
 * @type {<A, B, R>(f: (a: A, b: B) => R) => (ra: Result<A, readonly unknown[]>, rb: Result<B, readonly unknown[]>) => Result<R, readonly unknown[]>}
 */
const map2 = f => (ra, rb) => okThen(a => mapOk(b => f(a, b))(rb))(ra)

/** The same, for three. @type {<A, B, C, R>(f: (a: A, b: B, c: C) => R) => (ra: Result<A, readonly unknown[]>, rb: Result<B, readonly unknown[]>, rc: Result<C, readonly unknown[]>) => Result<R, readonly unknown[]>} */
const map3 = f => (ra, rb, rc) => map2((a, [b, c]) => f(a, b, c))(ra, map2((b, c) => [b, c])(rb, rc))

/** The same, for four. @type {<A, B, C, D, R>(f: (a: A, b: B, c: C, d: D) => R) => (ra: Result<A, readonly unknown[]>, rb: Result<B, readonly unknown[]>, rc: Result<C, readonly unknown[]>, rd: Result<D, readonly unknown[]>) => Result<R, readonly unknown[]>} */
const map4 = f => (ra, rb, rc, rd) => map2((a, [b, c, d]) => f(a, b, c, d))(ra, map3((b, c, d) => [b, c, d])(rb, rc, rd))

/**
 * A list of `Result`s as one `Result` of a list, short-circuiting on the
 * first `error` — an array literal's items, an object literal's members
 * and a block's `let` lines are each printed this way, so one failed item
 * refuses the whole rather than a list of holes. An empty list is an empty
 * `ok`: a block with nothing to bind.
 *
 * Builds the prefix before appending the last element, so a prefix that
 * already carries an error short-circuits without `map2` ever looking at
 * the tail — the first `error` in the list is the one reported.
 *
 * @type {(results: readonly Result<string, readonly unknown[]>[]) => Result<readonly string[], readonly unknown[]>}
 */
const allOk = results => results.length === 0
    ? ok([])
    : map2((xs, x) => [...xs, x])(allOk(results.slice(0, -1)), results[results.length - 1])

const op1 = lookup(op1Rust)

const op2 = lookup(op2Rust)

const op3 = lookup(op3Rust)

/**
 * A Rust string literal for `v`, or the refusal: `stringLiteral` answers a
 * string it cannot spell — one holding a lone surrogate, which no `&str`
 * can hold — with the string itself under `unknown`, and this printer
 * names the reason in the `[reason, detail]` shape every refusal here has.
 * The detail is written by `JSON.stringify`, which spells the surrogate as
 * its escape rather than the unpaired code unit a diagnostic cannot show.
 *
 * @type {(v: string) => Result<string, readonly unknown[]>}
 */
const stringExpr = v => {
    const r = stringLiteral(v)
    return r[0] === 'ok' ? r : error(['no Rust string literal for a lone surrogate in', JSON.stringify(v)])
}

/**
 * The same for a bigint: `i64Literal` answers one outside `i64` with the
 * value itself, and this printer names the reason.
 *
 * @type {(v: bigint) => Result<string, readonly unknown[]>}
 */
const bigintExpr = v => {
    const r = i64Literal(v)
    return r[0] === 'ok' ? r : error(['no Rust i64 for', v])
}

/** @type {(v: Primitive) => Result<string, readonly unknown[]>} */
const primitiveExpr = v => {
    if (v === null) { return ok('Nullish::Null.to_any()') }
    switch (typeof v) {
        case 'boolean': { return ok(`${v}.to_any()`) }
        case 'number': { return ok(`f64_any(${f64Bits(v)})`) }
        case 'string': { return mapOk(s => `string_any(${s})`)(stringExpr(v)) }
        case 'bigint': { return mapOk(s => `bigint_any(${s})`)(bigintExpr(v)) }
    }
}

/**
 * An object key.
 *
 * An EDAG object key is an `exp` — one form for `a:`, `"a":`, and computed
 * `[exp]:` keys alike — and every producer of this printer's input lowers a
 * JavaScript property name, so the key is always the string literal
 * `string_key` takes. A computed one has no `nanvm-lib` spelling here and is
 * refused rather than approximated.
 *
 * @type {(k: Exp) => Result<string, readonly unknown[]>}
 */
const keyExpr = k => typeof k === 'string' ? mapOk(s => `string_key(${s})`)(stringExpr(k)) : error(['not a literal key', k])

/**
 * A `.` node's index, as the `Any<A>` key `Any::dot` takes: a literal
 * `number` or `string`, the two `Index` variants the read's own key type
 * (`number | string`) already covers directly.
 *
 * `NumberCast` — the remaining `Index` variant — names a sub-expression to
 * evaluate and coerce at run time (`a[Number(k)]`), not a literal key this
 * printer can spell directly, and there is no `Number(...)` cast primitive
 * here to route it through (`op1Rust` has `String` but no `Number`), so it
 * stays refused — a separate, larger task, the same way operators were kept
 * out of the printer that first landed `.`/`[]`.
 *
 * @type {(index: Index) => Result<string, readonly unknown[]>}
 */
const indexExpr = index => {
    if (typeof index === 'string') { return mapOk(s => `string_any(${s})`)(stringExpr(index)) }
    if (typeof index === 'number') { return ok(`f64_any(${f64Bits(index)})`) }
    return error(['no Rust for a Number(...) cast index', index])
}

/**
 * `true` for a `.` base a property read on always throws: `null` and the
 * tagged `['undefined']` node. Printing `Any::dot(…)` for
 * either would compile to a run-time throw in place of the compile-time refusal
 * every other DJS output gives the same input (`fjs/fsc/README.md`: "a
 * `null` or `undefined` base is the one failure a data module can make").
 * Provable only from the base's own literal shape: a `const`, an import, or
 * another `.` node's result could still be nullish at run time, and nothing
 * short of evaluating the module would know.
 *
 * @type {(base: Exp) => boolean}
 */
const nullishBase = base => base === null || (base instanceof Array && base[0] === 'undefined')

/**
 * `true` for a JS number that denotes a valid array/string index: a
 * non-negative integer. Mirrors `nanvm-lib`'s own `canonical_index`
 * (`vm/member_access.rs`) exactly but for one omission that is provably
 * harmless below: it does not cap the value at `u32::MAX`. Every caller
 * only trusts a `true` result once the same number is also less than a real
 * literal's `.length` — always far short of that cap — so a value beyond it
 * still reads as an out-of-range miss below, the same outcome
 * `canonical_index` gives it directly. `-0` passes (`Number.isInteger(-0)`
 * and `-0 >= 0` both hold), matching `canonical_index`'s own `-0` case; a
 * negative, fractional, `NaN`, or `Infinity` key fails, matching every
 * other rejection `canonical_index` makes — each of those always misses
 * below too, since a miss needs only "not a canonical in-range index",
 * never this predicate specifically.
 *
 * @type {(n: number) => boolean}
 */
const isCanonicalIndex = n => Number.isInteger(n) && n >= 0

/**
 * The array/string index an `.`/`[]` key `b` denotes, or `null` for a key
 * that denotes none — a negative, fractional, or non-finite number
 * ({@link isCanonicalIndex}), or a string that is not the exact canonical
 * decimal form of a non-negative integer. Mirrors `nanvm-lib`'s
 * `string_to_index` (`vm/member_access.rs`) via native JS coercion rather
 * than reimplementing its digit scan: `String(Number(b))` *is* ECMAScript's
 * `Number::toString` here (this printer runs inside the JS engine that
 * defines it), so it rejects exactly what `string_to_index` rejects for the
 * same reason — `"01"`, `"+0"`, `"1.0"`, `" 0"`, `"-0"`, and `""` each fail
 * to round-trip back to themselves, while `"0"` and `"1"` do.
 *
 * `null` is not itself "opaque" to a caller: {@link resolvedBase}'s array
 * and string branches treat it as a miss (`undefined`), the same as an
 * in-range check that fails, because every key `Array`/`String::member_access`
 * accepts but does not resolve to an element — a non-canonical string, an
 * out-of-range canonical one — answers `undefined` unconditionally, not
 * "unknown."
 *
 * @type {(b: number | string) => number | null}
 */
const arrayIndexOf = b => {
    if (typeof b === 'number') { return isCanonicalIndex(b) ? b : null }
    const n = Number(b)
    return isCanonicalIndex(n) && String(n) === b ? n : null
}

/**
 * The `Exp` a `.` node's base denotes when every step folding it is
 * statically visible: a literal receiver and a literal key fold to the
 * property or element's own value, the same way `{ a: 1 }.a` is `1` and
 * `[1][0]` is `1` at run time — so a base that is nullish only after such a
 * fold is still caught by {@link nullishBase} rather than missed just
 * because the nullish value sits one or more hops further away than the
 * node it is checked on: `{}.missing` and `[][0]` both fold to the tagged
 * `['undefined']` node the same way a missing property or an out-of-range
 * index reads as `undefined` at run time, and `{ a: null }.a.x` and
 * `[null][0].x` both fold their base to a literal `null` before
 * `nullishBase` ever sees it — exactly mirroring `Any::dot`'s own
 * dispatch: a receiver it does not special-case at all (a number, a
 * boolean, a bigint, or a function) always answers `undefined` regardless
 * of the key, an object's key is a string directly or a number stringified
 * first (matching `Object::member_access`'s own `ToString`), and an
 * array's or a string's key is its canonical index
 * ({@link arrayIndexOf}, matching `Array`/`String::member_access` —
 * including a key that denotes no index at all, which those two also read
 * as an unconditional miss) with the one string `"length"` left alone,
 * since a length is a number and a number is never nullish.
 *
 * Stops and hands back `e` unresolved wherever it cannot see through: a
 * `const`, an import, another operation, or an object or array holding a
 * spread — this is a fold over literal chains only, not a general
 * evaluator, so a shape it cannot prove is left opaque rather than guessed
 * at. Folding all the way through to a non-nullish literal — an array, a
 * string, another object — costs nothing and is harmless, but changes
 * nothing {@link nullishBase} decides either: it treats every such shape,
 * resolved or left opaque, alike as "not provably nullish." Only the
 * nullish outcomes above are what the fold exists for.
 *
 * @type {(e: Exp) => Exp}
 */
const resolvedBase = e => {
    if (!(e instanceof Array)) { return e }
    const [id, a, b, c] = /** @type {readonly any[]} */ (e)
    if (id !== '.' || c !== undefined) { return e }
    const base = resolvedBase(a)
    if (typeof base === 'boolean' || typeof base === 'number' || typeof base === 'bigint'
        || (base instanceof Array && base[0] === '=>')) {
        return ['undefined']
    }
    if (base instanceof Array && base[0] === '{}' && (typeof b === 'string' || typeof b === 'number')) {
        const key = typeof b === 'number' ? String(b) : b
        const props = /** @type {readonly any[]} */ (base[1])
        if (props.some((/** @type {any} */ p) => p[0] !== ':')) { return e }
        const prop = props.findLast((/** @type {any} */ p) => p[1] === key)
        return resolvedBase(prop === undefined ? ['undefined'] : prop[2])
    }
    if (base instanceof Array && base[0] === '[]' && (typeof b === 'string' || typeof b === 'number')) {
        if (b === 'length') { return e }
        const items = /** @type {readonly any[]} */ (base[1])
        if (items.some((/** @type {any} */ p) => p instanceof Array && p[0] === '...')) { return e }
        const index = arrayIndexOf(b)
        return resolvedBase(index !== null && index < items.length ? items[index] : ['undefined'])
    }
    if (typeof base === 'string' && (typeof b === 'string' || typeof b === 'number')) {
        if (b === 'length') { return e }
        const index = arrayIndexOf(b)
        return resolvedBase(index !== null && index < base.length ? base[index] : ['undefined'])
    }
    return e
}

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
const braced = statements => statements.length === 1
    ? `{ ${statements[0]} }`
    : `{\n${lines(statements).map(l => `${indent}${l}`).join('\n')}\n}`

/**
 * The lines of a list of statements, one of which may span several.
 *
 * @type {(statements: readonly string[]) => readonly string[]}
 */
const lines = statements => statements.flatMap(s => s.split('\n'))

/**
 * `true` for a node that prints as one atom holding no other node's text:
 * `undefined`, `args`, an empty array or object, and the corpus's lambda,
 * `function_any()` — a primitive being the other atom, and never a node
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
    const [id, a] = /** @type {readonly any[]} */ (e)
    return ['undefined', 'args'].includes(id)
        || (['[]', '{}'].includes(id) && a.length === 0)
        || (id === '=>' && a !== null)
}

/**
 * `true` for a member of a literal rather than a value: a property,
 * `[':', key, value]`, or a spread, `['...', exp]` — walked as a node is,
 * so that the value under it is found, but never a temporary, since a
 * `let` holds a value.
 *
 * @type {(e: Exp) => boolean}
 */
const isMember = e => e instanceof Array && [':', '...'].includes(e[0])

/** @type {(e: Exp) => boolean} */
const isComma = e => e instanceof Array && e[0] === ','

/**
 * `true` for a node that prints through an operation's `nanvm-lib` call,
 * answering a `Result`: a `.` read, a call, or an operator node — every
 * node but the value shapes, which construct an `Any` directly.
 *
 * @type {(e: Exp) => boolean}
 */
const isOperation = e => e instanceof Array && !['undefined', 'args', '[]', '{}', '=>', ',', ':', '...'].includes(e[0])

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
 * the refusal above checks: a node shared but eager nowhere has no block
 * to bind it in — `true ? 1 : [c, c]` answers `1` without establishing
 * `c`, and a `let` before the root would — and no scope the lowering
 * links has the shape, an implicitly shared node being a `const`
 * referenced twice, which JavaScript establishes at its declaration
 * whatever the operators around its uses do, and which
 * [Stage B](../../fsc/todo/stage-b-operators.md)'s eager-restricted
 * `refsOf` anchors through the comma root when reached only lazily — an
 * eager reach, so the binding is right again.
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
    const order = visit(node => isBound(/** @type {Exp} */ (/** @type {unknown} */ (node))) ? [] : operandsOf(node))([])(root)
        .filter(([n]) => !isBound(n))
    const eager = eagerNodesOf(root)
    const lazyOnly = order.find(([n, count]) => count >= 2 && !eager.includes(n))
    if (lazyOnly !== undefined) {
        return error(['no Rust for a shared node reached only through lazy operands; a `let` binding would establish what the program may not', lazyOnly[0]])
    }
    // `Exps` admits an empty operand list in the schema (shape-only, per
    // `fjs/edag/types.ts`), but the Rust backend has no value to give an
    // empty comma — `resolve` in `fjs/fsc/edag/module.f.mjs` never anchors
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
    const valueNodes = e => !isComma(e) || isShared(last(e)) ? [e] : [e, ...valueNodes(last(e))]
    /**
     * Every lazy operand nothing establishes eagerly: the root of its
     * thunk's block. A lazy operand also reached eagerly is an ordinary
     * temporary, and its thunk answers the name.
     */
    const thunks = order.flatMap(([n]) => lazyOperandsOf(n)).filter(o => !eager.includes(o))
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
     * reference it by name.
     *
     * @type {readonly (readonly [node: Exp, refs: number])[]}
     */
    const temporaries = order.flatMap(([n, count]) =>
        (atomic(n) && count < 2) || isMember(n) || structural.includes(n) || inline.includes(n)
            ? []
            : [/** @type {readonly [Exp, number]} */ ([n, count - discarded.filter(d => d === n).length])])
    /** @type {(e: Exp) => boolean} */
    const isTemporary = e => temporaries.some(([n]) => n === e)
    /** What the scope's own block holds, established before the root as a `const` is at its declaration. */
    const outer = held(root)
    /**
     * The temporaries `e`'s block binds, in dependency order: the ones it
     * holds — every one, for the scope's root; for a thunk's root, less the
     * ones the scope's block already holds — a value reached eagerly
     * elsewhere, and the thunks over that value's own lazy operands, which
     * the scope's block makes where the value is — and less the thunk
     * itself, the block's own answer.
     *
     * @type {(e: Exp) => readonly Exp[]}
     */
    const declaredBy = e => {
        const own = held(e)
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
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const b = bound.find(([n]) => n === e)
        return b === undefined ? node(e) : ok(b[1])
    }
    /**
     * A node's own construction, its operands referenced through {@link f}:
     * a value's, and an operation's bare `Result` — what a temporary's
     * `let` binds, with the `?` {@link letLine} adds, and what a node
     * printed where it stands is.
     *
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const node = e => {
        const [id, a, b] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return ok('Nullish::Undefined.to_any()') }
        // The arguments a function was called with: the `args` parameter of
        // the closure {@link closure} prints, an `Array<A>` — as a value, an
        // `Rc`-cheap clone of it. An indexed read, `a[0]` or `a.length`, is
        // an ordinary `.` node over this, `Any::dot(…).end()` answering
        // `undefined` past the end as JavaScript does.
        if (id === 'args') { return ok('args.clone().to_any()') }
        if (id === '[]') {
            return a.length === 0
                ? ok('Array::default().to_any()')
                : mapOk((/** @type {readonly string[]} */ items) => `[${items.join(', ')}].to_array().to_any()`)(allOk(a.map(f)))
        }
        if (id === '{}') {
            return a.length === 0
                ? ok('Object::default().to_any()')
                : mapOk((/** @type {readonly string[]} */ items) => `[${items.join(', ')}].to_object().to_any()`)(allOk(a.map(propertyExpr)))
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
                ? mapOk((/** @type {readonly string[]} */ parts) => {
                    const before = parts.slice(0, -1).map(s => `let _: Any<A> = ${s}; `).join('')
                    return `{ ${before}${parts[parts.length - 1]} }`
                })(allOk(a.map(f)))
                : f(last(e))
        }
        if (id === '=>') {
            // A `null` frame is the compiler's every function: a closure
            // over nothing. The other lambda a caller may hand this printer
            // is the corpus's `() => undefined`, which no operator inspects
            // and the harness binds as `function_any`; any other frame is
            // refused rather than printed as a function it is not.
            if (a === null) { return closure(b) }
            return isSmallestLambda(a, b) ? ok('function_any()') : error(['no Rust for', e])
        }
        return bare(/** @type {readonly any[]} */ (e))
    }
    /**
     * A non-capturing function, `['=>', null, body]` — the one shape the
     * compiler lowers a function to today (`fjs/fsc/README.md`) — as a
     * function value: a closure bound through `IStaticFunction`, the
     * `StaticCode<A>` signature's two parameters, a `length` of `0` — a
     * rest parameter or none counts nothing (`spec/README.md`, Functions)
     * — and an empty frame. A closure that captures nothing coerces to the
     * `fn` pointer `StaticCode<A>` is, and rustc infers its parameters from
     * it, so the text declares no types.
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
     * function's — as `_self` is always named until a body can name itself:
     * an unused parameter under `-D warnings` is otherwise an error in the
     * crate the module lands in.
     *
     * @type {(body: Exp) => Result<string, readonly unknown[]>}
     */
    const closure = body => mapOk(statements =>
        `A::static_function(|_self, ${readsArgs(body) ? 'args' : '_args'}| ${braced(statements)}, 0, Array::default()).to_any()`
    )(statements(body))
    /**
     * An operation — a `.` read, a call, or an operator node — as the bare
     * `Result<Any<A>, Any<A>>` its `nanvm-lib` call answers, or the
     * refusal: a block's own answer, or a `let`'s initializer before its
     * `?`.
     *
     * @type {(e: readonly any[]) => Result<string, readonly unknown[]>}
     */
    const bare = e => {
        const [id, a, b, c] = e
        // A chain: the node's entry point, then its continuation's steps,
        // then the exit — `Any::dot(a, key).end()` for a bare `a.b`, one
        // spelling whether or not a continuation follows. A `.` read on a
        // provably nullish base is refused as before; `?.` and `?.()` on
        // one are `undefined`, and print.
        if (isChain(id)) {
            if (id === '.' && nullishBase(resolvedBase(a))) { return error(['a property access on a nullish base throws at run time; refused rather than compiled to a panic', e]) }
            const open = id === '.' ? map2((fa, k) => `Any::dot(${fa}, ${k})`)(f(a), indexExpr(b))
                : id === '?.' ? map2((fa, k) => `Any::option_dot(${fa}, ${k})`)(f(a), keyThunk(b))
                : map2((fa, t) => `Any::option_call(${fa}, ${t})`)(f(a), lazyOperand(b))
            return map2((o, rest) => `${o}${rest}`)(open, steps(id === '.')(c))
        }
        // A call, `['()', callee, args]`: `Any::call`, the callee and the
        // arguments both values, as the node's operands are — the callee a
        // function and the arguments an array, or `nanvm-lib` throws.
        if (id === '()') { return map2((fn, x) => `Any::call(${fn}, ${x})`)(operand(a), operand(b)) }
        // The first operand is established in every operation; the ones
        // after it are what a lazy operation establishes conditionally.
        const rest = lazy.includes(id) ? lazyOperand : operand
        return e.length === 2 ? map2((fn, x) => fn(x))(op1(id), operand(a))
            : e.length === 3 ? map3((fn, x, y) => fn(x, y))(op2(id), operand(a), rest(b))
            : map4((fn, x, y, z) => fn(x, y, z))(op3(id), operand(a), rest(b), rest(c))
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
     * literal, {@link keyThunk}, and its arguments a {@link lazyOperand}:
     * both are inside the region, or after an access that may throw first.
     *
     * @type {(property: boolean) => (k: readonly any[] | undefined) => Result<string, readonly unknown[]>}
     */
    const steps = property => k => {
        if (k === undefined) { return ok('.end()') }
        const [step, x, next] = k
        if (step === '|.') { return map2((key, rest) => `.dot(${key})${rest}`)(keyThunk(x), steps(false)(next)) }
        if (!['|()', '|?.()', '|!()'].includes(step)) { return error(['no Rust for a chain step', k]) }
        const terminal = step === '|!()' || (step === '|()' && property)
        if (terminal && next !== undefined) { return error(['a terminal step with a continuation', k]) }
        const method = terminal ? 'end_call' : step === '|()' ? 'call' : 'option_call'
        return map2((t, rest) => `.${method}(${t})${rest}`)(lazyOperand(x), terminal ? ok('') : steps(false)(next))
    }
    /**
     * An index inside a region, as the thunk `option_dot` and the `|.` step
     * take: `|| Ok(…)` around the literal key {@link indexExpr} spells,
     * since a literal has nothing to bind and cannot throw.
     *
     * @type {(index: Index) => Result<string, readonly unknown[]>}
     */
    const keyThunk = index => mapOk(k => `|| Ok(${k})`)(indexExpr(index))
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => Result<string, readonly unknown[]>} */
    const operand = e => mapOk(s => composed(e) ? `(${s})` : s)(f(e))
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
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const thunk = e => mapOk(statements => `|| ${statements.length === 1 ? statements[0] : braced(statements)}`)(block(e))
    /**
     * A lazy operand where its operation stands: its thunk's name, where
     * the thunk is a temporary of the block — one with a body of its own,
     * outside the corpus's mode — and the thunk itself otherwise: over an
     * atom, or over a value the block already holds by name.
     *
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const lazyOperand = e => isThunk(e) && isTemporary(e) ? ok(nameOf(e)) : thunk(e)
    /**
     * A node as the `Result<Any<A>, Any<A>>` a function answers for it: an
     * operation's own, bare — `Ok((…)?)` would say the same, and clippy's
     * `needless_question_mark` refuses it — and `Ok(…)` of any other node's
     * value: a literal, a container, a function, or a name. A comma
     * answering by its last operand's value is that operand's `Result`.
     * What a thunk's closure answers, and what a block's last statement is.
     *
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const result = e => isComma(e) && !inline.includes(e) ? result(last(e))
        : isOperation(e) && bound.every(([n]) => n !== e) ? bare(/** @type {readonly any[]} */ (e))
        : mapOk(s => `Ok(${s})`)(f(e))
    /**
     * A temporary's `let` line: a thunk's closure, its type the operation's
     * to infer; an operation's call followed by `?`, so the temporary is
     * the `Any<A>` it answers — an operator's text parenthesized first, a
     * chain's or a call's as it is — and any other node's construction
     * as it is.
     *
     * @type {(n: Exp) => Result<string, readonly unknown[]>}
     */
    const letLine = n => isThunk(n)
        ? mapOk(s => `let ${nameOf(n)} = ${s};`)(thunk(n))
        : mapOk(s => `let ${nameOf(n)}: Any<A> = ${
            !isOperation(n) ? s : isChain(tagOf(n)) || tagOf(n) === '()' ? `${s}?` : `(${s})?`};`)(node(n))
    /**
     * The statements of `e`'s block: a `let` per temporary it binds, then
     * `e` as the `Result` the block answers — a closure's body, a thunk's,
     * or a compiled module's.
     *
     * @type {(e: Exp) => Result<readonly string[], readonly unknown[]>}
     */
    const block = e => map2((/** @type {readonly string[]} */ lets, /** @type {string} */ value) => [...lets, value])(
        allOk(declaredBy(e).map(letLine)), result(e))
    /**
     * One object entry.
     *
     * `Properties` is `Property | Spread`, so `['...', exp]` is a valid entry
     * this printer has no `nanvm-lib` spelling for. Read as a property it
     * would take the spread's operand as the key and its absent third element
     * as the value, printing a bare `undefined` into the generated file — text
     * that looks like Rust and is not. Refused for the reason `lookup` refuses
     * an unmapped id, and so that the two entry shapes agree: a spread as an
     * *array* item already refuses, having no operator to render as.
     *
     * @type {(p: Properties) => Result<string, readonly unknown[]>}
     */
    const propertyExpr = p => p[0] !== ':'
        ? error(['not a property', p])
        : map2((k, v) => `(${k}, ${v})`)(keyExpr(p[1]), f(p[2]))
    return ok({ f, block })
}

/**
 * A Rust expression for an EDAG node in the corpus's mode, its operation
 * the `Result` it answers and its eager nodes nested as written, over the
 * corpus's own named bindings: one operation per statement handed to a
 * checker.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => Result<string, readonly unknown[]>}
 */
export const expExpr = shared => e => okThen(p => p.f(e))(printer(true)(shared)(e))

/**
 * `true` for the operands of `() => undefined`: an empty frame and the
 * `undefined` node — the one `=>` this printer has a spelling for.
 *
 * @type {(frame: Exp, body: Exp) => boolean}
 */
const isSmallestLambda = (frame, body) =>
    frame instanceof Array && frame[0] === '[]' && frame[1].length === 0
    && body instanceof Array && body[0] === 'undefined'

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
 * module's own scope reading them is refused by `fjs/fsc/rust`: a module
 * has no arguments.
 *
 * @type {(root: Exp) => boolean}
 */
export const readsArgs = root => visit(operandsOf)([])(root).some(([node]) => tagOf(node) === 'args')

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
const withBodies = node => node[0] === '=>' ? node.slice(1) : operandsOf(node)

/**
 * Whether an EDAG holds a function the printer binds — a `null`-frame `=>`
 * node — anywhere, nested bodies included: what decides that the module
 * printed from it bounds on `IStaticFunction`, and not the text, which a
 * string literal could spell.
 *
 * @type {(root: Exp) => boolean}
 */
export const holdsFunction = root => visit(withBodies)([])(root)
    .some(([node]) => tagOf(node) === '=>' && /** @type {readonly unknown[]} */ (/** @type {unknown} */ (node))[1] === null)

/**
 * The operands a walk descends into, read from a node's shape rather than
 * from every array it holds: an array, object, or comma node holds its
 * operands in a list, whose first item may be a string that spells a tag —
 * `['&&', c, c]` is three array items where `['&&', c, c]` a node is an
 * operation — so the list is read as a list, and every other node's
 * operands follow its tag. A spread and a property are tagged pairs no
 * operator names, so they are walked as nodes are.
 *
 * A `=>` node's body is not among its operands: it is a scope of its own,
 * established when the function is called and not when it is made, and
 * shares no node with the scope around it — so a walk over one scope stops
 * at the function boundary, and {@link scope} walks the body afresh as its
 * own root.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const operandsOf = node => {
    const [id] = node
    return id === '=>' ? [node[1]]
        : ['[]', '{}', ','].includes(/** @type {string} */ (id)) ? /** @type {readonly unknown[]} */ (node[1])
        : isChain(id) ? [...eagerOperandsOf(node), ...lazyOperandsOf(/** @type {Exp} */ (/** @type {unknown} */ (node)))]
        : node.slice(1)
}

/**
 * The operands of a continuation `k` — the step's own key or arguments,
 * then its continuation's — and none where there is none. A continuation
 * is not a node: it is a lambda over the chain's current value
 * (`fjs/edag/README.md`, Chains), so a walk never lists it, only what it
 * holds, every item of which is inside the chain and so lazy.
 *
 * @type {(k: unknown) => readonly unknown[]}
 */
const stepOperands = k => k === undefined ? [] : [/** @type {readonly any[]} */ (k)[1], ...stepOperands(/** @type {readonly any[]} */ (k)[2])]

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
 * are the same `Exp` object by identity (see `fjs/fsc/edag/module.f.mjs`'s
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
 * establish: a lazy operation's operands after the first; a `?.` or `?.()`
 * node's key or arguments, inside the region its guard opens, and its
 * continuation's operands, {@link stepOperands}; a `.` node's
 * continuation's operands, after an access that may throw with them
 * untouched; none for any other node. What is not eager is lazy, and the
 * two lists together are {@link operandsOf}'s.
 *
 * @type {(n: Exp) => readonly Exp[]}
 */
const lazyOperandsOf = n => {
    const node = /** @type {readonly any[]} */ (n)
    const [id] = node
    return /** @type {readonly Exp[]} */ (
        lazy.includes(id) ? node.slice(2)
        : id === '.' ? stepOperands(node[3])
        : id === '?.' || id === '?.()' ? [node[2], ...stepOperands(node[3])]
        : [])
}

/**
 * The nodes a block over `e` holds: the ones `e` reaches eagerly,
 * {@link eagerNodesOf}, and the thunk over every lazy operand of an
 * operation among them, which the block makes where the operation is.
 *
 * @type {(e: Exp) => readonly Exp[]}
 */
const held = e => {
    const reached = eagerNodesOf(e)
    return [...reached, ...reached.flatMap(lazyOperandsOf)]
}

/**
 * The nodes an EDAG establishes unconditionally — reached from `root`
 * through eager positions alone — in walk order, `root` first. A node
 * {@link sharedNodesOf} lists that is not among these is reached only
 * through lazy operands, and a `let` binding for it before the root would
 * establish what the program may not: the shape `fjs/fsc/rust` refuses.
 *
 * @type {(root: Exp) => readonly Exp[]}
 */
export const eagerNodesOf = root => reach([], root)

/**
 * The statements of a scope's block — a compiled module's body, or a
 * function's — over no bindings but its own: {@link printer}'s
 * `block` of its root.
 *
 * @type {(root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
const statements = root => okThen(p => p.block(root))(printer(false)([])(root))

/**
 * The lines of one scope — a compiled module's body, or a function's — or
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
 * @type {(root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
export const scope = root => mapOk(lines)(statements(root))
