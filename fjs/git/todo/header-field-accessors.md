## header-field-accessors. One skeleton for the positional field accessors

**Priority:** P4
**Status:** open

### Problem

`Commit` and `Tag` are the same type — both `types.ts` files alias
`header/types.ts`'s `Payload` — and their accessors are the same four
statements with the key, the index, the parser, and the panic message
changed. The panicking form appears five times:

- `tree` (`fjs/git/commit/module.f.mjs:79-85`)
- `identAt` (`fjs/git/commit/module.f.mjs:191-197`)
- `object` (`fjs/git/tag/module.f.mjs:167-173`)
- `type` (`fjs/git/tag/module.f.mjs:200-206`)
- `tagger` via the same shape in `fjs/git/tag/module.f.mjs`

each is `valueAt` → `assertNotNullish` → parse → `assert`:

```js
// commit/module.f.mjs:79-85            // tag/module.f.mjs:167-173
export const tree = c => {              export const object = t => {
    const value = valueAt(c, 0, 'tree')     const value = valueAt(t, 0, 'object')
    assertNotNullish(value, 'no tree')      assertNotNullish(value, 'no object')
    const id = tryFromHex(value)            const id = tryFromHex(value)
    assert(id !== null, ['not a tree id', value])
                                            assert(id !== null, ['not an id', value])
    return id                               return id
}                                       }
```

The total (`Nullable`) form repeats the same way — `tryTree`
(`commit:97-103`), `tryObject` (`tag:184-190`), `tryType` (`tag:217-220`)
are `valueAt` → null-propagate → parse. And both `validate`s open with the
same chain a third way, as `valueAt` / null-error / parse-error pairs
(`commit/module.f.mjs:294-305`, `tag/module.f.mjs:325-336`).

None of these functions holds per-object logic: only the index, the key,
the parser, and the message differ. A change to how a positional field is
read — which [positional-headers.md](./positional-headers.md)'s stopping
rule will force — has to be repeated in roughly nine places today.

### Proposal

`fjs/git/header` already owns "read a field by position out of a
`Payload`" (`valueAt`, `valuesOf`). Put the three skeletons beside it:

```ts
/** The parsed field at `i` under `key`. @throws where absent or unparsable. */
const fieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>, what: string)
    => (p: Payload) => T
/** The parsed field, or `null` where absent or unparsable. */
const tryFieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>)
    => (p: Payload) => Nullable<T>
```

plus a `Result`-returning variant for the `validate` chains. `tree`,
`identAt`, `object`, `type`, `tagger` each become one line naming the
index, the key, and the parser; `tryTree`/`tryObject`/`tryType` likewise.
Commit-specific logic (`parentValues`, the parent-offset arithmetic in
`author`/`committer`) stays in `commit`, as it should.

### Tasks

- [ ] Add `fieldAt`/`tryFieldAt` (and a checked variant for `validate`)
      to `fjs/git/header/module.f.mjs` with proofs.
- [ ] Rewrite the commit and tag accessors through them; panic messages
      unchanged.
- [ ] `tsc`, `fjs test`; existing commit/tag proofs pass unchanged.

### Related

- [positional-headers.md](./positional-headers.md) — will change how the
  positional pass reads lines; with the accessors deduplicated that change
  lands in one place instead of nine.
