  (func $nanvm_demos::samples::identifiers::module::<nanvm_lib::naive::Naive> (;429;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=32
    local.get 2
    i32.const 1060277
    i32.store offset=28
    local.get 2
    i32.const 1060275
    i32.store offset=24
    local.get 2
    i32.const 40
    i32.add
    local.get 2
    i32.const 24
    i32.add
    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=40
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 2
                  i32.load offset=48
                  local.set 3
                  local.get 2
                  i32.load offset=44
                  local.set 4
                  local.get 2
                  i32.const 0
                  i32.store16 offset=32
                  local.get 2
                  i32.const 1060284
                  i32.store offset=28
                  local.get 2
                  i32.const 1060277
                  i32.store offset=24
                  local.get 2
                  i32.const 40
                  i32.add
                  local.get 2
                  i32.const 24
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 2
                  i32.load8_u offset=40
                  local.tee 5
                  i32.const 255
                  i32.ne
                  br_if 1 (;@6;)
                  local.get 2
                  i64.load offset=44 align=4
                  local.set 6
                  local.get 2
                  i32.const 0
                  i32.store8 offset=24
                  local.get 2
                  i64.const 4616189618054758400
                  i64.store offset=88
                  local.get 2
                  i32.const 2
                  i32.store8 offset=80
                  local.get 2
                  local.get 6
                  i64.store offset=72
                  local.get 2
                  i64.const 4613937818241073152
                  i64.store offset=64
                  local.get 2
                  i32.const 2
                  i32.store8 offset=56
                  local.get 2
                  local.get 3
                  i32.store offset=52
                  local.get 2
                  local.get 4
                  i32.store offset=48
                  local.get 2
                  i64.const 8589934592
                  i64.store offset=40
                  local.get 2
                  local.get 2
                  i32.const 24
                  i32.add
                  i32.store offset=96
                  local.get 2
                  i32.const 16
                  i32.add
                  local.get 2
                  i32.const 40
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=20
                  local.tee 4
                  i32.store offset=124
                  local.get 2
                  local.get 2
                  i32.load offset=16
                  local.tee 3
                  i32.store offset=120
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=24
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 7 (;@1;)
                    local.get 2
                    i32.const 120
                    i32.add
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 7 (;@1;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 2
                  local.get 4
                  i32.store offset=32
                  local.get 2
                  local.get 3
                  i32.store offset=28
                  local.get 2
                  i32.const 5
                  i32.store8 offset=24
                  local.get 2
                  i32.const 0
                  i32.store16 offset=116
                  local.get 2
                  i32.const 1060284
                  i32.store offset=112
                  local.get 2
                  i32.const 1060277
                  i32.store offset=108
                  local.get 2
                  i32.const 40
                  i32.add
                  local.get 2
                  i32.const 108
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 2
                  i32.load8_u offset=40
                  local.tee 5
                  i32.const 255
                  i32.ne
                  br_if 2 (;@5;)
                  local.get 2
                  i32.load offset=48
                  local.set 7
                  local.get 2
                  i32.load offset=44
                  local.set 8
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 5
                  i32.store
                  local.get 5
                  i32.eqz
                  br_if 3 (;@4;)
                  local.get 2
                  i32.const 0
                  i32.store8 offset=108
                  local.get 2
                  local.get 4
                  i64.extend_i32_u
                  i64.store offset=56
                  local.get 2
                  local.get 3
                  i32.store offset=52
                  local.get 2
                  i32.const 5
                  i32.store8 offset=48
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=40
                  local.get 2
                  local.get 2
                  i32.const 108
                  i32.add
                  i32.store offset=64
                  local.get 2
                  i32.const 8
                  i32.add
                  local.get 2
                  i32.const 40
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=12
                  local.tee 4
                  i32.store offset=124
                  local.get 2
                  local.get 2
                  i32.load offset=8
                  local.tee 3
                  i32.store offset=120
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=108
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 6 (;@2;)
                    local.get 2
                    i32.const 120
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 6 (;@2;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 5 (;@2;)
                  i32.const 114
                  i32.const 0
                  local.get 3
                  local.get 4
                  i32.const 1060284
                  i32.const 37
                  call $<nanvm_lib::naive::function::Function>::new
                  local.set 3
                  local.get 2
                  i32.const 0
                  i32.store8 offset=108
                  local.get 2
                  local.get 3
                  i32.store offset=60
                  local.get 2
                  i32.const 7
                  i32.store8 offset=56
                  local.get 2
                  local.get 7
                  i32.store offset=52
                  local.get 2
                  local.get 8
                  i32.store offset=48
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=40
                  local.get 2
                  local.get 2
                  i32.const 108
                  i32.add
                  i32.store offset=72
                  local.get 2
                  local.get 2
                  i32.const 40
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=4
                  local.tee 4
                  i32.store offset=124
                  local.get 2
                  local.get 2
                  i32.load
                  local.tee 3
                  i32.store offset=120
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=108
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 5 (;@3;)
                    local.get 2
                    i32.const 120
                    i32.add
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 4 (;@3;)
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
                  local.get 2
                  i32.const 24
                  i32.add
                  call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 1
                  call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 2
                  i32.const 144
                  i32.add
                  global.set $__stack_pointer
                  return
                end
                local.get 2
                local.get 2
                i32.load8_u offset=43
                i32.store8 offset=123
                local.get 2
                local.get 2
                i32.load16_u offset=41 align=1
                i32.store16 offset=121 align=1
                local.get 2
                local.get 2
                i32.load offset=52
                i32.store offset=132
                local.get 2
                local.get 2
                i64.load offset=44 align=4
                i64.store offset=124 align=4
                local.get 2
                local.get 3
                i32.store8 offset=120
                i32.const 1055372
                i32.const 43
                local.get 2
                i32.const 120
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 2
              local.get 2
              i32.load8_u offset=43
              i32.store8 offset=123
              local.get 2
              local.get 2
              i32.load16_u offset=41 align=1
              i32.store16 offset=121 align=1
              local.get 2
              local.get 2
              i32.load offset=52
              i32.store offset=132
              local.get 2
              local.get 2
              i64.load offset=44 align=4
              i64.store offset=124 align=4
              local.get 2
              local.get 5
              i32.store8 offset=120
              i32.const 1055372
              i32.const 43
              local.get 2
              i32.const 120
              i32.add
              i32.const 1055356
              i32.const 1055416
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 2
            local.get 2
            i32.load8_u offset=43
            i32.store8 offset=123
            local.get 2
            local.get 2
            i32.load16_u offset=41 align=1
            i32.store16 offset=121 align=1
            local.get 2
            local.get 2
            i32.load offset=52
            i32.store offset=132
            local.get 2
            local.get 2
            i64.load offset=44 align=4
            i64.store offset=124 align=4
            local.get 2
            local.get 5
            i32.store8 offset=120
            i32.const 1055372
            i32.const 43
            local.get 2
            i32.const 120
            i32.add
            i32.const 1055356
            i32.const 1055416
            call $core::result::unwrap_failed
          end
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 2
        i32.const 143
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 143
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 143
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::identifiers::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;430;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 416
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=20
    local.get 4
    local.get 2
    i32.store offset=16
    local.get 2
    local.get 2
    i32.load
    local.tee 5
    i32.const 1
    i32.add
    local.tee 6
    i32.store
    block ;; label = @1
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
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
      i64.const 4607182418800017408
      i64.store offset=320
      local.get 4
      i32.const 2
      i32.store8 offset=312
      local.get 2
      local.get 5
      i32.const 2
      i32.add
      local.tee 6
      i32.store
      local.get 6
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 2
      i32.store offset=236
      local.get 4
      i32.const 6
      i32.store8 offset=232
      local.get 4
      local.get 3
      i64.extend_i32_u
      i64.store offset=240
      local.get 4
      i64.const 0
      i64.store offset=336
      local.get 4
      i32.const 2
      i32.store8 offset=328
      local.get 4
      i32.const 200
      i32.add
      local.get 4
      i32.const 232
      i32.add
      local.get 4
      i32.const 328
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=200
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 4
                    i64.load offset=216
                    i64.store offset=16
                    local.get 0
                    local.get 4
                    i64.load offset=208
                    i64.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=224
                  i64.store offset=352
                  local.get 4
                  local.get 4
                  i64.load offset=216
                  i64.store offset=344
                  local.get 4
                  local.get 4
                  i64.load offset=208
                  i64.store offset=336
                  local.get 4
                  local.get 4
                  i64.load offset=200
                  i64.store offset=328
                  local.get 4
                  i32.const 232
                  i32.add
                  local.get 4
                  i32.const 328
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=232
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=240
                      i64.store offset=128
                      local.get 4
                      local.get 4
                      i64.load offset=232
                      i64.store offset=120
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=120
                  end
                  local.get 4
                  i32.const 328
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 344
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 264
                  i32.add
                  local.get 4
                  i32.const 312
                  i32.add
                  local.get 4
                  i32.const 120
                  i32.add
                  call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
                  local.get 4
                  local.get 4
                  i64.load offset=272
                  i64.store offset=104
                  local.get 4
                  local.get 4
                  i64.load offset=280
                  i64.store offset=112
                  block ;; label = @8
                    local.get 4
                    i64.load offset=264
                    i64.const 1
                    i64.ne
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 4
                    i64.load offset=112
                    i64.store offset=16
                    local.get 0
                    local.get 4
                    i64.load offset=104
                    i64.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=112
                  i64.store offset=96
                  local.get 4
                  local.get 4
                  i64.load offset=104
                  i64.store offset=88
                  local.get 4
                  i64.const 4611686018427387904
                  i64.store offset=144
                  local.get 4
                  i32.const 2
                  i32.store8 offset=136
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 1
                        i32.load offset=16
                        i32.eqz
                        br_if 0 (;@10;)
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 1
                                        i32.load offset=12
                                        local.tee 3
                                        i32.load8_u offset=8
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 3
                                      i64.load offset=16
                                      local.set 7
                                      br 9 (;@8;)
                                    end
                                    local.get 3
                                    i32.load offset=12
                                    local.tee 6
                                    local.get 6
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 8
                                    i32.store
                                    local.get 8
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
                                  end
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 6
                                  local.get 6
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 8
                                  i32.store
                                  local.get 8
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 3
                                  i64.load8_u offset=20
                                  i64.const 32
                                  i64.shl
                                  local.get 3
                                  i64.load32_u offset=16
                                  i64.or
                                  local.set 7
                                  br 7 (;@8;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 6
                                local.get 6
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 8
                                i32.store
                                local.get 8
                                br_if 5 (;@9;)
                                br 13 (;@1;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 6
                              local.get 6
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 8
                              i32.store
                              local.get 8
                              br_if 4 (;@9;)
                              br 12 (;@1;)
                            end
                            local.get 3
                            i32.load offset=12
                            local.tee 6
                            local.get 6
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 3
                            i32.store
                            local.get 3
                            i32.eqz
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 3
                          i32.load8_u offset=9
                          local.set 3
                        end
                        br 2 (;@8;)
                      end
                      i32.const 0
                      i32.const 0
                      i32.const 1062708
                      call $core::panicking::panic_bounds_check
                      unreachable
                    end
                    local.get 3
                    i64.load32_u offset=16
                    local.set 7
                  end
                  local.get 4
                  local.get 7
                  i64.store offset=320
                  local.get 4
                  local.get 6
                  i32.store offset=316
                  local.get 4
                  local.get 3
                  i32.store8 offset=313
                  local.get 4
                  local.get 5
                  i32.store8 offset=312
                  local.get 4
                  i32.const 0
                  i32.store16 offset=240
                  local.get 4
                  i32.const 1060277
                  i32.store offset=236
                  local.get 4
                  i32.const 1060275
                  i32.store offset=232
                  local.get 4
                  i32.const 328
                  i32.add
                  local.get 4
                  i32.const 232
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=328
                            local.tee 3
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=332 align=4
                            i64.store offset=268 align=4
                            local.get 4
                            i32.const 3
                            i32.store8 offset=264
                            local.get 4
                            i32.const 232
                            i32.add
                            local.get 4
                            i32.const 312
                            i32.add
                            local.get 4
                            i32.const 264
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=232
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 0
                              local.get 4
                              i64.load offset=248
                              i64.store offset=16
                              local.get 0
                              local.get 4
                              i64.load offset=240
                              i64.store offset=8
                              local.get 0
                              i64.const 1
                              i64.store
                              br 5 (;@8;)
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=256
                            i64.store offset=352
                            local.get 4
                            local.get 4
                            i64.load offset=248
                            i64.store offset=344
                            local.get 4
                            local.get 4
                            i64.load offset=240
                            i64.store offset=336
                            local.get 4
                            local.get 4
                            i64.load offset=232
                            i64.store offset=328
                            local.get 4
                            i32.const 264
                            i32.add
                            local.get 4
                            i32.const 328
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=264
                                local.tee 3
                                i32.const 255
                                i32.ne
                                br_if 0 (;@14;)
                                i32.const 0
                                local.set 3
                                i32.const 1
                                local.set 6
                                br 1 (;@13;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=266 align=2
                              i64.store offset=168
                              local.get 4
                              local.get 4
                              i64.load offset=272 align=2
                              i64.store offset=174 align=2
                              local.get 4
                              i32.load8_u offset=265
                              local.set 6
                            end
                            local.get 4
                            i32.const 328
                            i32.add
                            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            i32.const 344
                            i32.add
                            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            local.get 6
                            i32.store8 offset=153
                            local.get 4
                            local.get 3
                            i32.store8 offset=152
                            local.get 4
                            local.get 4
                            i64.load offset=168
                            i64.store offset=154 align=2
                            local.get 4
                            local.get 4
                            i64.load offset=174 align=2
                            i64.store offset=160 align=2
                            local.get 1
                            i32.load offset=16
                            i32.eqz
                            br_if 1 (;@11;)
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            local.get 1
                                            i32.load offset=12
                                            local.tee 1
                                            i32.load8_u offset=8
                                            local.tee 8
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 1
                                          i64.load offset=16
                                          local.set 7
                                          br 10 (;@9;)
                                        end
                                        local.get 1
                                        i32.load offset=12
                                        local.tee 5
                                        local.get 5
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 9
                                        i32.store
                                        local.get 9
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 8 (;@10;)
                                      end
                                      local.get 1
                                      i32.load offset=12
                                      local.tee 5
                                      local.get 5
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 9
                                      i32.store
                                      local.get 9
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 1
                                      i64.load8_u offset=20
                                      i64.const 32
                                      i64.shl
                                      local.get 1
                                      i64.load32_u offset=16
                                      i64.or
                                      local.set 7
                                      br 8 (;@9;)
                                    end
                                    local.get 1
                                    i32.load offset=12
                                    local.tee 5
                                    local.get 5
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 9
                                    i32.store
                                    local.get 9
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 6 (;@10;)
                                  end
                                  local.get 1
                                  i32.load offset=12
                                  local.tee 5
                                  local.get 5
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 9
                                  i32.store
                                  local.get 9
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 5 (;@10;)
                                end
                                local.get 1
                                i32.load offset=12
                                local.tee 5
                                local.get 5
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 1
                                i32.store
                                local.get 1
                                i32.eqz
                                br_if 13 (;@1;)
                                br 1 (;@13;)
                              end
                              local.get 1
                              i32.load8_u offset=9
                              local.set 1
                            end
                            br 3 (;@9;)
                          end
                          local.get 4
                          local.get 4
                          i32.load8_u offset=331
                          i32.store8 offset=267
                          local.get 4
                          local.get 4
                          i32.load16_u offset=329 align=1
                          i32.store16 offset=265 align=1
                          local.get 4
                          local.get 4
                          i32.load offset=340
                          i32.store offset=276
                          local.get 4
                          local.get 4
                          i64.load offset=332 align=4
                          i64.store offset=268 align=4
                          local.get 4
                          local.get 3
                          i32.store8 offset=264
                          i32.const 1055372
                          i32.const 43
                          local.get 4
                          i32.const 264
                          i32.add
                          i32.const 1055356
                          i32.const 1055416
                          call $core::result::unwrap_failed
                          unreachable
                        end
                        i32.const 0
                        i32.const 0
                        i32.const 1062708
                        call $core::panicking::panic_bounds_check
                        unreachable
                      end
                      local.get 1
                      i64.load32_u offset=16
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=192
                    local.get 4
                    local.get 5
                    i32.store offset=188
                    local.get 4
                    local.get 1
                    i32.store8 offset=185
                    local.get 4
                    local.get 8
                    i32.store8 offset=184
                    local.get 4
                    i32.const 0
                    i32.store16 offset=308
                    local.get 4
                    i32.const 1060284
                    i32.store offset=304
                    local.get 4
                    i32.const 1060277
                    i32.store offset=300
                    local.get 4
                    i32.const 328
                    i32.add
                    local.get 4
                    i32.const 300
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=328
                    local.tee 1
                    i32.const 255
                    i32.ne
                    br_if 5 (;@3;)
                    local.get 4
                    local.get 4
                    i64.load offset=332 align=4
                    i64.store offset=316 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=312
                    local.get 4
                    i32.const 264
                    i32.add
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    local.get 4
                    i32.load8_u offset=264
                    i32.const 255
                    i32.ne
                    br_if 2 (;@6;)
                    local.get 0
                    local.get 4
                    i64.load offset=280
                    i64.store offset=16
                    local.get 0
                    local.get 4
                    i64.load offset=272
                    i64.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    local.get 4
                    i32.const 152
                    i32.add
                    call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 136
                  i32.add
                  call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 88
                  i32.add
                  call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 24
                i32.add
                call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                local.get 2
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                i32.eqz
                br_if 1 (;@5;)
                br 2 (;@4;)
              end
              local.get 4
              local.get 4
              i64.load offset=288
              i64.store offset=352
              local.get 4
              local.get 4
              i64.load offset=280
              i64.store offset=344
              local.get 4
              local.get 4
              i64.load offset=272
              i64.store offset=336
              local.get 4
              local.get 4
              i64.load offset=264
              i64.store offset=328
              local.get 4
              i32.const 312
              i32.add
              local.get 4
              i32.const 328
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              i32.const 1
              local.set 1
              i32.const 0
              local.set 5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=312
                local.tee 8
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=314 align=2
                i64.store offset=40
                local.get 4
                local.get 4
                i64.load offset=320 align=2
                i64.store offset=46 align=2
                local.get 4
                i32.load8_u offset=313
                local.set 1
                local.get 8
                local.set 5
              end
              local.get 4
              i32.const 328
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 344
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              local.get 4
              i64.load offset=88
              i64.store offset=56
              local.get 4
              local.get 4
              i64.load offset=96
              i64.store offset=64
              local.get 4
              local.get 4
              i64.load offset=136
              i64.store offset=72
              local.get 4
              local.get 4
              i64.load offset=144
              i64.store offset=80
              local.get 4
              local.get 4
              i64.load offset=174 align=2
              i64.store offset=376 align=2
              local.get 4
              local.get 4
              i64.load offset=168
              i64.store offset=370 align=2
              local.get 4
              i32.const 0
              i32.store8 offset=184
              local.get 4
              i64.const 17179869184
              i64.store offset=328
              local.get 4
              local.get 4
              i64.load offset=56
              i64.store offset=336
              local.get 4
              local.get 4
              i64.load offset=64
              i64.store offset=344
              local.get 4
              local.get 4
              i64.load offset=72
              i64.store offset=352
              local.get 4
              local.get 4
              i64.load offset=80
              i64.store offset=360
              local.get 4
              local.get 1
              i32.store8 offset=385
              local.get 4
              local.get 5
              i32.store8 offset=384
              local.get 4
              local.get 6
              i32.store8 offset=369
              local.get 4
              local.get 3
              i32.store8 offset=368
              local.get 4
              local.get 4
              i64.load offset=46 align=2
              i64.store offset=392 align=2
              local.get 4
              local.get 4
              i64.load offset=40
              i64.store offset=386 align=2
              local.get 4
              local.get 4
              i32.const 184
              i32.add
              i32.store offset=400
              local.get 4
              i32.const 8
              i32.add
              local.get 4
              i32.const 328
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 4>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 4
              local.get 4
              i32.load offset=12
              local.tee 1
              i32.store offset=316
              local.get 4
              local.get 4
              i32.load offset=8
              local.tee 3
              i32.store offset=312
              block ;; label = @6
                local.get 4
                i32.load8_u offset=184
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 3
                local.get 3
                i32.load
                i32.const -1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                br_if 4 (;@2;)
                local.get 4
                i32.const 312
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 4 (;@2;)
              end
              local.get 3
              i32.eqz
              br_if 3 (;@2;)
              local.get 0
              local.get 1
              i32.store offset=16
              local.get 0
              local.get 3
              i32.store offset=12
              local.get 0
              i32.const 6
              i32.store8 offset=8
              local.get 0
              i64.const 0
              i64.store
              local.get 4
              i32.const 24
              i32.add
              call $"#func426 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              local.get 2
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 1 (;@4;)
            end
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 416
          i32.add
          global.set $__stack_pointer
          return
        end
        local.get 4
        local.get 4
        i32.load8_u offset=331
        i32.store8 offset=267
        local.get 4
        local.get 4
        i32.load16_u offset=329 align=1
        i32.store16 offset=265 align=1
        local.get 4
        local.get 4
        i32.load offset=340
        i32.store offset=276
        local.get 4
        local.get 4
        i64.load offset=332 align=4
        i64.store offset=268 align=4
        local.get 4
        local.get 1
        i32.store8 offset=264
        i32.const 1055372
        i32.const 43
        local.get 4
        i32.const 264
        i32.add
        i32.const 1055356
        i32.const 1055416
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 415
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
