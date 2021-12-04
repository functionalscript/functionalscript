const _ = require('.')
const json = require('../../../json')
const { sort } = require('../../../types/object')
const seq = require('../../../types/sequence')

{
    if (!_.isDependenciesJson(undefined)) { throw 'error' }
    if (_.isDependenciesJson(null)) { throw 'error' }
    if (!_.isDependenciesJson({})) { throw 'error' }
    if (!_.isDependenciesJson({'a':'b'})) { throw 'error' }
    if (_.isDependenciesJson({ 'a': 12 })) { throw 'error' }
}

/** @type {(g: _.GlobalPath|undefined) => string} */
const stringify = g => {
    if (g === undefined) { throw g }
    return json.stringify(sort)(g)
}

{
    if (_.idPath(undefined)(['a', 'b']) !== undefined) { throw 'error' }
    if (_.idPath({})(['b']) !== undefined) { throw 'error' }
    if (_.idPath({b:'x'})(['d']) !== undefined) { throw 'error'}
    {
        const result = stringify(_.idPath({ b: 'x' })(['b']))
        if (result !== '["x",""]') { throw result }
    }
}
