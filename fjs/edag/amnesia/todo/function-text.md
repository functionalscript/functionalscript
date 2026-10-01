## function-text. The FunctionalScript evaluator cannot answer a function's text

**Priority:** P3
**Status:** open; a custom text is ruled out

### Problem

`nanvm-lib` answers a function's text with the FunctionalScript writer's
rendering of its EDAG (`tryFunctionText` in `fjs/compiler/serializer`):
`() => undefined` is `()=>undefined`. The evaluator does not. The `=>`
operation in [`fjs/edag/operations`](../../operations/module.f.mjs) makes the
value with `callable(length, body)` from
[`fjs/types/function/length`](../../../types/function/length/module.f.mjs),
and `String(f)` of it is the factory's own source,
`(a0, ...rest) => g([a0], rest)`. The parameter plan
([default function text](../../../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse))
calls that a wrong successful result: it has to render or refuse.

The corpus's function-text cases therefore carry a `host` marker
(`fjs/nanvm/types.ts`) and run on the Rust side only.

### Why the evaluator's functions cannot carry the text

A FunctionalScript function cannot be given a custom `toString`, so the
evaluator, which is FunctionalScript, cannot make one that answers the
writer's text:

- **A `Proxy` is not a FunctionalScript object.** A `get` trap answering
  `toString` would give every host conversion the text, and
  [#2418](https://github.com/functionalscript/functionalscript/pull/2418)
  built it as a host adapter. It was reverted: a `Proxy` cannot be built
  in FunctionalScript, so the evaluator's own values would depend on a host
  object the language does not have. A thin `.mjs` adapter is no way around
  it either: a FunctionalScript module (`.f.mjs`, `.f.js`) cannot import a
  JavaScript one (`.mjs`, `.js`).
- **Setting `toString` is mutation.** `Object.defineProperty` on the fresh
  callable is property mutation, which the language does not grant.
- **A host conversion never reaches an evaluator node.** `join`, `+`,
  `startsWith` and the rest convert the value itself, so refusing in the
  evaluator's own `String` node would not cover them.

Rust's text does not depend on any of this: `nanvm-lib` holds the text
beside the function (`IStaticFunction::static_function`), and the
generated corpus tests check it there.

### What remains open

Whether the evaluator should refuse where it can, in its own `String` node
and the operations that convert operands themselves, rather than answer the
wrapper's text there. The host conversions above stay out of reach either
way, so the `host` marker stays.

### Related

- [../../../../nanvm-lib/todo/to-primitive.md](../../../../nanvm-lib/todo/to-primitive.md): Stage 3, step 6.
- [../../../types/function/length/README.md](../../../types/function/length/README.md):
  the factories, which say they do not provide the text.
