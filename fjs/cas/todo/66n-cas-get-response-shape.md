## 66N-cas-get-response-shape. Dedup `cas_get`'s verdict→`Meta` mapping and buffered-refine arms

**Priority:** P4
**Status:** open

> **Refreshed 2026-07:** the original issue described a three-phase
> (sniff / UTF-8 / octet-stream) handler that rebuilt the response record from
> scratch in each phase. That code no longer exists — the handler was rewritten
> around `detectStream`/`detectDialect` and the MCP resource field names
> (`mimeType`/`uri`/`text`/`blob`). The duplication that *remains* in the
> current handler is smaller and different; this refresh describes it.

### Problem

The `cas_get` handler in `fjs/cas/mcp/module.f.ts` builds a `Meta` record from
a `fjs/media/type` detector verdict (`{ length, mime_type, type }`) plus `uri`
in two places:

```ts
// streaming verdict (:218-219)
const { length, mime_type: mimeType, type } = detected
const meta: Meta = { length: Number(length), mimeType, type, uri }

// dialect-refined verdict (:252-253)
const refined = detectDialect(value)
const refinedMeta: Meta = { length: Number(refined.length), mimeType: refined.mime_type, type: refined.type, uri }
```

Both perform the identical verdict→wire renaming (`mime_type → mimeType`,
`Number(length)`, carry `type`, attach `uri`). In addition, the
"buffer the whole blob, then re-run `detectDialect(value)`" step is written
twice — `collectRead(c.read(key)).step(([tag, value]) => { … detectDialect(value) … })`
at `:227-234` (metadata-only refinement) and `:244-268` (inline content) —
differing only in the error fallback and what is done with the refined
verdict.

### Proposal

A closed module-scope adapter naming the verdict→wire mapping once, with the
per-request `uri` lifted into a leading curried parameter (per the AGENTS.md
hoisting rule — don't keep a named helper nested just because it captures a
local):

```ts
/** Maps a `fjs/media/type` detector verdict to the `cas_get` wire `Meta` record. */
const toMeta = (uri: string) =>
    (d: { readonly length: bigint, readonly mime_type: string, readonly type: 'text' | 'base64' }): Meta =>
    ({ length: Number(d.length), mimeType: d.mime_type, type: d.type, uri })
```

The handler applies it once where `uri` is bound — `const meta =
toMeta(uri)` — then `meta(detected)` and `meta(refined)`. Optionally
fold the shared "buffer then `detectDialect`" prefix of the two `collectRead`
arms into one small step that yields the refined verdict (or the error), so
only the two genuinely different tail actions remain at the call sites.

### Tasks

- [ ] Add the module-scope curried `toMeta`; apply `toMeta(uri)` once in the
      `cas_get` handler and route both `Meta` constructions through it.
- [ ] Evaluate folding the two `collectRead` + `detectDialect` arms into a
      shared refine step; apply if it stays readable.
- [ ] `npx tsc`, `fjs t`; `fjs/cas/mcp/proof.f.ts` passes with full coverage
      and byte-identical responses.

### Related

- [../mcp/todo/cas-get-mcp-resource-response.md](../mcp/todo/cas-get-mcp-resource-response.md)
  — the wire-field naming this handler now implements; this issue is the
  internal-dedup follow-up, no wire change.
