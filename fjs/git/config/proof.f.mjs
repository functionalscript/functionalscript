/**
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Entry } from './types.ts'
 */

import { assertEq, assertError, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { initConfig } from '../testlib.f.mjs'
import { lastBool, lastInt, lastValue, tryEntries, values } from './module.f.mjs'

/**
 * The one value a file of one `[core]` key holds.
 *
 * @type {(text: string) => Nullable<string>}
 */
const value = text => {
    const entries = tryEntries(`[core]\n\tx = ${text}`)
    return entries === null ? null : entries[0][2]
}

/**
 * The entries of a file Git reads.
 *
 * @type {(text: string) => readonly Entry[]}
 */
const entriesOf = text => assertNotNullish(tryEntries(text))

/**
 * A typed reader asked for `core.x` in a file of that one key.
 *
 * @type {<T>(reader: (entries: readonly Entry[], section: string, key: string) => T) => (text: string) => T}
 */
const one = reader => text => reader(entriesOf(`[core]\n\tx = ${text}`), 'core', 'x')

/** `lastInt` of one value. */
const int = one(lastInt)

/** `lastBool` of one value. */
const bool = one(lastBool)

/**
 * The spellings both typed readers read as a number, with the number each
 * spells: C's own bases, signed or not, scaled by a unit or not. The
 * whitespace before one is the conversion's, which only a quoted value
 * keeps, and its class is the C library's — wider than the parser's by a
 * `\v` and a `\f`. `0b` is binary, which is glibc's extension to C's
 * grammar rather than Git's own, and the Git measured here is built
 * against one that has it.
 *
 * @type {readonly (readonly [string, bigint])[]}
 */
const numbers = [
    ['0', 0n],
    ['1', 1n],
    ['-1', -1n],
    ['+5', 5n],
    ['01', 1n],
    ['017', 0o17n],
    ['-017', -0o17n],
    ['0x1f', 0x1fn],
    ['0X1f', 0x1fn],
    ['0xFF', 0xffn],
    ['0xaF', 0xafn],
    ['0x0009', 9n],
    ['0x7fffffff', 0x7fff_ffffn],
    ['0x1g', 0x4000_0000n],
    ['0b1', 1n],
    ['0B11', 0b11n],
    ['-0b1', -1n],
    ['0b1k', 1_024n],
    ['1k', 1_024n],
    ['1K', 1_024n],
    ['1m', 1_048_576n],
    ['1g', 1_073_741_824n],
    ['2097151k', 2_097_151n * 1_024n],
    ['2147483647', 0x7fff_ffffn],
    ['-2147483647', -0x7fff_ffffn],
    ['1 # c', 1n],
    ['"1"', 1n],
    ['" 1"', 1n],
    ['"\t0"', 0n],
    ['"\v1"', 1n],
    ['"\f-1"', -1n],
    ['"\r1"', 1n],
    ['"  +1"', 1n],
    ['" 0x1"', 1n],
    ['" 0b1"', 1n],
    ['" -1"', -1n],
]

/**
 * Spellings no typed reader reads as a number: `8` is no octal digit, a
 * letter is no digit but `a-f` in hexadecimal, a digit of any other script
 * is none at all, `0x`, `0b` and `k` spell no number, a number too large
 * for the `int` Git reads it into is none either, and the conversion's whitespace comes off the
 * front alone, so a trailing space is read as a unit and found to be none.
 *
 * @type {readonly string[]}
 */
const noNumbers = ['08', '019', '0a', '1a', '0b1a', '0xg', '0x1h', '0x٤', '٤', '0x80000000', '0x', '0b', '0b2', 'k', '-', '1kb', '8g', '2097152k', '2147483648', '-2147483648', '9999999999999999999999', '1.5', '"1 "', '" "']

export const proof = {
    // Every entry, in order, with its section: a tab before the key, the
    // section lowercased, the value as text.
    entries: () => {
        assertStructurallySame(tryEntries(initConfig), [
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
        // A `\r` ends a line only where a `\n` follows it. One that reaches
        // the file's end ends nothing and stands in the line, so a bare key
        // before it is the key with the `\r` in it, which is the line above
        // one character later. A `\r` that is value whitespace is dropped
        // either way.
        assertEq(tryEntries('a\r'), null)
        assertEq(tryEntries('[core]\n\tx\r'), null)
        assertEq(tryEntries('x\r\r'), null)
        assertEq(tryEntries('x\r\r\n'), null)
        assertStructurallySame(tryEntries('[core]\n\tx = 1\r'), [['core', 'x', '1']])
        assertStructurallySame(tryEntries('[core]\r\n\tx\r\n'), [['core', 'x', 'true']])
        // A `\v` and a `\f` are no whitespace at all, so they begin no
        // line and stand in a value as the characters they are.
        assertEq(tryEntries('\v[core]\nx = 1'), null)
        assertEq(tryEntries('[core]\vx = 1'), null)
        assertEq(tryEntries('[core\v"a"]\nx = 1'), null)
        assertEq(tryEntries('[core]\nx\v= 1'), null)
        assertEq(value('a\vb'), 'a\vb')
        assertEq(value('a\fb'), 'a\fb')
    },
    // A value ends at its first NUL, because Git builds it and hands it on
    // as a C string. The NUL is no whitespace, so it commits the run
    // before it, and the cut then leaves that run at the end where a
    // line's end would have dropped it. In a name a NUL is no key
    // character at all, so it is a bad config line.
    nul: () => {
        assertEq(value('a\0b'), 'a')
        assertEq(value('a   \0b'), 'a   ')
        assertEq(value('\0b'), '')
        assertEq(value('"a \0b"'), 'a ')
        assertEq(value('a\0b   '), 'a')
        assertEq(tryEntries('[c]\n\tx\0'), null)
        assertEq(tryEntries('[c]\n\tx\0y = 1'), null)
        assertEq(tryEntries('[c\0d]\n\tx = 1'), null)
        // A quoted subsection takes every character but a `\n`, so a NUL
        // there is no bad config line to Git: it truncates the whole
        // assembled name and leaves it with no key, which is a name an
        // entry cannot spell, so this refuses rather than misreads.
        assertEq(tryEntries('[remote "o\0p"]\n\tx = 1'), null)
        assertEq(tryEntries('[remote "\0o"]\n\tx = 1'), null)
        assertStructurallySame(tryEntries('[remote "op"]\n\tx = 1'), [['remote.op', 'x', '1']])
        assertEq(tryEntries('\0[c]\n\tx = 1'), null)
    },
    // A value as Git's own parser reads it, a character at a time.
    value: () => {
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
    // Every value a key is given, in file order, and only that key's in that
    // section. An entry holds the section and the key lowercased and a
    // subsection as written, and they are asked for as it holds them.
    values: () => {
        const entries = entriesOf('[core]\n\tx = 1\n[Core]\n\tX = 2\n[core "A"]\n\tx = 3\n[other]\n\tx = 4\n\ty = 5')
        assertStructurallySame(values(entries, 'core', 'x'), ['1', '2'])
        assertStructurallySame(values(entries, 'core.A', 'x'), ['3'])
        assertStructurallySame(values(entries, 'other', 'y'), ['5'])
        assertStructurallySame(values(entries, 'core', 'y'), [])
    },
    // The value that wins is the last, and none is judged on the way.
    lastValue: () => {
        const entries = entriesOf('[core]\n\tx = 1\n\tx = 2\n[Core]\n\tX = abc')
        assertEq(lastValue(entries, 'core', 'x'), 'abc')
        assertEq(lastValue(entries, 'core', 'y'), null)
        // A key written without `=` is `true`.
        assertEq(lastValue(entriesOf('[core]\n\tx'), 'core', 'x'), 'true')
    },
    // A value as Git's `int`: the number it spells, or the value itself as
    // the error where it spells none. The last assignment wins, and the
    // first that spells no number refuses the file however good the ones
    // after it, since Git reads each as it comes to it.
    lastInt: () => {
        for (const [v, n] of numbers) {
            assertStructurallySame(int(v), ok(n))
        }
        for (const v of noNumbers) {
            assertError(int(v))
        }
        assertStructurallySame(int('"1 "'), error('1 '))
        assertStructurallySame(int('abc'), error('abc'))
        // A key written without `=` is `true`, which is no number.
        assertStructurallySame(lastInt(entriesOf('[core]\n\tx'), 'core', 'x'), error('true'))
        assertStructurallySame(lastInt(entriesOf('[core]\n\tx = 2\n\tx = 1'), 'core', 'x'), ok(1n))
        assertStructurallySame(lastInt(entriesOf('[core]\n\tx = abc\n\tx = 1\n\tx = def'), 'core', 'x'), error('abc'))
        assertStructurallySame(lastInt(entriesOf('[core]\n\ty = 1'), 'core', 'x'), ok(null))
    },
    // A value as Git's `bool`: a word, however cased, or a number, which is
    // true where it is not zero. A word is compared as it is written, so
    // the whitespace a number may begin with is no part of one.
    lastBool: () => {
        for (const v of ['true', 'TRUE', 'yes', 'ON']) {
            assertStructurallySame(bool(v), ok(true))
        }
        for (const v of ['false', 'FALSE', 'no', 'oFf', '']) {
            assertStructurallySame(bool(v), ok(false))
        }
        for (const [v, n] of numbers) {
            assertStructurallySame(bool(v), ok(n !== 0n))
        }
        for (const v of ['maybe', '" true"', '"true "', '" yes"', ...noNumbers]) {
            assertError(bool(v))
        }
        // A key written without `=` is `true`, where one written with `=` and
        // nothing after it is `false`.
        assertStructurallySame(lastBool(entriesOf('[core]\n\tx'), 'core', 'x'), ok(true))
        assertStructurallySame(lastBool(entriesOf('[core]\n\tx = true\n\tx = off'), 'core', 'x'), ok(false))
        assertStructurallySame(lastBool(entriesOf('[core]\n\tx = maybe\n\tx = true'), 'core', 'x'), error('maybe'))
        assertStructurallySame(lastBool(entriesOf('[core]\n\ty = 1'), 'core', 'x'), ok(null))
    },
}
