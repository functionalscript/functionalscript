const json = require('.')
const { pipe } = require('../function')

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
    const x = pipe({ a: { y: [24] }, c: [], b: 12 })
        ._(json.addProperty("Hello")(['a', 'x']))
        ._(json.stringify)
        .result
    if (x !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw x }
}
