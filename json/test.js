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
