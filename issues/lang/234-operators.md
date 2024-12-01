# Function Body

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

## Only for `let`

|Type       |Operator|Priority|
|-----------|--------|--------|
|Assignment |`=`     |1       |
|           |`+=`    |2       |
|           |`-=`    |2       |
|           |`*=`    |2       |
|           |`/=`    |2       |
|           |`%=`    |2       |
|           |`**=`   |2       |
|           |`<<=`   |2       |
|           |`>>=`   |2       |
|           |`>>>=`  |2       |
|           |`&=`    |2       |
|           |`^=`    |2       |
|           |`\|=`   |2       |
|           |`&&=`   |2       |
|           |`\|\|=` |2       |
|           |`??=`   |2       |
|Arithmetic |`++`    |3       |
|           |`--`    |3       |

## Example

```js
export default {

}
```

Depends on [default-export](./211-default-export.md).

See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
