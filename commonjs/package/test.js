const _ = require('.')

{
    if (_.isPackage(null)) { throw 'error' }
    if (_.isPackage({})) { throw 'error' }
    if (_.isPackage({version:12})) { throw 'error' }
    if (!_.isPackage({version:"12"})) { throw 'error' }
    if (_.isPackage({version:"",dependencies:[]})) { throw 'error' }
    if (!_.isPackage({ version: "", dependencies: {} })) { throw 'error' }
    if (_.isPackage({ version: "", dependencies: { x: 12} })) { throw 'error' }
    if (!_.isPackage({ version: "", dependencies: { x: "12" } })) { throw 'error' }
}

module.exports = {}
