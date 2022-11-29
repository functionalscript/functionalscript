const _ = require('./module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')
const json = require('../../json/module.f.cjs')
const { identity } = require('../../types/function/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const { at } = require('../../types/object/module.f.cjs')
const package_ = require('../package/module.f.cjs')

/** @type {<T>(o: object.Map<T>) => (s: string) => T|undefined} */
const i = o => s => {
    const r = at(s)(o)
    return r === null ? undefined : r
}

/** @type {(g: json.Unknown|undefined) => string} */
const stringify = g => {
    if (g === undefined) { throw g }
    return json.stringify(identity)(g)
}

module.exports = {
    0: () => {
        const result = _.parseLocal('')('./a')
        if (stringify(result) !== '{"external":false,"dir":false,"items":["a"]}') { throw result }
    },
    1: () => {
        const result = _.parseLocal('')('./a/')
        if (stringify(result) !== '{"external":false,"dir":true,"items":["a"]}') { throw result }
    },
    2: () => {
        const result = _.parseLocal('')('..')
        if (result !== null) { throw result }
    },
    3: () => {
        const result = _.parseLocal('a')('')
        if (stringify(result) !== '{"external":true,"dir":true,"items":[]}') { throw result }
    },
    4: () => {
        const result = _.parseLocal('')('./a/b/.././c')
        if (stringify(result) !== '{"external":false,"dir":false,"items":["a","c"]}') { throw result }
    },
    5: () => {
        const result = _.parseLocal('x/r')('./a/b/.././c')
        if (stringify(result) !== '{"external":false,"dir":false,"items":["x","r","a","c"]}') { throw result }
    },
    6: () => {
        const result = _.parseLocal('a')('a/b/.././c')
        if (stringify(result) !== '{"external":true,"dir":false,"items":["a","c"]}') { throw result }
    },
    7: () => {
        const result = _.parseLocal('')('./x/..')
        if (stringify(result) !== '{"external":false,"dir":true,"items":[]}') { throw result }
    },
    8: () => {
        if (_.parseGlobal(() => undefined)(false)(['a', 'b']) !== undefined) { throw 'error' }
        if (_.parseGlobal(() => undefined)(false)(['b']) !== undefined) { throw 'error' }
        if (_.parseGlobal(i({ b: 'x' }))(false)(['d']) !== undefined) { throw 'error' }
        {
            const result = stringify(_.parseGlobal(i({ b: 'x' }))(false)(['b']))
            if (result !== '{"package":"x","items":[],"dir":false}') { throw result }
        }
        if (_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b']) !== undefined) { throw 'error' }
        {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b', 'r']))
            if (result !== '{"package":"x","items":[],"dir":false}') { throw result }
        }
        {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b', 'r', 'd', 't']))
            if (result !== '{"package":"x","items":["d","t"],"dir":false}') { throw result }
        }
        {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(true)(['b', 'r', 'd', 't']))
            if (result !== '{"package":"x","items":["d","t"],"dir":true}') { throw result }
        }
    },
    9: () => {
        /** @type {object.Map<package_.Package>} */
        const packages = {
            '': {
                dependency: () => todo(),
                file: i({ 'a/c': 'return "a/c"' }),
            }
        }
        const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('../c'))
        if (result !== '{"id":{"package":"","path":["a","c"]},"source":"return \\"a/c\\""}') { throw result }
    },
    10: () => {
        /** @type {object.Map<package_.Package>} */
        const packages = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== undefined ? path : undefined
                },
                file: i({
                    'index.js': 'return "index.js"',
                    'x/index.js': 'return "x/index.js"',
                    'x.js': 'return "x.js"',
                })
            },
            'node_modules/z': {
                dependency: () => todo(),
                file: i({ 'a/c/index.js': 'return "a/c"' }),
            }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('z/a/c'))
            if (result !== '{"id":{"package":"node_modules/z","path":["a","c","index.js"]},"source":"return \\"a/c\\""}') {
                throw result
            }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('../..'))
            if (result !== '{"id":{"package":"","path":["index.js"]},"source":"return \\"index.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: [] })('./x'))
            if (result !== '{"id":{"package":"","path":["x.js"]},"source":"return \\"x.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: [] })('./x.js'))
            if (result !== '{"id":{"package":"","path":["x.js"]},"source":"return \\"x.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: [] })('./x/'))
            if (result !== '{"id":{"package":"","path":["x","index.js"]},"source":"return \\"x/index.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['x', 'a'] })('../'))
            if (result !== '{"id":{"package":"","path":["x","index.js"]},"source":"return \\"x/index.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['x', 'a'] })('..'))
            if (result !== '{"id":{"package":"","path":["x","index.js"]},"source":"return \\"x/index.js\\""}') { throw result }
        }
    },
    11: () => {
        /** @type {object.Map<package_.Package>} */
        const packages = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== null ? path : undefined
                },
                file: todo
            },
            'node_modules/z/a': {
                dependency: () => todo(),
                file: i({
                    'c/index.js': 'return "c/index.js"',
                    'c.js': 'return "c.js"'
                }),
            }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('z/a/c'))
            if (result !== '{"id":{"package":"node_modules/z/a","path":["c.js"]},"source":"return \\"c.js\\""}') { throw result }
        }
        {
            const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('z/a/c/'))
            if (result !== '{"id":{"package":"node_modules/z/a","path":["c","index.js"]},"source":"return \\"c/index.js\\""}') { throw result }
        }
    },
    12: () => {
        /** @type {object.Map<package_.Package>} */
        const packages = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== null ? path : undefined
                },
                file: todo
            },
            'node_modules/z/a/c': {
                dependency: () => todo(),
                file: i({
                    '': 'throw',
                    '.js': 'throw',
                    'index.js': 'return "a/c"'
                }),
            }
        }
        const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('z/a/c'))
        if (result !== '{"id":{"package":"node_modules/z/a/c","path":["index.js"]},"source":"return \\"a/c\\""}') { throw result }
    }
}