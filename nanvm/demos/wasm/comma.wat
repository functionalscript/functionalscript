  (func $nanvm_demos::samples::comma::module::<nanvm_lib::naive::Naive> (;400;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 128
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 0
    i32.store8 offset=64
    local.get 2
    i32.const 24
    i32.add
    local.get 2
    i32.const 64
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=28
    local.tee 3
    i32.store offset=84
    local.get 2
    local.get 2
    i32.load offset=24
    local.tee 4
    i32.store offset=80
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=64
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
        i32.const 80
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 4
      i32.eqz
      br_if 0 (;@1;)
      local.get 2
      i32.const 100
      i32.const 0
      local.get 4
      local.get 3
      i32.const 1059370
      i32.const 47
      call $<nanvm_lib::naive::function::Function>::new
      local.tee 4
      i32.store offset=36
      local.get 2
      i32.const 7
      i32.store8 offset=32
      local.get 2
      i32.const 0
      i32.store16 offset=60
      local.get 2
      i32.const 1059328
      i32.store offset=56
      local.get 2
      i32.const 1059321
      i32.store offset=52
      local.get 2
      i32.const 80
      i32.add
      local.get 2
      i32.const 52
      i32.add
      call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 2
              i32.load8_u offset=80
              local.tee 3
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 2
              i32.load offset=88
              local.set 5
              local.get 2
              i32.load offset=84
              local.set 6
              local.get 4
              local.get 4
              i32.load
              i32.const 1
              i32.add
              local.tee 3
              i32.store
              local.get 3
              i32.eqz
              br_if 1 (;@4;)
              local.get 2
              i32.const 0
              i32.store8 offset=52
              local.get 2
              i64.const 0
              i64.store offset=96
              local.get 2
              local.get 4
              i32.store offset=92
              local.get 2
              i32.const 7
              i32.store8 offset=88
              local.get 2
              i64.const 4294967296
              i64.store offset=80
              local.get 2
              local.get 2
              i32.const 52
              i32.add
              i32.store offset=104
              local.get 2
              i32.const 16
              i32.add
              local.get 2
              i32.const 80
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 1>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=20
              local.tee 3
              i32.store offset=68
              local.get 2
              local.get 2
              i32.load offset=16
              local.tee 4
              i32.store offset=64
              block ;; label = @6
                local.get 2
                i32.load8_u offset=52
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                br_if 4 (;@2;)
                local.get 2
                i32.const 64
                i32.add
                call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                br 4 (;@2;)
              end
              local.get 4
              i32.eqz
              br_if 3 (;@2;)
              i32.const 105
              i32.const 0
              local.get 4
              local.get 3
              i32.const 1059558
              i32.const 59
              call $<nanvm_lib::naive::function::Function>::new
              local.set 4
              local.get 2
              i32.const 0
              i32.store8 offset=52
              local.get 2
              local.get 4
              i32.store offset=100
              local.get 2
              i32.const 7
              i32.store8 offset=96
              local.get 2
              local.get 5
              i32.store offset=92
              local.get 2
              local.get 6
              i32.store offset=88
              local.get 2
              i64.const 4294967296
              i64.store offset=80
              local.get 2
              local.get 2
              i32.const 52
              i32.add
              i32.store offset=112
              local.get 2
              i32.const 8
              i32.add
              local.get 2
              i32.const 80
              i32.add
              call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
              local.get 2
              local.get 2
              i32.load offset=12
              local.tee 3
              i32.store offset=68
              local.get 2
              local.get 2
              i32.load offset=8
              local.tee 4
              i32.store offset=64
              block ;; label = @6
                local.get 2
                i32.load8_u offset=52
                i32.const 1
                i32.ne
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i32.load
                i32.const -1
                i32.add
                local.tee 0
                i32.store
                local.get 0
                br_if 3 (;@3;)
                local.get 2
                i32.const 64
                i32.add
                call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
                br 3 (;@3;)
              end
              local.get 4
              i32.eqz
              br_if 2 (;@3;)
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
              i32.const 32
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 1
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              i32.const 128
              i32.add
              global.set $__stack_pointer
              return
            end
            local.get 2
            local.get 2
            i32.load8_u offset=83
            i32.store8 offset=67
            local.get 2
            local.get 2
            i32.load16_u offset=81 align=1
            i32.store16 offset=65 align=1
            local.get 2
            local.get 2
            i32.load offset=92
            i32.store offset=76
            local.get 2
            local.get 2
            i64.load offset=84 align=4
            i64.store offset=68 align=4
            local.get 2
            local.get 3
            i32.store8 offset=64
            i32.const 1055372
            i32.const 43
            local.get 2
            i32.const 64
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
        i32.const 127
        i32.add
        i32.const 1053912
        i32.const 1053972
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 127
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 127
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::comma::module<nanvm_lib::naive::Naive>::{closure#1} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;401;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
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
          i32.const 1062708
          call $core::panicking::panic_bounds_check
          unreachable
        end
        local.get 1
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
      local.get 1
      i32.store8 offset=73
      local.get 4
      local.get 5
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
                          local.get 4
                          i32.load8_u offset=16
                          local.tee 1
                          br_table 6 (;@5;) 6 (;@5;) 0 (;@11;) 1 (;@10;) 2 (;@9;) 3 (;@8;) 4 (;@7;) 5 (;@6;) 6 (;@5;)
                        end
                        local.get 4
                        i64.load offset=24
                        local.set 6
                        br 8 (;@2;)
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
                      br 6 (;@3;)
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
                    br_if 7 (;@1;)
                    local.get 4
                    i64.load8_u offset=28
                    i64.const 32
                    i64.shl
                    local.get 4
                    i64.load32_u offset=24
                    i64.or
                    local.set 6
                    br 6 (;@2;)
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
                  br_if 6 (;@1;)
                  br 4 (;@3;)
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
                br_if 5 (;@1;)
                br 3 (;@3;)
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
              br_if 4 (;@1;)
              br 1 (;@4;)
            end
            local.get 4
            i32.load8_u offset=17
            local.set 5
          end
          br 1 (;@2;)
        end
        local.get 4
        i64.load32_u offset=24
        local.set 6
      end
      local.get 4
      local.get 6
      i64.store offset=160
      local.get 4
      local.get 3
      i32.store offset=156
      local.get 4
      local.get 5
      i32.store8 offset=153
      local.get 4
      local.get 1
      i32.store8 offset=152
      local.get 4
      i64.const 0
      i64.store offset=224
      local.get 4
      i32.const 2
      i32.store8 offset=216
      local.get 4
      i32.const 104
      i32.add
      local.get 4
      i32.const 152
      i32.add
      local.get 4
      i32.const 216
      i32.add
      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
      block ;; label = @2
        block ;; label = @3
          block ;; label = @4
            block ;; label = @5
              local.get 4
              i32.load8_u offset=104
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=120
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=112
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 72
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            local.get 4
            i64.load offset=128
            i64.store offset=240
            local.get 4
            local.get 4
            i64.load offset=120
            i64.store offset=232
            local.get 4
            local.get 4
            i64.load offset=112
            i64.store offset=224
            local.get 4
            local.get 4
            i64.load offset=104
            i64.store offset=216
            local.get 4
            i32.const 152
            i32.add
            local.get 4
            i32.const 216
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=152
                local.tee 3
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
                i32.const 1
                local.set 1
                i32.const 0
                local.set 3
                br 1 (;@5;)
              end
              local.get 4
              local.get 4
              i64.load offset=154 align=2
              i64.store offset=136
              local.get 4
              local.get 4
              i64.load offset=160 align=2
              i64.store offset=142 align=2
              local.get 4
              i32.load8_u offset=153
              local.set 1
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
            local.get 1
            i32.store8 offset=89
            local.get 4
            local.get 3
            i32.store8 offset=88
            local.get 4
            local.get 4
            i64.load offset=136
            i64.store offset=90 align=2
            local.get 4
            local.get 4
            i64.load offset=142 align=2
            i64.store offset=96 align=2
            local.get 4
            i64.const 0
            i64.store offset=160
            local.get 4
            i32.const 2
            i32.store8 offset=152
            local.get 4
            i32.const 216
            i32.add
            local.get 4
            i32.const 88
            i32.add
            local.get 4
            i32.const 152
            i32.add
            call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
            local.get 4
            i32.load8_u offset=217
            local.set 3
            block ;; label = @5
              local.get 4
              i32.load8_u offset=216
              local.tee 1
              i32.const 255
              i32.eq
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=224 align=2
              i64.store offset=16 align=2
              local.get 0
              local.get 4
              i64.load offset=218 align=2
              i64.store offset=10 align=2
              local.get 0
              local.get 3
              i32.store8 offset=9
              local.get 0
              local.get 1
              i32.store8 offset=8
              local.get 0
              i64.const 1
              i64.store
              local.get 4
              i32.const 72
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 1 (;@4;)
            end
            local.get 4
            i32.const 0
            i32.store16 offset=144
            local.get 4
            i32.const 1059979
            i32.store offset=140
            local.get 4
            i32.const 1059971
            i32.store offset=136
            local.get 4
            i32.const 216
            i32.add
            local.get 4
            i32.const 136
            i32.add
            call $"core::iter::adapters::try_process::<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, u16, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, <core::result::Result<alloc::rc::Rc<[u16]>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as core::iter::traits::collect::FromIterator<core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>>::from_iter<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>>::{closure#0}, alloc::rc::Rc<[u16]>>"
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=216
                    local.tee 1
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
                    local.get 4
                    i64.load offset=220 align=4
                    local.set 6
                    local.get 4
                    i32.const 0
                    i32.store8 offset=136
                    local.get 4
                    local.get 6
                    i64.store offset=244 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=240
                    local.get 4
                    local.get 3
                    i32.const 255
                    i32.and
                    i32.const 254
                    i32.lt_u
                    i32.store8 offset=225
                    local.get 4
                    i64.const 8589934592
                    i64.store offset=216
                    local.get 4
                    local.get 4
                    i32.const 136
                    i32.add
                    i32.store offset=256
                    local.get 4
                    i32.const 1
                    i32.store8 offset=224
                    local.get 4
                    local.get 4
                    i32.const 216
                    i32.add
                    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                    local.get 4
                    local.get 4
                    i32.load offset=4
                    local.tee 5
                    i32.store offset=156
                    local.get 4
                    local.get 4
                    i32.load
                    local.tee 3
                    i32.store offset=152
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=136
                      i32.const 1
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 3
                      local.get 3
                      i32.load
                      i32.const -1
                      i32.add
                      local.tee 2
                      i32.store
                      local.get 2
                      br_if 4 (;@5;)
                      local.get 4
                      i32.const 152
                      i32.add
                      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                      br 4 (;@5;)
                    end
                    local.get 3
                    i32.eqz
                    br_if 3 (;@5;)
                    local.get 4
                    i32.const 56
                    i32.add
                    local.set 1
                    local.get 4
                    local.get 5
                    i32.store offset=208
                    local.get 4
                    local.get 3
                    i32.store offset=204
                    local.get 4
                    i32.const 6
                    i32.store8 offset=200
                    local.get 4
                    i32.const 48
                    i32.add
                    local.get 4
                    i32.const 72
                    i32.add
                    local.get 4
                    i32.const 200
                    i32.add
                    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::call
                    block ;; label = @9
                      local.get 4
                      i64.load offset=48
                      i64.const 1
                      i64.ne
                      br_if 0 (;@9;)
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
                      br 5 (;@4;)
                    end
                    local.get 4
                    local.get 1
                    i64.load offset=8
                    i64.store offset=40
                    local.get 4
                    local.get 1
                    i64.load
                    i64.store offset=32
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
                                    local.tee 1
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=24
                                  local.set 6
                                  br 9 (;@6;)
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
                                br_if 13 (;@1;)
                                br 7 (;@7;)
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
                              local.get 4
                              i64.load8_u offset=28
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=24
                              i64.or
                              local.set 6
                              br 7 (;@6;)
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
                            br 5 (;@7;)
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
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=17
                      local.set 5
                    end
                    br 2 (;@6;)
                  end
                  local.get 4
                  local.get 4
                  i32.load8_u offset=219
                  i32.store8 offset=155
                  local.get 4
                  local.get 4
                  i32.load16_u offset=217 align=1
                  i32.store16 offset=153 align=1
                  local.get 4
                  local.get 4
                  i32.load offset=228
                  i32.store offset=164
                  local.get 4
                  local.get 4
                  i64.load offset=220 align=4
                  i64.store offset=156 align=4
                  local.get 4
                  local.get 1
                  i32.store8 offset=152
                  i32.const 1055372
                  i32.const 43
                  local.get 4
                  i32.const 152
                  i32.add
                  i32.const 1055356
                  i32.const 1055416
                  call $core::result::unwrap_failed
                  unreachable
                end
                local.get 4
                i64.load32_u offset=24
                local.set 6
              end
              local.get 4
              local.get 6
              i64.store offset=208
              local.get 4
              local.get 3
              i32.store offset=204
              local.get 4
              local.get 5
              i32.store8 offset=201
              local.get 4
              local.get 1
              i32.store8 offset=200
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
              i32.const 200
              i32.add
              local.get 4
              i32.const 216
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
              block ;; label = @6
                local.get 4
                i32.load8_u offset=152
                i32.const 255
                i32.ne
                br_if 0 (;@6;)
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
                i32.const 32
                i32.add
                call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 2 (;@4;)
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
              i32.const 200
              i32.add
              local.get 4
              i32.const 216
              i32.add
              call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=200
                  i32.const 255
                  i32.eq
                  br_if 0 (;@7;)
                  local.get 4
                  local.get 4
                  i64.load offset=208
                  i64.store offset=192
                  local.get 4
                  local.get 4
                  i64.load offset=200
                  i64.store offset=184
                  br 1 (;@6;)
                end
                local.get 4
                i32.const 256
                i32.store16 offset=184
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
              i64.const 4611686018427387904
              i64.store offset=224
              local.get 4
              i32.const 2
              i32.store8 offset=216
              local.get 0
              local.get 4
              i32.const 184
              i32.add
              local.get 4
              i32.const 216
              i32.add
              call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
              local.get 4
              i32.const 32
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 4
              i32.const 16
              i32.add
              call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              local.get 2
              local.get 2
              i32.load
              i32.const -1
              i32.add
              local.tee 0
              i32.store
              local.get 0
              br_if 3 (;@2;)
              br 2 (;@3;)
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
          local.get 4
          i32.const 16
          i32.add
          call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
      i32.const 272
      i32.add
      global.set $__stack_pointer
      return
    end
    unreachable
  )
