import { join, concat, repeat, cmp, splitAt } from './module.f.ts'
import { repeat as repeatList } from '../list/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

export const proof = {
    example: () => {
        const words = ['hello', 'world']
        assert(join(' ')(words) === 'hello world', 0)
        assert(concat(words) === 'helloworld', 1)
        assert(repeat('abc')(3) === 'abcabcabc', 2)
        assert(cmp('apple')('banana') === -1, 3)
    },
    join: {
        0: () => {
            const result = join('/')([])
            assert(result === '', result)
        },
        1: () => {
            const result = join('/')([''])
            assert(result === '', result)
        },
        3: () => {
            const result = join(' ')(['hello', 'world', '!'])
            assert(result === 'hello world !', result)
        }
    },
    concat: () => {
        const result = concat(['hello', 'world'])
        assert(result === 'helloworld', result)
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
        assert(result === -1, result)
    },
    splitAt: {
        middle: () => {
            const [a, b] = splitAt(3)('hello')
            assert(a === 'hel', a)
            assert(b === 'lo', b)
        },
        zero: () => {
            const [a, b] = splitAt(0)('hello')
            assert(a === '', a)
            assert(b === 'hello', b)
        },
        full: () => {
            const [a, b] = splitAt(5)('hello')
            assert(a === 'hello', a)
            assert(b === '', b)
        },
        beyond: () => {
            const [a, b] = splitAt(10)('hello')
            assert(a === 'hello', a)
            assert(b === '', b)
        },
        empty: () => {
            const [a, b] = splitAt(0)('')
            assert(a === '', a)
            assert(b === '', b)
        },
    }
}
