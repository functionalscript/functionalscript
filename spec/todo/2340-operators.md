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
|           |unary `-`|1          |
|           |unary `+`|1          |
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

The [comma operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator) is allowed. It was previously rejected on the grounds that it is useful only when we want to mutate — but that is not its only use. In a pure language the sole side effect a discarded operand can have is *throwing*, which makes `,` the assertion form:

```js
const f = a => (assert(a >= 0), a + 2)
```

Each operand but the last is evaluated for its throw-potential and its value discarded; the value of the expression is the last operand. The equivalent statement spellings — a bare `assert(...)` statement, or a `const` whose value is unused — denote the same function, and all of them lower to the AST's `comma` operation ([ast-spec](../../todo/ast-spec.md)), which is where the exact semantics live: every operand is evaluated before the result is revealed, but the order among the discarded operands is not observable.

Asserts express **internal contract breaches**, not input validation: untrusted input must be validated with values (`Result` / `Nullable`), since a program that throws on user input can be crashed by any user.

This does not weaken the position on mutation: [let](./3220-let.md) remains the only case where an object can be mutated, and keeping its life-time tracking simple is unaffected by a comma operator whose operands are pure.

Depends on [default-export](../2110-default-export.md) and [undefined](../2310-undefined.md).

For mutating operators, see [assignments](./3430-assignments.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
