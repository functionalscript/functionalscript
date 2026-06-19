# 66J-cas-readfile-size-limit. Handle large files in CAS read

**Priority:** P2
**Status:** open
**Blocked by:** —

## Problem

Currently, when CAS tries to read a file larger than `readFile`'s size limit:
1. `fileKeyValue` read throws an exception
2. This crashes the MCP server or CLI process
3. The temporary fix in the current branch makes CAS get return `not found` for huge files, which is incorrect

This is a critical issue for reliability and correctness.

## Proposal

1. **readFile should return `'toobig'` error**: Instead of returning a generic error when a file exceeds the size limit, `readFile` should return a special `'toobig'` error variant. This allows callers to handle size-limited reads gracefully.

2. **CAS read should handle the toobig error**:
   - When `readFile` returns `'toobig'`, `cas_get` should:
     - Get the file size without reading content
     - Return file metadata:
       - `size`: actual file size
       - `type`: `'base64'` (unknown binary format)
       - `mime_type`: `'application/octet-stream'`
   - This allows MCP clients to know the file exists, its size, and that it's too large to fetch inline.

3. **Update error handling**:
   - MCP should report the file metadata without crashing
   - CLI should provide a helpful error message indicating the file size and suggesting alternative access methods

## Tasks

- [ ] Add `'too big'` error variant to fileKeyValue read result type
- [ ] Update CAS read to catch size errors from fileKeyValue read
- [ ] Return file metadata (size, type, mime_type) when file is too large
- [ ] Update MCP tool handler to format response correctly
- [ ] Add test cases for files at and above the size limit
- [ ] Document the size limit in CAS README

## Related

- Current branch: docker-mcp (temporary fix in place)
- File: `fs/cas/mcp/module.f.ts` (cas_get implementation)
