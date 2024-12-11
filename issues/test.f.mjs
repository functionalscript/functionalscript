/** @type {(a: unknown) => (i: any) =>unknown} */
const at = a => i => Object.getOwnPropertyDescriptor(a, i)?.value

export default {
    ownProperty: {
        nullish: () => {
            /* // panic
            const v = Object.getOwnPropertyDescriptor(null, 0)
            if (v !== undefined) {
                throw v
            }
            */
            /* // panic
            const v = Object.getOwnPropertyDescriptor(undefined, 0)
            if (v !== undefined) {
                throw v
            }
            */
        },
        bool: () => {
            const v = at(true)('x')
            if (v !== undefined) {
                throw v
            }
        },
        array: () => {
            const a = ['42']
            {
                const v = at(a)('0')
                if (v !== '42') { throw v }
            }
            {
                const v = at(a)(0)
                if (v !== '42') { throw v }
            }
        },
        object: {
            null: () => {
                const o = { null: 'hello' }
                const v = at(o)(null)
                if (v !== 'hello') { throw v }
            },
            undefined: () => {
                const o = { undefined: 'hello' }
                const v = at(o)(undefined)
                if (v !== 'hello') { throw v }
            }
        },
        string: {
            number: () => {
                const o = 'hello'
                const v = at(o)(1)
                if (v !== 'e') { throw v }
            }
        }
    }
}
