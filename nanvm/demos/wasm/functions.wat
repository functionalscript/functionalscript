  (func $nanvm_demos::samples::functions::module::<nanvm_lib::naive::Naive> (;312;) (type 1) (param i32 i32)
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
    i32.const 1060023
    i32.store offset=24
    local.get 2
    i32.const 1060016
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
          i32.const 59
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1060023
          i32.const 29
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
          call $"#func308 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::functions::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;313;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 256
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 2
                i32.load
                local.tee 5
                i32.const -1
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 3
                i32.store offset=24
                local.get 4
                local.get 2
                i32.store offset=20
                local.get 4
                i32.const 6
                i32.store8 offset=16
                local.get 2
                local.get 5
                i32.const 2
                i32.add
                local.tee 5
                i32.store
                local.get 5
                i32.eqz
                br_if 0 (;@6;)
                local.get 4
                local.get 2
                i32.store offset=188
                local.get 4
                i32.const 6
                i32.store8 offset=184
                local.get 4
                local.get 3
                i64.extend_i32_u
                i64.store offset=192
                local.get 4
                i32.const 0
                i32.store16 offset=128
                local.get 4
                i32.const 1060418
                i32.store offset=124
                local.get 4
                i32.const 1060412
                i32.store offset=120
                local.get 4
                i32.const 200
                i32.add
                local.get 4
                i32.const 120
                i32.add
                call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=200
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=204 align=4
                  i64.store offset=156 align=4
                  local.get 4
                  i32.const 3
                  i32.store8 offset=152
                  local.get 4
                  i32.const 120
                  i32.add
                  local.get 4
                  i32.const 184
                  i32.add
                  local.get 4
                  i32.const 152
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
                    br 5 (;@3;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=144
                  i64.store offset=224
                  local.get 4
                  local.get 4
                  i64.load offset=136
                  i64.store offset=216
                  local.get 4
                  local.get 4
                  i64.load offset=128
                  i64.store offset=208
                  local.get 4
                  local.get 4
                  i64.load offset=120
                  i64.store offset=200
                  local.get 4
                  i32.const 152
                  i32.add
                  local.get 4
                  i32.const 200
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=152
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=160
                      i64.store offset=72
                      local.get 4
                      local.get 4
                      i64.load offset=152
                      i64.store offset=64
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=64
                  end
                  local.get 4
                  i32.const 200
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 216
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 4
                                  i32.load8_u offset=16
                                  local.tee 5
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=24
                                local.set 6
                                br 10 (;@4;)
                              end
                              local.get 4
                              i32.load offset=20
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              i32.eqz
                              br_if 7 (;@6;)
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=20
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 6 (;@6;)
                            local.get 4
                            i64.load8_u offset=28
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=24
                            i64.or
                            local.set 6
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=20
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 7
                          i32.store
                          local.get 7
                          br_if 6 (;@5;)
                          br 5 (;@6;)
                        end
                        local.get 4
                        i32.load offset=20
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        br_if 5 (;@5;)
                        br 4 (;@6;)
                      end
                      local.get 4
                      i32.load offset=20
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 3 (;@6;)
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=17
                    local.set 7
                  end
                  br 3 (;@4;)
                end
                local.get 4
                local.get 4
                i32.load8_u offset=203
                i32.store8 offset=155
                local.get 4
                local.get 4
                i32.load16_u offset=201 align=1
                i32.store16 offset=153 align=1
                local.get 4
                local.get 4
                i32.load offset=212
                i32.store offset=164
                local.get 4
                local.get 4
                i64.load offset=204 align=4
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
              unreachable
            end
            local.get 4
            i64.load32_u offset=24
            local.set 6
          end
          local.get 4
          local.get 6
          i64.store offset=192
          local.get 4
          local.get 3
          i32.store offset=188
          local.get 4
          local.get 7
          i32.store8 offset=185
          local.get 4
          local.get 5
          i32.store8 offset=184
          local.get 4
          i64.const 0
          i64.store offset=208
          local.get 4
          i32.const 2
          i32.store8 offset=200
          local.get 4
          i32.const 152
          i32.add
          local.get 4
          i32.const 184
          i32.add
          local.get 4
          i32.const 200
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=152
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 4
              i32.const 160
              i32.add
              local.set 3
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=176
            i64.store offset=224
            local.get 4
            local.get 4
            i64.load offset=168
            i64.store offset=216
            local.get 4
            local.get 4
            i64.load offset=160
            i64.store offset=208
            local.get 4
            local.get 4
            i64.load offset=152
            i64.store offset=200
            local.get 4
            i32.const 184
            i32.add
            local.get 4
            i32.const 200
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
                i64.store offset=112
                local.get 4
                local.get 4
                i64.load offset=184
                i64.store offset=104
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=104
            end
            local.get 4
            i32.const 88
            i32.add
            local.set 3
            local.get 4
            i32.const 200
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 216
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i64.const 4621819117588971520
            i64.store offset=208
            local.get 4
            i32.const 2
            i32.store8 offset=200
            local.get 4
            i32.const 80
            i32.add
            local.get 4
            i32.const 104
            i32.add
            local.get 4
            i32.const 200
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
            local.get 4
            i32.load offset=80
            br_if 0 (;@4;)
            local.get 4
            local.get 4
            i64.load offset=64
            local.tee 6
            i64.store offset=32
            local.get 4
            local.get 4
            i64.load offset=72
            local.tee 8
            i64.store offset=40
            local.get 4
            local.get 3
            i64.load offset=8
            local.tee 9
            i64.store offset=56
            local.get 4
            local.get 3
            i64.load
            local.tee 10
            i64.store offset=48
            local.get 4
            i32.const 0
            i32.store8 offset=64
            local.get 4
            i64.const 8589934592
            i64.store offset=200
            local.get 4
            local.get 6
            i64.store offset=208
            local.get 4
            local.get 8
            i64.store offset=216
            local.get 4
            local.get 10
            i64.store offset=224
            local.get 4
            local.get 9
            i64.store offset=232
            local.get 4
            local.get 4
            i32.const 64
            i32.add
            i32.store offset=240
            local.get 4
            local.get 4
            i32.const 200
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=4
            local.tee 5
            i32.store offset=188
            local.get 4
            local.get 4
            i32.load
            local.tee 3
            i32.store offset=184
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=64
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
                br_if 1 (;@5;)
                local.get 4
                i32.const 184
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 0 (;@5;)
              local.get 0
              local.get 5
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
              i32.const 16
              i32.add
              call $"#func308 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              local.get 2
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 4 (;@1;)
              br 3 (;@2;)
            end
            i32.const 1059464
            i32.const 43
            local.get 4
            i32.const 255
            i32.add
            i32.const 1059448
            i32.const 1059508
            call $core::result::unwrap_failed
            unreachable
          end
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
          local.get 4
          i32.const 64
          i32.add
          call $"#func308 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        end
        local.get 4
        i32.const 16
        i32.add
        call $"#func308 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 2
        local.get 2
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
      end
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 256
    i32.add
    global.set $__stack_pointer
  )
