# Function length

`callable(length, body)` selects an arrow factory from a hand-written table.
The callback receives `(fixed, rest)`. Missing fixed values are `undefined`;
the tail begins at `length`. Each returned arrow has that native `.length`
without mutation, `eval`, `Function`, dynamic imports or host helpers: a
function's `length` comes only from a written parameter list.

`table.f.mjs` covers lengths **0 through 16**, inclusive: `maxLength`, the
language's limit on a function's `length`, so every valid function has a
factory. [`fjs/edag/analysis`](../../../edag/analysis/module.f.mjs) refuses a
longer one as a binding error, and `callable` asserts it. Supplied argument
count and rest-array length are not limited by it.

`isIndex` is the canonical-length predicate `callable` asserts: a nonnegative
integer, positive zero only. [`fjs/edag/analysis`](../../../edag/analysis/module.f.mjs)
validates EDAG function lengths with it.

The factories provide callable values and arity. They do not provide EDAG-derived
default text: native `toString()` still describes the wrapper. The shared
renderer and host-conversion association remain unfinished in
[the parameter plan](../../../../spec/todo/3120-parameters.md).
