## header-field-accessors. One skeleton for the positional field accessors

**Priority:** P4
**Status:** open

### Problem

`Commit` and `Tag` are the same type — both `types.ts` files alias
`header/types.ts`'s `Payload` — and their accessors are the same few
statements with the key, the index, the parser, and the panic message
changed. Three shapes recur:

**Panicking** — `valueAt` → `assertNotNullish` → parse → `assert`, four
times: `tree` (`fjs/git/commit/module.f.mjs:79-85`), `identAt`
(`commit:191-197`), `object` (`fjs/git/tag/module.f.mjs:97-103`), `type`
(`tag:130-136`):

```js
// commit/module.f.mjs:79-85            // tag/module.f.mjs:97-103
export const tree = c => {              export const object = t => {
    const value = valueAt(c, 0, 'tree')     const value = valueAt(t, 0, 'object')
    assertNotNullish(value, 'no tree')      assertNotNullish(value, 'no object')
    const id = tryFromHex(value)            const id = tryFromHex(value)
    assert(id !== null, ['not a tree id', value])
                                            assert(id !== null, ['not an id', value])
    return id                               return id
}                                       }
```

**Total** — `valueAt` → null-propagate → parse, three times: `tryTree`
(`commit:97-103`), `tryObject` (`tag:114-120`), `tryType` (`tag:147-150`).

**Optional but strict** — `null` where the header is absent, a panic where
it is present and unparsable, once: `tagger` (`tag:228-234`), since very
old tags have no `tagger` header but a malformed one is still refused.
This is a distinct third shape, not the first or second: neither of those
can express "absent is fine, invalid is not".

Both `validate`s open with the same chain a fourth way, as `valueAt` /
null-error / parse-error pairs (`commit:294-305`, `tag:252-265`).

None of these functions holds per-object logic: only the index, the key,
the parser, and the message differ. A change to how a positional field is
read — which [positional-headers.md](./positional-headers.md)'s stopping
rule will force — has to be repeated in roughly ten places today.

### Proposal

`fjs/git/header` already owns "read a field by position out of a
`Payload`" (`valueAt`, `valuesOf`). Put the three skeletons beside it,
one per shape:

```ts
/** The parsed field at `i` under `key`. @throws where absent or unparsable. */
const fieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>, what: string)
    => (p: Payload) => T
/** The parsed field, or `null` where absent or unparsable. */
const tryFieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>)
    => (p: Payload) => Nullable<T>
/** The parsed field, `null` where absent. @throws where present and unparsable. */
const optionalAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>, what: string)
    => (p: Payload) => Nullable<T>
```

plus a `Result`-returning variant for the `validate` chains. `tree`,
`identAt`, `object`, `type` become `fieldAt`; `tryTree`/`tryObject`/
`tryType` become `tryFieldAt`; `tagger` becomes `optionalAt`, keeping its
absent-versus-invalid distinction exactly. Commit-specific logic
(`parentValues`, the parent-offset arithmetic in `author`/`committer`)
stays in `commit`, as it should.

### Tasks

- [ ] Add `fieldAt`/`tryFieldAt`/`optionalAt` (and a checked variant for
      `validate`) to `fjs/git/header/module.f.mjs` with proofs — including
      `optionalAt`'s two outcomes pinned separately.
- [ ] Rewrite the commit and tag accessors through them; panic messages
      unchanged; `tagger` on a three-header tag still `null`.
- [ ] `tsc`, `fjs test`; existing commit/tag proofs pass unchanged.

### Related

- [positional-headers.md](./positional-headers.md) — will change how the
  positional pass reads lines; with the accessors deduplicated that change
  lands in one place instead of ten.
