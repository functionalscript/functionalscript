import { assert } from '../../../../asserts/module.f.js'
import { error } from './module.f.js'

export const proof = {
    // Each value is NaNVM's shape: the error's name, a colon, the message.
    shape: () => {
        for (const [name, value] of Object.entries(error)) {
            assert(value.startsWith('TypeError: ') || value.startsWith('RangeError: '), name)
        }
    },
}
