import * as _ from './module.f.ts'
const { join, concat, repeat, cmp } = _
import * as list from '../list/module.f.ts'
const { repeat: repeatList } = list

export default {
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
