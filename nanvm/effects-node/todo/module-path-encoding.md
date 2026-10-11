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
paths remain literal except for the terminal-control refusal below. Internal
spaces and non-ASCII whitespace are not trimmed.
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

### Terminal controls in entry paths

Node v22.16.0/Linux `pathToFileURL` drops terminal C0 controls other than NUL,
tab, LF and CR, which it escapes first. NUL remains invalid for filesystem IO. For example, both `dep<U+0001>` and
`dep<U+0001>/.` select `dep`. When both files exist, accepting the literal
control-character entry would silently select a different module.

The native resolver now refuses affected entry paths after absolute lexical
normalization and before metadata/canonicalization. It returns an IoError with
no code and `entry paths with terminal C0 controls are not supported`. Checking
the normalized path also covers terminal controls exposed by `.` or `..`.
This is an explicit restriction, not an implementation of Node's conversion.

Do not apply the broader import-preprocessing filter to entries: leading and
trailing spaces, tab/LF/CR, and internal controls remain literal native path
data. Percent-encoded imports such as `dep%01` can still select the actual
control-character filename. An entry named `dep%01` names those literal percent
characters; entry paths are never percent-decoded.

Pure tests distinguish all C0 characters and encoded spellings on every target,
including WASM. A Unix fixture covers colliding files, normalized spellings,
the missing-lookalike case, escaped imports, and preserved entry characters.
The reference observations were reproduced on Node v22.16.0/Linux; full entry
conversion and canonical-identity parity across the pinned Node versions still
belong in the follow-up. Native Windows/macOS validation remains a CI check.
