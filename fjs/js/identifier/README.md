# Identifier

What may start an identifier and what may continue one, for the ASCII
identifiers this repository writes: Latin letters, digits, `_` and `$`.
[`module.f.mjs`](./module.f.mjs) adds `_` and `$` to the character classes of
[`text/ascii`](../../text/ascii/module.f.js) and nothing more. JavaScript
itself also admits Unicode letters such as `π`; these predicates refuse them,
so they do not validate an arbitrary JavaScript identifier.

|Export                  |Answers                                                         |
|------------------------|----------------------------------------------------------------|
|`isIdentifierStart(c)`  |whether code point `c` may start an identifier                  |
|`isIdentifierPart(c)`   |whether `c` may continue one                                    |
|`isIdentifier(s)`       |whether the string `s` is an identifier                         |
|`isInteger(s)`          |whether `s` is a decimal integer without a leading zero         |

```js
import { isIdentifier } from './module.f.mjs'

isIdentifier('$a_1') // true
isIdentifier('1a')   // false
```

A printer asks `isIdentifier` to decide whether an object key can be written
bare, `{ a: 1 }`, or must be quoted, `{ 'a-b': 1 }`. A keyword passes this
test, since the rule is about characters; ask
[`keywords`](../keywords/README.md) as well where that matters.
