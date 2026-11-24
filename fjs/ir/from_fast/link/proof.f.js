/**
 * Proofs of [how a program links L1](./module.f.js): the linked names, the
 * names that a term calls or reads, `link`, `linkAny` and `errorTable`.
 *
 * @module
 *
 * @import { Block } from '../../../js/ast/types.ts'
 * @import { Module, Term } from '../../types.ts'
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import {
    add, block, br, call, call_ref, codeOf, constant, f64, f64c, field, fn, get, let_, lit, loop, make, match, trap, true_, trunc_sat, u,
} from '../../module.f.js'
import { l0, ref } from '../../l0/module.f.js'
import { sourceOf } from '../testlib.f.js'
import { errorTable, link, linkAny, linkedAnyName, linkedName, uses } from './module.f.js'

/**
 * A term of every kind, which calls, reads and names a function and a
 * constant that `name` gives the names of: `add` and `#c0` as L1 has them,
 * `l1.add` and `l1.#c0` as a program links them.
 *
 * @type {(name: (k: string) => string) => Term}
 */
const everyKind = name => block('B', f64, let_('x', trunc_sat(u(8), lit(f64c, 1)), let_('y', add(get('x'), lit(f64c, 2)),
    let_('c', codeOf(name('add')), let_('r', call_ref(get('c'), [call('self', name('add'), [call('Any', 'from_f64', [constant('self', name('#c0'))])])]), let_('m', make([['k', get('r')]]),
        match(true_, [
            [['true'], null, br('B', field(get('m'), 'k'))],
            [null, null, loop('L', [['i', f64, constant('Any', 'undefined')]], trap('t'))],
        ])))))))

/** The normalized FAST of a module's text, which imports nothing. @type {(text: string) => Block} */
const fast = text => assertOk(sourceOf(text)).fast

export const proof = {
    linkedName: () => assertEq(linkedName('add'), 'l1.add'),
    linkedAnyName: () => assertEq(linkedAnyName('kind'), 'any.kind'),
    // A call of the module's own, a code of it and a read of its constant, at any depth; nothing of an interface.
    uses: () => assertEq(uses(everyKind(k => k)).join(), 'add,add,#c0'),
    link: () => {
        assertEq(assertError(link({ imports: l0, functions: [], exports: [] })({ imports: l0.slice(0, 1), functions: [], exports: [] })), 'L1 imports Any String BigInt Containers Functions, and the program Any')
        /** @type {Module} */
        const l1 = {
            imports: [],
            constants: [['#c0', { type: f64, value: call('self', 'other', []) }], ['#c1', { type: f64, value: lit(f64c, 2) }]],
            functions: [['all', fn([], f64, everyKind(k => k))], ['add', fn([], f64, lit(f64c, 0))], ['other', fn([], f64, lit(f64c, 1))]],
            exports: [],
        }
        const fns = /** @type {const} */ ([['f', fn([], f64, call('self', 'l1.all', []))], ['g', fn([], f64, call('self', 'f', []))]])
        // What the program reaches links, by its linked name, a constant of L1 through what it calls too; what it does not
        // reach stays out.
        assertStructurallySame(assertOk(link(l1)({ imports: [], functions: fns, exports: ['f', 'g'] })), {
            imports: [],
            constants: [['l1.#c0', { type: f64, value: call('self', 'l1.other', []) }]],
            functions: [...fns, ['l1.all', fn([], f64, everyKind(linkedName))], ['l1.add', fn([], f64, lit(f64c, 0))], ['l1.other', fn([], f64, lit(f64c, 1))]],
            exports: ['f', 'g'],
        })
        // L1 without constants, and what a constant of the program calls.
        /** @type {Module['constants']} */
        const own = [['#c0', { type: f64, value: call('self', 'l1.add', []) }]]
        assertStructurallySame(assertOk(link({ imports: [], functions: l1.functions, exports: [] })({ imports: [], constants: own, functions: [], exports: [] })), {
            imports: [],
            constants: own,
            functions: [['l1.add', fn([], f64, lit(f64c, 0))]],
            exports: [],
        })
    },
    linkAny: () => {
        /** @type {Module} */
        const any = {
            imports: [ref],
            defines: {
                name: 'Any',
                types: [['any', {
                    variants: ['undefined', 'number'],
                    kind: 'kind',
                    carrier: 'i64',
                    dup: 'dup',
                    drop: 'drop',
                    copy: ['undefined', 'number'],
                }]],
            },
            constants: [['undefined', { type: f64, value: lit(f64c, 0) }]],
            functions: [
                ['isRef', fn([], f64, lit(f64c, 0))],
                ['dup', fn([], f64, call('self', 'isRef', []))],
                ['drop', fn([], f64, call('self', 'isRef', []))],
                ['kind', fn([], f64, call('self', 'isRef', []))],
                ['from_f64', fn([], f64, lit(f64c, 1))],
                ['keep', fn([], f64, lit(f64c, 2))],
            ],
            exports: ['kind', 'from_f64', 'keep'],
        }
        assertEq(assertError(linkAny(any)({ imports: [], functions: [], exports: [] })), 'the program imports no Any')
        assertEq(assertError(linkAny(any)({
            imports: l0,
            defines: { name: 'T', types: [['cell', { variants: ['a'], carrier: 'i64' }]] },
            functions: [],
            exports: [],
        })), 'the program already defines T')
        // Hooks always link; from_f64 links because the program calls it; keep stays out.
        /** @type {Module} */
        const program = {
            imports: l0,
            constants: [['#c0', { type: f64, value: constant('Any', 'undefined') }]],
            functions: [['f', fn([], f64, call('Any', 'from_f64', [constant('self', '#c0')]))]],
            exports: ['f'],
        }
        const linked = assertOk(linkAny(any)(program))
        assertStructurallySame(linked.imports, [ref, ...l0.slice(1)])
        assertStructurallySame(linked.defines, {
            name: 'Any',
            types: [['any', {
                variants: ['undefined', 'number'],
                kind: 'any.kind',
                carrier: 'i64',
                dup: 'any.dup',
                drop: 'any.drop',
                copy: ['undefined', 'number'],
            }]],
        })
        assertStructurallySame(linked.constants, [
            ['any.undefined', { type: f64, value: lit(f64c, 0) }],
            ['#c0', { type: f64, value: constant('self', 'any.undefined') }],
        ])
        assertStructurallySame(linked.functions, [
            ['f', fn([], f64, call('self', 'any.from_f64', [constant('self', '#c0')]))],
            ['any.isRef', fn([], f64, lit(f64c, 0))],
            ['any.dup', fn([], f64, call('self', 'any.isRef', []))],
            ['any.drop', fn([], f64, call('self', 'any.isRef', []))],
            ['any.kind', fn([], f64, call('self', 'any.isRef', []))],
            ['any.from_f64', fn([], f64, lit(f64c, 1))],
        ])
        assertStructurallySame(linked.exports, ['f'])
        // A program may still export `kind`; linked Any uses `any.kind`.
        assertOk(linkAny(any)({
            imports: l0,
            functions: [['kind', fn([], f64, lit(f64c, 0))]],
            exports: ['kind'],
        }))
        // A linked name that the program already holds is refused.
        assertEq(assertError(linkAny(any)({
            imports: l0,
            functions: [['any.kind', fn([], f64, lit(f64c, 0))]],
            exports: ['any.kind'],
        })), 'any.kind is already a function or constant of the program')
    },
    errorTable: () => {
        assertStructurallySame(assertOk(errorTable(fast("export const error = { a: 'TypeError: a', b: 'RangeError: b' }"))), [['a', 'TypeError: a'], ['b', 'RangeError: b']])
        assertEq(assertError(errorTable(fast('export const x = 1'))), 'the module exports no object literal error')
        assertEq(assertError(errorTable(fast("export const error = { a: 'a' }\nexport const other = 1"))), 'an error module exports error and nothing else')
        assertEq(assertError(errorTable(fast('export const error = { a: 1 }'))), 'an error that is not a string of a name is not in this slice')
        assertEq(assertError(errorTable(fast("export const error = { x: 'first', x: 'second' }"))), 'the error table names an error twice')
        assertEq(assertError(errorTable({ statements: [], exit: ['yield', []] })), 'a module that yields no object of exports has no error table')
    },
}
