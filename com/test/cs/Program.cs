using System.Runtime.InteropServices;

[DllImport("main.dll")]
static extern int get();

// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");
