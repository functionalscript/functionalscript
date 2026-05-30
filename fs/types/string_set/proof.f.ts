import { contains, fromValues, remove, set } from './module.f.ts'

export default {
    example: () => {
        let mySet = fromValues(['apple', 'banana', 'cherry']);
        if (!contains('banana')(mySet)) { throw '1' }
        if (contains('date')(mySet)) { throw '2' }

        mySet = set('date')(mySet);
        if (!contains('date')(mySet)) { throw '3' }

        mySet = remove('banana')(mySet);
        if (contains('banana')(mySet)) { throw '4' }
    },
    contains: () => {
        const r = set('hello')(null)
        if (!contains('hello')(r)) { throw r }
        if (contains('hello1')(r)) { throw r }
    },
    remove: () => {
        let r = set('hello')(null)
        r = set('world')(r)
        r = set('HELLO')(r)
        r = set('WORLD!')(r)
        if (!contains('hello')(r)) { throw r }
        if (contains('hello1')(r)) { throw r }
        if (!contains('HELLO')(r)) { throw r }
        if (contains('WORLD')(r)) { throw r }
        if (!contains('world')(r)) { throw r }
        if (contains('world!')(r)) { throw r }
        if (!contains('WORLD!')(r)) { throw r }
        //
        r = remove('hello')(r)
        if (contains('hello')(r)) { throw r }
        if (!contains('world')(r)) { throw r }
        r = remove('world')(r)
        if (contains('world')(r)) { throw r }
        if (!contains('HELLO')(r)) { throw r }
        r = remove('HELLO')(r)
        if (contains('HELLO')(r)) { throw r }
        if (!contains('WORLD!')(r)) { throw r }
        r = remove('WORLD!')(r)
        if (r !== null) { throw r }
    }
}
