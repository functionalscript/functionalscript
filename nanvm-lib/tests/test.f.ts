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

const u_p = (n: any | null): number => {
    return +n
}

const u_p_nan = (n: any | null): void => {
    let r = +n
    if (Number.isNaN(r)) { } else { throw [JSON.stringify(r), ' is not NaN'] }
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
    unary_plus: {
        null_: () => {
            e(u_p(null))(0)
        },
        undefined_: () => {
            u_p_nan(undefined)
        },
        boolean: () => {
            e(u_p(false))(0)
            // HELP! Why does this case break?!
            //n(u_p(true))(1)
        }
    }
}
