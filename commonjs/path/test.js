const _ = require('.')
const json = require('../../json')
const { identity } = require('../../types/function')

/** @type {(g: json.Unknown|undefined) => string} */
const stringify = g => {
    if (g === undefined) { throw g }
    return json.stringify(identity)(g)
}

{
    const result = _.parse('')('./a')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a"]}') { throw result }
}

{
    const result = _.parse('')('./a/')
    if (stringify(result) !== '{"external":false,"dir":true,"items":["a"]}') { throw result }
}

{
    const result = _.parse('')('..')
    if (result !== undefined) { throw result }
}

{
    const result = _.parse('a')('')
    if (stringify(result) !== '{"external":true,"dir":false,"items":[]}') { throw result }
}

{
    const result = _.parse('')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a","c"]}') { throw result }
}

{
    const result = _.parse('x/r')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["x","r","a","c"]}') { throw result }
}

{
    const result = _.parse('a')('a/b/.././c')
    if (stringify(result) !== '{"external":true,"dir":false,"items":["a","c"]}') { throw result }
}

{
    if (_.path(undefined)(['a', 'b']) !== undefined) { throw 'error' }
    if (_.path({})(['b']) !== undefined) { throw 'error' }
    if (_.path({ b: 'x' })(['d']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.path({ b: 'x' })(['b']))
        if (result !== '["x",""]') { throw result }
    }
    if (_.path({ 'b/r': 'x' })(['b']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.path({ 'b/r': 'x' })(['b', 'r']))
        if (result !== '["x",""]') { throw result }
    }
    {
        const result = stringify(_.path({ 'b/r': 'x' })(['b', 'r', 'd', 't']))
        if (result !== '["x","d/t"]') { throw result }
    }
}
