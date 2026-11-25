/**
 * Proofs of [how a program links L1](./module.f.js): the linked names, the
 * names that a term calls or reads, `link`, `linkAny`, `linkString` and
 * `errorTable`.
 *
 * @module
 *
 * @import { Block } from '../../../js/ast/types.ts'
 * @import { Module, Term } from '../../types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import {
    add, block, bool, br, call, call_ref, codeOf, constant, f64, f64c, field, fn, get, let_, lit, loop, make, match, trap, true_, trunc_sat, u, variant,
} from '../../module.f.js'
import { l0, ref, string } from '../../l0/module.f.js'
import { module as stringModule } from '../../runtime/string/ir.f.js'
import { sourceOf } from '../testlib.f.js'
import { errorTable, link, linkAny, linkString, linkedAnyName, linkedName, linkedStringName, uses } from './module.f.js'

/**
 * A term of every kind, which calls, reads and names a function and a
 * constant that `name` gives the names of: `add` and `#c0` as L1 has them,
 * `l1.add` and `l1.#c0` as a program links them.
 *
 * @type {(name: (k: string) => string) => Term}
 */
const everyKind = name => block('B', f64, let_('x', trunc_sat(u(8), lit(f64c, 1)), let_('y', add(get('x'), lit(f64c, 2)),
    let_('c', codeOf(name('add')), let_('r', call_ref(get('c'), [call('self', name('add'), [call('Any', 'from_f64', [constant('self', name('#c0'))])])]), let_('m', make([['k', get('r')]]),
        let_('v', variant(bool, 'true', make([])), match(true_, [
            [['true'], null, br('B', field(get('m'), 'k'))],
            [null, null, loop('L', [['i', f64, constant('Any', 'undefined')]], trap('t'))],
        ]))))))))

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
                // everyKind covers each rewriteAny case (incl. Any and self).
                ['all', fn([], f64, everyKind(k => k))],
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
        assertEq(assertError(linkAny({
            imports: any.imports,
            functions: any.functions,
            exports: any.exports,
        })({
            imports: l0, functions: [], exports: [],
        })), 'Any has no defines')
        assertEq(assertError(linkAny({ ...any, imports: [] })({
            imports: l0, functions: [], exports: [],
        })), 'Any imports no Ref')
        // A type with no hooks covers the undefined branches of kind/dup/drop.
        assertOk(linkAny({
            ...any,
            defines: {
                name: 'Any',
                types: [['any', { variants: ['undefined'], carrier: 'i64', copy: ['undefined'] }]],
            },
            functions: [['from_f64', fn([], f64, lit(f64c, 1))]],
        })({
            imports: l0,
            functions: [['f', fn([], f64, call('Any', 'from_f64', []))]],
            exports: ['f'],
        }))
        // Hooks always link; from_f64 links because the program calls it; keep stays out.
        /** @type {Module} */
        const program = {
            imports: l0,
            constants: [['#c0', { type: f64, value: constant('Any', 'undefined') }]],
            functions: [
                ['f', fn([], f64, call('Any', 'from_f64', [constant('self', '#c0')]))],
                // A program `kind` called as self stays the program's, not any.kind.
                ['kind', fn([], f64, lit(f64c, 3))],
                ['g', fn([], f64, call('self', 'kind', []))],
            ],
            exports: ['f', 'kind', 'g'],
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
            ['kind', fn([], f64, lit(f64c, 3))],
            ['g', fn([], f64, call('self', 'kind', []))],
            ['any.isRef', fn([], f64, lit(f64c, 0))],
            ['any.dup', fn([], f64, call('self', 'any.isRef', []))],
            ['any.drop', fn([], f64, call('self', 'any.isRef', []))],
            ['any.kind', fn([], f64, call('self', 'any.isRef', []))],
            ['any.from_f64', fn([], f64, lit(f64c, 1))],
        ])
        assertStructurallySame(linked.exports, ['f', 'kind', 'g'])
        // A linked name that the program already holds is refused.
        assertEq(assertError(linkAny(any)({
            imports: l0,
            functions: [['any.kind', fn([], f64, lit(f64c, 0))]],
            exports: ['any.kind'],
        })), 'any.kind is already a function or constant of the program')
        // everyKind on Any is reached when the program calls it, so each rewrite case runs.
        assertOk(linkAny(any)({
            imports: l0,
            functions: [['f', fn([], f64, call('Any', 'all', []))]],
            exports: ['f'],
        }))
        // A program that already imports Ref keeps that import (minus Any).
        assertStructurallySame(assertOk(linkAny(any)({
            imports: [ref, ...l0],
            functions: [['f', fn([], f64, call('Any', 'from_f64', []))]],
            exports: ['f'],
        })).imports, [ref, ...l0.slice(1)])
        // Any without constants still links.
        assertOk(linkAny({
            imports: any.imports,
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
            functions: [['from_f64', fn([], f64, lit(f64c, 1))]],
            exports: ['from_f64'],
        })({
            imports: l0,
            functions: [['f', fn([], f64, call('Any', 'from_f64', []))]],
            exports: ['f'],
        }))
    },
    linkString: () => {
        assertEq(linkedStringName('length'), 'string.length')
        // Needs a post-linkAny program that defines Any and imports String.
        assertEq(assertError(linkString(stringModule)({
            imports: l0,
            functions: [],
            exports: [],
        })), 'the program does not define Any')
        /** @type {Module} */
        const anyStub = {
            imports: [ref],
            defines: {
                name: 'Any',
                types: [['any', {
                    variants: ['string'],
                    kind: 'kind',
                    carrier: 'i64',
                    dup: 'dup',
                    drop: 'drop',
                    copy: [],
                }]],
            },
            functions: [
                ['isRef', fn([], f64, lit(f64c, 0))],
                ['dup', fn([], f64, lit(f64c, 0))],
                ['drop', fn([], f64, lit(f64c, 0))],
                ['kind', fn([], f64, lit(f64c, 0))],
            ],
            exports: ['kind'],
        }
        const withAny = assertOk(linkAny(anyStub)({
            imports: l0,
            // A constant that calls String.length covers rewriteProgram on constants.
            constants: [['#len', {
                type: u(31),
                value: call('String', 'length', [constant('String', 'empty')]),
            }]],
            functions: [
                ['f', fn([['s', string]], u(31), s => call('String', 'length', [s]))],
                ['g', fn([['s', string], ['i', u(31)]], u(16), (s, i) => call('String', 'unit', [s, i]))],
            ],
            exports: ['f', 'g'],
        }))
        const linked = assertOk(linkString(stringModule)(withAny))
        assert(linked.imports.find(([k]) => k === 'String') !== undefined)
        assertStructurallySame(linked.functions.find(([k]) => k === 'f')?.[1].body, call('self', 'string.length', [get('s')]))
        assertStructurallySame(linked.functions.find(([k]) => k === 'g')?.[1].body, call('self', 'string.unit', [get('s'), get('i')]))
        assertStructurallySame(linked.constants?.find(([k]) => k === '#len')?.[1].value,
            call('self', 'string.length', [constant('String', 'empty')]))
        assert(linked.functions.find(([k]) => k === 'string.length') !== undefined)
        assert(linked.functions.find(([k]) => k === 'string.unit') !== undefined)
        const stringDefines = stringModule.defines
        assert(stringDefines !== undefined)
        const programDefines = withAny.defines
        assert(programDefines !== undefined)
        // Long-miss String.length inside the linked body stays an import (rewriteImports false).
        assertStructurallySame(
            assertOk(linkString({
                imports: stringModule.imports,
                defines: stringDefines,
                functions: [['length', fn([['s', string]], u(31), s => call('String', 'length', [s]))]],
                exports: ['length'],
            })(withAny)).functions.find(([k]) => k === 'string.length')?.[1].body,
            call('String', 'length', [get('s')]),
        )
        // everyKind on the String stub covers each rewriteString case; name('#c0')
        // is an own function so constant('self', own) renames under rewriteOwn.
        assertOk(linkString({
            imports: stringModule.imports,
            defines: stringDefines,
            functions: [
                ['length', fn([], f64, everyKind(k => k === '#c0' ? 'unit' : k))],
                ['unit', fn([], f64, lit(f64c, 0))],
                ['add', fn([], f64, lit(f64c, 0))],
            ],
            exports: ['length'],
        })({
            imports: withAny.imports,
            defines: programDefines,
            functions: [['f', fn([], f64, call('String', 'length', []))]],
            exports: ['f'],
        }))
        assertEq(assertError(linkString(stringModule)({
            ...withAny,
            imports: withAny.imports.filter(([k]) => k !== 'String'),
        })), 'the program imports no String')
        assertEq(assertError(linkString(stringModule)({
            ...withAny,
            functions: [
                ...withAny.functions,
                ['string.length', fn([], f64, lit(f64c, 0))],
            ],
        })), 'string.length is already a function or constant of the program')
        assertEq(assertError(linkString(stringModule)({
            ...withAny,
            constants: [
                ...(withAny.constants ?? []),
                ['string.unit', { type: f64, value: lit(f64c, 0) }],
            ],
        })), 'string.unit is already a function or constant of the program')
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
