## grammar-and-format-policy. The config grammar and the repository-format gate share one module, and the grammar is private

**Priority:** P4
**Status:** open

### Problem

`fjs/git/config` reads the config file "for the one thing the readers
need from it: the id width", and that purpose shaped the module: the
generic Git config grammar — the character classes, `tryValue` and its
escapes, `tryHeader`, `tryLine`, the typed readers `tryInt` and
`isBoolean` with Git's suffix factors, and the last-wins lookup
`valuesOf`/`last` — sits beside `v0Extensions`, `knownExtensions`,
`versionStep`, `extensionsOf` and `tryOidBytes`, the
`extensions.objectformat` policy. Only `tryEntries` and `tryOidBytes`
are exported; `fjs/git/store` imports the second.

The next consumer of the config file cannot use the grammar. `ref-writing`
already names one — `core.sharedRepository`, which nothing reads today —
and it would either reach into this module's privates or re-derive
`git_config_int` and last-wins. The private `valuesOf`/`valueAt` also
collide by name with `fjs/git/header`'s exports of the same names for a
different structure.

### Proposal

Two modules, one concern each. `fjs/git/config` keeps the grammar and
exports a typed surface:

```ts
export const tryEntries: (raw: string) => Nullable<readonly Entry[]>
export const lastValue: (entries: readonly Entry[], section: string, key: string) => Nullable<string>
export const tryInt: (value: string) => Nullable<bigint>
export const tryBool: (value: string) => Nullable<boolean>
```

The extensions and version gate move next to what they decide,
`fjs/git/store`'s `oidBytes`, as `tryOidBytes(entries)` over the
exported readers — or into `fjs/git/config/format` if a second
format-policy reader appears.

### Tasks

- [ ] Export the typed readers; move the format gate; proofs follow their
      code.
- [ ] `tsc`, `fjs test`; `store`'s behaviour on every config the proof
      pins is unchanged.

### Related

- [../../refstore/todo/ref-writing.md](../../refstore/todo/ref-writing.md)
  — the `core.sharedRepository` read that would be this grammar's second
  consumer.
- [../../store/todo/alternates-module.md](../../store/todo/alternates-module.md)
  — the same shape of split, for the alternates decoder.
