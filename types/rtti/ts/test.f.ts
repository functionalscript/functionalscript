import { toTs } from './module.f.ts'
import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.ts'

const eq = (result: string, expected: string) => {
    if (result !== expected) { throw `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}` }
}

export default {
    tag0: {
        boolean: () => eq(toTs(boolean), 'boolean'),
        number:  () => eq(toTs(number),  'number'),
        string:  () => eq(toTs(string),  'string'),
        bigint:  () => eq(toTs(bigint),  'bigint'),
        unknown: () => eq(toTs(unknown), 'unknown'),
    },
    tag1: {
        array: {
            primitive: () => eq(toTs(array(number)),             'readonly(number)[]'),
            nested:    () => eq(toTs(array(array(boolean))),     'readonly(readonly(boolean)[])[]'),
            union:     () => eq(toTs(array(or(number, string))), 'readonly(number|string)[]'),
        },
        record: {
            primitive: () => eq(toTs(record(string)),        '{readonly[k in string]:string}'),
            nested:    () => eq(toTs(record(record(number))), '{readonly[k in string]:{readonly[k in string]:number}}'),
        },
    },
    const: {
        null:      () => eq(toTs(null),      'null'),
        undefined: () => eq(toTs(undefined), 'undefined'),
        true:      () => eq(toTs(true),      'true'),
        false:     () => eq(toTs(false),     'false'),
        number:    () => eq(toTs(42),        '42'),
        string:    () => eq(toTs('hello'),   '"hello"'),
        bigint:    () => eq(toTs(7n),        '7n'),
        emptyTuple:  () => eq(toTs([]),               'readonly[]'),
        tuple:       () => eq(toTs([12, true] as const), 'readonly[12,true]'),
        emptyStruct: () => eq(toTs({}),      '{}'),
        struct: () => eq(
            toTs({ a: number, b: string } as const),
            '{readonly "a":number;readonly "b":string}',
        ),
        nestedStruct: () => eq(
            toTs({ x: { y: boolean } as const } as const),
            '{readonly "x":{readonly "y":boolean}}',
        ),
        quotedKey: () => eq(
            toTs({ 'my-key': number } as const),
            '{readonly "my-key":number}',
        ),
        stringWithQuote: () => eq(toTs('say "hi"'), '"say \\"hi\\""'),
        keyWithQuote: () => eq(
            toTs({ 'a"b': number } as const),
            '{readonly "a\\"b":number}',
        ),
    },
    constThunk: {
        primitive: () => eq(toTs(() => ['const', 42n] as const), '42n'),
        string:    () => eq(toTs(() => ['const', 'hi'] as const), '"hi"'),
    },
    or: {
        consts:  () => eq(toTs(or(false as const, 42 as const, 'hello' as const)), 'false|42|"hello"'),
        thunks:  () => eq(toTs(or(number, string)), 'number|string'),
        mixed:   () => eq(toTs(or(42 as const, string)), '42|string'),
    },
    option: () => eq(toTs(option(number)), 'number|undefined'),
}
