import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { irExportName, irFileName, irPrograms, l0FileName } from './module.f.js'

export const proof = {
    names: () => {
        assertEq(l0FileName, 'nanvm_l0_wasm.wasm')
        assertEq(irFileName('collatz'), 'collatz.ir.wasm')
        assertEq(irExportName, 'run')
        assertStructurallySame(irPrograms, ['collatz', 'sort'])
    },
}
