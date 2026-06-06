# 87. Optimization: Reduce number of `Rc::clone()`.

**Priority:** P3
**Status:** open

- Now:
  ```rust
  type Any = Rc<AnyImpl>;
  fn add(a: Any, b: Any) -> Any;
  // alternative:
  fn add(a: &Any, b: &Any) -> Any;
  ```
- Proposal:
  ```rust
  trait AnyImpl {
      fn clone_to_any(&self) -> Any;
  }
  trait Any: Deref<AnyImpl>;
  fn add<'a>(a: &'a AnyImpl, b: &'a AnyImpl) -> Any {
      return { a: a.clone_to_any() };
  }
  let x: Any = ...;
  let y: Any = ...;
  let xy = add(*x, *y);
  let x2 = add(*x, *x);
  ```
