# `fileCas.list` re-implements the inverse of `toPath`

**Priority:** P4
**Status:** open

## Problem

The shard layout's forward direction is owned by `toPath`
(`fjs/cas/module.f.ts:47-52`): a cBase32 key string splits `2 / 2 / rest`
into `a/b/c` path segments under the `.cas` prefix.

The inverse — recover a key from an on-disk shard path — is open-coded
inside `fileCas.list` (`fjs/cas/module.f.ts:228-232`):

```ts
return readdir(storePrefix, { recursive: true })
    .step(r => pure(unwrap(r).flatMap(({ name, parentPath, isFile }) =>
        toOption(isFile
            ? cBase32ToVec(normalize(parentPath).substring(normalizedStorePrefix.length).replaceAll('/', '') + name)
            : null))))
```

`normalize(parentPath).substring(prefixLen).replaceAll('/', '') + name` is
the structural inverse of `join(prefix, a, b, c)` with `s = a + b + c`, but
nothing ties the two together. Changing the shard layout in `toPath` (e.g. a
different shard depth) would silently produce wrong keys in `list` — the
same one-layout-two-owners hazard that `shard-dir-helper.md` records for the
forward direction in `publish`.

## Proposal

Give the layout a single owner in both directions. Alongside the `shard`
helper proposed in `shard-dir-helper.md` (forward: key → `{dir, name}`), add
the inverse:

```ts
/** Recovers the content key from a store-relative shard path, or null if it isn't one. */
const unshard = (relPath: string): Vec | null =>
    cBase32ToVec(relPath.replaceAll('/', ''))
```

`fileCas.list` then maps each file entry through
`unshard(relative-path-of(parentPath, name))` instead of hand-stripping the
prefix and separators inline. The only call site touched is `fileCas.list`.
Together with `shard-dir-helper.md`, the `2/2/rest` rule then exists exactly
once, with `toPath`/`unshard` as its two views.

## Tasks

- [ ] Extract the path→key derivation from `fileCas.list` into a named
      inverse helper co-located with `toPath` (and `shard`, if
      `shard-dir-helper.md` lands first).
- [ ] Keep the ENOENT-is-empty-store behavior of `list` unchanged.
- [ ] Run `npx tsc` and `fjs t`; CAS proofs pass unchanged.

## Related

- `fjs/cas/todo/shard-dir-helper.md` — the forward half of the same layout
  concern; these two issues are complementary and should cross-reference.
