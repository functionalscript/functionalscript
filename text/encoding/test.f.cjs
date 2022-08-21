const encoding = require('./module.f.cjs')
const json = require('../../json/module.f.cjs')
const { sort } = require('../../types/object/module.f.cjs')
const { list } = require('../../types/module.f.cjs')

/** @type {(a: readonly json.Unknown[]) => string} */
const stringify = a => json.stringify(sort)(a)

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0,1,0x7F])))
    if (result !== '[["ok",0],["ok",1],["ok",127]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x80])))
    if (result !== '[["ok",194],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0xa9])))
    if (result !== '[["ok",194],["ok",169]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x7ff])))
    if (result !== '[["ok",223],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x800])))
    if (result !== '[["ok",224],["ok",160],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x801])))
    if (result !== '[["ok",224],["ok",160],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0xffff])))
    if (result !== '[["ok",239],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x10000])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",128]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x10001])))
    if (result !== '[["ok",240],["ok",144],["ok",128],["ok",129]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([0x10FFFF])))
    if (result !== '[["ok",244],["ok",143],["ok",191],["ok",191]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf8List([-1,0x110000])))
    if (result !== '[["error",-1],["error",1114112]]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0])))
    if (result !== '[0]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x24])))
    if (result !== '[36]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x20AC])))
    if (result !== '[8364]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0xd7ff])))
    if (result !== '[55295]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0xe000])))
    if (result !== '[57344]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0xffff])))
    if (result !== '[65535]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x10000])))
    if (result !== '[55296,56320]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x10437])))
    if (result !== '[55297,56375]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x24B62])))
    if (result !== '[55378,57186]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([0x10ffff])))
    if (result !== '[56319,57343]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.codePointListToUtf16List([-1, 0xd800, 0xdfff, 0x110000])))
    if (result !== '[65535,55296,57343,0]') { throw result }
}

{
     const result = stringify(list.toArray(encoding.utf8ListToCodePointList([-1, 256])))
     if (result !== '[4294967295,4294967295]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([128, 193, 245, 255])))
    if (result !== '[-2147483520,-2147483455,-2147483403,-2147483393]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([0, 1, 127])))
    if (result !== '[0,1,127]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([194, 128, 194, 169, 223, 191])))
    if (result !== '[128,169,2047]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([194, 194, 127, 194, 192, 194])))
    if (result !== '[-2147483454,-2147483454,127,-2147483454,-2147483456,-2147483454]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([224, 160, 128, 224, 160, 129, 239, 191, 191])))
    if (result !== '[2048,2049,65535]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([224,224,160,127,239,191])))
    if (result !== '[-2147483424,-2147482592,127,-2147481601]') { throw result }
}

// {
//     const result = stringify(list.toArray(encoding.utf8ListToCodePointList([224, 160, 127, 224, 160, 192, 224, 160])))
//     if (result !== '[["error",[224,160,127]],["error",[224,160,192]],["error",[224,160]]]') { throw result }
// }

{
    const result = stringify(list.toArray(encoding.utf8ListToCodePointList([240, 144, 128, 128, 240, 144, 128, 129, 244, 143, 191, 191])))
    if (result !== '[65536,65537,1114111]') { throw result }
}

// {
//     const result = stringify(list.toArray(encoding.utf8ListToCodePointList([240, 144, 128, 127, 240, 144, 128, 192, 240, 144, 128])))
//     if (result !== '[["error",[240,144,128,127]],["error",[240,144,128,192]],["error",[240,144,128]]]') { throw result }
// }

// {
//     const result = stringify(list.toArray(encoding.utf8ListToCodePointList([194, -1, 128])))
//     if (result !== '[["error",[-1]],["ok",128]]') { throw result }
// }

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([-1, 65536])))
    if (result !== '[4294967295,4294967295]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([0, 36, 8364, 55295, 57344, 65535])))
    if (result !== '[0,36,8364,55295,57344,65535]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([56320, 57343])))
    if (result !== '[-2147427328,-2147426305]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([55296, 56320, 55297, 56375, 55378, 57186, 56319, 57343])))
    if (result !== '[65536,66615,150370,1114111]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([55296, 55296])))
    if (result !== '[-2147428352,-2147428352]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([55296, 0])))
    if (result !== '[-2147428352,0]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([56320])))
    if (result !== '[-2147427328]') { throw result }
}

{
    const result = stringify(list.toArray(encoding.utf16ListToCodePointList([56320, 0])))
    if (result !== '[-2147427328,0]') { throw result }
}

{
    const utf16List = encoding.stringToUtf16List("Hello world!😂🚜🚲")
    const result = encoding.utf16ListToString(utf16List)
    if (result !== "Hello world!😂🚜🚲") { throw result }
}

{
    const a = encoding.stringToUtf16List("Hello world!😂🚜🚲")
    const b = encoding.utf16ListToCodePointList(a)
    const c = encoding.codePointListToUtf16List(b)
    const result = encoding.utf16ListToString(c)
    if (result !== "Hello world!😂🚜🚲") { throw result }
}

module.exports = {}
