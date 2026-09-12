/**
 * @import { PackedRef } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { codePointListToString } from '../../text/utf16/module.f.mjs'
import { toHex } from '../oid/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { tryLoose, tryPacked, tryRef } from './module.f.mjs'

const loose = tryLoose(20)

const ref = tryRef(20)

const packed = tryPacked(20)

const loose32 = tryLoose(32)

/** The commit id of the repository the probes were run against. */
const a = /** @type {const} */ ('90247a675797a749501c0050b2bbf38648640d3c')

/** A tag id from the same repository, so the two are told apart. */
const t = /** @type {const} */ ('fa6c6573aa53038417005c2f4ba1cfbac703e314')

/** A 32-byte id, for the width a SHA-256 repository uses. */
const wide = /** @type {const} */ ('8031c3b5f0c291f374148e59909ea8a8f83538e9a412bac9b1f8072e6e6be27f')

/** @type {(s: string) => string} */
const hexOfLoose = s => {
    const id = loose(latin1(s))
    assert(id !== null, s)
    return codePointListToString(toHex(id))
}

/** @type {(e: PackedRef) => readonly [string, string, string]} */
const seen = e => [
    codePointListToString(e.name),
    codePointListToString(toHex(e.id)),
    e.peeled === null ? '' : codePointListToString(toHex(e.peeled)),
]

export const proof = {
    // A loose ref file, against `git rev-parse master` on Git 2.43.0 with
    // each of these written into `refs/heads/master`. The trailing LF Git
    // writes is optional, trailing SP, TAB and CR are skipped, and anything
    // after the first line is not read.
    loose: () => {
        for (const s of [`${a}\n`, a, `${a}\r\n`, `${a} \n`, `${a}\t\n`, `${a}\njunk\n`, `${a}\n${t}\n`]) {
            assertEq(hexOfLoose(s), a)
        }
        // An id in upper case resolves, as it does for Git: `rev-parse`
        // answers the lower-case id for an upper-case file.
        assertEq(hexOfLoose(`${a.toUpperCase()}\n`), a)
    },
    // What Git calls `ignoring broken ref`: whitespace before the id, an id
    // of the wrong length, and no id at all.
    looseRefused: () => {
        for (const s of [` ${a}\n`, `\t${a}\n`, `\n${a}\n`, a.slice(0, 39), `${a}0`, '', '\n', 'not hex at all\n']) {
            assertEq(loose(latin1(s)), null)
        }
    },
    // The width is the repository's, so the two never cross: a 20-byte id
    // is no ref in a SHA-256 repository and a 32-byte id is none in a
    // SHA-1 one.
    looseWidth: () => {
        assertEq(loose(latin1(`${wide}\n`)), null)
        assertEq(loose32(latin1(`${a}\n`)), null)
        assert(loose32(latin1(`${wide}\n`)) !== null)
    },
    // A symbolic ref. Measured with `git symbolic-ref HEAD` after writing
    // each into `.git/HEAD`: the whitespace after the keyword is free, the
    // trailing LF is optional, and trailing whitespace is not part of the
    // name.
    symbolic: () => {
        for (const s of [
            'ref: refs/heads/master\n', 'ref: refs/heads/master', 'ref:refs/heads/master\n',
            'ref:  refs/heads/master\n', 'ref: refs/heads/master \n', 'ref: refs/heads/master\r\n',
            'ref: refs/heads/master\t\n', 'ref:\trefs/heads/master\n',
        ]) {
            const r = ref(latin1(s))
            assert(r !== null && r.kind === 'symbolic', s)
            assertEq(codePointListToString(r.target), 'refs/heads/master')
        }
    },
    // A ref file holding an id is direct, which is a detached `HEAD`.
    direct: () => {
        const r = ref(latin1(`${a}\n`))
        assert(r !== null && r.kind === 'direct')
        assertEq(codePointListToString(toHex(r.id)), a)
    },
    // The target is a whole ref name, which is
    // `git check-ref-format --allow-onelevel`: the name rule plus a refusal
    // of `@` alone. The `refs/` prefix `HEAD` needs is not a rule about
    // names and is not applied here — `ref: a/b` in `.git/HEAD` stops Git
    // reading the directory as a repository, where the same target in
    // `refs/heads/sym` resolves.
    target: () => {
        // One level is enough, which is where I had this wrong: a symbolic
        // ref at `refs/heads/sym` pointing at any of these resolves on Git
        // 2.43.0, and `git check-ref-format --allow-onelevel` accepts each.
        for (const n of [
            'refs/x', 'refs/heads/master', 'refs/heads/@', 'refs/@/x', 'refs/a/b/c/d',
            'a/b', 'master', 'refs', 'a', 'HEAD', 'ORIG_HEAD', 'notrefs/a/b',
        ]) {
            const r = ref(latin1(`ref: ${n}\n`))
            assert(r !== null && r.kind === 'symbolic', n)
            assertEq(codePointListToString(r.target), n)
        }
        // `@` alone is the whole difference from a name below a prefix, and
        // the rest are what the name rule already refuses.
        for (const n of ['@', 'refs/', 'refs/a..b', 'refs/.x', 'refs/x.lock', 'a.lock', '..', 'refs//x']) {
            assertEq(ref(latin1(`ref: ${n}\n`)), null)
        }
    },
    // The keyword is case-sensitive: `REF:` leaves Git unable to read the
    // file as `HEAD` at all, so it is no ref here either.
    keyword: () => {
        for (const s of ['REF: refs/heads/master\n', 'Ref: refs/heads/master\n', 'ref refs/heads/master\n', ' ref: refs/heads/master\n', 'ref: \n', 'ref:\n']) {
            assertEq(ref(latin1(s)), null)
        }
    },
    // `packed-refs` as Git writes one: the header, a line per ref, and the
    // `^` line giving what the tag above it points at.
    packed: () => {
        const r = packed(latin1(`# pack-refs with: peeled fully-peeled sorted \n${a} refs/heads/master\n${t} refs/tags/v1\n^${a}\n`))
        assert(r !== null)
        assertStructurallySame(r.map(seen), [
            ['refs/heads/master', a, ''],
            ['refs/tags/v1', t, a],
        ])
    },
    // The header is optional and the order is not checked, both measured:
    // `git show-ref` reads a file with no header and an unsorted one, so
    // the header is a note about the writer and not a promise. The order
    // answered is the file's, since which ref shadows which is the
    // caller's question and not this reader's.
    packedShape: () => {
        assertStructurallySame(
            /** @type {readonly PackedRef[]} */ (packed(latin1(`${a} refs/heads/master\n${t} refs/tags/v1\n`))).map(seen),
            [['refs/heads/master', a, ''], ['refs/tags/v1', t, '']],
        )
        assertStructurallySame(
            /** @type {readonly PackedRef[]} */ (packed(latin1(`# pack-refs with: sorted \n${t} refs/tags/v1\n${a} refs/heads/master\n`))).map(seen),
            [['refs/tags/v1', t, ''], ['refs/heads/master', a, '']],
        )
        // A TAB separates as a SP does, which Git accepts.
        assertStructurallySame(
            /** @type {readonly PackedRef[]} */ (packed(latin1(`${a}\trefs/heads/master\n`))).map(seen),
            [['refs/heads/master', a, '']],
        )
        // A file of no bytes is a repository with nothing packed, not a
        // malformed one, and neither is the header alone.
        assertStructurallySame(packed(latin1('')), [])
        assertStructurallySame(packed(latin1('# pack-refs with: peeled\n')), [])
        // Whatever follows the colon is free, which is what makes the prefix
        // the rule rather than the whole line.
        for (const h of ['# pack-refs with:', '# pack-refs with: ', '# pack-refs with:x', '# pack-refs with: peeled fully-peeled sorted ']) {
            assertStructurallySame(
                /** @type {readonly PackedRef[]} */ (packed(latin1(`${h}\n${a} refs/heads/master\n`))).map(seen),
                [['refs/heads/master', a, '']],
            )
        }
    },
    // Every line ends in LF, including the last, which is where
    // `packed-refs` and a loose ref part: Git answers
    // `unterminated line in .git/packed-refs`. A `^` line needs a ref line
    // above it, a blank line and a comment below the first are
    // `unexpected line`, and exactly one whitespace byte separates the id
    // from the name — a second space joins the name and Git then calls it
    // `packed refname is dangerous`.
    packedRefused: () => {
        for (const s of [
            `${a} refs/heads/master`,
            `^${a}\n`,
            `${a} refs/heads/master\n# c\n`,
            `${a} refs/heads/master\n\n`,
            `${a}  refs/heads/master\n`,
            `${a}xrefs/heads/master\n`,
            `${a}refs/heads/master\n`,
            `${a} refs/heads/master\n^${a}`,
            `${a} @\n`,
            `${a.slice(0, 39)} refs/heads/master\n`,
            `${a} refs/heads/master\n^${a.slice(0, 39)}\n`,
            `# header with no LF`,
            // Not the header, so not a comment either: Git has no comment
            // syntax in this file. Each of these is `unexpected line`.
            `# hello\n${a} refs/heads/master\n`,
            `#\n${a} refs/heads/master\n`,
            `# pack-refs with\n${a} refs/heads/master\n`,
            `#pack-refs with:\n${a} refs/heads/master\n`,
            `#  pack-refs with:\n${a} refs/heads/master\n`,
            `# Pack-refs with:\n${a} refs/heads/master\n`,
            // The header is the first line or nothing, so a second one and a
            // header below a ref line are both refused.
            `# pack-refs with: peeled\n# pack-refs with: peeled\n${a} refs/heads/master\n`,
            `${a} refs/heads/master\n# pack-refs with: peeled\n`,
        ]) {
            assertEq(packed(latin1(s)), null)
        }
    },
    throw: {
        // A value that is no byte is a caller's bug, as it is for a ref
        // name, and the same `byteArray` refuses it.
        looseNotBytes: () => loose([256]),
        refNotBytes: () => ref([256]),
        packedNotBytes: () => packed(new Array(1)),
    },
}
