import * as _ from './module.mjs'
import * as Run from './module/function/module.f.mjs'

export default {
    ok: () => {
        const source = 'module.exports = "Hello world!"'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }
        const [result] = m[1](() => { throw 0 })(null)
        if (result[0] !== 'ok') { throw result }
        if (result[1] !== 'Hello world!') { throw result }
    },
    compilationError: () => {
        const source = '+'
        const m = _.compile(source)
        if (m[0] !== 'error') { throw m }
    },
    compilationErrorStrict: () => {
        const source = 'const x = 04'
        const m = _.compile(source)
        if (m[0] !== 'error') { throw m }
    },
    runtimeError: () => {
        const source = 'a = 5'
        const m = _.compile(source)
        if (m[0] !== 'ok') { throw m }
        const [result] = m[1](() => { throw 0 })(null)
        if (result[0] !== 'error') { throw result }
    },
    test: () => {
        const depSource = 'module.exports = 137'
        const d = _.compile(depSource)
        if (d[0] !== 'ok') { throw d }

        /** @type {Run.Require<number>} */
        const req = path => prior => {
            if (path !== 'm') { throw path }
            return d[1](req)(prior + 1)
        }

        let info = 0
        {
            const source = 'module.exports = require("m") + 42'
            const m = _.compile(source)
            if (m[0] !== 'ok') { throw m }

            const [result, newInfo] = m[1](req)(info)
            if (result[0] !== 'ok') { throw result }
            if (result[1] !== 179) { throw result }
            info = newInfo
        }

        {
            const source = 'module.exports = require("x") + 42'
            const m = _.compile(source)
            if (m[0] !== 'ok') { throw m }

            const [result, infox] = m[1](req)(info)
            if (result[0] !== 'error') { throw result }
            if (infox !== 1) { throw info }
        }
    }
}
