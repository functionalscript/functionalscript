## nix-shell-parameter-table. The shared shell's optional parameters are restated four times in `ci/nix`

**Priority:** P4
**Status:** open

### Problem

A shared shell takes `targets` when the job has Rust, `shellHook` when
any system declares a hook, and `url`/`hash` when there is a pin. That
rule appears in `fjs/ci/nix/module.f.mjs` as `systemValues`, which
computes the per-system values; `sharedValues`, the same keys as
references; the lambda's open-set pattern in `devShells`,

```js
['open-set-pattern', 'pkgs', ...(job.rust === undefined ? [] : ['targets']),
    ...(declaresHook(job) ? ['shellHook'] : []), ...(job.pin === undefined ? [] : ['url', 'hash'])]
```

and `systemArguments`, which recomputes `archive` and `hookOf` and
re-applies the three conditions to bind each argument. A fourth
parameter is four coordinated edits, and a missed one is a flake whose
pattern and call disagree — which nothing in the types catches.

### Proposal

A private table in the module, one row per parameter:

```ts
const shellParams: readonly {
    names: readonly string[]
    present: (job: Job) => boolean
    values: (job: Job, system: string) => readonly Expression[]
}[]
```

The pattern, `sharedValues` and `systemArguments` are folds over the
present rows, and `systemArguments` takes its values from
`systemValues` rather than recomputing them.

### Tasks

- [ ] The table and the three folds; `npm run gen` regenerates
      byte-identical flakes; `fjs test`.

### Related

- [65z-ci-nix.md](./65z-ci-nix.md) — the shared-shell design this
  restates.
