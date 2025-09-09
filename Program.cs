// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");

struct Undefined { }

interface IPolicy<T> where T : struct, IPolicy<T>
{
}

struct Any<T> where T : struct, IPolicy<T>
{
    readonly object value;

    public Any(bool value) => this.value = value;
    public Any(Undefined value) => this.value = value;
    public Any(double value) => this.value = value;
    public Any(string value) => this.value = value;
    public Any(JArray<T> value) => this.value = value.value;
    public Any(JObject<T> value) => this.value = value.value;

    public R Accept<R>(IVisitor<T, R> visitor) => value switch
    {
        null => visitor.VisitNull(),
        bool b => visitor.VisitBool(b),
        Undefined => visitor.VisitUndefined(),
        double n => visitor.VisitNumber(n),
        _ => throw new NotImplementedException(),
    };
}

interface IVisitor<T, R> where T : struct, IPolicy<T>
{
    R VisitNull();
    R VisitBool(bool value);
    R VisitUndefined();
    R VisitNumber(double value);
    R VisitString(string value);
    R VisitArray(JArray<T> value);
    R VisitObject(JObject<T> value);
}

struct JArray<T> where T : struct, IPolicy<T>
{
    internal readonly object value;
    internal JArray(object value) => this.value = value;
}

struct JObject<T> where T : struct, IPolicy<T>
{
    public readonly object value;
    public JObject(object value) => this.value = value;
}

struct JString<T> where T : struct, IPolicy<T>
{
    public readonly object value;
    public JString(object value) => this.value = value;
}
