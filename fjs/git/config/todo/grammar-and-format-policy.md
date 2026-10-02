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
exports a typed surface that keeps Git's reading rule: every assignment
of a key is parsed as the reader reaches it and the last one wins, so a
malformed assignment refuses the file whatever stands after it — the
fold `versionStep` writes today for `repositoryformatversion`:

```ts
export const tryEntries: (raw: string) => Nullable<readonly Entry[]>
/** Every assignment of `section.key`, in file order. */
export const values: (entries: readonly Entry[], section: string, key: string) => readonly string[]
/** The last assignment, `null` for none. */
export const lastValue: (entries: readonly Entry[], section: string, key: string) => Nullable<string>
/** The last assignment as Git's int, `ok(null)` for none; `error` where any assignment is no int. */
export const lastInt: (entries: readonly Entry[], section: string, key: string) => Result<Nullable<bigint>, string>
/** The same for Git's bool. */
export const lastBool: (entries: readonly Entry[], section: string, key: string) => Result<Nullable<boolean>, string>
```

`lastInt` and `lastBool` are the typed readers a consumer wants —
`core.sharedRepository` included — and neither can be written from
`lastValue` alone, which is why `lastValue` is not the whole surface:
a reader that parsed only the winning value would accept a file Git
refuses.

The extensions and version gate move next to what they decide,
`fjs/git/store`'s `oidBytes`, as `tryOidBytes(entries)` over the
exported readers — `lastInt` for the version, `values` for the
extension assignments it checks one by one — or into
`fjs/git/config/format` if a second format-policy reader appears.

### Tasks

- [ ] Export the typed readers; move the format gate; proofs follow their
      code.
- [ ] `tsc`, `fjs test`; `store`'s behaviour on every config the proof
      pins is unchanged.

### Related

- [../../refstore/todo/ref-writing.md](../../refstore/todo/ref-writing.md)
  — the `core.sharedRepository` read that would be this grammar's second
  consumer.
- [`fjs/git/alternates`](../../alternates/module.f.mjs) — the same shape of
  split, done for the alternates decoder.
