const encoding = require('./main.f.js')
const json = require('../../json/main.f')
const { sort } = require('../../types/object/main.f.js')
const { list } = require('../../types/main.f.js')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([0,1,127])))
    if (result !== '[["ok",0],["ok",1],["ok",127]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([128])))
    if (result !== '[["ok",194],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([169])))
    if (result !== '[["ok",194],["ok",169]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([2047])))
    if (result !== '[["ok",223],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([2048])))
    if (result !== '[["ok",224],["ok",160],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([2049])))
    if (result !== '[["ok",224],["ok",160],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([65535])))
    if (result !== '[["ok",239],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([65536])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([65537])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([1114111])))
    if (result !== '[["ok",244],["ok",143],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf8([-1,1114112])))
    if (result !== '[["error",-1],["error",1114112]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([0])))
    if (result !== '[["ok",0],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([36])))
    if (result !== '[["ok",0],["ok",36]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([8364])))
    if (result !== '[["ok",32],["ok",172]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([55295])))
    if (result !== '[["ok",215],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([57344])))
    if (result !== '[["ok",224],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([65535])))
    if (result !== '[["ok",255],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([0x10000])))
    if (result !== '[["ok",216],["ok",0],["ok",220],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([0x10437])))
    if (result !== '[["ok",216],["ok",1],["ok",220],["ok",55]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([0x24B62])))
    if (result !== '[["ok",216],["ok",82],["ok",223],["ok",98]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([0x10ffff])))
    if (result !== '[["ok",219],["ok",255],["ok",223],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointsToUtf16([-1, 0xd800, 0xdfff, 0x110000])))
    if (result !== '[["error",-1],["error",55296],["error",57343],["error",1114112]]') { throw result }
}

module.exports = {}
