const _ = require('.')
const { todo } = require('../../dev')
const map = require('../../types/map')
const module_ = require('../module')
const function_ = require('../module/function')
const result = require('../../types/result')
const package_ = require('../package')

/** @type {{ readonly [k in string]?: result.Result<function_.Function_, unknown> }} */
const compileMap = {
    ':index.js': [
        'ok',
        require_ => m0 => {
            const [r, m] = require_('./b')(m0);
            if (r[0] === 'error') { throw r }
            return [['ok', ':index.js'], m]
        }],
    ':b.js': [
        'ok',
        require_ => m0 => {
            return [['ok', ':b.js'], m0]
        }]
}

/** @type {function_.Compile} */
const compile = source => compileMap[source] ?? ['error', 'invalid source']

/** @type {{ readonly [k in string]?: { readonly [k in string]?: string } }} */
const packageMap = {
    '': {
        'index.js': ':index.js',
        'b.js': ':b.js',
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
    if (JSON.stringify(r) !== '["ok",{"exports":":index.js","requireMap":{"./b":"/b.js"}}]') { throw r }
}
