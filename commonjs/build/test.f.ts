import * as _ from './module.f.ts'
import * as map from '../../types/map/module.f.mjs'
import * as Module from '../module/module.f.ts'
import * as ModuleFunction from '../module/function/module.f.ts'
import * as Result from '../../types/result/module.f.mjs'
import * as Package from '../package/module.f.mjs'
import * as o from '../../types/object/module.f.mjs'
const { at } = o

const compileMap
    : { readonly [k in string]?: Result.Result<ModuleFunction.Function_, unknown> }
    = {
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

const compile
    : ModuleFunction.Compile
    = source => compileMap[source] ?? ['error', 'invalid source']

type StringMap = { readonly [k in string]: string }

const packageMap
    : { readonly [k in string]: { readonly dependencies: StringMap, readonly files: StringMap }}
    = {
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

const packageGet
    : Package.Get
    = packageId => {
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
    (map as Module.MapInterface<map.Map<Module.State>>)

export default () => {
    let [r, m] = getOrBuild({ package: '', path: ['index.js'] })(map.empty)
    {
        if (r === null) { throw 'r === null' }
        const x = JSON.stringify(r)
        if (x !==
            '["ok",{"exports":":index.js","requireMap":{"./a/":"/a/index.js","./b":"/b.js","x/r":"/node_modules/x/r.js"}}]'
        ) {
            throw `0:${x}`
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
