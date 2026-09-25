# Function length

`callable(length, body)` selects an arrow factory from a hand-written table.
The callback receives `(fixed, rest)`. Missing fixed values are `undefined`;
the tail begins at `length`. Each returned arrow has that native `.length`
without mutation, `eval`, `Function`, dynamic imports or host helpers: a
function's `length` comes only from a written parameter list.

The `factories` table covers lengths **0 through 32**, inclusive. This is the current
JavaScript executor capacity, not a language or EDAG limit.
[function-length-limit](../../../../spec/todo/function-length-limit.md)
proposes fixing it in the language. An uncovered length fails through the
executor's assertion contract when it materializes the function. Compilation
and source writing do not consult the table. Supplied argument count and
rest-array length are not limited by it.

`isIndex` is the canonical-length predicate `callable` asserts: a nonnegative
integer, positive zero only. [`fjs/edag/analysis`](../../../edag/analysis/module.f.mjs)
validates EDAG function lengths with it.

The factories provide callable values and arity. They do not provide EDAG-derived
default text: native `toString()` still describes the wrapper. The shared
renderer and host-conversion association remain unfinished in
[the parameter plan](../../../../spec/todo/3120-parameters.md).
