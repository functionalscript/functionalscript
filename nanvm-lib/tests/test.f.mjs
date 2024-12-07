/** @type {(a: unknown) => (b: unknown) => void} */
const e = a => b => {
    if (a === b) { } else { throw [a, '===', b] }
}

/** @type {(a: unknown) => (b: unknown) => void} */
const n = a => b => {
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
        array: {
            array: () => {
                /** @type {any} */
                const a = []
                e(a)(a)
                n([])([])
            }
        }
    }
}