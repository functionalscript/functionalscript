const _ = require('.')
const { todo } = require('../../dev')
const map = require('../../types/map')
const module_ = require('../module')
const function_ = require('../module/function')
const result = require('../../types/result')
const package_ = require('../package')

/** @type {{ readonly [k in string]?: result.Result<function_.Function_, unknown> }} */
const compileMap = {
    ':a': [
        'ok',
        require_ => m0 => {
            let m = m0
            m = require_('./b')(m0)[1];
            return [['ok', ':a'], m]
        }]
}

/** @type {function_.Compile} */
const compile = source => compileMap[source] ?? ['error', 'invalid source']

/** @type {{ readonly [k in string]?: { readonly [k in string]?: string } }} */
const packageMap = {
    '': {
        'index.js': ':a'
    }
}

/** @type {package_.Get} */
const packageGet = packageId => {
    const p = packageMap[packageId]
    if (p === undefined) { return undefined }
    return {
        dependency: () => undefined,
        file: file => p[file]
    }
}

const getOrBuild = _.getOrBuild
    (compile)
    (packageGet)
    (/** @type {module_.MapInterface<map.Map<module_.State>>} */(map))

{
    const [r] = getOrBuild({ package: '', path: ['index.js'] })(undefined)
    console.log(JSON.stringify(r))
}
