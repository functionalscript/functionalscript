/**
 * Fixtures every proof under `fjs/media/wasm` shares: a module with something
 * of every shape the AST has, and a small one shaped like the demo module.
 *
 * Data only, so no proof of its own: what each fixture is, is checked
 * wherever it is read.
 *
 * @import { Bytes, Module } from './types.ts'
 */

/** A module with none of anything. @type {Module} */
export const emptyModule = {
    types: [], imports: [], functions: [], tables: [], memories: [], globals: [], exports: [],
    start: null, elements: [], dataCount: null, data: [], customs: [],
}

/** The magic and version every module starts with. @type {Bytes} */
export const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]

/**
 * A module with every kind of section, import, export, segment, name
 * subsection and immediate, and both ends of each integer's range.
 *
 * @type {Module}
 */
export const everything = {
    types: [
        { params: [], results: [] },
        { params: ['i32', 'i64', 'f32', 'f64', 'funcref', 'externref'], results: ['i32', 'i64'] },
    ],
    imports: [
        { module: 'env', name: 'f', desc: ['func', 0] },
        { module: 'env', name: 't', desc: ['table', { element: 'externref', limits: { min: 1, max: null } }] },
        { module: 'env', name: 'm', desc: ['memory', { min: 1, max: 0x1_0000 }] },
        { module: 'env', name: 'g', desc: ['global', { type: 'f64', mutable: true }] },
    ],
    functions: [
        {
            type: 0,
            locals: [[2, 'i32'], [1, 'f64']],
            body: [
                ['block', null],
                ['loop', 'i32'],
                ['if', 1],
                ['br', 0],
                ['else'],
                ['br_table', [0, 1], 2],
                ['end'],
                ['end'],
                ['end'],
                ['call', 0],
                ['call_indirect', 1, 0],
                ['select'],
                ['select', ['i32']],
                ['local.get', 0],
                ['i32.load', { align: 2, offset: 0xffff_ffff }],
                ['i32.const', -0x8000_0000],
                ['i32.const', 0x7fff_ffff],
                ['i64.const', -0x8000_0000_0000_0000n],
                ['i64.const', 0x7fff_ffff_ffff_ffffn],
                ['f32.const', 0x7fc0_0001],
                ['f64.const', 0x7ff8_0000_0000_0001n],
                ['ref.null', 'externref'],
                ['ref.func', 1],
                ['memory.size', 0],
                ['memory.init', 0, 0],
                ['i32.trunc_sat_f64_u'],
                ['table.copy', 0, 1],
                ['unreachable'],
            ],
        },
        { type: 1, locals: [], body: [] },
    ],
    tables: [
        { element: 'funcref', limits: { min: 0, max: 10 } },
    ],
    memories: [{ min: 0, max: null }],
    globals: [
        { type: { type: 'i32', mutable: false }, init: [['i32.const', 0]] },
    ],
    exports: [
        { name: 'f', kind: 'func', index: 1 },
        { name: 't', kind: 'table', index: 0 },
        { name: 'm', kind: 'memory', index: 0 },
        { name: 'g', kind: 'global', index: 1 },
    ],
    start: 1,
    elements: [
        { mode: ['active', 0, [['i32.const', 1]]], init: ['func', [1]] },
        { mode: ['passive'], init: ['func', [0, 1]] },
        { mode: ['active', 1, [['i32.const', 0]]], init: ['func', []] },
        { mode: ['declarative'], init: ['func', [1]] },
        { mode: ['active', 0, [['i32.const', 2]]], init: ['expr', 'funcref', [[['ref.func', 0]]]] },
        { mode: ['passive'], init: ['expr', 'externref', [[['ref.null', 'externref']]]] },
        { mode: ['active', 0, [['i32.const', 3]]], init: ['expr', 'externref', []] },
        { mode: ['active', 1, [['i32.const', 4]]], init: ['expr', 'funcref', []] },
        { mode: ['declarative'], init: ['expr', 'funcref', [[['ref.func', 1]]]] },
    ],
    dataCount: 3,
    data: [
        { mode: ['active', 0, [['i32.const', 8]]], bytes: [0x68, 0x69] },
        { mode: ['passive'], bytes: [] },
        { mode: ['active', 1, [['i32.const', 0]]], bytes: [0xff] },
    ],
    customs: [
        { after: null, content: ['raw', 'first', [1, 2, 3]] },
        { after: 'type', content: ['raw', 'second', []] },
        {
            after: 'data',
            content: ['name', [
                ['module', 'everything'],
                ['function', [[0, 'f'], [1, 'naïve ✓']]],
                ['local', [[1, [[0, 'x'], [1, 'y']]], [2, [[0, 'p'], [2, 'r']]]]],
                ['label', []],
                ['type', [[0, 'unit'], [1, '']]],
                ['table', []],
                ['memory', []],
                ['global', [[0, '__stack_pointer']]],
                ['elem', [[0, '#x']]],
                ['data', [[0, '.rodata'], [2, '.rodata']]],
                ['field', []],
                ['tag', []],
                ['unknown', 12, [0xde, 0xad]],
            ]],
        },
    ],
}
