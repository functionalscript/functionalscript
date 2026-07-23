import { fgRed, reset, createConsoleText, backspace, csiWrite } from './module.f.ts'
import { virtual, emptyState, defaultNodeProgramOptions } from '../../effects/node/virtual/module.f.ts'
import type { NodeProgramOptions } from '../../effects/node/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

const makeOptions = (isTTY: boolean): NodeProgramOptions =>
    ({ ...defaultNodeProgramOptions, std: { stdout: { isTTY }, stderr: { isTTY } } })

export const proof = [
    () => {
        assertEq(fgRed, '\x1b[31m', new Error('Test failed: sgr(0)'))
    },
    () => {
        const output: string[] = []
        const stdout = { write: (s: string) => { output.push(s) } }
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
        const writeFn = csiWrite(makeOptions(false))('stdout')
        const [state] = virtual(emptyState)(writeFn(fgRed + 'hello' + reset))
        assertEq(state.stdout, 'hello', ['expected ANSI stripped', state.stdout])
    },
    () => {
        // csiWrite with isTTY=true preserves ANSI SGR sequences
        const writeFn = csiWrite(makeOptions(true))('stdout')
        const [state] = virtual(emptyState)(writeFn(fgRed + 'hello' + reset))
        const expected = fgRed + 'hello' + reset
        assertEq(state.stdout, expected, ['expected ANSI preserved', state.stdout])
    },
]
