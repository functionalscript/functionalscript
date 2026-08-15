## casupload-dead. `casUpload` has no consumer and `casAddFile`'s doc describes a removed path

**Priority:** P4
**Status:** open

### Problem

`casUpload` (`fjs/cas/module.f.mjs:343-350`) is exported but has no caller
outside its own proofs (`fjs/cas/proof.f.mjs:420-441`). It is the residue of
the MCP `type: 'url'` upload flow that was deliberately removed for
symlink-escape reasons (`fjs/mcp/README.md`, `changelog/0.32.2.md`); it still
hard-codes the now-unreachable `~/cas_upload/` location and builds its own
`fileCas(sha256)(home)`.

The stale claim sits on the function next door
(`fjs/cas/module.f.mjs:321-324`):

```js
/**
 * Streams the file at `path` through `cas.write`, returning the content hash.
 * Both the CLI `cas add` and the MCP `add` delegate to this; the MCP layer
 * additionally deletes the source file on success.
 */
export const casAddFile = ...
```

Neither half of the second sentence is true anymore: the MCP `cas_add`
handler (`fjs/mcp/cas/module.f.mjs:188-210`) accepts inline content, never
calls `casAddFile`, and deletes nothing. The only caller is the CLI
(`fjs/cas/cli/module.f.mjs:30`).

### Proposal

- Delete `casUpload` and its two proofs (`casUploadSuccess`,
  `casUploadFailureKeepsSource`). If the upload flow ever returns it should be
  redesigned against the current MCP architecture, not resurrected from this
  remnant.
- Rewrite `casAddFile`'s doc to name its single CLI consumer.

### Tasks

- [ ] Remove `casUpload` + proofs; fix `casAddFile`'s JSDoc.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/cas/todo/66k-cas-cli-mcp-shared-core.md` — the current thinking on
  what CLI/MCP actually share; this issue removes a stale third path.
