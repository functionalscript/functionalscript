const i = require('.')

const lib = require('../lib')

/** @type {<T>(_: T | undefined) => T} */
const cast = x => x === undefined ? lib.panic('x') : x

lib.panic_if('isRelative')(i.isRelative('a/b/c'.split('/')))
lib.panic_if('!isRelative')(!i.isRelative('./a/b/c'.split('/')))
lib.panic_if('pathNorm')(cast(i.pathNorm('a/../b'.split('/'))).join('/') !== 'b')
lib.panic_if('pathNorm')(cast(i.pathNorm('a/../b/../c'.split('/'))).join('/') !== 'c')
lib.panic_if('pathNorm')(cast(i.pathNorm('./a/../b/c/..//d/'.split('/'))).join('/') !== 'b/d')

{
    /** @type {{ [_ in string]: i.Package|i.Packages}} */
    const packages = {
        a: { 
            packages: () => undefined,
            file: path => {
                /** @type {{ [_ in string]?: string}} */
                const f = {
                    'index.js': 'a ./index.js',
                }
                return f[path]
            }
        },
        b: s => {
            /** @type {{ [_ in string]: i.Package|i.Packages}} */
            const p = {
                c: { 
                    packages: () => undefined,
                    file: path => {
                        /** @type {{ [_ in string]?: string}} */
                        const f = {
                            'index.js': 'b/c ./index.js',
                            'x/index.js': 'b/c ./x/index.js',
                        }
                        return f[path]
                    }
                }
            }
            return p[s]
        }
    }
    /** @type {i.Package} */
    const pack = {
        packages: s => packages[s],
        file: path => {
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': './index.js',
                'index/index.js': './index/index.js',
                'a/index.js': './a/index.js',
                'a/index.js.js': './a/index.js.js',
            }
            return f[path] 
        }
    }
    lib.panic_if('getModule')(i.getModule(pack)([]) !== undefined)
    lib.panic_if('getModule')(i.getModule(pack)(['..']) !== undefined)
    lib.panic_if('getModule')(i.getModule(pack)(['.']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index.js']) !== './index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'index', '']) !== './index/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a']) !== './a/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a', 'index']) !== './a/index.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'a', 'index.js']) !== './a/index.js.js')
    lib.panic_if('getModule')(i.getModule(pack)(['.', 'x']) !== undefined)
    lib.panic_if('getModule in package')(i.getModule(pack)(['a']) !== 'a ./index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['a', 'index']) !== 'a ./index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['b']) !== undefined)    
    lib.panic_if('getModule in package')(i.getModule(pack)(['b', 'c']) !== 'b/c ./index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['b', 'c', 'index']) !== 'b/c ./index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['b', 'c', 'index.js']) !== 'b/c ./index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['b', 'c', 'x']) !== 'b/c ./x/index.js')
    lib.panic_if('getModule in package')(i.getModule(pack)(['b', 'c', 'r', '..']) !== 'b/c ./index.js')
}
