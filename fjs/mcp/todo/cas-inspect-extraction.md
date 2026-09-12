## cas-inspect-extraction. `cas_get`'s blob policy lives in the tool registry

**Priority:** P4
**Status:** open

### Problem

Every other tool entry in this subtree is a name, a description, a schema
and one line of dispatch (`evo/module.f.mjs:116-158`; `cas_list` in this
same file). `cas_get`'s handler (`cas/module.f.mjs:227-301`) is ~75 lines
holding the whole blob-inspection policy — the streaming-vs-buffered
decision, the `maxLengthBytes` cap and its message, when a dialect
refinement is worth a second read, the `text`→`fromVec` /
`base64`→`base64Encode` split — none of which is MCP-specific. The module
doc has grown to match: 45 lines of blob-classification prose in a file
whose stated job is "maps `Cas<O>` operations onto MCP tools".

Inside the handler, the "materialize then re-classify" half is written
twice — the metadata path (`:249-259`) and the inline-content path
(`:269-281`) both read

```js
return resultStep(
    collectRead(c.read(key)),
    ([collectTag, value]) => {
        if (collectTag === 'error') { … }        // the one real difference:
        const refined = detectDialect(value)     // fallback vs error
        …
```

and the `no such hash` message is spelled at `:238` and `:273`.

Because the policy is welded to the MCP entry, the same verdict cannot be
reached from the CLI or a future `resources/read` handler without a
second copy — exactly what
[cas-get-mcp-resource-response.md](./cas-get-mcp-resource-response.md)
anticipates when it says the resource view must produce the same verdict.

### Proposal

Extract an inspection function next to the store (e.g. `casInspect` in
`fjs/cas`), returning a typed record — `{ length, mimeType, type, uri }`
plus optional `text`/`blob` — with a tagged error union
(`absent` / `tooLarge(length)`). The shared "read the whole blob and
re-derive the verdict with `detectDialect`" step becomes one private
helper used by both paths, with the caller deciding whether a failed
second read is a fallback or an error (the only real difference between
the two copies). `cas_get` then collapses to a `toolResultStep(…)`
one-liner matching `evo`'s shape, and the result-shaping function — not
the registry — owns the `no such hash` / `too large` wording.

### Tasks

- [ ] Extract the inspection effect and its shared re-read helper.
- [ ] Collapse `cas_get` to registry shape; wording unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [cas-get-mcp-resource-response.md](./cas-get-mcp-resource-response.md)
  — gets a single place to re-shape once the policy is a value.
- [casmcpserver-share-cas.md](./casmcpserver-share-cas.md) — the
  constructor seam; independent of the handler body.
