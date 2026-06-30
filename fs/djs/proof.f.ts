import { compile } from './module.f.ts'
import { virtual, emptyState } from '../effects/node/virtual/module.f.ts'
import { utf8 as utf8Raw, utf8ToString } from '../text/module.f.ts'
import { unwrap } from '../types/nullable/module.f.ts'
import type { Vec } from '../types/bit_vec/module.f.ts'

// Test inputs are short source literals, well within the cap.
const utf8 = (s: string) => unwrap(utf8Raw(s))

const readOutput = (root: typeof emptyState.root, path: string): string => {
    const file = root[path]
    if (!Array.isArray(file) || file.length === 0) { throw `${path} is not a file` }
    return utf8ToString((file as readonly Vec[])[0])
}

export const proof = {
    tooFewArgs: {
        noArgs: () => {
            const [state, code] = virtual(emptyState)(compile([]))
            if (code !== 1) { throw code }
            if (!state.stderr.includes('Requires 2 or more arguments')) { throw state.stderr }
        },
        oneArg: () => {
            const [state, code] = virtual(emptyState)(compile(['input.f.js']))
            if (code !== 1) { throw code }
            if (!state.stderr.includes('Requires 2 or more arguments')) { throw state.stderr }
        },
    },
    success: () => {
        const root = { 'input.f.js': [utf8('export default 42')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.f.js']))
        if (code !== 0) { throw code }
        const content = readOutput(state.root, 'output.f.js')
        if (content !== 'export default 42') { throw content }
    },
    jsonOutput: () => {
        const root = { 'input.f.js': [utf8('export default 42')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['input.f.js', 'output.json']))
        if (code !== 0) { throw code }
        const content = readOutput(state.root, 'output.json')
        if (content !== '42') { throw content }
    },
    fileNotFound: () => {
        const [state, code] = virtual(emptyState)(compile(['missing.f.js', 'output.f.js']))
        if (code !== 0) { throw code }
        if (!state.stderr.includes('file not found')) { throw state.stderr }
    },
    parseError: () => {
        const root = { 'bad.f.js': [utf8('export default @')] }
        const [state, code] = virtual({ ...emptyState, root })(compile(['bad.f.js', 'output.f.js']))
        if (code !== 0) { throw code }
        if (state.stderr === '') { throw 'expected error output' }
    },
}
