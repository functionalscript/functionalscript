const _ = require('.')
const { todo } = require('../../dev')
const map = require('../../types/map')
const module_ = require('../module')
const function_ = require('../module/function')
const result = require('../../types/result')

/** @type {{ readonly [k in string]?: result.Result<function_.Function_, unknown> }} */
const compileMap = {
    'a': ['ok', todo]
}

/** @type {function_.Compile} */
const compile = source => compileMap[source] ?? ['error', 'not found']

{
    const x = _.getOrBuild
        (compile)
        (todo)
        (/** @type {module_.MapInterface<map.Map<module_.State>>} */(map))
        ({ package: '', path: [] })
        (undefined)
}