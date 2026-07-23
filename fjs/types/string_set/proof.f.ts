import { contains, fromValues, remove, set } from './module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = {
    example: () => {
        let mySet = fromValues(['apple', 'banana', 'cherry']);
        assert(contains('banana')(mySet), '1')
        assert(!(contains('date')(mySet)), '2')

        mySet = set('date')(mySet);
        assert(contains('date')(mySet), '3')

        mySet = remove('banana')(mySet);
        assert(!(contains('banana')(mySet)), '4')
    },
    contains: () => {
        const r = set('hello')(null)
        assert(contains('hello')(r), r)
        assert(!(contains('hello1')(r)), r)
    },
    remove: () => {
        let r = set('hello')(null)
        r = set('world')(r)
        r = set('HELLO')(r)
        r = set('WORLD!')(r)
        assert(contains('hello')(r), r)
        assert(!(contains('hello1')(r)), r)
        assert(contains('HELLO')(r), r)
        assert(!(contains('WORLD')(r)), r)
        assert(contains('world')(r), r)
        assert(!(contains('world!')(r)), r)
        assert(contains('WORLD!')(r), r)
        //
        r = remove('hello')(r)
        assert(!(contains('hello')(r)), r)
        assert(contains('world')(r), r)
        r = remove('world')(r)
        assert(!(contains('world')(r)), r)
        assert(contains('HELLO')(r), r)
        r = remove('HELLO')(r)
        assert(!(contains('HELLO')(r)), r)
        assert(contains('WORLD!')(r), r)
        r = remove('WORLD!')(r)
        assertEq(r, null)
    }
}
