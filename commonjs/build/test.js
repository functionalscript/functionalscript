const _ = require('./index.js')
const map = require('../../types/map/index.js')
const module_ = require('../module/index.js')
const function_ = require('../module/function/index.js')
const result = require('../../types/result/index.js')
const package_ = require('../package/index.js')

/** @type {{ readonly [k in string]?: result.Result<function_.Function_, unknown> }} */
const compileMap = {
    ':index.js': [
        'ok',
        require_ => m0 => {
            let [r, m] = require_('./b')(m0);
            if (r[0] === 'error') { throw r }
            [r, m] = require_('./a/')(m);
            if (r[0] === 'error') { throw r }
            [r, m] = require_('x/r')(m);
            if (r[0] === 'error') { throw r }
            return [['ok', ':index.js'], m]
        }],
    ':b.js': [
        'ok',
        () => m0 => [['ok', ':b.js'], m0]],
    ':a/index.js': [
        'ok',
        () => m0 => [['ok', ':a/index.js'], m0]],
    'x:r.js': [
        'ok',
        () => m0 => [['ok', 'x:r.js'], m0]],
}

/** @type {function_.Compile} */
const compile = source => compileMap[source] ?? ['error', 'invalid source']

/** @typedef {{ readonly [k in string]?: string }} StringMap */

/** @type {{ readonly [k in string]?: { readonly dependencies: StringMap, files: StringMap }}} */
const packageMap = {
    '': {
        dependencies: {
            'x': '/node_modules/x'
        },
        files: {
            'index.js': ':index.js',
            'b.js': ':b.js',
            'a/index.js': ':a/index.js',
        }
    },
    '/node_modules/x': {
        dependencies: {},
        files: {
            'r.js': 'x:r.js'
        }
    },
}

/** @type {package_.Get} */
const packageGet = packageId => {
    const p = packageMap[packageId]
    return p === undefined ? undefined :
        {
            dependency: dependency => p.dependencies[dependency],
            file: file => p.files[file]
        }
}

const getOrBuild = _.getOrBuild
    (compile)
    (packageGet)
    (/** @type {module_.MapInterface<map.Map<module_.State>>} */(map))

{
    let [r, m] = getOrBuild({ package: '', path: ['index.js'] })(undefined)
    if (JSON.stringify(r) !==
        '["ok",{"exports":":index.js","requireMap":{"./a/":"/a/index.js","./b":"/b.js","x/r":"/node_modules/x/r.js"}}]'
    ) {
        throw r
    }
    [r, m] = getOrBuild({ package: '', path: ['b.js'] })(m)
    if (JSON.stringify(r) !==
        '["ok",{"exports":":b.js","requireMap":{}}]'
    ) {
        throw r
    }
    [r, m] = getOrBuild({ package: '', path: ['c.js']})(m)
    if (JSON.stringify(r) !==
        '["error",["file not found"]]'
    ) {
        throw r
    }
}
