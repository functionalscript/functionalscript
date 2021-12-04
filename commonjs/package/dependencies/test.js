const _ = require('.')

{
    if (!_.isDependencies(undefined)) { throw 'error' }
    if (_.isDependencies(null)) { throw 'error' }
}
