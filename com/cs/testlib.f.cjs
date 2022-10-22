const { flat } = require('../../text/module.f.cjs');
const { join } = require('../../types/string/module.f.cjs');
const { cs } = require('./module.f.cjs');
const library = require('../types/testlib.f.cjs')

module.exports = join('\n')(flat('    ')(cs('My')(library)))
