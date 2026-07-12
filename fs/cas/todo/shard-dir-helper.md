## shard-dir-helper. Single owner for the shard directory layout

**Priority:** P4
**Status:** open

### Problem

The store's on-disk shard layout is defined by `toPath`
(`fs/cas/module.f.ts:47-52`): `join(prefix, a, b, c)`. But `publish`
re-derives the *parent directory* of a shard by parsing the relative path
back apart and dropping the last segment (`:169-171`):

```ts
const rel = toPath(hash)
const dst = join(path, rel)
const dstDir = join(path, ...parse(rel).slice(0, -1))
```

`parse(rel).slice(0, -1)` reconstructs, via generic path-segment surgery, a
directory that the shard layout already determines (`join(prefix, a, b)`).
Shard-layout knowledge is thus split across two functions: `toPath` decides
how a key becomes segments, and `publish` separately assumes "the last
segment is the file name". A layout change (e.g. a different shard depth)
would have to be caught in both places, and the `mkdir(dstDir,
{ recursive: true })` that follows depends on the fragile re-parse.
`fs/path/module.f.ts` also has no `dirname`/`parent` helper, so the
open-coded `parse(x).slice(0, -1)` is the only way to express this today.

### Proposal

Keep the layout knowledge in one place: split the key→segments derivation
out of `toPath` so the shard directory and the full path are two views of
one value:

```ts
/** The sharded location of a content key: its directory and file name. */
const shard = (key: Vec): { readonly dir: string, readonly name: string } => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return { dir: join(prefix, a, b), name: c }
}

export const toPath = (key: Vec): string => {
    const { dir, name } = shard(key)
    return join(dir, name)
}
```

`publish` then uses `const { dir } = shard(hash)` and
`mkdir(join(path, dir), { recursive: true })` — no re-parse, no `slice`.
Alternative considered: a general `dirname` in `fs/path/module.f.ts`; the
`shard` form is preferred because the CAS write path should not know how a
shard path decomposes, and no second `dirname` consumer exists yet.

### Tasks

- [ ] Extract `shard` in `fs/cas/module.f.ts`; express `toPath` and
      `publish`'s `dstDir` through it.
- [ ] `npx tsc`, `fjs t`; existing CAS proofs pass unchanged.

### Related

- [write-closed-helpers.md](./write-closed-helpers.md) — hoists `publish`
  wholesale but keeps the inline `parse(rel).slice(0, -1)` verbatim; this
  issue removes it. Either order works.
