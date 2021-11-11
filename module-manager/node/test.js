const lib = require('../../lib')
const mm = require('..')
const i = require('.')

/** @type {{ [_ in string]: string}} */
const files = {
    'index.js': './index.js',
    'a/index.js': './a/index.js',
    'a/b/x.js': './a/b/x.js',
    'c/t.js': './c/t.js',
    'node_modules/@functionalscript/functionalscript/package.json': '',
    'node_modules/@functionalscript/functionalscript/index.js': '@functionalscript/functionalscript ./index.js',
    'node_modules/my/package.json': '',
    'node_modules/my/src/x.js': 'my ./src/x.js',
    'node_modules/my/b/index.js': 'my ./b/index.js',
}

/** @type {(_: string[]) => string|undefined} */
const readFile = path => files[path.join('/')]

const root = i(readFile)

{
    const index = mm.getModule(root)(['.'])
    if (index === undefined) { throw 'no module' }
    if (index.source !== './index.js') { throw 'source' }
    if (index.location.local.join('/') !== '') { throw 'location' }
    if (index.location.pack.id.join('/') !== '') { throw 'pack.id' }
    const a = mm.getModule(index.location)(['.', 'a'])   
    if (a === undefined) { throw 'no module' }
    if (a.source !== './a/index.js') { throw 'source' }
    if (a.location.local.join('/') !== 'a') { throw 'location' }
    if (a.location.pack.id.join('/') !== '') { throw 'pack.id' }
    const abx = mm.getModule(a.location)(['.', 'b', 'x'])
    if (abx === undefined) { throw 'no module' }
    if (abx.source !== './a/b/x.js') { throw 'source' }
    if (abx.location.local.join('/') !== 'a/b') { throw 'location' }
    if (abx.location.pack.id.join('/') !== '') { throw 'pack.id' }
    const ct = mm.getModule(abx.location)(['..', '..', 'c', 't.js'])
    if (ct === undefined) { throw 'no module' }
    if (ct.source !== './c/t.js') { throw 'source' }
    if (ct.location.local.join('/') !== 'c') { throw 'location' }
    if (ct.location.pack.id.join('/') !== '') { throw 'pack.id' }
    if (mm.getModule(ct.location)(['.', 'd']) !== undefined) { throw 'no module' }
    if (mm.getModule(ct.location)(['@functionalscript']) !== undefined) { throw 'no module' }
    const fs = mm.getModule(ct.location)(['@functionalscript', 'functionalscript'])
    if (fs === undefined) { throw 'no module' }
    if (fs.source !== '@functionalscript/functionalscript ./index.js') { throw 'source' }
    if (fs.location.local.join('/') !== '') { throw 'location' }
    if (fs.location.pack.id.join('/') !== 'node_modules/@functionalscript/functionalscript') { throw 'pack.id' }
    if (mm.getModule(fs.location)(['my', 'src', 'x', '']) !== undefined) { throw 'no module '}
    const mySrcX = mm.getModule(fs.location)(['my', 'src', 'x'])
    if (mySrcX === undefined) { throw 'no module' }
    if (mySrcX.source !== 'my ./src/x.js') { throw 'source' }
    if (mySrcX.location.local.join('/') !== 'src') { throw 'location' }
    if (mySrcX.location.pack.id.join('/') !== 'node_modules/my') { throw 'pack.id' }
    const myB = mm.getModule(mySrcX.location)(['..', 'b', ''])
    if (myB === undefined) { throw 'no module' }
    if (myB.source !== 'my ./b/index.js') { throw 'source' }
    if (myB.location.local.join('/') !== 'b') { throw 'location' }
    if (myB.location.pack.id.join('/') !== 'node_modules/my') { throw 'pack.id' }
}