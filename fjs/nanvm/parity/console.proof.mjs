/**
 * The Node host's half of the console parity corpus. `nanvm/harness/fixtures/console.mjs`
 * holds programs that read standard input and write standard output and error;
 * here each runs in a child process (`console-child.mjs`) that is given the
 * case's input and whose output is held. The answers and the bytes written must
 * be what the case says, as `nanvm/harness/tests/console.rs` has the native host
 * do over buffers.
 */

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertEq } from '../../asserts/module.f.js'
import { withTemporary } from '../../effects/node/testlib.mjs'
import * as console_ from '../../../nanvm/harness/fixtures/console.mjs'

// A path for the platform, not the URL's `pathname`, which is `/C:/...` on Windows
// and percent-encoded where a name has spaces.
const child = fileURLToPath(new URL('./console-child.mjs', import.meta.url))

// `node` is named rather than `process.execPath`: under Deno and Bun that path is
// their own binary, which would run the Node reference without the permissions
// the child needs, and the reference host is Node.
/** @type {(name: string, input: readonly number[], file: string) => Promise<{ stdout: Buffer, stderr: Buffer }>} */
const perform = (name, input, file) => new Promise((resolve, reject) => {
    const p = spawn('node', [child, name, file])
    /** @type {Buffer[]} */
    const out = []
    /** @type {Buffer[]} */
    const err = []
    p.stdout.on('data', d => out.push(d))
    p.stderr.on('data', d => err.push(d))
    p.on('error', reject)
    p.on('close', code => code === 0
        ? resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err) })
        : reject(new Error(`${name} exited ${code}: ${Buffer.concat(err)}`)))
    p.stdin.end(Buffer.from(input))
})

/** @type {(name: string, c: { readonly input: readonly number[], readonly expected: unknown, readonly stdout: readonly number[], readonly stderr: readonly number[] }) => Promise<void>} */
const check = (name, { input, expected, stdout, stderr }) => withTemporary(`nanvm-console-${name}-`, async directory => {
    const file = join(directory, 'answers.json')
    const written = await perform(name, input, file)
    const [tag, answers] = JSON.parse(await readFile(file, 'utf8'))
    assertEq(tag, 'ok', name)
    assertEq(JSON.stringify(answers), JSON.stringify(expected), name)
    assertEq(JSON.stringify([...written.stdout]), JSON.stringify(stdout), name)
    assertEq(JSON.stringify([...written.stderr]), JSON.stringify(stderr), name)
})

export const proof = Object.fromEntries(
    Object.entries(console_).map(([name, c]) => [name, () => check(name, c)]))
