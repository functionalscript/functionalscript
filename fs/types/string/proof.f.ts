import { join, concat, repeat, cmp, splitAt } from './module.f.ts'
import { repeat as repeatList } from '../list/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

export const proof = {
    example: () => {
        const words = ['hello', 'world']
        assertEq(join(' ')(words), 'hello world', 0)
        assertEq(concat(words), 'helloworld', 1)
        assertEq(repeat('abc')(3), 'abcabcabc', 2)
        assertEq(cmp('apple')('banana'), -1, 3)
    },
    join: {
        0: () => {
            const result = join('/')([])
            assertEq(result, '')
        },
        1: () => {
            const result = join('/')([''])
            assertEq(result, '')
        },
        3: () => {
            const result = join(' ')(['hello', 'world', '!'])
            assertEq(result, 'hello world !')
        }
    },
    concat: () => {
        const result = concat(['hello', 'world'])
        assertEq(result, 'helloworld')
    },
    repeatList: {
        0: () => {
            const s = join('.')(repeatList('x')(0))
            assert(s == '', s)
        },
        5: () => {
            const s = join('.')(repeatList('x')(5))
            assert(s == 'x.x.x.x.x', s)
        }
    },
    repeat: () => {
        const s = repeat('x')(5)
        if(s != 'xxxxx') { throw s }
    },
    cmp: () => {
        const result = cmp('3')('4')
        assertEq(result, -1)
    },
    splitAt: {
        middle: () => {
            const [a, b] = splitAt(3)('hello')
            assertEq(a, 'hel')
            assertEq(b, 'lo')
        },
        zero: () => {
            const [a, b] = splitAt(0)('hello')
            assertEq(a, '')
            assertEq(b, 'hello')
        },
        full: () => {
            const [a, b] = splitAt(5)('hello')
            assertEq(a, 'hello')
            assertEq(b, '')
        },
        beyond: () => {
            const [a, b] = splitAt(10)('hello')
            assertEq(a, 'hello')
            assertEq(b, '')
        },
        empty: () => {
            const [a, b] = splitAt(0)('')
            assertEq(a, '')
            assertEq(b, '')
        },
    }
}
