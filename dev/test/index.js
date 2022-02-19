const { todo } = require('..')
const function_ = require('../../commonjs/module/function')

/** @type {(c: function_.Compile) => never} */
const test = compile => todo()

module.exports = {
    /** @readonly */
    test,
}