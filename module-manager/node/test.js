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
    'node_modules/a/package.json': '',
    'node_modules/a/src/x.js': 'a ./src/x.js',
}

/** @type {(_: string[]) => string|undefined} */
const readFile = path => files[path.join('/')]

const root = i(readFile)


{
    const index = mm.getModule(root)(['.'])
    if (index === undefined) { throw 'no module' }
    if (index.source !== './index.js') { throw 'source' }
    if (index.location.local.join('/') !== '') { throw 'location' }
    const a = mm.getModule(index.location)(['.', 'a'])   
    if (a === undefined) { throw 'no module' }
    if (a.source !== './a/index.js') { throw 'source' }
    if (a.location.local.join('/') !== 'a') { throw 'location' }
    const abx = mm.getModule(a.location)(['.', 'b', 'x'])
    if (abx === undefined) { throw 'no module' }
    if (abx.source !== './a/b/x.js') { throw 'source' }
    if (abx.location.local.join('/') !== 'a/b') { throw 'location' }
    const ct = mm.getModule(abx.location)(['..', '..', 'c', 't.js'])
    if (ct === undefined) { throw 'no module' }
    if (ct.source !== './c/t.js') { throw 'source' }
    if (ct.location.local.join('/') !== 'c') { throw 'location' }
    if (mm.getModule(ct.location)(['.', 'd']) !== undefined) { throw 'no module' }
    if (mm.getModule(ct.location)(['@functionalscript']) !== undefined) { throw 'no module' }
    const fs = mm.getModule(ct.location)(['@functionalscript', 'functionalscript'])
    if (fs === undefined) { throw 'no module' }
    if (fs.source !== '@functionalscript/functionalscript ./index.js') { throw 'source' }
    if (fs.location.local.join('/') !== '') { throw 'location' }
    const aSrcX = mm.getModule(fs.location)(['a', 'src', 'x'])
    if (aSrcX === undefined) { throw 'no module' }
    if (aSrcX.source !== 'a ./src/x.js') { throw 'source' }
    if (aSrcX.location.local.join('/') !== 'src') { throw 'location' }
}