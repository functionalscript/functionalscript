# Operators

|Type       |Operator |Priority   |
|-----------|---------|-----------|
|Comparison |`==`     |not allowed|
|           |`!=`     |not allowed|
|           |`===`    |**done**   |
|           |`!==`    |**done**   |
|           |`>`      |**done**   |
|           |`>=`     |**done**   |
|           |`<`      |**done**   |
|           |`<=`     |**done**   |
|Arithmetics|`+`      |**done**   |
|           |`-`      |**done**   |
|           |`*`      |**done**   |
|           |`/`      |**done**   |
|           |`%`      |**done**   |
|           |unary `-`|**done**   |
|           |`**`     |**done**   |
|Bitwise    |`&`      |**done**   |
|           |`\|`     |**done**   |
|           |`^`      |**done**   |
|           |`~`      |**done**   |
|           |`<<`     |**done**   |
|           |`>>`     |**done**   |
|           |`>>>`    |**done**   |
|Logical    |`&&`     |**done**   |
|           |`\|\|`   |**done**   |
|           |`??`     |**done**   |
|           |`!`      |1          |
|Conditional|`?:`     |**done**   |
|Comma      |`,`      |1          |
|Type       |`typeof` |EDAG only  |

**Stages A and B are in the language** — every row marked **done** — and
the [specification](../README.md#operators) is the one place their syntax,
precedence and associativity, the `-`/`~`-before-`**` refusal, the
function-operand rule and each output's handling of an operator are stated.
The lazy operators and the conditional are the EDAG's own nodes — `op2` for
`&&`, `||` and `??`, `op3` for `?:` — whose laziness the EDAG states
positionally; what the front end adds is the anchoring rule below, the
eager/lazy split `anchors` in [`fjs/fsc/ast`](../../fjs/fsc/ast/module.f.mjs)
reads by. The remaining priority-1 rows are `!`, which the paragraph on
`typeof` below leaves open with it, and the comma, which generalizes that
anchoring rule.

The line every fold this table adds is held to: unary `-` folds over a
numeric literal, since negating one is exact, total arithmetic, and nothing
else folds — `+` alone would need `ToPrimitive` to decide number or string,
and folding the rest while leaving `+` a node draws an inconsistent line.
Fold what is exact; leave what needs an assumption to the readers that want
a value.

An index is not an expression: it is a constant key, a string or a number,
so a negative key is written as the string it names, `a["-1"]`.

The [comma operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator) is allowed. It was previously rejected on the grounds that it is useful only when we want to mutate — but that is not its only use. In a pure language the sole side effect a discarded operand can have is *throwing*, which makes `,` the assertion form:

```js
const f = a => (assert(a >= 0), a + 2)
```

Each operand but the last is evaluated for its throw-potential and its value discarded; the value of the expression is the last operand. The equivalent statement spellings — a bare `assert(...)` statement, or a `const` whose value is unused — denote the same function, and all of them lower to the EDAG's `","` operation ([edag-stage1-discussion](../../todo/edag-stage1-discussion.md), subject 8, for the graph representation). The [failure contract](../README.md#failure-is-one-outcome) governs execution: each required operand's success must be established before the result is revealed, without requiring a fixed evaluation order or computation count.

A written comma lowers under the rule the compiler already applies to an unused `const` ([`fjs/fsc/edag`](../../fjs/fsc/edag/module.f.mjs)): the `","` anchors exactly the code the graph would not otherwise hold, so an operand whose node the result or another operand reaches is dropped, and a comma left with its result alone is the result. `const a = []; const b = a; export default (b, a.length);` is `['.', A, 'length']` with no comma, since `b` is `a`'s node and the access reaches it, where `const b = a.x; export default (b, a.length);` keeps `[',', [['.', A, 'x'], ['.', A, 'length']]]`, `b` being a node of its own that the result does not reach.

The lazy operators bring lazy positions, and with them the anchoring rule is best read as a subtraction. Every `const` and every import starts as an operand of the comma, in source order, with the export last; then each operand is deleted that a later operand is guaranteed to evaluate through eager edges alone — a container item, an access base, an operator's left operand, a comma operand — and never through a lazy one: the right operand of `&&`, `||` or `??`, a conditional's arm. A function body is not lazy for this purpose, since constructing the function evaluates its frame. So `const c = null.x; export default [a && c, b && c];` keeps `c`, `[',', [c, ['[]', [['&&', a, c], ['&&', b, c]]]]]`, and throws at load as JavaScript does, where `[c, a && c]` deletes it, the array evaluating it first. The rule holds one level down too: an operand another unreached operand reaches only lazily is not deleted for it — `const d = null.x; const c = a && d; export default b && c;` keeps both `d` and `c`, since evaluating `a && d` as a root establishes `d` no more than `b && c` established `c`. `anchors` in [`fjs/fsc/ast`](../../fjs/fsc/ast/module.f.mjs) is this rule for the operators Stage B has; the comma's own operands are its to add.

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
