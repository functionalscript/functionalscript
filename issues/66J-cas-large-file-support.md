# 66J-cas-large-file-support. Support files larger than 131 KB in CAS

**Priority:** P3
**Status:** open

## Problem

CAS currently has a hard limit of 131 KB per file. This prevents storing larger files such as:
- Binary artifacts (compiled executables, archives)
- High-resolution images
- Video thumbnails
- Large datasets or JSON exports
- Generated code files

The 131 KB limit is likely tied to an internal bit-vector or memory constraint. For agents that need to archive or deduplicate content, this artificial ceiling is restrictive.

## Proposal

Investigate the source of the 131 KB limit and remove or increase it to support practical file sizes. Consider:

1. **Root cause analysis**: Where does the 131 KB limit originate? (bit-vector alignment, memory layout, buffer sizing?)
2. **Removal vs. increase**: Can it be removed entirely, or does it protect a real constraint?
3. **Streaming support**: For very large files (GBs), consider streaming/chunked ingestion instead of single-buffer storage.
4. **Documentation**: Update `fs/cas/README.md` with the new limit or note that it is unbounded (within available disk).

## Tasks

- [ ] Locate the 131 KB constant in the codebase
- [ ] Document why the limit exists
- [ ] Assess feasibility of removal or raising the limit
- [ ] Update `cas_add` and `cas_get` to handle larger content
- [ ] Add tests for multi-MB files
- [ ] Update `fs/cas/README.md` with new limits

## Related

- [i66J-cas-add-path-restriction](./66J-cas-add-path-restriction.md) — related CAS security and API work
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — CAS server implementation
