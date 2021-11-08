const i = require('.')

const lib = require('../lib')

lib.panic_if('isRelative')(i.isRelative('a/b/c'.split('/')))
lib.panic_if('!isRelative')(!i.isRelative('./a/b/c'.split('/')))
lib.panic_if('pathNorm')(i.pathNorm('a/../b'.split('/')).join('/') !== 'b')
lib.panic_if('pathNorm')(i.pathNorm('a/../b/../c'.split('/')).join('/') !== 'c')
lib.panic_if('pathNorm')(i.pathNorm('./a/../b/c/..//d/'.split('/')).join('/') !== 'b/d')

{
    /** @type {{ [_ in string]?: string}} */
    const f = {
        'index.js': './index.js',
        'index/index.js': './index/index.js',
        'a/index.js': './a/index.js',
        'a/index.js.js': './a/index.js.js',
    }
    /** @type {i.Package} */
    const pack = {
        packages: () => undefined,
        file: path => f[path]
    }
    lib.panic_if('getModule')(i.getModule(pack)([]) !== undefined)
    lib.panic_if('getModule')(i.getModule(pack)(['.']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index.js']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index', '']) !== './index/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a']) !== './a/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a', 'index']) !== './a/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a', 'index.js']) !== './a/index.js.js')
}
