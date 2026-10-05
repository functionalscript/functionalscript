/**
 * @import { Result } from '../../../../types/result/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { array, bigint, boolean, number, option, or, record, string } from '../../../../rtti/module.f.mjs'
import { dirent, fileModule, ioChannel, makeDirectoryOptions, mkdir, operations, read, readdirOptions, writeConsoles } from '../../module.f.mjs'
import { call, definitionReader, definitionWriter, generate, parameter, read as readAs, reach, write as writeAs } from './module.f.mjs'

/** @type {(r: Result<unknown, readonly unknown[]>) => any} */
const text = r => {
    assertEq(r[0], 'ok')
    return r[1]
}

/** @type {(r: Result<unknown, readonly unknown[]>) => string} */
const reason = r => {
    assertEq(r[0], 'error')
    return /** @type {string} */ (/** @type {readonly unknown[]} */ (r[1])[0])
}

const x = 'x'

export const proof = {
    /** What a request holds is read by a function of its own or by the helper over its parts. */
    reading: () => {
        assertEq(text(readAs(string, x)), 'decode_string(x)')
        assertEq(text(readAs(number, x)), 'decode_number(x)')
        assertEq(text(readAs(boolean, x)), 'decode_bool(x)')
        assertEq(text(readAs(bigint, x)), 'decode_bytes(x)')
        assertEq(text(readAs(dirent, x)), 'decode_dirent(x)')
        assertEq(text(readAs(array(string), x)), 'decode_array(x, decode_string)')
        assertEq(text(readAs(or(string, null), x)), 'decode_nullable(x, decode_string)')
        assertEq(text(readAs(array(or(null, number)), x)), 'decode_array(x, |v| decode_nullable(v, decode_number))')
        assertEq(reason(readAs(record(string), x)), 'no reader for a schema')
        assertEq(reason(readAs(7, x)), 'no reader for a schema')
        assertEq(reason(readAs(or(['ok', string], ['error', string]), x)), 'no reader for a Result')
        assertEq(reason(readAs(array(record(string)), x)), 'no reader for a schema')
    },
    /** What an answer holds is written the same way, and a `Result` and a nothing are written too. */
    writing: () => {
        assertEq(text(writeAs(string, x)), 'encode_string(x)')
        assertEq(text(writeAs(number, x)), 'encode_number(x)')
        assertEq(text(writeAs(boolean, x)), 'encode_bool(x)')
        assertEq(text(writeAs(bigint, x)), 'encode_bytes(x)')
        assertEq(text(writeAs(undefined, x)), 'encode_nothing(x)')
        assertEq(text(writeAs(or(undefined), x)), 'encode_nothing(x)')
        assertEq(text(writeAs(fileModule, x)), 'encode_file_module(x)')
        assertEq(text(writeAs(array(string), x)), 'encode_array(x, encode_string)')
        assertEq(text(writeAs(or(number, null), x)), 'encode_nullable(x, encode_number)')
        assertEq(
            text(writeAs(or(['ok', array(string)], ['error', string]), x)),
            'encode_result(x, |v| encode_array(v, encode_string), encode_string)')
        assertEq(reason(writeAs(record(string), x)), 'no writer for a schema')
        assertEq(reason(writeAs(7, x)), 'no writer for a schema')
        assertEq(reason(writeAs(or(['ok', record(string)], ['error', string]), x)), 'no writer for a schema')
        assertEq(reason(writeAs(or(['ok', string], ['error', record(string)]), x)), 'no writer for a schema')
        assertEq(reason(writeAs(or(string, number), x)), 'no writer for a schema')
    },
    /** A struct is read closed, member by member. */
    structReader: () => {
        assertEq(
            text(definitionReader(['T', { a: string, b: or(option, number), c: or(option, true), d: true }])),
            [
                '#[rustfmt::skip]',
                'fn decode_t<A: IVm>(any: Any<A>) -> Result<T, Malformed> {',
                '    let object = decode_object(any, &["a", "b", "c", "d"])?;',
                '    decode_true(required(&object, "d")?)?;',
                '    Ok(T {',
                '        a: decode_string(required(&object, "a")?)?,',
                '        b: decode_optional(member(&object, "b"), decode_number)?,',
                '        c: decode_flag(member(&object, "c"))?,',
                '    })',
                '}',
                '',
            ].join('\n'))
        assertEq(text(definitionReader(['T', { d: true }])).includes('    Ok(T)\n'), true)
        assertEq(reason(definitionReader(['T', { d: false }])), 'no reader for a constant')
        assertEq(reason(definitionReader(['T', { d: or(option, string, number) }])), 'no reader for an optional member of several types')
        assertEq(reason(definitionReader(['T', { d: record(string) }])), 'no reader for a schema')
        assertEq(reason(definitionReader(['T', { d: or(option, record(string)) }])), 'no reader for a schema')
    },
    /** A union of strings is read as one of them; the rest of what a request cannot hold is refused. */
    otherReaders: () => {
        assertEq(
            text(definitionReader(['T', or('a', 'bC', 'd')])),
            [
                '#[rustfmt::skip]',
                'fn decode_t<A: IVm>(any: Any<A>) -> Result<T, Malformed> {',
                '    Ok(match decode_choice(any, &["a", "bC", "d"])? {',
                '        0 => T::A,',
                '        1 => T::BC,',
                '        _ => T::D,',
                '    })',
                '}',
                '',
            ].join('\n'))
        assertEq(reason(definitionReader(['T', ['tag', string]])), 'no reader for a tagged tuple')
        assertEq(reason(definitionReader(['T', or(['a'], ['b'])])), 'no reader for a union of tagged tuples')
    },
    /** A struct is written member by member, a member that is not there left out. */
    structWriter: () => {
        assertEq(
            text(definitionWriter(['T', { a: string, b: or(option, number), c: or(option, true), d: true }])),
            [
                '#[rustfmt::skip]',
                'fn encode_t<A: IVm>(value: T) -> Any<A> {',
                '    encode_object(vec![',
                '        Some(("a", encode_string(value.a))),',
                '        value.b.map(|v| ("b", encode_number(v))),',
                '        value.c.then(|| ("c", encode_bool(true))),',
                '        Some(("d", encode_bool(true))),',
                '    ])',
                '}',
                '',
            ].join('\n'))
        assertEq(text(definitionWriter(['T', { d: true }])).includes('fn encode_t<A: IVm>(_value: T)'), true)
        assertEq(reason(definitionWriter(['T', { d: false }])), 'no writer for a constant')
        assertEq(reason(definitionWriter(['T', { d: or(option, string, number) }])), 'no writer for an optional member of several types')
        assertEq(reason(definitionWriter(['T', { d: record(string) }])), 'no writer for a schema')
        assertEq(reason(definitionWriter(['T', { d: or(option, record(string)) }])), 'no writer for a schema')
    },
    /** Unions of strings and of tagged tuples, and a tagged tuple on its own, are written as the value they were. */
    otherWriters: () => {
        assertEq(
            text(definitionWriter(['T', or('a', 'bC')])),
            [
                '#[rustfmt::skip]',
                'fn encode_t<A: IVm>(value: T) -> Any<A> {',
                '    match value {',
                '        T::A => encode_string("a".to_string()),',
                '        T::BC => encode_string("bC".to_string()),',
                '    }',
                '}',
                '',
            ].join('\n'))
        assertEq(
            text(definitionWriter(['T', or(['one', string, number], ['two'])])),
            [
                '#[rustfmt::skip]',
                'fn encode_t<A: IVm>(value: T) -> Any<A> {',
                '    match value {',
                '        T::One(f0, f1) => encode_tuple("one", vec![encode_string(f0), encode_number(f1)]),',
                '        T::Two => encode_tuple("two", vec![]),',
                '    }',
                '}',
                '',
            ].join('\n'))
        assertEq(
            text(definitionWriter(['T', ['tag', string]])),
            [
                '#[rustfmt::skip]',
                'fn encode_t<A: IVm>(value: T) -> Any<A> {',
                '    encode_tuple("tag", vec![encode_string(value.0)])',
                '}',
                '',
            ].join('\n'))
        assertEq(reason(definitionWriter(['T', ['tag', record(string)]])), 'no writer for a schema')
        assertEq(reason(definitionWriter(['T', or(['one', record(string)])])), 'no writer for a schema')
    },
    /** A parameter is read as it is, optionally, as a nullable, or checked where it is a constant. */
    parameters: () => {
        assertStructurallySame(text(parameter('path', string, 0)), ['let path = decode_string(argument(payload, 0, "path")?)?;', 'path'])
        assertStructurallySame(
            text(parameter('parentPath', or(string, null), 1)),
            ['let parent_path = decode_nullable(argument(payload, 1, "parentPath")?, decode_string)?;', 'parent_path'])
        assertStructurallySame(
            text(parameter('options', mkdir.params[1], 1)),
            ['let options = decode_optional(payload.get(1).cloned(), decode_make_directory_options)?;', 'options'])
        assertStructurallySame(text(parameter('options', readdirOptions, 1)), ['let options = decode_readdir_options(argument(payload, 1, "options")?)?;', 'options'])
        assertStructurallySame(text(parameter('stream', 'stdin', 0)), ['decode_literal(argument(payload, 0, "stream")?, "stdin")?;', undefined])
        assertEq(reason(parameter('stream', 7, 0)), 'no reader for a constant parameter')
        assertEq(reason(parameter('stream', or(option, string, number), 0)), 'no reader for an optional parameter of several types')
        assertEq(reason(parameter('stream', record(string), 0)), 'no reader for a schema')
    },
    /** An operation reads its request, runs its method and writes the answer. */
    call: () => {
        assertEq(
            text(call(read)),
            [
                '#[rustfmt::skip]',
                'fn call_read<A: IVm, R: Operations>(runner: &mut R, payload: &[Any<A>]) -> Result<Any<A>, Malformed> {',
                '    decode_literal(argument(payload, 0, "stream")?, "stdin")?;',
                '    Ok(encode_result(runner.read(), |v| encode_nullable(v, encode_number), encode_not_implemented))',
                '}',
                '',
            ].join('\n'))
        assertEq(reason(call({ name: 'bad', params: [record(string)], answer: undefined, names: ['x'] })), 'no reader for a schema')
        assertEq(reason(call({ name: 'bad', params: [], answer: record(string), names: [] })), 'no writer for a schema')
    },
    /** The named types a schema reaches, each once. */
    reach: () => {
        const names = (/** @type {unknown} */ t) => [t].reduce(reach, []).map(([n]) => n)
        assertEq(names(string).length, 0)
        assertEq(names(array(dirent)).join(), 'Dirent')
        assertEq(names(or(null, fileModule)).join(), 'FileModule')
        assertEq(names(['ok', dirent]).join(), 'Dirent')
        assertEq(names(ioChannel).join(), 'IoChannel,IoErrorInfo')
        assertEq([dirent, dirent, makeDirectoryOptions, writeConsoles].reduce(reach, []).map(([n]) => n).join(), 'Dirent,MakeDirectoryOptions,WriteConsoles')
        assertEq(names(7).length, 0)
    },
    /** One call per operation, read and written types in the order declared, and one `dispatch`. */
    generate: () => {
        const out = text(generate())
        assert(out.startsWith('// @generated by `npm run gen`'), out)
        for (const o of Object.values(operations)) { assert(out.includes(`"${o.name}" => Some(call_`), o.name) }
        assertEq(out.split('pub fn dispatch').length, 2)
        assert(out.indexOf('fn decode_make_directory_options') < out.indexOf('fn decode_write_consoles'), out)
        assert(out.indexOf('fn encode_not_implemented') < out.indexOf('fn encode_dirent'), out)
    },
}
