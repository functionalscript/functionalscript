import { contains } from './module.f.ts'

export default () => {
    if (!contains([0, 5])(1)) { throw 1 }
    if (!contains([0, 5])(0)) { throw 0 }
    if (!contains([0, 5])(5)) { throw 5 }
    if (contains([0, 5])(-1)) { throw -1 }
    if (contains([0, 5])(6)) { throw 6 }
}
