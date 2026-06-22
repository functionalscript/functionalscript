# 66N-cas-get-response-shape. Collapse `cas_get`'s three response-building arms into one helper

**Priority:** P3
**Status:** open

## Problem

The `cas_get` handler in `fs/cas/mcp/module.f.ts` decides the MIME type of a blob in
three phases — magic-byte sniff, UTF-8 validation, octet-stream fallback — and then,
in each phase, **rebuilds the same JSON response from scratch**:

```ts
// fs/cas/mcp/module.f.ts:152-201 (abridged)
const byteLength = Number(bitVecLength(value) / 8n)
// Phase 1: magic-byte sniffing
const detectedMime = detect(value)
if (detectedMime !== null) {
    const url = toUrl?.(key)
    const meta: Record<string, unknown> = {
        length: byteLength,
        mime_type: detectedMime,
        type: 'base64',
        ...(url !== undefined && { url })
    }
    if (r.content === true) {
        const blob = base64Encode(value)
        return pure(blob === null
            ? errorResult(`content is not byte-aligned: ${r.hash}`)
            : okResult(JSON.stringify({ ...meta, content: blob })))
    }
    return pure(okResult(JSON.stringify(meta)))
}
// Phase 2: UTF-8 validation
const str = fromVec(value)
const url = toUrl?.(key)
if (str !== null) {
    const meta: Record<string, unknown> = {
        length: byteLength,
        mime_type: 'text/plain',
        type: 'text',
        ...(url !== undefined && { url })
    }
    return pure(r.content === true
        ? okResult(JSON.stringify({ ...meta, content: str }))
        : okResult(JSON.stringify(meta)))
}
// Phase 3: octet-stream fallback
const meta: Record<string, unknown> = {
    length: byteLength,
    mime_type: 'application/octet-stream',
    type: 'base64',
    ...(url !== undefined && { url })
}
if (r.content === true) {
    const blob = base64Encode(value)
    return pure(blob === null
        ? errorResult(`content is not byte-aligned: ${r.hash}`)
        : okResult(JSON.stringify({ ...meta, content: blob })))
}
return pure(okResult(JSON.stringify(meta)))
```

Two distinct response-shaping concerns are copy-pasted across the three phases:

1. **The `meta` record** — `{ length, mime_type, type, ...(url && { url }) }` — is
   written out three times (`:157-162`, `:176-181`, `:187-192`), differing only in the
   `mime_type` and `type` fields.
2. **The "include content?" envelope** — *if `r.content !== true` emit `meta`, else
   encode the content and emit `{ ...meta, content }`, erroring when the encoder
   returns `null`* — is written three times (`:163-170`, `:182-185`, `:193-200`).
   Phases 1 and 3 are **byte-identical** except for the `mime_type` string: same
   `base64Encode(value)`, same `content is not byte-aligned` error, same branch shape.

`url` is also recomputed twice (`const url = toUrl?.(key)` at `:156` and again at
`:174`) when it does not depend on the phase at all.

This is the `AGENTS.md` case verbatim — *"When two code branches share most of their
structure, refactor so the shared part appears once and only the difference lives in
the conditional"* — applied across three branches whose only real differences are
(`mime_type`, `type`, *how the inline content string is produced*). The phase
selection (sniff → UTF-8 → fallback) is the genuinely varying logic; the response
construction wrapped around it is not.

## Proposal

Compute `url` once, then name the response-shaping concern in a single local helper
that takes only what actually varies between phases: the `mime_type`, the `type`
discriminant, and a thunk that produces the inline content string (or `null` when it
cannot be encoded). The helper owns the `meta` shape and the `content`-envelope
branching:

```ts
const byteLength = Number(bitVecLength(value) / 8n)
const url = toUrl?.(key)

// the one place the response shape lives
const respond = (
    mimeType: string,
    type: 'text' | 'base64',
    encode: () => string | null,
) => {
    const meta = {
        length: byteLength,
        mime_type: mimeType,
        type,
        ...(url !== undefined && { url }),
    }
    if (r.content !== true) { return pure(okResult(JSON.stringify(meta))) }
    const content = encode()
    return pure(content === null
        ? errorResult(`content is not byte-aligned: ${r.hash}`)
        : okResult(JSON.stringify({ ...meta, content })))
}

// the phases now read as just the classification decision:
const detectedMime = detect(value)
if (detectedMime !== null) {
    return respond(detectedMime, 'base64', () => base64Encode(value))
}
const str = fromVec(value)
if (str !== null) {
    return respond('text/plain', 'text', () => str)
}
return respond('application/octet-stream', 'base64', () => base64Encode(value))
```

The three `meta` literals collapse to one, the `content`-envelope branching is written
once, `url` is computed once, and the two base64 phases differ only in the `mime_type`
argument they pass. The `mime_type`/`type` pairing per phase stays visible at the call
site, so the classification logic is *more* readable, not hidden.

### Notes

- `respond` captures `value`, `key`/`r.hash`, `r.content`, `url`, `byteLength` and
  `pure`/`okResult`/`errorResult` from the enclosing closure — it is local to the
  handler body (it cannot be hoisted to module scope because it closes over per-call
  state), which matches the existing structure of this handler.
- The text phase passes `() => str` where `str` is already non-`null`, so its
  `content === null` arm is never taken *for that phase* — but the two base64 phases
  exercise both arms, so whole-function branch coverage in
  `fs/cas/mcp/proof.f.ts` is preserved. Confirm the proof still drives: a binary
  (sniffed) blob, a valid-UTF-8 blob, an octet-stream blob, each with and without
  `content: true`, plus a non-byte-aligned blob to hit the `null` error arm.
- The literal `meta` object is built from non-literal values (`byteLength`,
  `mimeType`, `type`), so it does not need `as const`; but the explicit `Record<string,
  unknown>` annotation in the current code can be dropped — let inference type `meta`,
  per the "prefer type inference" guidance.

## Tasks

- [ ] Hoist `url = toUrl?.(key)` above the phase checks and add the local `respond`
      helper in the `cas_get` handler of `fs/cas/mcp/module.f.ts`.
- [ ] Rewrite the three phases to call `respond(...)`, removing the duplicated `meta`
      literals and `content`-envelope branches.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/cas/mcp/proof.f.ts` passes with full
      line/branch coverage (the response is byte-identical for every case).

## Related

- The `cas_get` tool (text/base64 split, MIME metadata, get/add unification) was
  implemented in prior work. This issue is the internal-readability follow-up on the
  handler those changes left behind; it changes no behaviour or wire format.
