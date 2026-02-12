import {
    backspace,
    csi,
    sgr,
    reset,
    bold,
    fgRed,
    fgGreen,
    createConsoleText,
    console,
    stdio,
    stderr,
} from './module.f.ts'

export default {
    codes: () => {
        if (backspace !== '\x08') { throw 'backspace' }
        if (csi('m')(31) !== '\x1b[31m') { throw 'csi-number' }
        if (csi('m')('1;32') !== '\x1b[1;32m') { throw 'csi-string' }
        if (sgr(0) !== '\x1b[0m') { throw 'sgr' }
        if (reset !== '\x1b[0m') { throw 'reset' }
        if (bold !== '\x1b[1m') { throw 'bold' }
        if (fgRed !== '\x1b[31m') { throw 'fgRed' }
        if (fgGreen !== '\x1b[32m') { throw 'fgGreen' }
    },
    createConsoleText: () => {
        let output = ''
        const write = createConsoleText({
            write: (s: string) => {
                output += s
            },
        })

        const next = write('ab')
        if (output !== 'ab') { throw output }

        output = ''
        next('a')
        if (output !== `${backspace}${backspace}a ${backspace}`) { throw output }
    },
    ttyConsole: () => {
        let output = ''
        const writeLine = console({
            fs: {
                writeSync: (_fd: number, s: string) => {
                    output = s
                },
            },
        } as any)({ fd: 7, isTTY: true })

        writeLine('\x1b[31mred\x1b[0m')
        if (output !== '\x1b[31mred\x1b[0m\n') { throw output }
    },
    nonTtyConsole: () => {
        let output = ''
        const writeLine = console({
            fs: {
                writeSync: (_fd: number, s: string) => {
                    output = s
                },
            },
        } as any)({ fd: 8, isTTY: false })

        writeLine('\x1b[31mred\x1b[0m')
        if (output !== 'red\n') { throw output }
    },
    stdioAndStderr: () => {
        let stdoutOutput = ''
        let stderrOutput = ''
        const io = {
            fs: {
                writeSync: (fd: number, s: string) => {
                    if (fd === 1) {
                        stdoutOutput = s
                    } else if (fd === 2) {
                        stderrOutput = s
                    }
                },
            },
            process: {
                stdout: { fd: 1, isTTY: true },
                stderr: { fd: 2, isTTY: false },
            },
        } as any

        stdio(io)('\x1b[32mok\x1b[0m')
        stderr(io)('\x1b[31merr\x1b[0m')

        if (stdoutOutput !== '\x1b[32mok\x1b[0m\n') { throw stdoutOutput }
        if (stderrOutput !== 'err\n') { throw stderrOutput }
    },
}
