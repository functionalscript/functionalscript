const _ = require('.')
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
            const [r1, m1] = require_('./b')(m0);
            if (r1[0] === 'error') { throw r1 }
            const [r2, m2] = require_('./a/')(m1);
            if (r2[0] === 'error') { throw r2 }
            return [['ok', ':index.js'], m2]
        }],
    ':b.js': [
        'ok',
        () => m0 => {
            return [['ok', ':b.js'], m0]
        }],
    ':a/index.js': [
        'ok',
        () => m0 => {
            return [['ok', ':a/index.js'], m0]
        }]
}

/** @type {function_.Compile} */
const compile = source => compileMap[source] ?? ['error', 'invalid source']

/** @type {{ readonly [k in string]?: { readonly [k in string]?: string } }} */
const packageMap = {
    '': {
        'index.js': ':index.js',
        'b.js': ':b.js',
        'a/index.js': ':a/index.js',
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
    if (JSON.stringify(r) !==
        '["ok",{"exports":":index.js","requireMap":{"./a/":"/a/index.js","./b":"/b.js"}}]'
    ) {
        throw r
    }
}
