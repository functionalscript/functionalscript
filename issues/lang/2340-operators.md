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
|Comma      |`,`      |not allowed|

[Comma operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator) is useful only when we want to mutate. We have only one case where we can mutate an object; it's [let](./3320-let.md), and we would like to keep it as simple as possible to track life-time. So, NO for the `,` comma operator. 

Depends on [default-export](./2110-default-export.md) and [undefined](./2310-undefined.md).

For mutating operators, see [assignments](./3330-assignments.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
