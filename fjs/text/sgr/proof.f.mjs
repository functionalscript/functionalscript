/**
 * @import { Std, Write } from '../../effects/common/types.ts'
 * @import { RunInstance } from '../../effects/mock/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { fgRed, reset, createConsoleText, backspace, csiWrite } from './module.f.mjs'
import { run as mockRun } from '../../effects/mock/module.f.mjs'
import { utf8ToString } from '../module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'

/** @type {(isTTY: boolean) => Std} */
const makeStd = isTTY => ({ stdout: { isTTY }, stderr: { isTTY } })

// A runner that claims `write` and nothing else. An ANSI helper needs somewhere
// for its bytes to land, not a host: taking the node runner for that was the
// same coupling this module just shed, one directory over.
/** @type {RunInstance<Write, string>} */
const runner = mockRun(/** @type {Parameters<typeof mockRun<Write, string>>[0]} */ ({
    write: (/** @type {'stdout' | 'stderr'} */ _stream, /** @type {Vec} */ data) =>
        (/** @type {string} */ written) => [written + utf8ToString(data), ok(undefined)],
}))

export const proof = [
    () => {
        assertEq(fgRed, '\x1b[31m', new Error('Test failed: sgr(0)'))
    },
    () => {
        /** @type {string[]} */
        const output = []
        const stdout = { write: (/** @type {string} */ s) => { output.push(s) } }
        const writer1 = createConsoleText(stdout)
        const writer2 = writer1('hello')
        assert(output[0] === 'hello')
        // replacing 'hello' (len=5) with 'hi' (len=2): suffixLength=3
        writer2('hi')
        const expected = backspace.repeat(5) + 'hi' + ' '.repeat(3) + backspace.repeat(3)
        assertEq(output[1], expected)
    },
    () => {
        // csiWrite with isTTY=false strips ANSI SGR sequences
        const writeFn = csiWrite(makeStd(false))('stdout')
        const [written] = runner('')(writeFn(fgRed + 'hello' + reset))
        assertEq(written, 'hello', ['expected ANSI stripped', written])
    },
    () => {
        // csiWrite with isTTY=true preserves ANSI SGR sequences
        const writeFn = csiWrite(makeStd(true))('stdout')
        const [written] = runner('')(writeFn(fgRed + 'hello' + reset))
        const expected = fgRed + 'hello' + reset
        assertEq(written, expected, ['expected ANSI preserved', written])
    },
]
