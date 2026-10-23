  (func $nanvm_demos::samples::instanceof::module::<nanvm_lib::naive::Naive> (;640;) (type 1) (param i32 i32)
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
    i32.const 1064913
    i32.store offset=24
    local.get 2
    i32.const 1064906
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
          i32.const 206
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1064913
          i32.const 56
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
          call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::instanceof::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;641;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 f64)
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
    local.tee 5
    i32.const 1
    i32.add
    local.tee 6
    i32.store
    block ;; label = @1
      block ;; label = @2
        local.get 6
        i32.eqz
        br_if 0 (;@2;)
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
        local.tee 6
        i32.store
        local.get 6
        i32.eqz
        br_if 0 (;@2;)
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
        i64.const 0
        i64.store offset=224
        local.get 4
        i32.const 2
        i32.store8 offset=216
        local.get 4
        i32.const 88
        i32.add
        local.get 4
        i32.const 184
        i32.add
        local.get 4
        i32.const 216
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=88
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
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
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=112
                i64.store offset=240
                local.get 4
                local.get 4
                i64.load offset=104
                i64.store offset=232
                local.get 4
                local.get 4
                i64.load offset=96
                i64.store offset=224
                local.get 4
                local.get 4
                i64.load offset=88
                i64.store offset=216
                local.get 4
                i32.const 184
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                i32.const 1
                local.set 3
                i32.const 0
                local.set 6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=184
                  local.tee 5
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=186 align=2
                  i64.store offset=120
                  local.get 4
                  local.get 4
                  i64.load offset=192 align=2
                  i64.store offset=126 align=2
                  local.get 4
                  i32.load8_u offset=185
                  local.set 3
                  local.get 5
                  local.set 6
                end
                local.get 4
                i32.const 216
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 232
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 0
                i32.store8 offset=56
                local.get 4
                local.get 3
                i32.store8 offset=225
                local.get 4
                local.get 6
                i32.store8 offset=224
                local.get 4
                i64.const 4294967296
                i64.store offset=216
                local.get 4
                local.get 4
                i64.load offset=120
                i64.store offset=226 align=2
                local.get 4
                local.get 4
                i64.load offset=126 align=2
                i64.store offset=232 align=2
                local.get 4
                local.get 4
                i32.const 56
                i32.add
                i32.store offset=240
                local.get 4
                i32.const 8
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                local.get 4
                local.get 4
                i32.load offset=12
                local.tee 6
                i32.store offset=188
                local.get 4
                local.get 4
                i32.load offset=8
                local.tee 3
                i32.store offset=184
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=56
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 2
                  i32.store
                  local.get 2
                  br_if 6 (;@1;)
                  local.get 4
                  i32.const 184
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 6 (;@1;)
                end
                local.get 3
                i32.eqz
                br_if 5 (;@1;)
                local.get 4
                local.get 6
                i32.store offset=160
                local.get 4
                local.get 3
                i32.store offset=156
                local.get 4
                i32.const 6
                i32.store8 offset=152
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=24
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=32
                                  local.set 7
                                  br 8 (;@7;)
                                end
                                local.get 4
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
                                br_if 12 (;@2;)
                                br 6 (;@8;)
                              end
                              local.get 4
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
                              br_if 11 (;@2;)
                              local.get 4
                              i64.load8_u offset=36
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=32
                              i64.or
                              local.set 7
                              br 6 (;@7;)
                            end
                            local.get 4
                            i32.load offset=28
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            br_if 4 (;@8;)
                            br 10 (;@2;)
                          end
                          local.get 4
                          i32.load offset=28
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          br_if 3 (;@8;)
                          br 9 (;@2;)
                        end
                        local.get 4
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
                        br_if 8 (;@2;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=25
                      local.set 5
                    end
                    br 1 (;@7;)
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
                local.get 5
                i32.store8 offset=185
                local.get 4
                local.get 6
                i32.store8 offset=184
                local.get 4
                i64.const 0
                i64.store offset=224
                local.get 4
                i32.const 2
                i32.store8 offset=216
                local.get 4
                i32.const 120
                i32.add
                local.get 4
                i32.const 184
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=120
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
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
                  local.get 4
                  i32.const 152
                  i32.add
                  call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=144
                i64.store offset=240
                local.get 4
                local.get 4
                i64.load offset=136
                i64.store offset=232
                local.get 4
                local.get 4
                i64.load offset=128
                i64.store offset=224
                local.get 4
                local.get 4
                i64.load offset=120
                i64.store offset=216
                local.get 4
                i32.const 184
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                i32.const 1
                local.set 3
                i32.const 0
                local.set 6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=184
                  local.tee 5
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=186 align=2
                  i64.store offset=72
                  local.get 4
                  local.get 4
                  i64.load offset=192 align=2
                  i64.store offset=78 align=2
                  local.get 4
                  i32.load8_u offset=185
                  local.set 3
                  local.get 5
                  local.set 6
                end
                local.get 4
                i32.const 216
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 232
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                local.get 4
                i64.load offset=160
                i64.store offset=232
                local.get 4
                local.get 4
                i64.load offset=152
                i64.store offset=224
                local.get 4
                i32.const 0
                i32.store8 offset=152
                local.get 4
                local.get 3
                i32.store8 offset=241
                local.get 4
                local.get 6
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
                i32.const 152
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
                local.tee 6
                i32.store offset=188
                local.get 4
                local.get 4
                i32.load
                local.tee 3
                i32.store offset=184
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=152
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 2
                  i32.store
                  local.get 2
                  br_if 4 (;@3;)
                  local.get 4
                  i32.const 184
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                  br 4 (;@3;)
                end
                local.get 3
                i32.eqz
                br_if 3 (;@3;)
                local.get 4
                local.get 6
                i32.store offset=272
                local.get 4
                local.get 3
                i32.store offset=268
                local.get 4
                i32.const 6
                i32.store8 offset=264
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=24
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=32
                                  local.set 7
                                  br 8 (;@7;)
                                end
                                local.get 4
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
                                br_if 12 (;@2;)
                                br 6 (;@8;)
                              end
                              local.get 4
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
                              br_if 11 (;@2;)
                              local.get 4
                              i64.load8_u offset=36
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=32
                              i64.or
                              local.set 7
                              br 6 (;@7;)
                            end
                            local.get 4
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
                            br_if 10 (;@2;)
                            br 4 (;@8;)
                          end
                          local.get 4
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
                          br_if 9 (;@2;)
                          br 3 (;@8;)
                        end
                        local.get 4
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
                        br_if 8 (;@2;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=25
                      local.set 5
                    end
                    br 1 (;@7;)
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
                local.get 5
                i32.store8 offset=185
                local.get 4
                local.get 6
                i32.store8 offset=184
                local.get 4
                i64.const 0
                i64.store offset=224
                local.get 4
                i32.const 2
                i32.store8 offset=216
                local.get 4
                i32.const 152
                i32.add
                local.get 4
                i32.const 184
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=152
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
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
                  i32.const 264
                  i32.add
                  call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=176
                i64.store offset=240
                local.get 4
                local.get 4
                i64.load offset=168
                i64.store offset=232
                local.get 4
                local.get 4
                i64.load offset=160
                i64.store offset=224
                local.get 4
                local.get 4
                i64.load offset=152
                i64.store offset=216
                local.get 4
                i32.const 184
                i32.add
                local.get 4
                i32.const 216
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=184
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=192
                    i64.store offset=48
                    local.get 4
                    local.get 4
                    i64.load offset=184
                    i64.store offset=40
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=40
                end
                local.get 4
                i32.const 216
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 232
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 216
                i32.add
                local.get 4
                i32.const 40
                i32.add
                call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                local.get 4
                f64.load offset=232
                local.set 8
                local.get 4
                i32.load offset=228
                local.set 3
                local.get 4
                i32.load offset=224
                local.set 6
                block ;; label = @7
                  local.get 4
                  i32.load offset=216
                  br_if 0 (;@7;)
                  block ;; label = @8
                    local.get 6
                    i32.const 1
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 8
                    f64.store offset=220 align=4
                    local.get 4
                    local.get 3
                    i32.store offset=216
                    local.get 4
                    i32.const 216
                    i32.add
                    call $<nanvm_lib::vm::bigint::BigInt<nanvm_lib::naive::Naive>>::to_number
                    local.set 8
                    local.get 3
                    local.get 3
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 216
                    i32.add
                    call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                  end
                  local.get 4
                  local.get 8
                  f64.store offset=64
                  local.get 4
                  i32.const 2
                  i32.store offset=56
                  local.get 4
                  i32.const 184
                  i32.add
                  local.get 4
                  i32.const 264
                  i32.add
                  local.get 4
                  i32.const 56
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=184
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
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
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=208
                  i64.store offset=240
                  local.get 4
                  local.get 4
                  i64.load offset=200
                  i64.store offset=232
                  local.get 4
                  local.get 4
                  i64.load offset=192
                  i64.store offset=224
                  local.get 4
                  local.get 4
                  i64.load offset=184
                  i64.store offset=216
                  local.get 4
                  i32.const 264
                  i32.add
                  local.get 4
                  i32.const 216
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=264
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=272
                      i64.store offset=80
                      local.get 4
                      local.get 4
                      i64.load offset=264
                      i64.store offset=72
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=72
                  end
                  local.get 4
                  i32.const 216
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 232
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 0
                  local.get 4
                  i32.const 72
                  i32.add
                  call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::any::instanceof_::InstanceOfArray>
                  i32.store8 offset=9
                  local.get 0
                  i32.const 1
                  i32.store8 offset=8
                  local.get 0
                  i64.const 0
                  i64.store
                  local.get 4
                  i32.const 24
                  i32.add
                  call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 0
                  i32.store
                  local.get 0
                  br_if 3 (;@4;)
                  br 2 (;@5;)
                end
                local.get 0
                local.get 8
                f64.store offset=16
                local.get 0
                local.get 3
                i32.store offset=12
                local.get 0
                local.get 6
                i32.store offset=8
                local.get 0
                i64.const 1
                i64.store
                local.get 4
                i32.const 264
                i32.add
                call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 24
              i32.add
              call $"#func634 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
      end
      unreachable
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
