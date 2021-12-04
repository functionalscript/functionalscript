const _ = require('.')

require('./dependencies/test')

{
    if (_.isPackageJson(null)) { throw 'error' }
    if (_.isPackageJson({})) { throw 'error' }
    if (_.isPackageJson({version:12})) { throw 'error' }
    if (!_.isPackageJson({version:"12"})) { throw 'error' }
    if (_.isPackageJson({version:"",dependencies:[]})) { throw 'error' }
    if (!_.isPackageJson({ version: "", dependencies: {} })) { throw 'error' }
    if (_.isPackageJson({ version: "", dependencies: { x: 12} })) { throw 'error' }
    if (!_.isPackageJson({ version: "", dependencies: { x: "12" } })) { throw 'error' }
}

module.exports = {}
