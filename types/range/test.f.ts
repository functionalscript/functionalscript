import * as _ from './module.f.ts'

export default () => {
    if (!_.contains([0, 5])(1)) { throw 1 }
    if (!_.contains([0, 5])(0)) { throw 0 }
    if (!_.contains([0, 5])(5)) { throw 5 }
    if (_.contains([0, 5])(-1)) { throw -1 }
    if (_.contains([0, 5])(6)) { throw 6 }
}
