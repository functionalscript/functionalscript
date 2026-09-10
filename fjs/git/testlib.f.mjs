/**
 * Fixtures shared by the proofs of the Git object readers: real objects,
 * captured once with `git cat-file` and checked in as bytes.
 *
 * @module
 */

/**
 * The bytes a Latin-1 string spells, one per code unit: how a fixture is
 * written, since every byte is a code unit below `0x100` and a byte above
 * `0x7F` is spelled `\xNN`.
 *
 * @type {(s: string) => readonly number[]}
 */
export const latin1 = s => [...s].map(c => c.codePointAt(0) ?? 0)

/**
 * The payload of commit `d2bc56a53b2d6d7c1dc0860dec10435ed479b22d` of this
 * repository, as `git cat-file commit` prints it: two parents, a
 * `gpgsig` header continued over sixteen lines, one of them empty, and a
 * message holding a UTF-8 em dash. The lines are joined by LF, and the
 * last one is empty because the message ends in LF.
 *
 * @type {readonly number[]}
 */
export const commitPayload = latin1([
    'tree c5711460da9d5ae7158a951d9d924385419b13ca',
    'parent 30317689cb0aaba4f927c1980d80e286c69dce85',
    'parent 261b9142dfe024d8e8e009b0e97f6e52ea981c8d',
    'author Sergey Shandar <sergey-shandar@users.noreply.github.com> 1789011254 +0000',
    'committer GitHub <noreply@github.com> 1789011254 +0000',
    'gpgsig -----BEGIN PGP SIGNATURE-----',
    ' ',
    ' wsFcBAABCAAQBQJqoiU2CRC1aQ7uu5UhlAAAjW8QAGUeJEnGDqCJwSG49goak9iK',
    ' hy+gQMR88zijFIt8RHcHwOcHfD1ESvyYfO14Uh2PWbYoTGS+nBURbP5JHu8ZdV46',
    ' +Hv6CezMjMK4iV+5dcihC+e0ppTaNIPi2YeVXuVS0ZJY71TISVbkM9v3c5zm7HLK',
    ' QFnryw+BdPAuCQfd2yyhGRR4wEN1KLxd0GnyslwC6cT895SYYbdZ3skUc3rQG072',
    ' RNPMjB63u2xcobQToXF7hbP43AJ5AyGkKgZwI2uOo9Q82TDscElCkP1vsrCQqlAn',
    ' tNT5mNaNB15x9GD5WHUPeDInlPmn118woG3wquhnyVPg9T67kD+PxsdJHohw3Zwg',
    ' 5XsedPXNS6rdaezIEb/bOD4ffFerlfSXKDtnJEA49lhV9MMADvlrF8PoUyj4WacC',
    ' NuCsV5mpeIMHfSB/ALe4OIg6TaSG6XmCOperG99ry30Srb0kNaJaIrVUyKxe1Lu8',
    ' I6tV/+TXn//1iXWlqBWOO+QMbFr4k/8Xm6+K5YEtaeFsjx+Wm7PMJaI829AsuEiM',
    ' 5YCau/t+9fCBvRhsKbmj54U2DJDjPRfg0BmXzq70UQXHoaelZyKzp9tYKHjpJCJ/',
    ' n5bCrIkFaXdR6jWW82rtmiqlV+pPAw+Yrh8O3CXQ3P4d9lo34u7sl1znAHCU6JUQ',
    ' SJhh2+ncYM0plGKdl/wS',
    ' =cLLb',
    ' -----END PGP SIGNATURE-----',
    ' ',
    '',
    'Add design document for Git object parsing (#1916)',
    '',
    '## Summary',
    '',
    'This PR adds a comprehensive design document for parsing Git objects as',
    'typed values. The document outlines the architecture for reading and',
    'decoding the four Git object types (blob, tree, commit, tag) using EBNF',
    'grammars with a byte-level alphabet.',
    '',
    '## Key Changes',
    '',
    '- **Design specification** for `fjs/ebnf/byte/` \xe2\x80\x94 a new byte alphabet',
    'adapter for the EBNF parser, including validation to prevent non-ASCII',
    'characters from being silently misinterpreted',
    '- **Object grammar specifications** for all four Git object types:',
    '  - Loose object envelope with type, size, and payload',
    '- Commit and tag header blocks with support for multi-line headers and',
    'unknown headers',
    '  - Tree entries with mode, name, and object ID',
    '  - Ident parsing as a secondary grammar layer',
    '- **Value type definitions** for representing parsed objects in code',
    '(Oid, Commit, Tag, TreeEntry, etc.)',
    '- **Scope boundaries** clearly defining what the grammar handles vs.',
    'what requires separate implementations:',
    '  - Zlib inflation (deferred to boundary adapter)',
    '  - SHA-1 hashing (separate issue)',
    '  - Packfile and `.idx` parsing (length-framed, requires decoder)',
    '  - Object writing/serialization (separate task)',
    '- **Detailed task breakdown** with 8 concrete work items for',
    'implementation and testing',
    '- **Rationale** for design decisions:',
    '- Why bytes (not Unicode) are the alphabet to preserve object integrity',
    '  - Why LL(1) grammars work for delimiter-framed structures',
    '- Why semantic validation happens post-parse rather than in the grammar',
    '',
    '## Notable Implementation Details',
    '',
    '- The parser is parameterized by object ID width (20 or 32 bytes) to',
    'support both SHA-1 and SHA-256 repositories',
    '- Headers are preserved verbatim (including unknown ones) to support',
    'round-trip serialization for signature verification',
    '- Ident parsing uses `try*` semantics to refuse malformed identities',
    'rather than repair them',
    '- The design leverages existing infrastructure: the LL(1) backend from',
    '`fjs/ebnf/ll1`, the `fjs/asn.1` precedent for length-framed structures,',
    'and the JSON parser as a reference implementation',
    '',
    'https://claude.ai/code/session_01EdU8wW4oihFS1gj4dUAcPS',
    '',].join('\n'))
