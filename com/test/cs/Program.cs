using System.Runtime.InteropServices;
using My;

[DllImport("testrust")]
static extern int get();

[DllImport("testrust")]
static extern IMy rust_my_create();

[DllImport("testc")]
static extern int c_get();

// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");
Console.WriteLine(get());
Console.WriteLine(c_get());

var x = rust_my_create();
x.SetSlice(new Slice { Start = null, Size = (UIntPtr)44 });