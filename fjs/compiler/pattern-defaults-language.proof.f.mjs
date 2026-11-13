/** Pattern defaults use ordinary reads and lazy undefined selection across compiler outputs. */

import { assert, assertEq } from '../asserts/module.f.js'
import { compileSource, fjsRoundTrip, moduleRefused } from './proof.f.mjs'

export const proof = {
    undefinedSelection: () => {
        const source = [
            'const f = ({ a = 5 }) => a;',
            'const g = ([a = 7]) => a;',
            'export default [f({}), f({ a: undefined }), f({ a: null }), f({ a: false }), f({ a: 0 }), f({ a: "" }), g([]), g([undefined]), g([null]), g([0])];',
        ].join(' ')
        assertEq(compileSource(source)('output.json'), '[5,5,null,false,0,"",7,7,null,0]')
    },
    arity: () => {
        const source = [
            'const f = ({ a = 5 }) => a;',
            'const g = ({ a = 5 } = {}) => a;',
            'const h = ([a = 1], { b = 2 }, c = 3) => [a, b, c];',
            'export default [f.length, g.length, h.length, g(), g(undefined), g({}), h([], {})];',
        ].join(' ')
        assertEq(compileSource(source)('output.json'), '[1,0,2,5,5,5,[1,2,3]]')
    },
    declarationsAndNestedPatterns: () => {
        const source = [
            'const { source: renamed = 1, rows: [head = 2] = [], settings: { depth = 3 } = {} } = {};',
            'const [first = 4, , { leaf = 5 } = {}] = [];',
            'export const { exported = 6 } = {};',
            'export default [renamed, head, depth, first, leaf, exported];',
        ].join(' ')
        assertEq(compileSource(source)('output.json'), '[1,2,3,4,5,6]')
    },
    precedingBindings: () => {
        const source = [
            'const seed = 4;',
            'const { a = seed, b = a + 1, c: [d = b + 1] = [] } = {};',
            'const f = (start, { x = start, y = x + 1 }, z = y + 1) => [x, y, z];',
            'export default [a, b, d, f(7, {})];',
        ].join(' ')
        assertEq(compileSource(source)('output.json'), '[4,5,6,[7,8,9]]')
    },
    lazyFallback: () => {
        assertEq(compileSource('const f = ({ a = null.x }) => a; export default f({ a: 1 });')('output.json'), '1')
        assertEq(compileSource('const [a = null.x] = [2]; export default a;')('output.json'), '2')
        assertEq(moduleRefused('const f = ({ a = null.x }) => a; export default f({});'), 'input.f.js - error: module initialization failed')
        assertEq(moduleRefused('const [a = null.x] = []; export default a;'), 'input.f.js - error: module initialization failed')
    },
    requiredInitialization: () => {
        assertEq(moduleRefused('const f = ({ a = null.x }) => 9; export default f({});'), 'input.f.js - error: module initialization failed')
        assertEq(moduleRefused('const { a = null.x } = {}; export default 9;'), 'input.f.js - error: module initialization failed')
        assertEq(compileSource('const f = ({ a = null.x }) => 9; export default f({ a: 1 });')('output.json'), '9')
        assertEq(compileSource('const { a = null.x } = { a: 1 }; export default 9;')('output.json'), '9')
    },
    argumentStillRequired: () => {
        for (const argument of ['', 'undefined', 'null']) {
            assertEq(moduleRefused(`const f = ({ a = 5 }) => a; export default f(${argument});`), 'input.f.js - error: module initialization failed')
        }
        assertEq(moduleRefused('const f = ({ a = 5 } = {}) => a; export default f(null);'), 'input.f.js - error: module initialization failed')
        assertEq(moduleRefused('const { nested: { a = 5 } = {} } = { nested: null }; export default a;'), 'input.f.js - error: module initialization failed')
    },
    allocationAndSharing: () => {
        const source = [
            'const shared = {};',
            'const captured = ({ a = shared }) => a;',
            'const fresh = ({ a = {} }) => [a, a];',
            'const one = fresh({});',
            'const two = fresh({});',
            'const make = ({ a = {} }) => () => a;',
            'const reader = make({});',
            'const getSource = () => { const value = {}; return { a: value, b: value }; };',
            'const { a: selected = {}, b: other = {} } = getSource();',
            'export default [captured({}) === shared, captured({}) === captured({}), one[0] === one[1], one[0] === two[0], reader() === reader(), selected === other];',
        ].join(' ')
        assertEq(compileSource(source)('output.json'), '[true,true,true,false,true,true]')
    },
    reassignedParameter: () => {
        const source = 'const f = ({ a = 2 }, step) => { a += step; return a; }; export default [f({}, 3), f({ a: 4 }, 2)];'
        assertEq(compileSource(source)('output.json'), '[5,6]')
    },
    outputsReadBack: () => {
        for (const source of [
            'export default ({ a = 5 }) => a;',
            'export default ({ source: [a = 2] = [] } = {}) => [a, a];',
            'const seed = {}; export default ({ a = seed, b = a }) => [a, b];',
            'export default ({ a = 2 }, step) => { a += step; return a; };',
        ]) {
            const first = fjsRoundTrip(source)
            const second = fjsRoundTrip(first)
            assertEq(second, first)
            assert(first.includes('===undefined'), first)
            assert(compileSource(source)('output.rs').includes('strict_eq'), source)
        }
    },
}
