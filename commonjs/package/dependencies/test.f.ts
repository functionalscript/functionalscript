import * as _ from './module.f.ts'

export default () => {
    if (!_.isDependenciesJson(null)) { throw 'error' }
    if (!_.isDependenciesJson({})) { throw 'error' }
    if (!_.isDependenciesJson({'a':'b'})) { throw 'error' }
    if (_.isDependenciesJson({ 'a': 12 })) { throw 'error' }
}
