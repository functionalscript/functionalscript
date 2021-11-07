const i = require('.')

const lib = require('../lib')

lib.panic_if('isRelative')(i.isRelative('a/b/c'.split('/')))
lib.panic_if('!isRelative')(!i.isRelative('./a/b/c'.split('/')))
lib.panic_if('pathNorm')(i.pathNorm('a/../b'.split('/')).join('/') !== 'b')
lib.panic_if('pathNorm')(i.pathNorm('a/../b/../c'.split('/')).join('/') !== 'c')
