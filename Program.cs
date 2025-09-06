// See https://aka.ms/new-console-template for more information
Console.WriteLine("Hello, World!");

enum Nullish
{
    Null,
    Undefined,
}

interface IArray
{
    int Length { get; }
    IAny Get(int index);
}

interface IObject
{
    int Length { get; }
    (string key, IAny value) Get(int index);
}

interface IVisitor<R>
{
    R Nullish(Nullish value);
    R Boolean(bool value);
    R Number(double value);
    R String(string value);
    R Array(IArray value);
    R Object(IObject value);
}

interface IAny
{
    R Visit<R>(IVisitor<R> visitor);
    static abstract IAny From(Nullish value);
}

struct Naive : IAny
{
    readonly object value;

    public R Visit<R>(IVisitor<R> visitor)
    {
        switch (value)
        {
            case Nullish n:
                return visitor.Nullish(n);
            case bool b:
                return visitor.Boolean(b);
            case double d:
                return visitor.Number(d);
            case string s:
                return visitor.String(s);
            case IArray a:
                return visitor.Array(a);
            case IObject o:
                return visitor.Object(o);
            default:
                throw new InvalidCastException();
        }
    }

    public static IAny From(Nullish value) => new Naive(value);

    public Naive(Nullish value)
    {
        this.value = value;
    }
}
