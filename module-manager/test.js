const i = require('.')

const lib = require('../lib')

require('./node/test')

/** @type {<T>(_: T | undefined) => T} */
const cast = x => x === undefined ? lib.panic('x') : x

lib.panic_if('isRelative')(i.isRelative('a/b/c'.split('/')))
lib.panic_if('!isRelative')(!i.isRelative('./a/b/c'.split('/')))
lib.panic_if('pathNorm')(cast(i.pathNorm('a/../b'.split('/'))).join('/') !== 'b')
lib.panic_if('pathNorm')(cast(i.pathNorm('a/../b/../c'.split('/'))).join('/') !== 'c')
lib.panic_if('pathNorm')(cast(i.pathNorm('./a/../b/c/..//d/'.split('/'))).join('/') !== 'b/d')

{
    /** @type {i.Package} */
    const a = { 
        packages: () => undefined,
        file: path => {
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': 'a ./index.js',
            }
            return f[path.join('/')]
        }
    }
    /** @type {i.Package} */
    const c = { 
        packages: () => undefined,
        file: path => {
            const pathStr = path.join('/')
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': 'b/c ./index.js',
                'x/index.js': 'b/c ./x/index.js',
            }
            return ['.js', '', 'undefined.js'].includes(pathStr) ? lib.panic('.js') : f[pathStr]
        }
    }
    /** @type {{ [_ in string]: i.Package|i.Packages}} */
    const packages = {
        a,
        b: s => {
            /** @type {{ [_ in string]: i.Package|i.Packages}} */
            const p = { c }
            return p[s]
        }
    }
    /** @type {i.Package} */
    const pack = {
        packages: s => packages[s],
        file: path => {
            const pathStr = path.join('/')
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': './index.js',
                'index/index.js': './index/index.js',
                'a/index.js': './a/index.js',
                'a/index.js.js': './a/index.js.js',
            }
            return ['.js', '', 'undefined.js'].includes(pathStr) ? lib.panic('.js') : f[pathStr] 
        }
    }
    /** @type {(_: i.Module|undefined) => (_: i.Module) => void} */
    const expect = a => b => {            
        if (a === undefined) { throw 'undefined' }
        if (a.location.local.join('/') !== b.location.local.join('/')) { throw 'local'}
        if (a.location.pack !== b.location.pack) { throw 'pack' }
        if (a.source !== b.source) { throw 'source' }
    }
    {        
        const g = i.getModule({pack, local: []})
        lib.panic_if('getModule')(g([]) !== undefined)
        lib.panic_if('getModule')(g(['..']) !== undefined)
        expect(g(['.']))({ location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index']))({ location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index.js']))({ location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index', '']))({ location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'a']))({ location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['.', 'a', 'index']))({ location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['.', 'a', 'index.js']))({ location: { pack, local: ['a']}, source: './a/index.js.js'})
        lib.panic_if('getModule')(g(['.', 'x']) !== undefined)
        expect(g(['a']))({ location: { pack: a, local: []}, source: 'a ./index.js'})
        expect(g(['a', 'index']))({ location: { pack: a, local: []}, source: 'a ./index.js'})
        lib.panic_if('getModule')(g(['b']) !== undefined)
        expect(g(['b', 'c']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index.js']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'x']))({ location: { pack: c, local: ['x']}, source: 'b/c ./x/index.js'})
        expect(g(['b', 'c', 'r', '..']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
    }
    {
        const g = i.getModule({pack, local: ['index']})
        lib.panic_if('getModule')(g([]) !== undefined)
        expect(g(['..']))({ location: { pack, local: []}, source: './index.js'})
        expect(g(['.']))({ location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'index']))({ location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'index.js']))({ location: { pack, local: ['index']}, source: './index/index.js'})
        lib.panic_if('getModule')(g(['.', 'index', '']) !== undefined)
        lib.panic_if('getModule')(g(['.', 'a']) !== undefined)
        expect(g(['..', 'a']))({ location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['..', 'a', 'index']))({ location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['..', 'a', 'index.js']))({ location: { pack, local: ['a']}, source: './a/index.js.js'})
        lib.panic_if('getModule')(g(['.', 'x']) !== undefined)
        expect(g(['a']))({ location: { pack: a, local: []}, source: 'a ./index.js'})
        expect(g(['a', 'index']))({ location: { pack: a, local: []}, source: 'a ./index.js'})
        lib.panic_if('getModule')(g(['b']) !== undefined)
        expect(g(['b', 'c']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index.js']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'x']))({ location: { pack: c, local: ['x']}, source: 'b/c ./x/index.js'})
        expect(g(['b', 'c', 'r', '..']))({ location: { pack: c, local: []}, source: 'b/c ./index.js'})
    }    
}
