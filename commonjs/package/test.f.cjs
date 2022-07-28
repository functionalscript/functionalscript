const _ = require('./main.f.cjs')

require('./dependencies/test.f.cjs')

{
    if (_.isPackageJson(null)) { throw 'error' }
    if (_.isPackageJson({})) { throw 'error' }
    if (_.isPackageJson({name:'x',version:12})) { throw 'error' }
    if (!_.isPackageJson({name:'x',version:"12"})) { throw 'error' }
    if (_.isPackageJson({version:"",dependencies:[]})) { throw 'error' }
    if (!_.isPackageJson({name:'a', version: "", dependencies: {} })) { throw 'error' }
    if (_.isPackageJson({name:'b', version: "", dependencies: { x: 12} })) { throw 'error' }
    if (!_.isPackageJson({name:'c', version: "", dependencies: { x: "12" } })) { throw 'error' }
}

module.exports = {}
