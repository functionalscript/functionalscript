import { tokenize, type DjsToken, type DjsTokenWithMetadata } from './module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'
import { stringifyAsTree } from '../serializer/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o
import * as encoding from '../../text/utf16/module.f.ts'

const tokenizeString
    : (s: string) => readonly DjsToken[]
    = s => toArray(map(withoutMetada)(tokenize(encoding.stringToList(s))('')))

const tokenizeStringWithMetadata
    : (s: string) => readonly DjsTokenWithMetadata[]
    = s => toArray(tokenize(encoding.stringToList(s))(''))

const stringify = stringifyAsTree(sort)

const withoutMetada
    : (tokenWithMetada: DjsTokenWithMetadata) => DjsToken
    = tokenWithMetada => { return tokenWithMetada.token }

export default {
    djs: [
        () => {
            const result = stringify(tokenizeString(''))
            if (result !== '[{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{'))
            if (result !== '[{"kind":"{"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('}'))
            if (result !== '[{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(':'))
            if (result !== '[{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(','))
            if (result !== '[{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('['))
            if (result !== '[{"kind":"["},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString(']'))
            if (result !== '[{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ᄑ'))
            if (result !== '[{"kind":"error","message":"unexpected character"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ \t\n\r}'))
            if (result !== '[{"kind":"{"},{"kind":"nl"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('""'))
            if (result !== '[{"kind":"string","value":""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value"'))
            if (result !== '[{"kind":"string","value":"value"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"value1" "value2"'))
            if (result !== '[{"kind":"string","value":"value1"},{"kind":"ws"},{"kind":"string","value":"value2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\\\"'))
            if (result !== '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\""'))
            if (result !== '[{"kind":"string","value":"\\""},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\/"'))
            if (result !== '[{"kind":"string","value":"/"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\x"'))
            if (result !== '[{"kind":"error","message":"unescaped character"},{"kind":"string","value":"x"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\'))
            if (result !== '[{"kind":"error","message":"\\" are missing"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\b\\f\\n\\r\\t"'))
            if (result !== '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\u1234"'))
            if (result !== '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uaBcDEeFf"'))
            if (result !== '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('"\\uEeFg"'))
            if (result !== '[{"kind":"error","message":"invalid hex value"},{"kind":"string","value":"g"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[0]'))
            if (result !== '[{"kind":"["},{"bf":[0n,0],"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('00'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0abc,'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"abc"},{"kind":","},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123456789012345678901234567890'))
            if (result !== '[{"bf":[123456789012345678901234567890n,0],"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{90}'))
            if (result !== '[{"kind":"{"},{"bf":[90n,0],"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1 2'))
            if (result !== '[{"bf":[1n,0],"kind":"number","value":"1"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0. 2'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"ws"},{"bf":[2n,0],"kind":"number","value":"2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('10-0'))
            if (result !== '[{"bf":[10n,0],"kind":"number","value":"10"},{"bf":[0n,0],"kind":"number","value":"-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('9a:'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":":"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-10'))
            if (result !== '[{"bf":[-10n,0],"kind":"number","value":"-10"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('--'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('---'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-00'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-.123'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"."},{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0.01'))
            if (result !== '[{"bf":[1n,-2],"kind":"number","value":"0.01"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.9'))
            if (result !== '[{"bf":[-9n,-1],"kind":"number","value":"-0.9"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-0.]'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.34'))
            if (result !== '[{"bf":[1234n,-2],"kind":"number","value":"12.34"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.00'))
            if (result !== '[{"bf":[-1200n,-2],"kind":"number","value":"-12.00"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.'))
            if (result !== '[{"kind":"error","message":"invalid token"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12.]'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e1'))
            if (result !== '[{"bf":[0n,1],"kind":"number","value":"0e1"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e+2'))
            if (result !== '[{"bf":[0n,2],"kind":"number","value":"0e+2"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-0'))
            if (result !== '[{"bf":[0n,0],"kind":"number","value":"0e-0"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('12e0000'))
            if (result !== '[{"bf":[12n,0],"kind":"number","value":"12e0000"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12e-0001'))
            if (result !== '[{"bf":[-12n,-1],"kind":"number","value":"-12e-0001"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('-12.34e1234'))
            if (result !== '[{"bf":[-1234n,1232],"kind":"number","value":"-12.34e1234"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0e-'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('ABCdef1234567890$_'))
            if (result !== '[{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{ABCdef1234567890$_}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"ABCdef1234567890$_"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 _123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123 $123'))
            if (result !== '[{"bf":[123n,0],"kind":"number","value":"123"},{"kind":"ws"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123_123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"_123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123$123'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"$123"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890n'))
            if (result !== '[{"kind":"bigint","value":1234567890n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('0n'))
            if (result !== '[{"kind":"bigint","value":0n},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[-1234567890n]'))
            if (result !== '[{"kind":"["},{"kind":"bigint","value":-1234567890n},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123.456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('123e456n'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890na'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"a"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('1234567890nn'))
            if (result !== '[{"kind":"error","message":"invalid number"},{"kind":"id","value":"n"},{"kind":"eof"}]') { throw result }
        },
    ],
    id: [
        () => {
            const result = stringify(tokenizeString('err'))
            if (result !== '[{"kind":"id","value":"err"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('{e}'))
            if (result !== '[{"kind":"{"},{"kind":"id","value":"e"},{"kind":"}"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('tru'))
            if (result !== '[{"kind":"id","value":"tru"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('break'))
            if (result !== '[{"kind":"id","value":"break"},{"kind":"eof"}]') { throw result }
        },
    ],
    keywords: [
        () => {
            const result = stringify(tokenizeString('true'))
            if (result !== '[{"kind":"true"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('false'))
            if (result !== '[{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('null'))
            if (result !== '[{"kind":"null"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('undefined'))
            if (result !== '[{"kind":"undefined"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('[null]'))
            if (result !== '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]') { throw result }
        },
    ],
    comments: [
        () => {
            const result = stringify(tokenizeString('//singleline comment'))
            if (result !== '[{"kind":"//","value":"singleline comment"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('true//singleline comment\nfalse'))
            if (result !== '[{"kind":"true"},{"kind":"//","value":"singleline comment"},{"kind":"nl"},{"kind":"false"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment */'))
            if (result !== '[{"kind":"/*","value":" multiline comment "},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *'))
            if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment '))
            if (result !== '[{"kind":"error","message":"*/ expected"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment \n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment \\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeString('/* multiline comment *\n * **/'))
            if (result !== '[{"kind":"/*","value":" multiline comment *\\n * *"},{"kind":"nl"},{"kind":"eof"}]') { throw result }
        },
    ],
    metadata: [
        () => {
            const result = stringify(tokenizeStringWithMetadata('[\ntrue, -1\n]'))
            if (result !== '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"["}},{"metadata":{"column":1,"line":2,"path":""},"token":{"kind":"nl"}},{"metadata":{"column":5,"line":2,"path":""},"token":{"kind":"true"}},{"metadata":{"column":6,"line":2,"path":""},"token":{"kind":","}},{"metadata":{"column":7,"line":2,"path":""},"token":{"kind":"ws"}},{"metadata":{"column":9,"line":2,"path":""},"token":{"bf":[-1n,0],"kind":"number","value":"-1"}},{"metadata":{"column":1,"line":3,"path":""},"token":{"kind":"nl"}},{"metadata":{"column":2,"line":3,"path":""},"token":{"kind":"]"}},{"metadata":{"column":2,"line":3,"path":""},"token":{"kind":"eof"}}]') { throw result }
        },
        () => {
            const result = stringify(tokenizeStringWithMetadata('[-'))
            if (result !== '[{"metadata":{"column":2,"line":1,"path":""},"token":{"kind":"["}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"error","message":"invalid token"}},{"metadata":{"column":3,"line":1,"path":""},"token":{"kind":"eof"}}]') { throw result }
        },
    ]
}
