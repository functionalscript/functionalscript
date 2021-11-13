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
        dependencies: () => undefined,
        file: path => {
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': 'a ./index.js',
            }
            return f[path.join('/')]
        },
        id: ['a']
    }
    /** @type {i.Package} */
    const c = { 
        dependencies: () => undefined,
        file: path => {
            const pathStr = path.join('/')
            /** @type {{ [_ in string]?: string}} */
            const f = {
                'index.js': 'b/c ./index.js',
                'x/index.js': 'b/c ./x/index.js',
            }
            return ['.js', '', 'undefined.js'].includes(pathStr) ? lib.panic('.js') : f[pathStr]
        },
        id: ['c']
    }
    /** @type {{ [_ in string]: i.Package|i.Dependencies}} */
    const packages = {
        a,
        b: s => {
            /** @type {{ [_ in string]: i.Package|i.Dependencies}} */
            const p = { c }
            return p[s]
        }
    }
    /** @type {i.Package} */
    const pack = {
        dependencies: s => packages[s],
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
        },
        id: ['']
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
        expect(g(['.']))({ fileName: 'index.js', location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index']))({ fileName: 'index.js', location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index.js']))({ fileName: 'index.js', location: { pack, local: []}, source: './index.js'})
        expect(g(['.', 'index', '']))({ fileName: 'index.js', location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'a']))({ fileName: 'index.js', location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['.', 'a', 'index']))({ fileName: 'index.js', location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['.', 'a', 'index.js']))({ fileName: 'index.js.js', location: { pack, local: ['a']}, source: './a/index.js.js'})
        lib.panic_if('getModule')(g(['.', 'x']) !== undefined)
        expect(g(['a']))({ fileName: 'index.js', location: { pack: a, local: []}, source: 'a ./index.js'})
        expect(g(['a', 'index']))({ fileName: 'index.js', location: { pack: a, local: []}, source: 'a ./index.js'})
        lib.panic_if('getModule')(g(['b']) !== undefined)
        expect(g(['b', 'c']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index.js']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'x']))({ fileName: 'index.js', location: { pack: c, local: ['x']}, source: 'b/c ./x/index.js'})
        expect(g(['b', 'c', 'r', '..']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
    }
    {
        const g = i.getModule({pack, local: ['index']})
        lib.panic_if('getModule')(g([]) !== undefined)
        expect(g(['..']))({ fileName: 'index.js', location: { pack, local: []}, source: './index.js'})
        expect(g(['.']))({ fileName: 'index.js', location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'index']))({ fileName: 'index.js', location: { pack, local: ['index']}, source: './index/index.js'})
        expect(g(['.', 'index.js']))({ fileName: 'index.js', location: { pack, local: ['index']}, source: './index/index.js'})
        lib.panic_if('getModule')(g(['.', 'index', '']) !== undefined)
        lib.panic_if('getModule')(g(['.', 'a']) !== undefined)
        expect(g(['..', 'a']))({ fileName: 'index.js', location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['..', 'a', 'index']))({ fileName: 'index.js', location: { pack, local: ['a']}, source: './a/index.js'})
        expect(g(['..', 'a', 'index.js']))({ fileName: 'index.js.js', location: { pack, local: ['a']}, source: './a/index.js.js'})
        lib.panic_if('getModule')(g(['.', 'x']) !== undefined)
        expect(g(['a']))({ fileName: 'index.js', location: { pack: a, local: []}, source: 'a ./index.js'})
        expect(g(['a', 'index']))({ fileName: 'index.js', location: { pack: a, local: []}, source: 'a ./index.js'})
        lib.panic_if('getModule')(g(['b']) !== undefined)
        expect(g(['b', 'c']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'index.js']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
        expect(g(['b', 'c', 'x']))({ fileName: 'index.js', location: { pack: c, local: ['x']}, source: 'b/c ./x/index.js'})
        expect(g(['b', 'c', 'r', '..']))({ fileName: 'index.js', location: { pack: c, local: []}, source: 'b/c ./index.js'})
    }    
}
