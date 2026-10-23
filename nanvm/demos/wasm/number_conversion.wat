  (func $nanvm_demos::samples::number_conversion::module::<nanvm_lib::naive::Naive> (;347;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=28
    local.get 2
    i32.const 1060955
    i32.store offset=24
    local.get 2
    i32.const 1060948
    i32.store offset=20
    local.get 2
    i32.const 48
    i32.add
    local.get 2
    i32.const 20
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=48
          local.tee 3
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 2
          i32.load offset=56
          local.set 4
          local.get 2
          i32.load offset=52
          local.set 5
          local.get 2
          i32.const 0
          i32.store8 offset=32
          local.get 2
          i32.const 8
          i32.add
          local.get 2
          i32.const 32
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=12
          local.tee 6
          i32.store offset=52
          local.get 2
          local.get 2
          i32.load offset=8
          local.tee 3
          i32.store offset=48
          block ;; label = @4
            local.get 2
            i32.load8_u offset=32
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 3
            local.get 3
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 3 (;@1;)
            local.get 2
            i32.const 48
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 3 (;@1;)
          end
          local.get 3
          i32.eqz
          br_if 2 (;@1;)
          i32.const 72
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1060955
          i32.const 75
          call $<nanvm_lib::naive::function::Function>::new
          local.set 3
          local.get 2
          i32.const 0
          i32.store8 offset=20
          local.get 2
          local.get 3
          i32.store offset=68
          local.get 2
          i32.const 7
          i32.store8 offset=64
          local.get 2
          local.get 4
          i32.store offset=60
          local.get 2
          local.get 5
          i32.store offset=56
          local.get 2
          i64.const 4294967296
          i64.store offset=48
          local.get 2
          local.get 2
          i32.const 20
          i32.add
          i32.store offset=80
          local.get 2
          local.get 2
          i32.const 48
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=4
          local.tee 4
          i32.store offset=36
          local.get 2
          local.get 2
          i32.load
          local.tee 3
          i32.store offset=32
          block ;; label = @4
            local.get 2
            i32.load8_u offset=20
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 3
            local.get 3
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            br_if 2 (;@2;)
            local.get 2
            i32.const 32
            i32.add
            call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
            br 2 (;@2;)
          end
          local.get 3
          i32.eqz
          br_if 1 (;@2;)
          local.get 0
          local.get 4
          i32.store offset=16
          local.get 0
          local.get 3
          i32.store offset=12
          local.get 0
          i32.const 5
          i32.store8 offset=8
          local.get 0
          i64.const 0
          i64.store
          local.get 1
          call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          i32.const 96
          i32.add
          global.set $__stack_pointer
          return
        end
        local.get 2
        local.get 2
        i32.load8_u offset=51
        i32.store8 offset=35
        local.get 2
        local.get 2
        i32.load16_u offset=49 align=1
        i32.store16 offset=33 align=1
        local.get 2
        local.get 2
        i32.load offset=60
        i32.store offset=44
        local.get 2
        local.get 2
        i64.load offset=52 align=4
        i64.store offset=36 align=4
        local.get 2
        local.get 3
        i32.store8 offset=32
        i32.const 1063112
        i32.const 43
        local.get 2
        i32.const 32
        i32.add
        i32.const 1063096
        i32.const 1063156
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 95
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 95
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::number_conversion::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;348;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 f64)
    global.get $__stack_pointer
    i32.const 352
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 2
                        i32.load
                        local.tee 5
                        i32.const -1
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 3
                        i32.store offset=32
                        local.get 4
                        local.get 2
                        i32.store offset=28
                        local.get 4
                        i32.const 6
                        i32.store8 offset=24
                        local.get 2
                        local.get 5
                        i32.const 2
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 2
                        i32.store offset=276
                        local.get 4
                        i32.const 6
                        i32.store8 offset=272
                        local.get 4
                        local.get 3
                        i64.extend_i32_u
                        i64.store offset=280
                        local.get 4
                        i64.const 0
                        i64.store offset=312
                        local.get 4
                        i32.const 2
                        i32.store8 offset=304
                        local.get 4
                        i32.const 224
                        i32.add
                        local.get 4
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=224
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=240
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=232
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 7 (;@4;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=248
                        i64.store offset=328
                        local.get 4
                        local.get 4
                        i64.load offset=240
                        i64.store offset=320
                        local.get 4
                        local.get 4
                        i64.load offset=232
                        i64.store offset=312
                        local.get 4
                        local.get 4
                        i64.load offset=224
                        i64.store offset=304
                        local.get 4
                        i32.const 272
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=272
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=280
                            i64.store offset=264
                            local.get 4
                            local.get 4
                            i64.load offset=272
                            i64.store offset=256
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=256
                        end
                        local.get 4
                        i32.const 304
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 320
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 208
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=208
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=211
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=209 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=212 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=220
                          i32.store offset=20
                          local.get 0
                          local.get 6
                          i64.store offset=12 align=4
                          local.get 0
                          local.get 3
                          i32.store8 offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 7 (;@4;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=212 align=4
                        i64.store offset=124 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=120
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 120
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                        local.get 4
                        f64.load offset=320
                        local.set 7
                        local.get 4
                        i32.load offset=316
                        local.set 3
                        local.get 4
                        i32.load offset=312
                        local.set 5
                        local.get 4
                        i32.load offset=304
                        br_if 1 (;@9;)
                        block ;; label = @11
                          local.get 5
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 7
                          f64.store offset=308 align=4
                          local.get 4
                          local.get 3
                          i32.store offset=304
                          local.get 4
                          i32.const 304
                          i32.add
                          call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                          local.set 7
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                        end
                        local.get 4
                        local.get 7
                        f64.store offset=112
                        local.get 4
                        i32.const 2
                        i32.store offset=104
                        local.get 4
                        i32.const 0
                        i32.store16 offset=200
                        local.get 4
                        i32.const 1061127
                        i32.store offset=196
                        local.get 4
                        i32.const 1061123
                        i32.store offset=192
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 192
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=304
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 2 (;@8;)
                        local.get 4
                        local.get 4
                        i64.load offset=308 align=4
                        i64.store offset=212 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=208
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 208
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                        local.get 4
                        f64.load offset=320
                        local.set 7
                        local.get 4
                        i32.load offset=316
                        local.set 3
                        local.get 4
                        i32.load offset=312
                        local.set 5
                        local.get 4
                        i32.load offset=304
                        br_if 3 (;@7;)
                        block ;; label = @11
                          local.get 5
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 7
                          f64.store offset=308 align=4
                          local.get 4
                          local.get 3
                          i32.store offset=304
                          local.get 4
                          i32.const 304
                          i32.add
                          call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                          local.set 7
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                        end
                        local.get 4
                        local.get 7
                        f64.store offset=144
                        local.get 4
                        i32.const 2
                        i32.store offset=136
                        local.get 4
                        i32.const 0
                        i32.store8 offset=192
                        local.get 4
                        i64.const 1
                        i64.store offset=312
                        local.get 4
                        i64.const 1
                        i64.store offset=304
                        local.get 4
                        local.get 4
                        i32.const 192
                        i32.add
                        i32.store offset=320
                        local.get 4
                        i32.const 8
                        i32.add
                        local.get 4
                        i32.const 304
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=12
                        local.tee 5
                        i32.store offset=212
                        local.get 4
                        local.get 4
                        i32.load offset=8
                        local.tee 3
                        i32.store offset=208
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=192
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 2
                          i32.store
                          local.get 2
                          br_if 10 (;@1;)
                          local.get 4
                          i32.const 208
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                          br 10 (;@1;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 9 (;@1;)
                        local.get 4
                        i32.const 1
                        i32.store8 offset=284
                        local.get 4
                        local.get 5
                        i32.store offset=280
                        local.get 4
                        local.get 3
                        i32.store offset=276
                        local.get 4
                        i32.const 4
                        i32.store8 offset=272
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 272
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                        local.get 4
                        f64.load offset=320
                        local.set 7
                        local.get 4
                        i32.load offset=316
                        local.set 3
                        local.get 4
                        i32.load offset=312
                        local.set 5
                        local.get 4
                        i32.load offset=304
                        br_if 4 (;@6;)
                        block ;; label = @11
                          local.get 5
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 7
                          f64.store offset=308 align=4
                          local.get 4
                          local.get 3
                          i32.store offset=304
                          local.get 4
                          i32.const 304
                          i32.add
                          call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                          local.set 7
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 304
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                        end
                        local.get 4
                        local.get 7
                        f64.store offset=160
                        local.get 4
                        i32.const 2
                        i32.store offset=152
                        local.get 4
                        i32.const 0
                        i32.store16 offset=344
                        local.get 4
                        i64.const 4294967297
                        i64.store offset=336 align=4
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 336
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=304
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 5 (;@5;)
                        local.get 4
                        local.get 4
                        i64.load offset=308 align=4
                        i64.store offset=212 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=208
                        local.get 4
                        i32.const 304
                        i32.add
                        local.get 4
                        i32.const 208
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                        local.get 4
                        f64.load offset=320
                        local.set 7
                        local.get 4
                        i32.load offset=316
                        local.set 3
                        local.get 4
                        i32.load offset=312
                        local.set 5
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load offset=304
                            br_if 0 (;@12;)
                            block ;; label = @13
                              local.get 5
                              i32.const 1
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 4
                              local.get 7
                              f64.store offset=308 align=4
                              local.get 4
                              local.get 3
                              i32.store offset=304
                              local.get 4
                              i32.const 304
                              i32.add
                              call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                              local.set 7
                              local.get 3
                              local.get 3
                              i32.load
                              i32.const -1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              br_if 0 (;@13;)
                              local.get 4
                              i32.const 304
                              i32.add
                              call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                            end
                            local.get 4
                            local.get 7
                            f64.store offset=200
                            local.get 4
                            i32.const 2
                            i32.store offset=192
                            local.get 4
                            i32.const 208
                            i32.add
                            local.get 4
                            i32.const 24
                            i32.add
                            call $"#func379 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                            local.get 4
                            i64.const 0
                            i64.store offset=312
                            local.get 4
                            i32.const 2
                            i32.store8 offset=304
                            local.get 4
                            i32.const 272
                            i32.add
                            local.get 4
                            i32.const 208
                            i32.add
                            local.get 4
                            i32.const 304
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=272
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 0
                              local.get 4
                              i64.load offset=288
                              i64.store offset=16
                              local.get 0
                              local.get 4
                              i64.load offset=280
                              i64.store offset=8
                              local.get 0
                              i64.const 1
                              i64.store
                              local.get 4
                              i32.const 192
                              i32.add
                              call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              br 2 (;@11;)
                            end
                            local.get 4
                            i32.const 176
                            i32.add
                            local.set 3
                            local.get 4
                            local.get 4
                            i64.load offset=296
                            i64.store offset=328
                            local.get 4
                            local.get 4
                            i64.load offset=288
                            i64.store offset=320
                            local.get 4
                            local.get 4
                            i64.load offset=280
                            i64.store offset=312
                            local.get 4
                            local.get 4
                            i64.load offset=272
                            i64.store offset=304
                            local.get 4
                            i32.const 208
                            i32.add
                            local.get 4
                            i32.const 304
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                            local.get 4
                            i32.const 168
                            i32.add
                            local.get 4
                            i32.const 192
                            i32.add
                            local.get 4
                            i32.const 208
                            i32.add
                            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                            block ;; label = @13
                              local.get 4
                              i64.load offset=168
                              i64.const 1
                              i64.ne
                              br_if 0 (;@13;)
                              local.get 0
                              i64.const 1
                              i64.store
                              local.get 0
                              local.get 3
                              i64.load offset=8
                              i64.store offset=16
                              local.get 0
                              local.get 3
                              i64.load
                              i64.store offset=8
                              br 2 (;@11;)
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=104
                            i64.store offset=40
                            local.get 4
                            local.get 4
                            i64.load offset=112
                            i64.store offset=48
                            local.get 4
                            local.get 4
                            i64.load offset=136
                            i64.store offset=56
                            local.get 4
                            local.get 4
                            i64.load offset=144
                            i64.store offset=64
                            local.get 4
                            local.get 4
                            i64.load offset=152
                            i64.store offset=72
                            local.get 4
                            local.get 4
                            i64.load offset=160
                            i64.store offset=80
                            local.get 4
                            local.get 3
                            i64.load offset=8
                            i64.store offset=96
                            local.get 4
                            local.get 3
                            i64.load
                            i64.store offset=88
                            local.get 4
                            local.get 4
                            i32.const 40
                            i32.add
                            call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 4]>"
                            local.get 0
                            local.get 4
                            i64.load
                            i64.store offset=12 align=4
                            local.get 0
                            i32.const 6
                            i32.store8 offset=8
                            local.get 0
                            i64.const 0
                            i64.store
                            local.get 4
                            i32.const 24
                            i32.add
                            call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 2
                            local.get 2
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 10 (;@2;)
                            br 9 (;@3;)
                          end
                          local.get 0
                          local.get 7
                          f64.store offset=16
                          local.get 0
                          local.get 3
                          i32.store offset=12
                          local.get 0
                          local.get 5
                          i32.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                        end
                        local.get 4
                        i32.const 152
                        i32.add
                        call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 136
                        i32.add
                        call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 104
                        i32.add
                        call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 6 (;@4;)
                      end
                      unreachable
                    end
                    local.get 0
                    local.get 7
                    f64.store offset=16
                    local.get 0
                    local.get 3
                    i32.store offset=12
                    local.get 0
                    local.get 5
                    i32.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    br 4 (;@4;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=307
                  i32.store8 offset=275
                  local.get 4
                  local.get 4
                  i32.load16_u offset=305 align=1
                  i32.store16 offset=273 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=316
                  i32.store offset=284
                  local.get 4
                  local.get 4
                  i64.load offset=308 align=4
                  i64.store offset=276 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=272
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 272
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 0
                local.get 7
                f64.store offset=16
                local.get 0
                local.get 3
                i32.store offset=12
                local.get 0
                local.get 5
                i32.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 104
                i32.add
                call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 2 (;@4;)
              end
              local.get 0
              local.get 7
              f64.store offset=16
              local.get 0
              local.get 3
              i32.store offset=12
              local.get 0
              local.get 5
              i32.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 136
              i32.add
              call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 104
              i32.add
              call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i32.load8_u offset=307
            i32.store8 offset=275
            local.get 4
            local.get 4
            i32.load16_u offset=305 align=1
            i32.store16 offset=273 align=1
            local.get 4
            local.get 4
            i32.load offset=316
            i32.store offset=284
            local.get 4
            local.get 4
            i64.load offset=308 align=4
            i64.store offset=276 align=4
            local.get 4
            local.get 3
            i32.store8 offset=272
            i32.const 1063112
            i32.const 43
            local.get 4
            i32.const 272
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          local.get 4
          i32.const 24
          i32.add
          call $"#func346 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          local.get 2
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
        end
        local.get 4
        i32.const 16
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 352
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 351
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
