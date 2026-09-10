import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { entries, tryOidBytes } from './module.f.mjs'

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
        assertStructurallySame(entries(initial.join('\n')), [
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
        assertStructurallySame(entries(text), [
            ['', 'orphan', '1'],
            ['remote.Origin', 'url', 'https://example.com/a.git'],
            ['remote.Origin', 'fetch', '+refs/heads/*:refs/remotes/origin/*'],
            ['core', 'bare', 'true'],
            ['core', 'empty', ''],
        ])
        assertStructurallySame(entries(''), [])
        // A `#` before a `;`, and a `;` before a `#`: the first one begins
        // the comment.
        assertStructurallySame(entries('a = 1 # x ; y\nb = 2 ; x # y'), [['', 'a', '1'], ['', 'b', '2']])
    },
    // The width: absent is SHA-1, `sha256` is SHA-256, and a value this
    // module does not know is refused. Case does not matter, the last of
    // two wins, and the key outside `[extensions]` is another key.
    oidBytes: () => {
        assertEq(tryOidBytes(initial.join('\n')), 20)
        assertEq(tryOidBytes(sha256.join('\n')), 32)
        assertEq(tryOidBytes(''), 20)
        assertEq(tryOidBytes('[extensions]\n\tobjectFormat = SHA1'), 20)
        assertEq(tryOidBytes('[Extensions]\n\tObjectFormat = SHA256'), 32)
        assertEq(tryOidBytes('[extensions]\n\tobjectformat = sha3'), null)
        assertEq(tryOidBytes('[extensions]\n\tobjectformat = sha256\n\tobjectformat = sha1'), 20)
        assertEq(tryOidBytes('[core]\n\tobjectformat = sha256'), 20)
    },
}
