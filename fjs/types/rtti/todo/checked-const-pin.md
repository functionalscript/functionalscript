# A checked pin for schema `const`s

**Priority:** P3
**Status:** open — needs a decision, no design agreed

## Problem

A schema bound to a `const` has to pin its literal, and the only spelling
available is a cast:

```js
export const casAddArgs = /** @type {const} */ ({
    content: string,
    type: or('text', 'base64', undefined)
})
```

There are 119 of these across `fjs/`. The cast pins, but it checks nothing —
`/** @type {const} */` is `as const`, and a const assertion asks TypeScript only
to stop widening. Nothing here says the value is a `Type`. Misspell a member
(`conten: string`) or use a value that is not a schema at all and the
declaration still compiles; the error surfaces later, at whichever `validate`,
`parse`, or `toJsonSchema` call first consumes it — or not at all, if the only
consumer takes a plain `Type`.

A `const` type parameter would do both jobs at once:

```js
/**
 * @template {Type} const T
 * @param {T} t
 * @returns {T}
 */
export const type = t => t

export const casAddArgs = type({ content: string, type: or('text', 'base64', undefined) })
```

`type` pins exactly as `as const` does — that is what the modifier means — and
additionally checks `T extends Type` at the declaration, where the mistake is.
See "Prefer a `const` type parameter to a cast at the call site" in
[`fjs/AGENTS.md`](../../../AGENTS.md) for the rule this would extend from
arguments to declarations.

## Why it is not obviously right

- **It invents a runtime function to carry a type-level fact.** The identity
  call survives into the emitted JavaScript. `fjs/AGENTS.md` says never to
  invent a runtime value solely to represent a TypeScript-only declaration; this
  is not quite that — the checking is real and there is a value to return — but
  it is close enough to need an explicit decision rather than a drive-by.
- **Cyclic schemas may not survive it.** `../../../edag/module.f.mjs` spells its
  node types out longhand with a comment explaining why: a const assertion
  applied to the returned array cannot resolve the cycle back through
  `array`/`object`/`op0` to `exp`, and declaration emit elides it to `any`.
  Whether an identity call through `<const T extends Type>` fares better or
  worse there is unknown and has to be measured before anything is converted.
- **The win is uneven.** A schema of plain thunks (`{ a: number }`) is already
  checked structurally by whatever consumes it. The check earns its keep on
  schemas with literal members and on exported schemas whose only consumer is
  generic.

## Tasks

- [ ] Decide whether a runtime identity function is acceptable for this, or
      whether the declaration pin stays a cast.
- [ ] If it is: measure it against the `edag` cycle first — convert one node
      there and diff the emitted `.d.mts` for `any`.
- [ ] Pick the name (`type` collides with the `type:` member in several
      schemas; `schema` may read better) and site it in `../module.f.mjs`.
- [ ] Convert in batches, diffing declaration emit per batch, per the method in
      [`../../../../todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md).

## Related

- [`../../../../todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md)
  — the audit of inline casts, which excluded `@type {const}` wholesale.
- [`../../../edag/module.f.mjs`](../../../edag/module.f.mjs) — the cyclic
  declarations that constrain the design.
