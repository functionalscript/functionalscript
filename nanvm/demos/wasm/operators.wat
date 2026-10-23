  (func $nanvm_demos::samples::operators::module::<nanvm_lib::naive::Naive> (;488;) (type 1) (param i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    global.get $__stack_pointer
    i32.const 112
    i32.sub
    local.tee 2
    global.set $__stack_pointer
    local.get 2
    i32.const 255
    i32.store8 offset=40
    local.get 2
    i32.const 0
    i32.store16 offset=72
    local.get 2
    i32.const 1062526
    i32.store offset=68
    local.get 2
    i32.const 1062519
    i32.store offset=64
    local.get 2
    local.get 2
    i32.const 40
    i32.add
    i32.store offset=76
    local.get 2
    i32.const 24
    i32.add
    local.get 2
    i32.const 64
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::str::iter::EncodeUtf16, core::result::Result<u16, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::Ok>, core::result::Result<core::convert::Infallible, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>> as alloc::rc::ToRcSlice<u16>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=28
    local.tee 3
    i32.store offset=60
    local.get 2
    local.get 2
    i32.load offset=24
    local.tee 4
    i32.store offset=56
    block ;; label = @1
      local.get 2
      i32.load8_u offset=40
      local.tee 5
      i32.const 255
      i32.eq
      br_if 0 (;@1;)
      local.get 2
      i32.load offset=44
      local.set 0
      local.get 2
      i32.load offset=48
      local.set 3
      local.get 2
      i32.load offset=52
      local.set 1
      local.get 2
      i32.load16_u offset=41 align=1
      local.set 6
      local.get 2
      i32.load8_u offset=43
      local.set 7
      local.get 4
      local.get 4
      i32.load
      i32.const -1
      i32.add
      local.tee 8
      i32.store
      local.get 2
      local.get 7
      i32.store8 offset=38
      local.get 2
      local.get 6
      i32.store16 offset=36
      block ;; label = @2
        local.get 8
        br_if 0 (;@2;)
        local.get 2
        i32.const 56
        i32.add
        call $"<alloc::rc::Rc<[u16]>>::drop_slow"
      end
      local.get 2
      local.get 5
      i32.store8 offset=64
      local.get 2
      local.get 2
      i32.load16_u offset=36
      i32.store16 offset=65 align=1
      local.get 2
      local.get 2
      i32.load8_u offset=38
      i32.store8 offset=67
      local.get 2
      local.get 1
      i32.store offset=76
      local.get 2
      local.get 3
      i32.store offset=72
      local.get 2
      local.get 0
      i32.store offset=68
      i32.const 1063112
      i32.const 43
      local.get 2
      i32.const 64
      i32.add
      i32.const 1063096
      i32.const 1063156
      call $core::result::unwrap_failed
      unreachable
    end
    local.get 2
    i32.const 0
    i32.store8 offset=40
    local.get 2
    i32.const 16
    i32.add
    local.get 2
    i32.const 40
    i32.add
    call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::empty::Empty<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
    local.get 2
    local.get 2
    i32.load offset=20
    local.tee 6
    i32.store offset=68
    local.get 2
    local.get 2
    i32.load offset=16
    local.tee 5
    i32.store offset=64
    block ;; label = @1
      block ;; label = @2
        local.get 2
        i32.load8_u offset=40
        i32.const 1
        i32.ne
        br_if 0 (;@2;)
        local.get 5
        local.get 5
        i32.load
        i32.const -1
        i32.add
        local.tee 0
        i32.store
        local.get 0
        br_if 1 (;@1;)
        local.get 2
        i32.const 64
        i32.add
        call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
        br 1 (;@1;)
      end
      local.get 5
      i32.eqz
      br_if 0 (;@1;)
      i32.const 123
      i32.const 0
      local.get 5
      local.get 6
      i32.const 1062574
      i32.const 86
      call $<nanvm_lib::naive::function::Function>::new
      local.set 5
      local.get 2
      i32.const 0
      i32.store8 offset=56
      local.get 2
      local.get 5
      i32.store offset=84
      local.get 2
      i32.const 7
      i32.store8 offset=80
      local.get 2
      local.get 3
      i32.store offset=76
      local.get 2
      local.get 4
      i32.store offset=72
      local.get 2
      i64.const 4294967296
      i64.store offset=64
      local.get 2
      local.get 2
      i32.const 56
      i32.add
      i32.store offset=96
      local.get 2
      i32.const 8
      i32.add
      local.get 2
      i32.const 64
      i32.add
      call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), 1>, core::result::Result<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>), ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)>>::to_rc_slice"
      local.get 2
      local.get 2
      i32.load offset=12
      local.tee 4
      i32.store offset=44
      local.get 2
      local.get 2
      i32.load offset=8
      local.tee 5
      i32.store offset=40
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
          local.tee 0
          i32.store
          local.get 0
          br_if 1 (;@2;)
          local.get 2
          i32.const 40
          i32.add
          call $"<alloc::rc::Rc<[(nanvm_lib::vm::string::String<nanvm_lib::naive::Naive>, nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>)]>>::drop_slow"
          br 1 (;@2;)
        end
        local.get 5
        i32.eqz
        br_if 0 (;@2;)
        local.get 0
        local.get 4
        i32.store offset=16
        local.get 0
        local.get 5
        i32.store offset=12
        local.get 0
        i32.const 5
        i32.store8 offset=8
        local.get 0
        i64.const 0
        i64.store
        local.get 1
        call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
        local.get 2
        i32.const 112
        i32.add
        global.set $__stack_pointer
        return
      end
      i32.const 1059464
      i32.const 43
      local.get 2
      i32.const 111
      i32.add
      i32.const 1059448
      i32.const 1059508
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1059464
    i32.const 43
    local.get 2
    i32.const 111
    i32.add
    i32.const 1059448
    i32.const 1059508
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::operators::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;489;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i32 i64)
    global.get $__stack_pointer
    i32.const 784
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=36
    local.get 4
    local.get 2
    i32.store offset=32
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
        block ;; label = @3
          block ;; label = @4
            local.get 6
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 3
            i32.store offset=48
            local.get 4
            local.get 2
            i32.store offset=44
            local.get 4
            i32.const 6
            i32.store8 offset=40
            local.get 2
            local.get 5
            i32.const 2
            i32.add
            local.tee 6
            i32.store
            local.get 6
            i32.eqz
            br_if 0 (;@4;)
            local.get 4
            local.get 2
            i32.store offset=676
            local.get 4
            i32.const 6
            i32.store8 offset=672
            local.get 4
            local.get 3
            i64.extend_i32_u
            i64.store offset=680
            local.get 4
            i64.const 0
            i64.store offset=744
            local.get 4
            i32.const 2
            i32.store8 offset=736
            local.get 4
            i32.const 512
            i32.add
            local.get 4
            i32.const 672
            i32.add
            local.get 4
            i32.const 736
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              local.get 4
              i32.load8_u offset=512
              i32.const 255
              i32.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=528
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=520
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              br 2 (;@3;)
            end
            local.get 4
            local.get 4
            i64.load offset=536
            i64.store offset=760
            local.get 4
            local.get 4
            i64.load offset=528
            i64.store offset=752
            local.get 4
            local.get 4
            i64.load offset=520
            i64.store offset=744
            local.get 4
            local.get 4
            i64.load offset=512
            i64.store offset=736
            local.get 4
            i32.const 672
            i32.add
            local.get 4
            i32.const 736
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.load8_u offset=672
                i32.const 255
                i32.eq
                br_if 0 (;@6;)
                local.get 4
                local.get 4
                i64.load offset=680
                i64.store offset=616
                local.get 4
                local.get 4
                i64.load offset=672
                i64.store offset=608
                br 1 (;@5;)
              end
              local.get 4
              i32.const 256
              i32.store16 offset=608
            end
            local.get 4
            i32.const 736
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i32.const 752
            i32.add
            call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 4
            i64.const 4611686018427387904
            i64.store offset=648
            local.get 4
            i32.const 2
            i32.store8 offset=640
            local.get 4
            i64.const 4613937818241073152
            i64.store offset=680
            local.get 4
            i32.const 2
            i32.store8 offset=672
            local.get 4
            i32.const 736
            i32.add
            local.get 4
            i32.const 640
            i32.add
            local.get 4
            i32.const 672
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Mul>::mul>"
            local.get 4
            local.get 4
            i64.load offset=744
            i64.store offset=200
            local.get 4
            local.get 4
            i64.load offset=752
            i64.store offset=208
            block ;; label = @5
              local.get 4
              i64.load offset=736
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
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
              i32.const 608
              i32.add
              call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 2 (;@3;)
            end
            local.get 4
            local.get 4
            i64.load offset=208
            i64.store offset=224
            local.get 4
            local.get 4
            i64.load offset=200
            i64.store offset=216
            local.get 4
            i32.const 704
            i32.add
            local.get 4
            i32.const 608
            i32.add
            local.get 4
            i32.const 216
            i32.add
            call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive> as core::ops::arith::Add>::add"
            local.get 4
            local.get 4
            i64.load offset=712
            i64.store offset=184
            local.get 4
            local.get 4
            i64.load offset=720
            i64.store offset=192
            block ;; label = @5
              local.get 4
              i64.load offset=704
              i64.const 1
              i64.ne
              br_if 0 (;@5;)
              local.get 0
              local.get 4
              i64.load offset=192
              i64.store offset=16
              local.get 0
              local.get 4
              i64.load offset=184
              i64.store offset=8
              local.get 0
              i64.const 1
              i64.store
              br 2 (;@3;)
            end
            local.get 4
            local.get 4
            i64.load offset=192
            i64.store offset=176
            local.get 4
            local.get 4
            i64.load offset=184
            i64.store offset=168
            local.get 4
            i64.const 4619567317775286272
            i64.store offset=648
            local.get 4
            i32.const 2
            i32.store8 offset=640
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
                                local.get 4
                                i32.load8_u offset=40
                                local.tee 6
                                br_table 6 (;@8;) 6 (;@8;) 0 (;@14;) 1 (;@13;) 2 (;@12;) 3 (;@11;) 4 (;@10;) 5 (;@9;) 6 (;@8;)
                              end
                              local.get 4
                              i64.load offset=48
                              local.set 7
                              br 8 (;@5;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 8 (;@4;)
                            br 6 (;@6;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          i32.eqz
                          br_if 7 (;@4;)
                          local.get 4
                          i64.load8_u offset=52
                          i64.const 32
                          i64.shl
                          local.get 4
                          i64.load32_u offset=48
                          i64.or
                          local.set 7
                          br 6 (;@5;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        br_if 4 (;@6;)
                        br 6 (;@4;)
                      end
                      local.get 4
                      i32.load offset=44
                      local.tee 3
                      local.get 3
                      i32.load
                      i32.const 1
                      i32.add
                      local.tee 5
                      i32.store
                      local.get 5
                      br_if 3 (;@6;)
                      br 5 (;@4;)
                    end
                    local.get 4
                    i32.load offset=44
                    local.tee 3
                    local.get 3
                    i32.load
                    i32.const 1
                    i32.add
                    local.tee 5
                    i32.store
                    local.get 5
                    i32.eqz
                    br_if 4 (;@4;)
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.load8_u offset=41
                  local.set 5
                end
                br 1 (;@5;)
              end
              local.get 4
              i64.load32_u offset=48
              local.set 7
            end
            local.get 4
            local.get 7
            i64.store offset=680
            local.get 4
            local.get 3
            i32.store offset=676
            local.get 4
            local.get 5
            i32.store8 offset=673
            local.get 4
            local.get 6
            i32.store8 offset=672
            local.get 4
            i64.const 0
            i64.store offset=744
            local.get 4
            i32.const 2
            i32.store8 offset=736
            local.get 4
            i32.const 544
            i32.add
            local.get 4
            i32.const 672
            i32.add
            local.get 4
            i32.const 736
            i32.add
            call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
            block ;; label = @5
              block ;; label = @6
                block ;; label = @7
                  local.get 4
                  i32.load8_u offset=544
                  i32.const 255
                  i32.ne
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  i64.load offset=560
                  i64.store offset=16
                  local.get 0
                  local.get 4
                  i64.load offset=552
                  i64.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  local.get 4
                  i32.const 640
                  i32.add
                  call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=568
                i64.store offset=760
                local.get 4
                local.get 4
                i64.load offset=560
                i64.store offset=752
                local.get 4
                local.get 4
                i64.load offset=552
                i64.store offset=744
                local.get 4
                local.get 4
                i64.load offset=544
                i64.store offset=736
                local.get 4
                i32.const 672
                i32.add
                local.get 4
                i32.const 736
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=672
                    i32.const 255
                    i32.eq
                    br_if 0 (;@8;)
                    local.get 4
                    local.get 4
                    i64.load offset=680
                    i64.store offset=272
                    local.get 4
                    local.get 4
                    i64.load offset=672
                    i64.store offset=264
                    br 1 (;@7;)
                  end
                  local.get 4
                  i32.const 256
                  i32.store16 offset=264
                end
                local.get 4
                i32.const 736
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 752
                i32.add
                call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                local.get 4
                i32.const 704
                i32.add
                local.get 4
                i32.const 640
                i32.add
                local.get 4
                i32.const 264
                i32.add
                call $"<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive> as core::ops::arith::Rem>::rem>"
                local.get 4
                local.get 4
                i64.load offset=712
                i64.store offset=248
                local.get 4
                local.get 4
                i64.load offset=720
                i64.store offset=256
                block ;; label = @7
                  local.get 4
                  i64.load offset=704
                  i64.const 1
                  i64.ne
                  br_if 0 (;@7;)
                  local.get 0
                  local.get 4
                  i64.load offset=256
                  i64.store offset=16
                  local.get 0
                  local.get 4
                  i64.load offset=248
                  i64.store offset=8
                  local.get 0
                  i64.const 1
                  i64.store
                  br 1 (;@6;)
                end
                local.get 4
                local.get 4
                i64.load offset=256
                i64.store offset=240
                local.get 4
                local.get 4
                i64.load offset=248
                i64.store offset=232
                local.get 4
                i64.const 4611686018427387904
                i64.store offset=680
                local.get 4
                i32.const 2
                i32.store8 offset=672
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
                                    i32.load8_u offset=40
                                    local.tee 6
                                    br_table 6 (;@10;) 6 (;@10;) 0 (;@16;) 1 (;@15;) 2 (;@14;) 3 (;@13;) 4 (;@12;) 5 (;@11;) 6 (;@10;)
                                  end
                                  local.get 4
                                  i64.load offset=48
                                  local.set 7
                                  br 8 (;@7;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 5
                                i32.store
                                local.get 5
                                i32.eqz
                                br_if 10 (;@4;)
                                br 6 (;@8;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 5
                              i32.store
                              local.get 5
                              i32.eqz
                              br_if 9 (;@4;)
                              local.get 4
                              i64.load8_u offset=52
                              i64.const 32
                              i64.shl
                              local.get 4
                              i64.load32_u offset=48
                              i64.or
                              local.set 7
                              br 6 (;@7;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 5
                            i32.store
                            local.get 5
                            i32.eqz
                            br_if 8 (;@4;)
                            br 4 (;@8;)
                          end
                          local.get 4
                          i32.load offset=44
                          local.tee 3
                          local.get 3
                          i32.load
                          i32.const 1
                          i32.add
                          local.tee 5
                          i32.store
                          local.get 5
                          i32.eqz
                          br_if 7 (;@4;)
                          br 3 (;@8;)
                        end
                        local.get 4
                        i32.load offset=44
                        local.tee 3
                        local.get 3
                        i32.load
                        i32.const 1
                        i32.add
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 6 (;@4;)
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.load8_u offset=41
                      local.set 5
                    end
                    br 1 (;@7;)
                  end
                  local.get 4
                  i64.load32_u offset=48
                  local.set 7
                end
                local.get 4
                local.get 7
                i64.store offset=712
                local.get 4
                local.get 3
                i32.store offset=708
                local.get 4
                local.get 5
                i32.store8 offset=705
                local.get 4
                local.get 6
                i32.store8 offset=704
                local.get 4
                i64.const 0
                i64.store offset=744
                local.get 4
                i32.const 2
                i32.store8 offset=736
                local.get 4
                i32.const 576
                i32.add
                local.get 4
                i32.const 704
                i32.add
                local.get 4
                i32.const 736
                i32.add
                call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                block ;; label = @7
                  block ;; label = @8
                    local.get 4
                    i32.load8_u offset=576
                    i32.const 255
                    i32.ne
                    br_if 0 (;@8;)
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
                    local.get 4
                    i32.const 672
                    i32.add
                    call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 4
                  i64.load offset=600
                  i64.store offset=760
                  local.get 4
                  local.get 4
                  i64.load offset=592
                  i64.store offset=752
                  local.get 4
                  local.get 4
                  i64.load offset=584
                  i64.store offset=744
                  local.get 4
                  local.get 4
                  i64.load offset=576
                  i64.store offset=736
                  local.get 4
                  i32.const 704
                  i32.add
                  local.get 4
                  i32.const 736
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=704
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=712
                      i64.store offset=328
                      local.get 4
                      local.get 4
                      i64.load offset=704
                      i64.store offset=320
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 256
                    i32.store16 offset=320
                  end
                  local.get 4
                  i32.const 296
                  i32.add
                  i32.const 8
                  i32.add
                  local.set 3
                  local.get 4
                  i32.const 736
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 752
                  i32.add
                  call $"#func537 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  local.get 4
                  i32.const 296
                  i32.add
                  local.get 4
                  i32.const 672
                  i32.add
                  local.get 4
                  i32.const 320
                  i32.add
                  call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::numeric_op::<<nanvm_lib::vm::numeric::Numeric<nanvm_lib::naive::Naive>>::pow>
                  block ;; label = @8
                    local.get 4
                    i64.load offset=296
                    i64.const 1
                    i64.ne
                    br_if 0 (;@8;)
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
                    br 1 (;@7;)
                  end
                  local.get 4
                  local.get 3
                  i64.load offset=8
                  i64.store offset=288
                  local.get 4
                  local.get 3
                  i64.load
                  i64.store offset=280
                  local.get 4
                  i32.const 704
                  i32.add
                  local.get 4
                  i32.const 40
                  i32.add
                  call $"#func518 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                  local.get 4
                  i64.const 0
                  i64.store offset=744
                  local.get 4
                  i32.const 2
                  i32.store8 offset=736
                  local.get 4
                  i32.const 608
                  i32.add
                  local.get 4
                  i32.const 704
                  i32.add
                  local.get 4
                  i32.const 736
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=608
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=624
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=616
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 352
                    i32.add
                    i32.const 8
                    i32.add
                    local.set 3
                    local.get 4
                    local.get 4
                    i64.load offset=632
                    i64.store offset=760
                    local.get 4
                    local.get 4
                    i64.load offset=624
                    i64.store offset=752
                    local.get 4
                    local.get 4
                    i64.load offset=616
                    i64.store offset=744
                    local.get 4
                    local.get 4
                    i64.load offset=608
                    i64.store offset=736
                    local.get 4
                    i32.const 376
                    i32.add
                    local.get 4
                    i32.const 736
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                    local.get 4
                    i32.const 352
                    i32.add
                    local.get 4
                    i32.const 376
                    i32.add
                    call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::bitwise_not
                    block ;; label = @9
                      local.get 4
                      i64.load offset=352
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
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 3
                    i64.load offset=8
                    i64.store offset=344
                    local.get 4
                    local.get 3
                    i64.load
                    i64.store offset=336
                    local.get 4
                    i32.const 704
                    i32.add
                    local.get 4
                    i32.const 40
                    i32.add
                    call $"#func518 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                    local.get 4
                    i64.const 0
                    i64.store offset=744
                    local.get 4
                    i32.const 2
                    i32.store8 offset=736
                    local.get 4
                    i32.const 640
                    i32.add
                    local.get 4
                    i32.const 704
                    i32.add
                    local.get 4
                    i32.const 736
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=640
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=656
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=648
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      local.get 4
                      i32.const 336
                      i32.add
                      call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=664
                    i64.store offset=760
                    local.get 4
                    local.get 4
                    i64.load offset=656
                    i64.store offset=752
                    local.get 4
                    local.get 4
                    i64.load offset=648
                    i64.store offset=744
                    local.get 4
                    local.get 4
                    i64.load offset=640
                    i64.store offset=736
                    local.get 4
                    i32.const 408
                    i32.add
                    local.get 4
                    i32.const 736
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                    local.get 4
                    i32.const 408
                    i32.add
                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                    local.set 3
                    local.get 4
                    i32.const 1
                    i32.store8 offset=392
                    local.get 4
                    local.get 3
                    i32.const 1
                    i32.xor
                    i32.store8 offset=393
                    local.get 4
                    i32.const 704
                    i32.add
                    local.get 4
                    i32.const 40
                    i32.add
                    call $"#func518 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                    local.get 4
                    i64.const 0
                    i64.store offset=744
                    local.get 4
                    i32.const 2
                    i32.store8 offset=736
                    local.get 4
                    i32.const 672
                    i32.add
                    local.get 4
                    i32.const 704
                    i32.add
                    local.get 4
                    i32.const 736
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=672
                        i32.const 255
                        i32.ne
                        br_if 0 (;@10;)
                        local.get 0
                        local.get 4
                        i64.load offset=688
                        i64.store offset=16
                        local.get 0
                        local.get 4
                        i64.load offset=680
                        i64.store offset=8
                        local.get 0
                        i64.const 1
                        i64.store
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 440
                      i32.add
                      i32.const 8
                      i32.add
                      local.set 3
                      local.get 4
                      local.get 4
                      i64.load offset=696
                      i64.store offset=760
                      local.get 4
                      local.get 4
                      i64.load offset=688
                      i64.store offset=752
                      local.get 4
                      local.get 4
                      i64.load offset=680
                      i64.store offset=744
                      local.get 4
                      local.get 4
                      i64.load offset=672
                      i64.store offset=736
                      local.get 4
                      i32.const 464
                      i32.add
                      local.get 4
                      i32.const 736
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                      local.get 4
                      i32.const 440
                      i32.add
                      local.get 4
                      i32.const 464
                      i32.add
                      call $<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>::typeof_
                      block ;; label = @10
                        local.get 4
                        i64.load offset=440
                        i64.const 1
                        i64.ne
                        br_if 0 (;@10;)
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
                        br 1 (;@9;)
                      end
                      local.get 4
                      local.get 3
                      i64.load offset=8
                      i64.store offset=432
                      local.get 4
                      local.get 3
                      i64.load
                      i64.store offset=424
                      local.get 4
                      i32.const 768
                      i32.add
                      local.get 4
                      i32.const 40
                      i32.add
                      call $"#func518 <nanvm_lib::naive::Naive as core::clone::Clone>::clone"
                      local.get 4
                      i64.const 0
                      i64.store offset=744
                      local.get 4
                      i32.const 2
                      i32.store8 offset=736
                      local.get 4
                      i32.const 704
                      i32.add
                      local.get 4
                      i32.const 768
                      i32.add
                      local.get 4
                      i32.const 736
                      i32.add
                      call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                      block ;; label = @10
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=704
                          i32.const 255
                          i32.ne
                          br_if 0 (;@11;)
                          local.get 4
                          i32.const 712
                          i32.add
                          local.set 3
                          br 1 (;@10;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=728
                        i64.store offset=760
                        local.get 4
                        local.get 4
                        i64.load offset=720
                        i64.store offset=752
                        local.get 4
                        local.get 4
                        i64.load offset=712
                        i64.store offset=744
                        local.get 4
                        local.get 4
                        i64.load offset=704
                        i64.store offset=736
                        local.get 4
                        i32.const 480
                        i32.add
                        local.get 4
                        i32.const 736
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::read
                        local.get 4
                        i64.const 4607182418800017408
                        i64.store offset=504
                        local.get 4
                        i32.const 2
                        i32.store8 offset=496
                        local.get 4
                        i32.const 736
                        i32.add
                        local.get 4
                        i32.const 480
                        i32.add
                        local.get 4
                        i32.const 496
                        i32.add
                        call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                        local.get 4
                        i32.load8_u offset=737
                        local.set 6
                        local.get 4
                        i32.load8_u offset=736
                        local.tee 5
                        i32.const 255
                        i32.eq
                        br_if 5 (;@5;)
                        local.get 4
                        local.get 4
                        i64.load offset=744 align=2
                        i64.store offset=776 align=2
                        local.get 4
                        local.get 4
                        i64.load offset=738 align=2
                        i64.store offset=770 align=2
                        local.get 4
                        local.get 6
                        i32.store8 offset=769
                        local.get 4
                        local.get 5
                        i32.store8 offset=768
                        local.get 4
                        i32.const 768
                        i32.add
                        local.set 3
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
                      i32.const 424
                      i32.add
                      call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    end
                    local.get 4
                    i32.const 392
                    i32.add
                    call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 336
                    i32.add
                    call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                  end
                  local.get 4
                  i32.const 280
                  i32.add
                  call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 232
                i32.add
                call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              end
              local.get 4
              i32.const 168
              i32.add
              call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
              br 2 (;@3;)
            end
            local.get 4
            i32.const 1
            i32.store8 offset=768
            local.get 4
            local.get 6
            i32.const 255
            i32.and
            i32.const 1
            i32.eq
            i32.store8 offset=769
            block ;; label = @5
              block ;; label = @6
                local.get 4
                i32.const 768
                i32.add
                call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::boolean_coercion::BooleanCoercion>
                br_if 0 (;@6;)
                local.get 4
                i32.const 24
                i32.add
                i32.const 1063198
                i32.const 5
                call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
                local.get 4
                i32.load offset=28
                local.set 6
                local.get 4
                i32.load offset=24
                local.set 5
                br 1 (;@5;)
              end
              local.get 4
              i32.const 16
              i32.add
              i32.const 1063203
              i32.const 3
              call $"<nanvm_lib::vm::string::String<nanvm_lib::naive::Naive> as core::convert::From<&str>>::from"
              local.get 4
              i32.load offset=20
              local.set 6
              local.get 4
              i32.load offset=16
              local.set 5
            end
            local.get 4
            local.get 4
            i64.load offset=176
            i64.store offset=64
            local.get 4
            local.get 4
            i64.load offset=168
            i64.store offset=56
            local.get 4
            local.get 4
            i64.load offset=232
            i64.store offset=72
            local.get 4
            local.get 4
            i64.load offset=240
            i64.store offset=80
            local.get 4
            local.get 4
            i64.load offset=280
            i64.store offset=88
            local.get 4
            local.get 4
            i64.load offset=288
            i64.store offset=96
            local.get 4
            local.get 4
            i64.load offset=336
            i64.store offset=104
            local.get 4
            local.get 4
            i64.load offset=344
            i64.store offset=112
            local.get 4
            local.get 4
            i64.load offset=400
            i64.store offset=128
            local.get 4
            local.get 4
            i64.load offset=392
            i64.store offset=120
            local.get 4
            local.get 6
            i32.store offset=160
            local.get 4
            i32.const 3
            i32.store8 offset=152
            local.get 4
            local.get 5
            i32.store offset=156
            local.get 4
            local.get 3
            i64.load offset=8
            i64.store offset=144
            local.get 4
            local.get 3
            i64.load
            i64.store offset=136
            local.get 4
            i32.const 8
            i32.add
            local.get 4
            i32.const 56
            i32.add
            call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 7]>"
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
            i32.const 40
            i32.add
            call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            local.get 2
            local.get 2
            i32.load
            i32.const -1
            i32.add
            local.tee 3
            i32.store
            local.get 3
            br_if 3 (;@1;)
            br 2 (;@2;)
          end
          unreachable
        end
        local.get 4
        i32.const 40
        i32.add
        call $"#func462 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
      i32.const 32
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 784
    i32.add
    global.set $__stack_pointer
  )
