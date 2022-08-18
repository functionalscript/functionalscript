const { join, concat, repeat } = require('./module.f.cjs')
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

{
    const s = join('.')(repeatList('x')(0))
    if (s != '') { throw s }
}

{
    const s = join('.')(repeatList('x')(5))
    if (s != 'x.x.x.x.x') { throw s }
}

{
    const s = repeat('x')(5)
    if (s != 'xxxxx') { throw s }
}

module.exports = {}
