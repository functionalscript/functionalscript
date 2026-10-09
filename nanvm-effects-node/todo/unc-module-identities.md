## Support UNC module identities on Windows

**Priority:** P2
**Status:** open

### Problem

`resolve_file_module` supports local drive paths on Windows, not UNC shares.
For example, `\\server\share\src\main.f.js` canonicalizes to
`\\?\UNC\server\share\src\main.f.js`. The original resolver retained that
namespace and could produce the incorrect identity
`file:////%3F/UNC/server/share/src/main.f.js`.

Stripping the namespace alone is not a fix: `path_to_file_url` must encode the
server as the URL authority, `file_url_to_path` must accept that authority on
Windows, and relative resolution must retain it.

Until that behavior is implemented, Windows UNC/device entry paths and UNC
canonicalization results are refused explicitly, rather than returned with a
plausible wrong identity. A `file://server/...` parent is also still refused.
This is an intentional native limitation, not claimed parity with Node.

### Follow-up

- Implement the round trip from ordinary and extended-length UNC paths to
  `file://server/share/...` identities and back, retaining native Windows paths.
- Verify relative and rooted imports, escaping, and host normalization against
  the repository's pinned Node runner, including Unicode/IDNA host names.
- Add lexical tests that run on every platform and integration tests on a real
  Windows share. Keep ordinary drive-path tests and POSIX behavior intact.
- Decide and document which other Windows namespace paths are supported;
  do not reinterpret unsupported device paths as ordinary module identities.

Reported in PR #2656, discussion_r4212249001. The native separator assertion
failure is separate and is fixed without changing returned path separators.
