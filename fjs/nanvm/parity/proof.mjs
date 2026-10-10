/**
 * The Node host's half of the parity corpus. `nanvm-harness/fixtures/parity.mjs`
 * holds programs that do file operations inside a directory they are given;
 * here the Node runner performs each in a fresh directory, and the answers
 * must be the `expected` the case carries. `nanvm-harness/tests/parity.rs`
 * performs the same programs on `nanvm-effects-node` against the same
 * `expected`, so the two hosts agree through it.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertEq } from '../../asserts/module.f.mjs'
import { runNodeEffect } from '../../effects/node/module.mjs'
import * as parity from '../../../nanvm-harness/fixtures/parity.mjs'

/** @type {(name: string) => (c: { readonly run: (root: string) => any, readonly expected: unknown }) => Promise<void>} */
const perform = name => async ({ run, expected }) => {
    const root = await mkdtemp(join(tmpdir(), `nanvm-parity-${name}-`))
    try {
        const [tag, answers] = await runNodeEffect(run(root))
        assertEq(tag, 'ok', name)
        assertEq(JSON.stringify(answers), JSON.stringify(expected), name)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

export const proof = Object.fromEntries(
    Object.entries(parity).map(([name, c]) => [name, () => perform(name)(c)]))
