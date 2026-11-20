/**
 * The program answers as `fjs` does with the same table: no command is an
 * error naming the commands, and `help` lists them.
 */

import { assertEq } from '../../asserts/module.f.js'
import { exitCode } from '../../effects/node/module.f.js'
import { emptyState, nodeProgramOptions, virtual } from '../../effects/node/virtual/module.f.js'
import { commands, main } from './module.f.js'

const listed = 'Available commands:\n  help, h, ?  Print this help message'

export const proof = /** @type {const} */ ({
    noCommand: () => {
        const [state, code] = virtual(emptyState)(main(nodeProgramOptions([])))
        assertEq(exitCode(code), 1)
        assertEq(state.stderr, `Error: command is required.\n${listed}\n`)
        assertEq(state.stdout, '')
    },
    help: () => {
        const [state, code] = virtual(emptyState)(main(nodeProgramOptions(['help'])))
        assertEq(exitCode(code), 0)
        assertEq(state.stdout, `${listed}\n`)
        assertEq(state.stderr, '')
    },
    unknown: () => {
        const [state, code] = virtual(emptyState)(main(nodeProgramOptions(['compile'])))
        assertEq(exitCode(code), 1)
        assertEq(state.stderr, `Error: unknown command "compile".\n${listed}\n`)
    },
    empty: () => { assertEq(commands.length, 0) },
})
