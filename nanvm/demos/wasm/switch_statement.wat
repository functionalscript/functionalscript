  (func $nanvm_demos::samples::switch_statement::module::<nanvm_lib::naive::Naive> (;192;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 144
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=32
    local.get 2
    i32.const 1055352
    i32.store offset=28
    local.get 2
    i32.const 1055347
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
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=40
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
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
                    i32.const 1055358
                    i32.store offset=28
                    local.get 2
                    i32.const 1055352
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
                    br_if 1 (;@7;)
                    local.get 2
                    i32.load offset=48
                    local.set 5
                    local.get 2
                    i32.load offset=44
                    local.set 6
                    local.get 2
                    i32.const 0
                    i32.store16 offset=32
                    local.get 2
                    i32.const 1055364
                    i32.store offset=28
                    local.get 2
                    i32.const 1055358
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
                    local.tee 7
                    i32.const 255
                    i32.ne
                    br_if 2 (;@6;)
                    local.get 2
                    i64.load offset=44 align=4
                    local.set 8
                    local.get 2
                    i32.const 0
                    i32.store8 offset=24
                    local.get 2
                    local.get 8
                    i64.store offset=84 align=4
                    local.get 2
                    i32.const 3
                    i32.store8 offset=80
                    local.get 2
                    local.get 5
                    i32.store offset=72
                    local.get 2
                    local.get 6
                    i32.store offset=68
                    local.get 2
                    i32.const 3
                    i32.store8 offset=64
                    local.get 2
                    local.get 3
                    i32.store offset=56
                    local.get 2
                    local.get 4
                    i32.store offset=52
                    local.get 2
                    i32.const 3
                    i32.store8 offset=48
                    local.get 2
                    i64.const 12884901888
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
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
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
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=24
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 8 (;@1;)
                      local.get 2
                      i32.const 120
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 8 (;@1;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 2
                    local.get 4
                    i32.store offset=32
                    local.get 2
                    local.get 3
                    i32.store offset=28
                    local.get 2
                    i32.const 6
                    i32.store8 offset=24
                    local.get 2
                    i32.const 0
                    i32.store16 offset=116
                    local.get 2
                    i32.const 1054903
                    i32.store offset=112
                    local.get 2
                    i32.const 1054896
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
                    br_if 3 (;@5;)
                    local.get 2
                    i32.load offset=48
                    local.set 6
                    local.get 2
                    i32.load offset=44
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
                    br_if 4 (;@4;)
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
                    i32.const 6
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
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=108
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 7 (;@2;)
                      local.get 2
                      i32.const 120
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 6 (;@2;)
                    i32.const 11
                    i32.const 0
                    local.get 3
                    local.get 4
                    i32.const 1055364
                    i32.const 157
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
                    local.get 6
                    i32.store offset=52
                    local.get 2
                    local.get 7
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
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=108
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 6 (;@3;)
                      local.get 2
                      i32.const 120
                      i32.add
                      call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                      br 6 (;@3;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 5 (;@3;)
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
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 1
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
                  i32.const 1063112
                  i32.const 43
                  local.get 2
                  i32.const 120
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
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
                i32.const 1063112
                i32.const 43
                local.get 2
                i32.const 120
                i32.add
                i32.const 1063096
                i32.const 1063156
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
              local.get 7
              i32.store8 offset=120
              i32.const 1063112
              i32.const 43
              local.get 2
              i32.const 120
              i32.add
              i32.const 1063096
              i32.const 1063156
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
            i32.const 1063112
            i32.const 43
            local.get 2
            i32.const 120
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
          end
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 2
        i32.const 143
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 143
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 143
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::switch_statement::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;193;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 f64)
    global.get $__stack_pointer
    i32.const 320
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
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
      i32.store offset=40
      local.get 4
      local.get 2
      i32.store offset=36
      local.get 4
      i32.const 6
      i32.store8 offset=32
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
                            local.tee 1
                            i32.load8_u offset=8
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 1
                          i64.load offset=16
                          local.set 6
                          br 9 (;@2;)
                        end
                        local.get 1
                        i32.load offset=12
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 1
                      i32.load offset=12
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 1
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 1
                      i64.load32_u offset=16
                      i64.or
                      local.set 6
                      br 7 (;@2;)
                    end
                    local.get 1
                    i32.load offset=12
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 1
                  i32.load offset=12
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  br_if 4 (;@3;)
                  br 6 (;@1;)
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
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 1
              i32.load8_u offset=9
              local.set 1
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 1
        i64.load32_u offset=16
        local.set 6
      end
      local.get 4
      local.get 6
      i64.store offset=120
      local.get 4
      local.get 3
      i32.store offset=116
      local.get 4
      local.get 1
      i32.store8 offset=113
      local.get 4
      local.get 5
      i32.store8 offset=112
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=32
                          local.tee 1
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 4
                        i64.load offset=40
                        local.set 6
                        br 8 (;@2;)
                      end
                      local.get 4
                      i32.load offset=36
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 5
                      i32.store
                      local.get 5
                      i32.eqz
                      br_if 8 (;@1;)
                      br 6 (;@3;)
                    end
                    local.get 4
                    i32.load offset=36
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 5
                    i32.store
                    local.get 5
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    i64.load8_u offset=44
                    i64.const 32
                    i64.shl
                    local.get 4
                    i64.load32_u offset=40
                    i64.or
                    local.set 6
                    br 6 (;@2;)
                  end
                  local.get 4
                  i32.load offset=36
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 5
                  i32.store
                  local.get 5
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 4
                i32.load offset=36
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
                br 3 (;@3;)
              end
              local.get 4
              i32.load offset=36
              local.tee 3
              local.get 3
              i32.load
              i32.const 1
              i32.add
              local.tee 5
              i32.store
              local.get 5
              i32.eqz
              br_if 4 (;@1;)
              br 1 (;@4;)
            end
            local.get 4
            i32.load8_u offset=33
            local.set 5
          end
          br 1 (;@2;)
        end
        local.get 4
        i64.load32_u offset=40
        local.set 6
      end
      local.get 4
      local.get 6
      i64.store offset=264
      local.get 4
      local.get 3
      i32.store offset=260
      local.get 4
      local.get 5
      i32.store8 offset=257
      local.get 4
      local.get 1
      i32.store8 offset=256
      local.get 4
      i64.const 0
      i64.store offset=296
      local.get 4
      i32.const 2
      i32.store8 offset=288
      local.get 4
      i32.const 176
      i32.add
      local.get 4
      i32.const 256
      i32.add
      local.get 4
      i32.const 288
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=176
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=192
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=184
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 112
                i32.add
                call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=200
              i64.store offset=312
              local.get 4
              local.get 4
              i64.load offset=192
              i64.store offset=304
              local.get 4
              local.get 4
              i64.load offset=184
              i64.store offset=296
              local.get 4
              local.get 4
              i64.load offset=176
              i64.store offset=288
              local.get 4
              i32.const 256
              i32.add
              local.get 4
              i32.const 288
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=256
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=264
                  i64.store offset=72
                  local.get 4
                  local.get 4
                  i64.load offset=256
                  i64.store offset=64
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=64
              end
              local.get 4
              i32.const 288
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 304
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 288
              i32.add
              local.get 4
              i32.const 64
              i32.add
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
              local.get 4
              f64.load offset=304
              local.set 8
              local.get 4
              i32.load offset=300
              local.set 3
              local.get 4
              i32.load offset=296
              local.set 1
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load offset=288
                    br_if 0 (;@8;)
                    block ;; label = @9
                      local.get 1
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 8
                      f64.store offset=292 align=4
                      local.get 4
                      local.get 3
                      i32.store offset=288
                      local.get 4
                      i32.const 288
                      i32.add
                      call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                      local.set 8
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 1
                      i32.store
                      local.get 1
                      br_if 0 (;@9;)
                      local.get 4
                      i32.const 288
                      i32.add
                      call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    end
                    local.get 4
                    local.get 8
                    f64.store offset=88
                    local.get 4
                    i32.const 2
                    i32.store offset=80
                    local.get 4
                    i32.const 208
                    i32.add
                    local.get 4
                    i32.const 112
                    i32.add
                    local.get 4
                    i32.const 80
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=208
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=224
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=216
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 4 (;@5;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=232
                    i64.store offset=312
                    local.get 4
                    local.get 4
                    i64.load offset=224
                    i64.store offset=304
                    local.get 4
                    local.get 4
                    i64.load offset=216
                    i64.store offset=296
                    local.get 4
                    local.get 4
                    i64.load offset=208
                    i64.store offset=288
                    local.get 4
                    i32.const 256
                    i32.add
                    local.get 4
                    i32.const 288
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=256
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=264
                        i64.store offset=56
                        local.get 4
                        local.get 4
                        i64.load offset=256
                        i64.store offset=48
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=48
                    end
                    local.get 4
                    i32.const 288
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 304
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=48
                                    local.tee 1
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=56
                                  local.set 6
                                  br 9 (;@6;)
                                end
                                local.get 4
                                i32.load offset=52
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 7 (;@7;)
                              end
                              local.get 4
                              i32.load offset=52
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 4
                              i64.load8_u offset=60
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=56
                              i64.or
                              local.set 6
                              br 7 (;@6;)
                            end
                            local.get 4
                            i32.load offset=52
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 11 (;@1;)
                            br 5 (;@7;)
                          end
                          local.get 4
                          i32.load offset=52
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          i32.eqz
                          br_if 10 (;@1;)
                          br 4 (;@7;)
                        end
                        local.get 4
                        i32.load offset=52
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=49
                      local.set 5
                    end
                    br 2 (;@6;)
                  end
                  local.get 0
                  local.get 8
                  f64.store offset=16
                  local.get 0
                  local.get 3
                  i32.store offset=12
                  local.get 0
                  local.get 1
                  i32.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 2 (;@5;)
                end
                local.get 4
                i64.load32_u offset=56
                local.set 6
              end
              local.get 4
              local.get 6
              i64.store offset=120
              local.get 4
              local.get 3
              i32.store offset=116
              local.get 4
              local.get 5
              i32.store8 offset=113
              local.get 4
              local.get 1
              i32.store8 offset=112
              local.get 4
              i32.const 0
              i32.store16 offset=248
              local.get 4
              i32.const 1055352
              i32.store offset=244
              local.get 4
              i32.const 1055347
              i32.store offset=240
              local.get 4
              i32.const 288
              i32.add
              local.get 4
              i32.const 240
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=288
                              local.tee 3
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 4
                              local.get 4
                              i64.load offset=292 align=4
                              i64.store offset=260 align=4
                              local.get 4
                              i32.const 3
                              i32.store8 offset=256
                              local.get 4
                              i32.const 112
                              i32.add
                              local.get 4
                              i32.const 256
                              i32.add
                              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
                              local.set 3
                              local.get 4
                              i32.const 256
                              i32.add
                              call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              i32.const 112
                              i32.add
                              call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              local.get 4
                              local.get 3
                              i32.store8 offset=97
                              local.get 4
                              i32.const 1
                              i32.store8 offset=96
                              local.get 4
                              local.get 3
                              i32.store8 offset=289
                              local.get 4
                              i32.const 1
                              i32.store8 offset=288
                              block ;; label = @14
                                local.get 4
                                i32.const 288
                                i32.add
                                call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                                br_if 0 (;@14;)
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                local.get 4
                                                i32.load8_u offset=48
                                                local.tee 1
                                                br_table 6 (;@16;) 6 (;@16;) 0 (;@22;) 1 (;@21;) 2 (;@20;) 3 (;@19;) 4 (;@18;) 5 (;@17;) 6 (;@16;)
                                              end
                                              local.get 4
                                              i64.load offset=56
                                              local.set 6
                                              br 10 (;@11;)
                                            end
                                            local.get 4
                                            i32.load offset=52
                                            local.tee 3
                                            local.get 3
                                            i32.load
                                            i32.const 1
                                            i32.add
                                            local.tee 5
                                            i32.store
                                            local.get 5
                                            i32.eqz
                                            br_if 19 (;@1;)
                                            br 8 (;@12;)
                                          end
                                          local.get 4
                                          i32.load offset=52
                                          local.tee 3
                                          local.get 3
                                          i32.load
                                          i32.const 1
                                          i32.add
                                          local.tee 5
                                          i32.store
                                          local.get 5
                                          i32.eqz
                                          br_if 18 (;@1;)
                                          local.get 4
                                          i64.load8_u offset=60
                                          i64.const 32
                                          i64.shl
                                          local.get 4
                                          i64.load32_u offset=56
                                          i64.or
                                          local.set 6
                                          br 8 (;@11;)
                                        end
                                        local.get 4
                                        i32.load offset=52
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 5
                                        i32.store
                                        local.get 5
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 6 (;@12;)
                                      end
                                      local.get 4
                                      i32.load offset=52
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 5
                                      i32.store
                                      local.get 5
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 5 (;@12;)
                                    end
                                    local.get 4
                                    i32.load offset=52
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 1 (;@15;)
                                  end
                                  local.get 4
                                  i32.load8_u offset=49
                                  local.set 5
                                end
                                br 3 (;@11;)
                              end
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              local.get 4
                                              i32.load8_u offset=96
                                              br_table 0 (;@21;) 1 (;@20;) 7 (;@14;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;) 0 (;@21;)
                                            end
                                            i32.const 0
                                            local.set 5
                                            local.get 4
                                            i32.load8_u offset=97
                                            local.set 1
                                            br 10 (;@10;)
                                          end
                                          i32.const 1
                                          local.set 5
                                          local.get 4
                                          i32.load8_u offset=97
                                          local.set 1
                                          br 9 (;@10;)
                                        end
                                        local.get 4
                                        i32.load offset=100
                                        local.tee 3
                                        local.get 3
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 1
                                        i32.store
                                        local.get 1
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        local.get 4
                                        i64.load32_u offset=104
                                        local.set 6
                                        i32.const 3
                                        local.set 5
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=100
                                      local.tee 3
                                      local.get 3
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 1
                                      i32.store
                                      local.get 1
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      i64.load8_u offset=108
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=104
                                      i64.or
                                      local.set 6
                                      i32.const 4
                                      local.set 5
                                      br 7 (;@10;)
                                    end
                                    local.get 4
                                    i32.load offset=100
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 1
                                    i32.store
                                    local.get 1
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    local.get 4
                                    i64.load32_u offset=104
                                    local.set 6
                                    i32.const 5
                                    local.set 5
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=100
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 1
                                  i32.store
                                  local.get 1
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i64.load32_u offset=104
                                  local.set 6
                                  i32.const 6
                                  local.set 5
                                  br 5 (;@10;)
                                end
                                local.get 4
                                i32.load offset=100
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 1
                                i32.store
                                local.get 1
                                i32.eqz
                                br_if 13 (;@1;)
                                i32.const 7
                                local.set 5
                                br 4 (;@10;)
                              end
                              i32.const 2
                              local.set 5
                              local.get 4
                              i64.load offset=104
                              local.set 6
                              br 3 (;@10;)
                            end
                            local.get 4
                            local.get 4
                            i32.load8_u offset=291
                            i32.store8 offset=259
                            local.get 4
                            local.get 4
                            i32.load16_u offset=289 align=1
                            i32.store16 offset=257 align=1
                            local.get 4
                            local.get 4
                            i32.load offset=300
                            i32.store offset=268
                            local.get 4
                            local.get 4
                            i64.load offset=292 align=4
                            i64.store offset=260 align=4
                            local.get 4
                            local.get 3
                            i32.store8 offset=256
                            i32.const 1063112
                            i32.const 43
                            local.get 4
                            i32.const 256
                            i32.add
                            i32.const 1063096
                            i32.const 1063156
                            call $core::result::unwrap_failed
                            unreachable
                          end
                          local.get 4
                          i64.load32_u offset=56
                          local.set 6
                        end
                        local.get 4
                        local.get 6
                        i64.store offset=120
                        local.get 4
                        local.get 3
                        i32.store offset=116
                        local.get 4
                        local.get 5
                        i32.store8 offset=113
                        local.get 4
                        local.get 1
                        i32.store8 offset=112
                        local.get 4
                        i32.const 0
                        i32.store16 offset=248
                        local.get 4
                        i32.const 1055358
                        i32.store offset=244
                        local.get 4
                        i32.const 1055352
                        i32.store offset=240
                        local.get 4
                        i32.const 288
                        i32.add
                        local.get 4
                        i32.const 240
                        i32.add
                        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                        local.get 4
                        i32.load8_u offset=288
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 1 (;@9;)
                        local.get 4
                        local.get 4
                        i64.load offset=292 align=4
                        i64.store offset=260 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=256
                        local.get 4
                        i32.const 112
                        i32.add
                        local.get 4
                        i32.const 256
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
                        local.set 1
                        local.get 4
                        i32.const 256
                        i32.add
                        call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 112
                        i32.add
                        call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        i32.const 1
                        local.set 5
                      end
                      local.get 4
                      local.get 6
                      i64.store offset=296
                      local.get 4
                      local.get 3
                      i32.store offset=292
                      local.get 4
                      local.get 1
                      i32.store8 offset=289
                      local.get 4
                      local.get 5
                      i32.store8 offset=288
                      block ;; label = @10
                        local.get 4
                        i32.const 288
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                        br_if 0 (;@10;)
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=48
                                        local.tee 1
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=56
                                      local.set 6
                                      br 11 (;@6;)
                                    end
                                    local.get 4
                                    i32.load offset=52
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 9 (;@7;)
                                  end
                                  local.get 4
                                  i32.load offset=52
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i64.load8_u offset=60
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=56
                                  i64.or
                                  local.set 6
                                  br 9 (;@6;)
                                end
                                local.get 4
                                i32.load offset=52
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 7 (;@7;)
                              end
                              local.get 4
                              i32.load offset=52
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              br 6 (;@7;)
                            end
                            local.get 4
                            i32.load offset=52
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=49
                          local.set 5
                        end
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.const 0
                      i32.store16 offset=120
                      local.get 4
                      i32.const 1056446
                      i32.store offset=116
                      local.get 4
                      i32.const 1056437
                      i32.store offset=112
                      local.get 4
                      i32.const 288
                      i32.add
                      local.get 4
                      i32.const 112
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      local.get 4
                      i32.load8_u offset=288
                      local.tee 3
                      i32.const 255
                      i32.ne
                      br_if 1 (;@8;)
                      local.get 4
                      i32.load offset=296
                      local.set 1
                      local.get 4
                      i32.load offset=292
                      local.set 5
                      i64.const 0
                      local.set 6
                      i32.const 3
                      local.set 3
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 4
                    i32.load8_u offset=291
                    i32.store8 offset=259
                    local.get 4
                    local.get 4
                    i32.load16_u offset=289 align=1
                    i32.store16 offset=257 align=1
                    local.get 4
                    local.get 4
                    i32.load offset=300
                    i32.store offset=268
                    local.get 4
                    local.get 4
                    i64.load offset=292 align=4
                    i64.store offset=260 align=4
                    local.get 4
                    local.get 3
                    i32.store8 offset=256
                    i32.const 1063112
                    i32.const 43
                    local.get 4
                    i32.const 256
                    i32.add
                    i32.const 1063096
                    i32.const 1063156
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=291
                  i32.store8 offset=259
                  local.get 4
                  local.get 4
                  i32.load16_u offset=289 align=1
                  i32.store16 offset=257 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=300
                  i32.store offset=268
                  local.get 4
                  local.get 4
                  i64.load offset=292 align=4
                  i64.store offset=260 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=256
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 256
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                i64.load32_u offset=56
                local.set 6
              end
              local.get 4
              local.get 6
              i64.store offset=120
              local.get 4
              local.get 3
              i32.store offset=116
              local.get 4
              local.get 5
              i32.store8 offset=113
              local.get 4
              local.get 1
              i32.store8 offset=112
              local.get 4
              i32.const 0
              i32.store16 offset=248
              local.get 4
              i32.const 1055364
              i32.store offset=244
              local.get 4
              i32.const 1055358
              i32.store offset=240
              local.get 4
              i32.const 288
              i32.add
              local.get 4
              i32.const 240
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              block ;; label = @6
                local.get 4
                i32.load8_u offset=288
                local.tee 3
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i32.load8_u offset=291
                i32.store8 offset=259
                local.get 4
                local.get 4
                i32.load16_u offset=289 align=1
                i32.store16 offset=257 align=1
                local.get 4
                local.get 4
                i32.load offset=300
                i32.store offset=268
                local.get 4
                local.get 4
                i64.load offset=292 align=4
                i64.store offset=260 align=4
                local.get 4
                local.get 3
                i32.store8 offset=256
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 256
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              local.get 4
              i64.load offset=292 align=4
              i64.store offset=260 align=4
              i32.const 3
              local.set 3
              local.get 4
              i32.const 3
              i32.store8 offset=256
              local.get 4
              i32.const 112
              i32.add
              local.get 4
              i32.const 256
              i32.add
              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
              local.set 1
              local.get 4
              i32.const 256
              i32.add
              call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 112
              i32.add
              call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              local.get 1
              i32.store8 offset=241
              local.get 4
              i32.const 1
              i32.store8 offset=240
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.const 240
                  i32.add
                  call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                  br_if 0 (;@7;)
                  local.get 4
                  i32.const 16
                  i32.add
                  i32.const 1056426
                  i32.const 7
                  call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                  local.get 4
                  i32.const 3
                  i32.store8 offset=144
                  local.get 4
                  local.get 4
                  i64.load offset=16
                  i64.store offset=148 align=4
                  local.get 4
                  i32.const 160
                  i32.add
                  local.get 4
                  i32.const 32
                  i32.add
                  call $"<nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                  local.get 4
                  i64.const 0
                  i64.store offset=296
                  local.get 4
                  i32.const 2
                  i32.store8 offset=288
                  local.get 4
                  i32.const 256
                  i32.add
                  local.get 4
                  i32.const 160
                  i32.add
                  local.get 4
                  i32.const 288
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  local.get 4
                  i32.load8_u offset=256
                  i32.const 255
                  i32.eq
                  br_if 1 (;@6;)
                  local.get 4
                  local.get 4
                  i64.load offset=280
                  i64.store offset=312
                  local.get 4
                  local.get 4
                  i64.load offset=272
                  i64.store offset=304
                  local.get 4
                  local.get 4
                  i64.load offset=264
                  i64.store offset=296
                  local.get 4
                  local.get 4
                  i64.load offset=256
                  i64.store offset=288
                  local.get 4
                  i32.const 128
                  i32.add
                  local.get 4
                  i32.const 288
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                  local.get 4
                  local.get 4
                  i64.load offset=144
                  i64.store offset=112
                  local.get 4
                  local.get 4
                  i64.load offset=152
                  i64.store offset=120
                  local.get 4
                  i32.const 8
                  i32.add
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 2]>"
                  local.get 4
                  i32.load offset=12
                  local.set 1
                  local.get 4
                  i32.load offset=8
                  local.set 5
                  i64.const 1
                  local.set 6
                  i32.const 6
                  local.set 3
                  br 3 (;@4;)
                end
                local.get 4
                i32.const 1056433
                i32.const 4
                call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                i64.const 0
                local.set 6
                local.get 4
                i32.load offset=4
                local.set 1
                local.get 4
                i32.load
                local.set 5
                br 2 (;@4;)
              end
              local.get 0
              local.get 4
              i64.load offset=272
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=264
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 144
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 96
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 48
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 32
            i32.add
            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            local.get 2
            i32.load
            i32.const -1
            i32.add
            local.tee 0
            i32.store
            local.get 0
            i32.eqz
            br_if 1 (;@3;)
            br 2 (;@2;)
          end
          local.get 0
          local.get 1
          i32.store offset=16
          local.get 0
          local.get 5
          i32.store offset=12
          local.get 0
          local.get 3
          i32.store8 offset=8
          local.get 0
          local.get 6
          i64.store
          local.get 4
          i32.const 96
          i32.add
          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 48
          i32.add
          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 32
          i32.add
          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
        i32.const 24
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 320
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
