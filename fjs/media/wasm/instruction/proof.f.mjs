/**
 * @import { Instruction, Kind } from '../types.ts'
 */

import { assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { emptyModule } from '../testlib.f.js'
import { parse } from '../binary/parse/module.f.mjs'
import { write } from '../binary/write/module.f.mjs'
import { afterPrefix, encoding, instructions, prefix, prefixed, single } from './module.f.js'

/** Immediates of each kind, zero where they are numbers. @type {{ readonly [K in Kind]: readonly unknown[] }} */
const zero = {
    none: [], block: [null], index: [0], index2: [0, 0], brTable: [[], 0], select: [['i32']],
    memarg: [{ align: 0, offset: 0 }], i32: [0], i64: [0n], f32: [0], f64: [0n], ref: ['funcref'],
}

export const proof = {
    // Every row, written and read back as itself, so no two rows share an
    // opcode and every mnemonic finds its own.
    everyRow: () => {
        /** @type {readonly Instruction[]} */
        const body = [...instructions, ...prefixed]
            .filter(([, mnemonic]) => mnemonic !== 'block' && mnemonic !== 'loop' && mnemonic !== 'if' && mnemonic !== 'end')
            .map(([, mnemonic, kind]) => /** @type {Instruction} */ (/** @type {unknown} */ ([mnemonic, ...zero[kind]])))
        const m = { ...emptyModule, types: [{ params: [], results: [] }], functions: [{ type: 0, locals: [], body }] }
        assertStructurallySame(assertOk(parse(write(m))), m)
    },
    indexed: () => {
        assertEq(single[0x6a]?.[1], 'i32.add')
        assertEq(single[0x06], undefined)
        assertEq(afterPrefix[17]?.[1], 'table.fill')
        assertEq(prefix, 0xfc)
    },
    // `select` is written as `0x1b` without its types and `0x1c` with them.
    select: () => {
        assertStructurallySame(encoding(['select']), [[0x1b], 'none'])
        assertStructurallySame(encoding(['select', ['i32']]), [[0x1c], 'select'])
        assertStructurallySame(encoding(['memory.copy', 0, 0]), [[0xfc, 10], 'index2'])
    },
}
