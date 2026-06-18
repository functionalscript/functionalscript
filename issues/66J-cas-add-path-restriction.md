# 66J-cas-add-path-restriction. Restrict `cas_add` URL paths to approved directory

**Priority:** P1
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

Restrict `cas_add` with `type: 'url'` to only read from `~/cas_upload/`. 

**Implementation**: Add a path validation check that rejects any path not starting with `~/cas_upload/`. On validation failure, return an `isError` result with a clear message:
```
"cas_add type:url paths must be within ~/cas_upload/ — got: /etc/passwd"
```

This is the simplest fix and blocks the security hole immediately.

## Tasks

- [ ] Implement path validation check in `cas_add` (line 109 in `fs/cas/mcp/module.f.ts`)
- [ ] Add JSDoc note to `casAddArgs` explaining the restriction
- [ ] Add test cases for valid paths (`~/cas_upload/*`) and rejected paths (`/etc/*`, `~/*`)
- [ ] Document the `~/cas_upload/` requirement in `fs/cas/mcp/README.md`

## Related

- [i66H-cas-mcp-unified-get-add](./66H-cas-mcp-unified-get-add.md) — broader CAS MCP design
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — CAS server implementation
