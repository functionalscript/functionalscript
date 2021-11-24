const json = require('.')

if (json.addProperty("Hello")([])({}) !== "Hello") { throw 'error' }

{
    const x = json.stringify(json.addProperty("Hello")(['a'])({}))
    if (x !== '{"a":"Hello"}') { throw x }
}

{
    const x = json.stringify(json.addProperty("Hello")(['a'])({c:[],b:12}))
    if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
}

{
    const _0 = { a: { y: [24] }, c: [], b: 12 }
    const _1 = json.addProperty("Hello")(['a', 'x'])(_0)
    const _2 = json.stringify(_1)
    if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
}
