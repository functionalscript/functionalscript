# Architecture Diagram

## System Overview

```mermaid
graph TB
    subgraph "Pure Layer (No Side Effects)"
        UserCode[User Code<br/>*.f.ts]
        Effects[Core Effects<br/>effects/module.f.ts]
        NodeEffects[Node.js Effects<br/>effects/node/module.f.ts]
        Utils[Utility Modules<br/>string, array, path]
        FJS[FJS Executable<br/>fjs-eff/module.f.ts]
        
        UserCode --> Effects
        UserCode --> NodeEffects
        UserCode --> Utils
        FJS --> Effects
        FJS --> NodeEffects
        FJS --> Utils
        NodeEffects --> Effects
    end
    
    subgraph "Impure Layer (Side Effects)"
        Runner[Effect Runner<br/>effects/node/module.ts]
        FJSRunner[FJS Entry Point<br/>fjs-eff/module.ts]
        
        FJSRunner --> Runner
    end
    
    subgraph "External World"
        FileSystem[File System]
        Console[Console I/O]
        Process[Process/Env]
    end
    
    Effects -.describes.-> Runner
    NodeEffects -.describes.-> Runner
    FJS -.describes.-> FJSRunner
    Runner --> FileSystem
    Runner --> Console
    Runner --> Process
    
    style UserCode fill:#e1f5ff
    style Effects fill:#e1f5ff
    style NodeEffects fill:#e1f5ff
    style Utils fill:#e1f5ff
    style FJS fill:#e1f5ff
    style Runner fill:#ffe1e1
    style FJSRunner fill:#ffe1e1
```

## Effect Flow

```mermaid
sequenceDiagram
    participant User as User Code (Pure)
    participant Eff as Effect Constructor
    participant Runner as Effect Runner (Impure)
    participant FS as File System
    
    User->>Eff: readFile('/file.txt')
    Eff-->>User: Effect<string> (pure data)
    Note over User,Eff: No I/O happens yet!
    
    User->>Eff: flatMap(writeFile('/out.txt'))
    Eff-->>User: Effect<void> (pure data)
    Note over User,Eff: Still no I/O!
    
    User->>Runner: runEffect(effect)
    activate Runner
    Runner->>FS: Read /file.txt
    FS-->>Runner: "content"
    Runner->>Runner: Apply continuation
    Runner->>FS: Write /out.txt
    FS-->>Runner: Success
    Runner-->>User: Promise<void>
    deactivate Runner
    Note over Runner,FS: I/O happens only here
```

## Effect Composition

```mermaid
graph LR
    subgraph "Effect Chain"
        A[readFile<br/>path.txt] -->|flatMap| B[Transform<br/>content]
        B -->|flatMap| C[writeFile<br/>out.txt]
        C -->|flatMap| D[stdOut<br/>Success!]
    end
    
    subgraph "Pure Data Structure"
        E[Effect: readFile<br/>tag: 'readFile'<br/>payload: 'path.txt'<br/>cont: ...] --> F[Effect: writeFile<br/>tag: 'writeFile'<br/>payload: {...}<br/>cont: ...]
        F --> G[Effect: stdOut<br/>tag: 'stdOut'<br/>payload: 'Success!'<br/>cont: ...]
    end
    
    A -.represents.-> E
    C -.represents.-> F
    D -.represents.-> G
```

## Testing Strategy

```mermaid
graph TB
    subgraph "Testing Pure Effects"
        T1[Create Effect] --> T2[Inspect Structure]
        T2 --> T3[Test Continuation]
        T3 --> T4[Verify Result]
    end
    
    subgraph "Testing with Mocks"
        M1[Create Effect] --> M2[Create Mock Handlers]
        M2 --> M3[Run with runMock]
        M3 --> M4[Verify Result]
    end
    
    subgraph "Integration Testing"
        I1[Create Effect] --> I2[Run with runEffect]
        I2 --> I3[Verify Real I/O]
    end
    
    style T1 fill:#d4edda
    style M1 fill:#fff3cd
    style I1 fill:#f8d7da
```

## Module Dependencies

```mermaid
graph TB
    subgraph "Core"
        EM[effects/module.f.ts]
    end
    
    subgraph "Platform"
        NE[effects/node/module.f.ts]
        NR[effects/node/module.ts]
    end
    
    subgraph "Utilities"
        STR[string/module.f.ts]
        ARR[array/module.f.ts]
        PATH[path/module.f.ts]
    end
    
    subgraph "Application"
        FJS[fjs-eff/module.f.ts]
        FJSR[fjs-eff/module.ts]
    end
    
    NE --> EM
    FJS --> EM
    FJS --> NE
    FJS --> STR
    FJS --> ARR
    FJS --> PATH
    FJSR --> FJS
    NR -.runs.-> NE
    
    style EM fill:#4a90e2
    style NE fill:#7cb342
    style NR fill:#e57373
    style STR fill:#ffa726
    style ARR fill:#ffa726
    style PATH fill:#ffa726
    style FJS fill:#9575cd
    style FJSR fill:#e57373
```

## Effect Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Effect Constructor
    Created --> Composed: flatMap/map/etc
    Composed --> Composed: More Composition
    Composed --> Ready: Final Effect
    Ready --> Running: runEffect()
    Running --> Executing: Process Tag
    Executing --> Continuing: Apply Continuation
    Continuing --> Executing: More Effects
    Executing --> Completed: Pure Effect
    Completed --> [*]
    
    note right of Created
        Pure data structure
        No side effects
    end note
    
    note right of Running
        Impure execution
        Side effects occur
    end note
```

## Data Flow

```mermaid
flowchart LR
    subgraph Input
        Args[Command Args]
        Files[Source Files]
    end
    
    subgraph Pure Processing
        Parse[Parse Args]
        Create[Create Effects]
        Compose[Compose Effects]
        Validate[Validate Structure]
    end
    
    subgraph Impure Execution
        Run[Run Effect]
        IO[Perform I/O]
    end
    
    subgraph Output
        Result[Result Value]
        SideEffects[Side Effects]
    end
    
    Args --> Parse
    Parse --> Create
    Files --> Create
    Create --> Compose
    Compose --> Validate
    Validate --> Run
    Run --> IO
    IO --> Result
    IO --> SideEffects
    
    style Input fill:#e3f2fd
    style Pure Processing fill:#e8f5e9
    style Impure Execution fill:#ffebee
    style Output fill:#f3e5f5
```
