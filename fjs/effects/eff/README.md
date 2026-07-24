# Eff

`fjs/effects/eff` is the optional fluent wrapper layer over the raw effect
model in [`fjs/effects`](../module.f.ts). The raw `Effect` type and `step`
primitive remain the contract interpreters and public APIs should speak; `Eff`
is just one method-chaining vocabulary for writing those same effects.

## When to use `Eff`

Use `Eff` when a module is mostly sequencing effects and the left-to-right
method chain is easier to read than nested raw `step(step(effect, f), g)` calls.
Wrap a raw operation with `eff(operation)` at the boundary into the fluent world,
chain with `.step(...)`, and unwrap once with `.value` at the boundary back to a
raw `Effect`:

```ts
import { eff, pure } from './module.f.ts'

const program = eff(read(key))
    .step(value => eff(write(key, value + 1)))
    .step(() => pure(undefined))
    .value
```

## Prefer one vocabulary per module

Pick one style for a module and keep it consistent:

- **Raw-effect style:** import `pure` and `step` from `fjs/effects/module.f.ts`,
  return raw `Effect` values from continuations, and compose with `step`.
- **Eff style:** import `eff` and `pure` from `fjs/effects/eff/module.f.ts`,
  return `Eff` values from `.step` continuations, and touch raw `Effect` values
  only at boundaries with `eff(rawEffect)` and `.value`.

Avoid mixing the two systems inside a single chain. A module that alternates
between raw `Effect` continuations and `Eff` continuations is harder to read
because callers must keep track of which layer they are in at every step. If a
raw core combinator is still the best tool for a local operation, make the
bridge explicit and localized: unwrap with `.value` before passing to the raw
combinator, then wrap the resulting raw effect with `eff(...)` before returning
to the fluent chain.

## API boundaries

Expose raw `Effect` values from interpreters, operation helpers, and public APIs
unless the API is explicitly about fluent chaining. This keeps downstream users
free to use raw `step`, this `Eff` wrapper, or their own wrapper over the same
core effect model.
