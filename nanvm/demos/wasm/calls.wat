  (func $nanvm_demos::samples::calls::module::<nanvm_lib::naive::Naive> (;233;) (type 1) (param i32 i32)
    (local i32 i32 i64 i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 2
    global.set $__stack_pointer
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
                          local.get 1
                          i32.load8_u
                          local.tee 3
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 1
                        i64.load offset=8
                        local.set 4
                        br 8 (;@2;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 5
                      local.get 5
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 6
                      i32.store
                      local.get 6
                      i32.eqz
                      br_if 8 (;@1;)
                      br 6 (;@3;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 1
                    i64.load8_u offset=12
                    i64.const 32
                    i64.shl
                    local.get 1
                    i64.load32_u offset=8
                    i64.or
                    local.set 4
                    br 6 (;@2;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 6
                  i32.store
                  local.get 6
                  br_if 4 (;@3;)
                  br 6 (;@1;)
                end
                local.get 1
                i32.load offset=4
                local.tee 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                br_if 3 (;@3;)
                br 5 (;@1;)
              end
              local.get 1
              i32.load offset=4
              local.tee 5
              local.get 5
              i32.load
              i32.const 1
              i32.add
              local.tee 6
              i32.store
              local.get 6
              i32.eqz
              br_if 4 (;@1;)
              br 1 (;@4;)
            end
            local.get 1
            i32.load8_u offset=1
            local.set 6
          end
          br 1 (;@2;)
        end
        local.get 1
        i64.load32_u offset=8
        local.set 4
      end
      local.get 2
      i32.const 0
      i32.store8 offset=56
      local.get 2
      local.get 4
      i64.store offset=120
      local.get 2
      local.get 5
      i32.store offset=116
      local.get 2
      local.get 6
      i32.store8 offset=113
      local.get 2
      local.get 3
      i32.store8 offset=112
      local.get 2
      i64.const 4294967296
      i64.store offset=104
      local.get 2
      local.get 2
      i32.const 56
      i32.add
      i32.store offset=128
      local.get 2
      i32.const 32
      i32.add
      local.get 2
      i32.const 104
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 2
      local.get 2
      i32.load offset=36
      local.tee 6
      i32.store offset=92
      local.get 2
      local.get 2
      i32.load offset=32
      local.tee 5
      i32.store offset=88
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load8_u offset=56
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 5
          local.get 5
          i32.load
          i32.const -1
          i32.add
          local.tee 1
          i32.store
          local.get 1
          br_if 1 (;@2;)
          local.get 2
          i32.const 88
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 5
        i32.eqz
        br_if 0 (;@2;)
        local.get 2
        i32.const 38
        i32.const 0
        local.get 5
        local.get 6
        i32.const 1057904
        i32.const 29
        call $<nanvm_lib::naive::function::Function>::new
        local.tee 6
        i32.store offset=44
        local.get 2
        i32.const 7
        i32.store8 offset=40
        local.get 2
        i32.const 0
        i32.store16 offset=64
        local.get 2
        i32.const 1057934
        i32.store offset=60
        local.get 2
        i32.const 1057933
        i32.store offset=56
        local.get 2
        i32.const 104
        i32.add
        local.get 2
        i32.const 56
        i32.add
        call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=104
              local.tee 5
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 2
              i32.load offset=112
              local.set 7
              local.get 2
              i32.load offset=108
              local.set 8
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 3
                              br_table 6 (;@7;) 6 (;@7;) 0 (;@13;) 1 (;@12;) 2 (;@11;) 3 (;@10;) 4 (;@9;) 5 (;@8;) 6 (;@7;)
                            end
                            local.get 1
                            i64.load offset=8
                            local.set 4
                            br 9 (;@3;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 5
                          local.get 5
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          br 7 (;@4;)
                        end
                        local.get 1
                        i32.load offset=4
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
                        local.get 1
                        i64.load8_u offset=12
                        i64.const 32
                        i64.shl
                        local.get 1
                        i64.load32_u offset=8
                        i64.or
                        local.set 4
                        br 7 (;@3;)
                      end
                      local.get 1
                      i32.load offset=4
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
                      br 5 (;@4;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 5
                    local.get 5
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    i32.eqz
                    br_if 7 (;@1;)
                    br 4 (;@4;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 9
                  i32.store
                  local.get 9
                  i32.eqz
                  br_if 6 (;@1;)
                  br 1 (;@6;)
                end
                local.get 1
                i32.load8_u offset=1
                local.set 9
              end
              br 2 (;@3;)
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
            local.get 5
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
          local.get 1
          i64.load32_u offset=8
          local.set 4
        end
        local.get 2
        i32.const 0
        i32.store8 offset=56
        local.get 2
        local.get 4
        i64.store offset=120
        local.get 2
        local.get 5
        i32.store offset=116
        local.get 2
        local.get 9
        i32.store8 offset=113
        local.get 2
        local.get 3
        i32.store8 offset=112
        local.get 2
        i64.const 4294967296
        i64.store offset=104
        local.get 2
        local.get 2
        i32.const 56
        i32.add
        i32.store offset=128
        local.get 2
        i32.const 24
        i32.add
        local.get 2
        i32.const 104
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 2
        local.get 2
        i32.load offset=28
        local.tee 9
        i32.store offset=92
        local.get 2
        local.get 2
        i32.load offset=24
        local.tee 5
        i32.store offset=88
        block ;; label = @3
          block ;; label = @4
            local.get 2
            i32.load8_u offset=56
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 5
            local.get 5
            i32.load
            i32.const -1
            i32.add
            local.tee 1
            i32.store
            local.get 1
            br_if 1 (;@3;)
            local.get 2
            i32.const 88
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 1 (;@3;)
          end
          local.get 5
          i32.eqz
          br_if 0 (;@3;)
          i32.const 39
          i32.const 0
          local.get 5
          local.get 9
          i32.const 1057934
          i32.const 26
          call $<nanvm_lib::naive::function::Function>::new
          local.set 5
          local.get 2
          i32.const 0
          i32.store8 offset=56
          local.get 2
          local.get 5
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
          local.tee 7
          i32.store offset=92
          local.get 2
          local.get 2
          i32.load offset=16
          local.tee 5
          i32.store offset=88
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=56
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 5
              local.get 5
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 1 (;@4;)
              local.get 2
              i32.const 88
              i32.add
              call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 5
            i32.eqz
            br_if 0 (;@4;)
            local.get 2
            local.get 7
            i32.store offset=64
            local.get 2
            local.get 5
            i32.store offset=60
            local.get 2
            i32.const 5
            i32.store8 offset=56
            local.get 2
            i32.const 0
            i32.store16 offset=84
            local.get 2
            i32.const 1056904
            i32.store offset=80
            local.get 2
            i32.const 1056897
            i32.store offset=76
            local.get 2
            i32.const 104
            i32.add
            local.get 2
            i32.const 76
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=104
                  local.tee 8
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 2
                  i32.load offset=112
                  local.set 9
                  local.get 2
                  i32.load offset=108
                  local.set 10
                  local.get 6
                  local.get 6
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 5
                  local.get 5
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  i32.eqz
                  br_if 6 (;@1;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 3
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 1
                                i64.load offset=8
                                local.set 4
                                br 9 (;@5;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 8
                              local.get 8
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 11
                              i32.store
                              local.get 11
                              i32.eqz
                              br_if 12 (;@1;)
                              br 7 (;@6;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 8
                            local.get 8
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 11
                            i32.store
                            local.get 11
                            i32.eqz
                            br_if 11 (;@1;)
                            local.get 1
                            i64.load8_u offset=12
                            i64.const 32
                            i64.shl
                            local.get 1
                            i64.load32_u offset=8
                            i64.or
                            local.set 4
                            br 7 (;@5;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 8
                          local.get 8
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 11
                          i32.store
                          local.get 11
                          i32.eqz
                          br_if 10 (;@1;)
                          br 5 (;@6;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 8
                        local.get 8
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 11
                        i32.store
                        local.get 11
                        i32.eqz
                        br_if 9 (;@1;)
                        br 4 (;@6;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 8
                      local.get 8
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 11
                      i32.store
                      local.get 11
                      i32.eqz
                      br_if 8 (;@1;)
                      br 1 (;@8;)
                    end
                    local.get 1
                    i32.load8_u offset=1
                    local.set 11
                  end
                  br 2 (;@5;)
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
                local.get 8
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
              local.get 1
              i64.load32_u offset=8
              local.set 4
            end
            local.get 2
            i32.const 0
            i32.store8 offset=76
            local.get 2
            local.get 4
            i64.store offset=152
            local.get 2
            local.get 8
            i32.store offset=148
            local.get 2
            local.get 11
            i32.store8 offset=145
            local.get 2
            local.get 3
            i32.store8 offset=144
            local.get 2
            local.get 7
            i64.extend_i32_u
            i64.store offset=136
            local.get 2
            local.get 5
            i32.store offset=132
            local.get 2
            i32.const 5
            i32.store8 offset=128
            local.get 2
            i64.const 0
            i64.store offset=120
            local.get 2
            local.get 6
            i32.store offset=116
            local.get 2
            i32.const 7
            i32.store8 offset=112
            local.get 2
            i64.const 12884901888
            i64.store offset=104
            local.get 2
            local.get 2
            i32.const 76
            i32.add
            i32.store offset=160
            local.get 2
            i32.const 8
            i32.add
            local.get 2
            i32.const 104
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=12
            local.tee 5
            i32.store offset=92
            local.get 2
            local.get 2
            i32.load offset=8
            local.tee 3
            i32.store offset=88
            block ;; label = @5
              block ;; label = @6
                local.get 2
                i32.load8_u offset=76
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 3
                local.get 3
                i32.load
                i32.const -1
                i32.add
                local.tee 1
                i32.store
                local.get 1
                br_if 1 (;@5;)
                local.get 2
                i32.const 88
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 0 (;@5;)
              i32.const 40
              i32.const 0
              local.get 3
              local.get 5
              i32.const 1057960
              i32.const 67
              call $<nanvm_lib::naive::function::Function>::new
              local.set 3
              local.get 2
              i32.const 0
              i32.store8 offset=76
              local.get 2
              local.get 3
              i32.store offset=124
              local.get 2
              i32.const 7
              i32.store8 offset=120
              local.get 2
              local.get 9
              i32.store offset=116
              local.get 2
              local.get 10
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
              local.tee 5
              i32.store offset=92
              local.get 2
              local.get 2
              i32.load
              local.tee 3
              i32.store offset=88
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=76
                  i32.const 1
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 1
                  i32.store
                  local.get 1
                  br_if 1 (;@6;)
                  local.get 2
                  i32.const 88
                  i32.add
                  call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                  br 1 (;@6;)
                end
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
                local.get 0
                local.get 5
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
                call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                i32.const 40
                i32.add
                call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 1
                call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                i32.const 176
                i32.add
                global.set $__stack_pointer
                return
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
    unreachable
  )
  (func $"<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;234;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 112
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
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 2
          i32.load
          local.tee 5
          i32.const -1
          i32.eq
          br_if 0 (;@3;)
          local.get 2
          local.get 5
          i32.const 2
          i32.add
          local.tee 5
          i32.store
          local.get 4
          local.get 3
          i32.store offset=32
          local.get 4
          local.get 2
          i32.store offset=28
          local.get 4
          i32.const 6
          i32.store8 offset=24
          local.get 5
          i32.eqz
          br_if 0 (;@3;)
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
                          br 10 (;@1;)
                        end
                        local.get 5
                        i32.load offset=12
                        local.tee 1
                        local.get 1
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 8
                        i32.store
                        local.get 8
                        i32.eqz
                        br_if 7 (;@3;)
                        br 8 (;@2;)
                      end
                      local.get 5
                      i32.load offset=12
                      local.tee 1
                      local.get 1
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 8
                      i32.store
                      local.get 8
                      i32.eqz
                      br_if 6 (;@3;)
                      local.get 5
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 5
                      i64.load32_u offset=16
                      i64.or
                      local.set 7
                      br 8 (;@1;)
                    end
                    local.get 5
                    i32.load offset=12
                    local.tee 1
                    local.get 1
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 8
                    i32.store
                    local.get 8
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 5
                  i32.load offset=12
                  local.tee 1
                  local.get 1
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 8
                  i32.store
                  local.get 8
                  br_if 5 (;@2;)
                  br 4 (;@3;)
                end
                local.get 5
                i32.load offset=12
                local.tee 1
                local.get 1
                i32.load
                i32.const 1
                i32.add
                local.tee 5
                i32.store
                local.get 5
                i32.eqz
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 5
              i32.load8_u offset=9
              local.set 5
            end
            br 3 (;@1;)
          end
          i32.const 0
          i32.const 0
          i32.const 1065308
          call $core::panicking::panic_bounds_check
          unreachable
        end
        unreachable
      end
      local.get 5
      i64.load32_u offset=16
      local.set 7
    end
    local.get 4
    i32.const 0
    i32.store8 offset=47
    local.get 4
    local.get 7
    i64.store offset=88
    local.get 4
    local.get 1
    i32.store offset=84
    local.get 4
    local.get 5
    i32.store8 offset=81
    local.get 4
    local.get 6
    i32.store8 offset=80
    local.get 4
    local.get 3
    i64.extend_i32_u
    i64.store offset=72
    local.get 4
    local.get 2
    i32.store offset=68
    local.get 4
    i32.const 6
    i32.store8 offset=64
    local.get 4
    i64.const 8589934592
    i64.store offset=56
    local.get 4
    local.get 4
    i32.const 47
    i32.add
    i32.store offset=96
    local.get 4
    i32.const 8
    i32.add
    local.get 4
    i32.const 56
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 4
    local.get 4
    i32.load offset=12
    local.tee 1
    i32.store offset=52
    local.get 4
    local.get 4
    i32.load offset=8
    local.tee 3
    i32.store offset=48
    block ;; label = @1
      block ;; label = @2
        local.get 4
        i32.load8_u offset=47
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 3
        local.get 3
        i32.load
        i32.const -1
        i32.add
        local.tee 2
        i32.store
        local.get 2
        br_if 1 (;@1;)
        local.get 4
        i32.const 48
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      i32.const 41
      i32.const 0
      local.get 3
      local.get 1
      i32.const 1059082
      i32.const 20
      call $<nanvm_lib::naive::function::Function>::new
      i32.store offset=12
      local.get 0
      i32.const 7
      i32.store8 offset=8
      local.get 0
      i64.const 0
      i64.store
      local.get 4
      i32.const 24
      i32.add
      call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
      local.get 2
      local.get 2
      i32.load
      i32.const -1
      i32.add
      local.tee 3
      i32.store
      block ;; label = @2
        local.get 3
        br_if 0 (;@2;)
        local.get 4
        i32.const 16
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 112
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 111
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;235;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 192
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
              local.get 2
              i32.load
              local.tee 5
              i32.const -1
              i32.eq
              br_if 0 (;@5;)
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
              br_if 0 (;@5;)
              local.get 4
              local.get 2
              i32.store offset=84
              local.get 4
              i32.const 6
              i32.store8 offset=80
              local.get 4
              local.get 3
              i64.extend_i32_u
              i64.store offset=88
              local.get 4
              i32.const 0
              i32.store16 offset=172
              local.get 4
              i32.const 1058893
              i32.store offset=168
              local.get 4
              i32.const 1058887
              i32.store offset=164
              local.get 4
              i32.const 128
              i32.add
              local.get 4
              i32.const 164
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              block ;; label = @6
                local.get 4
                i32.load8_u offset=128
                local.tee 3
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=132 align=4
                i64.store offset=180 align=4
                local.get 4
                i32.const 3
                i32.store8 offset=176
                local.get 4
                i32.const 96
                i32.add
                local.get 4
                i32.const 80
                i32.add
                local.get 4
                i32.const 176
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=96
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
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
                  local.get 4
                  i32.const 16
                  i32.add
                  call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 2
                  local.get 2
                  i32.load
                  i32.const -1
                  i32.add
                  local.tee 3
                  i32.store
                  local.get 3
                  i32.eqz
                  br_if 5 (;@2;)
                  br 6 (;@1;)
                end
                local.get 4
                local.get 4
                i64.load offset=120
                i64.store offset=152
                local.get 4
                local.get 4
                i64.load offset=112
                i64.store offset=144
                local.get 4
                local.get 4
                i64.load offset=104
                i64.store offset=136
                local.get 4
                local.get 4
                i64.load offset=96
                i64.store offset=128
                local.get 4
                i32.const 176
                i32.add
                local.get 4
                i32.const 128
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=176
                    local.tee 5
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    i32.const 0
                    local.set 5
                    i32.const 1
                    local.set 6
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=178 align=2
                  i64.store offset=80
                  local.get 4
                  local.get 4
                  i64.load offset=184 align=2
                  i64.store offset=86 align=2
                  local.get 4
                  i32.load8_u offset=177
                  local.set 6
                end
                local.get 4
                i32.const 128
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 144
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=16
                                local.tee 7
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 4
                              i64.load offset=24
                              local.set 8
                              br 10 (;@3;)
                            end
                            local.get 4
                            i32.load offset=20
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 7 (;@5;)
                            br 8 (;@4;)
                          end
                          local.get 4
                          i32.load offset=20
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 6 (;@5;)
                          local.get 4
                          i64.load8_u offset=28
                          i64.const 32
                          i64.shl
                          local.get 4
                          i64.load32_u offset=24
                          i64.or
                          local.set 8
                          br 8 (;@3;)
                        end
                        local.get 4
                        i32.load offset=20
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        br_if 6 (;@4;)
                        br 5 (;@5;)
                      end
                      local.get 4
                      i32.load offset=20
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      br_if 5 (;@4;)
                      br 4 (;@5;)
                    end
                    local.get 4
                    i32.load offset=20
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    i32.eqz
                    br_if 3 (;@5;)
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.load8_u offset=17
                  local.set 9
                end
                br 3 (;@3;)
              end
              local.get 4
              local.get 4
              i32.load8_u offset=131
              i32.store8 offset=99
              local.get 4
              local.get 4
              i32.load16_u offset=129 align=1
              i32.store16 offset=97 align=1
              local.get 4
              local.get 4
              i32.load offset=140
              i32.store offset=108
              local.get 4
              local.get 4
              i64.load offset=132 align=4
              i64.store offset=100 align=4
              local.get 4
              local.get 3
              i32.store8 offset=96
              i32.const 1063112
              i32.const 43
              local.get 4
              i32.const 96
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
          local.set 8
        end
        local.get 4
        local.get 6
        i32.store8 offset=41
        local.get 4
        local.get 5
        i32.store8 offset=40
        local.get 4
        i64.const 0
        i64.store offset=32
        local.get 4
        local.get 4
        i64.load offset=80
        i64.store offset=42 align=2
        local.get 4
        local.get 4
        i64.load offset=86 align=2
        i64.store offset=48 align=2
        local.get 4
        local.get 8
        i64.store offset=72
        local.get 4
        local.get 3
        i32.store offset=68
        local.get 4
        local.get 9
        i32.store8 offset=65
        local.get 4
        local.get 7
        i32.store8 offset=64
        local.get 4
        i64.const 1
        i64.store offset=56
        local.get 0
        local.get 4
        i32.const 32
        i32.add
        call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 2]>"
        local.get 4
        i32.const 16
        i32.add
        call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 2
        local.get 2
        i32.load
        i32.const -1
        i32.add
        local.tee 3
        i32.store
        local.get 3
        br_if 1 (;@1;)
      end
      local.get 4
      i32.const 8
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 192
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#2} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;236;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 i64 i64 i64)
    global.get $__stack_pointer
    i32.const 304
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=36
    local.get 4
    local.get 2
    i32.store offset=32
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
      i32.store offset=48
      local.get 4
      local.get 2
      i32.store offset=44
      local.get 4
      i32.const 6
      i32.store8 offset=40
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
      i64.store offset=144
      local.get 4
      local.get 3
      i32.store offset=140
      local.get 4
      local.get 5
      i32.store8 offset=137
      local.get 4
      local.get 6
      i32.store8 offset=136
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
                          i32.load8_u offset=40
                          local.tee 5
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 4
                        i64.load offset=48
                        local.set 7
                        br 8 (;@2;)
                      end
                      local.get 4
                      i32.load offset=44
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
                      br 6 (;@3;)
                    end
                    local.get 4
                    i32.load offset=44
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 6
                    i32.store
                    local.get 6
                    i32.eqz
                    br_if 7 (;@1;)
                    local.get 4
                    i64.load8_u offset=52
                    i64.const 32
                    i64.shl
                    local.get 4
                    i64.load32_u offset=48
                    i64.or
                    local.set 7
                    br 6 (;@2;)
                  end
                  local.get 4
                  i32.load offset=44
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 6
                  i32.store
                  local.get 6
                  i32.eqz
                  br_if 6 (;@1;)
                  br 4 (;@3;)
                end
                local.get 4
                i32.load offset=44
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                i32.eqz
                br_if 5 (;@1;)
                br 3 (;@3;)
              end
              local.get 4
              i32.load offset=44
              local.tee 3
              local.get 3
              i32.load
              i32.const 1
              i32.add
              local.tee 6
              i32.store
              local.get 6
              i32.eqz
              br_if 4 (;@1;)
              br 1 (;@4;)
            end
            local.get 4
            i32.load8_u offset=41
            local.set 6
          end
          br 1 (;@2;)
        end
        local.get 4
        i64.load32_u offset=48
        local.set 7
      end
      local.get 4
      local.get 7
      i64.store offset=240
      local.get 4
      local.get 3
      i32.store offset=236
      local.get 4
      local.get 6
      i32.store8 offset=233
      local.get 4
      local.get 5
      i32.store8 offset=232
      local.get 4
      i64.const 0
      i64.store offset=256
      local.get 4
      i32.const 2
      i32.store8 offset=248
      local.get 4
      i32.const 192
      i32.add
      local.get 4
      i32.const 232
      i32.add
      local.get 4
      i32.const 248
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
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
                          i32.load8_u offset=192
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
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
                          local.get 4
                          i32.const 136
                          i32.add
                          call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=216
                        i64.store offset=272
                        local.get 4
                        local.get 4
                        i64.load offset=208
                        i64.store offset=264
                        local.get 4
                        local.get 4
                        i64.load offset=200
                        i64.store offset=256
                        local.get 4
                        local.get 4
                        i64.load offset=192
                        i64.store offset=248
                        local.get 4
                        i32.const 232
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        i32.const 1
                        local.set 3
                        i32.const 0
                        local.set 5
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=232
                          local.tee 6
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=234 align=2
                          i64.store offset=72
                          local.get 4
                          local.get 4
                          i64.load offset=240 align=2
                          i64.store offset=78 align=2
                          local.get 4
                          i32.load8_u offset=233
                          local.set 3
                          local.get 6
                          local.set 5
                        end
                        local.get 4
                        i32.const 248
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 264
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 0
                        i32.store8 offset=231
                        local.get 4
                        local.get 3
                        i32.store8 offset=257
                        local.get 4
                        local.get 5
                        i32.store8 offset=256
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=248
                        local.get 4
                        local.get 4
                        i64.load offset=72
                        i64.store offset=258 align=2
                        local.get 4
                        local.get 4
                        i64.load offset=78 align=2
                        i64.store offset=264 align=2
                        local.get 4
                        local.get 4
                        i32.const 231
                        i32.add
                        i32.store offset=272
                        local.get 4
                        i32.const 24
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=28
                        local.tee 5
                        i32.store offset=236
                        local.get 4
                        local.get 4
                        i32.load offset=24
                        local.tee 3
                        i32.store offset=232
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=231
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 2
                          i32.store
                          local.get 2
                          br_if 9 (;@2;)
                          local.get 4
                          i32.const 232
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 9 (;@2;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 8 (;@2;)
                        local.get 4
                        local.get 5
                        i32.store offset=184
                        local.get 4
                        local.get 3
                        i32.store offset=180
                        local.get 4
                        i32.const 6
                        i32.store8 offset=176
                        local.get 4
                        i32.const 88
                        i32.add
                        local.get 4
                        i32.const 136
                        i32.add
                        local.get 4
                        i32.const 176
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        local.get 4
                        local.get 4
                        i64.load offset=96
                        i64.store offset=120
                        local.get 4
                        local.get 4
                        i64.load offset=104
                        i64.store offset=128
                        block ;; label = @11
                          local.get 4
                          i64.load offset=88
                          i64.const 1
                          i64.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=128
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=120
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=128
                        i64.store offset=64
                        local.get 4
                        local.get 4
                        i64.load offset=120
                        local.tee 7
                        i64.store offset=56
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
                                            local.get 7
                                            i32.wrap_i64
                                            local.tee 5
                                            i32.const 255
                                            i32.and
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 4
                                          i64.load offset=64
                                          local.set 7
                                          br 8 (;@11;)
                                        end
                                        local.get 4
                                        i32.load offset=60
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
                                        br 6 (;@12;)
                                      end
                                      local.get 4
                                      i32.load offset=60
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
                                      local.get 4
                                      i64.load8_u offset=68
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=64
                                      i64.or
                                      local.set 7
                                      br 6 (;@11;)
                                    end
                                    local.get 4
                                    i32.load offset=60
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
                                    br 4 (;@12;)
                                  end
                                  local.get 4
                                  i32.load offset=60
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
                                  br 3 (;@12;)
                                end
                                local.get 4
                                i32.load offset=60
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
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.load8_u offset=57
                              local.set 6
                            end
                            br 1 (;@11;)
                          end
                          local.get 4
                          i64.load32_u offset=64
                          local.set 7
                        end
                        local.get 4
                        local.get 7
                        i64.store offset=184
                        local.get 4
                        local.get 3
                        i32.store offset=180
                        local.get 4
                        local.get 6
                        i32.store8 offset=177
                        local.get 4
                        local.get 5
                        i32.store8 offset=176
                        local.get 4
                        i32.const 0
                        i32.store8 offset=72
                        local.get 4
                        i64.const 4621819117588971520
                        i64.store offset=264
                        local.get 4
                        i32.const 2
                        i32.store8 offset=256
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=248
                        local.get 4
                        local.get 4
                        i32.const 72
                        i32.add
                        i32.store offset=272
                        local.get 4
                        i32.const 16
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=20
                        local.tee 5
                        i32.store offset=236
                        local.get 4
                        local.get 4
                        i32.load offset=16
                        local.tee 3
                        i32.store offset=232
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=72
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 3
                          local.get 3
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 2
                          i32.store
                          local.get 2
                          br_if 8 (;@3;)
                          local.get 4
                          i32.const 232
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 8 (;@3;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 7 (;@3;)
                        local.get 4
                        local.get 5
                        i32.store offset=240
                        local.get 4
                        local.get 3
                        i32.store offset=236
                        local.get 4
                        i32.const 6
                        i32.store8 offset=232
                        local.get 4
                        i32.const 248
                        i32.add
                        local.get 4
                        i32.const 176
                        i32.add
                        local.get 4
                        i32.const 232
                        i32.add
                        call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                        local.get 4
                        local.get 4
                        i64.load offset=256
                        i64.store offset=136
                        local.get 4
                        local.get 4
                        i64.load offset=264
                        i64.store offset=144
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i64.load offset=248
                            i64.const 1
                            i64.ne
                            br_if 0 (;@12;)
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
                            br 1 (;@11;)
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=144
                          i64.store offset=128
                          local.get 4
                          local.get 4
                          i64.load offset=136
                          i64.store offset=120
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 1
                                i32.load offset=16
                                local.tee 3
                                i32.const 1
                                i32.le_u
                                br_if 0 (;@14;)
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            block ;; label = @21
                                              block ;; label = @22
                                                local.get 1
                                                i32.load offset=12
                                                local.tee 3
                                                i32.load8_u offset=24
                                                local.tee 6
                                                br_table 6 (;@16;) 6 (;@16;) 0 (;@22;) 1 (;@21;) 2 (;@20;) 3 (;@19;) 4 (;@18;) 5 (;@17;) 6 (;@16;)
                                              end
                                              local.get 3
                                              i64.load offset=32
                                              local.set 7
                                              br 9 (;@12;)
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
                                            br_if 19 (;@1;)
                                            br 7 (;@13;)
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
                                          br_if 18 (;@1;)
                                          local.get 3
                                          i64.load8_u offset=36
                                          i64.const 32
                                          i64.shl
                                          local.get 3
                                          i64.load32_u offset=32
                                          i64.or
                                          local.set 7
                                          br 7 (;@12;)
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
                                        br_if 17 (;@1;)
                                        br 5 (;@13;)
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
                                      br_if 16 (;@1;)
                                      br 4 (;@13;)
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
                                    br_if 15 (;@1;)
                                    br 1 (;@15;)
                                  end
                                  local.get 3
                                  i32.load8_u offset=25
                                  local.set 3
                                end
                                br 2 (;@12;)
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
                          i64.store offset=184
                          local.get 4
                          local.get 5
                          i32.store offset=180
                          local.get 4
                          local.get 3
                          i32.store8 offset=177
                          local.get 4
                          local.get 6
                          i32.store8 offset=176
                          local.get 4
                          i32.const 0
                          i32.store16 offset=80
                          local.get 4
                          i32.const 1057934
                          i32.store offset=76
                          local.get 4
                          i32.const 1057933
                          i32.store offset=72
                          local.get 4
                          i32.const 248
                          i32.add
                          local.get 4
                          i32.const 72
                          i32.add
                          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                          local.get 4
                          i32.load8_u offset=248
                          local.tee 3
                          i32.const 255
                          i32.ne
                          br_if 5 (;@6;)
                          local.get 4
                          local.get 4
                          i64.load offset=252 align=4
                          i64.store offset=236 align=4
                          local.get 4
                          i32.const 3
                          i32.store8 offset=232
                          local.get 4
                          i32.const 248
                          i32.add
                          local.get 4
                          i32.const 176
                          i32.add
                          local.get 4
                          i32.const 232
                          i32.add
                          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                          local.get 1
                          i32.load offset=16
                          local.tee 3
                          i32.const 2
                          i32.le_u
                          br_if 6 (;@5;)
                          local.get 4
                          i32.const 160
                          i32.add
                          local.set 3
                          local.get 4
                          i32.const 152
                          i32.add
                          local.get 4
                          i32.const 248
                          i32.add
                          local.get 1
                          i32.load offset=12
                          i32.const 40
                          i32.add
                          local.get 4
                          i32.const 40
                          i32.add
                          call $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#2}::{closure#0}>"
                          local.get 4
                          i64.load offset=152
                          i64.const 1
                          i64.ne
                          br_if 2 (;@9;)
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
                          i32.const 120
                          i32.add
                          call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        end
                        local.get 4
                        i32.const 56
                        i32.add
                        call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      end
                      local.get 4
                      i32.const 40
                      i32.add
                      call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 2
                      local.get 2
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      i32.eqz
                      br_if 1 (;@8;)
                      br 2 (;@7;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    local.tee 7
                    i64.store offset=88
                    local.get 4
                    local.get 4
                    i64.load offset=144
                    local.tee 9
                    i64.store offset=96
                    local.get 4
                    local.get 3
                    i64.load offset=8
                    local.tee 10
                    i64.store offset=112
                    local.get 4
                    local.get 3
                    i64.load
                    local.tee 11
                    i64.store offset=104
                    local.get 4
                    i32.const 0
                    i32.store8 offset=176
                    local.get 4
                    i64.const 8589934592
                    i64.store offset=248
                    local.get 4
                    local.get 7
                    i64.store offset=256
                    local.get 4
                    local.get 9
                    i64.store offset=264
                    local.get 4
                    local.get 11
                    i64.store offset=272
                    local.get 4
                    local.get 10
                    i64.store offset=280
                    local.get 4
                    local.get 4
                    i32.const 176
                    i32.add
                    i32.store offset=288
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 248
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=12
                    local.tee 3
                    i32.store offset=236
                    local.get 4
                    local.get 4
                    i32.load offset=8
                    local.tee 1
                    i32.store offset=232
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=176
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
                      br_if 5 (;@4;)
                      local.get 4
                      i32.const 232
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 5 (;@4;)
                    end
                    local.get 1
                    i32.eqz
                    br_if 4 (;@4;)
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
                    i32.const 56
                    i32.add
                    call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 40
                    i32.add
                    call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 1 (;@7;)
                  end
                  local.get 4
                  i32.const 32
                  i32.add
                  call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                end
                local.get 4
                i32.const 304
                i32.add
                global.set $__stack_pointer
                return
              end
              local.get 4
              local.get 4
              i32.load8_u offset=251
              i32.store8 offset=235
              local.get 4
              local.get 4
              i32.load16_u offset=249 align=1
              i32.store16 offset=233 align=1
              local.get 4
              local.get 4
              i32.load offset=260
              i32.store offset=244
              local.get 4
              local.get 4
              i64.load offset=252 align=4
              i64.store offset=236 align=4
              local.get 4
              local.get 3
              i32.store8 offset=232
              i32.const 1063112
              i32.const 43
              local.get 4
              i32.const 232
              i32.add
              i32.const 1063096
              i32.const 1063156
              call $core::result::unwrap_failed
              unreachable
            end
            i32.const 2
            local.get 3
            i32.const 1065308
            call $core::panicking::panic_bounds_check
            unreachable
          end
          i32.const 1059464
          i32.const 43
          local.get 4
          i32.const 303
          i32.add
          i32.const 1059448
          i32.const 1059508
          call $core::result::unwrap_failed
          unreachable
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 303
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 303
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#0}::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;259;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 1
    i32.load
    local.set 1
    local.get 4
    local.get 3
    i32.store offset=12
    local.get 4
    local.get 2
    i32.store offset=8
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
      i32.store offset=24
      local.get 4
      local.get 2
      i32.store offset=20
      local.get 4
      i32.const 6
      i32.store8 offset=16
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
      i64.store offset=104
      local.get 4
      local.get 3
      i32.store offset=100
      local.get 4
      local.get 1
      i32.store8 offset=97
      local.get 4
      local.get 5
      i32.store8 offset=96
      local.get 4
      i64.const 0
      i64.store offset=136
      local.get 4
      i32.const 2
      i32.store8 offset=128
      local.get 4
      i32.const 64
      i32.add
      local.get 4
      i32.const 96
      i32.add
      local.get 4
      i32.const 128
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=64
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 0
                local.get 4
                i64.load offset=80
                i64.store offset=16
                local.get 0
                local.get 4
                i64.load offset=72
                i64.store offset=8
                local.get 0
                i64.const 1
                i64.store
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=88
              i64.store offset=152
              local.get 4
              local.get 4
              i64.load offset=80
              i64.store offset=144
              local.get 4
              local.get 4
              i64.load offset=72
              i64.store offset=136
              local.get 4
              local.get 4
              i64.load offset=64
              i64.store offset=128
              local.get 4
              i32.const 96
              i32.add
              local.get 4
              i32.const 128
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=96
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=104
                  i64.store offset=40
                  local.get 4
                  local.get 4
                  i64.load offset=96
                  i64.store offset=32
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=32
              end
              local.get 4
              i32.const 128
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 144
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              block ;; label = @6
                block ;; label = @7
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
                                  local.tee 1
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 4
                                i64.load offset=24
                                local.set 6
                                br 8 (;@6;)
                              end
                              local.get 4
                              i32.load offset=20
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
                            i32.load offset=20
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
                            local.get 4
                            i64.load8_u offset=28
                            i64.const 32
                            i64.shl
                            local.get 4
                            i64.load32_u offset=24
                            i64.or
                            local.set 6
                            br 6 (;@6;)
                          end
                          local.get 4
                          i32.load offset=20
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
                        i32.load offset=20
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
                        br 3 (;@7;)
                      end
                      local.get 4
                      i32.load offset=20
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
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.load8_u offset=17
                    local.set 5
                  end
                  br 1 (;@6;)
                end
                local.get 4
                i64.load32_u offset=24
                local.set 6
              end
              local.get 4
              local.get 6
              i64.store offset=168
              local.get 4
              local.get 3
              i32.store offset=164
              local.get 4
              local.get 5
              i32.store8 offset=161
              local.get 4
              local.get 1
              i32.store8 offset=160
              local.get 4
              i64.const 0
              i64.store offset=136
              local.get 4
              i32.const 2
              i32.store8 offset=128
              local.get 4
              i32.const 96
              i32.add
              local.get 4
              i32.const 160
              i32.add
              local.get 4
              i32.const 128
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              local.get 4
              i32.load8_u offset=96
              i32.const 255
              i32.ne
              br_if 1 (;@4;)
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
              local.get 4
              i32.const 32
              i32.add
              call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            end
            local.get 4
            i32.const 16
            i32.add
            call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
          local.get 4
          local.get 4
          i64.load offset=120
          i64.store offset=152
          local.get 4
          local.get 4
          i64.load offset=112
          i64.store offset=144
          local.get 4
          local.get 4
          i64.load offset=104
          i64.store offset=136
          local.get 4
          local.get 4
          i64.load offset=96
          i64.store offset=128
          local.get 4
          i32.const 160
          i32.add
          local.get 4
          i32.const 128
          i32.add
          call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=160
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i64.load offset=168
              i64.store offset=56
              local.get 4
              local.get 4
              i64.load offset=160
              i64.store offset=48
              br 1 (;@4;)
            end
            local.get 4
            i32.const 256
            i32.store16 offset=48
          end
          local.get 4
          i32.const 128
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 144
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 0
          local.get 4
          i32.const 32
          i32.add
          local.get 4
          i32.const 48
          i32.add
          call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
          local.get 4
          i32.const 16
          i32.add
          call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
        i32.const 8
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 176
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::PropertyLambda<nanvm_lib::naive::Naive>>::end_call::<nanvm_demos::samples::calls::module<nanvm_lib::naive::Naive>::{closure#2}::{closure#0}>" (;556;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32 i64 i32 i32)
    global.get $__stack_pointer
    i32.const 208
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          local.get 1
          i32.load8_u
          local.tee 5
          i32.const 255
          i32.ne
          br_if 0 (;@3;)
          local.get 0
          i64.const 1
          i64.store
          local.get 0
          local.get 1
          i64.load offset=16
          i64.store offset=16
          local.get 0
          local.get 1
          i64.load offset=8
          i64.store offset=8
          br 1 (;@2;)
        end
        local.get 1
        i64.load offset=24
        local.set 6
        local.get 4
        local.get 1
        i32.const 1
        i32.add
        local.tee 1
        i64.load offset=15 align=1
        i64.store offset=23 align=1
        local.get 4
        local.get 1
        i64.load offset=8 align=1
        i64.store offset=16
        local.get 4
        local.get 1
        i64.load align=1
        i64.store offset=8
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
                              local.get 3
                              i32.load8_u
                              local.tee 7
                              br_table 6 (;@7;) 6 (;@7;) 0 (;@13;) 1 (;@12;) 2 (;@11;) 3 (;@10;) 4 (;@9;) 5 (;@8;) 6 (;@7;)
                            end
                            local.get 3
                            i64.load offset=8
                            local.set 8
                            br 9 (;@3;)
                          end
                          local.get 3
                          i32.load offset=4
                          local.tee 9
                          local.get 9
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 10
                          i32.store
                          local.get 10
                          i32.eqz
                          br_if 6 (;@5;)
                          br 7 (;@4;)
                        end
                        local.get 3
                        i32.load offset=4
                        local.tee 9
                        local.get 9
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 10
                        i32.store
                        local.get 10
                        i32.eqz
                        br_if 5 (;@5;)
                        local.get 3
                        i64.load8_u offset=12
                        i64.const 32
                        i64.shl
                        local.get 3
                        i64.load32_u offset=8
                        i64.or
                        local.set 8
                        br 7 (;@3;)
                      end
                      local.get 3
                      i32.load offset=4
                      local.tee 9
                      local.get 9
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 10
                      i32.store
                      local.get 10
                      br_if 5 (;@4;)
                      br 4 (;@5;)
                    end
                    local.get 3
                    i32.load offset=4
                    local.tee 9
                    local.get 9
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 10
                    i32.store
                    local.get 10
                    br_if 4 (;@4;)
                    br 3 (;@5;)
                  end
                  local.get 3
                  i32.load offset=4
                  local.tee 9
                  local.get 9
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 3
                  i32.store
                  local.get 3
                  i32.eqz
                  br_if 2 (;@5;)
                  br 1 (;@6;)
                end
                local.get 3
                i32.load8_u offset=1
                local.set 3
              end
              br 2 (;@3;)
            end
            unreachable
          end
          local.get 3
          i64.load32_u offset=8
          local.set 8
        end
        local.get 4
        local.get 8
        i64.store offset=136
        local.get 4
        local.get 9
        i32.store offset=132
        local.get 4
        local.get 3
        i32.store8 offset=129
        local.get 4
        local.get 7
        i32.store8 offset=128
        local.get 4
        i64.const 0
        i64.store offset=160
        local.get 4
        i32.const 2
        i32.store8 offset=152
        local.get 4
        i32.const 80
        i32.add
        local.get 4
        i32.const 128
        i32.add
        local.get 4
        i32.const 152
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=80
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=96
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=88
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              local.get 5
              i32.store8 offset=152
              local.get 4
              local.get 2
              i32.store offset=184
              local.get 4
              local.get 6
              i64.store offset=176
              local.get 4
              local.get 1
              i64.load align=1
              i64.store offset=153 align=1
              local.get 4
              local.get 1
              i64.load offset=8 align=1
              i64.store offset=161 align=1
              local.get 4
              local.get 1
              i64.load offset=15 align=1
              i64.store offset=168 align=1
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=104
            i64.store offset=176
            local.get 4
            local.get 4
            i64.load offset=96
            i64.store offset=168
            local.get 4
            local.get 4
            i64.load offset=88
            i64.store offset=160
            local.get 4
            local.get 4
            i64.load offset=80
            i64.store offset=152
            local.get 4
            i32.const 128
            i32.add
            local.get 4
            i32.const 152
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            i32.const 0
            local.set 3
            i32.const 1
            local.set 9
            block ;; label = @5
              local.get 4
              i32.load8_u offset=128
              local.tee 7
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i64.load offset=130 align=2
              i64.store offset=112
              local.get 4
              local.get 4
              i64.load offset=136 align=2
              i64.store offset=118 align=2
              local.get 4
              i32.load8_u offset=129
              local.set 9
              local.get 7
              local.set 3
            end
            local.get 4
            i32.const 152
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 168
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 0
            i32.store8 offset=151
            local.get 4
            local.get 9
            i32.store8 offset=161
            local.get 4
            local.get 3
            i32.store8 offset=160
            local.get 4
            i64.const 8589934592
            i64.store offset=152
            local.get 4
            local.get 4
            i64.load offset=112
            i64.store offset=162 align=2
            local.get 4
            local.get 4
            i64.load offset=118 align=2
            i64.store offset=168 align=2
            local.get 4
            i64.const 4616189618054758400
            i64.store offset=184
            local.get 4
            i32.const 2
            i32.store8 offset=176
            local.get 4
            local.get 4
            i32.const 151
            i32.add
            i32.store offset=192
            local.get 4
            local.get 4
            i32.const 152
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=4
            local.tee 9
            i32.store offset=132
            local.get 4
            local.get 4
            i32.load
            local.tee 3
            i32.store offset=128
            block ;; label = @5
              local.get 4
              i32.load8_u offset=151
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
              br_if 4 (;@1;)
              local.get 4
              i32.const 128
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 4 (;@1;)
            end
            local.get 3
            i32.eqz
            br_if 3 (;@1;)
            local.get 4
            i64.const 4617315517961601024
            i64.store offset=72
            local.get 4
            i32.const 2
            i32.store8 offset=64
            local.get 4
            local.get 9
            i32.store offset=48
            local.get 4
            local.get 3
            i32.store offset=44
            local.get 4
            i32.const 6
            i32.store8 offset=40
            local.get 4
            i64.const 0
            i64.store offset=56
            local.get 4
            i64.const 1
            i64.store offset=32
            local.get 0
            local.get 4
            i32.const 32
            i32.add
            call $"nanvm_lib::vm::unstable::spread_array::<nanvm_lib::naive::Naive, [nanvm_lib::vm::unstable::ArrayItem<nanvm_lib::naive::Naive>; 2]>"
            local.get 0
            i64.load
            local.set 8
            local.get 4
            local.get 5
            i32.store8 offset=152
            local.get 4
            local.get 2
            i32.store offset=184
            local.get 4
            local.get 6
            i64.store offset=176
            local.get 4
            local.get 1
            i64.load align=1
            i64.store offset=153 align=1
            local.get 4
            local.get 1
            i64.load offset=8 align=1
            i64.store offset=161 align=1
            local.get 4
            local.get 1
            i64.load offset=15 align=1
            i64.store offset=168 align=1
            local.get 8
            i64.const 1
            i64.ne
            br_if 1 (;@3;)
          end
          local.get 4
          i32.const 152
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 168
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          br 1 (;@2;)
        end
        local.get 4
        local.get 0
        i64.load offset=16
        i64.store offset=88
        local.get 4
        local.get 0
        i64.load offset=8
        i64.store offset=80
        local.get 4
        local.get 5
        i32.store8 offset=32
        local.get 4
        local.get 4
        i64.load offset=8
        i64.store offset=33 align=1
        local.get 4
        local.get 4
        i64.load offset=16
        i64.store offset=41 align=1
        local.get 4
        local.get 4
        i64.load offset=23 align=1
        i64.store offset=48 align=1
        local.get 4
        local.get 6
        i64.store offset=56
        local.get 0
        local.get 4
        i32.const 32
        i32.add
        local.get 2
        local.get 4
        i32.const 80
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
      end
      local.get 4
      i32.const 208
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 207
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
