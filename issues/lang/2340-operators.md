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

Depends on [default-export](./2110-default-export.md) and [undefined](./2310-undefined.md).

For mutating operators, see [assignments](./3330-assignments.md)

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
