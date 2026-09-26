## browser-failure-of. `failureOf` is written twice, and the host copy keeps a branch that cannot run

**Priority:** P4
**Status:** open

### Problem

The browser runner turns a module's thrown cause into a result in two
places, once pure and once on the host:

```js
// fjs/emergent_testing/browser/module.f.mjs
const failureOf = (module, cause) =>
    mapStep(errorDetails(cause), ([message, stack]) => moduleFailure(module, 0, message, stack))
// fjs/emergent_testing/browser/module.mjs
const failureOf = async (source, duration, cause) => {
    const described = await asyncRun(commonOperationMap)(errorDetails(cause))
    const [message, stack] = described[0] === 'ok'
        ? described[1]
        : /** @type {const} */ ([unknownValue, unknownValue])
    return moduleFailure(source, duration, message, stack)
}
```

They differ only in `duration`, which the pure one fixes at zero. The
host copy also guards a case its types rule out: `errorDetails` is an
effect over `catch` alone, with no error channel, and
`commonOperationMap` serves `catch`, so `described` is always `ok`. The
`unknownValue` arm, and the import that exists for it, are dead code
inside the file where nothing measures coverage.

### Proposal

The pure module exports the one function, with `duration` as a
parameter, and the host runner runs it:

```ts
export const failureOf: (module: string, duration: number, cause: unknown)
    => Effect<Catch, _BrowserTestResult, never>
```

The host's `failureOf` becomes the `asyncRun` of that effect and an
unwrap; the dead arm and the `unknownValue` import go with it.

### Tasks

- [ ] Export `failureOf` from `browser/module.f.mjs`; the internal callers
      pass `0`.
- [ ] `browser/module.mjs` runs it instead of restating it.
- [ ] `tsc`, `fjs test`.

### Related

- [browser-proof-file-size.md](./browser-proof-file-size.md) — shrinks
  the same host file from the other end, its proofs.
