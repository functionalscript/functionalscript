  (func $nanvm_demos::samples::optional_chaining::module::<nanvm_lib::naive::Naive> (;222;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i64 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 160
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store16 offset=48
    local.get 2
    i32.const 1056884
    i32.store offset=44
    local.get 2
    i32.const 1056883
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
                  i32.store16 offset=48
                  local.get 2
                  i32.const 1056885
                  i32.store offset=44
                  local.get 2
                  i32.const 1056884
                  i32.store offset=40
                  local.get 2
                  i32.const 56
                  i32.add
                  local.get 2
                  i32.const 40
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 2
                  i32.load8_u offset=56
                  local.tee 3
                  i32.const 255
                  i32.ne
                  br_if 1 (;@6;)
                  local.get 2
                  i64.load offset=60 align=4
                  local.set 6
                  local.get 2
                  i32.const 0
                  i32.store8 offset=40
                  local.get 2
                  i64.const 4607182418800017408
                  i64.store offset=80
                  local.get 2
                  i32.const 2
                  i32.store8 offset=72
                  local.get 2
                  local.get 6
                  i64.store offset=64
                  local.get 2
                  i64.const 4294967296
                  i64.store offset=56
                  local.get 2
                  local.get 2
                  i32.const 40
                  i32.add
                  i32.store offset=88
                  local.get 2
                  i32.const 32
                  i32.add
                  local.get 2
                  i32.const 56
                  i32.add
                  call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
                  local.get 2
                  local.get 2
                  i32.load offset=36
                  local.tee 7
                  i32.store offset=140
                  local.get 2
                  local.get 2
                  i32.load offset=32
                  local.tee 3
                  i32.store offset=136
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
                    local.tee 1
                    i32.store
                    local.get 1
                    br_if 7 (;@1;)
                    local.get 2
                    i32.const 136
                    i32.add
                    call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                    br 7 (;@1;)
                  end
                  local.get 3
                  i32.eqz
                  br_if 6 (;@1;)
                  local.get 2
                  i32.const 0
                  i32.store16 offset=48
                  local.get 2
                  i32.const 1056886
                  i32.store offset=44
                  local.get 2
                  i32.const 1056885
                  i32.store offset=40
                  local.get 2
                  i32.const 56
                  i32.add
                  local.get 2
                  i32.const 40
                  i32.add
                  call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                  local.get 2
                  i32.load8_u offset=56
                  local.tee 8
                  i32.const 255
                  i32.ne
                  br_if 2 (;@5;)
                  local.get 2
                  i32.load offset=64
                  local.set 9
                  local.get 2
                  i32.load offset=60
                  local.set 10
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 1
                                  i32.load8_u
                                  local.tee 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 1
                                i64.load offset=8
                                local.set 6
                                br 11 (;@3;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 11
                              local.get 11
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 12
                              i32.store
                              local.get 12
                              i32.eqz
                              br_if 11 (;@2;)
                              br 9 (;@4;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 11
                            local.get 11
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 12
                            i32.store
                            local.get 12
                            i32.eqz
                            br_if 10 (;@2;)
                            local.get 1
                            i64.load8_u offset=12
                            i64.const 32
                            i64.shl
                            local.get 1
                            i64.load32_u offset=8
                            i64.or
                            local.set 6
                            br 9 (;@3;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 11
                          local.get 11
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 12
                          i32.store
                          local.get 12
                          br_if 7 (;@4;)
                          br 9 (;@2;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 11
                        local.get 11
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 12
                        i32.store
                        local.get 12
                        br_if 6 (;@4;)
                        br 8 (;@2;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 11
                      local.get 11
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 12
                      i32.store
                      local.get 12
                      i32.eqz
                      br_if 7 (;@2;)
                      br 1 (;@8;)
                    end
                    local.get 1
                    i32.load8_u offset=1
                    local.set 12
                  end
                  br 4 (;@3;)
                end
                local.get 2
                local.get 2
                i32.load8_u offset=59
                i32.store8 offset=139
                local.get 2
                local.get 2
                i32.load16_u offset=57 align=1
                i32.store16 offset=137 align=1
                local.get 2
                local.get 2
                i32.load offset=68
                i32.store offset=148
                local.get 2
                local.get 2
                i64.load offset=60 align=4
                i64.store offset=140 align=4
                local.get 2
                local.get 3
                i32.store8 offset=136
                i32.const 1063112
                i32.const 43
                local.get 2
                i32.const 136
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 2
              local.get 2
              i32.load8_u offset=59
              i32.store8 offset=139
              local.get 2
              local.get 2
              i32.load16_u offset=57 align=1
              i32.store16 offset=137 align=1
              local.get 2
              local.get 2
              i32.load offset=68
              i32.store offset=148
              local.get 2
              local.get 2
              i64.load offset=60 align=4
              i64.store offset=140 align=4
              local.get 2
              local.get 3
              i32.store8 offset=136
              i32.const 1063112
              i32.const 43
              local.get 2
              i32.const 136
              i32.add
              i32.const 1063096
              i32.const 1063156
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 2
            local.get 2
            i32.load8_u offset=59
            i32.store8 offset=139
            local.get 2
            local.get 2
            i32.load16_u offset=57 align=1
            i32.store16 offset=137 align=1
            local.get 2
            local.get 2
            i32.load offset=68
            i32.store offset=148
            local.get 2
            local.get 2
            i64.load offset=60 align=4
            i64.store offset=140 align=4
            local.get 2
            local.get 8
            i32.store8 offset=136
            i32.const 1063112
            i32.const 43
            local.get 2
            i32.const 136
            i32.add
            i32.const 1063096
            i32.const 1063156
            call $core::result::unwrap_failed
            unreachable
          end
          local.get 1
          i64.load32_u offset=8
          local.set 6
        end
        local.get 2
        i32.const 0
        i32.store8 offset=40
        local.get 2
        local.get 6
        i64.store offset=72
        local.get 2
        local.get 11
        i32.store offset=68
        local.get 2
        local.get 12
        i32.store8 offset=65
        local.get 2
        local.get 8
        i32.store8 offset=64
        local.get 2
        i64.const 4294967296
        i64.store offset=56
        local.get 2
        local.get 2
        i32.const 40
        i32.add
        i32.store offset=80
        local.get 2
        i32.const 24
        i32.add
        local.get 2
        i32.const 56
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 2
        local.get 2
        i32.load offset=28
        local.tee 12
        i32.store offset=140
        local.get 2
        local.get 2
        i32.load offset=24
        local.tee 11
        i32.store offset=136
        block ;; label = @3
          block ;; label = @4
            local.get 2
            i32.load8_u offset=40
            i32.const 1
            i32.ne
            br_if 0 (;@4;)
            local.get 11
            local.get 11
            i32.load
            i32.const -1
            i32.add
            local.tee 1
            i32.store
            local.get 1
            br_if 1 (;@3;)
            local.get 2
            i32.const 136
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
            br 1 (;@3;)
          end
          local.get 11
          i32.eqz
          br_if 0 (;@3;)
          i32.const 26
          i32.const 0
          local.get 11
          local.get 12
          i32.const 1056886
          i32.const 11
          call $<nanvm_lib::naive::function::Function>::new
          local.set 11
          local.get 2
          i32.const 0
          i32.store8 offset=40
          local.get 2
          local.get 11
          i32.store offset=100
          local.get 2
          i32.const 7
          i32.store8 offset=96
          local.get 2
          local.get 9
          i32.store offset=92
          local.get 2
          local.get 10
          i32.store offset=88
          local.get 2
          local.get 7
          i32.store offset=80
          local.get 2
          local.get 3
          i32.store offset=76
          local.get 2
          i32.const 5
          i32.store8 offset=72
          local.get 2
          local.get 4
          i32.store offset=68
          local.get 2
          local.get 5
          i32.store offset=64
          local.get 2
          i64.const 8589934592
          i64.store offset=56
          local.get 2
          local.get 2
          i32.const 40
          i32.add
          i32.store offset=112
          local.get 2
          i32.const 16
          i32.add
          local.get 2
          i32.const 56
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 2>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=20
          local.tee 11
          i32.store offset=140
          local.get 2
          local.get 2
          i32.load offset=16
          local.tee 3
          i32.store offset=136
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=40
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 3
              local.get 3
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 1 (;@4;)
              local.get 2
              i32.const 136
              i32.add
              call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            local.get 2
            local.get 11
            i32.store offset=48
            local.get 2
            local.get 3
            i32.store offset=44
            local.get 2
            i32.const 5
            i32.store8 offset=40
            local.get 2
            i32.const 0
            i32.store16 offset=132
            local.get 2
            i32.const 1056904
            i32.store offset=128
            local.get 2
            i32.const 1056897
            i32.store offset=124
            local.get 2
            i32.const 56
            i32.add
            local.get 2
            i32.const 124
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=56
                  local.tee 4
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 2
                  i32.load offset=64
                  local.set 5
                  local.get 2
                  i32.load offset=60
                  local.set 7
                  local.get 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 4
                  i32.store
                  local.get 4
                  i32.eqz
                  br_if 5 (;@2;)
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  local.get 8
                                  br_table 6 (;@9;) 6 (;@9;) 0 (;@15;) 1 (;@14;) 2 (;@13;) 3 (;@12;) 4 (;@11;) 5 (;@10;) 6 (;@9;)
                                end
                                local.get 1
                                i64.load offset=8
                                local.set 6
                                br 9 (;@5;)
                              end
                              local.get 1
                              i32.load offset=4
                              local.tee 4
                              local.get 4
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 9
                              i32.store
                              local.get 9
                              i32.eqz
                              br_if 11 (;@2;)
                              br 7 (;@6;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 4
                            local.get 4
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 10 (;@2;)
                            local.get 1
                            i64.load8_u offset=12
                            i64.const 32
                            i64.shl
                            local.get 1
                            i64.load32_u offset=8
                            i64.or
                            local.set 6
                            br 7 (;@5;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 4
                          local.get 4
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 9 (;@2;)
                          br 5 (;@6;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 4
                        local.get 4
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 8 (;@2;)
                        br 4 (;@6;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 4
                      local.get 4
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 7 (;@2;)
                      br 1 (;@8;)
                    end
                    local.get 1
                    i32.load8_u offset=1
                    local.set 9
                  end
                  br 2 (;@5;)
                end
                local.get 2
                local.get 2
                i32.load8_u offset=59
                i32.store8 offset=139
                local.get 2
                local.get 2
                i32.load16_u offset=57 align=1
                i32.store16 offset=137 align=1
                local.get 2
                local.get 2
                i32.load offset=68
                i32.store offset=148
                local.get 2
                local.get 2
                i64.load offset=60 align=4
                i64.store offset=140 align=4
                local.get 2
                local.get 4
                i32.store8 offset=136
                i32.const 1063112
                i32.const 43
                local.get 2
                i32.const 136
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              local.get 1
              i64.load32_u offset=8
              local.set 6
            end
            local.get 2
            i32.const 0
            i32.store8 offset=124
            local.get 2
            local.get 6
            i64.store offset=88
            local.get 2
            local.get 4
            i32.store offset=84
            local.get 2
            local.get 9
            i32.store8 offset=81
            local.get 2
            local.get 8
            i32.store8 offset=80
            local.get 2
            local.get 11
            i64.extend_i32_u
            i64.store offset=72
            local.get 2
            local.get 3
            i32.store offset=68
            local.get 2
            i32.const 5
            i32.store8 offset=64
            local.get 2
            i64.const 8589934592
            i64.store offset=56
            local.get 2
            local.get 2
            i32.const 124
            i32.add
            i32.store offset=96
            local.get 2
            i32.const 8
            i32.add
            local.get 2
            i32.const 56
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 2
            local.get 2
            i32.load offset=12
            local.tee 8
            i32.store offset=140
            local.get 2
            local.get 2
            i32.load offset=8
            local.tee 3
            i32.store offset=136
            block ;; label = @5
              block ;; label = @6
                local.get 2
                i32.load8_u offset=124
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
                i32.const 136
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 1 (;@5;)
              end
              local.get 3
              i32.eqz
              br_if 0 (;@5;)
              i32.const 27
              i32.const 0
              local.get 3
              local.get 8
              i32.const 1056904
              i32.const 82
              call $<nanvm_lib::naive::function::Function>::new
              local.set 3
              local.get 2
              i32.const 0
              i32.store8 offset=124
              local.get 2
              local.get 3
              i32.store offset=76
              local.get 2
              i32.const 7
              i32.store8 offset=72
              local.get 2
              local.get 5
              i32.store offset=68
              local.get 2
              local.get 7
              i32.store offset=64
              local.get 2
              i64.const 4294967296
              i64.store offset=56
              local.get 2
              local.get 2
              i32.const 124
              i32.add
              i32.store offset=88
              local.get 2
              local.get 2
              i32.const 56
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=4
              local.tee 8
              i32.store offset=140
              local.get 2
              local.get 2
              i32.load
              local.tee 3
              i32.store offset=136
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=124
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
                  i32.const 136
                  i32.add
                  call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                  br 1 (;@6;)
                end
                local.get 3
                i32.eqz
                br_if 0 (;@6;)
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
                call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 1
                call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
  (func $"<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;223;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 32
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
      local.get 2
      i32.load
      local.tee 5
      i32.const -1
      i32.eq
      br_if 0 (;@1;)
      local.get 2
      local.get 5
      i32.const 2
      i32.add
      local.tee 5
      i32.store
      local.get 4
      local.get 3
      i32.store offset=24
      local.get 4
      local.get 2
      i32.store offset=20
      local.get 4
      i32.const 6
      i32.store8 offset=16
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      local.get 0
      local.get 2
      i32.store offset=12
      local.get 0
      i32.const 6
      i32.store8 offset=8
      local.get 0
      i64.const 0
      i64.store
      local.get 0
      local.get 3
      i64.extend_i32_u
      i64.store offset=16
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
      block ;; label = @2
        local.get 0
        br_if 0 (;@2;)
        local.get 4
        i32.const 8
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
      end
      local.get 4
      i32.const 32
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
  (func $"<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;224;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32 f64 i32)
    global.get $__stack_pointer
    i32.const 496
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
      i32.const 0
      i32.store8 offset=280
      local.get 4
      i32.const 0
      i32.store16 offset=448
      local.get 4
      local.get 7
      i64.store offset=440
      local.get 4
      local.get 3
      i32.store offset=436
      local.get 4
      local.get 5
      i32.store8 offset=433
      local.get 4
      local.get 6
      i32.store8 offset=432
      local.get 4
      i64.const 8589934592
      i64.store offset=424
      local.get 4
      local.get 4
      i32.const 280
      i32.add
      i32.store offset=464
      local.get 4
      i32.const 8
      i32.add
      local.get 4
      i32.const 424
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=12
      local.tee 5
      i32.store offset=372
      local.get 4
      local.get 4
      i32.load offset=8
      local.tee 3
      i32.store offset=368
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=280
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 3
          local.get 3
          i32.load
          i32.const -1
          i32.add
          local.tee 2
          i32.store
          local.get 2
          br_if 1 (;@2;)
          local.get 4
          i32.const 368
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 3
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        local.get 5
        i32.store offset=320
        local.get 4
        local.get 3
        i32.store offset=316
        local.get 4
        i32.const 6
        i32.store8 offset=312
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
                            local.get 4
                            i32.load8_u offset=24
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 4
                          i64.load offset=32
                          local.set 7
                          br 8 (;@3;)
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
                        br 6 (;@4;)
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
                      local.get 4
                      i64.load8_u offset=36
                      i64.const 32
                      i64.shl
                      local.get 4
                      i64.load32_u offset=32
                      i64.or
                      local.set 7
                      br 6 (;@3;)
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
                    br_if 7 (;@1;)
                    br 4 (;@4;)
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
                  br_if 6 (;@1;)
                  br 3 (;@4;)
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
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 4
              i32.load8_u offset=25
              local.set 6
            end
            br 1 (;@3;)
          end
          local.get 4
          i64.load32_u offset=32
          local.set 7
        end
        local.get 4
        local.get 7
        i64.store offset=376
        local.get 4
        local.get 3
        i32.store offset=372
        local.get 4
        local.get 6
        i32.store8 offset=369
        local.get 4
        local.get 5
        i32.store8 offset=368
        local.get 4
        i64.const 0
        i64.store offset=432
        local.get 4
        i32.const 2
        i32.store8 offset=424
        local.get 4
        i32.const 184
        i32.add
        local.get 4
        i32.const 368
        i32.add
        local.get 4
        i32.const 424
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
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
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=208
                  i64.store offset=448
                  local.get 4
                  local.get 4
                  i64.load offset=200
                  i64.store offset=440
                  local.get 4
                  local.get 4
                  i64.load offset=192
                  i64.store offset=432
                  local.get 4
                  local.get 4
                  i64.load offset=184
                  i64.store offset=424
                  local.get 4
                  i32.const 368
                  i32.add
                  local.get 4
                  i32.const 424
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=368
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=376
                      i64.store offset=64
                      local.get 4
                      local.get 4
                      i64.load offset=368
                      i64.store offset=56
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=56
                  end
                  local.get 4
                  i32.const 424
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 440
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 424
                  i32.add
                  local.get 4
                  i32.const 56
                  i32.add
                  call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::to_numeric
                  local.get 4
                  f64.load offset=440
                  local.set 9
                  local.get 4
                  i32.load offset=436
                  local.set 3
                  local.get 4
                  i32.load offset=432
                  local.set 5
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load offset=424
                        br_if 0 (;@10;)
                        block ;; label = @11
                          local.get 5
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 9
                          f64.store offset=428 align=4
                          local.get 4
                          local.get 3
                          i32.store offset=424
                          local.get 4
                          i32.const 424
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
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 424
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                        end
                        local.get 4
                        local.get 9
                        f64.store offset=80
                        local.get 4
                        i32.const 2
                        i32.store offset=72
                        local.get 4
                        i32.const 216
                        i32.add
                        local.get 4
                        i32.const 312
                        i32.add
                        local.get 4
                        i32.const 72
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=216
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i64.load offset=232
                          i64.store offset=16
                          local.get 0
                          local.get 4
                          i64.load offset=224
                          i64.store offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 4 (;@7;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=240
                        i64.store offset=448
                        local.get 4
                        local.get 4
                        i64.load offset=232
                        i64.store offset=440
                        local.get 4
                        local.get 4
                        i64.load offset=224
                        i64.store offset=432
                        local.get 4
                        local.get 4
                        i64.load offset=216
                        i64.store offset=424
                        local.get 4
                        i32.const 368
                        i32.add
                        local.get 4
                        i32.const 424
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=368
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=376
                            i64.store offset=48
                            local.get 4
                            local.get 4
                            i64.load offset=368
                            i64.store offset=40
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=40
                        end
                        local.get 4
                        i32.const 424
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 440
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        local.get 4
                                        i32.load8_u offset=40
                                        local.tee 5
                                        br_table 6 (;@12;) 6 (;@12;) 0 (;@18;) 1 (;@17;) 2 (;@16;) 3 (;@15;) 4 (;@14;) 5 (;@13;) 6 (;@12;)
                                      end
                                      local.get 4
                                      i64.load offset=48
                                      local.set 7
                                      br 9 (;@8;)
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
                                    br_if 15 (;@1;)
                                    br 7 (;@9;)
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
                                  br_if 14 (;@1;)
                                  local.get 4
                                  i64.load8_u offset=52
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=48
                                  i64.or
                                  local.set 7
                                  br 7 (;@8;)
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
                                br_if 13 (;@1;)
                                br 5 (;@9;)
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
                              br_if 12 (;@1;)
                              br 4 (;@9;)
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
                            br_if 11 (;@1;)
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=41
                          local.set 6
                        end
                        br 2 (;@8;)
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
                      i32.const 312
                      i32.add
                      call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      br 2 (;@7;)
                    end
                    local.get 4
                    i64.load32_u offset=48
                    local.set 7
                  end
                  local.get 4
                  local.get 7
                  i64.store offset=440
                  local.get 4
                  local.get 3
                  i32.store offset=436
                  local.get 4
                  local.get 6
                  i32.store8 offset=433
                  local.get 4
                  local.get 5
                  i32.store8 offset=432
                  local.get 4
                  i64.const 0
                  i64.store offset=424
                  local.get 4
                  i32.const 248
                  i32.add
                  local.get 4
                  i32.const 424
                  i32.add
                  call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::option_dot::<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#0}>"
                  local.get 4
                  i32.const 280
                  i32.add
                  local.get 4
                  i32.const 248
                  i32.add
                  call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::step::<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::dot<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#1}>::{closure#0}>"
                  i32.const 0
                  local.set 3
                  i32.const 1
                  local.set 5
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              local.get 4
                              i32.load8_u offset=280
                              local.tee 6
                              i32.const -7
                              i32.add
                              i32.const 0
                              local.get 6
                              i32.const 7
                              i32.gt_u
                              select
                              br_table 0 (;@13;) 1 (;@12;) 2 (;@11;) 0 (;@13;)
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=304
                            i64.store offset=448
                            local.get 4
                            local.get 4
                            i64.load offset=296
                            i64.store offset=440
                            local.get 4
                            local.get 4
                            i64.load offset=288
                            i64.store offset=432
                            local.get 4
                            local.get 4
                            i64.load offset=280
                            i64.store offset=424
                            local.get 4
                            i32.const 368
                            i32.add
                            local.get 4
                            i32.const 424
                            i32.add
                            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load8_u offset=368
                                local.tee 3
                                i32.const 255
                                i32.ne
                                br_if 0 (;@14;)
                                i32.const 1
                                local.set 5
                                i32.const 0
                                local.set 3
                                br 1 (;@13;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=370 align=2
                              i64.store offset=312
                              local.get 4
                              local.get 4
                              i64.load offset=376 align=2
                              i64.store offset=318 align=2
                              local.get 4
                              i32.load8_u offset=369
                              local.set 5
                            end
                            local.get 4
                            i32.const 424
                            i32.add
                            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            i32.const 440
                            i32.add
                            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                            local.get 4
                            local.get 4
                            i64.load offset=318 align=2
                            i64.store offset=406 align=2
                            local.get 4
                            local.get 4
                            i64.load offset=312
                            i64.store offset=400
                          end
                          local.get 4
                          local.get 4
                          i64.load offset=406 align=2
                          i64.store offset=110 align=2
                          local.get 4
                          local.get 4
                          i64.load offset=400
                          i64.store offset=104
                          local.get 4
                          local.get 5
                          i32.store8 offset=89
                          local.get 4
                          local.get 3
                          i32.store8 offset=88
                          local.get 4
                          local.get 4
                          i64.load offset=104
                          i64.store offset=90 align=2
                          local.get 4
                          local.get 4
                          i64.load offset=110 align=2
                          i64.store offset=96 align=2
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          local.get 4
                                          i32.load8_u offset=40
                                          local.tee 5
                                          br_table 6 (;@13;) 6 (;@13;) 0 (;@19;) 1 (;@18;) 2 (;@17;) 3 (;@16;) 4 (;@15;) 5 (;@14;) 6 (;@13;)
                                        end
                                        local.get 4
                                        i64.load offset=48
                                        local.set 7
                                        br 9 (;@9;)
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
                                      br_if 16 (;@1;)
                                      br 7 (;@10;)
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
                                    br_if 15 (;@1;)
                                    local.get 4
                                    i64.load8_u offset=52
                                    i64.const 32
                                    i64.shl
                                    local.get 4
                                    i64.load32_u offset=48
                                    i64.or
                                    local.set 7
                                    br 7 (;@9;)
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
                                  br_if 14 (;@1;)
                                  br 5 (;@10;)
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
                                br_if 13 (;@1;)
                                br 4 (;@10;)
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
                              br_if 12 (;@1;)
                              br 1 (;@12;)
                            end
                            local.get 4
                            i32.load8_u offset=41
                            local.set 6
                          end
                          br 2 (;@9;)
                        end
                        local.get 0
                        local.get 4
                        i32.load16_u offset=288
                        i32.store16 offset=8
                        local.get 0
                        local.get 4
                        i64.load offset=290 align=2
                        i64.store offset=10 align=2
                        local.get 0
                        local.get 4
                        i64.load offset=296 align=2
                        i64.store offset=16 align=2
                        local.get 0
                        i64.const 1
                        i64.store
                        br 2 (;@8;)
                      end
                      local.get 4
                      i64.load32_u offset=48
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=440
                    local.get 4
                    local.get 3
                    i32.store offset=436
                    local.get 4
                    local.get 6
                    i32.store8 offset=433
                    local.get 4
                    local.get 5
                    i32.store8 offset=432
                    local.get 4
                    i64.const 0
                    i64.store offset=424
                    local.get 4
                    i32.const 312
                    i32.add
                    local.get 4
                    i32.const 424
                    i32.add
                    call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::option_dot::<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#2}>"
                    i32.const 1
                    local.set 3
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 1
                          i32.load offset=16
                          local.tee 5
                          i32.const 1
                          i32.le_u
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 344
                          i32.add
                          local.get 4
                          i32.const 312
                          i32.add
                          local.get 1
                          i32.load offset=12
                          i32.const 24
                          i32.add
                          call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::step::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::call<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#3}>::{closure#0}>"
                          i32.const 0
                          local.set 5
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 4
                                i32.load offset=344
                                br_table 0 (;@14;) 1 (;@13;) 2 (;@12;) 0 (;@14;)
                              end
                              local.get 4
                              local.get 4
                              i64.load offset=354 align=2
                              i64.store offset=368
                              local.get 4
                              local.get 4
                              i64.load offset=360 align=2
                              i64.store offset=374 align=2
                              local.get 4
                              i32.load8_u offset=353
                              local.set 3
                              local.get 4
                              i32.load8_u offset=352
                              local.set 5
                            end
                            local.get 4
                            local.get 4
                            i64.load offset=374 align=2
                            i64.store offset=142 align=2
                            local.get 4
                            local.get 4
                            i64.load offset=368
                            i64.store offset=136
                            local.get 4
                            local.get 3
                            i32.store8 offset=121
                            local.get 4
                            local.get 5
                            i32.store8 offset=120
                            local.get 4
                            local.get 4
                            i64.load offset=136
                            i64.store offset=122 align=2
                            local.get 4
                            local.get 4
                            i64.load offset=142 align=2
                            i64.store offset=128 align=2
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    block ;; label = @17
                                      block ;; label = @18
                                        block ;; label = @19
                                          block ;; label = @20
                                            local.get 4
                                            i32.load8_u offset=40
                                            local.tee 8
                                            br_table 6 (;@14;) 6 (;@14;) 0 (;@20;) 1 (;@19;) 2 (;@18;) 3 (;@17;) 4 (;@16;) 5 (;@15;) 6 (;@14;)
                                          end
                                          local.get 4
                                          i64.load offset=48
                                          local.set 7
                                          br 10 (;@9;)
                                        end
                                        local.get 4
                                        i32.load offset=44
                                        local.tee 6
                                        local.get 6
                                        i32.load
                                        i32.const 1
                                        i32.add
                                        local.tee 10
                                        i32.store
                                        local.get 10
                                        i32.eqz
                                        br_if 17 (;@1;)
                                        br 8 (;@10;)
                                      end
                                      local.get 4
                                      i32.load offset=44
                                      local.tee 6
                                      local.get 6
                                      i32.load
                                      i32.const 1
                                      i32.add
                                      local.tee 10
                                      i32.store
                                      local.get 10
                                      i32.eqz
                                      br_if 16 (;@1;)
                                      local.get 4
                                      i64.load8_u offset=52
                                      i64.const 32
                                      i64.shl
                                      local.get 4
                                      i64.load32_u offset=48
                                      i64.or
                                      local.set 7
                                      br 8 (;@9;)
                                    end
                                    local.get 4
                                    i32.load offset=44
                                    local.tee 6
                                    local.get 6
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 10
                                    i32.store
                                    local.get 10
                                    i32.eqz
                                    br_if 15 (;@1;)
                                    br 6 (;@10;)
                                  end
                                  local.get 4
                                  i32.load offset=44
                                  local.tee 6
                                  local.get 6
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 10
                                  i32.store
                                  local.get 10
                                  i32.eqz
                                  br_if 14 (;@1;)
                                  br 5 (;@10;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 6
                                local.get 6
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 10
                                i32.store
                                local.get 10
                                i32.eqz
                                br_if 13 (;@1;)
                                br 1 (;@13;)
                              end
                              local.get 4
                              i32.load8_u offset=41
                              local.set 10
                            end
                            br 3 (;@9;)
                          end
                          local.get 0
                          local.get 4
                          i32.load16_u offset=352
                          i32.store16 offset=8
                          local.get 0
                          local.get 4
                          i64.load offset=354 align=2
                          i64.store offset=10 align=2
                          local.get 0
                          local.get 4
                          i64.load offset=360 align=2
                          i64.store offset=16 align=2
                          local.get 0
                          i64.const 1
                          i64.store
                          local.get 4
                          i32.const 88
                          i32.add
                          call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                          br 3 (;@8;)
                        end
                        i32.const 1
                        local.get 5
                        i32.const 1065308
                        call $core::panicking::panic_bounds_check
                        unreachable
                      end
                      local.get 4
                      i64.load32_u offset=48
                      local.set 7
                    end
                    local.get 4
                    local.get 7
                    i64.store offset=440
                    local.get 4
                    local.get 6
                    i32.store offset=436
                    local.get 4
                    local.get 10
                    i32.store8 offset=433
                    local.get 4
                    local.get 8
                    i32.store8 offset=432
                    local.get 4
                    i64.const 0
                    i64.store offset=424
                    local.get 4
                    i32.const 368
                    i32.add
                    local.get 4
                    i32.const 424
                    i32.add
                    call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::option_dot::<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#2}>"
                    i32.const 1
                    local.set 6
                    local.get 1
                    i32.load offset=16
                    local.tee 8
                    i32.const 1
                    i32.le_u
                    br_if 2 (;@6;)
                    local.get 4
                    i32.const 400
                    i32.add
                    local.get 4
                    i32.const 368
                    i32.add
                    local.get 1
                    i32.load offset=12
                    i32.const 24
                    i32.add
                    local.tee 1
                    local.get 1
                    call $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::guarded::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::option_call<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#5}>::{closure#0}>"
                    i32.const 0
                    local.set 1
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load offset=400
                          br_table 1 (;@10;) 2 (;@9;) 0 (;@11;) 1 (;@10;)
                        end
                        local.get 0
                        local.get 4
                        i32.load16_u offset=408
                        i32.store16 offset=8
                        local.get 0
                        local.get 4
                        i64.load offset=410 align=2
                        i64.store offset=10 align=2
                        local.get 0
                        local.get 4
                        i64.load offset=416 align=2
                        i64.store offset=16 align=2
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 120
                        i32.add
                        call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 88
                        i32.add
                        call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 2 (;@8;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=410 align=2
                      i64.store offset=168
                      local.get 4
                      local.get 4
                      i64.load offset=416 align=2
                      i64.store offset=174 align=2
                      local.get 4
                      i32.load8_u offset=409
                      local.set 6
                      local.get 4
                      i32.load8_u offset=408
                      local.set 1
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=174 align=2
                    i64.store offset=158 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=168
                    i64.store offset=152
                    local.get 4
                    local.get 4
                    i64.load offset=158 align=2
                    i64.store offset=472 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=466 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=88
                    i64.store offset=432
                    local.get 4
                    local.get 4
                    i64.load offset=96
                    i64.store offset=440
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    i64.store offset=450 align=2
                    local.get 4
                    local.get 4
                    i64.load offset=142 align=2
                    i64.store offset=456 align=2
                    local.get 4
                    i32.const 0
                    i32.store8 offset=88
                    local.get 4
                    local.get 6
                    i32.store8 offset=465
                    local.get 4
                    local.get 1
                    i32.store8 offset=464
                    local.get 4
                    local.get 3
                    i32.store8 offset=449
                    local.get 4
                    local.get 5
                    i32.store8 offset=448
                    local.get 4
                    i64.const 12884901888
                    i64.store offset=424
                    local.get 4
                    local.get 4
                    i32.const 88
                    i32.add
                    i32.store offset=480
                    local.get 4
                    local.get 4
                    i32.const 424
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=4
                    local.tee 3
                    i32.store offset=124
                    local.get 4
                    local.get 4
                    i32.load
                    local.tee 1
                    i32.store offset=120
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=88
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
                      br_if 6 (;@3;)
                      local.get 4
                      i32.const 120
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 6 (;@3;)
                    end
                    local.get 1
                    i32.eqz
                    br_if 5 (;@3;)
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
                    i32.const 40
                    i32.add
                    call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 24
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
                    br_if 4 (;@4;)
                    br 3 (;@5;)
                  end
                  local.get 4
                  i32.const 40
                  i32.add
                  call $"#func220 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 24
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
                br_if 1 (;@5;)
                br 2 (;@4;)
              end
              i32.const 1
              local.get 8
              i32.const 1065308
              call $core::panicking::panic_bounds_check
              unreachable
            end
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 496
          i32.add
          global.set $__stack_pointer
          return
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 495
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 495
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::step::<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::dot<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#1}>::{closure#0}>" (;535;) (type 1) (param i32 i32)
    (local i32 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 1
                i32.load8_u
                local.tee 3
                i32.const -7
                i32.add
                i32.const 0
                local.get 3
                i32.const 7
                i32.gt_u
                select
                br_table 0 (;@6;) 1 (;@5;) 2 (;@4;) 0 (;@6;)
              end
              local.get 2
              i32.const 0
              i32.store16 offset=72
              local.get 2
              i32.const 1064348
              i32.store offset=68
              local.get 2
              i32.const 1064347
              i32.store offset=64
              local.get 2
              i32.const 80
              i32.add
              local.get 2
              i32.const 64
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              local.get 2
              i32.load8_u offset=80
              local.tee 3
              i32.const 255
              i32.ne
              br_if 4 (;@1;)
              local.get 2
              local.get 2
              i64.load offset=84 align=4
              i64.store offset=52 align=4
              local.get 2
              i32.const 3
              i32.store8 offset=48
              local.get 2
              i64.const 0
              i64.store offset=40
              local.get 2
              local.get 1
              i64.load offset=24
              i64.store offset=104
              local.get 2
              local.get 1
              i64.load offset=16
              i64.store offset=96
              local.get 2
              local.get 1
              i64.load offset=8
              i64.store offset=88
              local.get 2
              local.get 1
              i64.load
              i64.store offset=80
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 80
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              local.get 2
              i32.const 48
              i32.add
              local.set 1
              block ;; label = @6
                block ;; label = @7
                  local.get 2
                  i32.load8_u offset=8
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 2
                  local.get 2
                  i64.load offset=16
                  i64.store offset=72
                  local.get 2
                  local.get 2
                  i64.load offset=8
                  i64.store offset=64
                  br 1 (;@6;)
                end
                local.get 2
                i32.const 256
                i32.store16 offset=64
              end
              local.get 2
              i32.const 80
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              i32.const 96
              i32.add
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 64
              i32.add
              local.get 1
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              local.get 2
              i32.load8_u offset=8
              i32.const 255
              i32.ne
              br_if 2 (;@3;)
              local.get 0
              local.get 2
              i64.load offset=24
              i64.store offset=16
              local.get 0
              local.get 2
              i64.load offset=16
              i64.store offset=8
              local.get 0
              i32.const 9
              i32.store8
              br 3 (;@2;)
            end
            local.get 0
            i32.const 8
            i32.store8
            br 2 (;@2;)
          end
          local.get 0
          i32.const 9
          i32.store8
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
        local.get 0
        local.get 2
        i64.load offset=32
        i64.store offset=24
        local.get 0
        local.get 2
        i64.load offset=24
        i64.store offset=16
        local.get 0
        local.get 2
        i64.load offset=16
        i64.store offset=8
        local.get 0
        local.get 2
        i64.load offset=8
        i64.store
      end
      local.get 2
      i32.const 112
      i32.add
      global.set $__stack_pointer
      return
    end
    local.get 2
    local.get 2
    i32.load8_u offset=83
    i32.store8 offset=11
    local.get 2
    local.get 2
    i32.load16_u offset=81 align=1
    i32.store16 offset=9 align=1
    local.get 2
    local.get 2
    i32.load offset=92
    i32.store offset=20
    local.get 2
    local.get 2
    i64.load offset=84 align=4
    i64.store offset=12 align=4
    local.get 2
    local.get 3
    i32.store8 offset=8
    i32.const 1063112
    i32.const 43
    local.get 2
    i32.const 8
    i32.add
    i32.const 1063096
    i32.const 1063156
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::step::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::call<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#3}>::{closure#0}>" (;539;) (type 4) (param i32 i32 i32)
    (local i32 i32 i32)
    global.get $__stack_pointer
    i32.const 96
    i32.sub
    local.tee 3
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 1
              i32.load8_u
              local.tee 4
              i32.const -7
              i32.add
              i32.const 0
              local.get 4
              i32.const 7
              i32.gt_u
              select
              br_table 0 (;@5;) 1 (;@4;) 2 (;@3;) 0 (;@5;)
            end
            local.get 3
            i32.const 0
            i32.store8 offset=40
            local.get 3
            i64.const 4611686018427387904
            i64.store offset=72
            local.get 3
            i32.const 2
            i32.store8 offset=64
            local.get 3
            i64.const 4294967296
            i64.store offset=56
            local.get 3
            local.get 3
            i32.const 40
            i32.add
            i32.store offset=80
            local.get 3
            i32.const 8
            i32.add
            local.get 3
            i32.const 56
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 3
            local.get 3
            i32.load offset=12
            local.tee 5
            i32.store offset=20
            local.get 3
            local.get 3
            i32.load offset=8
            local.tee 4
            i32.store offset=16
            block ;; label = @5
              local.get 3
              i32.load8_u offset=40
              i32.const 1
              i32.ne
              br_if 0 (;@5;)
              local.get 4
              local.get 4
              i32.load
              i32.const -1
              i32.add
              local.tee 1
              i32.store
              local.get 1
              br_if 4 (;@1;)
              local.get 3
              i32.const 16
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 4 (;@1;)
            end
            local.get 4
            i32.eqz
            br_if 3 (;@1;)
            local.get 3
            local.get 4
            i32.store offset=28
            local.get 3
            i32.const 6
            i32.store8 offset=24
            local.get 3
            local.get 5
            i32.store offset=32
            local.get 3
            i64.const 0
            i64.store offset=16
            local.get 3
            local.get 3
            i64.load offset=32
            i64.store offset=48
            local.get 3
            local.get 3
            i64.load offset=24
            i64.store offset=40
            local.get 3
            local.get 1
            i64.load offset=24
            i64.store offset=80
            local.get 3
            local.get 1
            i64.load offset=16
            i64.store offset=72
            local.get 3
            local.get 1
            i64.load offset=8
            i64.store offset=64
            local.get 3
            local.get 1
            i64.load
            i64.store offset=56
            local.get 3
            i32.const 16
            i32.add
            local.get 3
            i32.const 56
            i32.add
            local.get 2
            local.get 3
            i32.const 40
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
            local.get 0
            local.get 3
            i64.load offset=24
            i64.store offset=8
            local.get 0
            local.get 3
            i64.load offset=32
            i64.store offset=16
            local.get 0
            local.get 3
            i64.load offset=16
            i64.const 1
            i64.shl
            i64.store
            br 2 (;@2;)
          end
          local.get 0
          i64.const 1
          i64.store
          br 1 (;@2;)
        end
        local.get 0
        i64.const 2
        i64.store
        local.get 0
        local.get 1
        i64.load offset=16
        i64.store offset=16
        local.get 0
        local.get 1
        i64.load offset=8
        i64.store offset=8
      end
      local.get 3
      i32.const 96
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 3
    i32.const 95
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::guarded::<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, <nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>>::option_call<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#5}>::{closure#0}>" (;541;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64)
    global.get $__stack_pointer
    i32.const 176
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 1
                    i32.load8_u
                    local.tee 5
                    i32.const -7
                    i32.add
                    i32.const 0
                    local.get 5
                    i32.const 7
                    i32.gt_u
                    select
                    br_table 0 (;@8;) 1 (;@7;) 2 (;@6;) 0 (;@8;)
                  end
                  local.get 4
                  local.get 1
                  i64.load offset=24
                  i64.store offset=40
                  local.get 4
                  local.get 1
                  i64.load offset=16
                  i64.store offset=32
                  local.get 4
                  local.get 1
                  i64.load offset=8
                  i64.store offset=24
                  local.get 4
                  local.get 1
                  i64.load
                  i64.store offset=16
                  local.get 4
                  i32.const 96
                  i32.add
                  local.get 4
                  i32.const 16
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=96
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=104
                    i64.store offset=144
                    local.get 4
                    local.get 4
                    i64.load offset=96
                    i64.store offset=136
                    local.get 4
                    i32.const 136
                    i32.add
                    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::is_nullish
                    local.set 1
                    local.get 4
                    i32.const 136
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 1
                    i32.eqz
                    br_if 5 (;@3;)
                    i64.const 1
                    local.set 6
                    br 4 (;@4;)
                  end
                  local.get 4
                  i32.const 82
                  i32.add
                  local.set 5
                  local.get 4
                  i32.const 72
                  i32.add
                  local.get 1
                  local.get 2
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::body
                  local.get 4
                  i32.load8_u offset=81
                  local.set 2
                  local.get 4
                  i32.load8_u offset=80
                  local.set 1
                  local.get 4
                  i32.load offset=72
                  br_if 2 (;@5;)
                  local.get 4
                  local.get 2
                  i32.store8 offset=137
                  local.get 4
                  local.get 5
                  i64.load align=2
                  i64.store offset=138 align=2
                  local.get 4
                  local.get 5
                  i64.load offset=6 align=2
                  i64.store offset=144 align=2
                  local.get 4
                  local.get 1
                  i32.store8 offset=136
                  block ;; label = @8
                    local.get 1
                    i32.const 255
                    i32.and
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 136
                    i32.add
                    call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    br 5 (;@3;)
                  end
                  local.get 4
                  i32.const 16
                  i32.add
                  local.get 4
                  i32.const 32
                  i32.add
                  call $nanvm_lib::vm::lambda::method::method::<nanvm_lib::naive::Naive>
                  br_if 4 (;@3;)
                  i64.const 1
                  local.set 6
                  br 3 (;@4;)
                end
                local.get 0
                i64.const 1
                i64.store
                br 4 (;@2;)
              end
              local.get 0
              i64.const 2
              i64.store
              local.get 0
              local.get 1
              i64.load offset=16
              i64.store offset=16
              local.get 0
              local.get 1
              i64.load offset=8
              i64.store offset=8
              br 3 (;@2;)
            end
            block ;; label = @5
              local.get 1
              i32.const 255
              i32.and
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 2
              i32.store8 offset=9
              local.get 0
              local.get 1
              i32.store8 offset=8
              local.get 0
              local.get 5
              i64.load offset=6 align=2
              i64.store offset=16 align=2
              local.get 0
              local.get 5
              i64.load align=2
              i64.store offset=10 align=2
              i64.const 2
              local.set 6
              br 1 (;@4;)
            end
            local.get 2
            i32.const 1
            i32.and
            i32.eqz
            br_if 1 (;@3;)
            i64.const 1
            local.set 6
          end
          local.get 0
          local.get 6
          i64.store
          local.get 4
          i32.const 16
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          local.get 4
          i32.const 32
          i32.add
          call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
          br 1 (;@2;)
        end
        local.get 4
        local.get 4
        i64.load offset=17 align=1
        i64.store offset=48
        local.get 4
        local.get 4
        i64.load offset=25 align=1
        i64.store offset=56
        local.get 4
        local.get 4
        i64.load offset=32 align=1
        i64.store offset=63 align=1
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=16
              local.tee 1
              i32.const -7
              i32.add
              i32.const 0
              local.get 1
              i32.const 7
              i32.gt_u
              select
              br_table 0 (;@5;) 1 (;@4;) 2 (;@3;) 0 (;@5;)
            end
            local.get 4
            i64.load offset=40
            local.set 6
            local.get 4
            i32.const 0
            i32.store8 offset=120
            local.get 4
            i64.const 4613937818241073152
            i64.store offset=152
            local.get 4
            i32.const 2
            i32.store8 offset=144
            local.get 4
            i64.const 4294967296
            i64.store offset=136
            local.get 4
            local.get 4
            i32.const 120
            i32.add
            i32.store offset=160
            local.get 4
            i32.const 8
            i32.add
            local.get 4
            i32.const 136
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
            local.get 4
            local.get 4
            i32.load offset=12
            local.tee 2
            i32.store offset=100
            local.get 4
            local.get 4
            i32.load offset=8
            local.tee 5
            i32.store offset=96
            block ;; label = @5
              local.get 4
              i32.load8_u offset=120
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
              br_if 4 (;@1;)
              local.get 4
              i32.const 96
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 4 (;@1;)
            end
            local.get 5
            i32.eqz
            br_if 3 (;@1;)
            local.get 4
            local.get 5
            i32.store offset=108
            local.get 4
            i32.const 6
            i32.store8 offset=104
            local.get 4
            local.get 2
            i32.store offset=112
            local.get 4
            i64.const 0
            i64.store offset=96
            local.get 4
            local.get 4
            i64.load offset=112
            i64.store offset=128
            local.get 4
            local.get 4
            i64.load offset=104
            i64.store offset=120
            local.get 4
            local.get 1
            i32.store8 offset=136
            local.get 4
            local.get 4
            i64.load offset=48
            i64.store offset=137 align=1
            local.get 4
            local.get 4
            i64.load offset=56
            i64.store offset=145 align=1
            local.get 4
            local.get 4
            i64.load offset=63 align=1
            i64.store offset=152 align=1
            local.get 4
            local.get 6
            i64.store offset=160
            local.get 4
            i32.const 96
            i32.add
            local.get 4
            i32.const 136
            i32.add
            local.get 3
            local.get 4
            i32.const 120
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
            local.get 0
            local.get 4
            i64.load offset=104
            i64.store offset=8
            local.get 0
            local.get 4
            i64.load offset=112
            i64.store offset=16
            local.get 0
            local.get 4
            i64.load offset=96
            i64.const 1
            i64.shl
            i64.store
            br 2 (;@2;)
          end
          local.get 0
          i64.const 1
          i64.store
          br 1 (;@2;)
        end
        local.get 0
        local.get 4
        i64.load offset=32
        i64.store offset=16
        local.get 0
        local.get 4
        i64.load offset=24
        i64.store offset=8
        local.get 0
        i64.const 2
        i64.store
      end
      local.get 4
      i32.const 176
      i32.add
      global.set $__stack_pointer
      return
    end
    i32.const 1059464
    i32.const 43
    local.get 4
    i32.const 175
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::option_dot::<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#0}>" (;543;) (type 1) (param i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 1
              i64.load
              local.tee 3
              i64.const 0
              i64.ne
              br_if 0 (;@5;)
              local.get 1
              i32.const 8
              i32.add
              local.tee 4
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::is_nullish
              br_if 2 (;@3;)
              local.get 2
              local.get 4
              i64.load offset=8
              i64.store offset=72
              local.get 2
              local.get 4
              i64.load
              i64.store offset=64
              local.get 2
              i32.const 0
              i32.store16 offset=92
              local.get 2
              i32.const 1064346
              i32.store offset=88
              local.get 2
              i32.const 1064345
              i32.store offset=84
              local.get 2
              i32.const 96
              i32.add
              local.get 2
              i32.const 84
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              local.get 2
              i32.load8_u offset=96
              local.tee 1
              i32.const 255
              i32.ne
              br_if 4 (;@1;)
              local.get 2
              local.get 2
              i64.load offset=100 align=4
              i64.store offset=52 align=4
              local.get 2
              i32.const 3
              i32.store8 offset=48
              local.get 2
              i64.const 0
              i64.store offset=40
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 64
              i32.add
              local.get 2
              i32.const 48
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              local.get 2
              i32.load8_u offset=8
              i32.const 255
              i32.ne
              br_if 1 (;@4;)
              local.get 0
              local.get 2
              i64.load offset=24
              i64.store offset=16
              local.get 0
              local.get 2
              i64.load offset=16
              i64.store offset=8
              local.get 0
              i32.const 9
              i32.store8
              br 3 (;@2;)
            end
            block ;; label = @5
              local.get 3
              i64.const 2
              i64.eq
              br_if 0 (;@5;)
              local.get 0
              i32.const 8
              i32.store8
              br 3 (;@2;)
            end
            local.get 0
            i32.const 9
            i32.store8
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 2 (;@2;)
          end
          local.get 0
          local.get 2
          i64.load offset=32
          i64.store offset=24
          local.get 0
          local.get 2
          i64.load offset=24
          i64.store offset=16
          local.get 0
          local.get 2
          i64.load offset=16
          i64.store offset=8
          local.get 0
          local.get 2
          i64.load offset=8
          i64.store
          br 1 (;@2;)
        end
        local.get 0
        i32.const 8
        i32.store8
        local.get 2
        local.get 4
        i64.load offset=8
        i64.store offset=16
        local.get 2
        local.get 4
        i64.load
        i64.store offset=8
        local.get 2
        i32.const 8
        i32.add
        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 1
        i64.load
        i64.const 1
        i64.le_u
        br_if 0 (;@2;)
        local.get 4
        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
      end
      local.get 2
      i32.const 112
      i32.add
      global.set $__stack_pointer
      return
    end
    local.get 2
    local.get 2
    i32.load8_u offset=99
    i32.store8 offset=43
    local.get 2
    local.get 2
    i32.load16_u offset=97 align=1
    i32.store16 offset=41 align=1
    local.get 2
    local.get 2
    i32.load offset=108
    i32.store offset=52
    local.get 2
    local.get 2
    i64.load offset=100 align=4
    i64.store offset=44 align=4
    local.get 2
    local.get 1
    i32.store8 offset=40
    i32.const 1063112
    i32.const 43
    local.get 2
    i32.const 40
    i32.add
    i32.const 1063096
    i32.const 1063156
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_lib::vm::lambda::Region<nanvm_lib::naive::Naive, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::option_dot::<nanvm_demos::samples::optional_chaining::module<nanvm_lib::naive::Naive>::{closure#1}::{closure#2}>" (;544;) (type 1) (param i32 i32)
    (local i32 i64 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    block ;; label = @1
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 1
              i64.load
              local.tee 3
              i64.const 0
              i64.ne
              br_if 0 (;@5;)
              local.get 1
              i32.const 8
              i32.add
              local.tee 4
              call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::is_nullish
              br_if 2 (;@3;)
              local.get 2
              local.get 4
              i64.load offset=8
              i64.store offset=72
              local.get 2
              local.get 4
              i64.load
              i64.store offset=64
              local.get 2
              i32.const 0
              i32.store16 offset=92
              local.get 2
              i32.const 1064347
              i32.store offset=88
              local.get 2
              i32.const 1064346
              i32.store offset=84
              local.get 2
              i32.const 96
              i32.add
              local.get 2
              i32.const 84
              i32.add
              call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
              local.get 2
              i32.load8_u offset=96
              local.tee 1
              i32.const 255
              i32.ne
              br_if 4 (;@1;)
              local.get 2
              local.get 2
              i64.load offset=100 align=4
              i64.store offset=52 align=4
              local.get 2
              i32.const 3
              i32.store8 offset=48
              local.get 2
              i64.const 0
              i64.store offset=40
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 64
              i32.add
              local.get 2
              i32.const 48
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              local.get 2
              i32.load8_u offset=8
              i32.const 255
              i32.ne
              br_if 1 (;@4;)
              local.get 0
              local.get 2
              i64.load offset=24
              i64.store offset=16
              local.get 0
              local.get 2
              i64.load offset=16
              i64.store offset=8
              local.get 0
              i32.const 9
              i32.store8
              br 3 (;@2;)
            end
            block ;; label = @5
              local.get 3
              i64.const 2
              i64.eq
              br_if 0 (;@5;)
              local.get 0
              i32.const 8
              i32.store8
              br 3 (;@2;)
            end
            local.get 0
            i32.const 9
            i32.store8
            local.get 0
            local.get 1
            i64.load offset=16
            i64.store offset=16
            local.get 0
            local.get 1
            i64.load offset=8
            i64.store offset=8
            br 2 (;@2;)
          end
          local.get 0
          local.get 2
          i64.load offset=32
          i64.store offset=24
          local.get 0
          local.get 2
          i64.load offset=24
          i64.store offset=16
          local.get 0
          local.get 2
          i64.load offset=16
          i64.store offset=8
          local.get 0
          local.get 2
          i64.load offset=8
          i64.store
          br 1 (;@2;)
        end
        local.get 0
        i32.const 8
        i32.store8
        local.get 2
        local.get 4
        i64.load offset=8
        i64.store offset=16
        local.get 2
        local.get 4
        i64.load
        i64.store offset=8
        local.get 2
        i32.const 8
        i32.add
        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 1
        i64.load
        i64.const 1
        i64.le_u
        br_if 0 (;@2;)
        local.get 4
        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
      end
      local.get 2
      i32.const 112
      i32.add
      global.set $__stack_pointer
      return
    end
    local.get 2
    local.get 2
    i32.load8_u offset=99
    i32.store8 offset=43
    local.get 2
    local.get 2
    i32.load16_u offset=97 align=1
    i32.store16 offset=41 align=1
    local.get 2
    local.get 2
    i32.load offset=108
    i32.store offset=52
    local.get 2
    local.get 2
    i64.load offset=100 align=4
    i64.store offset=44 align=4
    local.get 2
    local.get 1
    i32.store8 offset=40
    i32.const 1063112
    i32.const 43
    local.get 2
    i32.const 40
    i32.add
    i32.const 1063096
    i32.const 1063156
    call $core::result::unwrap_failed
    unreachable
  )
