import { fgRed, createConsoleText, backspace } from './module.f.ts'

export default [
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
    }
]
