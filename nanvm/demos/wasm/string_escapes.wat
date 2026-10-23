  (func $nanvm_demos::samples::string_escapes::module::<nanvm_lib::naive::Naive> (;522;) (type 1) (param i32 i32)
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
    i32.const 1063377
    i32.store offset=24
    local.get 2
    i32.const 1063370
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
          i32.const 175
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1063377
          i32.const 55
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
          call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::string_escapes::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;523;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64 f64)
    global.get $__stack_pointer
    i32.const 288
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    local.get 2
    local.get 2
    i32.load
    i32.const 1
    i32.add
    local.tee 5
    i32.store
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 3
                    i32.store offset=32
                    local.get 4
                    local.get 2
                    i32.store offset=28
                    local.get 4
                    i32.const 6
                    i32.store8 offset=24
                    local.get 4
                    i32.const 0
                    i32.store16 offset=128
                    local.get 4
                    i32.const 1063584
                    i32.store offset=124
                    local.get 4
                    i32.const 1063576
                    i32.store offset=120
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 120
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=184
                    local.tee 5
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 4
                    i32.load offset=192
                    local.set 5
                    local.get 4
                    i32.load offset=188
                    local.set 6
                    local.get 4
                    i32.const 0
                    i32.store16 offset=128
                    local.get 4
                    i32.const 1063588
                    i32.store offset=124
                    local.get 4
                    i32.const 1063584
                    i32.store offset=120
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 120
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=184
                    local.tee 7
                    i32.const 255
                    i32.ne
                    br_if 2 (;@6;)
                    local.get 4
                    i32.load offset=192
                    local.set 7
                    local.get 4
                    i32.load offset=188
                    local.set 8
                    local.get 4
                    i32.const 0
                    i32.store16 offset=128
                    local.get 4
                    i32.const 1063589
                    i32.store offset=124
                    local.get 4
                    i32.const 1063588
                    i32.store offset=120
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 120
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=184
                    local.tee 9
                    i32.const 255
                    i32.ne
                    br_if 3 (;@5;)
                    local.get 4
                    i64.load offset=188 align=4
                    local.set 10
                    local.get 4
                    i32.const 0
                    i32.store8 offset=120
                    local.get 4
                    local.get 10
                    i64.store offset=228 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=224
                    local.get 4
                    local.get 7
                    i32.store offset=216
                    local.get 4
                    local.get 8
                    i32.store offset=212
                    local.get 4
                    i32.const 3
                    i32.store8 offset=208
                    local.get 4
                    local.get 5
                    i32.store offset=200
                    local.get 4
                    local.get 6
                    i32.store offset=196
                    local.get 4
                    i32.const 3
                    i32.store8 offset=192
                    local.get 4
                    i64.const 12884901888
                    i64.store offset=184
                    local.get 4
                    local.get 4
                    i32.const 120
                    i32.add
                    i32.store offset=240
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 184
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=12
                    local.tee 6
                    i32.store offset=156
                    local.get 4
                    local.get 4
                    i32.load offset=8
                    local.tee 5
                    i32.store offset=152
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=120
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 5
                      local.get 5
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 2
                      i32.store
                      local.get 2
                      br_if 8 (;@1;)
                      local.get 4
                      i32.const 152
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 8 (;@1;)
                    end
                    local.get 5
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    local.get 6
                    i32.store offset=272
                    local.get 4
                    local.get 5
                    i32.store offset=268
                    local.get 4
                    i32.const 6
                    i32.store8 offset=264
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 5
                    i32.store
                    local.get 5
                    i32.eqz
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 2
                    i32.store offset=156
                    local.get 4
                    i32.const 6
                    i32.store8 offset=152
                    local.get 4
                    local.get 3
                    i64.extend_i32_u
                    i64.store offset=160
                    local.get 4
                    i64.const 0
                    i64.store offset=192
                    local.get 4
                    i32.const 2
                    i32.store8 offset=184
                    local.get 4
                    i32.const 88
                    i32.add
                    local.get 4
                    i32.const 152
                    i32.add
                    local.get 4
                    i32.const 184
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=88
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=104
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=96
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 264
                        i32.add
                        call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=112
                      i64.store offset=208
                      local.get 4
                      local.get 4
                      i64.load offset=104
                      i64.store offset=200
                      local.get 4
                      local.get 4
                      i64.load offset=96
                      i64.store offset=192
                      local.get 4
                      local.get 4
                      i64.load offset=88
                      i64.store offset=184
                      local.get 4
                      i32.const 152
                      i32.add
                      local.get 4
                      i32.const 184
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=152
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=160
                          i64.store offset=48
                          local.get 4
                          local.get 4
                          i64.load offset=152
                          i64.store offset=40
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.const 256
                        i32.store16 offset=40
                      end
                      local.get 4
                      i32.const 184
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 200
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 184
                      i32.add
                      local.get 4
                      i32.const 40
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                      local.get 4
                      f64.load offset=200
                      local.set 11
                      local.get 4
                      i32.load offset=196
                      local.set 3
                      local.get 4
                      i32.load offset=192
                      local.set 5
                      block ;; label = @10
                        local.get 4
                        i32.load offset=184
                        br_if 0 (;@10;)
                        block ;; label = @11
                          local.get 5
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 11
                          f64.store offset=188 align=4
                          local.get 4
                          local.get 3
                          i32.store offset=184
                          local.get 4
                          i32.const 184
                          i32.add
                          call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                          local.set 11
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
                          i32.const 184
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                        end
                        local.get 4
                        local.get 11
                        f64.store offset=64
                        local.get 4
                        i32.const 2
                        i32.store offset=56
                        local.get 4
                        i32.const 120
                        i32.add
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 56
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=120
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=136
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=128
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 2 (;@9;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=144
                        i64.store offset=208
                        local.get 4
                        local.get 4
                        i64.load offset=136
                        i64.store offset=200
                        local.get 4
                        local.get 4
                        i64.load offset=128
                        i64.store offset=192
                        local.get 4
                        local.get 4
                        i64.load offset=120
                        i64.store offset=184
                        local.get 4
                        i32.const 152
                        i32.add
                        local.get 4
                        i32.const 184
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=152
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=160
                            i64.store offset=80
                            local.get 4
                            local.get 4
                            i64.load offset=152
                            i64.store offset=72
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=72
                        end
                        local.get 4
                        i32.const 184
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 200
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 0
                        i32.store16 offset=260
                        local.get 4
                        i32.const 1063595
                        i32.store offset=256
                        local.get 4
                        i32.const 1063589
                        i32.store offset=252
                        local.get 4
                        i32.const 184
                        i32.add
                        local.get 4
                        i32.const 252
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=184
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 6 (;@4;)
                        local.get 4
                        local.get 4
                        i64.load offset=188 align=4
                        i64.store offset=268 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=264
                        local.get 4
                        i32.const 152
                        i32.add
                        local.get 4
                        i32.const 72
                        i32.add
                        local.get 4
                        i32.const 264
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=152
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 0
                            local.get 4
                            i64.load offset=168
                            i64.store offset=16
                            local.get 0
                            local.get 4
                            i64.load offset=160
                            i64.store offset=8
                            i64.const 1
                            local.set 10
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=176
                          i64.store offset=208
                          local.get 4
                          local.get 4
                          i64.load offset=168
                          i64.store offset=200
                          local.get 4
                          local.get 4
                          i64.load offset=160
                          i64.store offset=192
                          local.get 4
                          local.get 4
                          i64.load offset=152
                          i64.store offset=184
                          local.get 4
                          i32.const 264
                          i32.add
                          local.get 4
                          i32.const 184
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=264
                              i32.const 255
                              i32.eq
                              br_if 0 (;@13;)
                              local.get 0
                              i32.const 8
                              i32.add
                              local.tee 3
                              local.get 4
                              i64.load offset=272
                              i64.store offset=8
                              local.get 3
                              local.get 4
                              i64.load offset=264
                              i64.store
                              br 1 (;@12;)
                            end
                            local.get 0
                            i32.const 256
                            i32.store16 offset=8
                          end
                          local.get 4
                          i32.const 184
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 4
                          i32.const 200
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          i64.const 0
                          local.set 10
                        end
                        local.get 0
                        local.get 10
                        i64.store
                        local.get 4
                        i32.const 24
                        i32.add
                        call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 2
                        local.get 2
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 0
                        i32.store
                        local.get 0
                        br_if 8 (;@2;)
                        br 7 (;@3;)
                      end
                      local.get 0
                      local.get 11
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
                      i32.const 264
                      i32.add
                      call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    end
                    local.get 4
                    i32.const 24
                    i32.add
                    call $"#func520 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    i32.eqz
                    br_if 5 (;@3;)
                    br 6 (;@2;)
                  end
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=187
                i32.store8 offset=155
                local.get 4
                local.get 4
                i32.load16_u offset=185 align=1
                i32.store16 offset=153 align=1
                local.get 4
                local.get 4
                i32.load offset=196
                i32.store offset=164
                local.get 4
                local.get 4
                i64.load offset=188 align=4
                i64.store offset=156 align=4
                local.get 4
                local.get 5
                i32.store8 offset=152
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 152
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              local.get 4
              i32.load8_u offset=187
              i32.store8 offset=155
              local.get 4
              local.get 4
              i32.load16_u offset=185 align=1
              i32.store16 offset=153 align=1
              local.get 4
              local.get 4
              i32.load offset=196
              i32.store offset=164
              local.get 4
              local.get 4
              i64.load offset=188 align=4
              i64.store offset=156 align=4
              local.get 4
              local.get 7
              i32.store8 offset=152
              i32.const 1063112
              i32.const 43
              local.get 4
              i32.const 152
              i32.add
              i32.const 1063096
              i32.const 1063156
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            local.get 4
            i32.load8_u offset=187
            i32.store8 offset=155
            local.get 4
            local.get 4
            i32.load16_u offset=185 align=1
            i32.store16 offset=153 align=1
            local.get 4
            local.get 4
            i32.load offset=196
            i32.store offset=164
            local.get 4
            local.get 4
            i64.load offset=188 align=4
            i64.store offset=156 align=4
            local.get 4
            local.get 9
            i32.store8 offset=152
            i32.const 1063112
            i32.const 43
            local.get 4
            i32.const 152
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          local.get 4
          local.get 4
          i32.load8_u offset=187
          i32.store8 offset=155
          local.get 4
          local.get 4
          i32.load16_u offset=185 align=1
          i32.store16 offset=153 align=1
          local.get 4
          local.get 4
          i32.load offset=196
          i32.store offset=164
          local.get 4
          local.get 4
          i64.load offset=188 align=4
          i64.store offset=156 align=4
          local.get 4
          local.get 3
          i32.store8 offset=152
          i32.const 1063112
          i32.const 43
          local.get 4
          i32.const 152
          i32.add
          i32.const 1063096
          i32.const 1063156
          call $core::result::unwrap_failed
          unreachable
        end
        local.get 4
        i32.const 16
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 288
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 287
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
