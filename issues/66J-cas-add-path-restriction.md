# 66J-cas-add-path-restriction. Restrict `cas_add` URL paths to approved directory

**Priority:** P2
**Status:** open

## Problem

`cas_add` accepts the `type: 'url'` parameter to read files from any filesystem path and store them in CAS. This is a security risk: an MCP client (or misconfigured agent) can exfiltrate any readable file from the system.

```ts
case 'url':
    x = readFile(content).step(([t, v]) => pure(t === 'error'
        ? `cannot read file: ${content}: ${v}`
        : v))
    break
```

An attacker could call `cas_add({ type: 'url', content: '/etc/passwd' })` to extract sensitive system files.

## Proposal

Restrict `cas_add` to only read from an approved staging directory. Two approaches:

### Option A: Restricted directory for `cas_add`
Modify `cas_add` to enforce that file paths must be within `~/cas_upload/`. Paths outside this directory are rejected with a clear error.

### Option B: Separate upload-all command
Keep `cas_add` URL support but add a new command (e.g., `cas_upload_dir`) that automatically ingests all files from `~/cas_upload/` into CAS, without accepting arbitrary paths.

### Directory naming
Proposed name: `cas_upload`
- Clear purpose: "upload to CAS"
- Mirrors common patterns: `Downloads`, `Uploads`, `Desktop`
- Alternatives: `cas_staging`, `cas_inbox`, `cas_sources`

## Tasks

- [ ] Decide between Option A and Option B
- [ ] Implement path validation or new command
- [ ] Add JSDoc note to `casAddArgs` explaining the restriction
- [ ] Add integration tests for path boundary enforcement
- [ ] Document the `~/cas_upload/` requirement in `fs/cas/mcp/README.md`

## Related

- [i66H-cas-mcp-unified-get-add](./66H-cas-mcp-unified-get-add.md) — broader CAS MCP design
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — CAS server implementation
