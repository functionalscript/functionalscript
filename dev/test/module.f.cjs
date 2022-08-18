const { todo } = require('../module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const function_ = require('../../commonjs/module/function/module.f.cjs')
const package_ = require('../../commonjs/package/module.f.cjs')

/**
 * @type {(c: function_.Compile) =>
 *  (files: string) =>
 *  (packageGet: package_.Get) =>
 *  never}
 */
const test = compile => files => packageGet => {
    return todo()
}

module.exports = {
    /** @readonly */
    test,
}