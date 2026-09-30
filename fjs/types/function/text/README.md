# Function text

`withText(f, text)` gives a function value its text: it is `f` for calls,
`length` and `typeof`, and every host conversion to a string answers
`text()`, computed at the conversion. What `text` throws, the conversion
throws, which is how a text that cannot be rendered is refused rather than
answered with the wrapper's source.

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
