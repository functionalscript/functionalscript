/**
 * @import { Bytes } from '../../types.ts'
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { emptyModule, everything, header } from '../../testlib.f.js'
import { write } from '../write/module.f.mjs'
import { parse } from './module.f.mjs'

/** A section of fewer than 128 bytes. @type {(id: number, content: Bytes) => Bytes} */
const sec = (id, content) => [id, content.length, ...content]

/** @type {(...sections: readonly Bytes[]) => Bytes} */
const mod = (...sections) => [...header, ...sections.flat()]

/** The type `() -> ()` and one function of it. */
const oneFunction = [...sec(1, [1, 0x60, 0, 0]), ...sec(3, [1, 0])]

/** A module whose one function has no locals and `code` for its body. @type {(...code: readonly number[]) => Bytes} */
const fn = (...code) => mod(oneFunction, sec(10, [1, code.length + 2, 0, ...code, 0x0b]))

/** @type {(bytes: Bytes, message: string) => void} */
const refused = (bytes, message) => { assertEq(assertError(parse(bytes)), message) }

export const proof = {
    empty: () => {
        assertStructurallySame(assertOk(parse(header)), emptyModule)
    },
    // Every shape the AST has, through the writer and back.
    everything: () => {
        assertStructurallySame(assertOk(parse(write(everything))), everything)
    },
    // What the canonical writer never writes, read as it is meant.
    nonCanonical: () => {
        const m = assertOk(parse(fn(0x10, 0x80, 0x80, 0x80, 0x80, 0x00)))
        assertStructurallySame(m.functions[0].body, [['call', 0]])
        const elements = assertOk(parse(mod(sec(9, [1, 2, 0, 0x41, 0, 0x0b, 0, 0]))))
        assertStructurallySame(elements.elements, [{ mode: ['active', 0, [['i32.const', 0]]], init: ['func', []] }])
        const data = assertOk(parse(mod(sec(11, [1, 2, 0, 0x41, 0, 0x0b, 0]))))
        assertStructurallySame(data.data, [{ mode: ['active', 0, [['i32.const', 0]]], bytes: [] }])
    },
    blockTypes: () => {
        const m = assertOk(parse(fn(0x02, 0x40, 0x0b, 0x02, 0x7f, 0x0b, 0x02, 0x01, 0x0b)))
        assertStructurallySame(m.functions[0].body, [['block', null], ['end'], ['block', 'i32'], ['end'], ['block', 1], ['end']])
    },
    refusals: {
        magic: () => refused([0, 0x61, 0x73, 0x6e, 1, 0, 0, 0], 'not a WebAssembly module at byte 0'),
        version: () => refused([...header.slice(0, 4), 2, 0, 0, 0], 'unsupported WebAssembly version at byte 4'),
        sectionSize: () => refused([...header, 1], 'unexpected end at byte 9'),
        unknownSection: () => refused(mod(sec(13, [])), 'unknown section id 13 at byte 8'),
        outOfOrder: () => refused(mod(sec(2, [0]), sec(1, [0])), 'type section out of order at byte 11'),
        duplicate: () => refused(mod(sec(1, [0]), sec(1, [0])), 'type section out of order at byte 11'),
        pastEnd: () => refused([...header, 1, 5, 0], 'type section extends past the end at byte 10'),
        sizeMismatch: () => refused(mod(sec(1, [0, 0])), 'type section size mismatch at byte 12'),
        customName: () => refused(mod([0, 2, 5, 0x61]), 'unexpected end at byte 11'),
        nameSubsectionSize: () => refused(
            mod(sec(0, [4, 0x6e, 0x61, 0x6d, 0x65, 0, 3, 1, 0x61, 0])),
            'name subsection size mismatch at byte 20'),
        bodies: () => refused(mod(oneFunction), 'function and code section counts differ (1 and 0) at byte 18'),
        dataCount: () => refused(mod(sec(12, [1])), 'data count and data section count differ (1 and 0) at byte 11'),
        tooLong: () => refused(mod(sec(1, [0x80, 0x80, 0x80, 0x80, 0x80, 0])), 'integer representation too long at byte 10'),
        u32TooLarge: () => refused(mod(sec(1, [0xff, 0xff, 0xff, 0xff, 0x1f])), 'integer out of range at byte 10'),
        s32TooLarge: () => refused(fn(0x41, 0xff, 0xff, 0xff, 0xff, 0x08), 'integer out of range at byte 24'),
        s32TooSmall: () => refused(fn(0x41, 0x80, 0x80, 0x80, 0x80, 0x70), 'integer out of range at byte 24'),
        lebEnd: () => refused([...header, 1, 0x80], 'unexpected end at byte 10'),
        typeForm: () => refused(mod(sec(1, [1, 0x61])), 'unsupported type form 0x61 at byte 11'),
        utf8: () => refused(mod(sec(7, [1, 1, 0xff, 0, 0])), 'malformed UTF-8 at byte 12'),
        tagEnd: () => refused(mod(sec(2, [1, 0, 0])), 'unexpected end at byte 13'),
        valType: () => refused(mod(sec(1, [1, 0x60, 1, 0x7b, 0])), 'unsupported value type 0x7b at byte 13'),
        limits: () => refused(mod(sec(5, [1, 2, 0])), 'unsupported limits flag 0x2 at byte 11'),
        mutability: () => refused(mod(sec(6, [1, 0x7f, 2, 0x41, 0, 0x0b])), 'unsupported mutability 0x2 at byte 12'),
        blockType: () => refused(fn(0x02, 0x41, 0x0b), 'malformed block type at byte 24'),
        align: () => refused(fn(0x28, 0x40, 0, 0x1a), 'multiple memories are not supported at byte 25'),
        prefixedUnknown: () => refused(fn(0xfc, 18), 'unknown opcode 0xfc 18 at byte 23'),
        prefixEnd: () => refused(mod(oneFunction, [10, 4, 1, 2, 0, 0xfc]), 'unexpected end at byte 24'),
        unknownOpcode: () => refused(fn(0xfd), 'unknown opcode 0xfd at byte 23'),
        importKind: () => refused(mod(sec(2, [1, 0, 0, 4])), 'unsupported import kind 0x4 at byte 13'),
        elementFlag: () => refused(mod(sec(9, [1, 8])), 'unsupported element segment flag 8 at byte 11'),
        elementKind: () => refused(mod(sec(9, [1, 1, 1, 0])), 'unsupported element kind 0x1 at byte 12'),
        dataFlag: () => refused(mod(sec(11, [1, 3])), 'unsupported data segment flag 3 at byte 11'),
        bodyEnd: () => refused(mod(oneFunction, [10, 3, 1, 1, 0]), 'unexpected end at byte 23'),
        bodySize: () => refused(mod(oneFunction, sec(10, [1, 3, 0, 0x0b, 0x0b])), 'function body size mismatch at byte 25'),
    },
}
