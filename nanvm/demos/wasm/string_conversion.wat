  (func $nanvm_demos::samples::string_conversion::module::<nanvm_lib::naive::Naive> (;735;) (type 1) (param i32 i32)
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
    i32.const 1066998
    i32.store offset=24
    local.get 2
    i32.const 1066991
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
          i32.const 252
          i32.const 0
          local.get 3
          local.get 6
          i32.const 1066998
          i32.const 66
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
          call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
        i32.const 1055372
        i32.const 43
        local.get 2
        i32.const 32
        i32.add
        i32.const 1055356
        i32.const 1055416
        call $core::result::unwrap_failed
        unreachable
      end
      i32.const 1053928
      i32.const 43
      local.get 2
      i32.const 95
      i32.add
      i32.const 1053912
      i32.const 1053972
      call $core::result::unwrap_failed
      unreachable
    end
    i32.const 1053928
    i32.const 43
    local.get 2
    i32.const 95
    i32.add
    i32.const 1053912
    i32.const 1053972
    call $core::result::unwrap_failed
    unreachable
  )
  (func $"<nanvm_demos::samples::string_conversion::module<nanvm_lib::naive::Naive>::{closure#0} as core::ops::function::FnOnce<(&nanvm_lib::naive::function::Function, nanvm_lib::vm::array::Array<nanvm_lib::naive::Naive>)>>::call_once" (;736;) (type 3) (param i32 i32 i32 i32)
    (local i32 i32 i64 i32)
    global.get $__stack_pointer
    i32.const 368
    i32.sub
    local.tee 4
    global.set $__stack_pointer
    local.get 4
    local.get 3
    i32.store offset=36
    local.get 4
    local.get 2
    i32.store offset=32
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
                        local.get 2
                        i32.load
                        local.tee 5
                        i32.const -1
                        i32.eq
                        br_if 0 (;@10;)
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
                        local.tee 5
                        i32.store
                        local.get 5
                        i32.eqz
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 2
                        i32.store offset=268
                        local.get 4
                        i32.const 6
                        i32.store8 offset=264
                        local.get 4
                        local.get 3
                        i64.extend_i32_u
                        i64.store offset=272
                        local.get 4
                        i64.const 0
                        i64.store offset=304
                        local.get 4
                        i32.const 2
                        i32.store8 offset=296
                        local.get 4
                        i32.const 216
                        i32.add
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 296
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
                          br 8 (;@3;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=240
                        i64.store offset=320
                        local.get 4
                        local.get 4
                        i64.load offset=232
                        i64.store offset=312
                        local.get 4
                        local.get 4
                        i64.load offset=224
                        i64.store offset=304
                        local.get 4
                        local.get 4
                        i64.load offset=216
                        i64.store offset=296
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                        block ;; label = @11
                          block ;; label = @12
                            local.get 4
                            i32.load8_u offset=264
                            i32.const 255
                            i32.eq
                            br_if 0 (;@12;)
                            local.get 4
                            local.get 4
                            i64.load offset=272
                            i64.store offset=256
                            local.get 4
                            local.get 4
                            i64.load offset=264
                            i64.store offset=248
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.const 256
                          i32.store16 offset=248
                        end
                        local.get 4
                        i32.const 296
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 312
                        i32.add
                        call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                        local.get 4
                        i32.const 344
                        i32.add
                        local.get 4
                        i32.const 248
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=344
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=347
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=345 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=348 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=356
                          i32.store offset=20
                          local.get 0
                          local.get 6
                          i64.store offset=12 align=4
                          local.get 0
                          local.get 3
                          i32.store8 offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 8 (;@3;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=348 align=4
                        i64.store offset=124 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=120
                        local.get 4
                        i32.const 0
                        i32.store8 offset=200
                        local.get 4
                        i64.const 42
                        i64.store offset=304
                        local.get 4
                        i64.const 1
                        i64.store offset=296
                        local.get 4
                        local.get 4
                        i32.const 200
                        i32.add
                        i32.store offset=312
                        local.get 4
                        i32.const 24
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::iter::sources::once::Once<u64>, core::result::Result<u64, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<u64>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=28
                        local.tee 5
                        i32.store offset=348
                        local.get 4
                        local.get 4
                        i32.load offset=24
                        local.tee 3
                        i32.store offset=344
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=200
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
                          br_if 7 (;@4;)
                          local.get 4
                          i32.const 344
                          i32.add
                          call $"<alloc::rc::Rc<[u64]>>::drop_slow"
                          br 7 (;@4;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 6 (;@4;)
                        local.get 4
                        i32.const 1
                        i32.store8 offset=308
                        local.get 4
                        local.get 5
                        i32.store offset=304
                        local.get 4
                        local.get 3
                        i32.store offset=300
                        local.get 4
                        i32.const 4
                        i32.store8 offset=296
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=264
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=267
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=265 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=268 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=276
                          i32.store offset=20
                          local.get 0
                          local.get 6
                          i64.store offset=12 align=4
                          local.get 0
                          local.get 3
                          i32.store8 offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 6 (;@5;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=268 align=4
                        i64.store offset=140 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=136
                        local.get 4
                        i32.const 0
                        i32.store8 offset=200
                        local.get 4
                        i64.const 4611686018427387904
                        i64.store offset=328
                        local.get 4
                        i32.const 2
                        i32.store8 offset=320
                        local.get 4
                        i64.const 4607182418800017408
                        i64.store offset=312
                        local.get 4
                        i32.const 2
                        i32.store8 offset=304
                        local.get 4
                        i64.const 8589934592
                        i64.store offset=296
                        local.get 4
                        local.get 4
                        i32.const 200
                        i32.add
                        i32.store offset=336
                        local.get 4
                        i32.const 16
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $"<core::iter::adapters::GenericShunt<core::iter::adapters::map::Map<core::array::iter::IntoIter<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, 2>, core::result::Result<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>, ()>::Ok>, core::result::Result<core::convert::Infallible, ()>> as alloc::rc::ToRcSlice<nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>>>::to_rc_slice"
                        local.get 4
                        local.get 4
                        i32.load offset=20
                        local.tee 5
                        i32.store offset=348
                        local.get 4
                        local.get 4
                        i32.load offset=16
                        local.tee 3
                        i32.store offset=344
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=200
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
                          br_if 5 (;@6;)
                          local.get 4
                          i32.const 344
                          i32.add
                          call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
                          br 5 (;@6;)
                        end
                        local.get 3
                        i32.eqz
                        br_if 4 (;@6;)
                        local.get 4
                        local.get 5
                        i32.store offset=304
                        local.get 4
                        local.get 3
                        i32.store offset=300
                        local.get 4
                        i32.const 6
                        i32.store8 offset=296
                        local.get 4
                        i32.const 264
                        i32.add
                        local.get 4
                        i32.const 296
                        i32.add
                        call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                        block ;; label = @11
                          local.get 4
                          i32.load8_u offset=264
                          local.tee 3
                          i32.const 255
                          i32.eq
                          br_if 0 (;@11;)
                          local.get 0
                          local.get 4
                          i32.load8_u offset=267
                          i32.store8 offset=11
                          local.get 0
                          local.get 4
                          i32.load16_u offset=265 align=1
                          i32.store16 offset=9 align=1
                          local.get 4
                          i64.load offset=268 align=4
                          local.set 6
                          local.get 0
                          local.get 4
                          i32.load offset=276
                          i32.store offset=20
                          local.get 0
                          local.get 6
                          i64.store offset=12 align=4
                          local.get 0
                          local.get 3
                          i32.store8 offset=8
                          local.get 0
                          i64.const 1
                          i64.store
                          br 4 (;@7;)
                        end
                        local.get 4
                        local.get 4
                        i64.load offset=268 align=4
                        i64.store offset=156 align=4
                        local.get 4
                        i32.const 3
                        i32.store8 offset=152
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
                                      local.set 6
                                      br 9 (;@8;)
                                    end
                                    local.get 4
                                    i32.load offset=44
                                    local.tee 3
                                    local.get 3
                                    i32.load
                                    i32.const 1
                                    i32.add
                                    local.tee 7
                                    i32.store
                                    local.get 7
                                    i32.eqz
                                    br_if 6 (;@10;)
                                    br 7 (;@9;)
                                  end
                                  local.get 4
                                  i32.load offset=44
                                  local.tee 3
                                  local.get 3
                                  i32.load
                                  i32.const 1
                                  i32.add
                                  local.tee 7
                                  i32.store
                                  local.get 7
                                  i32.eqz
                                  br_if 5 (;@10;)
                                  local.get 4
                                  i64.load8_u offset=52
                                  i64.const 32
                                  i64.shl
                                  local.get 4
                                  i64.load32_u offset=48
                                  i64.or
                                  local.set 6
                                  br 7 (;@8;)
                                end
                                local.get 4
                                i32.load offset=44
                                local.tee 3
                                local.get 3
                                i32.load
                                i32.const 1
                                i32.add
                                local.tee 7
                                i32.store
                                local.get 7
                                br_if 5 (;@9;)
                                br 4 (;@10;)
                              end
                              local.get 4
                              i32.load offset=44
                              local.tee 3
                              local.get 3
                              i32.load
                              i32.const 1
                              i32.add
                              local.tee 7
                              i32.store
                              local.get 7
                              br_if 4 (;@9;)
                              br 3 (;@10;)
                            end
                            local.get 4
                            i32.load offset=44
                            local.tee 3
                            local.get 3
                            i32.load
                            i32.const 1
                            i32.add
                            local.tee 7
                            i32.store
                            local.get 7
                            i32.eqz
                            br_if 2 (;@10;)
                            br 1 (;@11;)
                          end
                          local.get 4
                          i32.load8_u offset=41
                          local.set 7
                        end
                        br 2 (;@8;)
                      end
                      unreachable
                    end
                    local.get 4
                    i64.load32_u offset=48
                    local.set 6
                  end
                  local.get 4
                  local.get 6
                  i64.store offset=352
                  local.get 4
                  local.get 3
                  i32.store offset=348
                  local.get 4
                  local.get 7
                  i32.store8 offset=345
                  local.get 4
                  local.get 5
                  i32.store8 offset=344
                  local.get 4
                  i64.const 0
                  i64.store offset=304
                  local.get 4
                  i32.const 2
                  i32.store8 offset=296
                  local.get 4
                  i32.const 264
                  i32.add
                  local.get 4
                  i32.const 344
                  i32.add
                  local.get 4
                  i32.const 296
                  i32.add
                  call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::new
                  block ;; label = @8
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=264
                      i32.const 255
                      i32.ne
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i64.load offset=280
                      i64.store offset=16
                      local.get 0
                      local.get 4
                      i64.load offset=272
                      i64.store offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=288
                    i64.store offset=320
                    local.get 4
                    local.get 4
                    i64.load offset=280
                    i64.store offset=312
                    local.get 4
                    local.get 4
                    i64.load offset=272
                    i64.store offset=304
                    local.get 4
                    local.get 4
                    i64.load offset=264
                    i64.store offset=296
                    local.get 4
                    i32.const 344
                    i32.add
                    local.get 4
                    i32.const 296
                    i32.add
                    call $<nanvm_lib::vm::lambda::member::Member<nanvm_lib::naive::Naive>>::own
                    block ;; label = @9
                      block ;; label = @10
                        local.get 4
                        i32.load8_u offset=344
                        i32.const 255
                        i32.eq
                        br_if 0 (;@10;)
                        local.get 4
                        local.get 4
                        i64.load offset=352
                        i64.store offset=192
                        local.get 4
                        local.get 4
                        i64.load offset=344
                        i64.store offset=184
                        br 1 (;@9;)
                      end
                      local.get 4
                      i32.const 256
                      i32.store16 offset=184
                    end
                    local.get 4
                    i32.const 296
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i32.const 312
                    i32.add
                    call $"#func363 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 4
                    i64.const 0
                    i64.store offset=208
                    local.get 4
                    i32.const 2
                    i32.store8 offset=200
                    local.get 4
                    i32.const 296
                    i32.add
                    local.get 4
                    i32.const 184
                    i32.add
                    local.get 4
                    i32.const 200
                    i32.add
                    call $nanvm_lib::vm::any::relational::compare::<nanvm_lib::naive::Naive>
                    local.get 4
                    i32.load8_u offset=297
                    local.set 3
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=296
                      local.tee 5
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 4
                      local.get 4
                      i64.load offset=304 align=2
                      i64.store offset=352 align=2
                      local.get 4
                      local.get 4
                      i64.load offset=298 align=2
                      i64.store offset=346 align=2
                      local.get 4
                      local.get 3
                      i32.store8 offset=345
                      local.get 4
                      local.get 5
                      i32.store8 offset=344
                      local.get 0
                      local.get 4
                      i64.load offset=344
                      i64.store offset=8
                      local.get 0
                      local.get 4
                      i64.load offset=352
                      i64.store offset=16
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    i32.const 1
                    i32.store8 offset=344
                    local.get 4
                    local.get 3
                    i32.const 255
                    i32.and
                    i32.const 1
                    i32.eq
                    i32.store8 offset=345
                    local.get 4
                    i32.const 168
                    i32.add
                    local.get 4
                    i32.const 344
                    i32.add
                    call $<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>::dispatch::<nanvm_lib::vm::primitive_dispatch::ViaPrimitive<nanvm_lib::vm::string_coercion::StringCoercion>>
                    block ;; label = @9
                      local.get 4
                      i32.load8_u offset=168
                      local.tee 3
                      i32.const 255
                      i32.eq
                      br_if 0 (;@9;)
                      local.get 0
                      local.get 4
                      i32.load8_u offset=171
                      i32.store8 offset=11
                      local.get 0
                      local.get 4
                      i32.load16_u offset=169 align=1
                      i32.store16 offset=9 align=1
                      local.get 4
                      i64.load offset=172 align=4
                      local.set 6
                      local.get 0
                      local.get 4
                      i32.load offset=180
                      i32.store offset=20
                      local.get 0
                      local.get 6
                      i64.store offset=12 align=4
                      local.get 0
                      local.get 3
                      i32.store8 offset=8
                      local.get 0
                      i64.const 1
                      i64.store
                      br 1 (;@8;)
                    end
                    local.get 4
                    local.get 4
                    i64.load offset=172 align=4
                    i64.store offset=108 align=4
                    local.get 4
                    i32.const 3
                    i32.store8 offset=104
                    local.get 4
                    local.get 4
                    i64.load offset=120
                    i64.store offset=56
                    local.get 4
                    local.get 4
                    i64.load offset=128
                    i64.store offset=64
                    local.get 4
                    local.get 4
                    i64.load offset=136
                    i64.store offset=72
                    local.get 4
                    local.get 4
                    i64.load offset=144
                    i64.store offset=80
                    local.get 4
                    local.get 4
                    i64.load offset=152
                    i64.store offset=88
                    local.get 4
                    local.get 4
                    i64.load offset=160
                    i64.store offset=96
                    local.get 4
                    i32.const 8
                    i32.add
                    local.get 4
                    i32.const 56
                    i32.add
                    call $"<nanvm_lib::naive::container::Container<(), nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>> as nanvm_lib::vm::internal::icontainer::IContainer<nanvm_lib::naive::Naive>>::new_ok::<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>; 4]>"
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
                    call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                    local.get 2
                    local.get 2
                    i32.load
                    i32.const -1
                    i32.add
                    local.tee 0
                    i32.store
                    local.get 0
                    br_if 7 (;@1;)
                    br 6 (;@2;)
                  end
                  local.get 4
                  i32.const 152
                  i32.add
                  call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                end
                local.get 4
                i32.const 136
                i32.add
                call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
                br 1 (;@5;)
              end
              i32.const 1053928
              i32.const 43
              local.get 4
              i32.const 367
              i32.add
              i32.const 1053912
              i32.const 1053972
              call $core::result::unwrap_failed
              unreachable
            end
            local.get 4
            i32.const 120
            i32.add
            call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
            br 1 (;@3;)
          end
          i32.const 1053928
          i32.const 43
          local.get 4
          i32.const 367
          i32.add
          i32.const 1053912
          i32.const 1053972
          call $core::result::unwrap_failed
          unreachable
        end
        local.get 4
        i32.const 40
        i32.add
        call $"#func730 core::ptr::drop_glue::<nanvm_lib::vm::unpacked::Unpacked<nanvm_lib::naive::Naive>>"
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
      i32.const 32
      i32.add
      call $"<alloc::rc::Rc<[nanvm_lib::vm::any::Any<nanvm_lib::naive::Naive>]>>::drop_slow"
    end
    local.get 4
    i32.const 368
    i32.add
    global.set $__stack_pointer
  )
