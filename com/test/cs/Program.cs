using System.Runtime.InteropServices;
using My;

[DllImport("testrust")]
static extern int get();

[DllImport("testrust")]
static extern IMy rust_my_create();

[DllImport("testc")]
static extern int c_get();

[DllImport("testc")]
static extern IMy c_my_create();

// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");
Console.WriteLine(get());
Console.WriteLine(c_get());

var x = rust_my_create();
x.SetSlice(new Slice { Start = null, Size = (UIntPtr)44 });

{
    var y = c_my_create();
    y.SetSlice(new Slice { Start = null, Size = (UIntPtr)45 });
    var t = y.GetIMy();
}

GC.Collect();
Console.WriteLine("ok");