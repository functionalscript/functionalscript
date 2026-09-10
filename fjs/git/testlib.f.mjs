/**
 * Fixtures shared by the proofs of the Git object readers: real objects,
 * captured once with `git cat-file` and checked in as bytes.
 *
 * @module
 *
 * @import { Bytes } from './types.ts'
 */

/**
 * The bytes a Latin-1 string spells, one per code unit: how a fixture is
 * written, since every byte is a code unit below `0x100` and a byte above
 * `0x7F` is spelled `\xNN`.
 *
 * @type {(s: string) => readonly number[]}
 */
export const latin1 = s => [...s].map(c => c.charCodeAt(0))

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

/**
 * A sparse array, as it arrives from outside the type system: two
 * positions, the first a hole. Typed as the bytes it claims to be, so a
 * reader or a writer meets it as a caller would hand it over, and must
 * refuse it.
 *
 * @type {Bytes}
 */
export const hole = /** @type {Bytes} */ (/** @type {unknown} */ ([, 0x61]))

/**
 * The root tree of commit `303eb262`, the merge of #1926, as `git cat-file
 * tree` prints it: 27 entries — subtrees, files, and one executable — each
 * spelled as its mode, SP, name and NUL as text, then its 20-byte id as
 * `\xNN` escapes. Its own id is `b007dac9ff840a9f5f9eaa68747d0c91b44c556b`.
 *
 * @type {readonly number[]}
 */
export const rootTree = latin1([
    '40000 .cargo\0'+'\x51\x79\x05\x04\x01\x4d\xe6\x0f\x79\x54\x62\xec\x09\x95\xfd\x82\xd6\xca\xad\x56',
    '100644 .gitattributes\0'+'\xc8\xcf\x31\x62\xbe\x5c\xb6\x82\x37\x75\xf2\x69\xd0\xe7\xc8\x6a\xf2\x17\x86\xa8',
    '40000 .github\0'+'\xd9\x67\xdc\x12\x7c\xcc\x94\xb3\x61\xb0\x36\xa0\x81\x20\xb0\xb7\x06\xb6\x34\xe2',
    '100644 .gitignore\0'+'\xc5\x99\xb0\x89\xf1\x3f\x54\xc6\x96\x8f\x99\x91\xa8\x34\xef\x6d\xa4\x26\xe2\x3f',
    '100644 .node-version\0'+'\xa4\x5f\xd5\x2c\xc5\x89\x15\x70\xd6\x29\x9f\xab\x38\x64\x31\x03\xc3\x95\x54\x74',
    '100644 AGENTS.md\0'+'\x8e\xaa\xc0\xb9\x62\xb2\x8b\x2b\x55\x59\x6d\xe9\xb4\x1c\x67\x8c\x58\xf8\x58\xc5',
    '100644 CONTRIBUTING.md\0'+'\xa4\x81\xe1\x0e\x1c\xe5\x37\x9c\xc4\x59\x7b\x92\x7c\x2f\x60\x5e\xdb\xa7\x3e\x12',
    '100644 Cargo.lock\0'+'\xab\x92\x7a\x90\xc3\xf0\xcd\xcd\xf3\x76\x45\x10\x22\x60\x5f\x86\x67\x1b\x60\xcf',
    '100644 Cargo.toml\0'+'\x5f\x65\xef\x5b\x91\x16\xfd\xa9\xae\xb6\x1b\xa6\x84\x97\x86\x4b\x20\x1f\x1c\xa8',
    '100644 LICENSE\0'+'\xa3\x1d\x3d\x03\xf0\xd4\x9b\x1a\x3c\xa3\xeb\xe7\x25\x74\xb3\x23\x24\x63\xfc\x80',
    '100644 README.md\0'+'\x83\xe1\x62\x38\xcd\x3a\x84\x15\x93\xb9\x0a\xae\xf2\x7f\x68\x3b\x7f\x56\x5b\xcf',
    '100644 bun.lock\0'+'\x4c\x34\xf0\x8f\x23\x69\x85\xc5\x1c\x7e\xf9\xce\x01\x58\xc1\xea\x6d\x56\xa1\xf0',
    '40000 changelog\0'+'\xef\xd0\x7a\xbf\x49\x7c\xea\x86\x2b\xec\x45\xbd\xd2\xa6\x43\xf8\xa6\xcb\xb4\xb4',
    '100644 deno.json\0'+'\x94\x40\xdd\xfc\xb1\xea\x96\x29\x69\x5f\x26\xac\xfc\xd4\xd9\x7c\x56\x77\xda\xd2',
    '100644 deno.lock\0'+'\x46\x96\x85\xf8\xf3\xe1\xbc\x08\xc1\xea\xb3\xb4\xb8\x10\xc2\x52\x0b\xb4\x17\x39',
    '100755 dev.sh\0'+'\x70\x8d\x16\x60\xc3\xd4\x11\xcf\x99\xab\x30\xa3\x0e\xb3\xfd\x3a\x90\x46\xc9\xa5',
    '40000 doc\0'+'\xfb\xa4\x74\x56\x9e\x62\x4f\x4f\xd2\xcb\x94\xa0\x77\x39\xa4\x95\xc6\x70\x59\xa5',
    '40000 fjs\0'+'\x04\x86\x50\x51\xfa\x3d\x15\x8b\x70\x0d\xd5\x3c\x10\x0b\xd6\x17\x40\x8d\x2f\x16',
    '100644 funding.json\0'+'\xe6\x90\x01\x53\xed\x07\x00\xfe\x60\x64\x9a\xc1\x6b\x79\x54\x49\x69\x44\x72\xe6',
    '40000 nanvm-lib\0'+'\x76\x62\x4b\x55\x87\x21\xb7\x7c\x4b\x60\x7b\xa7\x02\xa0\xe8\xb0\x10\x72\xf8\x47',
    '40000 nix\0'+'\x72\x58\x52\x92\x8d\xa9\x50\xe8\x34\xf9\xf1\xbd\x30\x66\xfc\xa8\xdd\x23\xa4\xf8',
    '100644 package-lock.json\0'+'\x38\xdd\x60\x4b\xf5\xba\xfb\x58\x71\xa2\x36\x63\xac\xa0\xcf\x96\xa2\x7d\xea\xe1',
    '100644 package.json\0'+'\x3b\xeb\x66\x7c\x10\x97\xcc\xd8\xaa\x91\x0d\xa8\x44\xda\x86\x57\x9c\x79\xda\x54',
    '40000 spec\0'+'\xea\x16\x54\xc2\x1b\xe4\x97\xde\xeb\x95\x63\x88\x7a\x47\x9b\xaf\x62\xed\x32\xeb',
    '40000 todo\0'+'\x77\xeb\x12\x42\x0f\x44\x54\x1b\x2c\x0c\x46\x6f\x71\xb1\x52\xec\xe5\x16\x21\x43',
    '100644 tsconfig.json\0'+'\x96\x7c\x99\xa5\x70\xc2\x9c\x68\x5f\x04\xbc\xe0\xc1\x16\xa1\xad\x9c\xd1\x6c\xaf',
    '100644 wrangler.jsonc\0'+'\xdf\x22\x8e\x28\x92\x18\x9a\x75\x03\xba\xbf\xdc\x4b\x65\x49\xbe\xe8\x75\x65\x2d',
].join(''))

/**
 * A signed tag, as `git cat-file tag` prints it: written by Git 2.43 in a
 * scratch repository to a commit `9fed2759`, with an SSH signature, which
 * Git puts in the message, from the line that begins its armor to the end.
 * Its own id is `b79a8e25df6a75ef83c047b329e730d92ad59dec`, over 432
 * bytes. The lines are joined by LF, and the last one is empty because
 * the message ends in LF.
 *
 * @type {readonly number[]}
 */
export const tagPayload = latin1([
    'object 9fed27590671460cacf76884f17cd2a4b17f7220',
    'type commit',
    'tag v2',
    'tagger Proof <proof@example.com> 1700000000 +0100',
    '',
    'Version two, signed',
    '-----BEGIN SSH SIGNATURE-----',
    'U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgrLzsfFISF4by8Q+FKz27YpkK1USsBB+m',
    'amu1QkJnbDsAAAADZ2l0AAAAAAAAAAZzaGE1MTIAAABTAAAAC3NzaC1lZDI1NTE5AAAAQLLP2Pwo',
    '7fTLqYbtbFsRGZ3ELHNIT5kjEj6FSogSns1sIp24JULk3FywiQc7vbzccgscl62ImMYfbjKtTYQ4',
    '+AQ=',
    '-----END SSH SIGNATURE-----',
    '',].join('\n'))
