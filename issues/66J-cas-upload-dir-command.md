# 66J-cas-upload-dir-command. Add `cas_upload_dir` command for batch uploads

**Priority:** P4
**Status:** open

## Problem

After large-file support is implemented, users will want a convenient way to upload multiple files from `~/cas_upload/` in batch without calling `cas_add` individually for each file.

## Proposal

Add a new MCP tool `cas_upload_dir` that:

1. Scans `~/cas_upload/` for all files
2. Processes each file through the streaming upload pipeline (stage → hash → finalize)
3. Returns a summary: count of uploaded files, total bytes, any errors

Usage:
```
cas_upload_dir({}) → {uploaded: 42, total_bytes: 1234567, errors: []}
```

## Tasks

- [ ] Implement `cas_upload_dir` tool in `fs/cas/mcp/module.f.ts`
- [ ] Reuse staging and recovery logic from large-file support
- [ ] Return structured summary (uploaded count, bytes, error list)
- [ ] Add tests for empty directory, mixed file types, permission errors
- [ ] Document in `fs/cas/mcp/README.md`

## Related

- [i66J-cas-large-file-support](./66J-cas-large-file-support.md) — streaming upload infrastructure
- [i66J-cas-periodic-stage-recovery](./66J-cas-periodic-stage-recovery.md) — recovery mechanism
