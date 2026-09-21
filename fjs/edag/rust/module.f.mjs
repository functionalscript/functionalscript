/**
 * Prints an EDAG `Exp` as a Rust expression against the `nanvm-lib` API.
 *
 * Shared by two generators that print the same node shapes for two different
 * purposes: [`../../nanvm/rust/module.f.mjs`](../../nanvm/rust/module.f.mjs)
 * prints the operator conformance corpus as `nanvm-lib/tests/test/generated.rs`,
 * and [`../../fsc/rust/module.f.mjs`](../../fsc/rust/module.f.mjs) prints a
 * compiled module's EDAG as the `.rs` output of `fjs compile`. Both need the
 * same literal rendering, the same operator tables, and the same node-sharing
 * mechanism (a `let` binding per shared node, cloned at each reference), so
 * that mechanism lives here once rather than drifting between two copies.
 *
 * What stays with each caller: naming shared nodes (the corpus's own names via
 * `data.shared`, or {@link scope}'s synthetic names for a compiled module's
 * implicit sharing), and everything about *why* a printer is invoked — a
 * test case, a whole module's `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`.
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
 * @type {readonly string[]}
 */
const lazy = ['&&', '||', '??', '?:']

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
 * A non-empty list of `Result`s as one `Result` of a list, short-circuiting
 * on the first `error` — an array literal's items and an object literal's
 * members are each printed this way, so one failed item refuses the whole
 * literal rather than an array of holes. Every call site already special-
 * cases the empty list itself, one level up, since an empty array, object,
 * or comma prints differently from a non-empty one (`Array::default()`, not
 * `[].to_array()`; an empty comma has no value to give and is refused) — so
 * this is never called with one, and takes a lone element as its base case
 * rather than carrying a never-taken empty branch.
 *
 * Builds the prefix before appending the last element, so a prefix that
 * already carries an error short-circuits without `map2` ever looking at
 * the tail — the first `error` in the list is the one reported.
 *
 * @type {(results: readonly Result<string, readonly unknown[]>[]) => Result<readonly string[], readonly unknown[]>}
 */
const allOk = results => results.length === 1
    ? mapOk(x => [x])(results[0])
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
 * A `.` node's index, as the `Any<A>` key `Any::member_access` takes: a
 * literal `number` or `string`, the two `Index` variants `member_access`'s
 * own key type (`number | string`) already covers directly.
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
 * tagged `['undefined']` node. Printing `Any::member_access(…)` for
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
 * `nullishBase` ever sees it — exactly mirroring `Any::member_access`'s own
 * dispatch: a receiver it does not special-case at all (a number, a
 * boolean, or a bigint) always answers `undefined` regardless of the key,
 * a function answers its `length` and `undefined` for every other key,
 * an object's key is a string directly or a number stringified
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
    if (typeof base === 'boolean' || typeof base === 'number' || typeof base === 'bigint') {
        return ['undefined']
    }
    if (base instanceof Array && base[0] === '=>') {
        return b === 'length' ? e : ['undefined']
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
 * A Rust expression of type `Any<A>` for an EDAG node, or the refusal: a node
 * shape this printer has no `nanvm-lib` spelling for. Never throws — every
 * gap below is an ordinary `Result`, since FunctionalScript has no
 * `try`/`catch` to recover a thrown value with (`fjs/AGENTS.md` §1.5), and a
 * node shape a caller's input happens to use is an expected outcome for a
 * compiler to report, not a bug in this printer to panic over. A caller that
 * wants the old throwing convenience — `fjs/nanvm/rust/module.f.mjs`'s
 * dev-tool generation over a fixed, already-valid corpus, where a gap *is* a
 * bug — wraps the `Result` with `unwrap` itself.
 *
 * `shared` names the nodes that already have a `let` binding, so a node
 * reached from several places is constructed once and cloned at every
 * reference — EDAG sharing in printed form.
 *
 * Every use site fixes `A`, so no expression needs a turbofish: the operators
 * above take `Any<A>` arguments and the shared `let` bindings are annotated.
 *
 * `propagate` is how an operation — an operator node, or a `.` read —
 * prints. `false`: as the `Result<Any<A>, Any<A>>` the `nanvm-lib` call
 * answers, for a statement that consumes the `Result` itself, the corpus's
 * `check`. `true`: followed by `?`, so it is an `Any<A>` and a throw
 * propagates to the enclosing function — a compiled module's `pub fn
 * module`, which answers the same `Result`. An operator's text is
 * parenthesized before the `?`, since `?` binds tighter than any infix
 * operator; a `.` read is a call already and needs none.
 *
 * A {@link lazy} operation's later operands print as thunks in either mode,
 * the closure answering the `Result` `nanvm-lib` asks of it: an operation's
 * own, bare, or `Ok(…)` around any other node's value, either printed
 * propagating — see {@link thunk}.
 *
 * @type {(propagate: boolean) => (shared: readonly (readonly[Exp, string])[]) => Printer}
 */
const printer = propagate => shared => {
    /** An operator node's printed operation, in the mode's form. @type {(s: string) => string} */
    const operation = s => propagate ? `(${s})?` : s
    /** A `.` read's printed call, in the mode's form. @type {(s: string) => string} */
    const call = s => propagate ? `${s}?` : s
    /**
     * `true` when a node prints as an operator expression.
     *
     * Every other rendering is atomic — a literal, a constructor call, a
     * method chain, or a shared binding's `.clone()` — and survives being an
     * operand as written. An operator expression does not: Rust parses
     * `a * b * c` to the left and binds a method call tighter than `*`, so an
     * unparenthesized composed operand is a different program from the node
     * it was printed from — when the operation prints bare. Propagating, it
     * prints as `(…)?`, atomic as written, so nothing is composed. A `.`
     * node is a call (`Any::member_access(…)`, with or without its `?`),
     * which already binds tighter than any infix operator, so it needs no
     * parentheses either. A `,` node is a brace-delimited block
     * (`{ …; last }`), atomic the same way a parenthesized group is. A shared
     * node is a lowered value and so never an operation, which is why the tag
     * alone decides this.
     *
     * @type {(e: Exp) => boolean}
     */
    const composed = e => !propagate && e instanceof Array && ![
        'undefined', 'args', '[]', '{}', '=>', '.', ',',
    ].includes(e[0])
    /** @type {(e: Exp) => Result<string, readonly unknown[]>} */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const bound = shared.find(([n]) => n === e)
        if (bound !== undefined) { return ok(bound[1]) }
        const [id, a, b, c] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return ok('Nullish::Undefined.to_any()') }
        // The arguments a function was called with: the `args` parameter of
        // the closure {@link closure} prints, an `Array<A>` — as a value, an
        // `Rc`-cheap clone of it. An indexed read, `a[0]` or `a.length`, is
        // an ordinary `.` node over this, `Any::member_access` answering
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
            // `Exps` admits an empty operand list in the schema (shape-only,
            // per `fjs/edag/types.ts`), but the Rust backend has no value to
            // give an empty comma — `resolve` in `fjs/fsc/edag/module.f.mjs`
            // never anchors zero operands anyway, always the export among
            // them, so refusing here loses no real input.
            if (a.length === 0) { return error(['no Rust for an empty comma', e]) }
            // Establish every operand, in order — some purely for what they
            // anchor, per `resolve` — and take the last one's value, exactly
            // as a Rust block expression does. Each discarded operand is
            // bound to `let _: Any<A>` rather than left a bare statement:
            // unbound and unused, rustc has nothing to unify a generic
            // constructor call's `A` against (`Array::default()` needs one)
            // and refuses to infer it.
            return mapOk((/** @type {readonly string[]} */ parts) => {
                const before = parts.slice(0, -1).map(s => `let _: Any<A> = ${s}; `).join('')
                return `{ ${before}${parts[parts.length - 1]} }`
            })(allOk(a.map(f)))
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
        return mapOk(id === '.' ? call : operation)(bare(e))
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
     * own `let` bindings, restarting at `c0`, and its own `Ok(…)`, every
     * operation inside propagating into the closure's `Result`. That is
     * sound because the lowering shares no node across a function boundary
     * (`fjs/edag/analysis`'s scope rule), so the closure references nothing
     * of the scope around it — which is also what lets it coerce.
     *
     * `args` is the closure's parameter, named `_args` where the body never
     * reads it — {@link readsArgs}, this body's own reads and not a nested
     * function's — as `_self` is always named until a body can name itself:
     * an unused parameter under `-D warnings` is otherwise an error in the
     * crate the module lands in.
     *
     * @type {(body: Exp) => Result<string, readonly unknown[]>}
     */
    const closure = body => mapOk((/** @type {readonly string[]} */ parts) =>
        `A::static_function(|_self, ${readsArgs(body) ? 'args' : '_args'}| { ${parts.join(' ')} }, 0, Array::default()).to_any()`
    )(scope(body))
    /**
     * An operation — a `.` read, or an operator node — as the bare
     * `Result<Any<A>, Any<A>>` its `nanvm-lib` call answers, or the refusal.
     * {@link f} follows it with the mode's `?`; {@link thunk} hands it back
     * as it is, the closure's own answer.
     *
     * @type {(e: readonly any[]) => Result<string, readonly unknown[]>}
     */
    const bare = e => {
        const [id, a, b, c] = e
        if (id === '.') {
            if (c !== undefined && !isMethodCall(c)) { return error(['no Rust for a property-access chain step', e]) }
            const base = resolvedBase(a)
            if (nullishBase(base)) { return error(['a property access on a nullish base throws at run time; refused rather than compiled to a panic', e]) }
            const read = map2((fa, k) => `Any::member_access(${fa}, ${k})`)(f(a), indexExpr(b))
            // A method call, `a.b(...c)`: the `|()` step calls the property
            // with the receiver the read hands it. Nothing can observe that
            // receiver today — a FunctionalScript function is an arrow
            // function, which has no `this`, and `nanvm-lib` has no
            // prototype method a receiver could reach — so the step is the
            // read's value called, `Any::call` over it, the read's own `?`
            // inside. A built-in method with a receiver will need an
            // operation of its own here; the other steps, the optional
            // chain's, are refused above until they have a spelling.
            return c === undefined ? read
                : map2((r, x) => `Any::call(${call(r)}, ${x})`)(read, nested(c[1]))
        }
        // A call, `['()', callee, args]`: `Any::call`, the callee and the
        // arguments both values, as the node's operands are — the callee a
        // function and the arguments an array, or `nanvm-lib` throws.
        if (id === '()') { return map2((fn, x) => `Any::call(${fn}, ${x})`)(nested(a), nested(b)) }
        // The first operand is established in every operation; the ones
        // after it are what a lazy operation establishes conditionally.
        const rest = lazy.includes(id) ? thunk : nested
        return e.length === 2 ? map2((fn, x) => fn(x))(op1(id), nested(a))
            : e.length === 3 ? map3((fn, x, y) => fn(x, y))(op2(id), nested(a), rest(b))
            : map4((fn, x, y, z) => fn(x, y, z))(op3(id), nested(a), rest(b), rest(c))
    }
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => Result<string, readonly unknown[]>} */
    const nested = e => mapOk(s => composed(e) ? `(${s})` : s)(f(e))
    /**
     * `true` when a node prints through {@link bare}: a `.` read or an
     * operator node, and not one a `let` binding already holds — a shared
     * node is its binding's `.clone()` wherever it stands, an operation no
     * longer.
     *
     * @type {(e: Exp) => boolean}
     */
    const isOperation = e => e instanceof Array
        && shared.every(([n]) => n !== e)
        && !['undefined', 'args', '[]', '{}', '=>', ','].includes(e[0])
    /**
     * A lazy operand, as the thunk `nanvm-lib` takes: a closure answering
     * the `Result<Any<A>, Any<A>>` the operand's establishment is. An
     * operation answers its own, bare — `Ok((…)?)` would say the same, and
     * clippy's `needless_question_mark` refuses it — and any other node
     * answers `Ok(…)` of its value: a literal, a container, a block, or a
     * shared binding's `.clone()`, the binding having been established
     * before the root, as a `const` is at its declaration whatever the
     * operators around its uses do.
     *
     * Either body is printed propagating, whichever mode the statement
     * around it is in: the closure is a function of its own, answering a
     * `Result`, so an operation anywhere inside it — the operation's own
     * operand, an item of a container it answers — follows with `?` and
     * lands its throw in the closure's `Result`, never in the statement's.
     * That is what lets the corpus's bare `check` statements hold an
     * operation in a lazy position, where an eager position of theirs
     * still cannot (`../../nanvm/todo/corpus-as-conformance-vectors.md`).
     *
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const thunk = e => mapOk(s => `|| ${s}`)((propagate ? self : printer(true)(shared)).result(e))
    /**
     * A node as the `Result<Any<A>, Any<A>>` a function answers for it: an
     * operation's own, bare — `Ok((…)?)` would say the same, and clippy's
     * `needless_question_mark` refuses it — and `Ok(…)` of any other node's
     * value: a literal, a container, a block, a function, or a shared
     * binding's `.clone()`. What a thunk's closure answers, and what a
     * scope's last statement is.
     *
     * @type {(e: Exp) => Result<string, readonly unknown[]>}
     */
    const result = e => isOperation(e)
        ? bare(/** @type {readonly any[]} */ (e))
        : mapOk(s => `Ok(${s})`)(f(e))
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
    /** @type {Printer} */
    const self = { f, bare, result }
    return self
}

/**
 * The printer whose operations print bare, as the `Result` each answers:
 * the operator corpus's, one operation per statement handed to a checker.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => Result<string, readonly unknown[]>}
 */
export const expExpr = shared => printer(false)(shared).f

/**
 * The printer whose operations propagate with `?`, every expression an
 * `Any<A>`: a compiled module's, where `pub fn module` answers the
 * `Result` a throw lands in.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => Result<string, readonly unknown[]>}
 */
export const valueExpr = shared => printer(true)(shared).f

/**
 * `true` for the one chain step this printer spells: `['|()', args]`, a
 * call of the property just read, with no continuation after it — the
 * shape the compiler lowers every method call to, each further access
 * being a new `.` node over the whole call (`fjs/fsc/edag/module.f.mjs`,
 * `call`).
 *
 * @type {(step: unknown) => boolean}
 */
const isMethodCall = step => step instanceof Array && step[0] === '|()' && step.length === 2

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
        : node.slice(1)
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
 * nodes reached without passing through a lazy position, which is every
 * operand after the first of a {@link lazy} operation. A node is walked
 * once, by identity, as {@link visit} walks it.
 *
 * Descends into {@link operandsOf}'s operands, a lazy operation's first
 * alone; a `.` node's index and step hold nothing a lazy operand hides.
 *
 * @type {(seen: readonly Exp[], root: unknown) => readonly Exp[]}
 */
const reach = (seen, root) => {
    if (!(root instanceof Array)) { return seen }
    const self = /** @type {Exp} */ (/** @type {unknown} */ (root))
    if (seen.includes(self)) { return seen }
    const [id] = root
    const operands = /** @type {readonly unknown[]} */ (lazy.includes(id) ? [root[1]] : operandsOf(root))
    return operands.reduce(reach, [...seen, self])
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
 * The `let` binding statements for the first `i` of `bindings`, each
 * printed against the bindings established before it — or the refusal,
 * from whichever one the printer meets first that it has no `nanvm-lib`
 * spelling for. Recursive rather than a fold, so that a refusal partway
 * through short-circuits the rest without a mutable accumulator.
 *
 * @type {(bindings: readonly (readonly [Exp, string])[]) => (i: number) => Result<readonly string[], readonly unknown[]>}
 */
const lets = bindings => i => {
    if (i === 0) { return ok([]) }
    const [node] = bindings[i - 1]
    return okThen(prev => mapOk(s => [...prev, `let c${i - 1}: Any<A> = ${s};`])(valueExpr(bindings.slice(0, i - 1))(node)))(lets(bindings)(i - 1))
}

/**
 * The statements of one scope — a compiled module's body, or a function's
 * — or the refusal: a `let` binding per node the scope reaches from more
 * than one place, `c0`, `c1`, … in dependency order, then the root as the
 * `Result` the scope's function answers — an operation's own, `Ok(…)` of
 * any other value — every operation inside propagating with `?`. The
 * caller lays them out: a module one statement per line, a closure on one.
 *
 * A binding is established before the root, so a shared operation that
 * throws does so before an operation that precedes it in the source: the
 * scope reports that failure where JavaScript reports the earlier one. The
 * two are one outcome — `spec/README.md`, "Failure is one outcome", names
 * the first failing operation as no language-level observation and allows
 * exactly this reordering. Every binding is reached eagerly by the root,
 * or the scope is refused, so no failure the program skips is run.
 *
 * That refusal: a shared node is hoisted into a `let` binding before the
 * root, which establishes it unconditionally — right where the root
 * reaches it eagerly at least once, and wrong where it is reached only
 * through lazy operands: `true ? 1 : [c, c]` answers `1` without
 * establishing `c`, and a binding would establish it first. A scope the
 * lowering links never has that shape: an implicitly shared node is a
 * `const` referenced twice, JavaScript establishes a `const` at its
 * declaration whatever the operators around its uses do, and
 * [Stage B](../../fsc/todo/stage-b-operators.md)'s eager-restricted
 * `refsOf` anchors a `const` reached only lazily through the comma root —
 * an eager reach, so the binding is right again. The refusal is the check
 * that the anchoring happened, for an EDAG handed in directly.
 *
 * Every operator prints, the lazy four included, and so does a function:
 * a `=>` node is a closure, its body a scope of its own printed by this
 * same function, and a call is `Any::call`. Nothing here polices an
 * operand's laziness: the `nanvm-lib` signature does, since a value
 * printed where a thunk is due does not compile.
 *
 * {@link sharedNodesOf} and {@link eagerNodesOf} recurse once per operand,
 * so a scope deep enough overflows the call stack before this function
 * prints anything — tracked with the other EDAG walks' recursion, not
 * fixed here: `../todo/stack-safety.md`.
 *
 * @type {(root: Exp) => Result<readonly string[], readonly unknown[]>}
 */
export const scope = root => {
    const shared = sharedNodesOf(root)
    const eager = eagerNodesOf(root)
    const lazyOnly = shared.find(node => !eager.includes(node))
    if (lazyOnly !== undefined) {
        return error(['no Rust for a shared node reached only through lazy operands; a `let` binding would establish what the program may not', lazyOnly])
    }
    /** @type {readonly (readonly [Exp, string])[]} */
    const bindings = shared.map((node, i) => [node, `c${i}.clone()`])
    return okThen(statements => mapOk(s => [...statements, s])(printer(true)(bindings).result(root)))(lets(bindings)(bindings.length))
}
