const _ = require('.')
const json = require('../../json')
const { identity } = require('../../types/function')
const { at } = require('../../types/object')

/** @type {(g: json.Unknown|undefined) => string} */
const stringify = g => {
    if (g === undefined) { throw g }
    return json.stringify(identity)(g)
}

{
    const p = { name: '', version: '' }
    const result = _.parseLocal('')('./a')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a"]}') { throw result }
}

{
    const result = _.parseLocal('')('./a/')
    if (stringify(result) !== '{"external":false,"dir":true,"items":["a"]}') { throw result }
}

{
    const result = _.parseLocal('')('..')
    if (result !== undefined) { throw result }
}

{
    const result = _.parseLocal('a')('')
    if (stringify(result) !== '{"external":true,"dir":false,"items":[]}') { throw result }
}

{
    const result = _.parseLocal('')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a","c"]}') { throw result }
}

{
    const result = _.parseLocal('x/r')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["x","r","a","c"]}') { throw result }
}

{
    const result = _.parseLocal('a')('a/b/.././c')
    if (stringify(result) !== '{"external":true,"dir":false,"items":["a","c"]}') { throw result }
}

{
    if (_.parseGlobal(() => undefined)(false)(['a', 'b']) !== undefined) { throw 'error' }
    if (_.parseGlobal(() => undefined)(false)(['b']) !== undefined) { throw 'error' }
    if (_.parseGlobal(d => at(d)({ b: 'x' }))(false)(['d']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ b: 'x' }))(false)(['b']))
        if (result !== '["x",""]') { throw result }
    }
    if (_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b', 'r']))
        if (result !== '["x",""]') { throw result }
    }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b', 'r', 'd', 't']))
        if (result !== '["x","d/t"]') { throw result }
    }
}
