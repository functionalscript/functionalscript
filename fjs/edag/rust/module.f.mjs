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
 */

import { f64Literal, i64Literal, stringLiteral } from '../../media/rust/module.f.mjs'

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
 * What a key names in this printer. A key with no entry is a gap here, not a
 * case to print a plausible wrong statement for.
 *
 * @type {<K extends string, T>(table: { readonly [k in K]?: T }) => (id: K) => T}
 */
const lookup = table => id => {
    const v = table[id]
    if (v === undefined) { throw ['no Rust for', id] }
    return v
}

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
 * @type {(k: Exp) => string}
 */
const keyExpr = k => {
    if (typeof k !== 'string') { throw ['not a literal key', k] }
    return `string_key(${stringLiteral(k)})`
}

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
 * @type {(index: Index) => string}
 */
const indexExpr = index => {
    if (typeof index === 'string') { return `string_any(${stringLiteral(index)})` }
    throw ['no Rust for a numeric index', index]
}

/**
 * A Rust expression of type `Any<A>` for an EDAG node.
 *
 * `shared` names the nodes that already have a `let` binding, so a node
 * reached from several places is constructed once and cloned at every
 * reference — EDAG sharing in printed form.
 *
 * Every use site fixes `A`, so no expression needs a turbofish: the operators
 * above take `Any<A>` arguments and the shared `let` bindings are annotated.
 *
 * @type {(shared: readonly (readonly[Exp, string])[]) => (e: Exp) => string}
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
     * it needs no parentheses either. A shared node is a lowered value and so
     * never an operation, which is why the tag alone decides this.
     *
     * @type {(e: Exp) => boolean}
     */
    const composed = e => e instanceof Array
        && e[0] !== 'undefined' && e[0] !== '[]' && e[0] !== '{}' && e[0] !== '=>' && e[0] !== '.'
    /** @type {(e: Exp) => string} */
    const f = e => {
        if (!(e instanceof Array)) { return primitiveExpr(e) }
        const bound = shared.find(([n]) => n === e)
        if (bound !== undefined) { return bound[1] }
        const [id, a, b, c] = /** @type {readonly any[]} */ (e)
        if (id === 'undefined') { return 'Nullish::Undefined.to_any()' }
        if (id === '[]') {
            return a.length === 0
                ? 'Array::default().to_any()'
                : `[${a.map(f).join(', ')}].to_array().to_any()`
        }
        if (id === '{}') {
            return a.length === 0
                ? 'Object::default().to_any()'
                : `[${a.map(propertyExpr).join(', ')}].to_object().to_any()`
        }
        if (id === '.') {
            if (c !== undefined) { throw ['no Rust for a property-access chain step', e] }
            return `Any::own_property(${f(a)}, ${indexExpr(b)}).unwrap()`
        }
        if (id === '=>') {
            // `nanvm-lib` has no closures yet, so no `=>` node prints as one.
            // The one lambda a caller may hand this printer is `() =>
            // undefined`, which no operator inspects; any other lambda is
            // refused rather than printed as a function it is not.
            if (!isSmallestLambda(a, b)) { throw ['no Rust for', e] }
            return 'function_any()'
        }
        return e.length === 2 ? op1(id)(nested(a))
            : e.length === 3 ? op2(id)(nested(a), nested(b))
            : op3(id)(nested(a), nested(b), nested(c))
    }
    /** An operand, parenthesized where its rendering would otherwise re-associate. */
    /** @type {(e: Exp) => string} */
    const nested = e => composed(e) ? `(${f(e)})` : f(e)
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
     * @type {(p: Properties) => string}
     */
    const propertyExpr = p => {
        if (p[0] !== ':') { throw ['not a property', p] }
        return `(${keyExpr(p[1])}, ${f(p[2])})`
    }
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
 * @type {(e: Exp) => string}
 */
export const nodeExpr = expExpr([])

/**
 * The distinct nodes an EDAG reaches from more than one place, each paired
 * with the raw count of references — the generalization of a corpus's
 * explicit, named `data.shared` to a linked EDAG, where sharing is implicit:
 * two references to one `const` are the same `Exp` object by identity (see
 * `fjs/fsc/edag/module.f.mjs`'s `lower`), never restated as data.
 *
 * The order is a full post-order over the graph — every node's dependencies
 * before the node itself — visiting each distinct node's children only once,
 * on first encounter, so a heavily shared graph costs its node count and not
 * the exponential a naive walk would pay. That order is exactly what a
 * `let`-binding printer needs: a shared node's own initializer may reference
 * an earlier shared node, and it must already be bound by then.
 *
 * `root` itself is never "shared" by this count — nothing outside the graph
 * points at it, and the graph is acyclic, so it cannot reach itself — which
 * is why it never needs a binding of its own; a caller prints it as the
 * function's final, unbound expression.
 *
 * @type {(root: Exp) => readonly Exp[]}
 */
export const sharedNodesOf = root => {
    /** @type {Map<Exp, number>} */
    const counts = new Map()
    /** @type {Exp[]} */
    const order = []
    /** @type {(e: unknown) => void} */
    const visit = e => {
        if (!(e instanceof Array)) { return }
        const n = counts.get(/** @type {Exp} */ (e)) ?? 0
        counts.set(/** @type {Exp} */ (e), n + 1)
        if (n === 0) {
            e.forEach(visit)
            order.push(/** @type {Exp} */ (e))
        }
    }
    visit(root)
    return order.filter(e => (counts.get(e) ?? 0) >= 2)
}
