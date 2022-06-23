const _ = require('./main.js')
const run = require('../../commonjs/module/function/main.f.js')

// ok:
{
    const source = 'module.exports = "Hello world!"'
    const m = _.compile(source)
    if (m[0] !== 'ok') { throw m }
    const [result] = m[1](() => { throw 0 })(undefined)
    if (result[0] !== 'ok') { throw result }
    if (result[1] !== 'Hello world!') { throw result }
}

// compilation error:
{
    const source = '+'
    const m = _.compile(source)
    if (m[0] !== 'error') { throw m }
}

// compilation error with "use strict;":
{
    const source = 'const x = 04'
    const m = _.compile(source)
    if (m[0] !== 'error') { throw m }
}

// runtime error:
{
    const source = 'a = 5'
    const m = _.compile(source)
    if (m[0] !== 'ok') { throw m }
    const [result] = m[1](() => { throw 0 })(undefined)
    if (result[0] !== 'error') { throw result }
}

//
{
    const depSource = 'module.exports = 137'
    const d = _.compile(depSource)
    if (d[0] !== 'ok') { throw d }

    /** @type {run.Require<number>} */
    const req = path => prior => {
        if (path !== 'm') { throw path }
        return d[1](req)(prior + 1)
    }

    let info = 0
    {
        const source = 'module.exports = require("m") + 42'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }

        const [result, newInfo] = m[1](req)(info)
        if (result[0] !== 'ok') { throw result }
        if (result[1] !== 179) { throw result }
        info = newInfo
    }

    {
        const source = 'module.exports = require("x") + 42'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }

        const [result, infox] = m[1](req)(info)
        if (result[0] !== 'error') { throw result }
        if (infox !== 1) { throw info }
    }
}

module.exports = {}
