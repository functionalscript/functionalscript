  (func $nanvm_demos::samples::names_and_identity::module::<nanvm_lib::naive::Naive> (;194;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store8 offset=88
    local.get 2
    i32.const 32
    i32.add
    local.get 2
    i32.const 88
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=36
    local.tee 3
    i32.store offset=108
    local.get 2
    local.get 2
    i32.load offset=32
    local.tee 4
    i32.store offset=104
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=88
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 4
        local.get 4
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
        local.get 2
        i32.const 104
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.const 12
      i32.const 0
      local.get 4
      local.get 3
      i32.const 1055521
      i32.const 5
      call $<nanvm_lib::naive::function::Function>::new
      local.tee 3
      i32.store offset=44
      local.get 2
      i32.const 7
      i32.store8 offset=40
      local.get 2
      i32.const 0
      i32.store16 offset=64
      local.get 2
      i32.const 1055530
      i32.store offset=60
      local.get 2
      i32.const 1055526
      i32.store offset=56
      local.get 2
      i32.const 104
      i32.add
      local.get 2
      i32.const 56
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 2
                    i32.load8_u offset=104
                    local.tee 4
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 2
                    i32.load offset=112
                    local.set 5
                    local.get 2
                    i32.load offset=108
                    local.set 6
                    local.get 2
                    i32.const 0
                    i32.store8 offset=88
                    local.get 2
                    i32.const 24
                    i32.add
                    local.get 2
                    i32.const 88
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 2
                    local.get 2
                    i32.load offset=28
                    local.tee 7
                    i32.store offset=108
                    local.get 2
                    local.get 2
                    i32.load offset=24
                    local.tee 4
                    i32.store offset=104
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=88
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 7 (;@2;)
                      local.get 2
                      i32.const 104
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 7 (;@2;)
                    end
                    local.get 4
                    i32.eqz
                    br_if 6 (;@2;)
                    i32.const 12
                    i32.const 0
                    local.get 4
                    local.get 7
                    i32.const 1055521
                    i32.const 5
                    call $<nanvm_lib::naive::function::Function>::new
                    local.set 4
                    local.get 2
                    i32.const 0
                    i32.store8 offset=56
                    local.get 2
                    local.get 4
                    i32.store offset=124
                    local.get 2
                    i32.const 7
                    i32.store8 offset=120
                    local.get 2
                    local.get 5
                    i32.store offset=116
                    local.get 2
                    local.get 6
                    i32.store offset=112
                    local.get 2
                    i64.const 4294967296
                    i64.store offset=104
                    local.get 2
                    local.get 2
                    i32.const 56
                    i32.add
                    i32.store offset=136
                    local.get 2
                    i32.const 16
                    i32.add
                    local.get 2
                    i32.const 104
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                    local.get 2
                    local.get 2
                    i32.load offset=20
                    local.tee 5
                    i32.store offset=92
                    local.get 2
                    local.get 2
                    i32.load offset=16
                    local.tee 4
                    i32.store offset=88
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=56
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 6 (;@3;)
                      local.get 2
                      i32.const 88
                      i32.add
                      call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                      br 6 (;@3;)
                    end
                    local.get 4
                    i32.eqz
                    br_if 5 (;@3;)
                    local.get 2
                    local.get 5
                    i32.store offset=64
                    local.get 2
                    local.get 4
                    i32.store offset=60
                    local.get 2
                    i32.const 5
                    i32.store8 offset=56
                    local.get 2
                    i32.const 0
                    i32.store16 offset=84
                    local.get 2
                    i32.const 1054903
                    i32.store offset=80
                    local.get 2
                    i32.const 1054896
                    i32.store offset=76
                    local.get 2
                    i32.const 104
                    i32.add
                    local.get 2
                    i32.const 76
                    i32.add
                    call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                    local.get 2
                    i32.load8_u offset=104
                    local.tee 6
                    i32.const 255
                    i32.ne
                    br_if 1 (;@7;)
                    local.get 2
                    i32.load offset=112
                    local.set 7
                    local.get 2
                    i32.load offset=108
                    local.set 8
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 2 (;@6;)
                    local.get 4
                    local.get 4
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 2 (;@6;)
                    local.get 2
                    i32.const 0
                    i32.store8 offset=76
                    local.get 2
                    local.get 5
                    i64.extend_i32_u
                    i64.store offset=136
                    local.get 2
                    local.get 4
                    i32.store offset=132
                    local.get 2
                    i32.const 5
                    i32.store8 offset=128
                    local.get 2
                    i64.const 0
                    i64.store offset=120
                    local.get 2
                    local.get 3
                    i32.store offset=116
                    local.get 2
                    i32.const 7
                    i32.store8 offset=112
                    local.get 2
                    i64.const 8589934592
                    i64.store offset=104
                    local.get 2
                    local.get 2
                    i32.const 76
                    i32.add
                    i32.store offset=144
                    local.get 2
                    i32.const 8
                    i32.add
                    local.get 2
                    i32.const 104
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 2
                    local.get 2
                    i32.load offset=12
                    local.tee 3
                    i32.store offset=92
                    local.get 2
                    local.get 2
                    i32.load offset=8
                    local.tee 4
                    i32.store offset=88
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=76
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 5 (;@4;)
                      local.get 2
                      i32.const 88
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 5 (;@4;)
                    end
                    local.get 4
                    i32.eqz
                    br_if 4 (;@4;)
                    i32.const 13
                    i32.const 0
                    local.get 4
                    local.get 3
                    i32.const 1055530
                    i32.const 64
                    call $<nanvm_lib::naive::function::Function>::new
                    local.set 4
                    local.get 2
                    i32.const 0
                    i32.store8 offset=76
                    local.get 2
                    local.get 4
                    i32.store offset=124
                    local.get 2
                    i32.const 7
                    i32.store8 offset=120
                    local.get 2
                    local.get 7
                    i32.store offset=116
                    local.get 2
                    local.get 8
                    i32.store offset=112
                    local.get 2
                    i64.const 4294967296
                    i64.store offset=104
                    local.get 2
                    local.get 2
                    i32.const 76
                    i32.add
                    i32.store offset=136
                    local.get 2
                    local.get 2
                    i32.const 104
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                    local.get 2
                    local.get 2
                    i32.load offset=4
                    local.tee 3
                    i32.store offset=92
                    local.get 2
                    local.get 2
                    i32.load
                    local.tee 4
                    i32.store offset=88
                    block ;; label = @9
                      local.get 2
                      i32.load8_u offset=76
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 4 (;@5;)
                      local.get 2
                      i32.const 88
                      i32.add
                      call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                      br 4 (;@5;)
                    end
                    local.get 4
                    i32.eqz
                    br_if 3 (;@5;)
                    local.get 0
                    local.get 3
                    i32.store offset=16
                    local.get 0
                    local.get 4
                    i32.store offset=12
                    local.get 0
                    i32.const 5
                    i32.store8 offset=8
                    local.get 0
                    i64.const 0
                    i64.store
                    local.get 2
                    i32.const 56
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 2
                    i32.const 40
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 1
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 2
                    i32.const 160
                    i32.add
                    global.set $__stack_pointer
                    return
                  end
                  local.get 2
                  local.get 2
                  i32.load8_u offset=107
                  i32.store8 offset=91
                  local.get 2
                  local.get 2
                  i32.load16_u offset=105 align=1
                  i32.store16 offset=89 align=1
                  local.get 2
                  local.get 2
                  i32.load offset=116
                  i32.store offset=100
                  local.get 2
                  local.get 2
                  i64.load offset=108 align=4
                  i64.store offset=92 align=4
                  local.get 2
                  local.get 4
                  i32.store8 offset=88
                  i32.const 1063112
                  i32.const 43
                  local.get 2
                  i32.const 88
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 2
                local.get 2
                i32.load8_u offset=107
                i32.store8 offset=91
                local.get 2
                local.get 2
                i32.load16_u offset=105 align=1
                i32.store16 offset=89 align=1
                local.get 2
                local.get 2
                i32.load offset=116
                i32.store offset=100
                local.get 2
                local.get 2
                i64.load offset=108 align=4
                i64.store offset=92 align=4
                local.get 2
                local.get 6
                i32.store8 offset=88
                i32.const 1063112
                i32.const 43
                local.get 2
                i32.const 88
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
            i32.const 159
            i32.add
            i32.const 1059448
            i32.const 1059508
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1059464
          i32.const 43
          local.get 2
          i32.const 159
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 2
        i32.const 159
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 159
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 159
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::names_and_identity::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;195;) (type 3) (param i32 i32 i32 i32)
    (local i32)
    global.get $__stack_pointer
    i32.const 16
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 0
    i64.const 0
    i64.store offset=16
    local.get 0
    i32.const 2
    i32.store8 offset=8
    local.get 0
    i64.const 0
    i64.store
    local.get 2
    local.get 2
    i32.load
    i32.const -1
    i32.add
    local.tee 0
    i32.store
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    block ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 16
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::names_and_identity::module<nanvm_lib::naive::Naive>::{closure#2} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;196;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 f64)
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
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=336
      local.get 4
      local.get 3
      i32.store offset=332
      local.get 4
      local.get 5
      i32.store8 offset=329
      local.get 4
      local.get 6
      i32.store8 offset=328
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
                            local.tee 3
                            i32.load8_u offset=8
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 3
                          i64.load offset=16
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 5
                        local.get 5
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
                      local.get 3
                      i32.load offset=12
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 3
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 3
                      i64.load32_u offset=16
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 3
                    i32.load offset=12
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 3
                  i32.load offset=12
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 3
                i32.load offset=12
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 3
              i32.load8_u offset=9
              local.set 3
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 3
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=368
      local.get 4
      local.get 5
      i32.store offset=364
      local.get 4
      local.get 3
      i32.store8 offset=361
      local.get 4
      local.get 6
      i32.store8 offset=360
      local.get 4
      i32.const 328
      i32.add
      local.get 4
      i32.const 360
      i32.add
      call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
      local.set 3
      local.get 4
      i32.const 360
      i32.add
      call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
      local.get 4
      i32.const 328
      i32.add
      call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
      local.get 4
      local.get 3
      i32.store8 offset=97
      local.get 4
      i32.const 1
      i32.store8 offset=96
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
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
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
                  br_if 6 (;@1;)
                  br 4 (;@3;)
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
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=16
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=272
      local.get 4
      local.get 3
      i32.store offset=268
      local.get 4
      local.get 5
      i32.store8 offset=265
      local.get 4
      local.get 6
      i32.store8 offset=264
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            local.tee 3
            i32.const 1
            i32.le_u
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
                            i32.load8_u offset=24
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 5
                          i64.load offset=32
                          local.set 7
                          br 9 (;@2;)
                        end
                        local.get 5
                        i32.load offset=28
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
                      i32.load offset=28
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
                      i64.load8_u offset=36
                      i64.const 32
                      i64.shl
                      local.get 5
                      i64.load32_u offset=32
                      i64.or
                      local.set 7
                      br 7 (;@2;)
                    end
                    local.get 5
                    i32.load offset=28
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 5
                  i32.load offset=28
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 5
                i32.load offset=28
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
              i32.load8_u offset=25
              local.set 5
            end
            br 2 (;@2;)
          end
          i32.const 1
          local.get 3
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 5
        i64.load32_u offset=32
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=304
      local.get 4
      local.get 3
      i32.store offset=300
      local.get 4
      local.get 5
      i32.store8 offset=297
      local.get 4
      local.get 6
      i32.store8 offset=296
      local.get 4
      i32.const 0
      i32.store16 offset=240
      local.get 4
      i32.const 1055530
      i32.store offset=236
      local.get 4
      i32.const 1055526
      i32.store offset=232
      local.get 4
      i32.const 360
      i32.add
      local.get 4
      i32.const 232
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=360
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=364 align=4
                        i64.store offset=332 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=328
                        local.get 4
                        i32.const 232
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        local.get 4
                        i32.const 328
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=232
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
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
                          local.get 4
                          i32.const 264
                          i32.add
                          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          br 5 (;@6;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=256
                        i64.store offset=384
                        local.get 4
                        local.get 4
                        i64.load offset=248
                        i64.store offset=376
                        local.get 4
                        local.get 4
                        i64.load offset=240
                        i64.store offset=368
                        local.get 4
                        local.get 4
                        i64.load offset=232
                        i64.store offset=360
                        local.get 4
                        i32.const 328
                        i32.add
                        local.get 4
                        i32.const 360
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=328
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=336
                            i64.store offset=136
                            local.get 4
                            local.get 4
                            i64.load offset=328
                            i64.store offset=128
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=128
                        end
                        local.get 4
                        i32.const 360
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 376
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 128
                        i32.add
                        call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
                        local.set 3
                        local.get 4
                        i32.const 128
                        i32.add
                        call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 264
                        i32.add
                        call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        local.get 3
                        i32.store8 offset=113
                        local.get 4
                        i32.const 1
                        i32.store8 offset=112
                        local.get 1
                        i32.load offset=16
                        i32.eqz
                        br_if 1 (;@9;)
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
                                        local.tee 6
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 3
                                      i64.load offset=16
                                      local.set 7
                                      br 10 (;@7;)
                                    end
                                    local.get 3
                                    i32.load offset=12
                                    local.tee 5
                                    local.get 5
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 8
                                    i32.store
                                    local.get 8
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 8 (;@8;)
                                  end
                                  local.get 3
                                  i32.load offset=12
                                  local.tee 5
                                  local.get 5
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
                                  br 8 (;@7;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 5
                                local.get 5
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 8
                                i32.store
                                local.get 8
                                i32.eqz
                                br_if 13 (;@1;)
                                br 6 (;@8;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 5
                              local.get 5
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 8
                              i32.store
                              local.get 8
                              i32.eqz
                              br_if 12 (;@1;)
                              br 5 (;@8;)
                            end
                            local.get 3
                            i32.load offset=12
                            local.tee 5
                            local.get 5
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
                        br 3 (;@7;)
                      end
                      local.get 4
                      local.get 4
                      i32.load8_u offset=363
                      i32.store8 offset=331
                      local.get 4
                      local.get 4
                      i32.load16_u offset=361 align=1
                      i32.store16 offset=329 align=1
                      local.get 4
                      local.get 4
                      i32.load offset=372
                      i32.store offset=340
                      local.get 4
                      local.get 4
                      i64.load offset=364 align=4
                      i64.store offset=332 align=4
                      local.get 4
                      local.get 3
                      i32.store8 offset=328
                      i32.const 1063112
                      i32.const 43
                      local.get 4
                      i32.const 328
                      i32.add
                      i32.const 1063096
                      i32.const 1063156
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    i32.const 0
                    i32.const 0
                    i32.const 1065308
                    call $core::panicking::panic_bounds_check
                    unreachable
                  end
                  local.get 3
                  i64.load32_u offset=16
                  local.set 7
                end
                local.get 4
                local.get 7
                i64.store offset=224
                local.get 4
                local.get 5
                i32.store offset=220
                local.get 4
                local.get 3
                i32.store8 offset=217
                local.get 4
                local.get 6
                i32.store8 offset=216
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 1
                      i32.load offset=16
                      local.tee 3
                      i32.const 1
                      i32.le_u
                      br_if 0 (;@9;)
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 1
                                      i32.load offset=12
                                      local.tee 3
                                      i32.load8_u offset=24
                                      local.tee 6
                                      br_table 6 (;@11;) 6 (;@11;) 0 (;@17;) 1 (;@16;) 2 (;@15;) 3 (;@14;) 4 (;@13;) 5 (;@12;) 6 (;@11;)
                                    end
                                    local.get 3
                                    i64.load offset=32
                                    local.set 7
                                    br 9 (;@7;)
                                  end
                                  local.get 3
                                  i32.load offset=28
                                  local.tee 5
                                  local.get 5
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 8
                                  i32.store
                                  local.get 8
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 7 (;@8;)
                                end
                                local.get 3
                                i32.load offset=28
                                local.tee 5
                                local.get 5
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 8
                                i32.store
                                local.get 8
                                i32.eqz
                                br_if 13 (;@1;)
                                local.get 3
                                i64.load8_u offset=36
                                i64.const 32
                                i64.shl
                                local.get 3
                                i64.load32_u offset=32
                                i64.or
                                local.set 7
                                br 7 (;@7;)
                              end
                              local.get 3
                              i32.load offset=28
                              local.tee 5
                              local.get 5
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 8
                              i32.store
                              local.get 8
                              i32.eqz
                              br_if 12 (;@1;)
                              br 5 (;@8;)
                            end
                            local.get 3
                            i32.load offset=28
                            local.tee 5
                            local.get 5
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 8
                            i32.store
                            local.get 8
                            i32.eqz
                            br_if 11 (;@1;)
                            br 4 (;@8;)
                          end
                          local.get 3
                          i32.load offset=28
                          local.tee 5
                          local.get 5
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 3
                          i32.store
                          local.get 3
                          i32.eqz
                          br_if 10 (;@1;)
                          br 1 (;@10;)
                        end
                        local.get 3
                        i32.load8_u offset=25
                        local.set 3
                      end
                      br 2 (;@7;)
                    end
                    i32.const 1
                    local.get 3
                    i32.const 1065308
                    call $core::panicking::panic_bounds_check
                    unreachable
                  end
                  local.get 3
                  i64.load32_u offset=32
                  local.set 7
                end
                local.get 4
                local.get 7
                i64.store offset=304
                local.get 4
                local.get 5
                i32.store offset=300
                local.get 4
                local.get 3
                i32.store8 offset=297
                local.get 4
                local.get 6
                i32.store8 offset=296
                local.get 4
                i32.const 0
                i32.store16 offset=272
                local.get 4
                i32.const 1055530
                i32.store offset=268
                local.get 4
                i32.const 1055526
                i32.store offset=264
                local.get 4
                i32.const 360
                i32.add
                local.get 4
                i32.const 264
                i32.add
                call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=360
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=364 align=4
                        i64.store offset=332 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=328
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        local.get 4
                        i32.const 328
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=264
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
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
                          i32.const 216
                          i32.add
                          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          br 4 (;@7;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=288
                        i64.store offset=384
                        local.get 4
                        local.get 4
                        i64.load offset=280
                        i64.store offset=376
                        local.get 4
                        local.get 4
                        i64.load offset=272
                        i64.store offset=368
                        local.get 4
                        local.get 4
                        i64.load offset=264
                        i64.store offset=360
                        local.get 4
                        i32.const 328
                        i32.add
                        local.get 4
                        i32.const 360
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        i32.const 0
                        local.set 3
                        i32.const 1
                        local.set 5
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=328
                          local.tee 6
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=330 align=2
                          i64.store offset=200
                          local.get 4
                          local.get 4
                          i64.load offset=336 align=2
                          i64.store offset=206 align=2
                          local.get 4
                          i32.load8_u offset=329
                          local.set 5
                          local.get 6
                          local.set 3
                        end
                        local.get 4
                        i32.const 360
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 376
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        local.get 4
                        i64.load offset=224
                        i64.store offset=376
                        local.get 4
                        local.get 4
                        i64.load offset=216
                        i64.store offset=368
                        local.get 4
                        i32.const 0
                        i32.store8 offset=296
                        local.get 4
                        local.get 5
                        i32.store8 offset=385
                        local.get 4
                        local.get 3
                        i32.store8 offset=384
                        local.get 4
                        i64.const 8589934592
                        i64.store offset=360
                        local.get 4
                        local.get 4
                        i64.load offset=200
                        i64.store offset=386 align=2
                        local.get 4
                        local.get 4
                        i64.load offset=206 align=2
                        i64.store offset=392 align=2
                        local.get 4
                        local.get 4
                        i32.const 296
                        i32.add
                        i32.store offset=400
                        local.get 4
                        i32.const 16
                        i32.add
                        local.get 4
                        i32.const 360
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=20
                        local.tee 5
                        i32.store offset=332
                        local.get 4
                        local.get 4
                        i32.load offset=16
                        local.tee 3
                        i32.store offset=328
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=296
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 1
                          i32.store
                          local.get 1
                          br_if 9 (;@2;)
                          local.get 4
                          i32.const 328
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 8 (;@2;)
                        local.get 4
                        local.get 5
                        i32.store offset=176
                        local.get 4
                        local.get 3
                        i32.store offset=172
                        local.get 4
                        i32.const 6
                        i32.store8 offset=168
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=32
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=40
                                      local.set 7
                                      br 9 (;@8;)
                                    end
                                    local.get 4
                                    i32.load offset=36
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 6
                                    i32.store
                                    local.get 6
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
                                  end
                                  local.get 4
                                  i32.load offset=36
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 6
                                  i32.store
                                  local.get 6
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i64.load8_u offset=44
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=40
                                  i64.or
                                  local.set 7
                                  br 7 (;@8;)
                                end
                                local.get 4
                                i32.load offset=36
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
                                br 5 (;@9;)
                              end
                              local.get 4
                              i32.load offset=36
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
                              br 4 (;@9;)
                            end
                            local.get 4
                            i32.load offset=36
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
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=33
                          local.set 6
                        end
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i32.load8_u offset=363
                      i32.store8 offset=331
                      local.get 4
                      local.get 4
                      i32.load16_u offset=361 align=1
                      i32.store16 offset=329 align=1
                      local.get 4
                      local.get 4
                      i32.load offset=372
                      i32.store offset=340
                      local.get 4
                      local.get 4
                      i64.load offset=364 align=4
                      i64.store offset=332 align=4
                      local.get 4
                      local.get 3
                      i32.store8 offset=328
                      i32.const 1063112
                      i32.const 43
                      local.get 4
                      i32.const 328
                      i32.add
                      i32.const 1063096
                      i32.const 1063156
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 4
                    i64.load32_u offset=40
                    local.set 7
                  end
                  local.get 4
                  local.get 7
                  i64.store offset=336
                  local.get 4
                  local.get 3
                  i32.store offset=332
                  local.get 4
                  local.get 6
                  i32.store8 offset=329
                  local.get 4
                  local.get 5
                  i32.store8 offset=328
                  local.get 4
                  i64.const 0
                  i64.store offset=368
                  local.get 4
                  i32.const 2
                  i32.store8 offset=360
                  local.get 4
                  i32.const 296
                  i32.add
                  local.get 4
                  i32.const 328
                  i32.add
                  local.get 4
                  i32.const 360
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=296
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 0
                    local.get 4
                    i64.load offset=312
                    i64.store offset=16
                    local.get 0
                    local.get 4
                    i64.load offset=304
                    i64.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    local.get 4
                    i32.const 168
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=320
                  i64.store offset=384
                  local.get 4
                  local.get 4
                  i64.load offset=312
                  i64.store offset=376
                  local.get 4
                  local.get 4
                  i64.load offset=304
                  i64.store offset=368
                  local.get 4
                  local.get 4
                  i64.load offset=296
                  i64.store offset=360
                  local.get 4
                  i32.const 328
                  i32.add
                  local.get 4
                  i32.const 360
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=328
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=336
                      i64.store offset=192
                      local.get 4
                      local.get 4
                      i64.load offset=328
                      i64.store offset=184
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=184
                  end
                  local.get 4
                  i32.const 360
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 376
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 360
                  i32.add
                  local.get 4
                  i32.const 184
                  i32.add
                  call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                  local.get 4
                  f64.load offset=376
                  local.set 9
                  local.get 4
                  i32.load offset=372
                  local.set 3
                  local.get 4
                  i32.load offset=368
                  local.set 5
                  block ;; label = @8
                    local.get 4
                    i32.load offset=360
                    br_if 0 (;@8;)
                    block ;; label = @9
                      local.get 5
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 9
                      f64.store offset=364 align=4
                      local.get 4
                      local.get 3
                      i32.store offset=360
                      local.get 4
                      i32.const 360
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
                      i32.const 360
                      i32.add
                      call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                    end
                    local.get 4
                    local.get 9
                    f64.store offset=208
                    local.get 4
                    i32.const 2
                    i32.store offset=200
                    local.get 4
                    i32.const 328
                    i32.add
                    local.get 4
                    i32.const 168
                    i32.add
                    local.get 4
                    i32.const 200
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=328
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=344
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=336
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 2 (;@7;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=352
                    i64.store offset=384
                    local.get 4
                    local.get 4
                    i64.load offset=344
                    i64.store offset=376
                    local.get 4
                    local.get 4
                    i64.load offset=336
                    i64.store offset=368
                    local.get 4
                    local.get 4
                    i64.load offset=328
                    i64.store offset=360
                    local.get 4
                    i32.const 216
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                    local.get 1
                    i32.load offset=16
                    i32.eqz
                    br_if 3 (;@5;)
                    local.get 4
                    i32.const 152
                    i32.add
                    local.set 3
                    local.get 4
                    i32.const 360
                    i32.add
                    local.get 1
                    i32.load offset=12
                    i32.const 8
                    i32.add
                    call $"<nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                    local.get 4
                    i32.const 144
                    i32.add
                    local.get 4
                    i32.const 216
                    i32.add
                    local.get 4
                    i32.const 360
                    i32.add
                    call $nanvm_lib::vm::unstable::strict_eq::<nanvm_lib::naive::Naive>
                    block ;; label = @9
                      local.get 4
                      i64.load offset=144
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
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
                      br 2 (;@7;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=96
                    i64.store offset=48
                    local.get 4
                    local.get 4
                    i64.load offset=104
                    i64.store offset=56
                    local.get 4
                    local.get 4
                    i64.load offset=112
                    i64.store offset=64
                    local.get 4
                    local.get 4
                    i64.load offset=120
                    i64.store offset=72
                    local.get 4
                    local.get 3
                    i64.load offset=8
                    i64.store offset=88
                    local.get 4
                    local.get 3
                    i64.load
                    i64.store offset=80
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 48
                    i32.add
                    call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 3]>"
                    local.get 0
                    local.get 4
                    i64.load offset=8
                    i64.store offset=12 align=4
                    local.get 0
                    i32.const 6
                    i32.store8 offset=8
                    local.get 0
                    i64.const 0
                    i64.store
                    local.get 4
                    i32.const 32
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 1
                    i32.store
                    local.get 1
                    br_if 5 (;@3;)
                    br 4 (;@4;)
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
                  i32.const 168
                  i32.add
                  call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 112
                i32.add
                call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 96
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
              local.tee 1
              i32.store
              local.get 1
              i32.eqz
              br_if 1 (;@4;)
              br 2 (;@3;)
            end
            i32.const 0
            i32.const 0
            i32.const 1065308
            call $core::panicking::panic_bounds_check
            unreachable
          end
          local.get 4
          i32.const 24
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        end
        local.get 4
        i32.const 416
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 415
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
