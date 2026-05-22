# AGENTS.md

## Project

Java 21, Spring Boot 3, Maven. REST API with PostgreSQL (JPA/Hibernate) and Kafka.

## Architecture Rules

Structure by feature module, not by layer. Never create top-level `controllers/`, `services/`, `repositories/` packages.

```
src/main/java/com/empresa/app/
├── order/
│   ├── Order.java                  # JPA entity = domain object
│   ├── OrderStatus.java            # domain enum
│   ├── OrderRepository.java        # interface
│   ├── JpaOrderRepository.java     # implementation
│   ├── OrderService.java           # business logic
│   ├── OrderController.java        # HTTP layer
│   ├── CreateOrderCommand.java     # input DTO (record)
│   ├── OrderResponse.java          # output DTO (record)
│   └── OrderRules.java             # pure functions (static methods, no I/O)
├── user/
│   └── ...
├── shared/
│   ├── exception/
│   ├── config/
│   └── util/
└── Application.java
```

### Dependency direction

- `Controller` → `Service` → `Repository` (interface). Never the reverse.
- `Service` must NOT import from `controller` package or from `org.springframework.web.*`.
- `Service` must NOT return `ResponseEntity`, throw `ResponseStatusException`, or reference any HTTP concept.
- `Service` returns domain objects or DTOs. Controller converts to HTTP response.
- `shared/` must NOT import from any feature module.
- Pure rule classes (`*Rules.java`) must NOT import Spring or I/O dependencies.

### Interfaces

Create interfaces ONLY for:
- Repositories (data access)
- External API clients

Do NOT create interfaces for services. The controller depends on the concrete service class.

### Dependency injection

All I/O dependencies (repositories, clients, message publishers) injected via constructor. Never instantiate them with `new` inside a service.

### Domain exceptions

Each module defines its own domain exceptions extending `RuntimeException`. Translation to HTTP status happens in a `@RestControllerAdvice`, never inside the service.

```java
// Service throws domain exception
throw new OrderNotFoundException(orderId);

// Global handler translates to HTTP
@ExceptionHandler(OrderNotFoundException.class)
ResponseEntity<ErrorResponse> handle(OrderNotFoundException ex) { ... }
```

### Entity mapping

Use JPA entity as domain object directly. Do NOT create separate domain model + JPA entity + mapper unless there is a concrete reason (complex joins, audit fields that pollute the domain). If separation becomes necessary, introduce it at that point — not preemptively.

### Pure business logic

Extract calculations, validations and business rules to static methods in `*Rules.java` classes. These take inputs and return outputs with no side effects. This is the most testable code in the project.

### DTOs

Use Java `record` for input commands and output responses. No Lombok `@Data` for DTOs.

### Testing

- Pure rule classes: unit test directly, no mocks.
- Services: inject mock repositories/clients via constructor.
- Controllers: `@WebMvcTest` with mocked service.
- Repository: `@DataJpaTest` with testcontainers or H2.

## Enforcement

These rules are validated by ArchUnit tests in `src/test/java/.../ArchitectureTest.java`. Run `mvn test -Dtest=ArchitectureTest` to verify.
