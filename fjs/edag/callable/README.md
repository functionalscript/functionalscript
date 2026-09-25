# EDAG callables

`callable(length, body)` selects a pre-generated arrow factory. The callback
receives `(fixed, rest)`. Missing fixed values are `undefined`; the tail begins
at `length`. Each returned arrow has that native `.length` without mutation,
`eval`, `Function`, dynamic imports or host helpers.

`npm run gen` regenerates `table.f.mjs` with lengths **0 through 32**, inclusive.
This is the current JavaScript executor capacity, not a language or EDAG limit.
An uncovered length fails through the executor's assertion contract when it
materializes the function. Compilation and source writing do not consult the
table. Supplied argument count and rest-array length are not limited by it.

The factories provide callable values and arity. They do not provide EDAG-derived
default text: native `toString()` still describes the wrapper. The shared
renderer and host-conversion association remain unfinished in
[the parameter plan](../../../spec/todo/3120-parameters.md).
