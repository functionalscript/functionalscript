const { join, concat, repeat, cmp } = require('./module.f.cjs')
const { repeat: repeatList } = require('../list/module.f.cjs')

{
    const result = join('/')([])
    if (result !== '') { throw result }
}

{
    const result = join('/')([''])
    if (result !== '') { throw result }
}

{
    const result = join(' ')(['hello', 'world', '!'])
    if (result !== 'hello world !') { throw result }
}

{
    const result = concat(['hello', 'world'])
    if (result !== 'helloworld') { throw result }
}

module.exports = {
    repeatList0: () => {
        const s = join('.')(repeatList('x')(0))
        if (s != '') { throw s }
    },
    repeatList5: () => {
        const s = join('.')(repeatList('x')(5))
        if (s != 'x.x.x.x.x') { throw s }
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
