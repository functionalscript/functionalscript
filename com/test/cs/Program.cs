using System.Runtime.InteropServices;

[DllImport("testrust")]
static extern int get();

[DllImport("testc")]
static extern int c_get();

// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");
Console.WriteLine(get());
Console.WriteLine(c_get());