import * as _ from './module.f.ts'
import { todo } from '../../dev/module.f.ts'
import * as json from '../../json/module.f.ts'
import { identity } from '../../types/function/module.f.ts'
import { at, type Map } from '../../types/object/module.f.ts'
import type * as Package from '../package/module.f.ts'

const i = <T>(o: Map<T>) => (s: string): T|null => at(s)(o)

const stringify
    : (g: json.Unknown) => string
    = json.stringify(identity)

export default {
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
    8: {
        0: () => { if (_.parseGlobal(() => null)(false)(['a', 'b']) !== null) { throw 'error' } },
        1: () => { if (_.parseGlobal(() => null)(false)(['b']) !== null) { throw 'error' } },
        2: () => { if (_.parseGlobal(i({ b: 'x' }))(false)(['d']) !== null) { throw 'error' } },
        3: () => {
            const result = stringify(_.parseGlobal(i({ b: 'x' }))(false)(['b']))
            if (result !== '{"package":"x","items":[],"dir":false}') { throw result }
        },
        4: () => { if (_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b']) !== null) { throw 'error' } },
        5: () => {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b', 'r']))
            if (result !== '{"package":"x","items":[],"dir":false}') { throw result }
        },
        6: () => {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(false)(['b', 'r', 'd', 't']))
            if (result !== '{"package":"x","items":["d","t"],"dir":false}') { throw result }
        },
        7: () => {
            const result = stringify(_.parseGlobal(i({ 'b/r': 'x' }))(true)(['b', 'r', 'd', 't']))
            if (result !== '{"package":"x","items":["d","t"],"dir":true}') { throw result }
        },
    },
    9: () => {
        const packages
        : Map<Package.Package>
        = {
            '': {
                dependency: () => todo(),
                file: i({ 'a/c': 'return "a/c"' }),
            }
        }
        const result = stringify(_.parseAndFind(i(packages))({ package: '', path: ['a', 'b'] })('../c'))
        if (result !== '{"id":{"package":"","path":["a","c"]},"source":"return \\"a/c\\""}') { throw result }
    },
    10: () => {
        const packages
        : Map<Package.Package>
        = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== null ? path : null
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
        const packages
        : Map<Package.Package>
        = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== null ? path : null
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
        const packages
        : Map<Package.Package>
        = {
            '': {
                dependency: x => {
                    const path = `node_modules/${x}`
                    return at(path)(packages) !== null ? path : null
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
