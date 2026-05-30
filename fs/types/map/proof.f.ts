import { mapSet, mapDelete } from './module.f.ts'

export default {
    set: () => {
        const map = mapSet(new Map(), 'a', 'b')
        if (map.get('a') !== 'b') { throw 'error' }
        if (map.size !== 1) { throw 'error' }
    },
    delete: () => {
        const map = mapDelete(mapSet(new Map(), 'a', 'b'), 'a')
        if (map.get('a') !== undefined) { throw 'error' }
        if (map.size !== 0) { throw 'error' }
    }
}
