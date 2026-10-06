# A function's text in the JavaScript-hosted evaluators

**Accepted as the host's** (ruled by @sergey-shandar on
[#2469](https://github.com/functionalscript/functionalscript/pull/2469),
2026-10-01). The original evaluators, `amnesia` and `memo` over
[`operations`](./operations/module.f.mjs), answer a function's text with
whatever the JavaScript host answers. They neither render the EDAG-derived
text nor refuse. This document records why, so the question is not reopened
without something new.

**Migration update:** memo now retains function EDAG and uses the shared
`functionText` renderer for direct and indirect conversion. Its trusted
`functionText(analysis, index): string` entry renders every admitted body;
`tryFunctionText` checks separately supplied expressions and returns admission
diagnostics through `Result`. Amnesia still uses the host behavior documented
below until its [migration](todo/edag-value.md).

Existing canonical text stays unchanged. Where the source serializer cannot
reconstruct a body, function text uses general JavaScript expressions. Shared
nodes use lazy memo cells local to each invocation, preserving demand, identity
and nested captures. These cells may use mutation in the emitted JavaScript;
the renderer itself is immutable FJS. This is code-only text with capture-slot
names, not a serialization of captured values, a FJS source round trip or an
implementation of callable runtime compilation. `tryStringify` remains partial.

## What the language says a function's text is

FunctionalScript fixes a function's default text: it is the EDAG-derived
rendering of the function's code
([function-source exception](../../spec/README.md#function-source-representation-exception)).
Parameters take canonical names, and under D2 captured values are written
as slot names
([to-primitive, Stage 3](../../nanvm-lib/todo/to-primitive.md#stage-3-a-functions-text)).
So `x => x * 2` is `($a_0)=>$a_0*2`, and `() => undefined` is
`()=>undefined`.
`nanvm-lib` answers exactly that. The FunctionalScript writer renders the
text at compile time (`tryFunctionText` in
[`fjs/compiler/serializer`](../compiler/serializer/module.f.mjs)), and the
Rust VM keeps it beside the function (`IStaticFunction::static_function`).

The same exception already says that running source on a JavaScript engine
keeps that host's function text. The host-valued evaluators described below are
the same case; memo's represented values use the shared renderer instead.

## What the host-valued evaluators answer

The `=>` operation does not make a function out of the EDAG. It makes a host
closure with `callable(length, body)` from
[`fjs/types/function/length`](../types/function/length/module.f.mjs). That
closure is one of seventeen fixed wrappers, one per parameter count, and
each wrapper hands its arguments back to the evaluator:

```js
g => (a0, ...rest) => g([a0], rest)
```

The host answers a function's text from the function's own source, so:

| FunctionalScript              | the evaluator answers                | `nanvm-lib` answers  |
| ----------------------------- | ------------------------------------ | -------------------- |
| `String(x => x * 2)`          | `'(a0, ...rest) => g([a0], rest)'`   | `'($a_0)=>$a_0*2'`   |
| `String(x => x + 1)`          | `'(a0, ...rest) => g([a0], rest)'`   | `'($a_0)=>$a_0+1'`   |
| `(x => x * 2) + '!'`          | `'(a0, ...rest) => g([a0], rest)!'`  | `'($a_0)=>$a_0*2!'`  |
| `(x => x * 2) < (x => x + 1)` | `false`                              | `true`               |

Every function of one length has the same text here, so a program that
compares, concatenates or keys on function text can answer differently
here and on the Rust VM.

## Why host closures cannot carry the rendered text

The host asks the function itself for its text, so the function would have
to carry the right text. A host closure carries its own source and nothing
else. Every way to change that is ruled out
([#2418](https://github.com/functionalscript/functionalscript/pull/2418)):

- **A `Proxy`** around the closure could answer `toString` with the
  rendered text. A `Proxy` is not a FunctionalScript object, so the
  evaluator's values cannot be one. #2418 built this and it was reverted.
- **Setting `toString`** on the closure with `Object.defineProperty` is
  property mutation, which FunctionalScript does not have.
- **A thin `.mjs` adapter** that does either of the above cannot be reached.
  A FunctionalScript module (`.f.mjs`, `.f.js`) cannot import a JavaScript
  one (`.mjs`, `.js`).

## Why the host-valued evaluators do not refuse it either

[#2469](https://github.com/functionalscript/functionalscript/pull/2469)
first made the evaluator's own conversions throw on a function: `String(f)`,
binary `+` with one, and a string comparison with one. The argument was
[DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) and the
[render-or-refuse rule](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse):
a plausible wrong value is worse than an error. The refusal was reverted in
the same pull request, for these reasons:

- **The text is the host's, as in JavaScript.** Different JavaScript engines
  already return different text for the same function. The language does
  not promise one engine's text either, and the closure's own source is
  what a JavaScript engine would answer for it. Throwing is further from
  JavaScript than answering it.
- **It could only be partial.** Most conversions happen inside the host,
  where no evaluator node sees the function: `String([f])`, `[f].join()`,
  `'x'.startsWith(f)`, and `+` or a comparison with an array or object that
  holds a function. Those would still answer the wrapper's text, so the
  refusal would not have made the evaluator agree with the Rust VM.
- **It adds nothing toward the MVP.** It would be a breaking change to
  published code for a result no MVP step asks of these evaluators.
- **The way forward is another representation.** These evaluators already
  get what they can from host closures. Correct text needs a different
  representation of code and data, not more changes to this one.

## How to test it

Amnesia's proof checks only that a function's text is a string, never what the
string is, because engines differ: the `lambda` proof
in [`amnesia/proof.f.mjs`](./amnesia/proof.f.mjs) converts an evaluated
function with `String` and with `+`. The corpus's exact-text cases carry a
`host` marker ([`fjs/nanvm/types.ts`](../nanvm/types.ts)). The JavaScript
side skips them, and the Rust side alone runs them, where the text is the
language's.

The shared value-conversion proofs used by memo check EDAG-derived text,
including indirect conversion. The renderer's proofs cover the general
JavaScript text separately from source round-trip serialization.

## What would change this

The [EdagValue proposal](./todo/edag-value.md) is the replacement in progress:
every FJS VM carries function code and evaluated captures as EDAG values and
renders their text through the shared renderer. The accepted behavior above
remains Amnesia's host-valued baseline until its migration. Explicit
conversion to an ordinary runtime value typed as `unknown` erases EDAG
reflection; JavaScript callables at that boundary retain the host-text
exception.

Memo's function values carry their EDAG without a `Proxy`, mutation or imported
JavaScript. Callable runtime compilation remains separate work; this cutover
does not yet convert represented functions into ordinary runtime callables.
