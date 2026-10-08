## Support local file-URL authorities in module imports

**Priority:** P2
**Status:** open

### Problem

`resolve_file_module` currently refuses every import specifier beginning with
`//`, returning an `IoError` with no code and `invalid module specifier` as its
message. This is an explicit native limitation, not full Node-profile parity.
It applies only to imports with a parent, not literal entry paths.

The portable admission helper accepts spellings such as
`///tmp/project/dep.f.js` and `//localhost/tmp/project/dep.f.js`. On POSIX,
Node's `new URL(name, parent)` and `fileURLToPath` resolve both to the local
`/tmp/project/dep.f.js`. Four leading slashes retain a second path slash;
canonicalization can still reach the same local file. The native resolver
currently rejects these valid local spellings.

### Decision in PR #2656

Defer support rather than grow a partial URL parser in this review round.
The raw `//` prefix is refused before path dot reduction. An authority must
never be canceled as though it were a directory: `//host/../../Cargo.toml`
still names host `host` in Node, but the old path-only decoder erased the host
and could redirect this input to a local file. A cross-platform regression
keeps that failure explicit, including encoded dot segments.

### Follow-up

Distinguish an empty authority and Node's accepted `localhost` authority from
non-local hosts before reducing path segments. Cover case and percent-encoded
localhost spellings, empty paths, repeated slashes, dot segments, and parent
file URLs carrying an authority. Keep the [UNC identity task](./unc-module-identities.md)
separate: accepting local authorities does not implement network shares.

Check native Windows semantics rather than assuming POSIX paths: with parent
`file:///C:/src/main.f.js`, `/dep.f.js` retains drive C, but `///dep.f.js`
and `//localhost/dep.f.js` have no drive and `fileURLToPath` refuses them with
`ERR_INVALID_FILE_URL_PATH`. The admitted legacy spelling `///C|/dep.f.js`
is another distinct case: Node normalizes its drive marker to `C:`.

Evidence: standalone Node v22.16.0 on Linux, using `new URL`, `fileURLToPath`,
and its explicit `windows` option. This is lexical Windows evidence only, not
native Windows filesystem execution. Test real-file identity and relative
imports on POSIX and native Windows before replacing the refusal.
