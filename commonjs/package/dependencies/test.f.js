const _ = require('./main.f.js')

{
    if (!_.isDependenciesJson(undefined)) { throw 'error' }
    if (_.isDependenciesJson(null)) { throw 'error' }
    if (!_.isDependenciesJson({})) { throw 'error' }
    if (!_.isDependenciesJson({'a':'b'})) { throw 'error' }
    if (_.isDependenciesJson({ 'a': 12 })) { throw 'error' }
}
