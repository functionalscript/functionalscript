## header-field-accessors. One skeleton for the positional field accessors

**Priority:** P4
**Status:** open

### Problem

`Commit` and `Tag` are the same type — both `types.ts` files alias
`header/types.ts`'s `Payload` — and their accessors are the same few
statements with the key, the index, the parser, and the panic message
changed. Three shapes recur:

**Panicking** — `valueAt` → `assertNotNullish` → parse → `assert`, in
`commit`'s `tree` and `identAt` and `tag`'s `object` and `type`:

```js
// commit/module.f.mjs                  // tag/module.f.mjs
export const tree = c => {              export const object = t => {
    const value = valueAt(c, 0, 'tree')     const value = valueAt(t, 0, 'object')
    assertNotNullish(value, 'no tree')      assertNotNullish(value, 'no object')
    const id = tryFromHex(value)            const id = tryFromHex(value)
    assert(id !== null, ['not a tree id', value])
                                            assert(id !== null, ['not an id', value])
    return id                               return id
}                                       }
```

**Total** — `valueAt` → null-propagate → parse, in `commit`'s `tryTree`
and `tag`'s `tryObject` and `tryType`.

**Optional but strict** — `null` where the header is absent, a panic where
it is present and unparsable, in `tag`'s `tagger` alone, since very
old tags have no `tagger` header but a malformed one is still refused.
This is a distinct third shape, not the first or second: neither of those
can express "absent is fine, invalid is not".

Both `validate`s open with the same chain a fourth way, as `valueAt` /
null-error / parse-error pairs.

None of these functions holds per-object logic: only the index, the key,
the parser, and the message differ. A change to how a positional field is
read — which [positional-headers.md](./positional-headers.md)'s stopping
rule will force — has to be repeated in about a dozen places today.

### Proposal

`fjs/git/header` already owns "read a field by position out of a
`Payload`" (`valueAt`, `valuesOf`). Put the three skeletons beside it,
one per shape:

```ts
/**
 * The parsed field at `i` under `key`.
 * @throws `missing` where the header is absent; `[bad, value]` where it is present and unparsable.
 */
const fieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>, missing: string, bad: string)
    => (p: Payload) => T
/** The parsed field, or `null` where absent or unparsable. */
const tryFieldAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>)
    => (p: Payload) => Nullable<T>
/** The parsed field, `null` where absent. @throws `[bad, value]` where present and unparsable. */
const optionalAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>, bad: string)
    => (p: Payload) => Nullable<T>
```

The two panic messages are two parameters because today's accessors
choose them independently — `tag.object` panics `'no object'` when
absent but `['not an id', value]` when malformed, `tag.type` `'no type'`
and `['unknown type', value]` — and no derivation from one string yields
every pair. The malformed message always carries the offending `value`
beside `bad`, as every existing `assert` does. `optionalAt` needs only
`bad`, since absence is its `null`. So `tree` is
`fieldAt(0, 'tree', tryFromHex, 'no tree', 'not a tree id')` and every
panic message is exactly what it is now.

and, for the `validate` chains, the `Result`-returning mirror of each
panicking shape, exported under the same roof:

```ts
/** The parsed field, or the message for whichever of the two ways it is not there. */
const checkedAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>,
    missing: string, bad: string) => (p: Payload) => Result<T, string>
/** The parsed field, `ok(null)` where absent, `error(bad)` where present and unparsable. */
const checkedOptionalAt: <T>(i: number, key: string, parse: (v: Bytes) => Nullable<T>,
    bad: string) => (p: Payload) => Result<Nullable<T>, string>
```

so `commit`'s `valueAt(c, 0, 'tree')` / `error('no tree')` /
`error('not a tree id')` triple is `checkedAt(0, 'tree', id, 'no tree',
'not a tree id')`, and each `validate` becomes a short chain of
`checkedAt` applications joined on `Result` — the messages stay the
strings `fsck`'s vocabulary already uses, supplied at the call site, so
neither module keeps a private copy of the pattern. `tag`'s `tagger`
step is the one exception, and `checkedOptionalAt` is its shape:
today's `validate` answers `ok` on a tag with no `tagger` and
`error('not a tagger')` on one whose `tagger` is no ident — the tag
proof's `old` case pins the first — which `checkedAt` cannot say, since
absence is its error. `checkedAt` mirrors `fieldAt` and
`checkedOptionalAt` mirrors `optionalAt`, so every accessor shape has a
`validate` step and no branch of either chain stays open-coded. `tree`, `identAt`,
`object`, `type` become `fieldAt`; `tryTree`/`tryObject`/`tryType` become
`tryFieldAt`; `tagger` becomes `optionalAt`, keeping its
absent-versus-invalid distinction exactly. Commit-specific logic
(`parentValues`, the parent-offset arithmetic in `author`/`committer`)
stays in `commit`, as it should.

### Tasks

- [ ] Add `fieldAt`/`tryFieldAt`/`optionalAt`/`checkedAt`/
      `checkedOptionalAt` to `fjs/git/header/module.f.mjs` with proofs —
      `optionalAt`'s two outcomes, `checkedAt`'s two messages, and
      `checkedOptionalAt`'s `ok(null)` pinned separately.
- [ ] Rewrite the commit and tag accessors through them; panic messages
      unchanged; `tagger` on a three-header tag still `null`, and
      `validate` on it still `ok`.
- [ ] `tsc`, `fjs test`; existing commit/tag proofs pass unchanged.

### Related

- [positional-headers.md](./positional-headers.md) — will change how the
  positional pass reads lines; with the accessors deduplicated that change
  lands in one place instead of a dozen.
