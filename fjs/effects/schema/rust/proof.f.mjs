/**
 * @import { Result } from '../../../types/result/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { array, bigint, boolean, number, option, or, record, string } from '../../../rtti/module.f.mjs'
import { dirent, mkdir, notImplemented, operations, read, readdir, write } from '../module.f.mjs'
import { definition, generate, method, pascal, rustType, snake, types } from './module.f.mjs'

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
        assertEq(text(rustType(bigint)), 'Vec<u8>')
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
        assertEq(text(method(write)), '    fn write(&mut self, stream: WriteConsoles, data: Vec<u8>) -> Result<(), NotImplemented>;')
        assertEq(text(method(read)), '    fn read(&mut self) -> Result<Option<f64>, NotImplemented>;')
        assertEq(
            reason(method({ name: 'bad', params: [record(string)], answer: undefined, names: ['x'] })),
            'no Rust type for a schema')
        assertEq(
            reason(method({ name: 'bad', params: [], answer: record(string), names: [] })),
            'no Rust type for a schema')
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
