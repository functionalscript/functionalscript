/**
 * @import { Effect, IoChannel, IoErrorInfo } from '../../../effects/types.ts'
 * @import { Dir } from '../../../effects/node/virtual/types.ts'
 * @import { MemOperationMap } from '../../../effects/mock/types.ts'
 * @import { CreateExclusive, Mkdir, ReadFile, ReadWhole, Rename, Rm, Rmdir, Stat, WriteExclusive } from '../../../effects/node/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { Oid } from '../../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Dirs } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ioError } from '../../../effects/module.f.mjs'
import { run as mockRun } from '../../../effects/mock/module.f.mjs'
import { virtual } from '../../../effects/node/virtual/module.f.mjs'
import { codePointListToString } from '../../../text/utf16/module.f.mjs'
import { maxLengthBytes, u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { toHex, tryFromHex } from '../../oid/module.f.mjs'
import { latin1 } from '../../testlib.f.mjs'
import { badNameCode, tryResolve, zeroIdCode } from '../module.f.mjs'
import { badPackedCode, brokenRefCode, idWidthCode, outsideRefsCode, refPrefixCode, tryDelete, tryWrite, unsortedPackedCode, unspellableNameCode } from './module.f.mjs'
import { a, b, file, hexOf, kind, missing, one, ran, ref, resolved, run, shadowed, t } from '../testlib.f.mjs'

/**
 * Sixty-four hex digits, which is an id in a SHA-256 repository and no id at all
 * in a SHA-1 one. The same string is used both ways below — refused at
 * `oidBytes` 20 and written at 32 — so the width is asserted to be the
 * repository's rather than the id's.
 */
const wide = /** @type {const} */ (`${a}${b.slice(0, 24)}`)

/**
 * An id from the hex it is written as, which is how every fixture here spells
 * one.
 *
 * @type {(hex: string) => Oid}
 */
const idOf = hex => {
    const i = tryFromHex(latin1(hex))
    assert(i !== null, hex)
    return i
}

/**
 * Writes `name` at the id `hex` into a copy of `root`, and answers the
 * filesystem left behind beside the outcome.
 *
 * @type {(root: Dir, name: string, hex: string) => readonly [Dir, Result<void, IoChannel>]}
 */
const wrote = (root, name, hex) => ran(root, tryWrite(one(''), 20)(latin1(name))(idOf(hex)))

/**
 * Deletes `name` from a copy of `root`, and answers the filesystem left behind
 * beside the outcome — whose `ok` says whether there was a ref to delete.
 *
 * @type {(root: Dir, name: string) => readonly [Dir, Result<boolean, IoChannel>]}
 */
const deleted = (root, name) => ran(root, tryDelete(one(''), 20)(latin1(name)))

/**
 * The header `git pack-refs` writes, trailing space and all: measured on 2.43.0,
 * 46 bytes with the LF, and all a delete leaves of the file once the last ref in
 * it goes.
 */
const header = /** @type {const} */ ('# pack-refs with: peeled fully-peeled sorted \n')

/**
 * `bytes` in `Vec`-sized pieces, which is how a file larger than one `Vec` is
 * held — by the virtual filesystem, and by the delete that writes one.
 *
 * @type {(bytes: readonly number[]) => readonly Vec[]}
 */
const chunksOf = bytes => {
    const size = Number(maxLengthBytes)
    return Array.from(
        { length: Math.ceil(bytes.length / size) },
        (_, i) => u8ListToVecMsb(bytes.slice(i * size, (i + 1) * size)))
}

/**
 * The `IoError` a refused write comes back with: every refusal here has that
 * shape, so a case asserts the code and the message instead of unwrapping three
 * tags. A refused delete is the same shape.
 *
 * @type {(r: Result<unknown, IoChannel>) => IoErrorInfo}
 */
const writeRefusal = r => {
    assert(r[0] === 'error')
    const e = r[1]
    assert(e[0] === 'ioError')
    return e[1]
}

export const proof = {
    // ## Writing a ref
    //
    // The whole of a write, asserted on the filesystem it leaves: the
    // directories above the file, the file itself, and no lock beside it. The
    // structural comparison is what says the lock is gone — a lock left behind
    // would be an extra entry — and the read back through `tryResolve` is what
    // says the bytes are a ref and not just bytes. Forty-one of them here
    // because these fixtures are a SHA-1 repository; the file is
    // `oidBytes * 2 + 1` long, which is why `idWidth` in `writeRefuses` refuses
    // an id of the other width rather than writing sixty-five.
    writeRef: () => {
        const [fs, r] = wrote({}, 'refs/heads/master', a)
        assertStructurallySame(r, ok(undefined))
        assertStructurallySame(fs, { refs: { heads: { master: ref(a) } } })
        assertEq(hexOf(fs, 'refs/heads/master'), a)
        // And a name two directories deeper, whose directories are created the
        // way Git creates them: measured on 2.43.0, `git update-ref
        // refs/heads/a/b/c` on a repository holding no `refs/heads/a` writes the
        // file and both directories above it at exit 0. The ref already there is
        // left alone, which is what makes this about creating and not replacing.
        const [deep] = wrote(fs, 'refs/heads/a/b/c', b)
        assertStructurallySame(deep, { refs: { heads: { master: ref(a), a: { b: { c: ref(b) } } } } })
        assertEq(hexOf(deep, 'refs/heads/a/b/c'), b)
        // A name already there is replaced, which is what a rename over it does.
        const [again] = wrote(fs, 'refs/heads/master', b)
        assertStructurallySame(again, { refs: { heads: { master: ref(b) } } })
    },
    // A per-worktree name is written to the worktree's own directory and a
    // shared one to the shared directory, which is the rule both readers follow
    // — see `dirOf`. `refs/heads/master` beside it is the control: without it
    // the case would pass for a writer that always used the gitdir.
    writeWorktree: () => {
        /** @type {Dirs} */
        const dirs = { gitdir: 'wt', common: 'repo' }
        /** @type {Dir} */
        const root = { wt: {}, repo: {} }
        const [own] = ran(root, tryWrite(dirs, 20)(latin1('refs/bisect/good'))(idOf(a)))
        assertStructurallySame(own, { wt: { refs: { bisect: { good: ref(a) } } }, repo: {} })
        const [shared] = ran(root, tryWrite(dirs, 20)(latin1('refs/heads/master'))(idOf(a)))
        assertStructurallySame(shared, { wt: {}, repo: { refs: { heads: { master: ref(a) } } } })
    },
    // A lock already there refuses the write, leaves the ref at the id it had,
    // and leaves the lock — which is not this writer's to remove. Git's answer:
    // measured on 2.43.0, a `refs/heads/y.lock` put there by hand makes
    // `git update-ref refs/heads/y <id>` exit 128 with `cannot lock ref
    // 'refs/heads/y': Unable to create '…/refs/heads/y.lock': File exists` and
    // write no `refs/heads/y`.
    //
    // The lock's name is spelled out rather than built from `lockSuffix`,
    // because the name is what is under test here.
    writeLockHeld: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { master: ref(a), 'master.lock': [] } } }
        const [fs, r] = wrote(root, 'refs/heads/master', b)
        assertEq(writeRefusal(r).code, 'EEXIST')
        assertStructurallySame(fs, root)
    },
    // A directory where the ref's file goes: the rename fails, and the lock is
    // given back rather than left to refuse every later write of that name. Git
    // refuses this direction too — measured on 2.43.0, with `refs/heads/a/b`
    // present, `git update-ref refs/heads/a <id>` exits 128 with
    // `'refs/heads/a' exists; cannot create 'refs/heads/a'` — and leaves no
    // lock either.
    //
    // The comparison against the untouched repository is the assertion: a
    // `refs/heads/a.lock` still there is the failure this case exists for, and
    // `writeLockHeld` above is what keeps the cleanup from being a blanket one
    // that would take another writer's lock.
    writeRefIsADirectory: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { a: { b: ref(b) } } } }
        const [fs, r] = wrote(root, 'refs/heads/a', a)
        const e = writeRefusal(r)
        assertEq(e.code, refPrefixCode)
        assertEq(e.message, 'refs/heads/a is a directory; cannot create it')
        assertStructurallySame(fs, root)
    },
    // The other loose direction: a **file** where the name's parent directory
    // must go. The same `stat` answers it, because the ref's own path leads
    // through that file — measured `ENOTDIR` on node 22.22.2 and here alike, so
    // this is the one prefix case whose refusal is the host's code rather than
    // `refPrefixCode`. Git refuses it too, with
    // `'refs/heads/a' exists; cannot create 'refs/heads/a/b'`.
    //
    // The ref is still there afterwards, which is the point: nothing is created,
    // and the `mkdir` is never reached. (It would refuse too — this runner's
    // `mkdirOp` answers the host's `ENOTDIR` for a file in the path — but the
    // refusal here is the `stat`'s, before any lock is taken.)
    writeLooseIsAFile: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { a: ref(b) } } }
        const [fs, r] = wrote(root, 'refs/heads/a/b', a)
        assertEq(writeRefusal(r).code, 'ENOTDIR')
        assertStructurallySame(fs, root)
    },
    // And the cleanup itself, which now needs a host: the only failure left
    // *after* the exclusive write is the `rename`, and the virtual filesystem
    // cannot produce one — a directory at the path is refused by the `stat` above
    // before the lock is taken, which is what `writeRefIsADirectory` pins.
    //
    // So the lock is taken, the rename fails, and the `rm` has to appear. Without
    // it the name is unwritable until someone removes the file by hand.
    writeGivesTheLockBack: () => {
        /** @type {(rmResult: Result<void, IoChannel>) => MemOperationMap<ReadWhole | Stat | Mkdir | WriteExclusive | Rename | Rm, readonly string[]>} */
        const host = rmResult => ({
            readWhole: missing,
            // logged rather than `missing`, so the order below pins that the
            // `stat` of the ref's path comes before anything is created
            stat: path => log => [[...log, `stat ${path}`], error(ioError({ code: 'ENOENT', message: path }))],
            mkdir: (path, _) => log => [[...log, `mkdir ${path}`], ok(undefined)],
            writeExclusive: path => log => [[...log, `writeExclusive ${path}`], ok(undefined)],
            rename: (src, dst) => log => [
                [...log, `rename ${src} ${dst}`],
                error(ioError({ code: 'EIO', message: dst })),
            ],
            rm: path => log => [[...log, `rm ${path}`], rmResult],
        })
        /** @type {(rmResult: Result<void, IoChannel>) => void} */
        const cleansUp = rmResult => {
            const [log, r] = mockRun(host(rmResult))(/** @type {readonly string[]} */ ([]))(
                tryWrite(one(''), 20)(latin1('refs/heads/master'))(idOf(a)))
            // the rename's error reaches the caller, not the cleanup's outcome
            assertEq(writeRefusal(r).code, 'EIO')
            assertStructurallySame(log, [
                'stat refs/heads/master',
                'mkdir refs/heads',
                'writeExclusive refs/heads/master.lock',
                'rename refs/heads/master.lock refs/heads/master',
                'rm refs/heads/master.lock',
            ])
        }
        cleansUp(ok(undefined))
        // And with the cleanup *itself* failing: still the rename's `EIO`, since
        // that is the reason a caller can act on and the `rm`'s is the reason it
        // could not be undone. A compensation built on `step` rather than
        // `resultStep` would report `EROFS` here.
        cleansUp(error(ioError({ code: 'EROFS', message: 'refs/heads/master.lock' })))
    },
    // Five refusals, each before any effect runs — which is what the untouched
    // filesystem beside each one says.
    writeRefuses: () => {
        // A lock of a name one of these writes targets, so the comparison in
        // `refuses` says these answer before any effect runs at all — not merely
        // that they leave the refs alone.
        /** @type {Dir} */
        const root = { refs: { heads: { master: ref(a), 'zero.lock': [] } } }
        /** @type {(name: string, hex: string, code: string) => IoErrorInfo} */
        const refuses = (name, hex, code) => {
            const [fs, r] = wrote(root, name, hex)
            const e = writeRefusal(r)
            assertEq(e.code, code)
            assertStructurallySame(fs, root)
            return e
        }
        // A name that is no ref name. `x.lock` and `.hidden` are the two
        // file-name conventions a walk of `refs/` skips, so a ref of either name
        // is one no reader would ever answer; `a..b` and `bad.` are the rules
        // Git refuses the whole listing over; `../secret` is the one that would
        // otherwise join below the repository into a path outside it.
        for (const n of ['refs/heads/x.lock', 'refs/heads/.hidden', 'refs/heads/a..b', 'refs/heads/bad.', 'refs/../secret']) {
            refuses(n, a, badNameCode)
        }
        assertEq(refuses('refs/heads/bad.', a, badNameCode).message, 'refs/heads/bad. is not a ref name')
        // A name outside `refs/`, which `update-ref` does write — measured,
        // `FOO_HEAD` becomes `.git/FOO_HEAD` at exit 0 — and this refuses.
        // `HEAD` is the reason: measured on 2.43.0 with `.git/HEAD` holding
        // `ref: refs/heads/master`, `git update-ref HEAD <id>` leaves that file
        // untouched and writes the *branch*, so a writer handed `HEAD` has two
        // answers and no way to know which was meant.
        for (const n of ['HEAD', 'FETCH_HEAD', 'a/b']) {
            refuses(n, a, outsideRefsCode)
        }
        assertEq(refuses('HEAD', a, outsideRefsCode).message, 'HEAD is not under refs/')
        // An id of the wrong width: a 32-byte id in a repository whose ids are
        // 20 bytes is sixty-four hex digits, which `fjs/git/ref` reads as no ref
        // at all — so the file would be one this module's own listing refuses.
        // `writeSha256` writes this very id, at `oidBytes` 32.
        refuses('refs/heads/wide', wide, idWidthCode)
        // And the zero id, which is Git's delete rather than a value.
        const zero = '0'.repeat(40)
        assertEq(
            refuses('refs/heads/zero', zero, zeroIdCode).message,
            'refs/heads/zero would hold the zero id')
        // A name no path spells: `refs/heads/` and the byte `0x80` is a ref name
        // `check-ref-format` accepts and `rev-parse` resolves, measured, and a
        // path is text to this host. `tryResolve` answers `null` for it, which a
        // write may not — see `byteName` in `../proof.f.mjs` and `../todo/byte-ref-names.md`.
        const byteNamed = /** @type {readonly number[]} */ ([...latin1('refs/heads/'), 0x80])
        const [fs, r] = ran(root, tryWrite(one(''), 20)(byteNamed)(idOf(a)))
        const e = writeRefusal(r)
        assertEq(e.code, unspellableNameCode)
        // the hex spelling of the name, since there is no text one
        assertEq(e.message, '726566732f68656164732f80 is no path this host can spell')
        assertStructurallySame(fs, root)
    },
    // A name too long to be a `Vec` at all. `Bytes` is unbounded and
    // `u8ListToVecMsb` asserts past `maxLengthBytes`, so before `nameText` checked
    // the length this escaped as a bare `'assertion failed'` — not an `IoChannel`
    // refusal, not even an `Effect`. Found by review; the bound below is one byte
    // over, and the control is one byte under it, which answers normally.
    //
    // A *write* is refused and a *lookup* answers `null`, which is each side's
    // existing answer for a name no path spells. The reason is the conversion and
    // not a filesystem's limit: a shorter name over `NAME_MAX` *does* convert,
    // spells a path, and is refused by the host instead — a different refusal,
    // from a different place.
    writeNameTooLong: () => {
        /** @type {Dir} */
        const before = { refs: { heads: {} } }
        /** @type {(extra: number) => readonly number[]} */
        const named = extra => [
            ...latin1('refs/heads/'),
            ...Array.from({ length: Number(maxLengthBytes) - 11 + extra }, () => 0x61),
        ]
        const [fs, r] = ran(before, tryWrite(one(''), 20)(named(1))(idOf(a)))
        assertEq(writeRefusal(r).code, unspellableNameCode)
        assertStructurallySame(fs, before)
        assertEq(run(before, tryResolve(one(''), 20)(named(1))), null)
        // The control: one byte *under* the bound converts, so the length test is
        // the only thing the case above can be catching. The write goes through,
        // because this runner has no length limit of its own — measured, a host
        // refuses this ref at 251 bytes, not 256, since the `.lock` costs five
        // (`../../../effects/node/virtual/todo/no-name-length-limit.md`).
        const [grown, ok1] = ran(before, tryWrite(one(''), 20)(named(0))(idOf(a)))
        assertEq(ok1[0], 'ok')
        // and it is readable back under that name, so the write landed rather
        // than merely not refusing
        assertStructurallySame(run(grown, tryResolve(one(''), 20)(named(0))), idOf(a))
    },
    // A packed name that is a directory prefix of the name being written, and the
    // other way round. `git update-ref` refuses both — measured on 2.43.0, with
    // `refs/heads/a` packed it exits 128 with `'refs/heads/a' exists; cannot
    // create 'refs/heads/a/b'`, and with `refs/heads/c/d` packed the same
    // command on `refs/heads/c` exits 128 the other way round — and no
    // filesystem answer can stand in for the check, because the packed name has
    // no loose file for the `mkdir` or the `rename` to trip over.
    //
    // The second direction is the one that does harm rather than only differing
    // from Git's policy: with `refs/heads/c/d` packed and a loose `refs/heads/c`
    // beside it, `git rev-parse refs/heads/c/d` answers `ambiguous argument …
    // unknown revision`, because the loose *file* stands where the path's
    // directory would be. `show-ref` still lists it, so a name that resolved
    // before the write does not resolve after it and nothing said so.
    writePackedPrefix: () => {
        const refuses = /** @type {(root: Dir, name: string, message: string) => void} */ (
            (root, name, message) => {
                const [fs, r] = wrote(root, name, b)
                const e = writeRefusal(r)
                assertEq(e.code, refPrefixCode)
                assertEq(e.message, message)
                assertStructurallySame(fs, root)
            })
        // Each fixture holds a lock of the name being written, belonging to
        // another writer, and `refuses` compares the whole filesystem — so a
        // cleanup that reached back past the exclusive write would delete it and
        // fail here. A revision of `unlocked` wrapped the whole sequence and did
        // exactly that.
        refuses(
            { 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: { a: { 'b.lock': [] } } } },
            'refs/heads/a/b',
            'refs/heads/a exists; cannot create refs/heads/a/b')
        refuses(
            { 'packed-refs': file(`${a} refs/heads/c/d\n`), refs: { heads: { 'c.lock': [] } } },
            'refs/heads/c',
            'refs/heads/c/d exists; cannot create refs/heads/c')
        // Three controls, because a check written over text rather than over
        // segments passes the two cases above and fails all of these.
        //
        // A packed name that is a *string* prefix and no directory prefix: the
        // byte after it is not the separator.
        const [wider] = wrote({ 'packed-refs': file(`${a} refs/heads/ab\n`), refs: { heads: {} } }, 'refs/heads/a', b)
        assertStructurallySame(wider, { 'packed-refs': file(`${a} refs/heads/ab\n`), refs: { heads: { a: ref(b) } } })
        // The same name, which is an update of a packed-only ref and what Git
        // does too: measured, `update-ref` writes the loose file and leaves the
        // packed line stale.
        const [same] = wrote({ 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: {} } }, 'refs/heads/a', b)
        assertStructurallySame(same, { 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: { a: ref(b) } } })
        // And a packed name with the separator in the right place but different
        // bytes before it, which is the third way the test can be got wrong.
        const q = { 'packed-refs': file(`${a} refs/heads/q\n`), refs: { tags: {} } }
        const [other] = wrote(q, 'refs/tags/qq/r', b)
        assertStructurallySame(other, { ...q, refs: { tags: { qq: { r: ref(b) } } } })
    },
    // A `packed-refs` that will not parse leaves the prefix question above
    // unanswerable, so the write is refused rather than made anyway. Git refuses
    // it too, measured with a control: with one junk line in the file,
    // `git update-ref refs/heads/n <id>` exits 128 with `unexpected line in
    // .git/packed-refs` and writes nothing, while the identical write against a
    // well-formed `packed-refs` exits 0 and writes the file.
    // The lock in this fixture is another writer's, and the comparison below is
    // what says this refusal leaves it alone: the refusal happens before the
    // exclusive write, so the cleanup must not reach it.
    writeBadPacked: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file('this is not a packed-refs file\n'),
            refs: { heads: { 'master.lock': [] } },
        }
        const [fs, r] = wrote(root, 'refs/heads/master', a)
        const e = writeRefusal(r)
        assertEq(e.code, badPackedCode)
        assertEq(e.message, 'packed-refs is no packed-refs')
        assertStructurallySame(fs, root)
    },
    // The file is the id's hex digits and an LF, which is `oidBytes * 2 + 1`
    // bytes and not a fixed 41 — measured, a repository created with
    // `git init --object-format=sha256` has a 65-byte `refs/heads/x` after
    // `git update-ref`. This writes the same sixty-four-digit id
    // `writeRefuses` refuses at `oidBytes` 20, and here it is the repository's
    // own width and the write succeeds. Without this the doc's claim to support
    // both widths would rest on reading the code.
    writeSha256: () => {
        const [fs, r] = ran({}, tryWrite(one(''), 32)(latin1('refs/heads/master'))(idOf(wide)))
        assertStructurallySame(r, ok(undefined))
        assertStructurallySame(fs, { refs: { heads: { master: ref(wide) } } })
        // and the lookup at the same width reads it back
        const got = run(fs, tryResolve(one(''), 32)(latin1('refs/heads/master')))
        assert(got !== null)
        assertEq(codePointListToString(toHex(got)), wide)
        // The same repository read as a SHA-1 one answers nothing, which is what
        // makes the width the repository's: sixty-five bytes is no 41-byte ref.
        assertEq(run(fs, tryResolve(one(''), 20)(latin1('refs/heads/master'))), null)
    },
    // **An error is never evidence that the lock is this writer's**, and this is
    // the case that says so: a failure of the exclusive write that is *not*
    // `EEXIST` must still leave the lock alone, because the write may never have
    // reached the name at all.
    //
    // `EMFILE` is the measured one. On node 22.22.2 with the process out of file
    // descriptors, a `wx` open of a name another writer holds answers `EMFILE`
    // and not `EEXIST` — checked by exhausting them and trying it, against the
    // same call with descriptors available, which answers `EEXIST`. So a cleanup
    // that treated `EEXIST` as the only "not mine" would unlink a live lock here.
    // The virtual filesystem cannot run out of descriptors, so the host below
    // answers what one does.
    writeNotMineOnAnyError: () => {
        /** @type {MemOperationMap<ReadWhole | Stat | Mkdir | WriteExclusive | Rename | Rm, readonly string[]>} */
        const host = {
            // no `packed-refs`, so there is no prefix collision to refuse
            readWhole: missing,
            // and nothing at the ref's path, so no directory bars it either
            stat: missing,
            mkdir: (path, _) => log => [[...log, `mkdir ${path}`], ok(undefined)],
            writeExclusive: path => log => [
                [...log, `writeExclusive ${path}`],
                error(ioError({ code: 'EMFILE', message: path })),
            ],
            rename: (src, dst) => log => [[...log, `rename ${src} ${dst}`], ok(undefined)],
            rm: path => log => [[...log, `rm ${path}`], ok(undefined)],
        }
        const [log, r] = mockRun(host)(/** @type {readonly string[]} */ ([]))(
            tryWrite(one(''), 20)(latin1('refs/heads/master'))(idOf(a)))
        assertEq(writeRefusal(r).code, 'EMFILE')
        // the write was attempted and nothing was removed or published
        assert(log.includes('writeExclusive refs/heads/master.lock'), log)
        assert(!log.some(l => l.startsWith('rm ')), log)
        assert(!log.some(l => l.startsWith('rename ')), log)
    },
    // A loose ref, its reflog beside it, and a second ref as the control: the name
    // goes, its reflog goes, and nothing else changes — no lock is left, which the
    // comparison of the whole tree says.
    deleteLoose: () => {
        /** @type {Dir} */
        const root = {
            refs: { heads: { master: ref(a), other: ref(b) } },
            logs: { refs: { heads: { master: file('m\n'), other: file('o\n') } } },
        }
        const [fs, r] = deleted(root, 'refs/heads/master')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, {
            refs: { heads: { other: ref(b) } },
            logs: { refs: { heads: { other: file('o\n') } } },
        })
        assertEq(resolved(fs, 'refs/heads/master'), null)
        assertEq(hexOf(fs, 'refs/heads/other'), b)
        // Again: no ref of that name, so `false`, and the repository as it was —
        // both locks were taken and given back. Git exits 0 for both, measured.
        const [again, r2] = deleted(fs, 'refs/heads/master')
        assertStructurallySame(r2, ok(false))
        assertStructurallySame(again, fs)
    },
    // A packed-only ref: its line goes and every other byte stays, the tag's `^`
    // line included — measured on 2.43.0, byte-identical to what
    // `git update-ref -d` leaves. The last ref out leaves the header alone, which
    // Git leaves too, rather than no file.
    deletePacked: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file(`${header}${a} refs/heads/master\n${b} refs/heads/other\n${t} refs/tags/v1\n^${a}\n`),
            refs: { heads: {}, tags: {} },
        }
        const [fs, r] = deleted(root, 'refs/heads/master')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, {
            'packed-refs': file(`${header}${b} refs/heads/other\n${t} refs/tags/v1\n^${a}\n`),
            refs: { heads: {}, tags: {} },
        })
        const [fewer] = deleted(fs, 'refs/heads/other')
        const [none, r2] = deleted(fewer, 'refs/tags/v1')
        assertStructurallySame(r2, ok(true))
        assertStructurallySame(none, { 'packed-refs': file(header), refs: { heads: {}, tags: {} } })
    },
    // Loose and packed at once, at different ids: both go, and the name resolves
    // to nothing — not to the stale packed id, which is what deleting the loose
    // file alone would leave as the ref.
    deleteShadowed: () => {
        assertEq(hexOf(shadowed, 'refs/heads/master'), a)
        const [fs, r] = deleted(shadowed, 'refs/heads/master')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, {
            'packed-refs': file(`${header}${a} refs/heads/other\n${t} refs/tags/v1\n^${a}\n`),
            refs: { heads: {} },
        })
        assertEq(resolved(fs, 'refs/heads/master'), null)
    },
    // The name itself, never what it points to: `git update-ref --no-deref -d`.
    // Without `--no-deref` Git deletes the target and leaves the symbolic ref
    // dangling, measured, and `git fsck` exits 2 over it.
    deleteSymbolic: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { master: ref(a), sym: file('ref: refs/heads/master\n') } } }
        const [fs, r] = deleted(root, 'refs/heads/sym')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, { refs: { heads: { master: ref(a) } } })
    },
    // The directories a name leaves empty go with it, below `refs/` and `logs/`,
    // down to `refs/<top>/` and no further. Measured on 2.43.0: Git creates
    // `refs/heads/feat/deep` to hold the lock of a packed-only
    // `refs/heads/feat/deep/x` and removes it again, and removes
    // `logs/refs/heads/feat` with the reflog; deleting the last ref under
    // `refs/remotes/origin` removes that directory and keeps `refs/remotes`.
    deleteNested: () => {
        /** @type {Dir} */
        const root = {
            'packed-refs': file(`${header}${a} refs/heads/feat/deep/x\n${a} refs/heads/master\n`),
            refs: {
                heads: { master: ref(b), a: { x: ref(a), y: ref(b) } },
                remotes: { origin: { main: ref(a) } },
            },
            logs: {
                refs: {
                    heads: { feat: { deep: { x: file('l\n') } }, master: file('l\n') },
                    remotes: { origin: { main: file('l\n') } },
                },
            },
        }
        const [deep, r] = deleted(root, 'refs/heads/feat/deep/x')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(deep, {
            'packed-refs': file(`${header}${a} refs/heads/master\n`),
            refs: root.refs,
            logs: { refs: { heads: { master: file('l\n') }, remotes: { origin: { main: file('l\n') } } } },
        })
        const [remote] = deleted(deep, 'refs/remotes/origin/main')
        assertStructurallySame(remote, {
            'packed-refs': file(`${header}${a} refs/heads/master\n`),
            refs: { heads: { master: ref(b), a: { x: ref(a), y: ref(b) } }, remotes: {} },
            logs: { refs: { heads: { master: file('l\n') }, remotes: {} } },
        })
        // A sibling keeps its directory, and the last ref of `refs/heads` leaves
        // `refs/heads` itself, empty, where Git leaves it.
        const [sibling] = deleted(remote, 'refs/heads/a/x')
        const [last] = deleted(sibling, 'refs/heads/a/y')
        const [gone] = deleted(last, 'refs/heads/master')
        assertStructurallySame(sibling.refs, { heads: { master: ref(b), a: { y: ref(b) } }, remotes: {} })
        assertStructurallySame(gone, {
            'packed-refs': file(header),
            refs: { heads: {}, remotes: {} },
            logs: { refs: { heads: {}, remotes: {} } },
        })
    },
    // A per-worktree name is the worktree's: its file and reflog below `wt`, its
    // lock beside them — and `packed-refs.lock` in the shared directory, which is
    // the one `packed-refs` lives in. The lock held there refuses the delete, so
    // the case would fail for a delete that took it anywhere else.
    deleteWorktree: () => {
        /** @type {Dirs} */
        const dirs = { gitdir: 'wt', common: 'repo' }
        /** @type {Dir} */
        const root = {
            wt: { refs: { bisect: { bad: ref(a) } }, logs: { refs: { bisect: { bad: file('l\n') } } } },
            repo: { 'packed-refs': file(`${header}${b} refs/heads/master\n`), refs: { heads: {} } },
        }
        const [own, r] = ran(root, tryDelete(dirs, 20)(latin1('refs/bisect/bad')))
        assertStructurallySame(r, ok(true))
        assertStructurallySame(own, {
            wt: { refs: { bisect: {} }, logs: { refs: { bisect: {} } } },
            repo: root.repo,
        })
        const [shared] = ran(root, tryDelete(dirs, 20)(latin1('refs/heads/master')))
        assertStructurallySame(shared, {
            wt: root.wt,
            repo: { 'packed-refs': file(header), refs: { heads: {} } },
        })
        /** @type {Dir} */
        const held = { ...root, repo: { ...root.repo, 'packed-refs.lock': [] } }
        const [fs, refused] = ran(held, tryDelete(dirs, 20)(latin1('refs/bisect/bad')))
        assertEq(writeRefusal(refused).code, 'EEXIST')
        assertStructurallySame(fs, held)
    },
    // Either lock held by another writer refuses the delete, and leaves the
    // repository exactly as it was: that lock where it is, and — for the second —
    // the ref lock this delete had taken given back.
    deleteLockHeld: () => {
        const packed = file(`${header}${a} refs/heads/master\n`)
        /** @type {Dir} */
        const refLocked = { 'packed-refs': packed, refs: { heads: { master: ref(a), 'master.lock': [] } } }
        const [fs1, r1] = deleted(refLocked, 'refs/heads/master')
        assertEq(writeRefusal(r1).code, 'EEXIST')
        assertStructurallySame(fs1, refLocked)
        /** @type {Dir} */
        const packedLocked = { 'packed-refs': packed, 'packed-refs.lock': [], refs: { heads: { master: ref(a) } } }
        const [fs2, r2] = deleted(packedLocked, 'refs/heads/master')
        assertEq(writeRefusal(r2).code, 'EEXIST')
        assertStructurallySame(fs2, packedLocked)
        // And a `packed-refs.new` already there, which is another writer's while
        // this one holds `packed-refs.lock`: refused and left, not removed.
        /** @type {Dir} */
        const staged = { 'packed-refs': packed, 'packed-refs.new': file('x\n'), refs: { heads: { master: ref(a) } } }
        const [fs3, r3] = deleted(staged, 'refs/heads/master')
        assertEq(writeRefusal(r3).code, 'EEXIST')
        assertStructurallySame(fs3, staged)
    },
    // A directory at the name's path: refs sit under the name, so it is no ref to
    // delete, and Git refuses too — measured on 2.43.0, with `refs/heads/a/b`
    // there and `refs/heads/a` packed, `git update-ref -d refs/heads/a` exits 1
    // with `'refs/heads/a/b' exists; cannot create 'refs/heads/a'` and changes
    // nothing. The packed line stays with it.
    //
    // An *empty* directory is refused too, where Git removes it and exits 0:
    // narrower, and the same narrowness the write has.
    deleteRefIsADirectory: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file(`${a} refs/heads/a\n`), refs: { heads: { a: { b: ref(b) } } } }
        const [fs, r] = deleted(root, 'refs/heads/a')
        const e = writeRefusal(r)
        assertEq(e.code, refPrefixCode)
        assertEq(e.message, 'refs/heads/a is a directory; cannot delete it')
        assertStructurallySame(fs, root)
        /** @type {Dir} */
        const empty = { refs: { heads: { e: {} } } }
        const [fs2, r2] = deleted(empty, 'refs/heads/e')
        assertEq(writeRefusal(r2).code, refPrefixCode)
        assertStructurallySame(fs2, empty)
    },
    // A file where one of the name's directories would be: the `stat` answers
    // `ENOTDIR`, before anything is created. Git refuses it too, being unable to
    // make the directory its lock goes in.
    deleteLooseIsAFile: () => {
        /** @type {Dir} */
        const root = { refs: { heads: { a: ref(b) } } }
        const [fs, r] = deleted(root, 'refs/heads/a/b')
        assertEq(writeRefusal(r).code, 'ENOTDIR')
        assertStructurallySame(fs, root)
    },
    // The name refusals are `tryWrite`'s, and come before any effect.
    //
    // `HEAD` is the one that matters: measured on 2.43.0,
    // `git update-ref --no-deref -d HEAD` exits 0 having removed `.git/HEAD`, and
    // every Git command then answers `not a git repository`.
    deleteRefuses: () => {
        /** @type {Dir} */
        const root = { HEAD: file('ref: refs/heads/master\n'), refs: { heads: { master: ref(a) } } }
        /** @type {(name: readonly number[], code: string) => IoErrorInfo} */
        const refuses = (name, code) => {
            const [fs, r] = ran(root, tryDelete(one(''), 20)(name))
            const e = writeRefusal(r)
            assertEq(e.code, code)
            assertStructurallySame(fs, root)
            return e
        }
        for (const n of ['refs/heads/x.lock', 'refs/heads/a..b', 'refs/../secret']) {
            refuses(latin1(n), badNameCode)
        }
        for (const n of ['HEAD', 'FETCH_HEAD', 'a/b']) {
            refuses(latin1(n), outsideRefsCode)
        }
        assertEq(refuses(latin1('HEAD'), outsideRefsCode).message, 'HEAD is not under refs/')
        refuses([...latin1('refs/heads/'), 0x80], unspellableNameCode)
    },
    // A `packed-refs` Git would refuse is refused here too, before anything is
    // removed — the loose file included, since without the packed file's answer
    // the delete cannot know whether a line would come back as the ref.
    deleteBadPacked: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file('this is not a packed-refs file\n'), refs: { heads: { master: ref(a) } } }
        const [fs, r] = deleted(root, 'refs/heads/master')
        const e = writeRefusal(r)
        assertEq(e.code, badPackedCode)
        assertEq(e.message, 'packed-refs is no packed-refs')
        assertStructurallySame(fs, root)
    },
    // A `packed-refs` that claims `sorted` and is not: Git bisects it and misses
    // lines, and which ones depends on where the others sit — so removing a line
    // can lose Git another. Refused and left as it was, whichever name is asked
    // about, including one the file does not hold.
    deleteUnsorted: () => {
        const lines = `${a} refs/heads/z\n${b} refs/heads/a\n`
        /** @type {Dir} */
        const root = { 'packed-refs': file(`${header}${lines}`), refs: { heads: {} } }
        for (const n of ['refs/heads/a', 'refs/heads/q']) {
            const [fs, r] = deleted(root, n)
            const e = writeRefusal(r)
            assertEq(e.code, unsortedPackedCode)
            assertEq(e.message, 'packed-refs claims to be sorted and is not')
            assertStructurallySame(fs, root)
        }
        // The control: the same lines under a header that makes no such claim are
        // a file Git scans, and the delete goes through.
        const unclaimed = '# pack-refs with: peeled fully-peeled \n'
        const [fs, r] = deleted({ 'packed-refs': file(`${unclaimed}${lines}`), refs: { heads: {} } }, 'refs/heads/a')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, { 'packed-refs': file(`${unclaimed}${a} refs/heads/z\n`), refs: { heads: {} } })
    },
    // A name packed twice loses both lines. Git removes one, measured — and exits
    // 0 with the ref still resolvable at the other.
    deletePackedTwice: () => {
        /** @type {Dir} */
        const root = { 'packed-refs': file(`${header}${a} refs/heads/m\n${b} refs/heads/m\n`), refs: { heads: {} } }
        const [fs, r] = deleted(root, 'refs/heads/m')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(fs, { 'packed-refs': file(header), refs: { heads: {} } })
        assertEq(resolved(fs, 'refs/heads/m'), null)
    },
    // A `packed-refs` larger than one `Vec`, which is about 1,870 refs: read in
    // windows and written back in chunks, each as long as a `Vec` may be.
    deleteBigPacked: () => {
        /** @type {(i: number) => string} */
        const line = i => `${a} refs/heads/topic/feature-${String(i).padStart(4, '0')}\n`
        const all = Array.from({ length: 2000 }, (_, i) => line(i))
        const before = latin1(`${header}${all.join('')}`)
        assert(before.length > Number(maxLengthBytes), before.length)
        const [fs, r] = deleted({ 'packed-refs': chunksOf(before), refs: { heads: {} } }, 'refs/heads/topic/feature-1000')
        assertStructurallySame(r, ok(true))
        const after = latin1(`${header}${all.filter((_, i) => i !== 1000).join('')}`)
        assertStructurallySame(fs, { 'packed-refs': chunksOf(after), refs: { heads: {} } })
        assertEq(resolved(fs, 'refs/heads/topic/feature-1000'), null)
        assertEq(hexOf(fs, 'refs/heads/topic/feature-1999'), a)
    },
    // Every effect of a delete, in order, and what a failure of each leaves: which
    // cleanups run, and which removals do not. The host answers `EIO` for the one
    // line named and `ok` for the rest; `refs` and `refs/heads` are there and
    // `refs/heads/a` is not, and the loose file, the packed line and the reflog
    // all are.
    //
    // Four rules are what this holds:
    //
    // - a lock or a staged file is given back only once it was taken — a failure
    //   to take it, whatever the code, removes nothing;
    // - the reflog goes after the loose file, so a delete that fails before that
    //   keeps the history of a ref that still exists;
    // - once the ref is gone, what removing the reflog, a lock or a directory
    //   answers is dropped, and the delete answers `true`;
    // - a refused delete removes the directories it made and no others, and
    //   nothing below `logs/`, where it made none.
    deleteProtocol: () => {
        /** @type {(failing: string) => MemOperationMap<Stat | Mkdir | CreateExclusive | ReadFile | ReadWhole | WriteExclusive | Rename | Rm | Rmdir, readonly string[]>} */
        const host = failing => {
            /** @type {<T>(line: string, value: T) => (log: readonly string[]) => readonly [readonly string[], Result<T, IoChannel>]} */
            const answer = (line, value) => log => [
                [...log, line],
                line === failing ? error(ioError({ code: 'EIO', message: line })) : ok(value),
            ]
            return {
                stat: path => answer(`stat ${path}`, kind(true, false)),
                mkdir: (path, _) => path === 'refs' || path === 'refs/heads'
                    ? log => [[...log, `mkdir ${path}`], error(ioError({ code: 'EEXIST', message: path }))]
                    : answer(`mkdir ${path}`, undefined),
                createExclusive: path => answer(`createExclusive ${path}`, undefined),
                readFile: path => answer(`readFile ${path}`, ref(a)[0]),
                readWhole: path => answer(`readWhole ${path}`, file(`${a} refs/heads/a/b\n`)),
                writeExclusive: path => answer(`writeExclusive ${path}`, undefined),
                rename: (src, dst) => answer(`rename ${src} ${dst}`, undefined),
                rm: path => answer(`rm ${path}`, undefined),
                rmdir: path => answer(`rmdir ${path}`, undefined),
            }
        }
        /** @type {(failing: string) => readonly [readonly string[], Result<boolean, IoChannel>]} */
        const deleting = failing => mockRun(host(failing))(/** @type {readonly string[]} */ ([]))(
            tryDelete(one(''), 20)(latin1('refs/heads/a/b')))
        const all = [
            'stat refs/heads/a/b',
            'mkdir refs',
            'mkdir refs/heads',
            'mkdir refs/heads/a',
            'createExclusive refs/heads/a/b.lock',
            'createExclusive packed-refs.lock',
            'readFile refs/heads/a/b',
            'readWhole packed-refs',
            'writeExclusive packed-refs.new',
            'rename packed-refs.new packed-refs',
            'rm refs/heads/a/b',
            'rm logs/refs/heads/a/b',
            'rm packed-refs.lock',
            'rm refs/heads/a/b.lock',
            'rmdir refs/heads/a',
            'rmdir logs/refs/heads/a',
        ]
        const [log, r] = deleting('')
        assertStructurallySame(r, ok(true))
        assertStructurallySame(log, all)
        // Failures after the ref is gone: the delete still answers `true`, and
        // every later effect still runs — the log pruning after the refs pruning
        // failed included.
        for (const late of ['rm logs/refs/heads/a/b', 'rm packed-refs.lock', 'rm refs/heads/a/b.lock', 'rmdir refs/heads/a']) {
            const [lateLog, lateR] = deleting(late)
            assertStructurallySame(lateR, ok(true))
            assertStructurallySame(lateLog, all)
        }
        /** @type {(failing: string, expected: readonly string[]) => void} */
        const fails = (failing, expected) => {
            const [failLog, failR] = deleting(failing)
            assertEq(writeRefusal(failR).message, failing)
            assertStructurallySame(failLog, expected)
        }
        // Both locks given back, and the one directory this call made removed.
        const released = ['rm packed-refs.lock', 'rm refs/heads/a/b.lock', 'rmdir refs/heads/a']
        // The loose file will not go: the packed line is gone, the file still
        // decides the name, and the reflog is kept.
        fails('rm refs/heads/a/b', [...all.slice(0, 11), ...released])
        // The rename fails: the staged file is given back, and nothing is removed.
        fails('rename packed-refs.new packed-refs', [...all.slice(0, 10), 'rm packed-refs.new', ...released])
        // The staged file cannot be made: not this writer's to remove.
        fails('writeExclusive packed-refs.new', [...all.slice(0, 9), ...released])
        fails('readWhole packed-refs', [...all.slice(0, 8), ...released])
        fails('readFile refs/heads/a/b', [...all.slice(0, 7), ...released])
        // A lock not taken is not given back.
        fails('createExclusive packed-refs.lock', [...all.slice(0, 6), ...released.slice(1)])
        fails('createExclusive refs/heads/a/b.lock', [...all.slice(0, 5), ...released.slice(2)])
        // A `mkdir` that fails: nothing after it, and nothing pruned.
        fails('mkdir refs/heads/a', all.slice(0, 4))
        fails('stat refs/heads/a/b', all.slice(0, 1))
    },
    // A loose file that is no ref refuses the delete, and nothing is removed — not
    // the file, not its reflog, not the packed line of the same name, which goes
    // first otherwise. Git refuses the same, measured on 2.43.0 with and without
    // `--no-deref`: `cannot lock ref … reference broken`, exit 1, nothing changed.
    deleteBrokenRef: () => {
        for (const bytes of ['not an id\n', '', `${a.slice(0, 7)}\n`]) {
            /** @type {Dir} */
            const root = {
                'packed-refs': file(`${header}${b} refs/heads/x\n`),
                refs: { heads: { x: file(bytes) } },
                logs: { refs: { heads: { x: file('l\n') } } },
            }
            const [fs, r] = deleted(root, 'refs/heads/x')
            const e = writeRefusal(r)
            assertEq(e.code, brokenRefCode)
            assertEq(e.message, 'refs/heads/x is no ref')
            assertStructurallySame(fs, root)
        }
        // The controls: a symbolic ref whose target is absent, and one whose target
        // is outside `refs/`, are refs, and Git deletes both — measured.
        for (const target of ['refs/heads/nothing', 'a/b']) {
            const [fs, r] = deleted({ refs: { heads: { s: file(`ref: ${target}\n`) } } }, 'refs/heads/s')
            assertStructurallySame(r, ok(true))
            assertStructurallySame(fs, { refs: { heads: {} } })
        }
    },
    // A refused delete leaves the directories as they were: one it made is
    // removed again, and one that was already there, empty, is kept — both with a
    // `packed-refs` that will not parse, which is refused under the locks, after
    // the directories were made. Found by review: pruning by the success rule on
    // both paths removed the second.
    //
    // A delete that happens removes an empty directory that was there before it,
    // which Git does too, measured on 2.43.0: with `refs/heads/a` and
    // `logs/refs/heads/a` already there and empty, deleting the packed-only
    // `refs/heads/a/b` removes both.
    deleteRefusedKeepsDirectories: () => {
        const junk = file('this is not a packed-refs file\n')
        /** @type {Dir} */
        const kept = { 'packed-refs': junk, refs: { heads: { a: {} } } }
        const [fs1, r1] = deleted(kept, 'refs/heads/a/b')
        assertEq(writeRefusal(r1).code, badPackedCode)
        assertStructurallySame(fs1, kept)
        /** @type {Dir} */
        const bare = { 'packed-refs': junk, refs: { heads: {} } }
        const [fs2, r2] = deleted(bare, 'refs/heads/c/d')
        assertEq(writeRefusal(r2).code, badPackedCode)
        assertStructurallySame(fs2, bare)
        /** @type {Dir} */
        const empty = {
            'packed-refs': file(`${header}${a} refs/heads/a/b\n`),
            refs: { heads: { a: {} } },
            logs: { refs: { heads: { a: {} } } },
        }
        const [fs3, r3] = deleted(empty, 'refs/heads/a/b')
        assertStructurallySame(r3, ok(true))
        assertStructurallySame(fs3, { 'packed-refs': file(header), refs: { heads: {} }, logs: { refs: { heads: {} } } })
    },
}
