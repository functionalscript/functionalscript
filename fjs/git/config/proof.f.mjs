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
        assertEq(tryEntries('[a b]\n\tx = 1'), null)
        assertEq(tryEntries('[]\n\tx = 1'), null)
        assertEq(tryEntries('[core]\n\tbare = false\n[extensions\n\tobjectformat = sha256'), null)
        // A name of letters, digits and `-`, and a subsection of anything:
        // both read.
        assertStructurallySame(tryEntries('[branch "feature/x y"]\n\tmerge-base-2 = 1'), [['branch.feature/x y', 'merge-base-2', '1']])
    },
    // An extension Git does not know refuses the repository under version 1,
    // as Git refuses it; under version 0 it is ignored, as Git ignores it.
    extensions: () => {
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tfrobnicate = yes'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tfrobnicate = yes'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tworktreeconfig = true'), 20)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions]\n\tfrobnicate = yes'), 20)
    },
    // The width: absent is SHA-1, `sha256` under version 1 is SHA-256, and
    // what Git refuses is refused — a value in the wrong case, a value this
    // module does not know, the extension under version 0, a version that
    // is neither 0 nor 1, a bad line. The section and the key are
    // case-insensitive, the last of two values wins, and the key outside
    // `[extensions]` is another key.
    oidBytes: () => {
        assertEq(tryOidBytes(initial.join('\n')), 20)
        assertEq(tryOidBytes(sha256.join('\n')), 32)
        assertEq(tryOidBytes(''), 20)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectFormat = sha1'), 20)
        assertEq(tryOidBytes('[Core]\n\tRepositoryFormatVersion = 1\n[Extensions]\n\tObjectFormat = sha256'), 32)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = SHA256'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha3'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 0\n[extensions]\n\tobjectformat = sha256'), null)
        assertEq(tryOidBytes('[extensions]\n\tobjectformat = sha1'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 2'), null)
        assertEq(tryOidBytes('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tobjectformat = sha1'), 20)
        assertEq(tryOidBytes('[core]\n\tobjectformat = sha256'), 20)
        assertEq(tryOidBytes('[extensions'), null)
    },
}
