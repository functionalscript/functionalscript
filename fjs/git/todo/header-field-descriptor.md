## header-field-descriptor. Each commit and tag field is described two or three times

**Priority:** P4
**Status:** open

### Problem

[`fjs/git/header`](../header/module.f.mjs) reads a positional header
field through five combinators — `fieldAt`, `tryFieldAt`, `optionalAt`,
`checkedAt`, `checkedOptionalAt` — that differ only in how they report
failure: panic, `null`, or a `Result`. Every caller hands each of them
the same description of the field — its index, key, parser, missing
message, bad message — once per combinator it uses:

```js
// fjs/git/tag: object, tryObject, and validate
export const object = fieldAt(0, 'object', tryFromHex, 'no object', 'not an id')
export const tryObject = oidBytes => tryFieldAt(0, 'object', tryFromHexOf(oidBytes))
checkedAt(0, 'object', tryFromHexOf(oidBytes), 'no object', 'not an id'),
// fjs/git/commit: author and validate
export const author = c => fieldAt(1 + parentValues(c).length, 'author', readIdent, 'no author', 'not an author')(c)
checkedAt(1 + ps.length, 'author', readIdent, 'no author', 'not an author')(c),
```

`tree` is described three times, `type` three, `committer` twice,
`tagger` twice. The messages are the part most likely to be edited and
the part nothing keeps aligned.

`tryTreeAt` in `commit` and `tryTargetAt` in `tag` also open with the
same guard — `const size = byteLength(payload); if (size === null || size < least) { return null }`
— before `tryRead(payload)`.

### Proposal

What the copies share is the index, the key and the two messages. What
they do not share is the parser: the panicking accessor reads an id at
any width with `tryFromHex`, while `tryTree`, `tryObject` and both
`validate`s read it at the repository's width with
`tryFromHexOf(oidBytes)`, and that difference is deliberate. So the
descriptor holds the four shared facts, and each view takes its parser:

```ts
type Field = {
    readonly get: <T>(parse: (v: Bytes) => T | null) => (p: Payload) => T                   // fieldAt
    readonly tryGet: <T>(parse: (v: Bytes) => T | null) => (p: Payload) => T | null         // tryFieldAt
    readonly check: <T>(parse: (v: Bytes) => T | null) => (p: Payload) => Result<T, string> // checkedAt
}
export const field: (i: number, key: string, missing: string, bad: string) => Field
export const optionalField: …                                                             // optionalAt, checkedOptionalAt
```

`commit` and `tag` then describe each field once —
`const objectField = field(0, 'object', 'no object', 'not an id')` — and
derive `object = objectField.get(tryFromHex)`,
`tryObject = oidBytes => objectField.tryGet(tryFromHexOf(oidBytes))`,
and `objectField.check(tryFromHexOf(oidBytes))` in `validate`. The
width-agnostic accessor and the width-aware reads keep the parsers they
have; only the description stops being repeated. The two fields whose
index depends on the parent count take the index from the commit first.
A `tryReadAtLeast(least)` absorbs the shared size guard.

### Tasks

- [ ] `field`, `optionalField`, `tryReadAtLeast` in `header`, proved.
- [ ] `commit` and `tag` through them, each view keeping the parser it
      has today; the five combinators go, or stay as the descriptor's own
      views.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [positional-headers](./positional-headers.md) — where positional
  parsing stops; this is about what each position is described as.
