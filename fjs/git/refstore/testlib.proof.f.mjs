/**
 * The proof of [`testlib.f.mjs`](./testlib.f.mjs)'s functions, beside it for the
 * reason [`../testlib.proof.f.mjs`](../testlib.proof.f.mjs) gives: the fixtures
 * are one file rather than one more directory. Every one of them is also used by
 * the two proofs they were written for, which is where what they are is checked
 * against Git; this is what they are on their own.
 *
 * No `@module`: a proof's documentation reaches no reader of the published API.
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { mkdir } from '../../effects/node/module.f.mjs'
import { u8ListToVecMsb } from '../../types/bit_vec/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { latin1 } from '../testlib.f.mjs'
import { a, file, hexOf, kind, missing, one, ran, ref, resolved, run, shadowed } from './testlib.f.mjs'

export const proof = {
    // A main worktree names one directory twice.
    one: () => {
        assertStructurallySame(one('repo'), { gitdir: 'repo', common: 'repo' })
    },
    // A file is its bytes in one `Vec`, and a ref file is an id and an LF.
    file: () => {
        assertStructurallySame(file('x\n'), [u8ListToVecMsb(latin1('x\n'))])
        assertStructurallySame(ref(a), file(`${a}\n`))
    },
    // `ran` answers the directory left behind and the result; `run` the value.
    ran: () => {
        const [root, r] = ran({}, mkdir('d'))
        assertStructurallySame(root, { d: {} })
        assertStructurallySame(r, ok(undefined))
        assertEq(run({}, mkdir('d')), undefined)
    },
    // `shadowed` resolves to the loose id and not the packed one, which is what
    // makes it a shadow; `resolved` answers `null` for a name it does not hold.
    resolved: () => {
        assertEq(hexOf(shadowed, 'refs/heads/master'), a)
        assertEq(hexOf(shadowed, 'refs/heads/other'), a)
        assertEq(resolved(shadowed, 'refs/heads/none'), null)
    },
    // A handler that answers `ENOENT`, leaving the state as it was.
    missing: () => {
        const [state, r] = missing('p')(7)
        assertEq(state, 7)
        assert(r[0] === 'error' && r[1][0] === 'ioError' && r[1][1].code === 'ENOENT', r)
    },
    kind: () => {
        assertStructurallySame(kind(true, false), { size: 41, isFile: true, isDirectory: false })
    },
}
