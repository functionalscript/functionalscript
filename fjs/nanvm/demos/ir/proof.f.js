import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { buildDirectory } from '../page/module.f.js'
import { irFileName, irL0PublishPath, irPrograms, irPublishDirectory, irPublishPath, l0FileName } from './module.f.js'

export const proof = {
    names: () => {
        assertEq(l0FileName, 'nanvm_l0_wasm.wasm')
        assertEq(irFileName('collatz'), 'collatz.ir.wasm')
        assertStructurallySame(irPrograms, ['collatz', 'sort'])
    },
    paths: () => {
        assertEq(irPublishDirectory, buildDirectory)
        assertEq(irPublishPath('sort'), `${buildDirectory}/sort.ir.wasm`)
        assertEq(irL0PublishPath, `${buildDirectory}/nanvm_l0_wasm.wasm`)
    },
}
