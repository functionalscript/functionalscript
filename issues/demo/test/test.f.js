const arrayOfTests = [
  () => {
    if (2 + 2 !== 4) throw "It's the end of the world as we know it!"
  },
  () => {
    if (2n + 2n !== 4n) throw "It's the end of the world as we know it!"
  }
]

export default {
  arrayOfTests,
  generatingTests: () => arrayOfTests,
}
