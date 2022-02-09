const _ = require('.')

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
}