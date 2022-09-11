const _ = require('./module.f.cjs')

{
    const r = _.set('hello')(undefined)
    if (!_.contains('hello')(r)) { throw r }
    if (_.contains('hello1')(r)) { throw r }
}

{
    let r = _.set('hello')(undefined)
    r = _.set('world')(r)
    r = _.set('HELLO')(r)
    r = _.set('WORLD!')(r)
    if (!_.contains('hello')(r)) { throw r }
    if (_.contains('hello1')(r)) { throw r }
    if (!_.contains('HELLO')(r)) { throw r }
    if (_.contains('WORLD')(r)) { throw r }
    if (!_.contains('world')(r)) { throw r }
    if (_.contains('world!')(r)) { throw r }
    if (!_.contains('WORLD!')(r)) { throw r }
    //
    r = _.remove('hello')(r)
    if (_.contains('hello')(r)) { throw r }
    if (!_.contains('world')(r)) { throw r }
    r = _.remove('world')(r)
    if (_.contains('world')(r)) { throw r }
    if (!_.contains('HELLO')(r)) { throw r }
    r = _.remove('HELLO')(r)
    if (_.contains('HELLO')(r)) { throw r }
    if (!_.contains('WORLD!')(r)) { throw r }
    r = _.remove('WORLD!')(r)
    if (r !== undefined) { throw r }
}

module.exports = {}