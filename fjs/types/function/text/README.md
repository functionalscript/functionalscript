# Function text

`withText(f, text)` gives a function value its text: it is `f` for calls,
`length` and `typeof`, and every host conversion answers `text()`, computed
at the conversion. The `get` trap answers both `toString` and
`Symbol.toPrimitive`, so the text wins over the callable's own `valueOf` or
`Symbol.toPrimitive`.

`text` answers `undefined` for a text that cannot be rendered, and every
conversion of the function then throws a `TypeError` rather than answering
the wrapper's source. That includes the numeric ones, `+f` and `f < 5`,
which
[to-primitive's Stage 1](../../../../nanvm-lib/todo/to-primitive.md#stage-1-refuse-what-cannot-be-answered)
answers with `NaN` and `false` without a text. The host cannot tell them
apart from `f < "z"`, which compares the text: both reach the function
with the `number` hint. Answering `NaN` would make `f < "z"` a plausible
`false`, so the adapter refuses both
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
`[].join(f)` throws for the same reason, where `nanvm-lib` answers `""`.

It is a `Proxy`, which FunctionalScript does not have, so it is a thin
host module: nothing is mutated, and each call makes a new value, as each
evaluation of a `=>` node makes a new function. The
[`length` factories](../length/README.md) make the callable; the EDAG
evaluator hands both to it through its `withText`
([`fjs/edag/operations/types.ts`](../../../edag/operations/types.ts)), with
the writer's `tryFunctionText`
([`fjs/compiler/serializer`](../../../compiler/serializer/module.f.mjs)) as
the text. [`fjs/nanvm/text`](../../../nanvm/text/module.mjs) runs
the operator corpus's function-text cases that way.

`Function.prototype.toString.call(f)` does not reach the trap: it reads
no property, and answers the engine's text for a callable `Proxy`.

Filed to be removed: [drop-proxy](./todo/drop-proxy.md).
