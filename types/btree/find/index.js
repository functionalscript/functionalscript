const _ = require('..')
const { todo } = require('../../../dev')
const list = require('../../list')
const cmp = require('../../function/compare')

/**
 * @template T
 * @typedef {readonly[1, _.Leaf1<T>|_.Branch3<T>]} Found1
 */

/**
 * @template T
 * @typedef {readonly[1|3, _.Leaf2<T> | _.Branch5<T>]} Found2
 */

/**
 * @template T
 * @typedef {readonly[0|2, _.Leaf1<T>]} NotFound1
 */

/**
 * @template T
 * @typedef {readonly[0|2|4, _.Leaf2<T>]} NotFound2
 */

/**
 * @template T
 * @typedef {Found1<T> | Found2<T>} Found
 */

/**
 * @template T
 * @typedef {NotFound1<T> | NotFound2<T>} NotFound
 */

/**
 * @template T
 * @typedef {Found<T> | NotFound<T>} First
 */

/**
 * @template T
 * @typedef {readonly[0|2, _.Branch3<T>]} PathItem3
 */

/**
 * @template T
 * @typedef {readonly[0|2|4, _.Branch5<T>]} PathItem5
 */

/**
 * @template T
 * @typedef {PathItem3<T> | PathItem5<T>} PathItem
 */

/**
 * @template T
 * @typedef {list.List<PathItem<T>>} Path
 */

/**
 * @template T
 * @typedef {readonly[First<T>, Path<T>]} Result<T>
 */

/** @type {<T>(c: cmp.Compare<T>) => (node: _.Node<T>) => Result<T>} */
const find = c => node => todo()
