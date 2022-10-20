const { flat } = require('../../text/module.f.cjs');
const { join } = require('../../types/string/module.f.cjs');
const { rust } = require('./module.f.cjs');
const library = require('../types/testlib.f.cjs')

module.exports = join('\n')(flat('    ')(rust(library)))