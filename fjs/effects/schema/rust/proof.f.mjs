/**
 * @import { Result } from '../../../types/result/types.ts'
 */

import { assert, assertEq, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { array, bigint, boolean, number, option, or, record, string } from '../../../rtti/module.f.mjs'
import { dirent, mkdir, notImplemented, operations, read, readdir, write } from '../module.f.mjs'
import { dataType, definition, generate, method, pascal, rustType, snake, types } from './module.f.mjs'

/** @type {(r: Result<string, readonly unknown[]>) => string} */
const text = r => {
    assertEq(r[0], 'ok')
    return /** @type {string} */ (r[1])
}

/** @type {(r: Result<unknown, readonly unknown[]>) => string} */
const reason = r => {
    assertEq(r[0], 'error')
    return /** @type {string} */ (/** @type {readonly unknown[]} */ (r[1])[0])
}

/** @type {(t: unknown) => string} */
const named = t => text(definition(/** @type {const} */ (['T', t])))

export const proof = {
    /** Names follow Rust's. */
    names: () => {
        assertEq(snake('parentPath'), 'parent_path')
        assertEq(snake('readFile'), 'read_file')
        assertEq(snake('rm'), 'rm')
        assertEq(pascal('notImplemented'), 'NotImplemented')
    },
    /** The vocabulary the operations use. */
    types: () => {
        assertEq(text(rustType(string)), 'String')
        assertEq(text(rustType(number)), 'f64')
        assertEq(text(rustType(boolean)), 'bool')
        assertEq(text(rustType(bigint)), 'BigInt<A>')
        assertEq(text(rustType(array(bigint))), 'Vec<BigInt<A>>')
        assertEq(text(rustType(array(string))), 'Vec<String>')
        assertEq(text(rustType(undefined)), '()')
        assertEq(text(rustType(or(undefined))), '()')
        assertEq(text(rustType(or(number, null))), 'Option<f64>')
        assertEq(text(rustType(or(null, string))), 'Option<String>')
        assertEq(text(rustType(or(['ok', string], ['error', number]))), 'Result<String, f64>')
        assertEq(text(rustType(dirent)), 'Dirent')
        assertEq(text(rustType(array(dirent))), 'Vec<Dirent>')
    },
    /** What the printer cannot spell it refuses, with the schema in the reason. */
    refusals: () => {
        assertEq(reason(rustType(7)), 'no Rust type for a constant or an unnamed container')
        assertEq(reason(rustType({ a: string })), 'no Rust type for a constant or an unnamed container')
        assertEq(reason(rustType(record(string))), 'no Rust type for a schema')
        assertEq(reason(rustType(or(string, number))), 'no Rust type for a union')
        assertEq(reason(rustType(or(['ok', string], ['fail', number]))), 'no Rust type for a union')
        assertEq(reason(rustType(or(['ok', string, string], ['error', string]))), 'no Rust type for a union')
        assertEq(reason(rustType(or(['ok', string], ['error', string, string]))), 'no Rust type for a union')
        assertEq(reason(rustType(or(null, null))), 'no Rust type for an Option of nothing')
        assertEq(reason(dataType(bigint)), 'no Rust type for a bigint in a type that is not generic')
        assertEq(reason(dataType(or(null, bigint))), 'no Rust type for a bigint in a type that is not generic')
        assertEq(reason(rustType(array(record(string)))), 'no Rust type for a schema')
        assertEq(reason(rustType(or(null, record(string)))), 'no Rust type for a schema')
        assertEq(reason(rustType(or(['ok', record(string)], ['error', string]))), 'no Rust type for a schema')
        assertEq(reason(rustType(or(['ok', string], ['error', record(string)]))), 'no Rust type for a schema')
    },
    /** A struct's members: required, optional, a flag, and one with nothing to carry. */
    struct: () => {
        assertEq(
            named({ a: string, b: or(option, number), c: or(option, true), d: true }),
            '#[derive(Debug, Clone, PartialEq)]\npub struct T {\n    pub a: String,\n    pub b: Option<f64>,\n    pub c: bool,\n}\n')
        assertEq(named({ d: true }), '#[derive(Debug, Clone, PartialEq)]\npub struct T;\n')
        assertEq(named({ aB: or(option, string, undefined) }), '#[derive(Debug, Clone, PartialEq)]\npub struct T {\n    pub a_b: Option<String>,\n}\n')
        assertEq(reason(definition(['T', { a: or(option, string, number) }])), 'no Rust type for an optional member of several types')
        assertEq(reason(definition(['T', { a: record(string) }])), 'no Rust type for a schema')
        assertEq(reason(definition(['T', { a: bigint }])), 'no Rust type for a bigint in a type that is not generic')
        assertEq(named({ entry: dirent, n: string }), '#[derive(Debug, Clone, PartialEq)]\npub struct T {\n    pub entry: Dirent,\n    pub n: String,\n}\n')
        assertEq(reason(definition(['T', { inner: { a: string } }])), 'no Rust type for a constant or an unnamed container')
        assertEq(reason(definition(['T', { e: ['x', string] }])), 'no Rust type for a constant or an unnamed container')
    },
    /** A named schema that is neither a struct, an enum nor a tuple is refused, as is a mixed union. */
    namedRefusals: () => {
        const what = 'no Rust definition for a named schema that is not a struct, an enum or a tuple'
        assertEq(reason(definition(['T', array(string)])), what)
        assertEq(reason(definition(['T', string])), what)
        assertEq(reason(definition(['T', 5])), what)
        assertEq(reason(definition(['T', null])), what)
        assertEq(reason(definition(['T', [5]])), what)
        assertEq(reason(definition(['T', or('a', 5)])), 'no Rust variant for a schema that is not a tagged tuple')
        assertEq(reason(definition(['T', or('a', ['b', string])])), 'no Rust variant for a schema that is not a tagged tuple')
    },
    /** A union of strings is a unit enum, and one of tagged tuples an enum of variants. */
    enums: () => {
        assertEq(named(or('a', 'bC')), '#[derive(Debug, Clone, PartialEq)]\npub enum T {\n    A,\n    BC,\n}\n')
        assertEq(
            named(or(['one', string, number], ['two'])),
            '#[derive(Debug, Clone, PartialEq)]\npub enum T {\n    One(String, f64),\n    Two,\n}\n')
        assertEq(reason(definition(['T', or(['one', record(string)])])), 'no Rust type for a schema')
        assertEq(reason(definition(['T', or(['one'], string)])), 'no Rust variant for a schema that is not a tagged tuple')
    },
    /** A tagged tuple on its own is a tuple struct. */
    tuple: () => {
        assertEq(named(['tag', string]), '#[derive(Debug, Clone, PartialEq)]\npub struct T(pub String);\n')
        assertEq(reason(definition(['T', ['tag', record(string)]])), 'no Rust type for a schema')
    },
    /** Parameters: plain, optional, a named struct, a constant (none) and a failing one. */
    methods: () => {
        assertEq(text(method(mkdir)), '    fn mkdir(&mut self, path: String, options: Option<MakeDirectoryOptions>) -> Result<(), IoChannel>;')
        assertEq(text(method(readdir)), '    fn readdir(&mut self, path: String, options: ReaddirOptions) -> Result<Vec<Dirent>, IoChannel>;')
        assertEq(text(method(write)), '    fn write(&mut self, stream: WriteConsoles, data: BigInt<A>) -> Result<(), NotImplemented>;')
        assertEq(reason(method({ name: 'op', params: [{ a: string }, string], answer: undefined, names: ['opts', 'p'] })), 'no Rust type for a constant or an unnamed container')
        assertEq(reason(method({ name: 'op', params: [['x', string]], answer: undefined, names: ['t'] })), 'no Rust type for a constant or an unnamed container')
        assertEq(text(method(read)), '    fn read(&mut self) -> Result<Option<f64>, NotImplemented>;')
        assertEq(
            reason(method({ name: 'bad', params: [record(string)], answer: undefined, names: ['x'] })),
            'no Rust type for a schema')
        assertEq(
            reason(method({ name: 'bad', params: [], answer: record(string), names: [] })),
            'no Rust type for a schema')
    },
    /** A single carried type remains optional with or without explicit `undefined`. */
    optionalParameters: () => {
        for (const t of [or(option, string), or(option, string, undefined)]) {
            assertEq(
                text(method({ name: 'optional', params: [t], answer: undefined, names: ['valueName'] })),
                '    fn optional(&mut self, value_name: Option<String>) -> ();')
        }
    },
    /** Never silently select the first of several carried types, or invent a type for none. */
    optionalParameterRefusals: () => {
        for (const t of [
            or(option, string, number),
            or(option, number, string),
            or(option, string, number, undefined),
            or(option),
            or(option, undefined),
        ]) {
            const refused = assertError(method({ name: 'bad', params: [t], answer: undefined, names: ['x'] }))
            assertEq(refused[0], 'no Rust type for an optional parameter without exactly one carried type')
            assertEq(refused[1], t)
        }
    },
    /** One method per operation, and every named type defined once. */
    generate: () => {
        const out = text(generate())
        assert(out.startsWith('// @generated by `npm run gen`'), out)
        for (const [name] of types) { assert(out.includes(`pub struct ${name}`) || out.includes(`pub enum ${name}`), name) }
        for (const o of Object.values(operations)) { assert(out.includes(`fn ${snake(o.name)}(&mut self`), o.name) }
        assertEq(out.split('pub trait Operations').length, 2)
    },
    /** Each operation names every parameter it takes. */
    parameterNames: () => {
        for (const o of Object.values(operations)) { assertEq(o.names.length, o.params.length) }
        assertStructurallySame(notImplemented, ['notImplemented', string])
    },
}
