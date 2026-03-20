import { validate } from './module.f.ts'

type Tests = {
    readonly[K in string]: readonly unknown[]
}

const tests: Tests = {
    undefined: [undefined],
    boolean: [true, false],
    string: ['hello'],
    number: [3],
    bigint: [4n],
    object: [null, {}, []],
    function: [() => undefined]
}

const assertOk = ([k]: readonly [string, unknown]) => { if (k !== 'ok') { throw 'expected ok' } }
const assertError = ([k]: readonly [string, unknown]) => { if (k !== 'error') { throw 'expected error' } }

export default {
    typeof: Object.fromEntries(Object.entries(tests).map(([k, a]) => [k, a.map(v => () => {
        if (typeof v !== k) { throw `typeof ${v} !== ${k}` }
    })])),
    validate: {
        undefined: {
            ok: () => assertOk(validate('undefined')(undefined)),
            error: () => assertError(validate('undefined')(null)),
        },
        boolean: {
            ok: () => {
                assertOk(validate('boolean')(true))
                assertOk(validate('boolean')(false))
            },
            error: () => assertError(validate('boolean')(0)),
        },
        string: {
            ok: () => assertOk(validate('string')('hello')),
            error: () => assertError(validate('string')(42)),
        },
        number: {
            ok: () => assertOk(validate('number')(3)),
            error: () => assertError(validate('number')('hello')),
        },
        bigint: {
            ok: () => assertOk(validate('bigint')(4n)),
            error: () => assertError(validate('bigint')(4)),
        },
        null: {
            ok: () => assertOk(validate('null')(null)),
            error: () => {
                assertError(validate('null')(undefined))
                assertError(validate('null')({}))
            },
        },
        array: {
            ok: () => {
                assertOk(validate('array')([]))
                assertOk(validate('array')([1, 2]))
            },
            error: () => {
                assertError(validate('array')({}))
                assertError(validate('array')(null))
            },
        },
        record: {
            ok: () => {
                assertOk(validate('record')({}))
                assertOk(validate('record')({ x: 1 }))
            },
            error: () => {
                assertError(validate('record')([]))
                assertError(validate('record')(null))
            },
        },
        function: {
            ok: () => assertOk(validate('function')(() => {})),
            error: () => assertError(validate('function')(null)),
        },
        lazy: {
            ok: () => assertOk(validate(() => 'string')('hello')),
            error: () => assertError(validate(() => 'string')(42)),
        },
        struct: {
            ok: () => assertOk(validate({ name: 'string', age: 'number' })({ name: 'alice', age: 30 })),
            missingField: () => assertError(validate({ name: 'string' })({})),
            wrongFieldType: () => assertError(validate({ name: 'string' })({ name: 42 })),
            notObject: () => assertError(validate({ name: 'string' })(null)),
        },
    }
}
