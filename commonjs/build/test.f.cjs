const _ = require('./module.f.cjs')
const map = require('../../types/map/module.f.cjs')
const module_ = require('../module/module.f.cjs')
const function_ = require('../module/function/module.f.cjs')
const result = require('../../types/result/module.f.cjs')
const package_ = require('../package/module.f.cjs')
const { at } = require('../../types/object/module.f.cjs')

/** @type {{ readonly [k in string]?: result.Result<function_.Function_, unknown> }} */
const compileMap = {
    ':index.js': [
        'ok',
        require_ => m0 => {
            let [r, m] = require_('./b')(m0);
            if (r[0] === 'error') { throw JSON.stringify(r) }
            [r, m] = require_('./a/')(m);
            if (r[0] === 'error') { throw JSON.stringify(r) }
            [r, m] = require_('x/r')(m);
            if (r[0] === 'error') { throw JSON.stringify(r) }
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

/** @typedef {{ readonly [k in string]: string }} StringMap */

/** @type {{ readonly [k in string]: { readonly dependencies: StringMap, readonly files: StringMap }}} */
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
    const p = at(packageId)(packageMap)
    return p === null ? null :
        {
            dependency: dependency => at(dependency)(p.dependencies),
            file: file => at(file)(p.files),
        }
}

const getOrBuild = _.getOrBuild
    (compile)
    (packageGet)
    (/** @type {module_.MapInterface<map.Map<module_.State>>} */(map))

module.exports = () => {
    let [r, m] = getOrBuild({ package: '', path: ['index.js'] })(map.empty)
    {
        const x = JSON.stringify(r)
        if (x !==
            '["ok",{"exports":":index.js","requireMap":{"./a/":"/a/index.js","./b":"/b.js","x/r":"/node_modules/x/r.js"}}]'
        ) {
            throw x
        }
    }
    {
        [r, m] = getOrBuild({ package: '', path: ['b.js'] })(m)
        const x = JSON.stringify(r)
        if (x !==
            '["ok",{"exports":":b.js","requireMap":{}}]'
        ) {
            throw x
        }
    }
    {
        [r, m] = getOrBuild({ package: '', path: ['c.js'] })(m)
        const x = JSON.stringify(r)
        if (x !==
            '["error",["file not found"]]'
        ) {
            throw x
        }
    }
}
