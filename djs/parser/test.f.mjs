import parser from './module.f.mjs'
import tokenizer from '../tokenizer/module.f.cjs'
import { toArray } from '../../types/list/module.f.cjs'
import djs from '../module.f.cjs'
import { sort } from '../../types/object/module.f.cjs'
import encoding from '../../text/utf16/module.f.cjs'

/** @type {(s: string) => readonly tokenizer.DjsToken[]} */
const tokenizeString = s => toArray(tokenizer.tokenize(encoding.stringToList(s)))

const stringify = djs.stringify(sort)

export default {
    valid: [
        () => {
            const tokenList = tokenizeString('module.exports=null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=true')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",true]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=false')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",false]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=0.1')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",0.1]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=1.1e+2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",110]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports="abc"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok","abc"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[[]]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[0,[1,[2,[]]],3]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,[1,[2,[]]],3]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[{}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[{}]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"a":true,"b":false,"c":null}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":true,"b":false,"c":null}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"a":{"b":{"c":["d"]}}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":{"b":{"c":["d"]}}}]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=1234567890n')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",1234567890n]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[1234567890n]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[1234567890n]]') { throw result }
        }
    ],
    invalid: [
        () => {
            const tokenList = tokenizeString('module.exports=')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports="123')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[1 2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[1,,2]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[]]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=["a"')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[1,]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[,1]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[:]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={1:2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"1"2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"1"::2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"1":2,,"3":4')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={}}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"1":2')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected end"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={"1":2,}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={,"1":2}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=[{]}')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={[}]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports=10-5')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ],
    validWhiteSpaces:[
        () => {
            const tokenList = tokenizeString('module.exports=[ 0 , 1 , 2 ]')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",[0,1,2]]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module.exports={ "a" : 0 , "b" : 1 }')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",{"a":0,"b":1}]') { throw result }
        },
    ],
    validModule:[
        () => {
            const tokenList = tokenizeString('module.exports = null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["ok",null]') { throw result }
        },
    ],
    invalidModule:[
        () => {
            const tokenList = tokenizeString('null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
        () => {
            const tokenList = tokenizeString('module=null')
            const obj = parser.parse(tokenList)
            const result = stringify(obj)
            if (result !== '["error","unexpected token"]') { throw result }
        },
    ]
}