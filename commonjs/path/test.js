const _ = require('.')
const { todo } = require('../../dev')
const json = require('../../json')
const { identity } = require('../../types/function')
const object = require('../../types/object')
const { at } = require('../../types/object')
const package_ = require('../package')

/** @type {(g: json.Unknown|undefined) => string} */
const stringify = g => {
    if (g === undefined) { throw g }
    return json.stringify(identity)(g)
}

{
    const p = { name: '', version: '' }
    const result = _.parseLocal('')('./a')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a"]}') { throw result }
}

{
    const result = _.parseLocal('')('./a/')
    if (stringify(result) !== '{"external":false,"dir":true,"items":["a"]}') { throw result }
}

{
    const result = _.parseLocal('')('..')
    if (result !== undefined) { throw result }
}

{
    const result = _.parseLocal('a')('')
    if (stringify(result) !== '{"external":true,"dir":true,"items":[]}') { throw result }
}

{
    const result = _.parseLocal('')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["a","c"]}') { throw result }
}

{
    const result = _.parseLocal('x/r')('./a/b/.././c')
    if (stringify(result) !== '{"external":false,"dir":false,"items":["x","r","a","c"]}') { throw result }
}

{
    const result = _.parseLocal('a')('a/b/.././c')
    if (stringify(result) !== '{"external":true,"dir":false,"items":["a","c"]}') { throw result }
}

{
    const result = _.parseLocal('')('./x/..')
    if (stringify(result) !== '{"external":false,"dir":true,"items":[]}') { throw result }
}

{
    if (_.parseGlobal(() => undefined)(false)(['a', 'b']) !== undefined) { throw 'error' }
    if (_.parseGlobal(() => undefined)(false)(['b']) !== undefined) { throw 'error' }
    if (_.parseGlobal(d => at(d)({ b: 'x' }))(false)(['d']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ b: 'x' }))(false)(['b']))
        if (result !== '{"packageId":"x","items":[],"dir":false}') { throw result }
    }
    if (_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b']) !== undefined) { throw 'error' }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b', 'r']))
        if (result !== '{"packageId":"x","items":[],"dir":false}') { throw result }
    }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(false)(['b', 'r', 'd', 't']))
        if (result !== '{"packageId":"x","items":["d","t"],"dir":false}') { throw result }
    }
    {
        const result = stringify(_.parseGlobal(d => at(d)({ 'b/r': 'x' }))(true)(['b', 'r', 'd', 't']))
        if (result !== '{"packageId":"x","items":["d","t"],"dir":true}') { throw result }
    }
}

{
    /** @type {object.Map<package_.Package>} */
    const packages = {
        '': {
            dependency: () => todo(),
            file: path => at(path)({ 'a/c': 'return "a/c"' }),
        }
    }
    const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('../c'))
    if (result !== '{"package":"","file":"a/c","source":"return \\"a/c\\""}') { throw result }
}

{
    /** @type {object.Map<package_.Package>} */
    const packages = {
        '': {
            dependency: x => {
                const path = `node_modules/${x}`
                return at(path)(packages) !== undefined ? path : undefined
            },
            file: path => at(path)({
                'index.js': 'return "index.js"',
                'x/index.js': 'return "x/index.js"',
                'x.js': 'return "x.js"',
            })
        },
        'node_modules/z': {
            dependency: () => todo(),
            file: path => at(path)({ 'a/c/index.js': 'return "a/c"' }),
        }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('z/a/c'))
        if (result !== '{"package":"node_modules/z","file":"a/c/index.js","source":"return \\"a/c\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('../..'))
        if (result !== '{"package":"","file":"index.js","source":"return \\"index.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('')('./x'))
        if (result !== '{"package":"","file":"x.js","source":"return \\"x.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('')('./x.js'))
        if (result !== '{"package":"","file":"x.js","source":"return \\"x.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('')('./x/'))
        if (result !== '{"package":"","file":"x/index.js","source":"return \\"x/index.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('x/a')('../'))
        if (result !== '{"package":"","file":"x/index.js","source":"return \\"x/index.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('x/a')('..'))
        if (result !== '{"package":"","file":"x/index.js","source":"return \\"x/index.js\\""}') { throw result }
    }
}

{
    /** @type {object.Map<package_.Package>} */
    const packages = {
        '': {
            dependency: x => {
                const path = `node_modules/${x}`
                return at(path)(packages) !== undefined ? path : undefined
            },
            file: todo
        },
        'node_modules/z/a': {
            dependency: () => todo(),
            file: path => at(path)({
                'c/index.js': 'return "c/index.js"',
                'c.js': 'return "c.js"'
            }),
        }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('z/a/c'))
        if (result !== '{"package":"node_modules/z/a","file":"c.js","source":"return \\"c.js\\""}') { throw result }
    }
    {
        const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('z/a/c/'))
        if (result !== '{"package":"node_modules/z/a","file":"c/index.js","source":"return \\"c/index.js\\""}') { throw result }
    }
}

{
    /** @type {object.Map<package_.Package>} */
    const packages = {
        '': {
            dependency: x => {
                const path = `node_modules/${x}`
                return at(path)(packages) !== undefined ? path : undefined
            },
            file: todo
        },
        'node_modules/z/a/c': {
            dependency: () => todo(),
            file: path => at(path)({
                '': 'throw',
                '.js': 'throw',
                'index.js': 'return "a/c"'
            }),
        }
    }
    const result = stringify(_.parseAndFind(p => at(p)(packages))('')('a/b')('z/a/c'))
    if (result !== '{"package":"node_modules/z/a/c","file":"index.js","source":"return \\"a/c\\""}') { throw result }
}