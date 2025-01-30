const e = (a: unknown) => (b: unknown): void => {
    if (a === b) { } else { throw [a, '===', b] }
}

const n = (a: unknown) => (b: unknown): void => {
    if (a !== b) { } else { throw [a, '!==', b] }
}

const nan_res = (op: (n: unknown) => unknown) => (n: unknown): void => {
    const result = op(n);
    if (!Number.isNaN(result)) {
        throw result
    }
}

export default {
    eq: {
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
                if (!Object.is(-0, -0)) { throw -0 }
                if (Object.is(0, -0)) { throw -0 }
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
    },
    unary_plus: () => {
        const op = (n: any) => +n
        const nan = nan_res(op)
        return {
            null: () => e(op(null))(0),
            undefined: () => nan(undefined),
            boolean: {
                false: () => e(op(false))(0),
                true: () => e(op(true))(1)
            },
            number: {
                zero: () => e(op(0))(0),
                positive: () => e(op(2.3))(2.3),
                negative: () => e(op(-2.3))(-2.3)
            },
            string: {
                empty: () => e(op(""))(0),
                zero: () => e(op("0"))(0),
                positive: () => e(op("2.3"))(2.3),
                nan: () => nan("a")
            },
            bigint: {
                throw: () => op(0n),
            },
            array: {
                empty: () => e(op([]))(0),
                single_number: () => e(op([2.3]))(2.3),
                single_string: () => e(op(["-2.3"]))(-2.3),
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
        const nan = nan_res(op)
        return {
            null: () => e(op(null))(0),
            undefined: () => nan(undefined),
            boolean: {
                false: () => e(op(false))(0),
                true: () => e(op(true))(-1)
            },
            number: {
                zero: () => e(op(0))(0),
                positive: () => e(op(2.3))(-2.3),
                negative: () => e(op(-2.3))(2.3)
            },
            string: {
                empty: () => e(op(""))(0),
                zero: () => e(op("0"))(0),
                positive: () => e(op("2.3"))(-2.3),
                nan: () => nan("a")
            },
            bigint: {
                positive: () => e(op(1n))(-1n),
                negative: () => e(op(-1n))(1n),
            },
            array: {
                empty: () => e(op([]))(0),
                single_number: () => e(op([2.3]))(-2.3),
                single_string: () => e(op(["-2.3"]))(2.3),
                multiple: () => nan([null, null])
            },
            object: {
                empty: () => nan({})
                // TODO: test objects with valueOf, toString functions - when Rust logic is implemented
            },
            function: () => nan(op(() => {}))
        }
    }
}
