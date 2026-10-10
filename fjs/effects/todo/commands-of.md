## Consumers repeat the `Commands` cast over `Object.keys`

**Priority:** P5
**Status:** open

### Problem

A `CommandSet<O>` is a record whose keys are the commands; the list a
partial runner tests membership against is `Object.keys` of it, cast to
`Commands<O>` because `Object.keys` answers `string[]`. That cast, with a
comment justifying it, is written at
[`fjs/effects/node`](../node/module.f.mjs)'s `nodeCommands`,
[`fjs/edag/value/to_unknown`](../../edag/value/to_unknown/module.f.mjs)'s
`compileCommands` and
[`fjs/website/demo-runtime.mjs`](../../website/demo-runtime.mjs)'s
`commands` — the last one saying it is "the same shape `effects/node` uses
for the same reason".

### Proposal

`commandsOf` in [`fjs/effects`](../module.f.mjs), next to the
[`CommandSet` and `Commands` types](../types.ts): the one justified cast,
once. The listed sites call it.

### Tasks

- [ ] `commandsOf`, proven; the listed sites onto it.
