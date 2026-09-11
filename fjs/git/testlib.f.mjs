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

/**
 * A tag whose bytes end at its last header's LF, with no empty line after
 * it and no message: written by Git 2.43 with `git hash-object -t tag`,
 * over the empty blob, and followed by `<id>^{}` to that blob. Its own id
 * is `37502c250f7a8db81069481feee882f61ddf9ff0`, over 115 bytes. None of
 * Git's own writers makes one — `commit-tree` and `mktag` always write the
 * empty line — so one comes from a hand-made object or another tool, and
 * it is the object that tells the two spellings of an empty message apart.
 *
 * There is no trailing empty element here, because the payload ends at the
 * LF the join puts before one.
 *
 * @type {readonly number[]}
 */
export const headerOnlyTagPayload = latin1([
    'object e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
    'type blob',
    'tag v3',
    'tagger Proof <proof@example.com> 1700000000 +0100',
    '',].join('\n'))

/**
 * A merge of a signed tag, as `git cat-file commit` prints it: written by
 * Git 2.43 in the same scratch repository as {@link tagPayload}, with the
 * tag it merged carried whole in a `mergetag` header, one of its
 * continuation lines empty, and the commit's own SSH signature in
 * `gpgsig`. Its id is `9880b6949363a320bb2a534e6de86d72d2206a14`, over
 * 1354 bytes. The lines are joined by LF, and the last one is empty
 * because the message ends in LF.
 *
 * @type {readonly number[]}
 */
export const mergePayload = latin1([
    'tree 3a3e4ab4cfbdacbc05f5721ad4aa7877a8004de4',
    'parent 6f9b6538ae436d8f14a748463c8d2d348d5ed134',
    'parent c7571226b6d0c9fe865510e72c935f157425a651',
    'author Proof <proof@example.com> 1700000200 +0100',
    'committer Proof <proof@example.com> 1700000200 +0100',
    'mergetag object c7571226b6d0c9fe865510e72c935f157425a651',
    ' type commit',
    ' tag vt',
    ' tagger Proof <proof@example.com> 1700000100 +0100',
    ' ',
    ' Topic tag',
    ' -----BEGIN SSH SIGNATURE-----',
    ' U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgrLzsfFISF4by8Q+FKz27YpkK1USsBB+m',
    ' amu1QkJnbDsAAAADZ2l0AAAAAAAAAAZzaGE1MTIAAABTAAAAC3NzaC1lZDI1NTE5AAAAQEuKvuyn',
    ' 58HE2hZtPeJlmZmDOBqs1eIBIflKZ3g3/A0DUSmnv3VihiiIkcTkhcWrrtkxwfT++0eVHwpAtevU',
    ' SQc=',
    ' -----END SSH SIGNATURE-----',
    'gpgsig -----BEGIN SSH SIGNATURE-----',
    ' U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgrLzsfFISF4by8Q+FKz27YpkK1USsBB+m',
    ' amu1QkJnbDsAAAADZ2l0AAAAAAAAAAZzaGE1MTIAAABTAAAAC3NzaC1lZDI1NTE5AAAAQOkgfUZ0',
    ' PYhR8NUO38KbMwUG6hmeXlshRAhlMR8uXXcck2TAgQ4vyj0xeLm47mHwTm0GBA0ukY2+AQEZrm9m',
    ' UAw=',
    ' -----END SSH SIGNATURE-----',
    '',
    'Merge tag \'vt\'',
    '',
    'Topic tag',
    '',
    '# -----BEGIN SSH SIGNATURE-----',
    '# U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgrLzsfFISF4by8Q+FKz27YpkK1USsBB+m',
    '# amu1QkJnbDsAAAADZ2l0AAAAAAAAAAZzaGE1MTIAAABTAAAAC3NzaC1lZDI1NTE5AAAAQEuKvuyn',
    '# 58HE2hZtPeJlmZmDOBqs1eIBIflKZ3g3/A0DUSmnv3VihiiIkcTkhcWrrtkxwfT++0eVHwpAtevU',
    '# SQc=',
    '# -----END SSH SIGNATURE-----',
    '# gpg verification failed.',
    '',].join('\n'))

/**
 * The loose object file of {@link tagPayload}, `.git/objects/b7/9a8e25…`
 * as Git wrote it: one zlib stream, 341 bytes, holding the envelope
 * `tag 432 NUL` and the payload, as `\xNN` escapes.
 *
 * @type {readonly number[]}
 */
export const tagLoose = latin1([
    '\x78\x01\x6d\x50\x4d\x73\x82\x30\x14\xec\x39\xbf\x22\x77\xdb\x4e\x12\x90\xe8\x4c',
    '\xdb\xa9\x0a\x68\x14\x18\x11\xb0\xa3\x37\x88\xc0\xc8\x87\xa1\x86\x6a\xe5\xd7\x97',
    '\xd4\x1e\xbb\x33\x6f\x76\xdf\xce\x7b\x7b\xd8\x36\xce\xa1\xae\x91\x07\x91\x14\x29',
    '\x6f\xe1\x38\x4b\x0f\x84\x0e\xc7\xc8\xa0\x58\x37\x10\x8f\x79\x46\x8d\xd1\x48\xcf',
    '\x30\xe5\x07\x12\xeb\x09\xa6\x19\x25\x04\x81\xf6\xd6\xa4\x90\x8b\xba\x3e\xb6\xa0',
    '\xed\x33\x2e\x44\x51\x9e\x9e\xe1\xfa\x2c\x44\x06\x5f\x1a\x45\xef\xe9\x77\x5c\x37',
    '\x55\xfa\xdc\x5f\xbe\x41\x4c\xd1\x1f\xe0\x00\x61\x84\x00\xd8\xa6\x67\x79\x14\x27',
    '\xd8\x5e\xc5\x23\x94\xc7\xfc\x94\x1e\xc0\x93\xc2\xd4\x9a\x33\x0f\x06\xc1\x02\x06',
    '\x6c\xee\x4d\xc2\x68\x63\xfd\xfa\x20\xc2\x1e\x8b\x50\xb5\x98\x28\xf8\xfd\x98\xae',
    '\x52\x0e\xd7\x3c\xe1\x7c\x6c\x4b\xb7\x88\xb0\x1b\x96\xca\xcb\xcf\x4e\x27\x33\x9b',
    '\x05\xb6\x9e\xdc\x46\xfe\xc0\x5e\x75\x84\xee\x9a\x72\x85\xa3\x40\x4e\xa7\x83\x1a',
    '\xc4\xf5\x17\xf6\xcb\xe5\x29\x31\xa5\x7a\x30\xf7\xa4\x42\x4a\xdc\xb1\xef\xe2\xb9',
    '\xd5\x87\xb1\x7e\x9d\x86\xca\x9b\x69\x5e\x17\xcf\x70\xb5\x37\x19\xf6\x42\x6b\xa8',
    '\x3c\xdf\x71\xd6\x64\x7d\x15\x80\x66\xa1\xf3\xb9\x4b\xda\xc4\x96\x9b\xf9\x5e\xb3',
    '\x9c\x85\xc7\xc2\x61\x59\x58\x85\x61\x07\x22\x0f\x4e\x12\x4b\xd6\x10\x7d\x19\x39',
    '\xa5\x66\xdf\xae\x47\x9f\xd3\x4b\xd2\x71\x9e\x4b\x5e\x19\x84\xd5\xee\x2e\x4b\x8a',
    '\x55\x1b\xee\x7c\x1d\x0c\x26\xfe\xeb\xbd\x09\xcb\x33\xff\xeb\xe1\x07\x68\xd6\x82',
    '\x8d',
].join(''))

/**
 * A tree with every mode Git writes, as `git cat-file tree` prints it:
 * written by Git 2.43 in the scratch repository, seven entries in Git's
 * order — two files, a subtree, a symbolic link, an executable, a
 * submodule (a `160000` entry naming a commit) and a file — spelled as
 * the mode, SP, name and NUL as text, then the 20-byte id as `\xNN`
 * escapes. Its own id is `5c1f5cdc3637a09fa100a2055ed273b7d91f3d80`,
 * over 226 bytes.
 *
 * @type {readonly number[]}
 */
export const modesTree = latin1([
    '100644 a.txt\x00\xce\x016%\x03\x0b\xa8\xdb\xa9\x06\xf7V\x96\x7f\x9e\x9c\xa3\x94FJ',
    '100644 b.txt\x00\xefI\xdd\x86\xa6\x95xu\xed\xcd\x0b\xff!\x037\xd6\xb6\xdd\x06<',
    '40000 dir\x00I\x97\xcazB\xe3\xad\x9br\x9f\xba\xd3\xac\xd4O\xba\xbd\x07\xb6\xbd',
    '120000 link\x00\x8d\x14\xcb\xf9\x83\xb3\xfa\xd6\x83\x17\x1c\x94\x18\x99\x8d\x9fh4\x08#',
    '100755 run.sh\x00\xf5\xbd\xd2\x14\xe0\x16\x03\xec\xd6\xc8;\xe9\xf6m\x88W\x9cX\x8e\xc6',
    '160000 sub\x00\x9f\xed\x27Y\x06qF\x0c\xac\xf7h\x84\xf1|\xd2\xa4\xb1\x7fr ',
    '100644 t.txt\x00\x0fb\xd6~v\xce\x12U\xa0\x98\x94$\x95\xa8F\xdf\x0f\x8a,\x11',
].join(''))

/**
 * The root commit of a repository Git 2.43 initialised with
 * `--object-format=sha256`, as `git cat-file commit` prints it: a `tree`
 * header naming a 32-byte id in 64 hex digits. Its own id is
 * `8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f`,
 * over 181 bytes. The lines are joined by LF, and the last one is empty
 * because the message ends in LF.
 *
 * @type {readonly number[]}
 */
export const sha256Commit = latin1([
    'tree 2f1e8b790adef60b1b58a9fe37ff415972da0e5abd333e171a4f999484eb42b0',
    'author Proof <proof@example.com> 1700000300 +0100',
    'committer Proof <proof@example.com> 1700000300 +0100',
    '',
    'sha256',
    '',].join('\n'))

/**
 * The tree of {@link sha256Commit}, as `git cat-file tree` prints it: two
 * entries, a file and a subtree, each id 32 raw bytes as `\xNN` escapes.
 * Its own id is
 * `2f1e8b790adef60b1b58a9fe37ff415972da0e5abd333e171a4f999484eb42b0`,
 * over 85 bytes.
 *
 * @type {readonly number[]}
 */
export const sha256Tree = latin1([
    '100644 a.txt\x00\xf8b^C\xf9\xe0O$)\x1fw\xcd\xbeLq\xb3\xc2\xa3\xb0\x00?`A\x9b>\xd0j\x05\x8dvl\x8b',
    '40000 d\x00\x15\x9bZoi\x96W\xe1\x84i\x15n@\xe1\xb9/\xca\x0c\xd5]0\x91\xcbNc\x07\x05\xc7\xfe\x7fr\x99',
].join(''))
