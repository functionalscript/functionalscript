const encoding = require('./main.f.js')
const json = require('../../json/main.f')
const { sort } = require('../../types/object/main.f.js')
const { list } = require('../../types/main.f.js')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([0,1,127])))
    if (result !== '[["ok",0],["ok",1],["ok",127]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([128])))
    if (result !== '[["ok",194],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([169])))
    if (result !== '[["ok",194],["ok",169]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([2047])))
    if (result !== '[["ok",223],["ok",191]]') { throw result }
}

module.exports = {}
