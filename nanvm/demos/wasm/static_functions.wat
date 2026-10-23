  (func $nanvm_demos::samples::static_functions::module::<nanvm_lib::naive::Naive> (;190;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i64 i32 i32 i32 i64 i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 88
    i32.add
    local.get 1
    i32.const 1055196
    i32.const 9
    call $nanvm_lib::vm::unstable::static_read::<nanvm_lib::naive::Naive>
    local.get 2
    local.get 2
    i64.load offset=96
    i64.store offset=72
    local.get 2
    local.get 2
    i64.load offset=104
    i64.store offset=80
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i64.load offset=88
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 2
              i64.load offset=80
              i64.store offset=16
              local.get 0
              local.get 2
              i64.load offset=72
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              br 1 (;@4;)
            end
            local.get 2
            local.get 2
            i64.load offset=80
            i64.store offset=32
            local.get 2
            local.get 2
            i64.load offset=72
            i64.store offset=24
            local.get 2
            i32.const 88
            i32.add
            local.get 1
            i32.const 1055205
            i32.const 16
            call $nanvm_lib::vm::unstable::static_read::<nanvm_lib::naive::Naive>
            local.get 2
            local.get 2
            i64.load offset=96
            i64.store offset=72
            local.get 2
            local.get 2
            i64.load offset=104
            i64.store offset=80
            block ;; label = @5
              local.get 2
              i64.load offset=88
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 2
              i64.load offset=80
              i64.store offset=16
              local.get 0
              local.get 2
              i64.load offset=72
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 2
              i32.const 24
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 2
            local.get 2
            i64.load offset=80
            i64.store offset=48
            local.get 2
            local.get 2
            i64.load offset=72
            i64.store offset=40
            local.get 2
            i32.const 0
            i32.store16 offset=68
            local.get 2
            i32.const 1054903
            i32.store offset=64
            local.get 2
            i32.const 1054896
            i32.store offset=60
            local.get 2
            i32.const 88
            i32.add
            local.get 2
            i32.const 60
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=88
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 2
                  i32.load offset=96
                  local.set 4
                  local.get 2
                  i32.load offset=92
                  local.set 5
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 2
                                  i32.load8_u offset=24
                                  local.tee 6
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 2
                                i64.load offset=32
                                local.set 7
                                br 9 (;@5;)
                              end
                              local.get 2
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
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 2
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
                            br_if 11 (;@1;)
                            local.get 2
                            i64.load8_u offset=36
                            i64.const 32
                            i64.shl
                            local.get 2
                            i64.load32_u offset=32
                            i64.or
                            local.set 7
                            br 7 (;@5;)
                          end
                          local.get 2
                          i32.load offset=28
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 8
                          i32.store
                          local.get 8
                          br_if 5 (;@6;)
                          br 10 (;@1;)
                        end
                        local.get 2
                        i32.load offset=28
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        br_if 4 (;@6;)
                        br 9 (;@1;)
                      end
                      local.get 2
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
                      br 1 (;@8;)
                    end
                    local.get 2
                    i32.load8_u offset=25
                    local.set 9
                  end
                  br 2 (;@5;)
                end
                local.get 2
                local.get 2
                i32.load8_u offset=91
                i32.store8 offset=75
                local.get 2
                local.get 2
                i32.load16_u offset=89 align=1
                i32.store16 offset=73 align=1
                local.get 2
                local.get 2
                i32.load offset=100
                i32.store offset=84
                local.get 2
                local.get 2
                i64.load offset=92 align=4
                i64.store offset=76 align=4
                local.get 2
                local.get 3
                i32.store8 offset=72
                i32.const 1063112
                i32.const 43
                local.get 2
                i32.const 72
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 2
              i64.load32_u offset=32
              local.set 7
            end
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 2
                                i32.load8_u offset=40
                                local.tee 10
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 2
                              i64.load offset=48
                              local.set 11
                              br 8 (;@5;)
                            end
                            local.get 2
                            i32.load offset=44
                            local.tee 8
                            local.get 8
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 12
                            i32.store
                            local.get 12
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 2
                          i32.load offset=44
                          local.tee 8
                          local.get 8
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 12
                          i32.store
                          local.get 12
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 2
                          i64.load8_u offset=52
                          i64.const 32
                          i64.shl
                          local.get 2
                          i64.load32_u offset=48
                          i64.or
                          local.set 11
                          br 6 (;@5;)
                        end
                        local.get 2
                        i32.load offset=44
                        local.tee 8
                        local.get 8
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 12
                        i32.store
                        local.get 12
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 2
                      i32.load offset=44
                      local.tee 8
                      local.get 8
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 12
                      i32.store
                      local.get 12
                      i32.eqz
                      br_if 8 (;@1;)
                      br 3 (;@6;)
                    end
                    local.get 2
                    i32.load offset=44
                    local.tee 8
                    local.get 8
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 12
                    i32.store
                    local.get 12
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 2
                  i32.load8_u offset=41
                  local.set 13
                end
                br 1 (;@5;)
              end
              local.get 2
              i64.load32_u offset=48
              local.set 11
            end
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 1
                                i32.load8_u
                                local.tee 14
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 1
                              i64.load offset=8
                              local.set 15
                              br 8 (;@5;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 12
                            local.get 12
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 16
                            i32.store
                            local.get 16
                            i32.eqz
                            br_if 11 (;@1;)
                            br 6 (;@6;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 12
                          local.get 12
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 16
                          i32.store
                          local.get 16
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 1
                          i64.load8_u offset=12
                          i64.const 32
                          i64.shl
                          local.get 1
                          i64.load32_u offset=8
                          i64.or
                          local.set 15
                          br 6 (;@5;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 12
                        local.get 12
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 16
                        i32.store
                        local.get 16
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 12
                      local.get 12
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 16
                      i32.store
                      local.get 16
                      i32.eqz
                      br_if 8 (;@1;)
                      br 3 (;@6;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 12
                    local.get 12
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 16
                    i32.store
                    local.get 16
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 1
                  i32.load8_u offset=1
                  local.set 16
                end
                br 1 (;@5;)
              end
              local.get 1
              i64.load32_u offset=8
              local.set 15
            end
            local.get 2
            i32.const 0
            i32.store8 offset=60
            local.get 2
            local.get 15
            i64.store offset=136
            local.get 2
            local.get 12
            i32.store offset=132
            local.get 2
            local.get 16
            i32.store8 offset=129
            local.get 2
            local.get 14
            i32.store8 offset=128
            local.get 2
            local.get 11
            i64.store offset=120
            local.get 2
            local.get 8
            i32.store offset=116
            local.get 2
            local.get 13
            i32.store8 offset=113
            local.get 2
            local.get 10
            i32.store8 offset=112
            local.get 2
            local.get 7
            i64.store offset=104
            local.get 2
            local.get 3
            i32.store offset=100
            local.get 2
            local.get 9
            i32.store8 offset=97
            local.get 2
            local.get 6
            i32.store8 offset=96
            local.get 2
            i64.const 12884901888
            i64.store offset=88
            local.get 2
            local.get 2
            i32.const 60
            i32.add
            i32.store offset=144
            local.get 2
            i32.const 16
            i32.add
            local.get 2
            i32.const 88
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=20
            local.tee 8
            i32.store offset=76
            local.get 2
            local.get 2
            i32.load offset=16
            local.tee 3
            i32.store offset=72
            block ;; label = @5
              local.get 2
              i32.load8_u offset=60
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 3 (;@2;)
              local.get 2
              i32.const 72
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 3 (;@2;)
            end
            local.get 3
            i32.eqz
            br_if 2 (;@2;)
            i32.const 10
            i32.const 0
            local.get 3
            local.get 8
            i32.const 1055221
            i32.const 126
            call $<nanvm_lib::naive::function::Function>::new
            local.set 3
            local.get 2
            i32.const 0
            i32.store8 offset=60
            local.get 2
            local.get 3
            i32.store offset=108
            local.get 2
            i32.const 7
            i32.store8 offset=104
            local.get 2
            local.get 4
            i32.store offset=100
            local.get 2
            local.get 5
            i32.store offset=96
            local.get 2
            i64.const 4294967296
            i64.store offset=88
            local.get 2
            local.get 2
            i32.const 60
            i32.add
            i32.store offset=120
            local.get 2
            i32.const 8
            i32.add
            local.get 2
            i32.const 88
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=12
            local.tee 8
            i32.store offset=76
            local.get 2
            local.get 2
            i32.load offset=8
            local.tee 3
            i32.store offset=72
            block ;; label = @5
              local.get 2
              i32.load8_u offset=60
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 2 (;@3;)
              local.get 2
              i32.const 72
              i32.add
              call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
              br 2 (;@3;)
            end
            local.get 3
            i32.eqz
            br_if 1 (;@3;)
            local.get 0
            local.get 8
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
            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            i32.const 24
            i32.add
            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          end
          local.get 1
          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 2
          i32.const 160
          i32.add
          global.set $__stack_pointer
          return
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
    unreachable
  )
  (func $"<nanvm_demos::samples::static_functions::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;191;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 640
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=68
    local.get 4
    local.get 2
    i32.store offset=64
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
      i32.store offset=80
      local.get 4
      local.get 2
      i32.store offset=76
      local.get 4
      i32.const 6
      i32.store8 offset=72
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
                          block ;; label = @12
                            block ;; label = @13
                              local.get 1
                              i32.load offset=16
                              local.tee 3
                              i32.const 2
                              i32.le_u
                              br_if 0 (;@13;)
                              local.get 4
                              i32.const 120
                              i32.add
                              local.get 1
                              i32.load offset=12
                              i32.const 40
                              i32.add
                              i32.const 1056395
                              i32.const 15
                              call $nanvm_lib::vm::unstable::static_read::<nanvm_lib::naive::Naive>
                              local.get 4
                              local.get 4
                              i64.load offset=128
                              i64.store offset=584
                              local.get 4
                              local.get 4
                              i64.load offset=136
                              i64.store offset=592
                              block ;; label = @14
                                local.get 4
                                i64.load offset=120
                                i64.const 1
                                i64.ne
                                br_if 0 (;@14;)
                                local.get 0
                                local.get 4
                                i64.load offset=592
                                i64.store offset=16
                                local.get 0
                                local.get 4
                                i64.load offset=584
                                i64.store offset=8
                                local.get 0
                                i64.const 1
                                i64.store
                                br 7 (;@7;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=592
                              i64.store offset=96
                              local.get 4
                              local.get 4
                              i64.load offset=584
                              i64.store offset=88
                              local.get 1
                              i32.load offset=16
                              local.tee 3
                              i32.const 2
                              i32.le_u
                              br_if 1 (;@12;)
                              local.get 4
                              i32.const 120
                              i32.add
                              local.get 1
                              i32.load offset=12
                              i32.const 40
                              i32.add
                              i32.const 1056410
                              i32.const 14
                              call $nanvm_lib::vm::unstable::static_read::<nanvm_lib::naive::Naive>
                              local.get 4
                              local.get 4
                              i64.load offset=128
                              i64.store offset=584
                              local.get 4
                              local.get 4
                              i64.load offset=136
                              i64.store offset=592
                              block ;; label = @14
                                local.get 4
                                i64.load offset=120
                                i64.const 1
                                i64.ne
                                br_if 0 (;@14;)
                                local.get 0
                                local.get 4
                                i64.load offset=592
                                i64.store offset=16
                                local.get 0
                                local.get 4
                                i64.load offset=584
                                i64.store offset=8
                                local.get 0
                                i64.const 1
                                i64.store
                                br 6 (;@8;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=592
                              i64.store offset=112
                              local.get 4
                              local.get 4
                              i64.load offset=584
                              i64.store offset=104
                              local.get 1
                              i32.load offset=16
                              i32.eqz
                              br_if 2 (;@11;)
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              local.get 1
                                              i32.load offset=12
                                              local.tee 3
                                              i32.load8_u offset=8
                                              local.tee 6
                                              br_table 6 (;@15;) 6 (;@15;) 0 (;@21;) 1 (;@20;) 2 (;@19;) 3 (;@18;) 4 (;@17;) 5 (;@16;) 6 (;@15;)
                                            end
                                            local.get 3
                                            i64.load offset=16
                                            local.set 7
                                            br 11 (;@9;)
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
                                          br_if 18 (;@1;)
                                          br 9 (;@10;)
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
                                        br_if 17 (;@1;)
                                        local.get 3
                                        i64.load8_u offset=20
                                        i64.const 32
                                        i64.shl
                                        local.get 3
                                        i64.load32_u offset=16
                                        i64.or
                                        local.set 7
                                        br 9 (;@9;)
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
                                      br_if 7 (;@10;)
                                      br 16 (;@1;)
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
                                    br_if 6 (;@10;)
                                    br 15 (;@1;)
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
                                  br_if 14 (;@1;)
                                  br 1 (;@14;)
                                end
                                local.get 3
                                i32.load8_u offset=9
                                local.set 3
                              end
                              br 4 (;@9;)
                            end
                            i32.const 2
                            local.get 3
                            i32.const 1065308
                            call $core::panicking::panic_bounds_check
                            unreachable
                          end
                          i32.const 2
                          local.get 3
                          i32.const 1065308
                          call $core::panicking::panic_bounds_check
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
                    i64.store offset=464
                    local.get 4
                    local.get 5
                    i32.store offset=460
                    local.get 4
                    local.get 3
                    i32.store8 offset=457
                    local.get 4
                    local.get 6
                    i32.store8 offset=456
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=72
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=80
                                      local.set 7
                                      br 8 (;@9;)
                                    end
                                    local.get 4
                                    i32.load offset=76
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
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=76
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
                                  i64.load8_u offset=84
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=80
                                  i64.or
                                  local.set 7
                                  br 6 (;@9;)
                                end
                                local.get 4
                                i32.load offset=76
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
                                br 4 (;@10;)
                              end
                              local.get 4
                              i32.load offset=76
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
                              br 3 (;@10;)
                            end
                            local.get 4
                            i32.load offset=76
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
                          i32.load8_u offset=73
                          local.set 6
                        end
                        br 1 (;@9;)
                      end
                      local.get 4
                      i64.load32_u offset=80
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=528
                    local.get 4
                    local.get 3
                    i32.store offset=524
                    local.get 4
                    local.get 6
                    i32.store8 offset=521
                    local.get 4
                    local.get 5
                    i32.store8 offset=520
                    local.get 4
                    i64.const 0
                    i64.store offset=592
                    local.get 4
                    i32.const 2
                    i32.store8 offset=584
                    local.get 4
                    i32.const 424
                    i32.add
                    local.get 4
                    i32.const 520
                    i32.add
                    local.get 4
                    i32.const 584
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=424
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=440
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=432
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 456
                        i32.add
                        call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=448
                      i64.store offset=608
                      local.get 4
                      local.get 4
                      i64.load offset=440
                      i64.store offset=600
                      local.get 4
                      local.get 4
                      i64.load offset=432
                      i64.store offset=592
                      local.get 4
                      local.get 4
                      i64.load offset=424
                      i64.store offset=584
                      local.get 4
                      i32.const 520
                      i32.add
                      local.get 4
                      i32.const 584
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      i32.const 1
                      local.set 3
                      i32.const 0
                      local.set 5
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=520
                        local.tee 6
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=522 align=2
                        i64.store offset=408
                        local.get 4
                        local.get 4
                        i64.load offset=528 align=2
                        i64.store offset=414 align=2
                        local.get 4
                        i32.load8_u offset=521
                        local.set 3
                        local.get 6
                        local.set 5
                      end
                      local.get 4
                      i32.const 584
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 600
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.const 0
                      i32.store8 offset=384
                      local.get 4
                      local.get 3
                      i32.store8 offset=593
                      local.get 4
                      local.get 5
                      i32.store8 offset=592
                      local.get 4
                      i64.const 8589934592
                      i64.store offset=584
                      local.get 4
                      local.get 4
                      i64.load offset=408
                      i64.store offset=594 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=414 align=2
                      i64.store offset=600 align=2
                      local.get 4
                      i64.const -9223372036854775808
                      i64.store offset=616
                      local.get 4
                      i32.const 2
                      i32.store8 offset=608
                      local.get 4
                      local.get 4
                      i32.const 384
                      i32.add
                      i32.store offset=624
                      local.get 4
                      i32.const 56
                      i32.add
                      local.get 4
                      i32.const 584
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=60
                      local.tee 5
                      i32.store offset=524
                      local.get 4
                      local.get 4
                      i32.load offset=56
                      local.tee 3
                      i32.store offset=520
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=384
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 3
                        local.get 3
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 2
                        i32.store
                        local.get 2
                        br_if 8 (;@2;)
                        local.get 4
                        i32.const 520
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 8 (;@2;)
                      end
                      local.get 3
                      i32.eqz
                      br_if 7 (;@2;)
                      local.get 4
                      local.get 5
                      i32.store offset=496
                      local.get 4
                      local.get 3
                      i32.store offset=492
                      local.get 4
                      i32.const 6
                      i32.store8 offset=488
                      local.get 4
                      i32.const 552
                      i32.add
                      local.get 4
                      i32.const 456
                      i32.add
                      local.get 4
                      i32.const 488
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                      local.get 4
                      local.get 4
                      i64.load offset=560
                      i64.store offset=200
                      local.get 4
                      local.get 4
                      i64.load offset=568
                      i64.store offset=208
                      block ;; label = @10
                        local.get 4
                        i64.load offset=552
                        i64.const 1
                        i64.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=208
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=200
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=208
                      i64.store offset=192
                      local.get 4
                      local.get 4
                      i64.load offset=200
                      i64.store offset=184
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            local.get 1
                            i32.load offset=16
                            local.tee 3
                            i32.const 1
                            i32.le_u
                            br_if 0 (;@12;)
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
                                            i32.load8_u offset=24
                                            local.tee 5
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 1
                                          i64.load offset=32
                                          local.set 7
                                          br 9 (;@10;)
                                        end
                                        local.get 1
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
                                        br_if 17 (;@1;)
                                        br 7 (;@11;)
                                      end
                                      local.get 1
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
                                      br_if 16 (;@1;)
                                      local.get 1
                                      i64.load8_u offset=36
                                      i64.const 32
                                      i64.shl
                                      local.get 1
                                      i64.load32_u offset=32
                                      i64.or
                                      local.set 7
                                      br 7 (;@10;)
                                    end
                                    local.get 1
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
                                    br_if 15 (;@1;)
                                    br 5 (;@11;)
                                  end
                                  local.get 1
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
                                  br 4 (;@11;)
                                end
                                local.get 1
                                i32.load offset=28
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
                                br 1 (;@13;)
                              end
                              local.get 1
                              i32.load8_u offset=25
                              local.set 1
                            end
                            br 2 (;@10;)
                          end
                          i32.const 1
                          local.get 3
                          i32.const 1065308
                          call $core::panicking::panic_bounds_check
                          unreachable
                        end
                        local.get 1
                        i64.load32_u offset=32
                        local.set 7
                      end
                      local.get 4
                      local.get 7
                      i64.store offset=416
                      local.get 4
                      local.get 3
                      i32.store offset=412
                      local.get 4
                      local.get 1
                      i32.store8 offset=409
                      local.get 4
                      local.get 5
                      i32.store8 offset=408
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 4
                                          i32.load8_u offset=72
                                          local.tee 3
                                          br_table 6 (;@13;) 6 (;@13;) 0 (;@19;) 1 (;@18;) 2 (;@17;) 3 (;@16;) 4 (;@15;) 5 (;@14;) 6 (;@13;)
                                        end
                                        local.get 4
                                        i64.load offset=80
                                        local.set 7
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=76
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 5
                                      i32.store
                                      local.get 5
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=76
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    local.get 4
                                    i64.load8_u offset=84
                                    i64.const 32
                                    i64.shl
                                    local.get 4
                                    i64.load32_u offset=80
                                    i64.or
                                    local.set 7
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=76
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 4 (;@11;)
                                end
                                local.get 4
                                i32.load offset=76
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 3 (;@11;)
                              end
                              local.get 4
                              i32.load offset=76
                              local.tee 1
                              local.get 1
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 12 (;@1;)
                              br 1 (;@12;)
                            end
                            local.get 4
                            i32.load8_u offset=73
                            local.set 5
                          end
                          br 1 (;@10;)
                        end
                        local.get 4
                        i64.load32_u offset=80
                        local.set 7
                      end
                      local.get 4
                      local.get 7
                      i64.store offset=528
                      local.get 4
                      local.get 1
                      i32.store offset=524
                      local.get 4
                      local.get 5
                      i32.store8 offset=521
                      local.get 4
                      local.get 3
                      i32.store8 offset=520
                      local.get 4
                      i64.const 0
                      i64.store offset=592
                      local.get 4
                      i32.const 2
                      i32.store8 offset=584
                      local.get 4
                      i32.const 456
                      i32.add
                      local.get 4
                      i32.const 520
                      i32.add
                      local.get 4
                      i32.const 584
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=456
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=472
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=464
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 408
                          i32.add
                          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=480
                        i64.store offset=608
                        local.get 4
                        local.get 4
                        i64.load offset=472
                        i64.store offset=600
                        local.get 4
                        local.get 4
                        i64.load offset=464
                        i64.store offset=592
                        local.get 4
                        local.get 4
                        i64.load offset=456
                        i64.store offset=584
                        local.get 4
                        i32.const 520
                        i32.add
                        local.get 4
                        i32.const 584
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        i32.const 1
                        local.set 1
                        i32.const 0
                        local.set 3
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=520
                          local.tee 5
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=522 align=2
                          i64.store offset=384
                          local.get 4
                          local.get 4
                          i64.load offset=528 align=2
                          i64.store offset=390 align=2
                          local.get 4
                          i32.load8_u offset=521
                          local.set 1
                          local.get 5
                          local.set 3
                        end
                        local.get 4
                        i32.const 584
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 600
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 0
                        i32.store8 offset=368
                        local.get 4
                        local.get 1
                        i32.store8 offset=593
                        local.get 4
                        local.get 3
                        i32.store8 offset=592
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=584
                        local.get 4
                        local.get 4
                        i64.load offset=384
                        i64.store offset=594 align=2
                        local.get 4
                        local.get 4
                        i64.load offset=390 align=2
                        i64.store offset=600 align=2
                        local.get 4
                        local.get 4
                        i32.const 368
                        i32.add
                        i32.store offset=608
                        local.get 4
                        i32.const 48
                        i32.add
                        local.get 4
                        i32.const 584
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=52
                        local.tee 3
                        i32.store offset=524
                        local.get 4
                        local.get 4
                        i32.load offset=48
                        local.tee 1
                        i32.store offset=520
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=368
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 2
                          i32.store
                          local.get 2
                          br_if 8 (;@3;)
                          local.get 4
                          i32.const 520
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 8 (;@3;)
                        end
                        local.get 1
                        i32.eqz
                        br_if 7 (;@3;)
                        local.get 4
                        local.get 3
                        i32.store offset=496
                        local.get 4
                        local.get 1
                        i32.store offset=492
                        local.get 4
                        i32.const 6
                        i32.store8 offset=488
                        local.get 4
                        i32.const 552
                        i32.add
                        local.get 4
                        i32.const 408
                        i32.add
                        local.get 4
                        i32.const 488
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        local.get 4
                        local.get 4
                        i64.load offset=560
                        i64.store offset=232
                        local.get 4
                        local.get 4
                        i64.load offset=568
                        i64.store offset=240
                        block ;; label = @11
                          local.get 4
                          i64.load offset=552
                          i64.const 1
                          i64.ne
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
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=240
                        i64.store offset=224
                        local.get 4
                        local.get 4
                        i64.load offset=232
                        i64.store offset=216
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            local.get 4
                                            i32.load8_u offset=88
                                            local.tee 3
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 4
                                          i64.load offset=96
                                          local.set 7
                                          br 8 (;@11;)
                                        end
                                        local.get 4
                                        i32.load offset=92
                                        local.tee 1
                                        local.get 1
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
                                      i32.load offset=92
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 5
                                      i32.store
                                      local.get 5
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      i64.load8_u offset=100
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=96
                                      i64.or
                                      local.set 7
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=92
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 4 (;@12;)
                                  end
                                  local.get 4
                                  i32.load offset=92
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 3 (;@12;)
                                end
                                local.get 4
                                i32.load offset=92
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.load8_u offset=89
                              local.set 5
                            end
                            br 1 (;@11;)
                          end
                          local.get 4
                          i64.load32_u offset=96
                          local.set 7
                        end
                        local.get 4
                        local.get 7
                        i64.store offset=392
                        local.get 4
                        local.get 1
                        i32.store offset=388
                        local.get 4
                        local.get 5
                        i32.store8 offset=385
                        local.get 4
                        local.get 3
                        i32.store8 offset=384
                        local.get 4
                        i64.const 4607182418800017408
                        i64.store offset=528
                        local.get 4
                        i32.const 2
                        i32.store8 offset=520
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            local.get 4
                                            i32.load8_u offset=72
                                            local.tee 3
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 4
                                          i64.load offset=80
                                          local.set 7
                                          br 8 (;@11;)
                                        end
                                        local.get 4
                                        i32.load offset=76
                                        local.tee 1
                                        local.get 1
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
                                      i32.load offset=76
                                      local.tee 1
                                      local.get 1
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 5
                                      i32.store
                                      local.get 5
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      i64.load8_u offset=84
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=80
                                      i64.or
                                      local.set 7
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=76
                                    local.tee 1
                                    local.get 1
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 5
                                    i32.store
                                    local.get 5
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 4 (;@12;)
                                  end
                                  local.get 4
                                  i32.load offset=76
                                  local.tee 1
                                  local.get 1
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 5
                                  i32.store
                                  local.get 5
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 3 (;@12;)
                                end
                                local.get 4
                                i32.load offset=76
                                local.tee 1
                                local.get 1
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 13 (;@1;)
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.load8_u offset=73
                              local.set 5
                            end
                            br 1 (;@11;)
                          end
                          local.get 4
                          i64.load32_u offset=80
                          local.set 7
                        end
                        local.get 4
                        local.get 7
                        i64.store offset=560
                        local.get 4
                        local.get 1
                        i32.store offset=556
                        local.get 4
                        local.get 5
                        i32.store8 offset=553
                        local.get 4
                        local.get 3
                        i32.store8 offset=552
                        local.get 4
                        i64.const 0
                        i64.store offset=592
                        local.get 4
                        i32.const 2
                        i32.store8 offset=584
                        local.get 4
                        i32.const 488
                        i32.add
                        local.get 4
                        i32.const 552
                        i32.add
                        local.get 4
                        i32.const 584
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=488
                            i32.const 255
                            i32.ne
                            br_if 0 (;@12;)
                            local.get 0
                            local.get 4
                            i64.load offset=504
                            i64.store offset=16
                            local.get 0
                            local.get 4
                            i64.load offset=496
                            i64.store offset=8
                            local.get 0
                            i64.const 1
                            i64.store
                            local.get 4
                            i32.const 520
                            i32.add
                            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            i32.const 384
                            i32.add
                            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 288
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 1
                          local.get 4
                          local.get 4
                          i64.load offset=512
                          i64.store offset=608
                          local.get 4
                          local.get 4
                          i64.load offset=504
                          i64.store offset=600
                          local.get 4
                          local.get 4
                          i64.load offset=496
                          i64.store offset=592
                          local.get 4
                          local.get 4
                          i64.load offset=488
                          i64.store offset=584
                          local.get 4
                          i32.const 312
                          i32.add
                          local.get 4
                          i32.const 584
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                          local.get 4
                          i32.const 288
                          i32.add
                          local.get 4
                          i32.const 520
                          i32.add
                          local.get 4
                          i32.const 312
                          i32.add
                          call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Div>::div>"
                          block ;; label = @12
                            local.get 4
                            i64.load offset=288
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
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
                            i32.const 384
                            i32.add
                            call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 264
                          i32.add
                          i32.const 8
                          i32.add
                          local.set 3
                          local.get 4
                          i32.const 40
                          i32.add
                          local.get 1
                          call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 1]>"
                          local.get 4
                          i32.const 6
                          i32.store8 offset=408
                          local.get 4
                          local.get 4
                          i64.load offset=40
                          i64.store offset=412 align=4
                          local.get 4
                          i32.const 264
                          i32.add
                          local.get 4
                          i32.const 384
                          i32.add
                          local.get 4
                          i32.const 408
                          i32.add
                          call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                          block ;; label = @12
                            local.get 4
                            i64.load offset=264
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
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
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 3
                          i64.load offset=8
                          i64.store offset=256
                          local.get 4
                          local.get 3
                          i64.load
                          i64.store offset=248
                          local.get 4
                          i32.const 352
                          i32.add
                          local.get 4
                          i32.const 104
                          i32.add
                          call $"<nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                          local.get 4
                          i32.const 32
                          i32.add
                          i32.const 1056424
                          i32.const 1
                          call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                          local.get 4
                          local.get 4
                          i32.load offset=36
                          local.tee 6
                          i32.store offset=404
                          local.get 4
                          local.get 4
                          i32.load offset=32
                          local.tee 1
                          i32.store offset=400
                          local.get 4
                          i32.const 408
                          i32.add
                          local.get 4
                          i32.const 72
                          i32.add
                          call $"<nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                          local.get 4
                          i64.const 0
                          i64.store offset=560
                          local.get 4
                          i32.const 2
                          i32.store8 offset=552
                          local.get 4
                          i32.const 520
                          i32.add
                          local.get 4
                          i32.const 408
                          i32.add
                          local.get 4
                          i32.const 552
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=520
                              i32.const 255
                              i32.ne
                              br_if 0 (;@13;)
                              local.get 0
                              local.get 4
                              i64.load offset=536
                              i64.store offset=16
                              local.get 0
                              local.get 4
                              i64.load offset=528
                              i64.store offset=8
                              local.get 0
                              i64.const 1
                              i64.store
                              local.get 1
                              local.get 1
                              i32.load
                              i32.const -1
                              i32.add
                              local.tee 0
                              i32.store
                              block ;; label = @14
                                local.get 0
                                br_if 0 (;@14;)
                                local.get 4
                                i32.const 400
                                i32.add
                                call $"<alloc::rc::Rc<[u16]>>::drop_slow"
                              end
                              local.get 4
                              i32.const 352
                              i32.add
                              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                              br 1 (;@12;)
                            end
                            local.get 4
                            i32.const 328
                            i32.add
                            i32.const 8
                            i32.add
                            local.set 5
                            local.get 4
                            local.get 4
                            i64.load offset=544
                            i64.store offset=576
                            local.get 4
                            local.get 4
                            i64.load offset=536
                            i64.store offset=568
                            local.get 4
                            local.get 4
                            i64.load offset=528
                            i64.store offset=560
                            local.get 4
                            local.get 4
                            i64.load offset=520
                            i64.store offset=552
                            local.get 4
                            i32.const 592
                            i32.add
                            local.get 4
                            i32.const 552
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                            local.get 4
                            i32.const 24
                            i32.add
                            i32.const 1056425
                            i32.const 1
                            call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                            local.get 4
                            i64.const 4611686018427387904
                            i64.store offset=624
                            local.get 4
                            i32.const 2
                            i32.store8 offset=616
                            local.get 4
                            local.get 6
                            i32.store offset=588
                            local.get 4
                            local.get 1
                            i32.store offset=584
                            local.get 4
                            local.get 4
                            i64.load offset=24
                            i64.store offset=608
                            local.get 4
                            i32.const 16
                            i32.add
                            local.get 4
                            i32.const 584
                            i32.add
                            call $"<nanvm_lib::naive::container::Container<(), (nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>); 2]>"
                            local.get 4
                            i32.const 5
                            i32.store8 offset=384
                            local.get 4
                            local.get 4
                            i64.load offset=16
                            i64.store offset=388 align=4
                            local.get 4
                            i32.const 8
                            i32.add
                            local.get 4
                            i32.const 384
                            i32.add
                            call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 1]>"
                            local.get 4
                            i32.const 6
                            i32.store8 offset=368
                            local.get 4
                            local.get 4
                            i64.load offset=8
                            i64.store offset=372 align=4
                            local.get 4
                            i32.const 328
                            i32.add
                            local.get 4
                            i32.const 352
                            i32.add
                            local.get 4
                            i32.const 368
                            i32.add
                            call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                            local.get 4
                            i64.load offset=328
                            i64.const 1
                            i64.ne
                            br_if 6 (;@6;)
                            local.get 0
                            i64.const 1
                            i64.store
                            local.get 0
                            local.get 5
                            i64.load offset=8
                            i64.store offset=16
                            local.get 0
                            local.get 5
                            i64.load
                            i64.store offset=8
                          end
                          local.get 4
                          i32.const 248
                          i32.add
                          call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        end
                        local.get 4
                        i32.const 216
                        i32.add
                        call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      end
                      local.get 4
                      i32.const 184
                      i32.add
                      call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    end
                    local.get 4
                    i32.const 104
                    i32.add
                    call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 88
                  i32.add
                  call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 72
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
                br_if 1 (;@5;)
                br 2 (;@4;)
              end
              local.get 4
              local.get 4
              i64.load offset=184
              i64.store offset=120
              local.get 4
              local.get 4
              i64.load offset=192
              i64.store offset=128
              local.get 4
              local.get 4
              i64.load offset=216
              i64.store offset=136
              local.get 4
              local.get 4
              i64.load offset=224
              i64.store offset=144
              local.get 4
              local.get 5
              i64.load offset=8
              i64.store offset=176
              local.get 4
              local.get 5
              i64.load
              i64.store offset=168
              local.get 4
              local.get 3
              i64.load
              i64.store offset=152
              local.get 4
              local.get 3
              i64.load offset=8
              i64.store offset=160
              local.get 4
              local.get 4
              i32.const 120
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
              i32.const 104
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 88
              i32.add
              call $"#func178 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 72
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
              br_if 1 (;@4;)
            end
            local.get 4
            i32.const 64
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 640
          i32.add
          global.set $__stack_pointer
          return
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 639
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 639
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
