  (func $nanvm_demos::samples::constants::module::<nanvm_lib::naive::Naive> (;582;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=64
    local.get 2
    i32.const 1064135
    i32.store offset=60
    local.get 2
    i32.const 1064131
    i32.store offset=56
    local.get 2
    i32.const 72
    i32.add
    local.get 2
    i32.const 56
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
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 3
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 2
                          i32.load offset=80
                          local.set 3
                          local.get 2
                          i32.load offset=76
                          local.set 4
                          local.get 2
                          i32.const 0
                          i32.store16 offset=64
                          local.get 2
                          i32.const 1064139
                          i32.store offset=60
                          local.get 2
                          i32.const 1064135
                          i32.store offset=56
                          local.get 2
                          i32.const 72
                          i32.add
                          local.get 2
                          i32.const 56
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 5
                          i32.const 255
                          i32.ne
                          br_if 1 (;@10;)
                          local.get 2
                          i32.load offset=80
                          local.set 5
                          local.get 2
                          i32.load offset=76
                          local.set 6
                          local.get 2
                          i32.const 0
                          i32.store16 offset=64
                          local.get 2
                          i32.const 1064148
                          i32.store offset=60
                          local.get 2
                          i32.const 1064139
                          i32.store offset=56
                          local.get 2
                          i32.const 72
                          i32.add
                          local.get 2
                          i32.const 56
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 7
                          i32.const 255
                          i32.ne
                          br_if 2 (;@9;)
                          local.get 2
                          i64.load offset=76 align=4
                          local.set 8
                          local.get 2
                          i32.const 0
                          i32.store8 offset=56
                          local.get 2
                          local.get 8
                          i64.store offset=116 align=4
                          local.get 2
                          i32.const 3
                          i32.store8 offset=112
                          local.get 2
                          local.get 5
                          i32.store offset=108
                          local.get 2
                          local.get 6
                          i32.store offset=104
                          local.get 2
                          i64.const 4665606068653522944
                          i64.store offset=96
                          local.get 2
                          i32.const 2
                          i32.store8 offset=88
                          local.get 2
                          local.get 3
                          i32.store offset=84
                          local.get 2
                          local.get 4
                          i32.store offset=80
                          local.get 2
                          i64.const 8589934592
                          i64.store offset=72
                          local.get 2
                          local.get 2
                          i32.const 56
                          i32.add
                          i32.store offset=128
                          local.get 2
                          i32.const 32
                          i32.add
                          local.get 2
                          i32.const 72
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                          local.get 2
                          local.get 2
                          i32.load offset=36
                          local.tee 4
                          i32.store offset=156
                          local.get 2
                          local.get 2
                          i32.load offset=32
                          local.tee 3
                          i32.store offset=152
                          block ;; label = @12
                            local.get 2
                            i32.load8_u offset=56
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 11 (;@1;)
                            local.get 2
                            i32.const 152
                            i32.add
                            call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                            br 11 (;@1;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 10 (;@1;)
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
                          i32.store16 offset=64
                          local.get 2
                          i32.const 1064151
                          i32.store offset=60
                          local.get 2
                          i32.const 1064148
                          i32.store offset=56
                          local.get 2
                          i32.const 72
                          i32.add
                          local.get 2
                          i32.const 56
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 5
                          i32.const 255
                          i32.ne
                          br_if 3 (;@8;)
                          local.get 2
                          i32.load offset=80
                          local.set 6
                          local.get 2
                          i32.load offset=76
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
                          br_if 4 (;@7;)
                          local.get 2
                          i32.const 0
                          i32.store16 offset=64
                          local.get 2
                          i32.const 1064155
                          i32.store offset=60
                          local.get 2
                          i32.const 1064151
                          i32.store offset=56
                          local.get 2
                          i32.const 72
                          i32.add
                          local.get 2
                          i32.const 56
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 5
                          i32.const 255
                          i32.ne
                          br_if 5 (;@6;)
                          local.get 2
                          i32.load offset=80
                          local.set 9
                          local.get 2
                          i32.load offset=76
                          local.set 10
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          i32.eqz
                          br_if 4 (;@7;)
                          local.get 2
                          i32.const 0
                          i32.store8 offset=56
                          local.get 2
                          local.get 4
                          i64.extend_i32_u
                          local.tee 8
                          i64.store offset=120
                          local.get 2
                          local.get 3
                          i32.store offset=116
                          local.get 2
                          i32.const 5
                          i32.store8 offset=112
                          local.get 2
                          local.get 9
                          i32.store offset=108
                          local.get 2
                          local.get 10
                          i32.store offset=104
                          local.get 2
                          local.get 8
                          i64.store offset=96
                          local.get 2
                          local.get 3
                          i32.store offset=92
                          local.get 2
                          i32.const 5
                          i32.store8 offset=88
                          local.get 2
                          local.get 6
                          i32.store offset=84
                          local.get 2
                          local.get 7
                          i32.store offset=80
                          local.get 2
                          i64.const 8589934592
                          i64.store offset=72
                          local.get 2
                          local.get 2
                          i32.const 56
                          i32.add
                          i32.store offset=128
                          local.get 2
                          i32.const 24
                          i32.add
                          local.get 2
                          i32.const 72
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                          local.get 2
                          local.get 2
                          i32.load offset=28
                          local.tee 4
                          i32.store offset=156
                          local.get 2
                          local.get 2
                          i32.load offset=24
                          local.tee 3
                          i32.store offset=152
                          block ;; label = @12
                            local.get 2
                            i32.load8_u offset=56
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 10 (;@2;)
                            local.get 2
                            i32.const 152
                            i32.add
                            call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                            br 10 (;@2;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 9 (;@2;)
                          local.get 2
                          local.get 4
                          i32.store offset=64
                          local.get 2
                          local.get 3
                          i32.store offset=60
                          local.get 2
                          i32.const 5
                          i32.store8 offset=56
                          local.get 2
                          i32.const 0
                          i32.store16 offset=148
                          local.get 2
                          i32.const 1063748
                          i32.store offset=144
                          local.get 2
                          i32.const 1063741
                          i32.store offset=140
                          local.get 2
                          i32.const 72
                          i32.add
                          local.get 2
                          i32.const 140
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 2
                          i32.load8_u offset=72
                          local.tee 5
                          i32.const 255
                          i32.ne
                          br_if 6 (;@5;)
                          local.get 2
                          i32.load offset=80
                          local.set 6
                          local.get 2
                          i32.load offset=76
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
                          br_if 4 (;@7;)
                          local.get 2
                          i32.const 0
                          i32.store8 offset=140
                          local.get 2
                          local.get 4
                          i64.extend_i32_u
                          i64.store offset=88
                          local.get 2
                          local.get 3
                          i32.store offset=84
                          local.get 2
                          i32.const 5
                          i32.store8 offset=80
                          local.get 2
                          i64.const 4294967296
                          i64.store offset=72
                          local.get 2
                          local.get 2
                          i32.const 140
                          i32.add
                          i32.store offset=96
                          local.get 2
                          i32.const 16
                          i32.add
                          local.get 2
                          i32.const 72
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                          local.get 2
                          local.get 2
                          i32.load offset=20
                          local.tee 4
                          i32.store offset=156
                          local.get 2
                          local.get 2
                          i32.load offset=16
                          local.tee 3
                          i32.store offset=152
                          block ;; label = @12
                            local.get 2
                            i32.load8_u offset=140
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 9 (;@3;)
                            local.get 2
                            i32.const 152
                            i32.add
                            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                            br 9 (;@3;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 8 (;@3;)
                          i32.const 197
                          i32.const 0
                          local.get 3
                          local.get 4
                          i32.const 1064155
                          i32.const 58
                          call $<nanvm_lib::naive::function::Function>::new
                          local.set 3
                          local.get 2
                          i32.const 0
                          i32.store8 offset=140
                          local.get 2
                          local.get 3
                          i32.store offset=92
                          local.get 2
                          i32.const 7
                          i32.store8 offset=88
                          local.get 2
                          local.get 6
                          i32.store offset=84
                          local.get 2
                          local.get 7
                          i32.store offset=80
                          local.get 2
                          i64.const 4294967296
                          i64.store offset=72
                          local.get 2
                          local.get 2
                          i32.const 140
                          i32.add
                          i32.store offset=104
                          local.get 2
                          i32.const 8
                          i32.add
                          local.get 2
                          i32.const 72
                          i32.add
                          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                          local.get 2
                          local.get 2
                          i32.load offset=12
                          local.tee 4
                          i32.store offset=156
                          local.get 2
                          local.get 2
                          i32.load offset=8
                          local.tee 3
                          i32.store offset=152
                          block ;; label = @12
                            local.get 2
                            i32.load8_u offset=140
                            i32.const 1
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 3
                            local.get 3
                            i32.load
                            i32.const -1
                            i32.add
                            local.tee 0
                            i32.store
                            local.get 0
                            br_if 8 (;@4;)
                            local.get 2
                            i32.const 152
                            i32.add
                            call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                            br 8 (;@4;)
                          end
                          local.get 3
                          i32.eqz
                          br_if 7 (;@4;)
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
                          i32.const 56
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 2
                          i32.const 40
                          i32.add
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 1
                          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          local.get 2
                          i32.const 176
                          i32.add
                          global.set $__stack_pointer
                          return
                        end
                        local.get 2
                        local.get 2
                        i32.load8_u offset=75
                        i32.store8 offset=155
                        local.get 2
                        local.get 2
                        i32.load16_u offset=73 align=1
                        i32.store16 offset=153 align=1
                        local.get 2
                        local.get 2
                        i32.load offset=84
                        i32.store offset=164
                        local.get 2
                        local.get 2
                        i64.load offset=76 align=4
                        i64.store offset=156 align=4
                        local.get 2
                        local.get 3
                        i32.store8 offset=152
                        i32.const 1063112
                        i32.const 43
                        local.get 2
                        i32.const 152
                        i32.add
                        i32.const 1063096
                        i32.const 1063156
                        call $core::result::unwrap_failed
                        unreachable
                      end
                      local.get 2
                      local.get 2
                      i32.load8_u offset=75
                      i32.store8 offset=155
                      local.get 2
                      local.get 2
                      i32.load16_u offset=73 align=1
                      i32.store16 offset=153 align=1
                      local.get 2
                      local.get 2
                      i32.load offset=84
                      i32.store offset=164
                      local.get 2
                      local.get 2
                      i64.load offset=76 align=4
                      i64.store offset=156 align=4
                      local.get 2
                      local.get 5
                      i32.store8 offset=152
                      i32.const 1063112
                      i32.const 43
                      local.get 2
                      i32.const 152
                      i32.add
                      i32.const 1063096
                      i32.const 1063156
                      call $core::result::unwrap_failed
                      unreachable
                    end
                    local.get 2
                    local.get 2
                    i32.load8_u offset=75
                    i32.store8 offset=155
                    local.get 2
                    local.get 2
                    i32.load16_u offset=73 align=1
                    i32.store16 offset=153 align=1
                    local.get 2
                    local.get 2
                    i32.load offset=84
                    i32.store offset=164
                    local.get 2
                    local.get 2
                    i64.load offset=76 align=4
                    i64.store offset=156 align=4
                    local.get 2
                    local.get 7
                    i32.store8 offset=152
                    i32.const 1063112
                    i32.const 43
                    local.get 2
                    i32.const 152
                    i32.add
                    i32.const 1063096
                    i32.const 1063156
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  local.get 2
                  local.get 2
                  i32.load8_u offset=75
                  i32.store8 offset=155
                  local.get 2
                  local.get 2
                  i32.load16_u offset=73 align=1
                  i32.store16 offset=153 align=1
                  local.get 2
                  local.get 2
                  i32.load offset=84
                  i32.store offset=164
                  local.get 2
                  local.get 2
                  i64.load offset=76 align=4
                  i64.store offset=156 align=4
                  local.get 2
                  local.get 5
                  i32.store8 offset=152
                  i32.const 1063112
                  i32.const 43
                  local.get 2
                  i32.const 152
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                end
                unreachable
              end
              local.get 2
              local.get 2
              i32.load8_u offset=75
              i32.store8 offset=155
              local.get 2
              local.get 2
              i32.load16_u offset=73 align=1
              i32.store16 offset=153 align=1
              local.get 2
              local.get 2
              i32.load offset=84
              i32.store offset=164
              local.get 2
              local.get 2
              i64.load offset=76 align=4
              i64.store offset=156 align=4
              local.get 2
              local.get 5
              i32.store8 offset=152
              i32.const 1063112
              i32.const 43
              local.get 2
              i32.const 152
              i32.add
              i32.const 1063096
              i32.const 1063156
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 2
            local.get 2
            i32.load8_u offset=75
            i32.store8 offset=155
            local.get 2
            local.get 2
            i32.load16_u offset=73 align=1
            i32.store16 offset=153 align=1
            local.get 2
            local.get 2
            i32.load offset=84
            i32.store offset=164
            local.get 2
            local.get 2
            i64.load offset=76 align=4
            i64.store offset=156 align=4
            local.get 2
            local.get 5
            i32.store8 offset=152
            i32.const 1063112
            i32.const 43
            local.get 2
            i32.const 152
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          i32.const 1059464
          i32.const 43
          local.get 2
          i32.const 175
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 2
        i32.const 175
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 175
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 175
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::constants::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;583;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 512
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
      i64.store offset=328
      local.get 4
      local.get 3
      i32.store offset=324
      local.get 4
      local.get 5
      i32.store8 offset=321
      local.get 4
      local.get 6
      i32.store8 offset=320
      local.get 4
      i32.const 0
      i32.store16 offset=264
      local.get 4
      i32.const 1064151
      i32.store offset=260
      local.get 4
      i32.const 1064148
      i32.store offset=256
      local.get 4
      i32.const 464
      i32.add
      local.get 4
      i32.const 256
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=464
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=468 align=4
                    i64.store offset=356 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=352
                    local.get 4
                    i32.const 224
                    i32.add
                    local.get 4
                    i32.const 320
                    i32.add
                    local.get 4
                    i32.const 352
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=224
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
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
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=248
                    i64.store offset=488
                    local.get 4
                    local.get 4
                    i64.load offset=240
                    i64.store offset=480
                    local.get 4
                    local.get 4
                    i64.load offset=232
                    i64.store offset=472
                    local.get 4
                    local.get 4
                    i64.load offset=224
                    i64.store offset=464
                    local.get 4
                    i32.const 352
                    i32.add
                    local.get 4
                    i32.const 464
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=352
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        i32.const 1
                        local.set 5
                        i32.const 0
                        local.set 3
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=354 align=2
                      i64.store offset=320
                      local.get 4
                      local.get 4
                      i64.load offset=360 align=2
                      i64.store offset=326 align=2
                      local.get 4
                      i32.load8_u offset=353
                      local.set 5
                    end
                    local.get 4
                    i32.const 464
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 480
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    local.get 5
                    i32.store8 offset=289
                    local.get 4
                    local.get 3
                    i32.store8 offset=288
                    local.get 4
                    local.get 4
                    i64.load offset=320
                    i64.store offset=290 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=326 align=2
                    i64.store offset=296 align=2
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
                                    local.tee 3
                                    i32.load8_u offset=8
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 3
                                  i64.load offset=16
                                  local.set 7
                                  br 10 (;@5;)
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
                                br 8 (;@6;)
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
                              local.get 3
                              i64.load8_u offset=20
                              i64.const 32
                              i64.shl
                              local.get 3
                              i64.load32_u offset=16
                              i64.or
                              local.set 7
                              br 8 (;@5;)
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
                            br_if 11 (;@1;)
                            br 6 (;@6;)
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
                          br_if 10 (;@1;)
                          br 5 (;@6;)
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
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 3
                      i32.load8_u offset=9
                      local.set 3
                    end
                    br 3 (;@5;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=467
                  i32.store8 offset=355
                  local.get 4
                  local.get 4
                  i32.load16_u offset=465 align=1
                  i32.store16 offset=353 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=476
                  i32.store offset=364
                  local.get 4
                  local.get 4
                  i64.load offset=468 align=4
                  i64.store offset=356 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=352
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 352
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
            i64.store offset=328
            local.get 4
            local.get 5
            i32.store offset=324
            local.get 4
            local.get 3
            i32.store8 offset=321
            local.get 4
            local.get 6
            i32.store8 offset=320
            local.get 4
            i32.const 0
            i32.store16 offset=264
            local.get 4
            i32.const 1064155
            i32.store offset=260
            local.get 4
            i32.const 1064151
            i32.store offset=256
            local.get 4
            i32.const 464
            i32.add
            local.get 4
            i32.const 256
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=464
                    local.tee 3
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=468 align=4
                    i64.store offset=356 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=352
                    local.get 4
                    i32.const 256
                    i32.add
                    local.get 4
                    i32.const 320
                    i32.add
                    local.get 4
                    i32.const 352
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=256
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
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
                      i32.const 288
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=280
                    i64.store offset=488
                    local.get 4
                    local.get 4
                    i64.load offset=272
                    i64.store offset=480
                    local.get 4
                    local.get 4
                    i64.load offset=264
                    i64.store offset=472
                    local.get 4
                    local.get 4
                    i64.load offset=256
                    i64.store offset=464
                    local.get 4
                    i32.const 352
                    i32.add
                    local.get 4
                    i32.const 464
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=352
                        local.tee 3
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        i32.const 0
                        local.set 3
                        i32.const 1
                        local.set 5
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=354 align=2
                      i64.store offset=320
                      local.get 4
                      local.get 4
                      i64.load offset=360 align=2
                      i64.store offset=326 align=2
                      local.get 4
                      i32.load8_u offset=353
                      local.set 5
                    end
                    local.get 4
                    i32.const 464
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 480
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    local.get 5
                    i32.store8 offset=105
                    local.get 4
                    local.get 3
                    i32.store8 offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=320
                    i64.store offset=106 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=326 align=2
                    i64.store offset=112 align=2
                    local.get 4
                    i32.const 288
                    i32.add
                    local.get 4
                    i32.const 104
                    i32.add
                    call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::cmp::PartialEq>::eq"
                    local.set 3
                    local.get 4
                    i32.const 104
                    i32.add
                    call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 288
                    i32.add
                    call $"#func383 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    local.get 3
                    i32.store8 offset=89
                    local.get 4
                    i32.const 1
                    i32.store8 offset=88
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
                                    local.tee 3
                                    i32.load8_u offset=8
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 3
                                  i64.load offset=16
                                  local.set 7
                                  br 10 (;@5;)
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
                                br 8 (;@6;)
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
                              local.get 3
                              i64.load8_u offset=20
                              i64.const 32
                              i64.shl
                              local.get 3
                              i64.load32_u offset=16
                              i64.or
                              local.set 7
                              br 8 (;@5;)
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
                            br_if 11 (;@1;)
                            br 6 (;@6;)
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
                          br_if 10 (;@1;)
                          br 5 (;@6;)
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
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 3
                      i32.load8_u offset=9
                      local.set 3
                    end
                    br 3 (;@5;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=467
                  i32.store8 offset=355
                  local.get 4
                  local.get 4
                  i32.load16_u offset=465 align=1
                  i32.store16 offset=353 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=476
                  i32.store offset=364
                  local.get 4
                  local.get 4
                  i64.load offset=468 align=4
                  i64.store offset=356 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=352
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 352
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
            i64.store offset=328
            local.get 4
            local.get 5
            i32.store offset=324
            local.get 4
            local.get 3
            i32.store8 offset=321
            local.get 4
            local.get 6
            i32.store8 offset=320
            local.get 4
            i32.const 0
            i32.store16 offset=296
            local.get 4
            i32.const 1064155
            i32.store offset=292
            local.get 4
            i32.const 1064151
            i32.store offset=288
            local.get 4
            i32.const 464
            i32.add
            local.get 4
            i32.const 288
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=464
                      local.tee 3
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=468 align=4
                      i64.store offset=356 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=352
                      local.get 4
                      i32.const 288
                      i32.add
                      local.get 4
                      i32.const 320
                      i32.add
                      local.get 4
                      i32.const 352
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=288
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=304
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=296
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 5 (;@5;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=312
                      i64.store offset=488
                      local.get 4
                      local.get 4
                      i64.load offset=304
                      i64.store offset=480
                      local.get 4
                      local.get 4
                      i64.load offset=296
                      i64.store offset=472
                      local.get 4
                      local.get 4
                      i64.load offset=288
                      i64.store offset=464
                      local.get 4
                      i32.const 352
                      i32.add
                      local.get 4
                      i32.const 464
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=352
                          local.tee 3
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          i32.const 1
                          local.set 5
                          i32.const 0
                          local.set 3
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=354 align=2
                        i64.store offset=320
                        local.get 4
                        local.get 4
                        i64.load offset=360 align=2
                        i64.store offset=326 align=2
                        local.get 4
                        i32.load8_u offset=353
                        local.set 5
                      end
                      local.get 4
                      i32.const 464
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 480
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 5
                      i32.store8 offset=193
                      local.get 4
                      local.get 3
                      i32.store8 offset=192
                      local.get 4
                      local.get 4
                      i64.load offset=320
                      i64.store offset=194 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=326 align=2
                      i64.store offset=200 align=2
                      local.get 4
                      i32.const 0
                      i32.store16 offset=328
                      local.get 4
                      i32.const 1064135
                      i32.store offset=324
                      local.get 4
                      i32.const 1064131
                      i32.store offset=320
                      local.get 4
                      i32.const 464
                      i32.add
                      local.get 4
                      i32.const 320
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      local.get 4
                      i32.load8_u offset=464
                      local.tee 3
                      i32.const 255
                      i32.ne
                      br_if 1 (;@8;)
                      local.get 4
                      local.get 4
                      i64.load offset=468 align=4
                      i64.store offset=356 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=352
                      local.get 4
                      i32.const 320
                      i32.add
                      local.get 4
                      i32.const 192
                      i32.add
                      local.get 4
                      i32.const 352
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=320
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=336
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=328
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 5 (;@5;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=344
                      i64.store offset=488
                      local.get 4
                      local.get 4
                      i64.load offset=336
                      i64.store offset=480
                      local.get 4
                      local.get 4
                      i64.load offset=328
                      i64.store offset=472
                      local.get 4
                      local.get 4
                      i64.load offset=320
                      i64.store offset=464
                      local.get 4
                      i32.const 352
                      i32.add
                      local.get 4
                      i32.const 464
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=352
                          local.tee 3
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          i32.const 1
                          local.set 5
                          i32.const 0
                          local.set 3
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=354 align=2
                        i64.store offset=496
                        local.get 4
                        local.get 4
                        i64.load offset=360 align=2
                        i64.store offset=502 align=2
                        local.get 4
                        i32.load8_u offset=353
                        local.set 5
                      end
                      local.get 4
                      i32.const 464
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 480
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 5
                      i32.store8 offset=177
                      local.get 4
                      local.get 3
                      i32.store8 offset=176
                      local.get 4
                      local.get 4
                      i64.load offset=496
                      i64.store offset=178 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=502 align=2
                      i64.store offset=184 align=2
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      local.get 4
                                      i32.load8_u offset=24
                                      local.tee 5
                                      br_table 6 (;@11;) 6 (;@11;) 0 (;@17;) 1 (;@16;) 2 (;@15;) 3 (;@14;) 4 (;@13;) 5 (;@12;) 6 (;@11;)
                                    end
                                    local.get 4
                                    i64.load offset=32
                                    local.set 7
                                    br 10 (;@6;)
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
                                  br_if 14 (;@1;)
                                  br 8 (;@7;)
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
                                br_if 13 (;@1;)
                                local.get 4
                                i64.load8_u offset=36
                                i64.const 32
                                i64.shl
                                local.get 4
                                i64.load32_u offset=32
                                i64.or
                                local.set 7
                                br 8 (;@6;)
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
                              br 6 (;@7;)
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
                            br 5 (;@7;)
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
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.load8_u offset=25
                        local.set 6
                      end
                      br 3 (;@6;)
                    end
                    local.get 4
                    local.get 4
                    i32.load8_u offset=467
                    i32.store8 offset=355
                    local.get 4
                    local.get 4
                    i32.load16_u offset=465 align=1
                    i32.store16 offset=353 align=1
                    local.get 4
                    local.get 4
                    i32.load offset=476
                    i32.store offset=364
                    local.get 4
                    local.get 4
                    i64.load offset=468 align=4
                    i64.store offset=356 align=4
                    local.get 4
                    local.get 3
                    i32.store8 offset=352
                    i32.const 1063112
                    i32.const 43
                    local.get 4
                    i32.const 352
                    i32.add
                    i32.const 1063096
                    i32.const 1063156
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=467
                  i32.store8 offset=355
                  local.get 4
                  local.get 4
                  i32.load16_u offset=465 align=1
                  i32.store16 offset=353 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=476
                  i32.store offset=364
                  local.get 4
                  local.get 4
                  i64.load offset=468 align=4
                  i64.store offset=356 align=4
                  local.get 4
                  local.get 3
                  i32.store8 offset=352
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 352
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                i64.load32_u offset=32
                local.set 7
              end
              local.get 4
              local.get 7
              i64.store offset=504
              local.get 4
              local.get 3
              i32.store offset=500
              local.get 4
              local.get 6
              i32.store8 offset=497
              local.get 4
              local.get 5
              i32.store8 offset=496
              local.get 4
              i64.const 0
              i64.store offset=472
              local.get 4
              i32.const 2
              i32.store8 offset=464
              local.get 4
              i32.const 352
              i32.add
              local.get 4
              i32.const 496
              i32.add
              local.get 4
              i32.const 464
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                local.get 4
                i32.load8_u offset=352
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=368
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=360
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 176
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=376
              i64.store offset=488
              local.get 4
              local.get 4
              i64.load offset=368
              i64.store offset=480
              local.get 4
              local.get 4
              i64.load offset=360
              i64.store offset=472
              local.get 4
              local.get 4
              i64.load offset=352
              i64.store offset=464
              local.get 4
              i32.const 496
              i32.add
              local.get 4
              i32.const 464
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=496
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  i32.const 1
                  local.set 5
                  i32.const 0
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=498 align=2
                i64.store offset=384
                local.get 4
                local.get 4
                i64.load offset=504 align=2
                i64.store offset=390 align=2
                local.get 4
                i32.load8_u offset=497
                local.set 5
              end
              local.get 4
              i32.const 464
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 480
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              local.get 5
              i32.store8 offset=209
              local.get 4
              local.get 3
              i32.store8 offset=208
              local.get 4
              local.get 4
              i64.load offset=384
              i64.store offset=210 align=2
              local.get 4
              local.get 4
              i64.load offset=390 align=2
              i64.store offset=216 align=2
              local.get 4
              i32.const 152
              i32.add
              local.get 4
              i32.const 176
              i32.add
              local.get 4
              i32.const 208
              i32.add
              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
              local.get 4
              local.get 4
              i64.load offset=160
              i64.store offset=136
              local.get 4
              local.get 4
              i64.load offset=168
              i64.store offset=144
              block ;; label = @6
                local.get 4
                i64.load offset=152
                i64.const 1
                i64.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=144
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=136
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=144
              i64.store offset=128
              local.get 4
              local.get 4
              i64.load offset=136
              i64.store offset=120
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 1
                    i32.load offset=16
                    i32.eqz
                    br_if 0 (;@8;)
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
                                    local.tee 3
                                    i32.load8_u offset=8
                                    local.tee 5
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 3
                                  i64.load offset=16
                                  local.set 7
                                  br 9 (;@6;)
                                end
                                local.get 3
                                i32.load offset=12
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 6
                                i32.store
                                local.get 6
                                i32.eqz
                                br_if 13 (;@1;)
                                br 7 (;@7;)
                              end
                              local.get 3
                              i32.load offset=12
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 6
                              i32.store
                              local.get 6
                              i32.eqz
                              br_if 12 (;@1;)
                              local.get 3
                              i64.load8_u offset=20
                              i64.const 32
                              i64.shl
                              local.get 3
                              i64.load32_u offset=16
                              i64.or
                              local.set 7
                              br 7 (;@6;)
                            end
                            local.get 3
                            i32.load offset=12
                            local.tee 1
                            local.get 1
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 6
                            i32.store
                            local.get 6
                            i32.eqz
                            br_if 11 (;@1;)
                            br 5 (;@7;)
                          end
                          local.get 3
                          i32.load offset=12
                          local.tee 1
                          local.get 1
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 6
                          i32.store
                          local.get 6
                          i32.eqz
                          br_if 10 (;@1;)
                          br 4 (;@7;)
                        end
                        local.get 3
                        i32.load offset=12
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 3
                        i32.store
                        local.get 3
                        i32.eqz
                        br_if 9 (;@1;)
                        br 1 (;@9;)
                      end
                      local.get 3
                      i32.load8_u offset=9
                      local.set 3
                    end
                    br 2 (;@6;)
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
              i64.store offset=504
              local.get 4
              local.get 1
              i32.store offset=500
              local.get 4
              local.get 3
              i32.store8 offset=497
              local.get 4
              local.get 5
              i32.store8 offset=496
              local.get 4
              i32.const 0
              i32.store16 offset=184
              local.get 4
              i32.const 1064151
              i32.store offset=180
              local.get 4
              i32.const 1064148
              i32.store offset=176
              local.get 4
              i32.const 464
              i32.add
              local.get 4
              i32.const 176
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=464
                  local.tee 1
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=468 align=4
                  i64.store offset=156 align=4
                  local.get 4
                  i32.const 3
                  i32.store8 offset=152
                  local.get 4
                  i32.const 400
                  i32.add
                  local.get 4
                  i32.const 496
                  i32.add
                  local.get 4
                  i32.const 152
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=400
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 400
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 1
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=424
                  i64.store offset=488
                  local.get 4
                  local.get 4
                  i64.load offset=416
                  i64.store offset=480
                  local.get 4
                  local.get 4
                  i64.load offset=408
                  i64.store offset=472
                  local.get 4
                  local.get 4
                  i64.load offset=400
                  i64.store offset=464
                  local.get 4
                  i32.const 152
                  i32.add
                  local.get 4
                  i32.const 464
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                  local.get 4
                  i32.const 8
                  i32.add
                  i32.const 1064135
                  i32.const 4
                  call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                  local.get 4
                  i32.const 3
                  i32.store8 offset=464
                  local.get 4
                  local.get 4
                  i64.load offset=8
                  i64.store offset=468 align=4
                  local.get 4
                  i32.const 432
                  i32.add
                  local.get 4
                  i32.const 152
                  i32.add
                  local.get 4
                  i32.const 464
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=432
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 432
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 1
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=456
                  i64.store offset=488
                  local.get 4
                  local.get 4
                  i64.load offset=448
                  i64.store offset=480
                  local.get 4
                  local.get 4
                  i64.load offset=440
                  i64.store offset=472
                  local.get 4
                  local.get 4
                  i64.load offset=432
                  i64.store offset=464
                  local.get 4
                  i32.const 72
                  i32.add
                  local.get 4
                  i32.const 464
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                  local.get 4
                  local.get 4
                  i64.load offset=88
                  i64.store offset=40
                  local.get 4
                  local.get 4
                  i64.load offset=96
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
                  i32.const 40
                  i32.add
                  call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 3]>"
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
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  br_if 5 (;@2;)
                  br 4 (;@3;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=467
                i32.store8 offset=155
                local.get 4
                local.get 4
                i32.load16_u offset=465 align=1
                i32.store16 offset=153 align=1
                local.get 4
                local.get 4
                i32.load offset=476
                i32.store offset=164
                local.get 4
                local.get 4
                i64.load offset=468 align=4
                i64.store offset=156 align=4
                local.get 4
                local.get 1
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
              i32.const 120
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 88
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          end
          local.get 4
          i32.const 24
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          local.get 2
          i32.load
          i32.const -1
          i32.add
          local.tee 1
          i32.store
          local.get 1
          br_if 1 (;@2;)
        end
        local.get 4
        i32.const 16
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 512
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
