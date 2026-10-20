# String Conversion

**Status:** implemented

```js
export default (...a) => [String(a[0]), String(42n), String([1, 2])];
```

`String(exp)` converts its operand to a string, as JavaScript's `String`
does when called. A string is itself. `null` and `undefined` become
`"null"` and `"undefined"`, booleans become `"true"` or `"false"`, and numbers
and `bigint`s become their decimal text: `String(-0)` is `"0"`,
`String(NaN)` is `"NaN"`, and `String(42n)` is `"42"`. An array joins its
elements with commas, with `null` and `undefined` contributing empty text,
so `String([1, [2, 3], null])` is `"1,2,3,"`.

An object uses the string hint for primitive conversion: its `toString`
is tried before its `valueOf`, with no arguments. A noncallable method or
a nonprimitive result falls through to the next method. An object with no
own `toString` uses the ordinary `"[object Object]"` text, so
`String({ valueOf: () => 7 })` is `"[object Object]"`. If neither method
produces a primitive, or a method throws, conversion fails
([failure is one outcome](../principles/README.md#failure-is-one-outcome)). A function becomes
its [EDAG-derived text](../principles/README.md#function-source-representation-exception), which
describes its code without embedding captured values.

The one-argument conversion reaches the graph as `['String', exp]`, with
no front-end folding. The FunctionalScript writer spells it as `String(exp)`;
the EDAG and Rust outputs retain the operation, and the JSON and DataJS
outputs evaluate it. It is an expression wherever a value may stand,
including an operand, `String(x) + "!"`, or a base, `String(x).length`.
`String()` is the empty-string literal, as in JavaScript.

**`String` is a reserved word**, under the same
[global-name rule](../todo/2365-global-names.md) as `Number`. A module cannot
bind it as a `const`, parameter or import, and it has no standalone value:
`const f = String;` and `String.fromCharCode(65)` are compilation errors
(`reserved word`). A key or property name remains ordinary,
`{ String: 1 }.String` being `1`. Reserving the word lets every `String(x)`
denote the conversion without resolving a scope, and keeps future namespace
members from changing the meaning of existing bindings.

The conversion is an operator, not a function
([operators and functions](../principles/README.md#operators-and-functions)),
so `String()` and `String(x)` are all the call shapes it has: multiple
arguments and spreads are refused by design at the word
(`String takes one argument`). So is the guarded call `String?.(x)`, at the
word (`reserved word`), as `Number?.(x)` is ([number conversion](number.md)).
A property key computed at run time still requires `Number(...)`
([property access](../property-access/README.md)); `a[String(x)]` is refused as every
other unrecognized computed key is.

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [ToString](https://tc39.es/ecma262/#sec-tostring), [String()](https://tc39.es/ecma262/#sec-string-constructor-string-value)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String>
