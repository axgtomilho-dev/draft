# AGENTS.md

## Project

Kotlin 2.x, Spring Boot 3, Gradle (Kotlin DSL). REST API with PostgreSQL (JPA/Hibernate) and Kafka.

## Architecture Rules

Structure by feature module, not by layer. Never create top-level `controllers/`, `services/`, `repositories/` packages.

```
src/main/kotlin/com/empresa/app/
├── order/
│   ├── Order.kt                    # JPA entity = domain object
│   ├── OrderStatus.kt              # domain enum
│   ├── OrderRepository.kt          # interface
│   ├── JpaOrderRepository.kt       # implementation
│   ├── OrderService.kt             # business logic
│   ├── OrderController.kt          # HTTP layer
│   ├── OrderDtos.kt                # input/output DTOs (data classes, one file per module)
│   └── OrderRules.kt               # pure functions (top-level or object, no I/O)
├── user/
│   └── ...
├── shared/
│   ├── exception/
│   ├── config/
│   └── util/
└── Application.kt
```

### Dependency direction

- `Controller` → `Service` → `Repository` (interface). Never the reverse.
- `Service` must NOT import from `controller` package or from `org.springframework.web.*`.
- `Service` must NOT return `ResponseEntity`, throw `ResponseStatusException`, or reference any HTTP concept.
- `Service` returns domain objects or DTOs. Controller converts to HTTP response.
- `shared/` must NOT import from any feature module.
- Pure rule files (`*Rules.kt`) must NOT import Spring or I/O dependencies.

### Interfaces

Create interfaces ONLY for:
- Repositories (data access)
- External API clients

Do NOT create interfaces for services. The controller depends on the concrete service class.

### Dependency injection

Constructor injection only. Use Kotlin primary constructor with `private val`:

```kotlin
@Service
class OrderService(
    private val orderRepository: OrderRepository,
    private val eventPublisher: EventPublisher,
)
```

Never use `@Autowired`, field injection, or `lateinit var` for dependencies.

### Domain exceptions

Each module defines its own exceptions extending `RuntimeException`. Translation to HTTP status happens in a `@RestControllerAdvice`, never inside the service.

```kotlin
// Service throws domain exception
throw OrderNotFoundException(orderId)

// Global handler translates to HTTP
@ExceptionHandler(OrderNotFoundException::class)
fun handle(ex: OrderNotFoundException): ResponseEntity<ErrorResponse> { ... }
```

### Entity mapping

Use JPA entity as domain object directly. Do NOT create separate domain model + JPA entity + mapper unless there is a concrete reason (complex joins, audit fields that pollute the domain). If separation becomes necessary, introduce it at that point — not preemptively.

JPA entities use `class` (not `data class`) with mutable `var` properties, because Hibernate requires it. Mark default constructor with `protected` for JPA:

```kotlin
@Entity
@Table(name = "orders")
class Order(
    @Id val id: String = UUID.randomUUID().toString(),
    var status: OrderStatus = OrderStatus.PENDING,
    val userId: String,
    val total: BigDecimal,
)
```

### Pure business logic

Extract calculations, validations and rules to top-level functions or an `object` in `*Rules.kt`. No side effects, no I/O. Prefer top-level functions over companion object.

```kotlin
// OrderRules.kt — top-level, no class wrapper
fun calculateDiscount(total: BigDecimal, tier: CustomerTier): BigDecimal = when {
    tier == CustomerTier.PREMIUM && total > 500.toBigDecimal() -> total * 0.15.toBigDecimal()
    total > 1000.toBigDecimal() -> total * 0.10.toBigDecimal()
    else -> BigDecimal.ZERO
}
```

### DTOs

Use `data class` for input commands and output responses. Group related DTOs in a single `*Dtos.kt` file per module. Never use a DTO as JPA entity or vice-versa.

```kotlin
// OrderDtos.kt
data class CreateOrderCommand(val userId: String, val items: List<ItemCommand>)
data class OrderResponse(val id: String, val status: String, val total: BigDecimal)
```

### Kotlin idioms to follow

- Prefer `val` over `var`. Use `var` only when mutability is required (JPA entities, builders).
- Use `?.let { }`, `?:`, and `require`/`check` instead of null-check `if` chains.
- Use `when` instead of `if-else` chains with more than 2 branches.
- Use extension functions for transformations: `Order.toResponse()` over `OrderMapper.toResponse(order)`.
- Prefer expression body (`= expr`) for single-expression functions.
- Do NOT use `!!` (non-null assertion). If a value can be null, handle it explicitly.

### Kotlin anti-patterns to avoid

- No `companion object` for utility functions — use top-level functions.
- No `object` singletons for services — use Spring-managed `@Service` classes.
- No `open` modifier manually — use the `kotlin-spring` compiler plugin (all-open for Spring annotations).
- No `data class` for JPA entities — breaks Hibernate proxy/lazy loading.

### Testing

- Pure rule functions: unit test directly, no mocks.
- Services: inject mock repositories/clients via constructor.
- Controllers: `@WebMvcTest` with mocked service.
- Repository: `@DataJpaTest` with testcontainers or H2.
- Use Kotlin test conventions: backtick method names for readability.

```kotlin
@Test
fun `should apply premium discount when total exceeds 500`() { ... }
```

## Enforcement

These rules are validated by ArchUnit tests in `src/test/kotlin/.../ArchitectureTest.kt`. Run `./gradlew test --tests *ArchitectureTest` to verify.
