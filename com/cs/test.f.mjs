import cs from './testlib.f.ts'

const f = () =>
{
    const e =
        'using System;\n' +
        'using System.Runtime.InteropServices;\n' +
        '\n' +
        'namespace My\n' +
        '{\n' +
        '    [StructLayout(LayoutKind.Sequential)]\n' +
        '    public struct Slice\n' +
        '    {\n' +
        '        public unsafe byte* Start;\n' +
        '        public UIntPtr Size;\n' +
        '    }\n' +
        '    [StructLayout(LayoutKind.Sequential)]\n' +
        '    public struct ManagedStruct\n' +
        '    {\n' +
        '        public IMy M;\n' +
        '    }\n' +
        '    [Guid("C66FB270-2D80-49AD-BB6E-88C1F90B805D")]\n' +
        '    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\n' +
        '    public interface IMy\n' +
        '    {\n' +
        '        [PreserveSig]\n' +
        '        Slice GetSlice();\n' +
        '        [PreserveSig]\n' +
        '        void SetSlice(Slice slice);\n' +
        '        [PreserveSig]\n' +
        '        unsafe byte* GetUnsafe();\n' +
        '        [PreserveSig]\n' +
        '        unsafe void SetUnsafe(Slice* p, uint size);\n' +
        '        [PreserveSig]\n' +
        '        byte Some(IMy p);\n' +
        '        [PreserveSig]\n' +
        '        IMy GetIMy(ushort a, short b);\n' +
        '        [PreserveSig]\n' +
        '        void SetManagedStruct(ManagedStruct a);\n' +
        '    }\n' +
        '}'
    if (cs !== e) { throw cs }
}

export default f
