# A function's text in the EDAG interpreters

Amnesia and memo retain function bodies and evaluated captures as `EdagValue`s.
Their shared [conversion](./value/convert/module.f.mjs) uses the EDAG-derived
function renderer for explicit `String(f)` and indirect conversion through
arrays, object coercion, keys and built-in methods. Neither interpreter creates
host callables or overrides a host function's `toString`.

The trusted `functionText(analysis, index): string` entry in the
[serializer](../compiler/serializer/module.f.mjs) renders every admitted body.
`tryFunctionText` checks separately supplied expressions and returns admission
diagnostics through `Result`. Captures appear as slot names, `$0`, `$1`, and so
on, without including their values. Two functions instantiated from the same
body therefore have the same text even when their captures differ.

All generated bindings use one `$n` counter per rendered document. External
frame slots receive the first numbers, including unused slots; declarations
then receive distinct numbers in text order, across all nested scopes. Where the source serializer cannot
reconstruct a body, function text uses general JavaScript expressions. Lazy
memo cells local to each invocation preserve shared nodes and lazy demand in
that text. The emitted JavaScript may use local mutation; the renderer itself
is immutable FJS. Amnesia still recomputes each edge when interpreting the body:
function text describes its code, independently of the chosen execution model.

This is code-only text, not a serialization of captured values, a FJS source
round trip or an implementation of callable runtime compilation. Source
serialization through `tryStringify` remains partial. Callable runtime
compilation uses [`value/to_unknown`](./value/to_unknown/module.f.mjs) and the
JavaScript value emitter. `compiler/transpiler.transpile` uses that boundary
for ordinary runtime exports; the
[value contract](./values.md#runtime-compilation) describes target support.

## Host runtime values

The [function-source exception](../../spec/README.md#function-source-representation-exception)
allows ordinary JavaScript execution to retain its host's function text.
Converting an EDAG function to a runtime callable intentionally loses EDAG
reflection; that boundary remains subject to the host exception.

Before the EDAG-value migration, Amnesia and memo used the fixed arrow wrappers
in `fjs/types/function/length`. Their text was accepted as the host's in
[#2469](https://github.com/functionalscript/functionalscript/pull/2469).
Changing those closures with a `Proxy`, property mutation or a JavaScript import
was rejected in [#2418](https://github.com/functionalscript/functionalscript/pull/2418).
Keeping code as represented data removes that need. Both interpreters now
check canonical text, including the corpus's cases that the independent
JavaScript reference still skips because its function text is host-defined.

## A function that names itself

A body that reads `["self"]` has no arrow spelling, since an arrow function
cannot name itself. Its text is a named function expression,
`(function $0($1){…})`, with its self name allocated before its parameters.
Memo cells, their local temporaries, captured-slot bindings, and nested
functions all share the counter, so none shadows another. The source writer spells the same function
as a `const` whose initializer reads the name, `const $0=()=>$0();`, the one
FunctionalScript form of a function that reaches itself.
