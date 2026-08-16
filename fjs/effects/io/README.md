# IoEffect — effects with an explicit error channel

`IoEffect<O, T, E>` is `Effect<O, Result<T, E>>`: the raw effect from
[`../module.f.mjs`](../module.f.mjs) with its failure made part of the type.
It is the **preferred high-level abstraction for fallible work**; the raw
`Effect<O, T>` remains the low-level representation both it and the raw
combinators are built from.

This directory is stage 1 of the migration planned in
[`../todo/io-effect-migration.md`](../todo/io-effect-migration.md). Today it
holds types and nothing else — [`./types.ts`](./types.ts) — so adopting it
changes no operation, no runner, and no consumer.

## Why the layer exists

`throw` in FunctionalScript is a panic, and the language offers no
`try`/`catch`, so the effect system itself has to carry the recovery path.
Today it does not: raw `step` does not understand `Result`, and a continuation
that ignores its argument runs on the success path whether or not the previous
effect failed.

```js
const a = writeFile(...)
const b = step(a, () => console('written'))
```

`writeFile` may return an error and `'written'` is still printed. The code looks
like an ordinary sequence, but it means "run the next effect regardless". Every
caller must remember to inspect each `Result` by hand, or wrap the continuation
in `okStep`; missing one silently changes control flow.

With an `IoEffect`-aware `step`, that same line means what it looks like:
`console('written')` runs only on `ok`, and an error propagates on its own. That
gives FunctionalScript the default error-propagation path other languages get
from exceptions or Rust's `?`, without giving it exceptions.

## The vocabulary (stage 2)

Three branch-aware operations, arriving with this directory's `module.f.mjs`:

- `step` — continue on `ok`, propagate the error. The normal path.
- `catchStep` — continue on `error`, preserve the success value. The error path.
- `resultStep` — continue with the complete `Result`. Both paths, explicitly.

The union rules follow `okThen` in
[`../../types/result/module.f.mjs`](../../types/result/module.f.mjs): error
types are **unioned, not unified**, so neither side is pre-widened and a branch
that is passed through stays the very tuple it arrived as. `types.ts` pins the
widening those signatures rely on — and pins that it only goes one way, so an
unhandled error type is a compile error rather than a value nobody looked at.

The new `step` conflicts with the raw one, which is why these live in their own
module and can already use their final names. Stage 5 retires the raw public
abstraction and renames `IoEffect` to `Effect`.

## `NotImplemented`

`NotImplemented` says the runner cannot dispatch an operation and has not
started it. It is ordinary recoverable effect data, not a fatal runner
condition: the program gets control back and owns the policy — recover, choose a
fallback operation, or panic itself.

**By command name only.** An operation's payload may hold functions —
`createServer`'s listener, `sandbox`'s thunk, `test`'s body — so carrying it
would break the serializability claim. `types.ts` pins that claim as a
type-level assert against the JSON data model rather than leaving it as a
comment, so a later payload field fails to compile.

**Not a security boundary.** A runner keeps its authority over execution through
a separate, out-of-band mechanism: it may interrupt or terminate a program that
is malicious, over budget, or violating host policy, and nothing in the error
channel obliges it to hand control back. The two mechanisms must not be
conflated in either direction — a capability the runner merely lacks is answered
with `NotImplemented`, never by killing the program, and a refusal to continue
is an interruption, never dressed up as `NotImplemented`.

## What is deliberately absent

- **No runtime module yet.** A declaration-only stage belongs in `types.ts`
  rather than acquiring an artificial JavaScript representation, so there is no
  `module.f.mjs` and no constructor here. The lifts (`v => pure(ok(v))`,
  `e => pure(error(e))`) land in stage 2, with the operations that need them.
- **No `notImplemented` value.** Nothing produces this error until stage 6,
  where a runner may omit a handler; until then it exists in the type model and
  runners stay total over their declared operation maps.
- **No mirrored raw API.** Io variants of the other combinators arrive when real
  consumers require them, not speculatively.
