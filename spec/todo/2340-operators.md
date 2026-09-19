# Operators

|Type       |Operator |Priority   |
|-----------|---------|-----------|
|Comparison |`==`     |not allowed|
|           |`!=`     |not allowed|
|           |`===`    |1          |
|           |`!==`    |1          |
|           |`>`      |1          |
|           |`>=`     |1          |
|           |`<`      |1          |
|           |`<=`     |1          |
|Arithmetics|`+`      |1          |
|           |`-`      |1          |
|           |`*`      |1          |
|           |`/`      |1          |
|           |`%`      |1          |
|           |unary `-`|**done**   |
|           |`**`     |1          |
|Bitwise    |`&`      |1          |
|           |`\|`     |1          |
|           |`^`      |1          |
|           |`~`      |1          |
|           |`<<`     |1          |
|           |`>>`     |1          |
|           |`>>>`    |1          |
|Logical    |`&&`     |1          |
|           |`\|\|`   |1          |
|           |`??`     |1          |
|           |`!`      |1          |
|Conditional|`?:`     |1          |
|Comma      |`,`      |1          |
|Type       |`typeof` |EDAG only  |

**Unary `-` is in the language.** It is the first operator, and the one the
front end needed first: the tokenizer used to fold a `-` into the number,
bigint or `Infinity` after it, which made `-1 .x` an access on `-1` where
JavaScript reads `-(1 .x)`, and `-1()` a call on `-1` where JavaScript calls
`1`. Both were refused rather than answered wrongly; reading the `-` as the
prefix it is retired both refusals and the fold with them.

The shape the rest can follow, and the line it draws. The grammar reads the
operator and computes nothing, so `-1` is `['-', 1]` in the parser's tree.
The **lowering** folds that one case: negating a numeric literal is exact
arithmetic — total, and answered without knowing anything else about the
program — so the graph holds the number. A `-` over anything else stays a
node, because folding one would mean saying what a string or a container
converts to, which is `ToPrimitive`'s and depends on what the value holds.
Every fold this table adds should be held to that line: fold what is exact,
leave what needs an assumption to the readers that want a value.

Two consequences. `export default -1;` compiles to `.rs` because the
printer meets the leaf, where a negation of anything else is refused —
`Neg for Any<A>` answers `Result<Any<A>, Any<A>>` and a generated module's
`Any<A>` has nowhere to put the `Err`, so what that side wants is a shape
for a throwing operation. And the `.json` and DataJS outputs compute a
value for the negations that survive: the five primitive types convert, and
a container is refused rather than guessed at.

An index is not an expression: it is a constant key, a string or a number,
so a negative key is written as the string it names, `a["-1"]`.

The [comma operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator) is allowed. It was previously rejected on the grounds that it is useful only when we want to mutate — but that is not its only use. In a pure language the sole side effect a discarded operand can have is *throwing*, which makes `,` the assertion form:

```js
const f = a => (assert(a >= 0), a + 2)
```

Each operand but the last is evaluated for its throw-potential and its value discarded; the value of the expression is the last operand. The equivalent statement spellings — a bare `assert(...)` statement, or a `const` whose value is unused — denote the same function, and all of them lower to the EDAG's `","` operation ([edag-stage1-discussion](../../todo/edag-stage1-discussion.md), subject 8, for the graph representation). The [failure contract](../README.md#failure-is-one-outcome) governs execution: each required operand's success must be established before the result is revealed, without requiring a fixed evaluation order or computation count.

A written comma lowers under the rule the compiler already applies to an unused `const` ([`fjs/fsc/edag`](../../fjs/fsc/edag/module.f.mjs)): the `","` anchors exactly the code the graph would not otherwise hold, so an operand whose node the result or another operand reaches is dropped, and a comma left with its result alone is the result. `const a = []; const b = a; export default (b, a.length);` is `['.', A, 'length']` with no comma, since `b` is `a`'s node and the access reaches it, where `const b = a.x; export default (b, a.length);` keeps `[',', [['.', A, 'x'], ['.', A, 'length']]]`, `b` being a node of its own that the result does not reach.

Once the operators bring lazy positions, the anchoring rule is best read as a subtraction. Every `const` and every import starts as an operand of the comma, in source order, with the export last; then each operand is deleted that a later operand is guaranteed to evaluate through eager edges alone — a container item, an access base, an operator's left operand, a comma operand — and never through a lazy one: the right operand of `&&`, `||` or `??`, a conditional's arm. A function body is not lazy for this purpose, since constructing the function evaluates its frame. So `const c = null.x; export default [a && c, b && c];` keeps `c`, `[',', [c, ['[]', [['&&', a, c], ['&&', b, c]]]]]`, and throws at load as JavaScript does, where `[c, a && c]` deletes it, the array evaluating it first.

**Failure order is already decided**, not an open operator-design question:

```js
const a = null.x;
const b = undefined.y;
export default [b, a];
```

The redundant anchors for `a` and `b` can be removed because the result graph
reaches both computations; the failing computations themselves are not deleted.
A graph traversal may encounter `b`'s failure first, where source JavaScript
encounters `a`'s. Under the [specification](../README.md#failure-is-one-outcome),
both are the same failure outcome. Source-order execution remains legal, but
no source-order barrier is required merely to preserve the first failure.

Preserve semantic success/failure subject to runner interruption, not identical
module-loading behavior at identical resource limits. Required failures cannot
be discarded to invent a successful result, and skipped failures cannot be
introduced on an otherwise successful path. Different memory/time thresholds
and fail-fast schedules do not distinguish failure outcomes.

Asserts express **internal contract breaches**, not input validation: untrusted input must be validated with values (`Result` / `Nullable`), since a program that throws on user input can be crashed by any user.

This does not weaken the position on mutation: [let](./3220-let.md) remains the only case where an object can be mutated, and keeping its life-time tracking simple is unaffected by a comma operator whose operands are pure.

Depends on [export default](../README.md#exporting-a-value) and [undefined](../README.md#supported-value-types).

`typeof` is an EDAG operation (`op1Id` in
[`fjs/edag/module.f.mjs`](../../fjs/edag/module.f.mjs)) that FunctionalScript
does not parse. The EDAG admits every pure operation and the language spells a
subset of them; unary `+` is the other operation on that side of the line.
Whether `typeof` becomes syntax, and at what priority, is open.

For mutating operators, see [assignments](./3430-assignments.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
