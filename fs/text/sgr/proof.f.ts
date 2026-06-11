import { fgRed, reset, createConsoleText, backspace, csiWrite } from './module.f.ts'
import { virtual, emptyState } from '../../effects/node/virtual/module.f.ts'
import type { NodeProgramOptions } from '../../effects/node/module.f.ts'

const makeOptions = (isTTY: boolean): NodeProgramOptions => ({
    args: [],
    env: {},
    std: { stdout: { isTTY }, stderr: { isTTY } },
    testContext: { test: async () => {} },
    bunTestContext: { test: async () => {} },
    playwrightTestContext: { test: async () => {} },
    engine: 'node',
})

export const proof = [
    () => {
        if (fgRed !== '\x1b[31m') {
            throw new Error('Test failed: sgr(0)')
        }
    },
    () => {
        const output: string[] = []
        const stdout = { write: (s: string) => { output.push(s) } }
        const writer1 = createConsoleText(stdout)
        const writer2 = writer1('hello')
        if (output[0] !== 'hello') { throw output[0] }
        // replacing 'hello' (len=5) with 'hi' (len=2): suffixLength=3
        writer2('hi')
        const expected = backspace.repeat(5) + 'hi' + ' '.repeat(3) + backspace.repeat(3)
        if (output[1] !== expected) { throw output[1] }
    },
    () => {
        // csiWrite with isTTY=false strips ANSI SGR sequences
        const writeFn = csiWrite(makeOptions(false))('stdout')
        const [state] = virtual(emptyState)(writeFn(fgRed + 'hello' + reset))
        if (state.stdout !== 'hello') { throw ['expected ANSI stripped', state.stdout] }
    },
    () => {
        // csiWrite with isTTY=true preserves ANSI SGR sequences
        const writeFn = csiWrite(makeOptions(true))('stdout')
        const [state] = virtual(emptyState)(writeFn(fgRed + 'hello' + reset))
        const expected = fgRed + 'hello' + reset
        if (state.stdout !== expected) { throw ['expected ANSI preserved', state.stdout] }
    },
]
