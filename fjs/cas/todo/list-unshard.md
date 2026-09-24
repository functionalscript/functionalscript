## `fileCas.list` re-implements the inverse of `toPath`

**Priority:** P4
**Status:** open

### Problem

The shard layout's forward direction is owned by `shard` in
`fjs/cas/module.f.mjs`: a cBase32 key string splits `2 / 2 / rest` into a
`.cas/a/b` directory and a `c` file name, and `toPath` and `publish` are its
two views.

The inverse — recover a key from an on-disk shard path — is open-coded
inside `fileCas.list`:

```ts
return readdir(storePrefix, { recursive: true })
    .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
        toOption(isFile
            ? cBase32ToVec(normalize(parentPath).substring(normalizedStorePrefix.length).replaceAll('/', '') + name)
            : null))))
```

`normalize(parentPath).substring(prefixLen).replaceAll('/', '') + name` is
the structural inverse of `shard` with `s = a + b + c`, but nothing ties the
two together. Changing the shard layout in `shard` (e.g. a different shard
depth) would silently produce wrong keys in `list` — the one-layout-two-owners
hazard `shard` already removed from the forward direction in `publish`.

### Proposal

Give the layout a single owner in both directions. Alongside `shard`
(forward: key → `{dir, name}`), add the inverse:

```ts
/** Recovers the content key from a store-relative shard path, or null if it isn't one. */
const unshard = (relPath: string): Vec | null =>
    cBase32ToVec(relPath.replaceAll('/', ''))
```

`fileCas.list` then maps each file entry through
`unshard(relative-path-of(parentPath, name))` instead of hand-stripping the
prefix and separators inline. The only call site touched is `fileCas.list`.
The `2/2/rest` rule then exists exactly once, with `shard`/`unshard` as its
two directions.

### Tasks

- [ ] Extract the path→key derivation from `fileCas.list` into a named
      inverse helper co-located with `shard`.
- [ ] Keep the ENOENT-is-empty-store behavior of `list` unchanged.
- [ ] Run `tsc` and `fjs t`; CAS proofs pass unchanged.
