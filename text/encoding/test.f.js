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

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([2048])))
    if (result !== '[["ok",224],["ok",160],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([2049])))
    if (result !== '[["ok",224],["ok",160],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([65535])))
    if (result !== '[["ok",239],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([65536])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([65537])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([1114111])))
    if (result !== '[["ok",244],["ok",143],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointToUtf8([-1,1114112])))
    if (result !== '[["error",-1],["error",1114112]]') { throw result }
}

module.exports = {}
