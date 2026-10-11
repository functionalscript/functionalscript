# Function length

`callable(length, body)` selects an arrow factory from a hand-written table.
The callback receives `(fixed, rest)`. Missing fixed values are `undefined`;
the tail begins at `length`. Each returned arrow has that native `.length`
without mutation, `eval`, `Function`, dynamic imports or host helpers: a
function's `length` comes only from a written parameter list.

The `factories` table covers lengths **0 through 16**, inclusive: `maxLength`, the
language's limit on a function's `length`, so every valid function has a
factory. [`fjs/edag/analysis`](../../../edag/analysis/module.f.mjs) refuses a
longer one as a binding error, and `callable` asserts it. Supplied argument
count and rest-array length are not limited by it.

`isIndex` is the canonical-length predicate `callable` asserts: a nonnegative
integer, positive zero only. [`fjs/edag/analysis`](../../../edag/analysis/module.f.mjs)
validates EDAG function lengths with it.

The factories provide ordinary JavaScript callable values and arity. Their host
`toString()` describes the wrapper, without EDAG-derived default text; their
argument splitting and identities are pinned by [the factory proofs](./proof.f.mjs).
Amnesia and memo no longer use these factories to represent functions. They
retain bodies and evaluated captures as `EdagValue`s, and shared conversion
uses the implemented compiler renderer for canonical, code-only text. Native
compiled functions carry that renderer's static text. Captures appear as slot
names, without their values; FJS source serialization remains partial. See the
[function-text contract](../../../edag/function-text.md),
[represented conversion proofs](../../../edag/value/convert/proof.f.mjs) and
[native text proofs](../../../edag/rust/proof.f.mjs).

Ordinary runtime callables produced at a boundary that erases EDAG reflection
keep the [host-text exception](../../../edag/function-text.md#host-runtime-values).
Retaining and retrieving a native/AOT callable's semantic EDAG remains separate
work in [the association plan](../../../compiler/todo/associate-edag-with-functions.md).
It does not block implemented default text or require adding reflection to these
host wrappers. [The parameter plan](../../../../spec/todo/3120-parameters.md)
tracks the remaining approval and migration tasks.
