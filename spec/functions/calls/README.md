# Calls

**Status:** implemented

- A function is **called** as JavaScript calls one: `f(a, b)` with no
  receiver, and `o.m(a)` with `o` as the receiver. A call is a step after a
  value, as a property access is, and what a step applies to is everything
  written before it — so `f(1)(2)` calls what `f(1)` returns, and
  `o.m(1).n(2)` calls `n` on what `o.m(1)` returned. The arguments are the
  list an array holds, a trailing comma and a [spread](../../values/arrays/README.md#spread) included:
  `f(...a, 4)` passes `a`'s elements and then `4`, and
  `(...r) => f(...r)` forwards the values and never the array, since every
  callee builds its own rest array from the arguments.

  Parentheses around the property do not drop the receiver: `(o.m)(a)`
  passes `o` as surely as `o.m(a)` does, since the parentheses keep the
  property reference — only detaching the value loses it, as `(0, o.m)(a)`
  does with the comma operator. `(o.m)(a)` is in the language
  ([grouping](../../operators/grouping/README.md)) and is the same program as `o.m(a)`, down to the
  graph it compiles to; the detached spelling is the comma operator's
  ([comma](../../operators/comma/README.md)), which calls the function `o.m` holds as
  a plain one, and every other call written on a property is a call with a
  receiver.

  A method call's property is the access's, but its key is judged by the
  call rule and not the read rule ([property access](../../property-access/README.md)): a
  member function on `fjs/js/prototype`'s `prohibitedCalls` is a compilation
  error, every other prototype name but `length` is a call the VM answers by
  the receiver's type, and the read of either stays refused. The represented
  interpreters and the native VM implement the admitted
  [member functions](../../built-ins/member-functions/README.md), including the function
  text the [exception](../../principles/README.md#function-source-representation-exception) adopts.

  The graph outputs preserve a call: the EDAG carries its node, generated
  Rust runs it through nanvm-lib, and FunctionalScript writes `f(a)` or
  `a.b(c)`. JSON and DataJS output evaluate it and serialize its result,
  provided the selected data contains no function ([output](../../command-line/output.md)).

## Examples

The compiler demo has no programs for this page yet: its accepted and refused examples are a follow-up.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — a call of a call, and a method call
with a spread argument — with every output `fjs compile` makes of it: the
expression graph (EDAG), the Rust and the WebAssembly that Rust builds to.
Its Run button calls the default export with `1` and `3`, as JavaScript and
as WebAssembly, and shows what each call returned or threw.

```js
const add = (...x) => (...y) => x[0] + y[0];
const o = { m: (...v) => [v.length, ...v] };
export default (...a) => [add(a[0])(10), o.m(...[a[0], 4], 5)];
```

## Reference

- ECMA-262: [Function calls](https://tc39.es/ecma262/#sec-function-calls)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions>
