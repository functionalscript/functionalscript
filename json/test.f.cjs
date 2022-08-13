const json = require('./module.f.cjs')
const { sort } = require('../types/object/module.f.cjs')
const { identity } = require('../types/function/module.f.cjs')

if (json.setProperty("Hello")([])({}) !== "Hello") { throw 'error' }

{
    const r = json.setProperty("Hello")(['a'])({})
    const x = json.stringify(sort)(r)
    if (x !== '{"a":"Hello"}') { throw x }
}

{
    const x = json.stringify(identity)(json.setProperty("Hello")(['a'])({}))
    if (x !== '{"a":"Hello"}') { throw x }
}

{
    const x = json.stringify(sort)(json.setProperty("Hello")(['a'])({c:[],b:12}))
    if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
}

{
    const x = json.stringify(identity)(json.setProperty("Hello")(['a'])({ c: [], b: 12 }))
    if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
}

{
    const _0 = { a: { y: [24] }, c: [], b: 12 }
    const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
    const _2 = json.stringify(sort)(_1)
    if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
}

{
    const _0 = { a: { y: [24] }, c: [], b: 12 }
    const _1 = json.setProperty("Hello")(['a', 'x'])(_0)
    const _2 = json.stringify(identity)(_1)
    if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
}
