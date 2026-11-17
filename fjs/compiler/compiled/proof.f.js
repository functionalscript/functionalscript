/**
 * A program in memory compiles to what `fjs compile` writes, and a refusal
 * reads as the pane that shows it needs: the message alone for the main
 * module or the output, the command's line for another file.
 */

import { compiled, compiledProgram, runtime } from './module.f.js'
import { main } from '../demo_files/module.f.js'
import { toText } from '../../text/marked/module.f.js'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { mapOk } from '../../types/result/module.f.js'

/** A compile's result with marked text flattened. */
const text = mapOk(toText)

export const proof = {
    // one module, to each language its output name selects
    compiled: () => {
        assertStructurallySame(text(compiled('export default 1;')('output.json')), ['ok', '1'])
        assertStructurallySame(text(compiled('const fact = n => n < 2 ? 1 : n * fact(n - 1);\nexport default fact(5);')('output.json')), ['ok', '120'])
        assertEq(compiled('export default [1];')('output.data.js')[0], 'ok')
    },
    // the runtime is loaded, not asked of a file system
    runtime: () => {
        assertEq(typeof runtime, 'function')
    },
    // a program of several files, compiled from its main module
    program: () => {
        const files = /** @type {const} */ ([[main, "import a from './a.f.js';\nexport default [a];"], ['a.f.js', 'export default 2;']])
        assertStructurallySame(text(compiledProgram(files)('output.json')), ['ok', '[2]'])
    },
    refusal: {
        // the main module's: the message, without its location
        main: () => {
            assertStructurallySame(compiled('export default "\\x41";')('output.json'), ['error', 'unexpected token'])
        },
        // a refusal with no place in the text is still the main module's
        initialization: () => {
            assertStructurallySame(compiled('export default null.x;')('output.json'), ['error', 'module initialization failed'])
        },
        // a file an import names and nothing holds: named, with no place in it
        missing: () => {
            const [tag, message] = compiled("import a from './a.f.js';\nexport default a;")('output.json')
            assertEq(tag, 'error')
            assert(String(message).includes('a.f.js'), String(message))
        },
        // the output's: JSON has no function
        output: () => {
            const [tag, message] = compiled('export default () => 1;')('output.json')
            assertEq(tag, 'error')
            assert(!String(message).includes(main), String(message))
        },
        // another file's: the command's line, which names the file
        imported: () => {
            const files = /** @type {const} */ ([[main, "import a from './a.f.js';\nexport default a;"], ['a.f.js', 'export default ;']])
            const [tag, message] = compiledProgram(files)('output.json')
            assertEq(tag, 'error')
            assert(String(message).includes('a.f.js'), String(message))
        },
    },
}
