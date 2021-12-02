const _ = require('.')
const json = require('../../json')
const { identity, compose } = require('../../types/function')
const seq = require('../../types/sequence')

const stringify = json.stringify(identity)

{
    const result = _.parse('')('./a')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a"]}') { throw result }
}

{
    const result = _.parse('')('./a/')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":false,"dir":true,"items":["a"]}') { throw result }
}

{
    const result = _.parse('')('..')
    if (result !== undefined) { throw result }
}

{
    const result = _.parse('a')('')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":true,"dir":false,"items":[]}') { throw result }
}

{
    const result = _.parse('')('./a/b/.././c')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a","c"]}') { throw result }
}

{
    const result = _.parse('x/r')('./a/b/.././c')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":false,"dir":false,"items":["x","r","a","c"]}') { throw result }
}

{
    const result = _.parse('a')('a/b/.././c')
    if (result === undefined) { throw result }
    if (stringify(result) !== '{"external":true,"dir":false,"items":["a","c"]}') { throw result }
}
