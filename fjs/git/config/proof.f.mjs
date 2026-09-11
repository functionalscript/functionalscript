/**
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { tryEntries, tryOidBytes } from './module.f.mjs'

/** What `git init` writes, on Git 2.43 and a case-insensitive filesystem. */
const initial = /** @type {readonly string[]} */ ([
    '[core]',
    '\trepositoryformatversion = 0',
    '\tfilemode = true',
    '\tbare = false',
    '\tlogallrefupdates = true',
    '\tignorecase = true',
    '\tprecomposeunicode = true',
])

/** What `git init --object-format=sha256` writes. */
const sha256 = /** @type {readonly string[]} */ ([
    '[core]',
    '\trepositoryformatversion = 1',
    '\tfilemode = true',
    '\tbare = false',
    '\tlogallrefupdates = true',
    '[extensions]',
    '\tobjectformat = sha256',
])

/**
 * A file setting one key of `[extensions]` under a version.
 *
 * @type {(version: number | string, key: string, value: string) => string}
 */
const extension = (version, key, value) =>
    `[core]\n\trepositoryformatversion = ${version}\n[extensions]\n\t${key} = ${value}`

/**
 * The one value a file of one `[core]` key holds.
 *
 * @type {(text: string) => Nullable<string>}
 */
const value = text => {
    const entries = tryEntries(`[core]\n\tx = ${text}`)
    return entries === null ? null : entries[0][2]
}

export const proof = {
    // Every entry, in order, with its section: a tab before the key, the
    // section lowercased, the value as text.
    entries: () => {
        assertStructurallySame(tryEntries(initial.join('\n')), [
            ['core', 'repositoryformatversion', '0'],
            ['core', 'filemode', 'true'],
            ['core', 'bare', 'false'],
            ['core', 'logallrefupdates', 'true'],
            ['core', 'ignorecase', 'true'],
            ['core', 'precomposeunicode', 'true'],
        ])
    },
    // The shapes Git's own writers and users leave in a file: a subsection
    // kept as written, a comment after a value and a comment line by either
    // mark, a key without a value, upper case in a section and a key, blank
    // lines, and a key before any section.
    shapes: () => {
        const text = [
            'orphan = 1',
            '',
            '# a comment',
            '; another',
            '[Remote "Origin"]',
            '  url = https://example.com/a.git ; the origin',
            '  fetch=+refs/heads/*:refs/remotes/origin/*',
            '[Core]',
            '\tBare',
            '\tempty =',
        ].join('\n')
        assertStructurallySame(tryEntries(text), [
            ['', 'orphan', '1'],
            ['remote.Origin', 'url', 'https://example.com/a.git'],
            ['remote.Origin', 'fetch', '+refs/heads/*:refs/remotes/origin/*'],
            ['core', 'bare', 'true'],
            ['core', 'empty', ''],
        ])
        assertStructurallySame(tryEntries(''), [])
        // A `#` before a `;`, and a `;` before a `#`: the first one begins
        // the comment.
        assertStructurallySame(tryEntries('a = 1 # x ; y\nb = 2 ; x # y'), [['', 'a', '1'], ['', 'b', '2']])
        // A `\r` before a line's end is the half of a Windows line ending
        // Git drops; one anywhere else is whitespace of the value.
        assertStructurallySame(tryEntries('[core]\r\n\tx = 1\r\n'), [['core', 'x', '1']])
        assertEq(value('a\rb'), 'a b')
        // A byte-order mark at the beginning is skipped, as Git skips it,
        // and only at the beginning: a second is the character it is, which
        // begins no line Git reads.
        assertStructurallySame(tryEntries('\uFEFF[core]\n\tx = 1'), [['core', 'x', '1']])
        assertEq(tryEntries('\uFEFF\uFEFF[core]\n\tx = 1'), null)
        assertEq(value('a\uFEFFb'), 'a\uFEFFb')
    },
    // Git has its own `isspace` over C's, holding a space, a tab, a newline
    // and a `\r` and no more.
    whitespace: () => {
        // A `\r` begins a line, a header and a subsection as any whitespace
        // does.
        assertStructurallySame(tryEntries('\ra = 1'), [['', 'a', '1']])
        assertStructurallySame(tryEntries('\r[core]\nx = 1'), [['core', 'x', '1']])
        assertStructurallySame(tryEntries('[core]\rx = 1'), [['core', 'x', '1']])
        assertStructurallySame(tryEntries('[core]\n\r\tx = 1'), [['core', 'x', '1']])
        assertStructurallySame(tryEntries('[core\r"a"]\nx = 1'), [['core.a', 'x', '1']])
        // Between a key and its `=` it does not: that one loop of Git's asks
        // for a space or a tab by name.
        assertEq(tryEntries('[core]\nx\r= 1'), null)
        // A `\v` and a `\f` are no whitespace at all, so they begin no
        // line and stand in a value as the characters they are.
        assertEq(tryEntries('\v[core]\nx = 1'), null)
        assertEq(tryEntries('[core]\vx = 1'), null)
        assertEq(tryEntries('[core\v"a"]\nx = 1'), null)
        assertEq(tryEntries('[core]\nx\v= 1'), null)
        assertEq(value('a\vb'), 'a\vb')
        assertEq(value('a\fb'), 'a\fb')
    },
    // A value as Git's own parser reads it, a character at a time.
    values: () => {
        // Quotes quote: a comment mark inside them is a character of the
        // value, the whitespace inside them is the value's, and a value may
        // be quoted in part.
        assertEq(value('"a#b;c"'), 'a#b;c')
        assertEq(value('" a "'), ' a ')
        assertEq(value('a" "b'), 'a b')
        assertEq(value('";"'), ';')
        assertEq(value('""'), '')
        // Whitespace around a value is dropped, and a run the value keeps
        // is written as spaces, one for one.
        assertEq(value('   a \t b   '), 'a   b')
        // What a `\` escapes, and nothing else is an escape.
        assertEq(value('"a\\nb"'), 'a\nb')
        assertEq(value('"a\\tb"'), 'a\tb')
        assertEq(value('"a\\bb"'), 'a\bb')
        assertEq(value('"a\\\\b"'), 'a\\b')
        assertEq(value('"a\\"b"'), 'a"b')
        assertEq(value('"a\\qb"'), null)
        // A comment ends the value, and what follows it is read no further.
        assertEq(value('1 # "\\q'), '1')
        // A quote that never closes, and a `\` at a line's end, which
        // continues the value for Git and is refused here.
        assertEq(value('"unclosed'), null)
        assertEq(value('a\\'), null)
        // A quote keeps the whitespace before it, where the line's end drops
        // it: an empty pair of them is how a value ends in a space.
        assertEq(value('a ""'), 'a ')
        assertEq(value('a "" '), 'a ')
        assertEq(value('a ""b'), 'a b')
        assertEq(value('a" "'), 'a ')
        assertEq(value('  ""'), '')
    },
    // A header ends at its `]` and the line goes on, as it does for Git.
    headers: () => {
        assertStructurallySame(tryEntries('[core]junk'), [['core', 'junk', 'true']])
        assertStructurallySame(tryEntries('[core] x = 1'), [['core', 'x', '1']])
        assertStructurallySame(tryEntries('[a][b] x = 1'), [['b', 'x', '1']])
        assertStructurallySame(tryEntries('[core] # c\n\tx = 1'), [['core', 'x', '1']])
        // A subsection is any text, kept as written, with a `\` standing for
        // the character after it; the section before it is lowercased.
        assertStructurallySame(tryEntries('[Core "A\\"b"]\n\tx = 1'), [['core.A"b', 'x', '1']])
        assertStructurallySame(tryEntries('[core\t"a"] y = 2'), [['core.a', 'y', '2']])
        // A header with no section names one anyway, as Git names it.
        assertStructurallySame(tryEntries('[ "a"]\n\tx = 1'), [['.a', 'x', '1']])
        // No whitespace may sit inside a header but that run, and nothing
        // but `]` may follow the subsection.
        assertEq(tryEntries('[ core ]\n\tx = 1'), null)
        assertEq(tryEntries('[core ]\n\tx = 1'), null)
        assertEq(tryEntries('[core "a" ]\n\tx = 1'), null)
        assertEq(tryEntries('[core "a"junk]\n\tx = 1'), null)
        assertEq(tryEntries('[core "foo]\n\tx = 1'), null)
        assertEq(tryEntries('[core "a\\'), null)
    },
    // A bad config line refuses the file whole, as Git refuses one: a `[`
    // without its `]`, a `=` with no name before it, a name holding what no
    // name may hold, a name that does not begin with a letter, a section
    // name the same, and any of them after good lines.
    bad: () => {
        assertEq(tryEntries('[extensions'), null)
        assertEq(tryEntries('= 1'), null)
        assertEq(tryEntries('bad key = yes'), null)
        assertEq(tryEntries('a.b = 1'), null)
        assertEq(tryEntries('1st = 1'), null)
        assertEq(tryEntries('-x = 1'), null)
        assertEq(tryEntries('x_1 = 1'), null)
        assertEq(tryEntries('[a b]\n\tx = 1'), null)
        assertEq(tryEntries('[]\n\tx = 1'), null)
        assertEq(tryEntries('[core]\n\tbare = false\n[extensions\n\tobjectformat = sha256'), null)
        // A key written without `=` takes the line's end and nothing else,
        // a comment after it included.
        assertEq(tryEntries('[core]\n\tbare ; on'), null)
        // A name of letters, digits and `-`, and a subsection of anything:
        // both read.
        assertStructurallySame(tryEntries('[branch "feature/x y"]\n\tmerge-base-2 = 1'), [['branch.feature/x y', 'merge-base-2', '1']])
    },
    // An extension Git does not know refuses the repository under version 1,
    // as Git refuses it; under version 0 it is ignored, as Git ignores it.
    // `compatobjectformat` is one Git 2.43 does not know.
    extensions: () => {
        assertEq(tryOidBytes(extension(1, 'frobnicate', 'yes')), null)
        assertEq(tryOidBytes(extension(1, 'compatObjectFormat', 'sha256')), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tfrobnicate = yes'), null)
        assertEq(tryOidBytes(extension(1, 'worktreeconfig', 'true')), 20)
        assertEq(tryOidBytes(extension(1, 'partialclone', 'origin')), 20)
        assertEq(tryOidBytes(extension(1, 'noop-v1', 'anything')), 20)
        assertEq(tryOidBytes(extension(0, 'frobnicate', 'yes')), 20)
        // A subsection is part of an extension's name, not a section of
        // its own: `[extensions "x"]` with `noop` names `x.noop`, which
        // Git knows none of, so version 1 refuses it and version 0 ignores
        // it — the key alone being one Git knows changes nothing. Nor is
        // there a value to read under one: `objectFormat` there is not the
        // key of that name, so its value is never judged and never read.
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tnoop = true'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tobjectFormat = sha256'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tobjectFormat = wat'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tnoop = true'), 20)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tobjectFormat = wat'), 20)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tworktreeConfig = maybe'), 20)
    },
    // An extension whose value Git reads as a boolean refuses the repository
    // where the value is none, whatever the version says.
    booleans: () => {
        assertEq(tryOidBytes(extension(1, 'worktreeConfig', 'maybe')), null)
        assertEq(tryOidBytes(extension(0, 'preciousObjects', 'maybe')), null)
        assertEq(tryOidBytes(extension(0, 'preciousObjects', '1.5')), null)
        // The words, however cased, and an empty value.
        for (const v of ['true', 'FALSE', 'yes', 'no', 'ON', 'oFf', '']) {
            assertEq(tryOidBytes(extension(0, 'preciousObjects', v)), 20)
        }
        // A number in C's own bases, signed or not, scaled by a unit or not.
        for (const v of ['0', '1', '-1', '+5', '017', '-017', '0x1f', '0X1f', '0xFF', '1k', '1K', '1m', '1g', '2097151k', '2147483647', '-2147483647']) {
            assertEq(tryOidBytes(extension(0, 'preciousObjects', v)), 20)
        }
        // A boolean reads a number the same way, whitespace and all, where
        // a word beside one is compared as it is written and stays no
        // boolean at all.
        for (const v of ['" 1"', '"\t0"', '"\f-1"']) {
            assertEq(tryOidBytes(extension(0, 'preciousObjects', v)), 20)
        }
        for (const v of ['" true"', '"true "', '" yes"']) {
            assertEq(tryOidBytes(extension(0, 'preciousObjects', v)), null)
        }
        // `8` is no octal digit, `0x` and `k` spell no number, and a number
        // too large for the `int` Git reads it into is none either.
        for (const v of ['08', '0x', 'k', '-', '1kb', '8g', '2097152k', '2147483648', '-2147483648', '9999999999999999999999']) {
            assertEq(tryOidBytes(extension(0, 'preciousObjects', v)), null)
        }
    },
    // The version is a number, not text, so every spelling Git's parser
    // reads is the version it spells; and every assignment must spell one,
    // since Git reads each as it comes to it.
    version: () => {
        for (const v of ['1', '01', '+1', '0x1', '0X1', '1 # c', '"1"']) {
            assertEq(tryOidBytes(extension(v, 'objectFormat', 'sha256')), 32)
        }
        // The conversion skips the whitespace the value begins with, which
        // only a quoted value keeps, and the class is the C library's:
        // wider than the parser's by a `\v` and a `\f`. It comes off the
        // front alone, so a trailing space is read as a unit and refuses
        // the file.
        for (const v of ['" 1"', '"\t1"', '"\v1"', '"\f1"', '"\r1"', '"  +1"', '" 0x1"']) {
            assertEq(tryOidBytes(extension(v, 'objectFormat', 'sha256')), 32)
        }
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = "1 "'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = " "'), null)
        // A signed number is signed after the whitespace, so `" -1"` is the
        // version that gives up the format it read.
        assertEq(tryOidBytes(extension('" -1"', 'objectFormat', 'sha256')), 20)
        // Over 1 refuses the file, and so does an assignment that spells no
        // number, however good the one after it.
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 2'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1k'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = abc\n\trepositoryformatversion = 1'), null)
        // The last version wins.
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 2\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256'), 32)
        // A file naming no version, and one naming `-1`, are the same file
        // to Git: it gives up the format it read, so both are SHA-1.
        assertEq(tryOidBytes('[extensions]\n\tobjectformat = sha256'), 20)
        assertEq(tryOidBytes(extension(-1, 'objectFormat', 'sha256')), 20)
        // Any other version below 0 keeps it, and refuses nothing.
        assertEq(tryOidBytes(extension(-2, 'objectFormat', 'sha256')), 32)
        assertEq(tryOidBytes(extension(-2, 'frobnicate', 'yes')), 20)
    },
    // The width: absent is SHA-1, `sha256` under version 1 is SHA-256, and
    // what Git refuses is refused — a value in the wrong case, a value this
    // module does not know, the extension under version 0, a bad line. The
    // section and the key are case-insensitive, the last of two values
    // wins, and the key outside `[extensions]` is another key.
    oidBytes: () => {
        assertEq(tryOidBytes(initial.join('\n')), 20)
        assertEq(tryOidBytes(sha256.join('\n')), 32)
        assertEq(tryOidBytes(''), 20)
        assertEq(tryOidBytes(extension(1, 'objectFormat', 'sha1')), 20)
        assertEq(tryOidBytes('[Core]\n\tRepositoryFormatVersion = 1\n[Extensions]\n\tObjectFormat = sha256'), 32)
        assertEq(tryOidBytes(extension(1, 'objectformat', 'SHA256')), null)
        assertEq(tryOidBytes(extension(1, 'objectformat', 'sha3')), null)
        // A value is any text the file holds, so a key of `Object.prototype`
        // names no hash either.
        for (const v of ['toString', '__proto__', 'constructor', 'valueOf', 'hasOwnProperty']) {
            assertEq(tryOidBytes(extension(1, 'objectFormat', v)), null)
        }
        // And a format that ends in the space an empty pair of quotes keeps
        // is a format Git does not know.
        assertEq(tryOidBytes(extension(1, 'objectFormat', 'sha256 ""')), null)
        assertEq(tryOidBytes('\uFEFF' + extension(1, 'objectFormat', 'sha256')), 32)
        assertEq(tryOidBytes(extension(0, 'objectformat', 'sha256')), null)
        assertEq(tryOidBytes(extension(0, 'noop-v1', 'x')), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tobjectformat = sha1'), 20)
        assertEq(tryOidBytes('[core]\n\tobjectformat = sha256'), 20)
        assertEq(tryOidBytes('[extensions'), null)
        // An `objectFormat` Git does not know refuses the file wherever it
        // sits, since Git reads each assignment as it comes to it: a good
        // one after it does not hide it, and neither does a version that
        // reads no format at all.
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = wat\n\tobjectformat = sha1'), null)
        assertEq(tryOidBytes(extension(-2, 'objectFormat', 'wat')), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions]\n\tpreciousObjects = maybe\n\tpreciousObjects = true'), null)
    },
}
