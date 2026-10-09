## Define the remaining native module path encoding support

**Priority:** P2
**Status:** open

### Lossless native paths

`FileModule` holds Unicode strings, not arbitrary OS filenames. A valid entry
symlink can resolve to a non-Unicode target: on Unix, `link.f.js` can target
`bad-<FF>/dep.f.js` while `bad-<U+FFFD>/dep.f.js` also exists. Lossy conversion
returns the second file's identity and can cause a subsequent read to load it.

The resolver now refuses non-Unicode absolute or canonical paths with
`InvalidData` and `non-UTF-8 module paths are not supported`. It never replaces
bytes or unpaired Windows UTF-16 code units with U+FFFD. A genuine U+FFFD name
remains valid. The absolute-path conversion also checks cwd-derived components.

Supporting arbitrary native filenames would require a lossless representation
through resolution, identity, and later file operations; do not remove the
refusal by restoring lossy conversion. Decide that API separately.

### Raw URL preprocessing

The [WHATWG URL parser](https://url.spec.whatwg.org/#concept-basic-url-parser)
trims leading/trailing C0 controls and spaces, and removes tab, LF, and CR
throughout an input. Consequently `./dep ` names `dep`, not `dep `, and
`./a<TAB>b` names `ab`, not the literal tab-containing filename.

Until the resolver implements that preprocessing in the correct order, imports
whose raw spelling would change are refused with `invalid module specifier`
through the existing IoError channel. This check precedes authority and legacy
drive handling, dot reduction, percent decoding, and filesystem access. The
portable admission helper is unchanged: this is an explicit native limitation,
not a claim that the Node runner also rejects these inputs.

Percent escapes (`%20`, `%09`, `%0A`, `%0D`, `%01`) remain filename data; entry
paths remain literal. Internal spaces and non-ASCII whitespace are not trimmed.
A future implementation must apply portable admission and URL preprocessing
in the Node runner's order, including inputs where preprocessing reveals an
authority or drive marker. Coordinate with [local URL authorities](./local-file-url-authorities.md).

Tests cover colliding POSIX names, Linux UTF-8 symlinks to invalid targets,
Unix invalid bytes and Windows unpaired UTF-16 conversion, C0/space boundaries, and
escaped versus raw imports. Native Windows/macOS execution belongs in CI;
standalone Node/Linux reference experiments do not replace those checks.

The invalid-byte filesystem fixture is Linux-only: [APFS accepts only valid
UTF-8 filenames](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/APFS_Guide/FAQ/FAQ.html).
The strict conversion test itself needs no filesystem and runs on macOS too.

A separate Node v22.16.0/Linux observation: `pathToFileURL` of a literal entry
ending in U+0001 drops that final control, whereas `new URL("dep%01", parent)`
retains it as filename data. This update preserves the existing native literal
entry behavior; it does not claim parity with that old Node entry conversion.
Verify entry-path controls against the pinned Node runner in the follow-up.
