/**
 * @import { Type } from '../../rtti/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { validate } from '../../rtti/validate/module.f.mjs'
import {
    dirent, fileModule, ioChannel, ioError, makeDirectoryOptions, mkdir, notImplemented, nothing,
    operations, read, readdir, readdirOptions, readFile, resolveFileModule, rm, vec, write,
    writeBytes, writeFile,
} from './module.f.mjs'

/**
 * Whether `schema` admits `value`.
 *
 * @type {(schema: Type) => (value: unknown) => boolean}
 */
const admits = schema => value => validate(/** @type {any} */ (schema))(/** @type {any} */ (value))[0] === 'ok'

/** @type {(schema: Type, good: readonly unknown[], bad: readonly unknown[]) => void} */
const table = (schema, good, bad) => {
    for (const v of good) { assertEq(admits(schema)(v), true) }
    for (const v of bad) { assertEq(admits(schema)(v), false) }
}

const io = /** @type {const} */ (['ioError', { message: 'm' }])

export const proof = {
    /** A `Vec` is a `bigint`, and nothing is `undefined`. */
    leaves: () => {
        table(vec, [0n, 5n], [5, '5', undefined])
        table(nothing, [undefined], [null, 0])
        table(notImplemented, [['notImplemented', 'x']], [['notImplemented'], ['ioError', 'x']])
    },
    /** An error code may be absent, but not a message. */
    errors: () => {
        table(ioError, [io, ['ioError', { code: 'ENOENT', message: 'm' }]], [['ioError', {}], ['ioError', { code: 1, message: 'm' }]])
        table(ioChannel, [io, ['notImplemented', 'readFile']], [['other', 'x'], 'ioError'])
    },
    /** The structs are closed: members declared and no others. */
    structs: () => {
        table(makeDirectoryOptions, [{ recursive: true }], [{}, { recursive: false }])
        table(fileModule, [{ id: 'a', path: 'b' }], [{ id: 'a' }, { id: 'a', path: 'b', x: 1 }])
        table(readdirOptions, [{}, { recursive: true }], [{ recursive: false }])
        table(
            dirent,
            [{ name: 'a', parentPath: 'b', isFile: true, isDirectory: false }],
            [{ name: 'a', parentPath: 'b', isFile: true }])
    },
    /** Each operation's parameters, with the optional ones present and absent. */
    params: () => {
        table(mkdir.params, [['a'], ['a', { recursive: true }]], [[], ['a', {}], [1]])
        table(readFile.params, [['a']], [[], ['a', 'b']])
        table(resolveFileModule.params, [['a', null], ['a', 'b']], [['a'], [1, null]])
        table(readdir.params, [['a', {}], ['a', { recursive: true }]], [['a']])
        table(writeFile.params, [['a', 3n]], [['a'], ['a', 3]])
        table(writeBytes.params, [['a', 0, 3n]], [['a', '0', 3n]])
        table(rm.params, [['a']], [[]])
        table(write.params, [['stdout', 1n], ['stderr', 1n]], [['stdin', 1n]])
        table(read.params, [['stdin']], [['stdout']])
    },
    /** Each operation's answer: a value, a host failure, or an unimplemented operation. */
    answers: () => {
        table(readFile.answer, [['ok', 3n], ['error', io], ['error', ['notImplemented', 'x']]], [['ok', 3], ['error', 'x']])
        table(mkdir.answer, [['ok', undefined], ['error', io]], [['ok', 1]])
        table(resolveFileModule.answer, [['ok', { id: 'a', path: 'b' }]], [['ok', 'a']])
        table(
            readdir.answer,
            [['ok', []], ['ok', [{ name: 'a', parentPath: 'b', isFile: true, isDirectory: false }]]],
            [['ok', [{}]]])
        table(write.answer, [['ok', undefined], ['error', ['notImplemented', 'write']]], [['error', io]])
        table(read.answer, [['ok', 65], ['ok', null], ['error', ['notImplemented', 'read']]], [['ok', 'a'], ['error', io]])
    },
    /** An operation is found by its tag. */
    tags: () => {
        for (const [key, o] of Object.entries(operations)) { assertEq(o.name, key) }
        assertEq(Object.keys(operations).length, 9)
    },
}
