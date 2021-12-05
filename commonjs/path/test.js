const _ = require('.')
const json = require('../../json')
const { identity, compose } = require('../../types/function')
const seq = require('../../types/sequence')

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
    if (_.idPath(undefined)(['a', 'b']) !== undefined) { throw 'error' }
    if (_.idPath({})(['b']) !== undefined) { throw 'error' }
    if (_.idPath({ b: 'x' })(['d']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.idPath({ b: 'x' })(['b']))
        if (result !== '["x",""]') { throw result }
    }
    if (_.idPath({ 'b/r': 'x' })(['b']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.idPath({ 'b/r': 'x' })(['b', 'r']))
        if (result !== '["x",""]') { throw result }
    }
    {
        const result = stringify(_.idPath({ 'b/r': 'x' })(['b', 'r', 'd', 't']))
        if (result !== '["x","d/t"]') { throw result }
    }
}
