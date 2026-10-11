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

### Legacy drive-bar imports

Review [r4226074718](https://github.com/functionalscript/functionalscript/pull/2656#discussion_r4226074718)
identified the same URL/native-path boundary without an authority. The admitted
`/C|/dep.f.js` and `C|/dep.f.js` become `file:///C:/dep.f.js`, not a literal
`C|` directory. A subsequent `..` cannot remove that URL drive root. Decoding
first loses another distinction: with parent `file:///tmp/main.f.js`,
`/%43|/dep.f.js` instead names the literal POSIX `/C|/dep.f.js`.

Until URL-aware drive handling is implemented, imports with a raw path
component consisting of an ASCII letter and `|` are also refused with
`invalid module specifier`. Inspect every raw component before dot reduction
and percent-decoding so a marker cannot appear at the root or disappear during
reduction. This is deliberately conservative: nested and canceled raw marker
components are refused even when Node would treat them as ordinary names.
Literal entry paths are unchanged. Percent-encoded components such as `%43|`
and `C%7C` remain literal names; they must never be rewritten to drive colons.
The regression suite preserves those names and relative imports on POSIX.

The future implementation must distinguish raw drive markers from encoded
filename data, preserve a URL drive root across `..`, and account for the
parent URL's drive. Test single-slash and bare drive spellings, terminal
markers, dot-segment variants, and encoded lookalikes before relaxing the
refusal. See the [URL Standard's drive-letter definition](https://url.spec.whatwg.org/#windows-drive-letter)
and file/path parsing rules. No URL parser dependency is introduced here.

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
