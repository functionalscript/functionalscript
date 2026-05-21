import { csiWrite, fgRed, reset } from './module.f.ts'
import { emptyState, virtual } from '../../types/effects/node/virtual/module.f.ts'
import type { NodeProgramOptions } from '../../types/effects/node/module.f.ts'

const makeOptions = (stdoutTty: boolean, stderrTty: boolean): NodeProgramOptions => ({
    args: [],
    env: {},
    std: {
        stdout: { isTTY: stdoutTty },
        stderr: { isTTY: stderrTty },
    },
})

export default {
    fgRed: () => {
        if (fgRed !== '\x1b[31m') { throw fgRed }
    },
    csiWriteTty: () => {
        const o = makeOptions(true, false)
        const [state] = virtual(emptyState)(csiWrite(o)('stdout')(`${fgRed}hi${reset}`))
        if (state.stdout !== `${fgRed}hi${reset}\n`) { throw state.stdout }
    },
    csiWriteNonTtyStrips: () => {
        const o = makeOptions(false, false)
        const [state] = virtual(emptyState)(csiWrite(o)('stdout')(`${fgRed}hi${reset}`))
        if (state.stdout !== 'hi\n') { throw state.stdout }
    },
    csiWriteStderr: () => {
        const o = makeOptions(true, true)
        const [state] = virtual(emptyState)(csiWrite(o)('stderr')(`${fgRed}err${reset}`))
        if (state.stderr !== `${fgRed}err${reset}\n`) { throw state.stderr }
        if (state.stdout !== '') { throw state.stdout }
    },
}
