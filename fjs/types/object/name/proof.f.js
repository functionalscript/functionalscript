import { assertEq } from '../../../asserts/module.f.js'
import { nameOf } from './module.f.js'

export const proof = {
    // The field as it was written, and as the literal it was given.
    field: () => {
        /** @type {'sha256'} */
        const name = nameOf({ name: 'sha256' })
        assertEq(name, 'sha256')
    },
    // A field of any type, as it is: `null` is a name too.
    any: () => {
        assertEq(nameOf({ name: null }), null)
        assertEq(nameOf({ name: 7 }), 7)
    },
    // Beside other fields, and in a list.
    list: () => {
        assertEq([{ name: 'a', size: 1 }, { name: 'b', size: 2 }].map(nameOf).join(), 'a,b')
    },
}
