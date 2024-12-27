import { at } from './module.f.ts'

export default {
    ctor: () => {
        const a = {}
        const value = at('constructor')(a)
        if (value !== null) { throw value }
    },
    property: () => {
        const a = { constructor: 42 }
        const value = at('constructor')(a)
        if (value !== 42) { throw value }
    }
}
