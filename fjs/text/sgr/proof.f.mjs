/**
 * @import { Std, Write } from '../../effects/common/types.ts'
 * @import { RunInstance } from '../../effects/mock/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { fgRed, reset, bold, sgr, csiWrite, stripSgr } from './module.f.mjs'
import { run as mockRun } from '../../effects/mock/module.f.mjs'
import { utf8ToString } from '../module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

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
        // csiWrite with isTTY=false strips ANSI SGR sequences
        const writeFn = csiWrite(makeStd(false))('stdout')
        const [written] = runner('')(writeFn(fgRed + 'hello' + reset))
        assertEq(written, 'hello', ['expected ANSI stripped', written])
    },
    () => {
        // stripSgr removes SGR sequences and keeps everything else
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['', ''],
            ['plain', 'plain'],
            [fgRed + 'red' + reset + ' text', 'red text'],
            [bold + fgRed + 'x' + reset + reset, 'x'],
            [sgr('1;31') + 'x' + sgr(''), 'x'],
            ['a\x1bb', 'a\x1bb'],
            ['a\x1b', 'a\x1b'],
            ['a\x1b[1', 'a\x1b[1'],
            ['a\x1b[1K', 'a\x1b[1K'],
            ['\x1b\x1b[1m', '\x1b'],
        ]
        for (const [input, expected] of cases) {
            assertEq(stripSgr(input), expected, ['stripSgr', input])
        }
    },
    () => {
        // csiWrite with isTTY=true preserves ANSI SGR sequences
        const writeFn = csiWrite(makeStd(true))('stdout')
        const [written] = runner('')(writeFn(fgRed + 'hello' + reset))
        const expected = fgRed + 'hello' + reset
        assertEq(written, expected, ['expected ANSI preserved', written])
    },
]
