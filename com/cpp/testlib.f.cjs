const { join } = require("../../types/string/module.f.cjs");
const { flat } = require("../../text/module.f.cjs")
const library = require('../types/testlib.f.cjs')
const { cpp } = require('./module.f.cjs')

module.exports = () => join('\n')(flat('    ')(cpp('My')(library)))