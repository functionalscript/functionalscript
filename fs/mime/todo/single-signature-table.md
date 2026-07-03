## single-signature-table. Declare the magic-byte signatures once

**Priority:** P3
**Status:** open

### Problem

Every recognized signature (PNG, JPEG, 2×GIF, PDF, 3×ZIP, WebP) is declared
twice in `fs/mime/module.f.ts`, in two representations that must stay in
byte-for-byte lockstep:

- sentinel-`Vec` form for the pure path — `table` at `:56-69` plus the
  WebP special case `riff`/`webp`/`isWebp` at `:73-79`, consumed by
  `detect` (`:88-94`);
- byte-pattern form for the streaming path — `signatures` at `:119-132`
  (WebP's gap expressed as `null` wildcards), consumed by
  `magicStep`/`detectVec`/`detectStream`.

The comment at `:116` admits it: *"The streaming counterpart of
`table`/`isWebp`: the same signatures expressed as byte patterns…"*. Adding
or correcting a signature means editing both lists, and WebP is
special-cased in both (a bespoke `isWebp` here, a wildcard run there).

Note the consumer situation: `detectStream` is the only export with a real
consumer (`fs/cas/mcp/module.f.ts:88`); `detect` and `detectVec` are
exercised only by `fs/mime/proof.f.ts`.

### Proposal

Make `signatures` (the wildcard-capable byte-pattern list) the single source
of truth — it is strictly more general than `table` + `isWebp` since it
already expresses WebP's gap. Re-express `detect` through the streaming
eliminator that already exists:

```ts
export const detect = (bytes: Vec): Nullable<string> => {
    const fold = (m: MagicState) => { /* fold u8List(msb)(bytes) through magicStep */ }
    return magicMime(...)
}
```

i.e. `detect(bytes) = magicMime(fold(magicStep, magicInit, bytes))`, then
delete `table`, `sig`-based literals, `riff`, `webp`, and `isWebp`.
`detectVec` already proves the streaming machine reproduces `detect`'s
verdict on whole buffers, so the pure-`Vec` scaffolding is redundant.

Alternatively, if `detect`'s `startsWith`-based implementation is worth
keeping for performance, derive `table` from `signatures` (fold a
wildcard-free pattern into a `fromSentinel` bigint) so the byte values still
appear once — but the fold-through-`magicStep` variant is smaller and needs
no new helper.

Keep the doc-comment signature table (`:20-27`) as the human-readable
overview; it is documentation, not a third implementation.

### Tasks

- [ ] Rewrite `detect` on top of `magicStep`/`magicMime` (or derive `table`
      from `signatures`); delete the duplicate declarations.
- [ ] Confirm `detect`'s "too short to match" behavior is preserved (a
      `scan`-state machine at EOF yields `null`, matching today's prefix
      semantics).
- [ ] `npx tsc`, `fjs t`; `fs/mime/proof.f.ts` must pass unchanged.

### Related

- `fs/mime/module.f.ts:116` — the comment acknowledging the duplication.
- `fs/cas/mcp/module.f.ts:88` — the sole external consumer
  (`detectStream`).
