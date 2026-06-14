# 66E-cas-mcp-base64-content. Change CAS MCP to use base64 for file content

**Priority:** P2
**Status:** blocked
**Blocked by:** [i66E-base64](./66E-base64.md)

## Problem

`fs/cas/mcp/module.f.ts` currently encodes both hashes and file content as
cBase32. While cBase32 is the right choice for hashes (it is the CAS key
format across CLI and MCP), it is a project-specific encoding unknown to
external tools, LLMs, and the broader MCP ecosystem.

Base64 is the de-facto standard for binary content in text protocols: it is
what MCP clients and LLMs expect when a tool returns opaque binary data. Using
cBase32 for content means every consumer must know our encoding, which is an
unnecessary coupling. Hashes remain cBase32 — that is their canonical identity
and does not change.

This was flagged as an open question in [i66E-mcp-cas-server](./66E-mcp-cas-server.md):
> **Content encoding.** cBase32 (proposed, consistent with hashes) vs. base64
> (MCP-idiomatic for binary) … Start cBase32; revisit if a blob content type lands.

This issue is that revisit: switch content to base64 now.

## Proposal

In `fs/cas/mcp/module.f.ts`:

- `cas_add`: accept `content` as a base64 string; decode with
  `fs/base64` `decode` before writing to the store.
- `cas_get`: encode the retrieved `Vec` with `fs/base64` `encode` before
  returning it as the `text` result.
- Hashes (`cas_add` result, `cas_get` argument, `cas_list` output) stay
  cBase32 — no change.

Update `fs/cas/mcp/README.md` to document the split: **hashes = cBase32,
content = base64**.

## Tasks

- [ ] Replace cBase32 content encode/decode in `fs/cas/mcp/module.f.ts` with
      `fs/base64` `encode` / `decode`
- [ ] Update `fs/cas/mcp/proof.f.ts`: change test fixtures from cBase32 to
      base64-encoded content strings; keep hash assertions as cBase32
- [ ] Update `fs/cas/mcp/README.md` to document the hashes/content encoding split

## Related

- [i66E-base64](./66E-base64.md) — base64 codec this issue depends on
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original CAS MCP design;
  content encoding was left as an open question there
- `fs/cbase32/module.f.ts` — hash encoding; unchanged by this issue
