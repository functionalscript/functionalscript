export const add = (a: number, b: number): number => a + b

export const mul = (a: number, b: number): number => a * b

export const sqr = (a: number) => mul(a, a)

export const todo = () => { throw "not implemented" }

const checkMul = (a: number, b: number, r: number) => {
    if (mul(a, b) !== r) { throw `mul(${a}, ${b}) !== ${r}` } 
}

export const proof = {
  addTest: () => {
    if (add(2, 2) !== 4) { throw "something wrong with the math" }
  },
  mulTest: [
    () => checkMul(2, 3, 5),
    () => checkMul(22, 34, 56),
    () => checkMul(-2, 3, -5),
    () => checkMul(-2, -3, 5),
  ],
  throw: {
     todo,
     divByZero: () => 5n / 0n,
  },
  generateSqrTests: () => [1, 2, 3, 5].map(a => () => {
    if (sqr(a) !== a * a) { throw `sqr(${a})` }
  })
}
