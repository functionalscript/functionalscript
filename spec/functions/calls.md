# Calls

**Status:** implemented

- A function is **called** as JavaScript calls one: `f(a, b)` with no
  receiver, and `o.m(a)` with `o` as the receiver. A call is a step after a
  value, as a property access is, and what a step applies to is everything
  written before it — so `f(1)(2)` calls what `f(1)` returns, and
  `o.m(1).n(2)` calls `n` on what `o.m(1)` returned. The arguments are the
  list an array holds, a trailing comma and a [spread](../values/arrays.md#spread) included:
  `f(...a, 4)` passes `a`'s elements and then `4`, and
  `(...r) => f(...r)` forwards the values and never the array, since every
  callee builds its own rest array from the arguments.

  Parentheses around the property do not drop the receiver: `(o.m)(a)`
  passes `o` as surely as `o.m(a)` does, since the parentheses keep the
  property reference — only detaching the value loses it, as `(0, o.m)(a)`
  does with the comma operator. `(o.m)(a)` is in the language
  ([grouping](../operators/grouping.md)) and is the same program as `o.m(a)`, down to the
  graph it compiles to; the detached spelling waits on the comma operator,
  so every call written on a property today is a call with a receiver.

  A method call's property is the access's, but its key is judged by the
  call rule and not the read rule ([property access](../property-access/README.md)): a
  member function on `fjs/js/prototype`'s `prohibitedCalls` is a compilation
  error, every other prototype name but `length` is a call the VM answers by
  the receiver's type, and the read of either stays refused. The represented
  interpreters and the native VM implement the admitted
  [member functions](../built-ins/member-functions.md), including the function
  text the [exception](../principles/README.md#function-source-representation-exception) adopts.

  The graph outputs preserve a call: the EDAG carries its node, generated
  Rust runs it through nanvm-lib, and FunctionalScript writes `f(a)` or
  `a.b(c)`. JSON and DataJS output evaluate it and serialize its result,
  provided the selected data contains no function ([output](../command-line/output.md)).

## Examples

No programs yet: this page's accepted and refused examples are a follow-up.

## Reference

- ECMA-262: [Function calls](https://tc39.es/ecma262/#sec-function-calls)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Function_calls>
