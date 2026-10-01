# A function's text in the JavaScript-hosted evaluators

**Accepted as the host's** (ruled by @sergey-shandar on
[#2469](https://github.com/functionalscript/functionalscript/pull/2469),
2026-10-01). The evaluators in this directory, `amnesia` and `memo` over
[`operations`](./operations/module.f.mjs), answer a function's text with
whatever the JavaScript host answers. They neither render the EDAG-derived
text nor refuse. This document records why, so the question is not reopened
without something new.

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
keeps that host's function text. These evaluators are the same case.

## What these evaluators answer

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

## Why the evaluators cannot render it

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

## Why they do not refuse it either

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

A proof on the JavaScript side checks only that a function's text is a
string, never what the string is, because engines differ. The corpus's
exact-text cases carry a `host` marker ([`fjs/nanvm/types.ts`](../nanvm/types.ts))
and run on the Rust side, where the text is the language's.

## What would change this

A representation in which a function value carries its EDAG, or a host
boundary that can find the EDAG from the value, with no `Proxy`, no
mutation and no import of JavaScript. Then the text could be rendered here
too. Until then, the host's text is the answer.
