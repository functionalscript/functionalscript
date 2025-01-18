import { join, concat, repeat, cmp } from './module.f.ts'
import { repeat as repeatList } from '../list/module.f.ts'

export default {
    example: () => {
        const words = ['hello', 'world']
        if (join(' ')(words) !== 'hello world') { throw 0 }
        if (concat(words) !== 'helloworld') { throw 1 }
        if (repeat('abc')(3) !== 'abcabcabc') { throw 2 }
        if (cmp('apple')('banana') !== -1) { throw 3 }
    },
    join: {
        0: () => {
            const result = join('/')([])
            if (result !== '') { throw result }
        },
        1: () => {
            const result = join('/')([''])
            if (result !== '') { throw result }
        },
        3: () => {
            const result = join(' ')(['hello', 'world', '!'])
            if (result !== 'hello world !') { throw result }
        }
    },
    concat: () => {
        const result = concat(['hello', 'world'])
        if (result !== 'helloworld') { throw result }
    },
    repeatList: {
        0: () => {
            const s = join('.')(repeatList('x')(0))
            if (s != '') { throw s }
        },
        5: () => {
            const s = join('.')(repeatList('x')(5))
            if (s != 'x.x.x.x.x') { throw s }
        }
    },
    repeat: () => {
        const s = repeat('x')(5)
        if(s != 'xxxxx') { throw s }
    },
    cmp: () => {
        const result = cmp('3')('4')
        if (result !== -1) { throw result }
    }
}
