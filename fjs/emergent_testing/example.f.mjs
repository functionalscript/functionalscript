/** @type {(a: number, b: number) => number} */
export const add = (a, b) => a + b

/** @type {(a: number, b: number) => number} */
export const mul = (a, b) => a * b

/** @type {(a: number) => number} */
export const sqr = a => mul(a, a)

export const todo = () => { throw "not implemented" }

/** @type {(a: number, b: number, r: number) => void} */
const checkMul = (a, b, r) => {
    if (mul(a, b) !== r) { throw `mul(${a}, ${b}) !== ${r}` } 
}

export const proof = {
  addTest: () => {
    if (add(2, 2) !== 4) { throw "something wrong with the math" }
  },
  mulTest: [
    () => checkMul(2, 3, 6),
    () => checkMul(22, 34, 748),
    () => checkMul(-2, 3, -6),
    () => checkMul(-2, -3, 6),
  ],
  throw: {
     todo,
     divByZero: () => 5n / 0n,
  },
  generateSqrTests: () => [1, 2, 3, 5].map(a => () => {
    if (sqr(a) !== a * a) { throw `sqr(${a})` }
  })
}
