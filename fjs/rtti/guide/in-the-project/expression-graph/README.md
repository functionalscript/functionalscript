# The expression graph

**Status:** implemented

The compiler's intermediate form is declared as a schema:
[`edag`](../../../../edag/module.f.mjs) is its grammar, and
[`edag/value`](../../../../edag/value/module.f.mjs) its evaluated values. The
compiler's output is checked against the grammar, and
[`nanvm`](../../../../nanvm/module.f.mjs) checks its operator cases against
`edag`'s `op1Id` and `op3Id` with `validate`.

Every tuple in the grammar is closed, and that is load-bearing: the grammar
claims each JavaScript chain has exactly one spelling, and an `open` tuple
would let a node carry a trailing element nothing reads
([structs and tuples are closed](../../schemas/closed-containers/README.md)).
`edag/value/metadata` checks an evaluated value's metadata with rtti's error
helpers after `edag/value`'s shape check, and declares no schema of its own.

## Examples

The demo on this page offers two schemas: the unary operators, a union of
strings, and an evaluated value, which is recursive. They are defined in
[`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists them among all the others.

## Where it is implemented

The modules linked above.
