const e
    : (a: unknown) => (b: unknown) => void
    = a => b => {
    if (a === b) { } else { throw [a, '===', b] }
}

const n
    : (a: unknown) => (b: unknown) => void
    = a => b => {
    if (a !== b) { } else { throw [a, '!==', b] }
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
        const op = (n: any | null): number => +n
        return () => ({
            null_: () => e(op(null))(0),
            undefined_: () => {
                const result = op(undefined)
                if (!Number.isNaN(result)) {
                    throw result
                }
            },
            boolean: {
                false: () => e(op(false))(0),
                true: () => e(op(true))(1),
            }
        })
    }
}
