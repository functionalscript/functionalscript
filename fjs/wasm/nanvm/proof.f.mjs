import { assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse } from '../../media/wasm/binary/parse/module.f.mjs'
import { write } from '../../media/wasm/binary/write/module.f.mjs'
import { functions } from '../../media/wasm/wat/module.f.mjs'
import { inbound, outbound } from './module.f.mjs'

export const proof = {
    // Each module writes and reads back as itself.
    roundTrip: () => {
        assertStructurallySame(assertOk(parse(write(inbound))), inbound)
        assertStructurallySame(assertOk(parse(write(outbound))), outbound)
    },
    // `invoke` calls through the table with L0's code type, and keeps the
    // value in the one global.
    inbound: () => {
        assertEq(functions(inbound)[0], [
            '  (func (;0;) (type 1) (param i32 i64 i64) (result i32)',
            '    (local i64)',
            '    local.get 1',
            '    local.get 2',
            '    local.get 0',
            '    call_indirect (type 0)',
            '    local.set 3',
            '    local.get 3',
            '    global.set 0',
            '  )',
            '',
        ].join('\n'))
    },
}
