  (func $nanvm_demos::samples::property_access::module::<nanvm_lib::naive::Naive> (;332;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=48
    local.get 2
    i32.const 1057436
    i32.store offset=44
    local.get 2
    i32.const 1057431
    i32.store offset=40
    local.get 2
    i32.const 56
    i32.add
    local.get 2
    i32.const 40
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
                  i32.load8_u offset=56
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 2
                  i32.load offset=64
                  local.set 4
                  local.get 2
                  i32.load offset=60
                  local.set 5
                  local.get 2
                  i32.const 0
                  i32.store8 offset=40
                  local.get 2
                  i64.const 4646500954609287168
                  i64.store offset=88
                  local.get 2
                  i32.const 2
                  i32.store8 offset=80
                  local.get 2
                  i64.const 4635329916471083008
                  i64.store offset=72
                  local.get 2
                  i32.const 2
                  i32.store8 offset=64
                  local.get 2
                  i64.const 8589934592
                  i64.store offset=56
                  local.get 2
                  local.get 2
                  i32.const 40
                  i32.add
                  i32.store offset=96
                  local.get 2
                  i32.const 32
                  i32.add
                  local.get 2
                  i32.const 56
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=36
                  local.tee 6
                  i32.store offset=124
                  local.get 2
                  local.get 2
                  i32.load offset=32
                  local.tee 3
                  i32.store offset=120
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=40
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
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 7 (;@1;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 2
                  i32.const 0
                  i32.store8 offset=40
                  local.get 2
                  local.get 6
                  i32.store offset=80
                  local.get 2
                  local.get 3
                  i32.store offset=76
                  local.get 2
                  i32.const 6
                  i32.store8 offset=72
                  local.get 2
                  local.get 4
                  i32.store offset=68
                  local.get 2
                  local.get 5
                  i32.store offset=64
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=56
                  local.get 2
                  local.get 2
                  i32.const 40
                  i32.add
                  i32.store offset=88
                  local.get 2
                  i32.const 24
                  i32.add
                  local.get 2
                  i32.const 56
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=28
                  local.tee 4
                  i32.store offset=124
                  local.get 2
                  local.get 2
                  i32.load offset=24
                  local.tee 3
                  i32.store offset=120
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=40
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
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 6 (;@2;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 5 (;@2;)
                  local.get 2
                  local.get 4
                  i32.store offset=48
                  local.get 2
                  local.get 3
                  i32.store offset=44
                  local.get 2
                  i32.const 5
                  i32.store8 offset=40
                  local.get 2
                  i32.const 0
                  i32.store16 offset=116
                  local.get 2
                  i32.const 1057339
                  i32.store offset=112
                  local.get 2
                  i32.const 1057332
                  i32.store offset=108
                  local.get 2
                  i32.const 56
                  i32.add
                  local.get 2
                  i32.const 108
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 2
                  i32.load8_u offset=56
                  local.tee 5
                  i32.const 255
                  i32.ne
                  br_if 1 (;@6;)
                  local.get 2
                  i32.load offset=64
                  local.set 6
                  local.get 2
                  i32.load offset=60
                  local.set 7
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 5
                  i32.store
                  local.get 5
                  i32.eqz
                  br_if 2 (;@5;)
                  local.get 2
                  i32.const 0
                  i32.store8 offset=108
                  local.get 2
                  local.get 4
                  i64.extend_i32_u
                  i64.store offset=72
                  local.get 2
                  local.get 3
                  i32.store offset=68
                  local.get 2
                  i32.const 5
                  i32.store8 offset=64
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=56
                  local.get 2
                  local.get 2
                  i32.const 108
                  i32.add
                  i32.store offset=80
                  local.get 2
                  i32.const 16
                  i32.add
                  local.get 2
                  i32.const 56
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
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
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 4 (;@3;)
                  i32.const 75
                  i32.const 0
                  local.get 3
                  local.get 4
                  i32.const 1057436
                  i32.const 50
                  call $<nanvm_lib::naive::function::Function>::new
                  local.set 3
                  local.get 2
                  i32.const 0
                  i32.store8 offset=108
                  local.get 2
                  local.get 3
                  i32.store offset=76
                  local.get 2
                  i32.const 7
                  i32.store8 offset=72
                  local.get 2
                  local.get 6
                  i32.store offset=68
                  local.get 2
                  local.get 7
                  i32.store offset=64
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=56
                  local.get 2
                  local.get 2
                  i32.const 108
                  i32.add
                  i32.store offset=88
                  local.get 2
                  i32.const 8
                  i32.add
                  local.get 2
                  i32.const 56
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
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
                    br_if 4 (;@4;)
                    local.get 2
                    i32.const 120
                    i32.add
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 4 (;@4;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 3 (;@4;)
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
                  i32.const 40
                  i32.add
                  call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 1
                  call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 2
                  i32.const 144
                  i32.add
                  global.set $__stack_pointer
                  return
                end
                local.get 2
                local.get 2
                i32.load8_u offset=59
                i32.store8 offset=123
                local.get 2
                local.get 2
                i32.load16_u offset=57 align=1
                i32.store16 offset=121 align=1
                local.get 2
                local.get 2
                i32.load offset=68
                i32.store offset=132
                local.get 2
                local.get 2
                i64.load offset=60 align=4
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
              i32.load8_u offset=59
              i32.store8 offset=123
              local.get 2
              local.get 2
              i32.load16_u offset=57 align=1
              i32.store16 offset=121 align=1
              local.get 2
              local.get 2
              i32.load offset=68
              i32.store offset=132
              local.get 2
              local.get 2
              i64.load offset=60 align=4
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
  (func $"<nanvm_demos::samples::property_access::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;333;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 f64)
    global.get $__stack_pointer
    i32.const 368
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
    i32.const 1
    i32.add
    local.tee 5
    i32.store
    block ;; label = @1
      local.get 5
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
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            i32.eqz
            br_if 0 (;@4;)
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 1
                            i32.load offset=12
                            local.tee 5
                            i32.load8_u offset=8
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 5
                          i64.load offset=16
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 5
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 5
                      i32.load offset=12
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 5
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 5
                      i64.load32_u offset=16
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 5
                    i32.load offset=12
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 5
                  i32.load offset=12
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 5
                i32.load offset=12
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 5
                i32.store
                local.get 5
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 5
              i32.load8_u offset=9
              local.set 5
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=160
      local.get 4
      local.get 3
      i32.store offset=156
      local.get 4
      local.get 5
      i32.store8 offset=153
      local.get 4
      local.get 6
      i32.store8 offset=152
      local.get 4
      i32.const 0
      i32.store16 offset=128
      local.get 4
      i32.const 1057436
      i32.store offset=124
      local.get 4
      i32.const 1057431
      i32.store offset=120
      local.get 4
      i32.const 312
      i32.add
      local.get 4
      i32.const 120
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=312
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=316 align=4
                  i64.store offset=188 align=4
                  local.get 4
                  i32.const 3
                  i32.store8 offset=184
                  local.get 4
                  i32.const 120
                  i32.add
                  local.get 4
                  i32.const 152
                  i32.add
                  local.get 4
                  i32.const 184
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=120
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
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
                    br 4 (;@4;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=144
                  i64.store offset=336
                  local.get 4
                  local.get 4
                  i64.load offset=136
                  i64.store offset=328
                  local.get 4
                  local.get 4
                  i64.load offset=128
                  i64.store offset=320
                  local.get 4
                  local.get 4
                  i64.load offset=120
                  i64.store offset=312
                  local.get 4
                  i32.const 184
                  i32.add
                  local.get 4
                  i32.const 312
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=184
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=192
                      i64.store offset=304
                      local.get 4
                      local.get 4
                      i64.load offset=184
                      i64.store offset=296
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=296
                  end
                  local.get 4
                  i32.const 312
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 328
                  i32.add
                  call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=24
                                  local.tee 5
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=32
                                local.set 7
                                br 9 (;@5;)
                              end
                              local.get 4
                              i32.load offset=28
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 6
                              i32.store
                              local.get 6
                              i32.eqz
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=28
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 6
                            i32.store
                            local.get 6
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 4
                            i64.load8_u offset=36
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=32
                            i64.or
                            local.set 7
                            br 7 (;@5;)
                          end
                          local.get 4
                          i32.load offset=28
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 6
                          i32.store
                          local.get 6
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=28
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 6
                        i32.store
                        local.get 6
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=28
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 6
                      i32.store
                      local.get 6
                      i32.eqz
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=25
                    local.set 6
                  end
                  br 2 (;@5;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=315
                i32.store8 offset=187
                local.get 4
                local.get 4
                i32.load16_u offset=313 align=1
                i32.store16 offset=185 align=1
                local.get 4
                local.get 4
                i32.load offset=324
                i32.store offset=196
                local.get 4
                local.get 4
                i64.load offset=316 align=4
                i64.store offset=188 align=4
                local.get 4
                local.get 3
                i32.store8 offset=184
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 184
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              i64.load32_u offset=32
              local.set 7
            end
            local.get 4
            local.get 7
            i64.store offset=192
            local.get 4
            local.get 3
            i32.store offset=188
            local.get 4
            local.get 6
            i32.store8 offset=185
            local.get 4
            local.get 5
            i32.store8 offset=184
            local.get 4
            i64.const 0
            i64.store offset=320
            local.get 4
            i32.const 2
            i32.store8 offset=312
            local.get 4
            i32.const 152
            i32.add
            local.get 4
            i32.const 184
            i32.add
            local.get 4
            i32.const 312
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              local.get 4
              i32.load8_u offset=152
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=168
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=160
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 296
              i32.add
              call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=176
            i64.store offset=336
            local.get 4
            local.get 4
            i64.load offset=168
            i64.store offset=328
            local.get 4
            local.get 4
            i64.load offset=160
            i64.store offset=320
            local.get 4
            local.get 4
            i64.load offset=152
            i64.store offset=312
            local.get 4
            i32.const 184
            i32.add
            local.get 4
            i32.const 312
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=184
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=192
                i64.store offset=80
                local.get 4
                local.get 4
                i64.load offset=184
                i64.store offset=72
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=72
            end
            local.get 4
            i32.const 312
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 328
            i32.add
            call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 312
            i32.add
            local.get 4
            i32.const 72
            i32.add
            call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
            local.get 4
            f64.load offset=328
            local.set 9
            local.get 4
            i32.load offset=324
            local.set 3
            local.get 4
            i32.load offset=320
            local.set 5
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load offset=312
                    br_if 0 (;@8;)
                    block ;; label = @9
                      local.get 5
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 9
                      f64.store offset=316 align=4
                      local.get 4
                      local.get 3
                      i32.store offset=312
                      local.get 4
                      i32.const 312
                      i32.add
                      call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                      local.set 9
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 5
                      i32.store
                      local.get 5
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 312
                      i32.add
                      call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    end
                    local.get 4
                    local.get 9
                    f64.store offset=96
                    local.get 4
                    i32.const 2
                    i32.store offset=88
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 296
                    i32.add
                    local.get 4
                    i32.const 88
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=184
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=200
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=192
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=336
                    local.get 4
                    local.get 4
                    i64.load offset=200
                    i64.store offset=328
                    local.get 4
                    local.get 4
                    i64.load offset=192
                    i64.store offset=320
                    local.get 4
                    local.get 4
                    i64.load offset=184
                    i64.store offset=312
                    local.get 4
                    i32.const 296
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=296
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=304
                        i64.store offset=64
                        local.get 4
                        local.get 4
                        i64.load offset=296
                        i64.store offset=56
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=56
                    end
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 328
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 1
                    i32.load offset=16
                    i32.eqz
                    br_if 1 (;@7;)
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 1
                                    i32.load offset=12
                                    local.tee 1
                                    i32.load8_u offset=8
                                    local.tee 5
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 1
                                  i64.load offset=16
                                  local.set 7
                                  br 10 (;@5;)
                                end
                                local.get 1
                                i32.load offset=12
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 6
                                i32.store
                                local.get 6
                                i32.eqz
                                br_if 13 (;@1;)
                                br 8 (;@6;)
                              end
                              local.get 1
                              i32.load offset=12
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 6
                              i32.store
                              local.get 6
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 1
                              i64.load8_u offset=20
                              i64.const 32
                              i64.shl
                              local.get 1
                              i64.load32_u offset=16
                              i64.or
                              local.set 7
                              br 8 (;@5;)
                            end
                            local.get 1
                            i32.load offset=12
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 6
                            i32.store
                            local.get 6
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 1
                          i32.load offset=12
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 6
                          i32.store
                          local.get 6
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 1
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 1
                        i32.store
                        local.get 1
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 1
                      i32.load8_u offset=9
                      local.set 1
                    end
                    br 3 (;@5;)
                  end
                  local.get 0
                  local.get 9
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
                  i32.const 296
                  i32.add
                  call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  br 3 (;@4;)
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
            i64.store offset=112
            local.get 4
            local.get 3
            i32.store offset=108
            local.get 4
            local.get 1
            i32.store8 offset=105
            local.get 4
            local.get 5
            i32.store8 offset=104
            local.get 4
            i32.const 0
            i32.store16 offset=292
            local.get 4
            i32.const 1057436
            i32.store offset=288
            local.get 4
            i32.const 1057431
            i32.store offset=284
            local.get 4
            i32.const 312
            i32.add
            local.get 4
            i32.const 284
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=312
                    local.tee 1
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=316 align=4
                    i64.store offset=300 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=296
                    local.get 4
                    i32.const 216
                    i32.add
                    local.get 4
                    i32.const 104
                    i32.add
                    local.get 4
                    i32.const 296
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=216
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 216
                      i32.add
                      i32.const 8
                      i32.add
                      local.set 1
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=240
                    i64.store offset=336
                    local.get 4
                    local.get 4
                    i64.load offset=232
                    i64.store offset=328
                    local.get 4
                    local.get 4
                    i64.load offset=224
                    i64.store offset=320
                    local.get 4
                    local.get 4
                    i64.load offset=216
                    i64.store offset=312
                    local.get 4
                    i32.const 296
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=296
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=304
                        i64.store offset=112
                        local.get 4
                        local.get 4
                        i64.load offset=296
                        i64.store offset=104
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=104
                    end
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 328
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 0
                    i32.store16 offset=292
                    local.get 4
                    i32.const 1058676
                    i32.store offset=288
                    local.get 4
                    i32.const 1058670
                    i32.store offset=284
                    local.get 4
                    i32.const 312
                    i32.add
                    local.get 4
                    i32.const 284
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 4
                    i32.load8_u offset=312
                    local.tee 1
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 4
                    local.get 4
                    i64.load offset=316 align=4
                    i64.store offset=300 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=296
                    local.get 4
                    i32.const 248
                    i32.add
                    local.get 4
                    i32.const 104
                    i32.add
                    local.get 4
                    i32.const 296
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=248
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 248
                      i32.add
                      i32.const 8
                      i32.add
                      local.set 1
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=272
                    i64.store offset=336
                    local.get 4
                    local.get 4
                    i64.load offset=264
                    i64.store offset=328
                    local.get 4
                    local.get 4
                    i64.load offset=256
                    i64.store offset=320
                    local.get 4
                    local.get 4
                    i64.load offset=248
                    i64.store offset=312
                    local.get 4
                    i32.const 296
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    i32.const 1
                    local.set 1
                    i32.const 0
                    local.set 3
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=296
                      local.tee 5
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=298 align=2
                      i64.store offset=40
                      local.get 4
                      local.get 4
                      i64.load offset=304 align=2
                      i64.store offset=46 align=2
                      local.get 4
                      i32.load8_u offset=297
                      local.set 1
                      local.get 5
                      local.set 3
                    end
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 328
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    local.get 4
                    i64.load offset=64
                    i64.store offset=328
                    local.get 4
                    local.get 4
                    i64.load offset=56
                    i64.store offset=320
                    local.get 4
                    i32.const 0
                    i32.store8 offset=56
                    local.get 4
                    local.get 1
                    i32.store8 offset=337
                    local.get 4
                    local.get 3
                    i32.store8 offset=336
                    local.get 4
                    i64.const 8589934592
                    i64.store offset=312
                    local.get 4
                    local.get 4
                    i64.load offset=40
                    i64.store offset=338 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=46 align=2
                    i64.store offset=344 align=2
                    local.get 4
                    local.get 4
                    i32.const 56
                    i32.add
                    i32.store offset=352
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=12
                    local.tee 3
                    i32.store offset=300
                    local.get 4
                    local.get 4
                    i32.load offset=8
                    local.tee 1
                    i32.store offset=296
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=56
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 1
                      local.get 1
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 2
                      i32.store
                      local.get 2
                      br_if 3 (;@6;)
                      local.get 4
                      i32.const 296
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 3 (;@6;)
                    end
                    local.get 1
                    i32.eqz
                    br_if 2 (;@6;)
                    local.get 0
                    local.get 3
                    i32.store offset=16
                    local.get 0
                    local.get 1
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
                    call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=315
                  i32.store8 offset=299
                  local.get 4
                  local.get 4
                  i32.load16_u offset=313 align=1
                  i32.store16 offset=297 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=324
                  i32.store offset=308
                  local.get 4
                  local.get 4
                  i64.load offset=316 align=4
                  i64.store offset=300 align=4
                  local.get 4
                  local.get 1
                  i32.store8 offset=296
                  i32.const 1055372
                  i32.const 43
                  local.get 4
                  i32.const 296
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=315
                i32.store8 offset=299
                local.get 4
                local.get 4
                i32.load16_u offset=313 align=1
                i32.store16 offset=297 align=1
                local.get 4
                local.get 4
                i32.load offset=324
                i32.store offset=308
                local.get 4
                local.get 4
                i64.load offset=316 align=4
                i64.store offset=300 align=4
                local.get 4
                local.get 1
                i32.store8 offset=296
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 296
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1053928
              i32.const 43
              local.get 4
              i32.const 367
              i32.add
              i32.const 1053912
              i32.const 1053972
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 0
            i64.const 1
            i64.store
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load
            i64.store offset=8
            local.get 4
            i32.const 56
            i32.add
            call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
          end
          local.get 4
          i32.const 24
          i32.add
          call $"#func328 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
      i32.const 368
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
