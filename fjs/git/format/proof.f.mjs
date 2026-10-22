/**
 * @import { ReadFile } from '../../effects/node/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { OidBytes } from '../types.ts'
 */

import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { run } from '../../effects/mock/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { tryEntries } from '../config/module.f.js'
import { initConfig, initSha256Config, latin1, noFile } from '../testlib.f.mjs'
import { oidBytes, tryOidBytes } from './module.f.mjs'

/**
 * The id width a `config` file Git reads names.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
const width = text => tryOidBytes(assertNotNullish(tryEntries(text)))

/**
 * A file setting one key of `[extensions]` under a version.
 *
 * @type {(version: number | string, key: string, value: string) => string}
 */
const extension = (version, key, value) =>
    `[core]\n\trepositoryformatversion = ${version}\n[extensions]\n\t${key} = ${value}`

/** The `config` files {@link oidBytes} reads, by path. */
const files = /** @type {StringMap<readonly number[]>} */ ({
    'repo/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
    'sha/config': latin1('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n'),
    'odd/config': latin1('[extensions]\n\tobjectformat = sha3\n'),
    'bad/config': latin1('[extensions\n\tobjectformat = sha256\n'),
    // A repository directory that is a root, for the `config` path below
    // one. `fjs/git/repo` answers `/` for a gitfile of `gitdir: /`, and a
    // path built by writing the separator would look for `//config` here.
    '/config': latin1('[core]\n\trepositoryformatversion = 0\n'),
})

/** @type {MemOperationMap<ReadFile, readonly string[]>} */
const host = {
    readFile: path => log => {
        const file = files[path]
        return [
            [...log, `readFile ${path}`],
            file === undefined
                ? error(noFile(path))
                : ok(u8ListToVecMsb(file)),
        ]
    },
}

const runHost = run(host)([])

export const proof = {
    // The width from `config`: absent is 20, `sha256` is 32, a format this
    // module does not know is `null`, and no `config` is the channel's.
    oidBytes: () => {
        assertStructurallySame(runHost(oidBytes('repo'))[1], ['ok', 20])
        assertStructurallySame(runHost(oidBytes('sha'))[1], ['ok', 32])
        assertStructurallySame(runHost(oidBytes('odd'))[1], ['ok', null])
        // A file holding a line Git cannot read names no width either.
        assertStructurallySame(runHost(oidBytes('bad'))[1], ['ok', null])
        // The `config` path is joined below the directory, not spelled with
        // a separator: at the POSIX root the file is `/config`, and
        // `//config` is a different namespace. This is the second of the two
        // paths `todo/directory-separator.md` named, and without it the
        // `${dir}/config` spelling passes every other case here.
        assertStructurallySame(runHost(oidBytes('/'))[1], ['ok', 20])
        const [log] = runHost(oidBytes('/'))
        assertStructurallySame(log, ['readFile /config'])
        const [, r] = runHost(oidBytes('none'))
        assert(r[0] === 'error')
    },
    // The width: absent is SHA-1, `sha256` under version 1 is SHA-256, and
    // what Git refuses is refused — a value in the wrong case, a value this
    // module does not know, the extension under version 0. The section and
    // the key are case-insensitive, the last of two values wins, and the key
    // outside `[extensions]` is another key.
    tryOidBytes: () => {
        assertEq(width(initConfig), 20)
        assertEq(width(initSha256Config), 32)
        assertEq(width(''), 20)
        assertEq(width(extension(1, 'objectFormat', 'sha1')), 20)
        assertEq(width('[Core]\n\tRepositoryFormatVersion = 1\n[Extensions]\n\tObjectFormat = sha256'), 32)
        assertEq(width(extension(1, 'objectformat', 'SHA256')), null)
        assertEq(width(extension(1, 'objectformat', 'sha3')), null)
        // A value is any text the file holds, so a key of `Object.prototype`
        // names no hash either.
        for (const v of ['toString', '__proto__', 'constructor', 'valueOf', 'hasOwnProperty']) {
            assertEq(width(extension(1, 'objectFormat', v)), null)
        }
        // A format that ends in the space an empty pair of quotes keeps is a
        // format Git does not know, and one a NUL cuts short is the format
        // before it, which is the one Git reads.
        assertEq(width(extension(1, 'objectFormat', 'sha256 ""')), null)
        assertEq(width(extension(1, 'objectFormat', 'sha256\0junk')), 32)
        assertEq(width(extension(1, 'objectFormat', 'sha256 \0junk')), null)
        assertEq(width('\uFEFF' + extension(1, 'objectFormat', 'sha256')), 32)
        assertEq(width(extension(0, 'objectformat', 'sha256')), null)
        assertEq(width(extension(0, 'noop-v1', 'x')), null)
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tobjectformat = sha1'), 20)
        assertEq(width('[core]\n\tobjectformat = sha256'), 20)
        // An `objectFormat` Git does not know refuses the file wherever it
        // sits, since Git reads each assignment as it comes to it: a good
        // one after it does not hide it, and neither does a version that
        // reads no format at all.
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = wat\n\tobjectformat = sha1'), null)
        assertEq(width(extension(-2, 'objectFormat', 'wat')), null)
    },
    // An extension Git does not know refuses the repository under version 1,
    // as Git refuses it; under version 0 it is ignored, as Git ignores it.
    // `compatobjectformat` is one Git 2.43 does not know.
    extensions: () => {
        assertEq(width(extension(1, 'frobnicate', 'yes')), null)
        assertEq(width(extension(1, 'compatObjectFormat', 'sha256')), null)
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n\tfrobnicate = yes'), null)
        assertEq(width(extension(1, 'worktreeconfig', 'true')), 20)
        assertEq(width(extension(1, 'partialclone', 'origin')), 20)
        assertEq(width(extension(1, 'noop-v1', 'anything')), 20)
        assertEq(width(extension(0, 'frobnicate', 'yes')), 20)
        // A subsection is part of an extension's name, not a section of
        // its own: `[extensions "x"]` with `noop` names `x.noop`, which
        // Git knows none of, so version 1 refuses it and version 0 ignores
        // it — the key alone being one Git knows changes nothing. Nor is
        // there a value to read under one: `objectFormat` there is not the
        // key of that name, so its value is never judged and never read.
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tnoop = true'), null)
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tobjectFormat = sha256'), null)
        assertEq(width('[core]\n\trepositoryformatversion = 1\n[extensions "x"]\n\tobjectFormat = wat'), null)
        assertEq(width('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tnoop = true'), 20)
        assertEq(width('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tobjectFormat = wat'), 20)
        assertEq(width('[core]\n\trepositoryformatversion = 0\n[extensions "x"]\n\tworktreeConfig = maybe'), 20)
    },
    // An extension whose value Git reads as a boolean refuses the repository
    // where the value is none, whatever the version says, and wherever the
    // assignment sits. What reads as one is `fjs/git/config`'s `lastBool`.
    booleans: () => {
        assertEq(width(extension(1, 'worktreeConfig', 'maybe')), null)
        assertEq(width(extension(0, 'preciousObjects', 'maybe')), null)
        assertEq(width(extension(0, 'preciousObjects', '1.5')), null)
        assertEq(width('[core]\n\trepositoryformatversion = 0\n[extensions]\n\tpreciousObjects = maybe\n\tpreciousObjects = true'), null)
        for (const v of ['true', 'oFf', '', '0x1f', '" 1"']) {
            assertEq(width(extension(0, 'preciousObjects', v)), 20)
        }
    },
    // The version is a number, not text, so every spelling Git's parser
    // reads is the version it spells — what reads as one is
    // `fjs/git/config`'s `lastInt` — and every assignment must spell one,
    // since Git reads each as it comes to it.
    version: () => {
        for (const v of ['1', '01', '+1', '0x1', '0b1', '1 # c', '"1"', '"\v1"']) {
            assertEq(width(extension(v, 'objectFormat', 'sha256')), 32)
        }
        // Over 1 refuses the file, and so does an assignment that spells no
        // number, however good the one after it.
        for (const v of ['2', '1k', '0b10', 'abc', '"1 "']) {
            assertEq(width('[core]\n\trepositoryformatversion = ' + v), null)
        }
        assertEq(width('[core]\n\trepositoryformatversion = abc\n\trepositoryformatversion = 1'), null)
        // The last version wins.
        assertEq(width('[core]\n\trepositoryformatversion = 2\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256'), 32)
        // A file naming no version, and one naming `-1` however it spells
        // it, are the same file to Git: it gives up the format it read, so
        // both are SHA-1.
        assertEq(width('[extensions]\n\tobjectformat = sha256'), 20)
        for (const v of [-1, '" -1"', '-0b1']) {
            assertEq(width(extension(v, 'objectFormat', 'sha256')), 20)
        }
        // Any other version below 0 keeps it, and refuses nothing.
        assertEq(width(extension(-2, 'objectFormat', 'sha256')), 32)
        assertEq(width(extension(-2, 'frobnicate', 'yes')), 20)
    },
}
