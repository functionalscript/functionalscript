# Number Conversion

**Status:** implemented

```js
export default (...a) => [Number(a[0]), Number("0x10"), Number(1n)];
```

`Number(exp)` converts its operand to a number, exactly as JavaScript's
`Number` does when called. A number is itself. A string is read as a numeric
literal, the whitespace around it ignored: `Number("0x10")` is `16`,
`Number(" 4 ")` is `4`, `Number("")` is `0`, and `Number("x")` is `NaN`.
`null` is `0`, `undefined` is `NaN`, and a boolean is `1` or `0`. A `bigint`
is the nearest number — `Number(1n)` is `1`, and `Number(2n ** 64n)` is
`18446744073709552000`, rounded as JavaScript rounds it. An array and an
object are made primitive as the [operators](../operators/README.md) make them: an array
by joining its elements, so `Number([7])` is `7` and `Number([1, 2])` is
`NaN`; an object through its own `valueOf` or `toString`, called as
JavaScript calls them, and `"[object Object]"` otherwise, so `Number({})` is
`NaN`. A function converts to its text, which is no number. Where a
`valueOf` or a `toString` throws, so does the conversion
([failure is one outcome](../principles/README.md#failure-is-one-outcome)).

It is the language's conversion to a number: unary `+` is not FunctionalScript
syntax, and where the EDAG has it the two differ, `+` throwing on a `bigint`
([operators](../operators/README.md)). It is the EDAG's own
`['Number', exp]`, which graph outputs preserve and every executor answers; the
front end folds nothing, `Number("1")` reaching the graph as a node, as `~1`
does. The conversion is a value like any other: an operand, `-Number("1")`
and `Number(a) * 2`; a base, `Number(a).x`; and a callee, however little
calling a number is worth. The FunctionalScript writer spells it back as it
is written, the operand an argument, `Number(1+2)`.

**`Number` is a reserved word**, one of the names
[global names](../todo/2365-global-names.md) reserves, with `Array`, `Object`
([built-in static functions](../built-ins/static-functions.md)) and `String`
([string conversion](string.md)) —
[`fjs/js/keywords`](../../fjs/js/keywords/module.f.js)' `reservedGlobals`, a
list beside the keywords rather than among them, since JavaScript has no
such keyword. A module cannot bind it, as a `const`, a parameter or an
import's local name ([shared values](../bindings/constants.md)), and it is
no value: it stands as the callee of a call and as the namespace of the
four predicates the language admits, `Number.isInteger`,
`Number.isSafeInteger`, `Number.isNaN` and `Number.isFinite`
([built-in static functions](../built-ins/static-functions.md)), and is a
compilation error (`reserved word`) anywhere else — bare,
`const f = Number;`, or as the namespace of any other member,
`Number.MAX_SAFE_INTEGER` or `Number.parseFloat(x)`, each an admission of
its own ([built-ins](../todo/2360-built-in.md)).
A key or a property name is not a reference, so `{ Number: 1 }` and
`o.Number` mean what they mean in JavaScript. `Number()` is `0`, as in
JavaScript, and reaches the graph as the literal, folded as `-1` is. The
conversion is an operator, not a function
([operators and functions](../principles/README.md#operators-and-functions)),
so `Number()` and `Number(x)` are all the call shapes it has: every other is
refused by design (`Number takes one argument`), `Number(a, b)` and
`Number(...a)` among them. So is the guarded call `Number?.(x)`, refused at
the word (`reserved word`): a guard asks whether a value is nullish, and an
operator is no value, so the expression asks nothing — JavaScript, whose
`Number` is never nullish, reads it as `Number(x)`.

The word is reserved for the guarantee `undefined`, `NaN` and `Infinity`
already have ([numbers](../values/numbers.md)): a global word means one thing wherever
it stands. `Number(x)` is the conversion in every module, so a reader, an
agent or a tool reads it without resolving a scope, where a JavaScript module
that binds the word — `const Number = x => x;`, the shadowing JavaScript's
linters flag — makes every `Number(…)` after it something else. And it keeps
the language free to grow: a member of the namespace admitted later,
`Number.parseFloat` say ([built-ins](../todo/2360-built-in.md)), cannot
change what an existing module means, since no module could have bound the word
([global names](../todo/2365-global-names.md)). The one JavaScript spelling it
costs, a module rebinding a standard global, is refused at compile time
rather than read another way.

It is also the one key computed at run time, `a[Number(i)]`
([property access](../property-access/README.md)).

## Examples

The compiler demo offers the programs `number` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [ToNumber](https://tc39.es/ecma262/#sec-tonumber), [Number()](https://tc39.es/ecma262/#sec-number-constructor-number-value)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number>
