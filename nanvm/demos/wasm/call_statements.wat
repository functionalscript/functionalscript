  (func $nanvm_demos::samples::call_statements::module::<nanvm_lib::naive::Naive> (;568;) (type 1) (param i32 i32)
    (local i32 i32 i64 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 160
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
        i32.const 187
        i32.const 0
        local.get 5
        local.get 6
        i32.const 1063790
        i32.const 47
        call $<nanvm_lib::naive::function::Function>::new
        local.tee 5
        i32.store offset=44
        local.get 2
        i32.const 7
        i32.store8 offset=40
        local.get 5
        local.get 5
        i32.load
        i32.const 1
        i32.add
        local.tee 6
        i32.store
        local.get 6
        i32.eqz
        br_if 1 (;@1;)
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
                            local.get 3
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 1
                          i64.load offset=8
                          local.set 4
                          br 8 (;@3;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 6
                        local.get 6
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 7
                        i32.store
                        local.get 7
                        i32.eqz
                        br_if 9 (;@1;)
                        br 6 (;@4;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 6
                      local.get 6
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 7
                      i32.store
                      local.get 7
                      i32.eqz
                      br_if 8 (;@1;)
                      local.get 1
                      i64.load8_u offset=12
                      i64.const 32
                      i64.shl
                      local.get 1
                      i64.load32_u offset=8
                      i64.or
                      local.set 4
                      br 6 (;@3;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 6
                    local.get 6
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    i32.eqz
                    br_if 7 (;@1;)
                    br 4 (;@4;)
                  end
                  local.get 1
                  i32.load offset=4
                  local.tee 6
                  local.get 6
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  i32.eqz
                  br_if 6 (;@1;)
                  br 3 (;@4;)
                end
                local.get 1
                i32.load offset=4
                local.tee 6
                local.get 6
                i32.load
                i32.const 1
                i32.add
                local.tee 7
                i32.store
                local.get 7
                i32.eqz
                br_if 5 (;@1;)
                br 1 (;@5;)
              end
              local.get 1
              i32.load8_u offset=1
              local.set 7
            end
            br 1 (;@3;)
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
        i64.store offset=136
        local.get 2
        local.get 6
        i32.store offset=132
        local.get 2
        local.get 7
        i32.store8 offset=129
        local.get 2
        local.get 3
        i32.store8 offset=128
        local.get 2
        local.get 5
        i32.store offset=116
        local.get 2
        i32.const 7
        i32.store8 offset=112
        local.get 2
        i64.const 8589934592
        i64.store offset=104
        local.get 2
        local.get 2
        i32.const 56
        i32.add
        i32.store offset=144
        local.get 2
        i32.const 24
        i32.add
        local.get 2
        i32.const 104
        i32.add
        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
        local.get 2
        local.get 2
        i32.load offset=28
        local.tee 6
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
          local.get 2
          i32.const 188
          i32.const 2
          local.get 5
          local.get 6
          i32.const 1063837
          i32.const 69
          call $<nanvm_lib::naive::function::Function>::new
          local.tee 5
          i32.store offset=60
          local.get 2
          i32.const 7
          i32.store8 offset=56
          local.get 2
          i32.const 0
          i32.store16 offset=84
          local.get 2
          i32.const 1063748
          i32.store offset=80
          local.get 2
          i32.const 1063741
          i32.store offset=76
          local.get 2
          i32.const 104
          i32.add
          local.get 2
          i32.const 76
          i32.add
          call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 2
                i32.load8_u offset=104
                local.tee 6
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                local.get 2
                i32.load offset=112
                local.set 7
                local.get 2
                i32.load offset=108
                local.set 8
                local.get 5
                local.get 5
                i32.load
                i32.const 1
                i32.add
                local.tee 6
                i32.store
                local.get 6
                i32.eqz
                br_if 5 (;@1;)
                block ;; label = @7
                  block ;; label = @8
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                local.get 3
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 1
                              i64.load offset=8
                              local.set 4
                              br 9 (;@4;)
                            end
                            local.get 1
                            i32.load offset=4
                            local.tee 6
                            local.get 6
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 9
                            i32.store
                            local.get 9
                            i32.eqz
                            br_if 11 (;@1;)
                            br 7 (;@5;)
                          end
                          local.get 1
                          i32.load offset=4
                          local.tee 6
                          local.get 6
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 9
                          i32.store
                          local.get 9
                          i32.eqz
                          br_if 10 (;@1;)
                          local.get 1
                          i64.load8_u offset=12
                          i64.const 32
                          i64.shl
                          local.get 1
                          i64.load32_u offset=8
                          i64.or
                          local.set 4
                          br 7 (;@4;)
                        end
                        local.get 1
                        i32.load offset=4
                        local.tee 6
                        local.get 6
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 9
                        i32.store
                        local.get 9
                        i32.eqz
                        br_if 9 (;@1;)
                        br 5 (;@5;)
                      end
                      local.get 1
                      i32.load offset=4
                      local.tee 6
                      local.get 6
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 9
                      i32.store
                      local.get 9
                      i32.eqz
                      br_if 8 (;@1;)
                      br 4 (;@5;)
                    end
                    local.get 1
                    i32.load offset=4
                    local.tee 6
                    local.get 6
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 9
                    i32.store
                    local.get 9
                    i32.eqz
                    br_if 7 (;@1;)
                    br 1 (;@7;)
                  end
                  local.get 1
                  i32.load8_u offset=1
                  local.set 9
                end
                br 2 (;@4;)
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
          i64.store offset=136
          local.get 2
          local.get 6
          i32.store offset=132
          local.get 2
          local.get 9
          i32.store8 offset=129
          local.get 2
          local.get 3
          i32.store8 offset=128
          local.get 2
          i64.const 0
          i64.store offset=120
          local.get 2
          local.get 5
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
          i32.const 16
          i32.add
          local.get 2
          i32.const 104
          i32.add
          call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
          local.get 2
          local.get 2
          i32.load offset=20
          local.tee 5
          i32.store offset=92
          local.get 2
          local.get 2
          i32.load offset=16
          local.tee 3
          i32.store offset=88
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=76
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
              i32.const 88
              i32.add
              call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
              br 1 (;@4;)
            end
            local.get 3
            i32.eqz
            br_if 0 (;@4;)
            i32.const 189
            i32.const 0
            local.get 3
            local.get 5
            i32.const 1063906
            i32.const 26
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
            i32.const 8
            i32.add
            local.get 2
            i32.const 104
            i32.add
            call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
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
                call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
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
  )
  (func $"<nanvm_demos::samples::call_statements::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;569;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 176
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
                block ;; label = @7
                  local.get 2
                  i32.load
                  local.tee 5
                  i32.const -1
                  i32.eq
                  br_if 0 (;@7;)
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
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 2
                  i32.store offset=164
                  local.get 4
                  i32.const 6
                  i32.store8 offset=160
                  local.get 4
                  local.get 3
                  i64.extend_i32_u
                  i64.store offset=168
                  local.get 4
                  i64.const 0
                  i64.store offset=120
                  local.get 4
                  i32.const 2
                  i32.store8 offset=112
                  local.get 4
                  i32.const 32
                  i32.add
                  local.get 4
                  i32.const 160
                  i32.add
                  local.get 4
                  i32.const 112
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=32
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i32.const 32
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 3
                    br 5 (;@3;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=56
                  i64.store offset=136
                  local.get 4
                  local.get 4
                  i64.load offset=48
                  i64.store offset=128
                  local.get 4
                  local.get 4
                  i64.load offset=40
                  i64.store offset=120
                  local.get 4
                  local.get 4
                  i64.load offset=32
                  i64.store offset=112
                  local.get 4
                  i32.const 160
                  i32.add
                  local.get 4
                  i32.const 112
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=160
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=168
                      i64.store offset=72
                      local.get 4
                      local.get 4
                      i64.load offset=160
                      i64.store offset=64
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=64
                  end
                  local.get 4
                  i32.const 112
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 128
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  block ;; label = @8
                    local.get 4
                    i32.const 64
                    i32.add
                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                    br_if 0 (;@8;)
                    block ;; label = @9
                      block ;; label = @10
                        block ;; label = @11
                          block ;; label = @12
                            block ;; label = @13
                              block ;; label = @14
                                block ;; label = @15
                                  block ;; label = @16
                                    local.get 4
                                    i32.load8_u offset=16
                                    local.tee 5
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=24
                                  local.set 6
                                  br 10 (;@5;)
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
                                br_if 7 (;@7;)
                                br 8 (;@6;)
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
                              br_if 6 (;@7;)
                              local.get 4
                              i64.load8_u offset=28
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=24
                              i64.or
                              local.set 6
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
                            br_if 6 (;@6;)
                            br 5 (;@7;)
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
                          br_if 5 (;@6;)
                          br 4 (;@7;)
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
                        br_if 3 (;@7;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=17
                      local.set 7
                    end
                    br 3 (;@5;)
                  end
                  local.get 0
                  i32.const 256
                  i32.store16 offset=8
                  i64.const 0
                  local.set 6
                  br 3 (;@4;)
                end
                unreachable
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
            local.get 7
            i32.store8 offset=161
            local.get 4
            local.get 5
            i32.store8 offset=160
            local.get 4
            i64.const 4607182418800017408
            i64.store offset=120
            local.get 4
            i32.const 2
            i32.store8 offset=112
            local.get 4
            i32.const 80
            i32.add
            local.get 4
            i32.const 160
            i32.add
            local.get 4
            i32.const 112
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              local.get 4
              i32.load8_u offset=80
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 4
              i32.const 80
              i32.add
              i32.const 8
              i32.add
              local.set 3
              br 2 (;@3;)
            end
            local.get 4
            local.get 4
            i64.load offset=104
            i64.store offset=136
            local.get 4
            local.get 4
            i64.load offset=96
            i64.store offset=128
            local.get 4
            local.get 4
            i64.load offset=88
            i64.store offset=120
            local.get 4
            local.get 4
            i64.load offset=80
            i64.store offset=112
            local.get 4
            i32.const 160
            i32.add
            local.get 4
            i32.const 112
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=160
                local.tee 3
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                i32.const 1
                local.set 5
                i32.const 0
                local.set 3
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=162 align=2
              i64.store offset=144
              local.get 4
              local.get 4
              i64.load offset=168 align=2
              i64.store offset=150 align=2
              local.get 4
              i32.load8_u offset=161
              local.set 5
            end
            local.get 4
            i32.const 112
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 128
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 0
            local.get 5
            i32.store8 offset=9
            local.get 0
            local.get 3
            i32.store8 offset=8
            local.get 0
            local.get 4
            i64.load offset=144
            i64.store offset=10 align=2
            local.get 0
            local.get 4
            i64.load offset=150 align=2
            i64.store offset=16 align=2
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
          local.get 2
          local.get 2
          i32.load
          i32.const -1
          i32.add
          local.tee 0
          i32.store
          local.get 0
          br_if 2 (;@1;)
          br 1 (;@2;)
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
        i32.const 16
        i32.add
        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
    i32.const 176
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::call_statements::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;570;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
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
    i32.store offset=28
    local.get 4
    local.get 2
    i32.store offset=24
    block ;; label = @1
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
                            local.tee 2
                            i32.load8_u offset=8
                            local.tee 5
                            br_table 6 (;@6;) 6 (;@6;) 0 (;@12;) 1 (;@11;) 2 (;@10;) 3 (;@9;) 4 (;@8;) 5 (;@7;) 6 (;@6;)
                          end
                          local.get 2
                          i64.load offset=16
                          local.set 6
                          br 10 (;@1;)
                        end
                        local.get 2
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
                        br_if 7 (;@3;)
                        br 8 (;@2;)
                      end
                      local.get 2
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
                      br_if 6 (;@3;)
                      local.get 2
                      i64.load8_u offset=20
                      i64.const 32
                      i64.shl
                      local.get 2
                      i64.load32_u offset=16
                      i64.or
                      local.set 6
                      br 8 (;@1;)
                    end
                    local.get 2
                    i32.load offset=12
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 7
                    i32.store
                    local.get 7
                    br_if 6 (;@2;)
                    br 5 (;@3;)
                  end
                  local.get 2
                  i32.load offset=12
                  local.tee 3
                  local.get 3
                  i32.load
                  i32.const 1
                  i32.add
                  local.tee 7
                  i32.store
                  local.get 7
                  br_if 5 (;@2;)
                  br 4 (;@3;)
                end
                local.get 2
                i32.load offset=12
                local.tee 3
                local.get 3
                i32.load
                i32.const 1
                i32.add
                local.tee 2
                i32.store
                local.get 2
                i32.eqz
                br_if 3 (;@3;)
                br 1 (;@5;)
              end
              local.get 2
              i32.load8_u offset=9
              local.set 2
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
      local.get 2
      i64.load32_u offset=16
      local.set 6
    end
    local.get 4
    local.get 6
    i64.store offset=80
    local.get 4
    local.get 3
    i32.store offset=76
    local.get 4
    local.get 2
    i32.store8 offset=73
    local.get 4
    local.get 5
    i32.store8 offset=72
    local.get 4
    i32.const 104
    i32.add
    local.get 4
    i32.const 24
    i32.add
    i32.const 1
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 120
    i32.add
    local.get 4
    i32.const 24
    i32.add
    i32.const 0
    call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
    local.get 4
    i32.const 0
    i32.store16 offset=144
    local.get 4
    i32.const 1064275
    i32.store offset=140
    local.get 4
    i32.const 1064269
    i32.store offset=136
    local.get 4
    i32.const 248
    i32.add
    local.get 4
    i32.const 136
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
                      local.get 4
                      i32.load8_u offset=248
                      local.tee 3
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=252 align=4
                      i64.store offset=220 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=216
                      local.get 4
                      i32.const 136
                      i32.add
                      local.get 4
                      i32.const 120
                      i32.add
                      local.get 4
                      i32.const 216
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=136
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
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
                        i32.const 104
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 72
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 7 (;@3;)
                      end
                      local.get 4
                      local.get 4
                      i64.load offset=160
                      i64.store offset=272
                      local.get 4
                      local.get 4
                      i64.load offset=152
                      i64.store offset=264
                      local.get 4
                      local.get 4
                      i64.load offset=144
                      i64.store offset=256
                      local.get 4
                      local.get 4
                      i64.load offset=136
                      i64.store offset=248
                      local.get 4
                      i32.const 216
                      i32.add
                      local.get 4
                      i32.const 248
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=216
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 4
                          local.get 4
                          i64.load offset=224
                          i64.store offset=176
                          local.get 4
                          local.get 4
                          i64.load offset=216
                          i64.store offset=168
                          br 1 (;@10;)
                        end
                        local.get 4
                        i32.const 256
                        i32.store16 offset=168
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
                      i32.const 248
                      i32.add
                      local.get 4
                      i32.const 104
                      i32.add
                      local.get 4
                      i32.const 168
                      i32.add
                      call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                      local.get 4
                      i32.load8_u offset=249
                      local.set 3
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=248
                        local.tee 2
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=256 align=2
                        i64.store offset=16 align=2
                        local.get 0
                        local.get 4
                        i64.load offset=250 align=2
                        i64.store offset=10 align=2
                        local.get 0
                        local.get 3
                        i32.store8 offset=9
                        local.get 0
                        local.get 2
                        i32.store8 offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 4
                        i32.const 72
                        i32.add
                        call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        br 7 (;@3;)
                      end
                      local.get 4
                      i32.const 0
                      i32.store16 offset=128
                      local.get 4
                      i32.const 1064287
                      i32.store offset=124
                      local.get 4
                      i32.const 1064275
                      i32.store offset=120
                      local.get 4
                      i32.const 248
                      i32.add
                      local.get 4
                      i32.const 120
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      local.get 4
                      i32.load8_u offset=248
                      local.tee 2
                      i32.const 255
                      i32.ne
                      br_if 1 (;@8;)
                      local.get 4
                      i64.load offset=252 align=4
                      local.set 6
                      local.get 4
                      i32.const 0
                      i32.store8 offset=120
                      local.get 4
                      local.get 6
                      i64.store offset=276 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=272
                      local.get 4
                      local.get 3
                      i32.const 255
                      i32.and
                      i32.const 255
                      i32.eq
                      i32.store8 offset=257
                      local.get 4
                      i64.const 8589934592
                      i64.store offset=248
                      local.get 4
                      local.get 4
                      i32.const 120
                      i32.add
                      i32.store offset=288
                      local.get 4
                      i32.const 1
                      i32.store8 offset=256
                      local.get 4
                      i32.const 16
                      i32.add
                      local.get 4
                      i32.const 248
                      i32.add
                      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                      local.get 4
                      local.get 4
                      i32.load offset=20
                      local.tee 5
                      i32.store offset=220
                      local.get 4
                      local.get 4
                      i32.load offset=16
                      local.tee 3
                      i32.store offset=216
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=120
                        i32.const 1
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 3
                        local.get 3
                        i32.load
                        i32.const -1
                        i32.add
                        local.tee 0
                        i32.store
                        local.get 0
                        br_if 6 (;@4;)
                        local.get 4
                        i32.const 216
                        i32.add
                        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                        br 6 (;@4;)
                      end
                      local.get 3
                      i32.eqz
                      br_if 5 (;@4;)
                      local.get 4
                      i32.const 56
                      i32.add
                      local.set 2
                      local.get 4
                      local.get 5
                      i32.store offset=96
                      local.get 4
                      local.get 3
                      i32.store offset=92
                      local.get 4
                      i32.const 6
                      i32.store8 offset=88
                      local.get 4
                      i32.const 48
                      i32.add
                      local.get 4
                      i32.const 72
                      i32.add
                      local.get 4
                      i32.const 88
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                      block ;; label = @10
                        local.get 4
                        i64.load offset=48
                        i64.const 1
                        i64.ne
                        br_if 0 (;@10;)
                        local.get 0
                        i64.const 1
                        i64.store
                        local.get 0
                        local.get 2
                        i64.load offset=8
                        i64.store offset=16
                        local.get 0
                        local.get 2
                        i64.load
                        i64.store offset=8
                        br 7 (;@3;)
                      end
                      local.get 4
                      local.get 2
                      i64.load offset=8
                      i64.store offset=40
                      local.get 4
                      local.get 2
                      i64.load
                      i64.store offset=32
                      local.get 4
                      i32.const 120
                      i32.add
                      local.get 4
                      i32.const 24
                      i32.add
                      i32.const 0
                      call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                      local.get 4
                      i32.const 0
                      i32.store16 offset=112
                      local.get 4
                      i32.const 1064289
                      i32.store offset=108
                      local.get 4
                      i32.const 1064287
                      i32.store offset=104
                      local.get 4
                      i32.const 248
                      i32.add
                      local.get 4
                      i32.const 104
                      i32.add
                      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
                      local.get 4
                      i32.load8_u offset=248
                      local.tee 3
                      i32.const 255
                      i32.ne
                      br_if 2 (;@7;)
                      local.get 4
                      local.get 4
                      i64.load offset=252 align=4
                      i64.store offset=220 align=4
                      local.get 4
                      i32.const 3
                      i32.store8 offset=216
                      local.get 4
                      i32.const 184
                      i32.add
                      local.get 4
                      i32.const 120
                      i32.add
                      local.get 4
                      i32.const 216
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      local.get 1
                      i32.load offset=16
                      local.tee 3
                      i32.const 1
                      i32.le_u
                      br_if 3 (;@6;)
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=184
                          local.tee 3
                          i32.const 255
                          i32.and
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
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
                          br 1 (;@10;)
                        end
                        local.get 4
                        i64.load offset=208
                        local.set 6
                        local.get 1
                        i32.load offset=12
                        local.set 2
                        local.get 4
                        local.get 4
                        i32.const 184
                        i32.add
                        i32.const 1
                        i32.or
                        local.tee 1
                        i64.load offset=15 align=1
                        i64.store offset=232 align=1
                        local.get 4
                        local.get 1
                        i64.load offset=8 align=1
                        i64.store offset=225 align=1
                        local.get 4
                        local.get 1
                        i64.load align=1
                        i64.store offset=217 align=1
                        local.get 4
                        i32.const 256
                        i32.add
                        local.get 4
                        i32.const 24
                        i32.add
                        i32.const 1
                        call $<nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>>::argument
                        local.get 4
                        i32.const 0
                        i32.store8 offset=104
                        local.get 4
                        i64.const 4294967296
                        i64.store offset=248
                        local.get 4
                        local.get 4
                        i32.const 104
                        i32.add
                        i32.store offset=272
                        local.get 4
                        i32.const 8
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=12
                        local.tee 5
                        i32.store offset=124
                        local.get 4
                        local.get 4
                        i32.load offset=8
                        local.tee 1
                        i32.store offset=120
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=104
                          i32.const 1
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 1
                          local.get 1
                          i32.load
                          i32.const -1
                          i32.add
                          local.tee 0
                          i32.store
                          local.get 0
                          br_if 6 (;@5;)
                          local.get 4
                          i32.const 120
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 6 (;@5;)
                        end
                        local.get 1
                        i32.eqz
                        br_if 5 (;@5;)
                        local.get 0
                        local.get 5
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
                        local.get 6
                        i64.store offset=240
                        local.get 4
                        local.get 3
                        i32.store8 offset=216
                        local.get 4
                        local.get 0
                        i64.load offset=16
                        i64.store offset=256
                        local.get 4
                        local.get 0
                        i64.load offset=8
                        i64.store offset=248
                        local.get 0
                        local.get 4
                        i32.const 216
                        i32.add
                        local.get 2
                        i32.const 24
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::call
                      end
                      local.get 4
                      i32.const 32
                      i32.add
                      call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      local.get 4
                      i32.load offset=24
                      local.tee 0
                      local.get 0
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 0
                      i32.store
                      local.get 0
                      br_if 8 (;@1;)
                      br 7 (;@2;)
                    end
                    local.get 4
                    local.get 4
                    i32.load8_u offset=251
                    i32.store8 offset=219
                    local.get 4
                    local.get 4
                    i32.load16_u offset=249 align=1
                    i32.store16 offset=217 align=1
                    local.get 4
                    local.get 4
                    i32.load offset=260
                    i32.store offset=228
                    local.get 4
                    local.get 4
                    i64.load offset=252 align=4
                    i64.store offset=220 align=4
                    local.get 4
                    local.get 3
                    i32.store8 offset=216
                    i32.const 1063112
                    i32.const 43
                    local.get 4
                    i32.const 216
                    i32.add
                    i32.const 1063096
                    i32.const 1063156
                    call $core::result::unwrap_failed
                    unreachable
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=251
                  i32.store8 offset=219
                  local.get 4
                  local.get 4
                  i32.load16_u offset=249 align=1
                  i32.store16 offset=217 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=260
                  i32.store offset=228
                  local.get 4
                  local.get 4
                  i64.load offset=252 align=4
                  i64.store offset=220 align=4
                  local.get 4
                  local.get 2
                  i32.store8 offset=216
                  i32.const 1063112
                  i32.const 43
                  local.get 4
                  i32.const 216
                  i32.add
                  i32.const 1063096
                  i32.const 1063156
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                local.get 4
                i32.load8_u offset=251
                i32.store8 offset=219
                local.get 4
                local.get 4
                i32.load16_u offset=249 align=1
                i32.store16 offset=217 align=1
                local.get 4
                local.get 4
                i32.load offset=260
                i32.store offset=228
                local.get 4
                local.get 4
                i64.load offset=252 align=4
                i64.store offset=220 align=4
                local.get 4
                local.get 3
                i32.store8 offset=216
                i32.const 1063112
                i32.const 43
                local.get 4
                i32.const 216
                i32.add
                i32.const 1063096
                i32.const 1063156
                call $core::result::unwrap_failed
                unreachable
              end
              i32.const 1
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
        local.get 4
        i32.load offset=24
        local.tee 0
        local.get 0
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
      end
      local.get 4
      i32.const 24
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 304
    i32.add
    global.set $__stack_pointer
  )
  (func $"<nanvm_demos::samples::call_statements::module<nanvm_lib::naive::Naive>::{closure#2} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;571;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 224
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
                        local.tee 1
                        local.get 1
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
                      local.tee 1
                      local.get 1
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
                    local.tee 1
                    local.get 1
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
                  local.tee 1
                  local.get 1
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
                local.tee 1
                local.get 1
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
      i64.store offset=48
      local.get 4
      local.get 1
      i32.store offset=44
      local.get 4
      local.get 5
      i32.store8 offset=41
      local.get 4
      local.get 6
      i32.store8 offset=40
      local.get 4
      i32.const 0
      i32.store8 offset=136
      local.get 4
      i64.const 4613937818241073152
      i64.store offset=200
      local.get 4
      i32.const 2
      i32.store8 offset=192
      local.get 4
      i64.const 4611686018427387904
      i64.store offset=184
      local.get 4
      i32.const 2
      i32.store8 offset=176
      local.get 4
      i64.const 4607182418800017408
      i64.store offset=168
      local.get 4
      i32.const 2
      i32.store8 offset=160
      local.get 4
      i64.const 12884901888
      i64.store offset=152
      local.get 4
      local.get 4
      i32.const 136
      i32.add
      i32.store offset=208
      local.get 4
      i32.const 8
      i32.add
      local.get 4
      i32.const 152
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 3>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
      local.get 4
      local.get 4
      i32.load offset=12
      local.tee 5
      i32.store offset=92
      local.get 4
      local.get 4
      i32.load offset=8
      local.tee 1
      i32.store offset=88
      block ;; label = @2
        block ;; label = @3
          local.get 4
          i32.load8_u offset=136
          i32.const 1
          i32.ne
          br_if 0 (;@3;)
          local.get 1
          local.get 1
          i32.load
          i32.const -1
          i32.add
          local.tee 2
          i32.store
          local.get 2
          br_if 1 (;@2;)
          local.get 4
          i32.const 88
          i32.add
          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 1
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        local.get 5
        i32.store offset=80
        local.get 4
        local.get 1
        i32.store offset=76
        local.get 4
        i32.const 6
        i32.store8 offset=72
        local.get 2
        local.get 2
        i32.load
        i32.const 1
        i32.add
        local.tee 1
        i32.store
        local.get 1
        i32.eqz
        br_if 1 (;@1;)
        local.get 4
        local.get 2
        i32.store offset=140
        local.get 4
        i32.const 6
        i32.store8 offset=136
        local.get 4
        local.get 3
        i64.extend_i32_u
        i64.store offset=144
        local.get 4
        i64.const 0
        i64.store offset=160
        local.get 4
        i32.const 2
        i32.store8 offset=152
        local.get 4
        i32.const 88
        i32.add
        local.get 4
        i32.const 136
        i32.add
        local.get 4
        i32.const 152
        i32.add
        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=88
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
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
                local.get 4
                i32.const 72
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 40
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 24
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 2
                local.get 2
                i32.load
                i32.const -1
                i32.add
                local.tee 3
                i32.store
                local.get 3
                i32.eqz
                br_if 1 (;@5;)
                br 2 (;@4;)
              end
              local.get 4
              local.get 4
              i64.load offset=112
              i64.store offset=176
              local.get 4
              local.get 4
              i64.load offset=104
              i64.store offset=168
              local.get 4
              local.get 4
              i64.load offset=96
              i64.store offset=160
              local.get 4
              local.get 4
              i64.load offset=88
              i64.store offset=152
              local.get 4
              i32.const 136
              i32.add
              local.get 4
              i32.const 152
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              i32.const 0
              local.set 3
              i32.const 1
              local.set 1
              block ;; label = @6
                local.get 4
                i32.load8_u offset=136
                local.tee 5
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=138 align=2
                i64.store offset=120
                local.get 4
                local.get 4
                i64.load offset=144 align=2
                i64.store offset=126 align=2
                local.get 4
                i32.load8_u offset=137
                local.set 1
                local.get 5
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
              local.get 4
              i64.load offset=80
              i64.store offset=168
              local.get 4
              local.get 4
              i64.load offset=72
              i64.store offset=160
              local.get 4
              i32.const 0
              i32.store8 offset=72
              local.get 4
              local.get 1
              i32.store8 offset=177
              local.get 4
              local.get 3
              i32.store8 offset=176
              local.get 4
              i64.const 8589934592
              i64.store offset=152
              local.get 4
              local.get 4
              i64.load offset=120
              i64.store offset=178 align=2
              local.get 4
              local.get 4
              i64.load offset=126 align=2
              i64.store offset=184 align=2
              local.get 4
              local.get 4
              i32.const 72
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
              local.tee 1
              i32.store offset=140
              local.get 4
              local.get 4
              i32.load
              local.tee 3
              i32.store offset=136
              block ;; label = @6
                local.get 4
                i32.load8_u offset=72
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
                br_if 3 (;@3;)
                local.get 4
                i32.const 136
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 3 (;@3;)
              end
              local.get 3
              i32.eqz
              br_if 2 (;@3;)
              local.get 4
              local.get 1
              i32.store offset=64
              local.get 4
              local.get 3
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
              call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              local.get 2
              i32.load
              i32.const -1
              i32.add
              local.tee 3
              i32.store
              local.get 3
              br_if 1 (;@4;)
            end
            local.get 4
            i32.const 16
            i32.add
            call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
          end
          local.get 4
          i32.const 224
          i32.add
          global.set $__stack_pointer
          return
        end
        i32.const 1059464
        i32.const 43
        local.get 4
        i32.const 223
        i32.add
        i32.const 1059448
        i32.const 1059508
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1059464
      i32.const 43
      local.get 4
      i32.const 223
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    unreachable
  )
