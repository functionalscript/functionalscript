# Nano-COM

See [Nano-COM](https://en.wikipedia.org/wiki/Component_Object_Model#Nano-COM_(a.k.a_XPCOM)).

## Function Stack

- a public function.
  ```rust
  let o: Object<IMy> = ...;
  // calling a public function
  let i: u32 = o.B();
  ```
  ```rust
  trait IMyEx {
      // a definition
      fn B(&self) -> u32;
  }
  impl IMyEx for Object<IMy> {
      // an implementation of the public function
      fn B(&self) -> u32 {
          // calling a virtual function.
          unsafe { (self.interface().B()(self) }
      }
  }
  ```
- a virtual function.
  ```rust
  #[repr(C)]
  pub struct IMy {
      // a definiton of the virtual function
      pub B: unsafe extern "stdcall" fn(this: &Object<IMy>) -> u32
  }
  trait IMyVmtFn: Class<Interface = IMy>
  where
      CObject<Self>: IMyEx
  {
      // an implementation of the virtual function
      extern "stdcall" fn B(this: &Object<IMy>) -> u32 {
          // calling a function implementation
          unsafe { Self::to_cobject(this) }.B()
      }
  }
  ```
- a function implementation.
  ```rust
  trait IMyEx {
      // a definition
      fn B(&self) -> u32;
  }
  impl IMyEx for CObject<X> {
      // an implementation of the function.
      fn B(&self) -> u32 {
          self.value.0
      }
  }
  ```
