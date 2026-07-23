const { is } = Object;

const ois = (a: unknown) => (b: unknown): void => {
    if (is(a, b)) { } else { throw [a, 'is', b] }
}

const { isNaN } = Number;

const nanRes = (op: (n: unknown) => unknown) => (n: unknown): void => {
    const result = op(n);
    if (!isNaN(result)) {
        throw result
    }
}

const stringCoercion = String

export const proof = {
    eq: () => {
        const e = (a: unknown) => (b: unknown): void => {
            if (a === b) { } else { throw [a, '===', b] }
        }

        const n = (a: unknown) => (b: unknown): void => {
            if (a !== b) { } else { throw [a, '!==', b] }
        }
        return {
            nullish: () => {
                e(null)(null)
                e(undefined)(undefined)
                n(null)(undefined)
            },
            boolean: {
                boolean: () => {
                    e(true)(true)
                    e(false)(false)
                    n(true)(false)
                },
                nullish: () => {
                    n(false)(undefined)
                    n(false)(null)
                }
            },
            number: {
                number: () => {
                    e(2.3)(2.3)
                    n(2.3)(-5.4)
                    n(NaN)(NaN)
                    e(0)(-0)
                    if (!is(-0, -0)) { throw -0 }
                    if (is(0, -0)) { throw -0 }
                    e(Infinity)(Infinity)
                    e(-Infinity)(-Infinity)
                    n(Infinity)(-Infinity)
                },
                nullish: () => {
                    n(undefined)(NaN)
                    n(undefined)(0)
                }
            },
            string: {
                string: () => {
                    e("hello")("hello")
                    n("hello")("world")
                },
                number: () => {
                    n(0)("0")
                }
            },
            bigint: {
                bigint: () => {
                    e(12n)(12n)
                    n(12n)(-12n)
                    n(12n)(13n)
                }
            },
            array: {
                array: () => {
                    const a: any = []
                    e(a)(a)
                    n([])([])
                    const a0 = ['0']
                    e(a0)(a0)
                }
            },
            object: {
                object: () => {
                    const o = { '0': '0' }
                    e(o)(o)
                    n(o)({ '0': '0' })
                }
            }
        }
    },
    unary_plus: () => {
        const op = (n: any) => +n
        const nan = nanRes(op)
        return {
            null: () => ois(op(null))(0),
            undefined: () => nan(undefined),
            boolean: {
                false: () => ois(op(false))(0),
                true: () => ois(op(true))(1)
            },
            number: {
                zero: () => ois(op(0))(0),
                positive: () => ois(op(2.3))(2.3),
                negative: () => ois(op(-2.3))(-2.3)
            },
            string: {
                empty: () => ois(op(""))(0),
                zero: () => ois(op("0"))(0),
                positive: () => ois(op("2.3"))(2.3),
                nan: () => nan("a")
            },
            bigint: {
                throw: () => op(0n),
            },
            array: {
                empty: () => ois(op([]))(0),
                single_number: () => ois(op([2.3]))(2.3),
                single_string: () => ois(op(["-2.3"]))(-2.3),
                multiple: () => nan([null, null])
            },
            object: {
                empty: () => nan({})
                // TODO: test objects with valueOf, toString functions - when Rust logic is implemented
            },
            function: () => nan(op(() => {}))
        }
    },
    unary_minus: () => {
        const op = (n: any) => -n
        const nan = nanRes(op)
        return {
            null: () => ois(op(null))(-0),
            undefined: () => nan(undefined),
            boolean: {
                false: () => ois(op(false))(-0),
                true: () => ois(op(true))(-1)
            },
            number: {
                zero: () => ois(op(0))(-0),
                positive: () => ois(op(2.3))(-2.3),
                negative: () => ois(op(-2.3))(2.3)
            },
            string: {
                empty: () => ois(op(""))(-0),
                zero: () => ois(op("0"))(-0),
                positive: () => ois(op("2.3"))(-2.3),
                nan: () => nan("a")
            },
            bigint: {
                positive: () => ois(op(1n))(-1n),
                negative: () => ois(op(-1n))(1n),
            },
            array: {
                empty: () => ois(op([]))(-0),
                single_number: () => ois(op([2.3]))(-2.3),
                single_string: () => ois(op(["-2.3"]))(2.3),
                multiple: () => nan([null, null])
            },
            object: {
                empty: () => nan({})
                // TODO: test objects with valueOf, toString functions - when Rust logic is implemented
            },
            function: () => nan(op(() => {}))
        }
    },
    stringCoercion: {
        number: () => {
            if (stringCoercion(123) !== '123') { throw [123, 'toString', '123'] }
            if (stringCoercion(-456) !== '-456') { throw [-456, 'toString', '-456'] }
            if (stringCoercion(0) !== '0') { throw [0, 'toString', '0'] }
            if (stringCoercion(-0) !== '0') { throw [0, 'toString', '0'] }
            if (stringCoercion(1/(-0)) !== '-Infinity') { throw [0, 'toString', '-Infinity'] }
            if (stringCoercion(Infinity) !== 'Infinity') { throw [Infinity, 'toString', 'Infinity'] }
            if (stringCoercion(-Infinity) !== '-Infinity') { throw [-Infinity, 'toString', '-Infinity'] }
            if (stringCoercion(1/-Infinity) !== '0') { throw [-Infinity, 'toString', '0'] }
            if (stringCoercion(NaN) !== 'NaN') { throw [NaN, 'toString', 'NaN'] }
        },
        bool: () => {
            if (stringCoercion(true) !== 'true') { throw [true, 'toString', 'true'] }
            if (stringCoercion(false) !== 'false') { throw [false, 'toString', 'false'] }
        },
        null: () => {
            if (stringCoercion(null) !== 'null') { throw [null, 'toString', 'null'] }
        },
        undefined: () => {
            if (stringCoercion(undefined) !== 'undefined') { throw [undefined, 'toString', 'undefined'] }
        },
        bigint: () => {
            if (stringCoercion(123n) !== '123') { throw [123n, 'toString', '123'] }
            if (stringCoercion(-456n) !== '-456') { throw [-456n, 'toString', '-456'] }
        },
        array: () => {
            const arr = [1, 2, 3]
            if (stringCoercion(arr) !== '1,2,3') { throw [arr, 'toString', '1,2,3'] }
        },
        func: () => {
            const func = () => 5
            if (typeof stringCoercion(func) !== 'string') { throw [func, 'toString'] }
            // if (stringCoercion(func) !== '() => 5') { throw [func, 'toString', 'function result'] }
        },
        object: {
            norm: () => {
                const obj = { a: 1, b: 2 }
                if (stringCoercion(obj) !== '[object Object]') { throw [obj, 'toString', '[object Object]'] }
            },
            toString: () => {
                const x = { toString: () => 'custom string' }
                if (stringCoercion(x) !== 'custom string') { throw [x, 'toString', 'custom string'] }
            },
            toStringThrow: {
                throw: () => {
                    const x = { toString: () => { throw new Error('Custom error') } }
                    stringCoercion(x)
                }
            },
            toStringNotFunc: {
                throw: () => {
                    const x = { toString: 'hello' }
                    stringCoercion(x)
                }
            },
            toStringNonPrimitive: {
                throw: () => {
                    const x = { toString: () => [] }
                    stringCoercion(x)
                }
            }
        }
    }
}
