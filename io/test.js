const _ = require('.')
const run = require('../commonjs/run')
const { ok, error } = require('../result')

// ok:
{
    const source = 'module.exports = "Hello world!"'
    const m = _.compile(source)
    if (m[0] !== 'ok') { throw m }
    const [result] = m[1](() => { throw 0 })
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
    const [result] = m[1](() => { throw 0 })
    if (result[0] !== 'error') { throw result }
}

//
{
    const depSource = 'module.exports = 137'
    const d = _.compile(depSource)
    if (d[0] !== 'ok') { throw d }

    /** @type {run.Require} */
    const req = path => {
        if (path !== 'm') { throw path }
        return d[1](req)
    }

    {
        const source = 'module.exports = require("m") + 42'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }

        const [result] = m[1](req)
        if (result[0] !== 'ok') { throw result }
        if (result[1] !== 179) { throw result }
    }

    {
        const source = 'module.exports = require("x") + 42'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }

        const [result] = m[1](req)
        if (result[0] !== 'error') { throw result }
    }
}

module.exports = {}