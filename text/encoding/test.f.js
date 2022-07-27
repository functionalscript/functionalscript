const encoding = require('./main.f.js')
const json = require('../../json/main.f')
const { sort } = require('../../types/object/main.f.js')
const { list } = require('../../types/main.f.js')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0,1,0x7F])))
    if (result !== '[["ok",0],["ok",1],["ok",127]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x80])))
    if (result !== '[["ok",194],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0xa9])))
    if (result !== '[["ok",194],["ok",169]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x7ff])))
    if (result !== '[["ok",223],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x800])))
    if (result !== '[["ok",224],["ok",160],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x801])))
    if (result !== '[["ok",224],["ok",160],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0xffff])))
    if (result !== '[["ok",239],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x10000])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x10001])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([0x10FFFF])))
    if (result !== '[["ok",244],["ok",143],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8([-1,0x110000])))
    if (result !== '[["error",-1],["error",1114112]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0])))
    if (result !== '[["ok",0],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x24])))
    if (result !== '[["ok",0],["ok",36]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x20AC])))
    if (result !== '[["ok",32],["ok",172]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0xd7ff])))
    if (result !== '[["ok",215],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0xe000])))
    if (result !== '[["ok",224],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0xffff])))
    if (result !== '[["ok",255],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x10000])))
    if (result !== '[["ok",216],["ok",0],["ok",220],["ok",0]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x10437])))
    if (result !== '[["ok",216],["ok",1],["ok",220],["ok",55]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x24B62])))
    if (result !== '[["ok",216],["ok",82],["ok",223],["ok",98]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([0x10ffff])))
    if (result !== '[["ok",219],["ok",255],["ok",223],["ok",255]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16([-1, 0xd800, 0xdfff, 0x110000])))
    if (result !== '[["error",-1],["error",55296],["error",57343],["error",1114112]]') { throw result }
}

{    
    const result = stringify(list.toArray(encoding.utf8ListToCodePoint([-1, 256])))
    if (result !== '[["error",[-1]],["error",[256]]]') { throw result }
}

module.exports = {}
