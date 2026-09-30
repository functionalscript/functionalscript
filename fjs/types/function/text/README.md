# Function text

`withText(f, text)` gives a function value its text: it is `f` for calls,
`length` and `typeof`, and every host conversion to a string answers
`text()`, computed at the conversion. The `get` trap answers both
`toString` and `Symbol.toPrimitive`.

`text` answers `undefined` for a text that cannot be rendered. A conversion
that reads the text then throws a `TypeError`, rather than answering the
wrapper's source. A numeric one (`+f`, `f * 1`, `f < 5`) answers `NaN`
instead, since no function text converts to a number, so it keeps the value
it has without a text, as
[to-primitive's Stage 1](../../../../nanvm-lib/todo/to-primitive.md#stage-1-refuse-what-cannot-be-answered)
requires. Two rows of that table the trap cannot tell apart from their
neighbours: `f < "z"` sees the number hint, so a refused text answers
`false` where `nanvm-lib` throws; and `[].join(f)` reads the separator's
text, so it throws where `nanvm-lib` answers `""`.

It is a `Proxy`, which FunctionalScript does not have, so it is a thin
host module: nothing is mutated, and each call makes a new value, as each
evaluation of a `=>` node makes a new function. The
[`length` factories](../length/README.md) make the callable; the EDAG
evaluator hands both to it through its `withText`
([`fjs/edag/operations/types.ts`](../../../edag/operations/types.ts)), with
the writer's `tryFunctionText`
([`fjs/compiler/serializer`](../../../compiler/serializer/module.f.mjs)) as
the text. [`fjs/nanvm/text.proof.mjs`](../../../nanvm/text.proof.mjs) runs
the operator corpus's function-text cases that way.

`Function.prototype.toString.call(f)` does not reach the trap: it reads
no property, and answers the engine's text for a callable `Proxy`.
