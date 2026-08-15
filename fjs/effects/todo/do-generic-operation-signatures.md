# `do_` cannot express a generic operation signature

**Priority:** P3
**Status:** open

### Problem

`do_` builds an effect constructor from a command name:

```js
export const do_ = command => (...payload) => ({ command, payload, continuation: pure })
```

Its result is typed by `Func<O> = (..._: Param<O>) => Effect<O, Return<O>>`, which
works whenever the operation's parameter and return types are fixed. Three
operations are generic in a type parameter `Func<O>` has nowhere to put, so each
is cast instead:

| Site | Cast |
| --- | --- |
| `fjs/effects/memory/module.f.mjs:34` | `<T>(value: T) => Effect<MemCreate, Key<T>>` |
| `fjs/effects/memory/module.f.mjs:39` | `<T>(key: Key<T>) => Effect<MemRead, T>` |
| `fjs/effects/node/module.f.mjs:47` | `<O extends Operation, T>(...a: readonly Effect<O, T>[]) => Effect<O \| All, readonly T[]>` |

The contrast is visible in one file: `fjs/effects/node/module.f.mjs` writes the
non-generic cases as `/** @type {Func<Stat>} */ const stat = do_('stat')` — an
annotated declaration, checked — and the generic one as an inline cast, which
is not. `memWrite` moved to the declaration form during the cast cleanup for
exactly this reason; `memCreate` and `memRead` could not.

These are the last casts in the effects API that are load-bearing rather than
noise. See [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md).

### Proposal

Give `Operation` a way to declare type parameters, so `Func<O>` can produce a
generic signature and the three sites become annotated declarations like their
non-generic neighbours. Failing that, record here why it cannot be done, so the
casts stop reading as an oversight.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md) — the audit
  these three came out of.
