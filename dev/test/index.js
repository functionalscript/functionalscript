const { todo } = require('..')
const list = require('../../types/list')
const function_ = require('../../commonjs/module/function')
const package_ = require('../../commonjs/package')

/**
 * @type {(c: function_.Compile) =>
 *  (files: string) =>
 *  (packageGet: package_.Get) =>
 *  }
 */
const test = compile => files => packageGet => {
    return todo()
}

module.exports = {
    /** @readonly */
    test,
}