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
 * `data.shared`, or synthetic names for a compiled module's implicit sharing),
 * and everything about *why* a printer is invoked — a test case, a whole
 * module's `pub fn module<A: IVm>() -> Any<A>`.
 *
 * @module
 *
 * @import { Exp, Index, Primitive, Properties } from '../types.ts'
 * @import { OpId } from '../../nanvm/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { f64Literal, i64Literal, stringLiteral } from '../../media/rust/module.f.mjs'
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
 * `bool` operands and short-circuit *evaluation*, neither of which fits an
 * operator over already-evaluated `Any<A>` values, and `?` is Rust's own
 * try-operator, unrelated to JS `??` — so all three are `Any` methods, named
 * for what they do rather than reusing punctuation Rust already owns. `>>>`
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
    // pins neither operand's `A`, and callers that need the `Result` every
    // other operator returns settle it themselves (`strict_eq` in the
    // operator-test harness).
    '===': (a, b) => `strict_eq(${a}, ${b})`,
}

/**
 * The same, for the one ternary operation (`?:`) — another method, for the
 * same reason as `&&`/`||`/`??`: Rust's own `if`/`else` takes a `bool`
 * condition, not an `Any<A>` one, so there is no infix spelling to reuse.
 *
 * @type {{ readonly [k in OpId]?: (a: string, b: string, c: string) => string }}
 */
export const op3Rust = {
    '?:': (a, b, c) => `Any::conditional(${a}, ${b}, ${c})`,
}

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
 * first `error` — an array literal's items and an object literal's members
 * are each printed this way, so one failed item refuses the whole literal
 * rather than an array of holes.
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

/** @type {(v: Primitive) => string} */
const primitiveExpr = v => {
    if (v === null) { return 'Nullish::Null.to_any()' }
    switch (typeof v) {
        case 'boolean': { return `${v}.to_any()` }
        case 'number': { return `(${f64Literal(v)}).to_any()` }
        case 'string': { return `string_any(${stringLiteral(v)})` }
        case 'bigint': { return `bigint_any(${i64Literal(v)})` }
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
const keyExpr = k => typeof k === 'string' ? ok(`string_key(${stringLiteral(k)})`) : error(['not a literal key', k])

/**
 * A `.` node's index, as the `Any<A>` key `Any::own_property` takes.
 *
 * Only a string index has a `nanvm-lib` spelling today: `own_property`
 * answers `undefined` for every receiver but a plain object (see its doc
 * comment in `nanvm-lib`), so a numeric index — meant for an array or a
 * string receiver — would print Rust that compiles and silently always
 * evaluates to `undefined`, which is worse than refusing it. Widening this
 * once `nanvm-lib` gains the `entry` read
 * ([`fjs/edag/todo/entry.md`](../todo/entry.md)) is future work, not an
 * approximation to make now.
 *
 * @type {(index: Index) => Result<string, readonly unknown[]>}
 */
const indexExpr = index => typeof index === 'string'
    ? ok(`string_any(${stringLiteral(index)})`)
    : error(['no Rust for a numeric index', index])

/**
 * `true` for a `.` base a property read on always throws: `null` and the
 * tagged `['undefined']` node. Printing `Any::own_property(…).unwrap()` for
 * either would compile to a Rust panic in place of the compile-time refusal
 * every other DJS output gives the same input (`fjs/fsc/README.md`: "a
 * `null` or `undefined` base is the one failure a data module can make").
 * Provable only from the base's own literal shape — the same limit
 * {@link nonObjectLiteralBase} has, and for the same reason: a `const`, an
 * import, or another `.` node's result could still be nullish at run time,
 * and nothing short of evaluating the module would know.
 *
 * @type {(base: Exp) => boolean}
 */
const nullishBase = base => base === null || (base instanceof Array && base[0] === 'undefined')

/**
 * `true` for a `.` base this printer can prove `own_property` answers wrong
 * for. `Any::own_property` only inspects `Unpacked::Object` and answers
 * `undefined` for everything else (see its doc comment in `nanvm-lib`), but
 * DJS accepts property access on an array, a string, a boolean, and a bigint
 * too — `[1].length`, `"ab"[0]` — per `fjs/fsc/README.md`. Printing the call
 * anyway for one of these would silently swap the accessed value for
 * `undefined`, so it is refused instead, the same choice
 * {@link indexExpr} makes for a numeric index and for the same underlying
 * gap ([`fjs/edag/todo/entry.md`](../todo/entry.md)).
 *
 * An opaque base — a `const`, an import, another `.` node's result — is not
 * refused here even though its run-time value could still be one of these:
 * this printer has no way to know, and refusing every opaque base would
 * refuse the common case (property access reaching into an object through a
 * reference) along with the wrong one.
 *
 * @type {(base: Exp) => boolean}
 */
const nonObjectLiteralBase = base =>
    typeof base === 'boolean' || typeof base === 'number' || typeof base === 'string' || typeof base === 'bigint'
    || (base instanceof Array && base[0] === '[]')

/**
 * The `Exp` a `.` node's base denotes when every step folding it is
 * statically visible: a literal object base and a literal string key fold
 * to the property's own value, the same way `{ a: [1] }.a` is `[1]` at run
 * time — so `{ a: [1] }.a.length` is checked exactly as `[1].length` is,
 * rather than missing the gap {@link nonObjectLiteralBase} exists to catch
 * just because it sits one hop further away. `fjs/fsc/ast/module.f.mjs`'s
 * `selected` does the same fold for the same reason, over the AST rather
 * than the EDAG, for the sharing sweep.
 *
 * Stops and hands back `e` unresolved wherever it cannot see through: a
 * `const`, an import, another operation, or an object holding a spread —
 * this is a fold over literals, not a general evaluator, so a shape it
 * cannot prove is left opaque rather than guessed at. A key absent from a
 * fully literal object folds to `['undefined']`, which {@link nullishBase}
 * then catches — reading no such property *is* reading `undefined`. An
 * array's own items are never indexed here: only a string key ever reaches
 * this far, since a numeric one is refused by {@link indexExpr} regardless
 * of what its base is.
 *
 * @type {(e: Exp) => Exp}
 */
const resolvedBase = e => {
    if (!(e instanceof Array)) { return e }
    const [id, a, b, c] = /** @type {readonly any[]} */ (e)
    if (id !== '.' || c !== undefined) { return e }
    const base = resolvedBase(a)
    if (!(base instanceof Array) || base[0] !== '{}' || typeof b !== 'string') { return e }
    const props = /** @type {readonly any[]} */ (base[1])
    if (props.some((/** @type {any} */ p) => p[0] !== ':')) { return e }
    const prop = props.findLast((/** @type {any} */ p) => p[1] === b)
    return resolvedBase(prop === undefined ? ['undefined'] : prop[2])
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
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => Result<string, readonly unknown[]>}
 */
export const expExpr = shared => {
    /**
     * `true` when a node prints as an operator expression.
     *
     * Every other rendering is atomic — a literal, a constructor call, a
     * method chain, or a shared binding's `.clone()` — and survives being an
     * operand as written. An operator expression does not: Rust parses
     * `a * b * c` to the left and binds a method call tighter than `*`, so an
     * unparenthesized composed operand is a different program from the node
     * it was printed from. A `.` node is a method chain (`Any::own_property(
     * …).unwrap()`), which already binds tighter than any infix operator, so
     * it needs no parentheses either. A `,` node is a brace-delimited block
     * (`{ …; last }`), atomic the same way a parenthesized group is. A shared
     * node is a lowered value and so never an operation, which is why the tag
     * alone decides this.
     *
     * @type {(e: Exp) => boolean}
     */
    const composed = e => e instanceof Array && ![
        'undefined', '[]', '{}', '=>', '.', ',',
    ].includes(e[0])
    /** @type {(e: Exp) => Result<string, readonly unknown[]>} */
    const f = e => {
        if (!(e instanceof Array)) { return ok(primitiveExpr(e)) }
        const bound = shared.find(([n]) => n === e)
        if (bound !== undefined) { return ok(bound[1]) }
        const [id, a, b, c] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return ok('Nullish::Undefined.to_any()') }
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
        if (id === '.') {
            if (c !== undefined) { return error(['no Rust for a property-access chain step', e]) }
            const base = resolvedBase(a)
            if (nullishBase(base)) { return error(['a property access on a nullish base throws at run time; refused rather than compiled to a panic', e]) }
            if (nonObjectLiteralBase(base)) { return error(['no nanvm-lib own-property read for this receiver type yet', e]) }
            return map2((fa, k) => `Any::own_property(${fa}, ${k}).unwrap()`)(f(a), indexExpr(b))
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
            // `nanvm-lib` has no closures yet, so no `=>` node prints as one.
            // The one lambda a caller may hand this printer is `() =>
            // undefined`, which no operator inspects; any other lambda is
            // refused rather than printed as a function it is not.
            return isSmallestLambda(a, b) ? ok('function_any()') : error(['no Rust for', e])
        }
        return e.length === 2 ? map2((fn, x) => fn(x))(op1(id), nested(a))
            : e.length === 3 ? map3((fn, x, y) => fn(x, y))(op2(id), nested(a), nested(b))
            : map4((fn, x, y, z) => fn(x, y, z))(op3(id), nested(a), nested(b), nested(c))
    }
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => Result<string, readonly unknown[]>} */
    const nested = e => mapOk(s => composed(e) ? `(${s})` : s)(f(e))
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
    return f
}

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
 * @type {(visited: readonly (readonly [node: Exp, count: number])[]) => (root: unknown) => readonly (readonly [node: Exp, count: number])[]}
 */
const visit = visited => root => {
    if (!(root instanceof Array)) { return visited }
    const self = /** @type {unknown} */ (root)
    const i = visited.findIndex(([n]) => n === self)
    if (i !== -1) {
        return visited.map((v, j) => j === i ? /** @type {readonly [Exp, number]} */ ([v[0], v[1] + 1]) : v)
    }
    const withChildren = root.reduce((v, child) => visit(v)(child), visited)
    return [...withChildren, /** @type {readonly [Exp, number]} */ ([/** @type {Exp} */ (self), 1])]
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
export const sharedNodesOf = root => visit([])(root)
    .filter(([, count]) => count >= 2)
    .map(([node]) => node)
