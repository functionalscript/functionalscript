const _ = require('.')

{
    const r = _.set('hello')(undefined)
    if (!_.contains('hello')(r)) { throw 'hello' }
    if (_.contains('hello1')(r)) { throw 'hello' }
}