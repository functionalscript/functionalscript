  (func $nanvm_demos::samples::entries::module::<nanvm_lib::naive::Naive> (;709;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store8 offset=152
    local.get 2
    i32.const 32
    i32.add
    local.get 2
    i32.const 152
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=36
    local.tee 3
    i32.store offset=76
    local.get 2
    local.get 2
    i32.load offset=32
    local.tee 4
    i32.store offset=72
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=152
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
        i32.const 72
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.const 248
      i32.const 2
      local.get 4
      local.get 3
      i32.const 1065981
      i32.const 100
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
      i32.const 1066082
      i32.store offset=60
      local.get 2
      i32.const 1066081
      i32.store offset=56
      local.get 2
      i32.const 72
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
                    block ;; label = @9
                      block ;; label = @10
                        local.get 2
                        i32.load8_u offset=72
                        local.tee 4
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 2
                        i32.load offset=80
                        local.set 4
                        local.get 2
                        i32.load offset=76
                        local.set 5
                        local.get 2
                        i32.const 0
                        i32.store16 offset=64
                        local.get 2
                        i32.const 1066089
                        i32.store offset=60
                        local.get 2
                        i32.const 1066082
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
                        local.tee 6
                        i32.const 255
                        i32.ne
                        br_if 1 (;@9;)
                        local.get 2
                        i32.load offset=80
                        local.set 6
                        local.get 2
                        i32.load offset=76
                        local.set 7
                        local.get 2
                        i32.const 0
                        i32.store16 offset=64
                        local.get 2
                        i32.const 1066090
                        i32.store offset=60
                        local.get 2
                        i32.const 1066089
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
                        local.tee 8
                        i32.const 255
                        i32.ne
                        br_if 2 (;@8;)
                        local.get 2
                        i32.load offset=80
                        local.set 8
                        local.get 2
                        i32.load offset=76
                        local.set 9
                        local.get 2
                        i32.const 0
                        i32.store16 offset=64
                        local.get 2
                        i32.const 1066093
                        i32.store offset=60
                        local.get 2
                        i32.const 1066090
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
                        local.tee 10
                        i32.const 255
                        i32.ne
                        br_if 3 (;@7;)
                        local.get 2
                        i64.load offset=76 align=4
                        local.set 11
                        local.get 2
                        i32.const 0
                        i32.store8 offset=56
                        local.get 2
                        local.get 11
                        i64.store offset=116 align=4
                        local.get 2
                        i32.const 3
                        i32.store8 offset=112
                        local.get 2
                        local.get 8
                        i32.store offset=108
                        local.get 2
                        local.get 9
                        i32.store offset=104
                        local.get 2
                        local.get 6
                        i32.store offset=96
                        local.get 2
                        local.get 7
                        i32.store offset=92
                        local.get 2
                        i32.const 3
                        i32.store8 offset=88
                        local.get 2
                        local.get 4
                        i32.store offset=84
                        local.get 2
                        local.get 5
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
                        local.tee 5
                        i32.store offset=156
                        local.get 2
                        local.get 2
                        i32.load offset=24
                        local.tee 4
                        i32.store offset=152
                        block ;; label = @11
                          local.get 2
                          i32.load8_u offset=56
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 0
                          i32.store
                          local.get 0
                          br_if 9 (;@2;)
                          local.get 2
                          i32.const 152
                          i32.add
                          call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                          br 9 (;@2;)
                        end
                        local.get 4
                        i32.eqz
                        br_if 8 (;@2;)
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
                        i32.store16 offset=148
                        local.get 2
                        i32.const 1064562
                        i32.store offset=144
                        local.get 2
                        i32.const 1064555
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
                        local.tee 6
                        i32.const 255
                        i32.ne
                        br_if 4 (;@6;)
                        local.get 2
                        i32.load offset=80
                        local.set 7
                        local.get 2
                        i32.load offset=76
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
                        br_if 5 (;@5;)
                        local.get 4
                        local.get 4
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 6
                        i32.store
                        local.get 6
                        i32.eqz
                        br_if 5 (;@5;)
                        local.get 2
                        i32.const 0
                        i32.store8 offset=140
                        local.get 2
                        local.get 5
                        i64.extend_i32_u
                        i64.store offset=104
                        local.get 2
                        local.get 4
                        i32.store offset=100
                        local.get 2
                        i32.const 5
                        i32.store8 offset=96
                        local.get 2
                        i64.const 0
                        i64.store offset=88
                        local.get 2
                        local.get 3
                        i32.store offset=84
                        local.get 2
                        i32.const 7
                        i32.store8 offset=80
                        local.get 2
                        i64.const 8589934592
                        i64.store offset=72
                        local.get 2
                        local.get 2
                        i32.const 140
                        i32.add
                        i32.store offset=112
                        local.get 2
                        i32.const 16
                        i32.add
                        local.get 2
                        i32.const 72
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 2
                        local.get 2
                        i32.load offset=20
                        local.tee 3
                        i32.store offset=156
                        local.get 2
                        local.get 2
                        i32.load offset=16
                        local.tee 4
                        i32.store offset=152
                        block ;; label = @11
                          local.get 2
                          i32.load8_u offset=140
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 0
                          i32.store
                          local.get 0
                          br_if 8 (;@3;)
                          local.get 2
                          i32.const 152
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 8 (;@3;)
                        end
                        local.get 4
                        i32.eqz
                        br_if 7 (;@3;)
                        i32.const 249
                        i32.const 0
                        local.get 4
                        local.get 3
                        i32.const 1066093
                        i32.const 40
                        call $<nanvm_lib::naive::function::Function>::new
                        local.set 4
                        local.get 2
                        i32.const 0
                        i32.store8 offset=140
                        local.get 2
                        local.get 4
                        i32.store offset=92
                        local.get 2
                        i32.const 7
                        i32.store8 offset=88
                        local.get 2
                        local.get 7
                        i32.store offset=84
                        local.get 2
                        local.get 8
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
                        local.tee 3
                        i32.store offset=156
                        local.get 2
                        local.get 2
                        i32.load offset=8
                        local.tee 4
                        i32.store offset=152
                        block ;; label = @11
                          local.get 2
                          i32.load8_u offset=140
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 0
                          i32.store
                          local.get 0
                          br_if 7 (;@4;)
                          local.get 2
                          i32.const 152
                          i32.add
                          call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                          br 7 (;@4;)
                        end
                        local.get 4
                        i32.eqz
                        br_if 6 (;@4;)
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
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 2
                        i32.const 40
                        i32.add
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                        local.get 1
                        call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
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
                      local.get 4
                      i32.store8 offset=152
                      i32.const 1055372
                      i32.const 43
                      local.get 2
                      i32.const 152
                      i32.add
                      i32.const 1055356
                      i32.const 1055416
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
                    local.get 6
                    i32.store8 offset=152
                    i32.const 1055372
                    i32.const 43
                    local.get 2
                    i32.const 152
                    i32.add
                    i32.const 1055356
                    i32.const 1055416
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
                  local.get 8
                  i32.store8 offset=152
                  i32.const 1055372
                  i32.const 43
                  local.get 2
                  i32.const 152
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
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
                local.get 10
                i32.store8 offset=152
                i32.const 1055372
                i32.const 43
                local.get 2
                i32.const 152
                i32.add
                i32.const 1055356
                i32.const 1055416
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
              local.get 6
              i32.store8 offset=152
              i32.const 1055372
              i32.const 43
              local.get 2
              i32.const 152
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
          i32.const 175
          i32.add
          i32.const 1053912
          i32.const 1053972
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1053928
        i32.const 43
        local.get 2
        i32.const 175
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 175
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 175
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::entries::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;710;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 80
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=4
    local.get 4
    local.get 2
    i32.store
    i32.const 0
    local.set 5
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    i32.const 1
    local.set 6
    local.get 4
    i32.const 24
    i32.add
    local.get 4
    i32.const 1
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 40
    i32.add
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 24
    i32.add
    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::own_entry
    i64.const 1
    local.set 7
    local.get 4
    i32.const 50
    i32.add
    local.set 3
    local.get 4
    i32.load8_u offset=49
    local.set 8
    local.get 4
    i32.load8_u offset=48
    local.set 2
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i64.load offset=40
        i64.const 1
        i64.ne
        br_if 0 (;@2;)
        local.get 0
        local.get 8
        i32.store8 offset=9
        local.get 0
        local.get 2
        i32.store8 offset=8
        local.get 0
        local.get 3
        i64.load align=2
        i64.store offset=10 align=2
        local.get 0
        local.get 3
        i64.load offset=6 align=2
        i64.store offset=16 align=2
        br 1 (;@1;)
      end
      block ;; label = @2
        local.get 2
        i32.const 255
        i32.and
        i32.const 255
        i32.eq
        br_if 0 (;@2;)
        local.get 4
        local.get 3
        i64.load offset=6 align=2
        i64.store offset=70 align=2
        local.get 4
        local.get 3
        i64.load align=2
        i64.store offset=64
        local.get 8
        local.set 6
        local.get 2
        local.set 5
      end
      local.get 0
      local.get 6
      i32.store8 offset=9
      local.get 0
      local.get 5
      i32.store8 offset=8
      local.get 0
      local.get 4
      i64.load offset=64
      i64.store offset=10 align=2
      local.get 0
      local.get 4
      i64.load offset=70 align=2
      i64.store offset=16 align=2
      i64.const 0
      local.set 7
    end
    local.get 0
    local.get 7
    i64.store
    local.get 4
    i32.load
    local.tee 0
    local.get 0
    i32.load
    i32.const -1
    i32.add
    local.tee 0
    i32.store
    block ;; label = @1
      local.get 0
      br_if 0 (;@1;)
      local.get 4
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 80
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::entries::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;711;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i64 i32 f64)
    global.get $__stack_pointer
    i32.const 272
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
                            local.tee 6
                            i32.load8_u offset=8
                            local.tee 7
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 6
                          i64.load offset=16
                          local.set 8
                          br 9 (;@2;)
                        end
                        local.get 6
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
                        br_if 9 (;@1;)
                        br 7 (;@3;)
                      end
                      local.get 6
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
                      br_if 8 (;@1;)
                      local.get 6
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 6
                      i64.load32_u offset=16
                      i64.or
                      local.set 8
                      br 7 (;@2;)
                    end
                    local.get 6
                    i32.load offset=12
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    br_if 5 (;@3;)
                    br 7 (;@1;)
                  end
                  local.get 6
                  i32.load offset=12
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 9
                  i32.store
                  local.get 9
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 6
                i32.load offset=12
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 6
              i32.load8_u offset=9
              local.set 6
            end
            br 2 (;@2;)
          end
          i32.const 0
          i32.const 0
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 6
        i64.load32_u offset=16
        local.set 8
      end
      local.get 4
      local.get 8
      i64.store offset=48
      local.get 4
      local.get 5
      i32.store offset=44
      local.get 4
      local.get 6
      i32.store8 offset=41
      local.get 4
      local.get 7
      i32.store8 offset=40
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            local.get 1
            i32.load offset=16
            local.tee 5
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
                            local.tee 1
                            i32.load8_u offset=24
                            local.tee 6
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 1
                          i64.load offset=32
                          local.set 8
                          br 9 (;@2;)
                        end
                        local.get 1
                        i32.load offset=28
                        local.tee 5
                        local.get 5
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
                      i32.load offset=28
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 1
                      i64.load8_u offset=36
                      i64.const 32
                      i64.shl
                      local.get 1
                      i64.load32_u offset=32
                      i64.or
                      local.set 8
                      br 7 (;@2;)
                    end
                    local.get 1
                    i32.load offset=28
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    i32.eqz
                    br_if 7 (;@1;)
                    br 5 (;@3;)
                  end
                  local.get 1
                  i32.load offset=28
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 1
                i32.load offset=28
                local.tee 5
                local.get 5
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
              i32.load8_u offset=25
              local.set 1
            end
            br 2 (;@2;)
          end
          i32.const 1
          local.get 5
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 1
        i64.load32_u offset=32
        local.set 8
      end
      local.get 4
      local.get 8
      i64.store offset=96
      local.get 4
      local.get 5
      i32.store offset=92
      local.get 4
      local.get 1
      i32.store8 offset=89
      local.get 4
      local.get 6
      i32.store8 offset=88
      local.get 4
      i32.const 0
      i32.store16 offset=144
      local.get 4
      i32.const 1066082
      i32.store offset=140
      local.get 4
      i32.const 1066081
      i32.store offset=136
      local.get 4
      i32.const 216
      i32.add
      local.get 4
      i32.const 136
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=216
                  local.tee 1
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  i32.load offset=224
                  local.set 1
                  local.get 4
                  i32.load offset=220
                  local.set 5
                  local.get 4
                  i32.const 0
                  i32.store16 offset=144
                  local.get 4
                  i32.const 1066830
                  i32.store offset=140
                  local.get 4
                  i32.const 1066829
                  i32.store offset=136
                  local.get 4
                  i32.const 216
                  i32.add
                  local.get 4
                  i32.const 136
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 4
                  i32.load8_u offset=216
                  local.tee 6
                  i32.const 255
                  i32.ne
                  br_if 1 (;@6;)
                  local.get 4
                  i64.load offset=220 align=4
                  local.set 8
                  local.get 4
                  i32.const 0
                  i32.store8 offset=136
                  local.get 4
                  local.get 8
                  i64.store offset=244 align=4
                  local.get 4
                  i32.const 3
                  i32.store8 offset=240
                  local.get 4
                  local.get 1
                  i32.store offset=232
                  local.get 4
                  local.get 5
                  i32.store offset=228
                  local.get 4
                  i32.const 3
                  i32.store8 offset=224
                  local.get 4
                  i64.const 8589934592
                  i64.store offset=216
                  local.get 4
                  local.get 4
                  i32.const 136
                  i32.add
                  i32.store offset=256
                  local.get 4
                  i32.const 8
                  i32.add
                  local.get 4
                  i32.const 216
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                  local.get 4
                  local.get 4
                  i32.load offset=12
                  local.tee 5
                  i32.store offset=172
                  local.get 4
                  local.get 4
                  i32.load offset=8
                  local.tee 1
                  i32.store offset=168
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=136
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 1
                    local.get 1
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 2
                    i32.store
                    local.get 2
                    br_if 6 (;@2;)
                    local.get 4
                    i32.const 168
                    i32.add
                    call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                    br 6 (;@2;)
                  end
                  local.get 1
                  i32.eqz
                  br_if 5 (;@2;)
                  local.get 4
                  local.get 5
                  i32.store offset=208
                  local.get 4
                  local.get 1
                  i32.store offset=204
                  local.get 4
                  i32.const 6
                  i32.store8 offset=200
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 4
                  local.get 2
                  i32.store offset=172
                  local.get 4
                  i32.const 6
                  i32.store8 offset=168
                  local.get 4
                  local.get 3
                  i64.extend_i32_u
                  i64.store offset=176
                  local.get 4
                  i64.const 0
                  i64.store offset=224
                  local.get 4
                  i32.const 2
                  i32.store8 offset=216
                  local.get 4
                  i32.const 136
                  i32.add
                  local.get 4
                  i32.const 168
                  i32.add
                  local.get 4
                  i32.const 216
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=136
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=152
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=144
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      local.get 4
                      i32.const 200
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=160
                    i64.store offset=240
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=232
                    local.get 4
                    local.get 4
                    i64.load offset=144
                    i64.store offset=224
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    i64.store offset=216
                    local.get 4
                    i32.const 168
                    i32.add
                    local.get 4
                    i32.const 216
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=168
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=176
                        i64.store offset=112
                        local.get 4
                        local.get 4
                        i64.load offset=168
                        i64.store offset=104
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=104
                    end
                    local.get 4
                    i32.const 216
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 232
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 216
                    i32.add
                    local.get 4
                    i32.const 104
                    i32.add
                    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                    local.get 4
                    f64.load offset=232
                    local.set 10
                    local.get 4
                    i32.load offset=228
                    local.set 1
                    local.get 4
                    i32.load offset=224
                    local.set 3
                    block ;; label = @9
                      local.get 4
                      i32.load offset=216
                      br_if 0 (;@9;)
                      block ;; label = @10
                        local.get 3
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 10
                        f64.store offset=220 align=4
                        local.get 4
                        local.get 1
                        i32.store offset=216
                        local.get 4
                        i32.const 216
                        i32.add
                        call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                        local.set 10
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 3
                        i32.store
                        local.get 3
                        br_if 0 (;@10;)
                        local.get 4
                        i32.const 216
                        i32.add
                        call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                      end
                      local.get 4
                      local.get 10
                      f64.store offset=128
                      local.get 4
                      i32.const 2
                      i32.store offset=120
                      local.get 4
                      i32.const 168
                      i32.add
                      local.get 4
                      i32.const 200
                      i32.add
                      local.get 4
                      i32.const 120
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=168
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=184
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=176
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=192
                      i64.store offset=240
                      local.get 4
                      local.get 4
                      i64.load offset=184
                      i64.store offset=232
                      local.get 4
                      local.get 4
                      i64.load offset=176
                      i64.store offset=224
                      local.get 4
                      local.get 4
                      i64.load offset=168
                      i64.store offset=216
                      local.get 4
                      i32.const 200
                      i32.add
                      local.get 4
                      i32.const 216
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      i32.const 1
                      local.set 1
                      i32.const 0
                      local.set 3
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=200
                        local.tee 5
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=202 align=2
                        i64.store offset=72
                        local.get 4
                        local.get 4
                        i64.load offset=208 align=2
                        i64.store offset=78 align=2
                        local.get 4
                        i32.load8_u offset=201
                        local.set 1
                        local.get 5
                        local.set 3
                      end
                      local.get 4
                      i32.const 216
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 232
                      i32.add
                      call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      local.get 4
                      i64.load offset=96
                      i64.store offset=232
                      local.get 4
                      local.get 4
                      i64.load offset=88
                      i64.store offset=224
                      local.get 4
                      i32.const 0
                      i32.store8 offset=88
                      local.get 4
                      local.get 1
                      i32.store8 offset=241
                      local.get 4
                      local.get 3
                      i32.store8 offset=240
                      local.get 4
                      i64.const 8589934592
                      i64.store offset=216
                      local.get 4
                      local.get 4
                      i64.load offset=72
                      i64.store offset=242 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=78 align=2
                      i64.store offset=248 align=2
                      local.get 4
                      local.get 4
                      i32.const 88
                      i32.add
                      i32.store offset=256
                      local.get 4
                      local.get 4
                      i32.const 216
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=4
                      local.tee 3
                      i32.store offset=204
                      local.get 4
                      local.get 4
                      i32.load
                      local.tee 1
                      i32.store offset=200
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=88
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 1
                        local.get 1
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 2
                        i32.store
                        local.get 2
                        br_if 7 (;@3;)
                        local.get 4
                        i32.const 200
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 7 (;@3;)
                      end
                      local.get 1
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 4
                      local.get 3
                      i32.store offset=64
                      local.get 4
                      local.get 1
                      i32.store offset=60
                      local.get 4
                      i32.const 6
                      i32.store8 offset=56
                      local.get 0
                      local.get 4
                      i32.const 40
                      i32.add
                      local.get 4
                      i32.const 56
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                      local.get 4
                      i32.const 24
                      i32.add
                      call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                      local.get 2
                      local.get 2
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 1
                      i32.store
                      local.get 1
                      br_if 5 (;@4;)
                      br 4 (;@5;)
                    end
                    local.get 0
                    local.get 10
                    f64.store offset=16
                    local.get 0
                    local.get 1
                    i32.store offset=12
                    local.get 0
                    local.get 3
                    i32.store offset=8
                    local.get 0
                    i64.const 1
                    i64.store
                    local.get 4
                    i32.const 200
                    i32.add
                    call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 88
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 40
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 24
                  i32.add
                  call $"#func685 core::ptr::drop_glue::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>"
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  i32.eqz
                  br_if 2 (;@5;)
                  br 3 (;@4;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=219
                i32.store8 offset=171
                local.get 4
                local.get 4
                i32.load16_u offset=217 align=1
                i32.store16 offset=169 align=1
                local.get 4
                local.get 4
                i32.load offset=228
                i32.store offset=180
                local.get 4
                local.get 4
                i64.load offset=220 align=4
                i64.store offset=172 align=4
                local.get 4
                local.get 1
                i32.store8 offset=168
                i32.const 1055372
                i32.const 43
                local.get 4
                i32.const 168
                i32.add
                i32.const 1055356
                i32.const 1055416
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 4
              local.get 4
              i32.load8_u offset=219
              i32.store8 offset=171
              local.get 4
              local.get 4
              i32.load16_u offset=217 align=1
              i32.store16 offset=169 align=1
              local.get 4
              local.get 4
              i32.load offset=228
              i32.store offset=180
              local.get 4
              local.get 4
              i64.load offset=220 align=4
              i64.store offset=172 align=4
              local.get 4
              local.get 6
              i32.store8 offset=168
              i32.const 1055372
              i32.const 43
              local.get 4
              i32.const 168
              i32.add
              i32.const 1055356
              i32.const 1055416
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 272
          i32.add
          global.set $__stack_pointer
          return
        end
        i32.const 1053928
        i32.const 43
        local.get 4
        i32.const 271
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 4
      i32.const 271
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
