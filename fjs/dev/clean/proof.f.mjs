/** @import { Dir } from '../../effects/node/virtual/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { exitCode } from '../../effects/node/module.f.mjs'
import { emptyState, nodeProgramOptions, virtual } from '../../effects/node/virtual/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { clean, generatedFiles, isGenerated, main } from './module.f.mjs'

/** @type {Dir} */
const root = {
    'gen.matrix.md': [],
    'matrix.md': [],
    'generate': { 'module.f.mjs': [] },
    'regen.md': [],
    'src': {
        'gen.operators.rs': [],
        'main.rs': [],
        'gen.fixtures': { 'a.rs': [], '.hidden': [], 'deep': { 'b.rs': [] } },
    },
    '.git': { 'gen.pack': [] },
    'node_modules': { 'gen.js': [] },
    'target': { 'gen.o': [] },
}

export const proof = {
    isGenerated: () => {
        for (const name of ['gen.x', 'gen.matrix.md', 'gen.fixtures']) { assert(isGenerated(name), name) }
        for (const name of ['gen', 'generate', 'generated.rs', 'regen.x', 'gen_x', 'x.gen.y']) { assert(!isGenerated(name), name) }
    },
    generatedFiles: () => {
        const [, result] = virtual({ ...emptyState, root })(generatedFiles('.'))
        assertEq(unwrap(result).toSorted().join(','), [
            './gen.matrix.md',
            './src/gen.fixtures/.hidden',
            './src/gen.fixtures/a.rs',
            './src/gen.fixtures/deep/b.rs',
            './src/gen.operators.rs',
        ].join(','))
    },
    clean: () => {
        const [state, result] = virtual({ ...emptyState, root })(clean('.'))
        assertEq(result[0], 'ok')
        assertStructurallySame(state.root, {
            'matrix.md': [],
            'generate': { 'module.f.mjs': [] },
            'regen.md': [],
            'src': { 'main.rs': [], 'gen.fixtures': { 'deep': {} } },
            '.git': { 'gen.pack': [] },
            'node_modules': { 'gen.js': [] },
            'target': { 'gen.o': [] },
        })
    },
    main: () => {
        const [state, code] = virtual({ ...emptyState, root })(main(nodeProgramOptions([])))
        assertEq(exitCode(code), 0)
        assertEq(Object.keys(state.root).includes('gen.matrix.md'), false)
    },
}
