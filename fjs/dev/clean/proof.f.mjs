/** @import { Dir } from '../../effects/node/virtual/types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { exitCode } from '../../effects/node/module.f.mjs'
import { nodeProgramOptions, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { clean, generatedFiles, isGenerated, main } from './module.f.mjs'

/** @type {Dir} */
const root = {
    'gen.matrix.md': [],
    'gen.nix': { 'flake.lock': [utf8('committed optional lock')], 'flake.nix': [] },
    'matrix.md': [],
    'generate': { 'module.f.mjs': [] },
    'regen.md': [],
    'src': {
        'gen.operators.rs': [],
        'gen.nix': { 'flake.lock': [] },
        'main.rs': [],
        'gen.fixtures': { 'a.rs': [], '.hidden': [], 'deep': { 'b.rs': [] } },
    },
    '.git': { 'gen.pack': [] },
    '.github': { 'FUNDING.yml': [], 'workflows': { 'gen.ci.yml': [] } },
    'node_modules': { 'gen.js': [] },
    'target': { 'gen.o': [] },
}

export const proof = {
    isGenerated: () => {
        for (const name of ['gen.x', 'gen.matrix.md', 'gen.fixtures']) { assert(isGenerated(name), name) }
        for (const name of ['gen', 'generate', 'generated.rs', 'regen.x', 'gen_x', 'x.gen.y']) { assert(!isGenerated(name), name) }
    },
    generatedFiles: () => {
        const [, result] = virtualAt(root)(generatedFiles('.'))
        assertEq(unwrap(result).toSorted().join(','), [
            './.github/workflows/gen.ci.yml',
            './gen.matrix.md',
            './gen.nix/flake.nix',
            './src/gen.fixtures/.hidden',
            './src/gen.fixtures/a.rs',
            './src/gen.fixtures/deep/b.rs',
            './src/gen.nix/flake.lock',
            './src/gen.operators.rs',
        ].join(','))
    },
    // A scan root under a `gen.*` directory: only the path below the root
    // counts, so its handwritten files are not taken.
    rootUnderGenerated: () => {
        /** @type {Dir} */
        const nested = { 'gen.workspace': { 'repo': { 'main.rs': [], 'gen.x.md': [], 'src': { 'a.rs': [] } } } }
        const [, result] = virtualAt(nested)(generatedFiles('gen.workspace/repo'))
        assertEq(unwrap(result).join(','), 'gen.workspace/repo/gen.x.md')
    },
    clean: () => {
        const [state, result] = virtualAt(root)(clean('.'))
        assertEq(result[0], 'ok')
        assertStructurallySame(state.root, {
            'matrix.md': [],
            'gen.nix': { 'flake.lock': [utf8('committed optional lock')] },
            'generate': { 'module.f.mjs': [] },
            'regen.md': [],
            'src': { 'main.rs': [], 'gen.fixtures': { 'deep': {} }, 'gen.nix': {} },
            '.git': { 'gen.pack': [] },
            '.github': { 'FUNDING.yml': [], 'workflows': {} },
            'node_modules': { 'gen.js': [] },
            'target': { 'gen.o': [] },
        })
    },
    main: () => {
        const [state, code] = virtualAt(root)(main(nodeProgramOptions([])))
        assertEq(exitCode(code), 0)
        assertEq(Object.keys(state.root).includes('gen.matrix.md'), false)
    },
}
