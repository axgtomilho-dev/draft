
# AGENTS.md

## Project

Node.js 22, NestJS 11, TypeScript 5, pnpm. REST API with PostgreSQL (TypeORM) and Kafka (kafkajs).

## Architecture Rules

Structure by feature module. Each NestJS module is a self-contained feature. Never create cross-cutting folders like `controllers/`, `services/`, `repositories/` at the top level.

```
src/
├── order/
│   ├── order.module.ts              # NestJS module
│   ├── order.entity.ts              # TypeORM entity = domain object
│   ├── order-status.enum.ts         # domain enum
│   ├── order.repository.ts          # custom repository (class)
│   ├── order.service.ts             # business logic
│   ├── order.controller.ts          # HTTP layer
│   ├── order.dtos.ts                # input/output DTOs (one file per module)
│   ├── order.rules.ts               # pure functions (no I/O, no injected deps)
│   └── order.errors.ts              # domain exceptions
├── user/
│   └── ...
├── shared/
│   ├── exceptions/                  # base errors + global exception filter
│   ├── config/                      # env validation, config modules
│   └── util/                        # generic pure helpers
├── app.module.ts
└── main.ts
```

### Dependency direction

- `Controller` → `Service` → `Repository`. Never the reverse.
- `Service` must NOT import from `@nestjs/common` HTTP constructs: no `HttpException`, `HttpStatus`, `Req`, `Res`, `Response`.
- `Service` must NOT return or throw HTTP-aware objects. It throws domain errors; controller or exception filter translates to HTTP.
- `shared/` must NOT import from any feature module.
- Pure rule files (`*.rules.ts`) must NOT import from NestJS, TypeORM, or any I/O library.

### Interfaces for dependencies

Do NOT create `IOrderService`, `IOrderRepository` interfaces. Use the concrete class as the injection token.

Create an interface or abstract class ONLY when:
- Injecting an external API client that needs a mock/fake for testing.
- A service has two implementations selected at runtime.

For repositories, the concrete class is sufficient — mock it in tests with `jest.fn()` or a testing module override.

### Dependency injection

All I/O dependencies injected via NestJS constructor injection. Never instantiate a repository, client, or service with `new` inside another service.

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventBus: EventBus,
  ) {}
}
```

### Domain exceptions

Each module defines its own errors in `*.errors.ts` extending a base `DomainError`. A global `ExceptionFilter` maps domain errors to HTTP status. Services never import `HttpException`.

```typescript
// order.errors.ts
export class OrderNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Order ${id} not found`);
  }
}

// shared/exceptions/domain-exception.filter.ts
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost) {
    // map error class → status code
  }
}
```

### Entity mapping

Use TypeORM entity as domain object directly. Do NOT create separate domain model + ORM entity + mapper. If separation becomes necessary (complex joins, read-model projections), introduce it at that point — not preemptively.

```typescript
@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus;

  @Column()
  userId: string;

  @Column({ type: 'decimal' })
  total: number;
}
```

### Pure business logic

Extract calculations, validations and rules to `*.rules.ts` as exported pure functions. No classes, no decorators, no injected dependencies. Takes input, returns output.

```typescript
// order.rules.ts
export function calculateDiscount(total: number, tier: CustomerTier): number {
  if (tier === 'premium' && total > 500) return total * 0.15;
  if (total > 1000) return total * 0.10;
  return 0;
}
```

These are the easiest to test — no TestingModule, no mocks.

### DTOs

Use `class` with `class-validator` decorators for input DTOs (NestJS `ValidationPipe` requires classes, not interfaces/types). Use a plain `class` or `type` for output DTOs. Group related DTOs in a single `*.dtos.ts` file per module.

```typescript
// order.dtos.ts
export class CreateOrderDto {
  @IsString()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  items: CreateOrderItemDto[];
}

export type OrderResponseDto = {
  id: string;
  status: string;
  total: number;
};
```

Do NOT use `interface` for input DTOs — `class-validator` requires class instances at runtime.

### TypeScript conventions

- Prefer `type` over `interface` for object shapes that are not extended. Use `interface` only when declaration merging or `implements` is needed.
- Never use `any`. Use `unknown` and narrow, or define the type.
- Never use `enum` at the TypeScript level — use `as const` objects or string literal unions. Exception: TypeORM `@Column({ type: 'enum' })` requires a TS enum.
- Prefer `readonly` for properties that should not be reassigned after construction.
- Use `Record<K, V>` instead of `{ [key: string]: V }`.
- Barrel files (`index.ts`): one per module exporting only public API. Never re-export internal implementation details.

### NestJS anti-patterns to avoid

- No `@Inject(forwardRef(() => ...))` — circular dependency means wrong module boundary. Refactor.
- No business logic in controllers — controller only validates input, calls service, formats output.
- No `@Res()` decorator to access Express response object in controllers — breaks NestJS interceptors and serialization. Return values and let NestJS handle the response.
- No dynamic module registration (`register`/`forRoot`) inside feature modules — only in `app.module.ts` or `shared/config/`.

### Testing

- Pure rule functions: `describe` + plain assertions, no TestingModule.
- Services: `Test.createTestingModule` with mocked repository/clients via `.overrideProvider()`.
- Controllers: `@nestjs/testing` with mocked service.
- Repository: integration test with testcontainers or SQLite.
- E2E: `supertest` with `INestApplication`.

## Enforcement

Dependency direction rules are validated by a custom ESLint config using `eslint-plugin-boundaries` or `eslint-plugin-import/no-restricted-paths`. Run `pnpm lint` to verify.
