Java Modular Modular Monolith - ecomm sample 

Great question. You can absolutely start as a **modular monolith** in Spring Boot 2.7.1 (Java 11) and keep your options open to split into microservices later—*if* you enforce boundaries from day one.

Below is a **practical blueprint** (code + structure + rules) for an e-commerce POC with domains **Buyers, Sellers, Products, Cart**, PostgreSQL persistence, and **event-driven with Kafka**—but cleanly modular and future-proof.

---

# 1) High-level architecture (Modular Monolith / Clean + Hexagonal)

* **Multi-module Gradle**: each domain is its own Gradle module (a JAR), exposing only ports (interfaces) + DTOs; internal implementation stays hidden.
* **Hexagonal per domain**:

  * `domain` (entities, value objects, domain services, domain events),
  * `application` (use cases / orchestrations),
  * `infrastructure` (JPA mappers/repos, Kafka producers/consumers, web adapters).
* **App shell** (the Boot app) wires modules together via Spring and only depends on each domain’s **API** surface.
* **Communication**: domains talk only by **ports** (interfaces) and **ID-only references**—never import another domain’s entities.
* **Events**:

  * Internal: **in-process domain events** (Spring events or a lightweight internal bus).
  * External: **Transactional Outbox → Kafka** (reliable publication; later, that same Kafka topic becomes your service boundary).

---

# 2) Gradle project layout

```
ecommerce-modmon/
 ├─ settings.gradle
 ├─ build.gradle
 ├─ app/                           // Spring Boot app (only wiring + boot)
 │   └─ build.gradle
 ├─ shared-kernel/                 // only truly generic abstractions (e.g., Money, Email)
 │   └─ build.gradle
 ├─ buyers/
 │   ├─ buyers-api/                // ports, DTOs, domain events contracts
 │   │   └─ build.gradle
 │   └─ buyers-impl/               // application + domain + infra (hidden)
 │       └─ build.gradle
 ├─ sellers/
 │   ├─ sellers-api/
 │   └─ sellers-impl/
 ├─ products/
 │   ├─ products-api/
 │   └─ products-impl/
 └─ cart/
     ├─ cart-api/
     └─ cart-impl/
```

**Key Gradle dependency direction**:

* `app` → `*-api` (only)
* `*-impl` → its own `*-api` + `shared-kernel`
* `*-impl` may depend on other **domain APIs** (never impl).
* No `*-impl` ↔ `*-impl` dependencies.

**Example `app/build.gradle`** (Kotlin DSL omitted; Groovy is fine):

```groovy
dependencies {
  implementation project(':buyers:buyers-api')
  implementation project(':sellers:sellers-api')
  implementation project(':products:products-api')
  implementation project(':cart:cart-api')

  implementation 'org.springframework.boot:spring-boot-starter-web'
  implementation 'org.springframework.boot:spring-boot-starter-actuator'
  implementation 'org.springframework.kafka:spring-kafka'
  runtimeOnly 'org.postgresql:postgresql'
}
```

**Example `products-impl/build.gradle`:**

```groovy
dependencies {
  implementation project(':products:products-api')
  implementation project(':shared-kernel')
  implementation 'org.springframework.boot:spring-boot-starter'
  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
  implementation 'org.springframework.kafka:spring-kafka'
  compileOnly 'org.projectlombok:lombok'
  annotationProcessor 'org.projectlombok:lombok'
  runtimeOnly 'org.postgresql:postgresql'
  testImplementation 'org.springframework.boot:spring-boot-starter-test'
  testImplementation 'com.tngtech.archunit:archunit-junit5:1.3.0'
}
```

---

# 3) Package layout inside a domain (`products-impl`)

```
com.acme.ecommerce.products
 ├─ domain/               // pure domain (no Spring/JPA annotations except @Entity if you keep JPA here; I prefer separate mapper)
 │   ├─ model/
 │   │   ├─ Product.java
 │   │   └─ Sku.java
 │   ├─ service/
 │   │   └─ ProductDomainService.java
 │   └─ event/
 │       └─ ProductCreatedEvent.java
 ├─ application/          // use cases (transactional boundary)
 │   └─ CreateProductHandler.java
 └─ infrastructure/
     ├─ persistence/      // JPA entities + repositories + mappers
     │   ├─ ProductJpaEntity.java
     │   ├─ ProductRepositoryJpa.java
     │   └─ ProductMapper.java
     ├─ messaging/        // Kafka producer/outbox
     │   └─ ProductEventProducer.java
     └─ web/
         └─ ProductController.java
```

**Visibility tips**:

* Keep most classes **package-private**; expose only interfaces in `products-api`.
* Mark Spring components in `*-impl` as internal (no need to export types).
* Do not expose JPA entities outside the impl module.

---

# 4) API (ports) – the only thing other modules see

`products-api`:

```java
package com.acme.ecommerce.products.api;

import lombok.Value;
import java.math.BigDecimal;
import java.util.UUID;

public interface ProductPort {
    ProductId create(CreateProductCmd cmd);

    @Value
    class ProductId { UUID value; }

    @Value
    class CreateProductCmd {
        String name;
        BigDecimal price;
        String currency; // or Money from shared-kernel
        String sellerId; // ID-only reference to Sellers
    }
}
```

---

# 5) Domain (impl) – entity & service

```java
// domain/model/Product.java
package com.acme.ecommerce.products.domain.model;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NonNull;
import lombok.ToString;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Getter
@ToString
public class Product {
    private final UUID id;
    private final String name;
    private final BigDecimal price;
    private final String currency;
    private final String sellerId;

    private Product(UUID id, String name, BigDecimal price, String currency, String sellerId) {
        this.id = Objects.requireNonNull(id);
        this.name = requireNonBlank(name);
        this.price = requirePositive(price);
        this.currency = requireNonBlank(currency);
        this.sellerId = requireNonBlank(sellerId);
    }

    public static Product create(@NonNull String name, @NonNull BigDecimal price, @NonNull String currency, @NonNull String sellerId) {
        return new Product(UUID.randomUUID(), name, price, currency, sellerId);
    }

    private static String requireNonBlank(String s) { if (s == null || s.isBlank()) throw new IllegalArgumentException("blank"); return s; }
    private static BigDecimal requirePositive(BigDecimal v) { if (v == null || v.signum() <= 0) throw new IllegalArgumentException("price"); return v; }
}
```

```java
// domain/event/ProductCreatedEvent.java
package com.acme.ecommerce.products.domain.event;

import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
public class ProductCreatedEvent {
    UUID productId;
    String sellerId;
    String name;
    BigDecimal price;
    String currency;
    String occurredAtIso; // keep events immutable + versioned envelopes in infra
}
```

---

# 6) Application use case (impl)

```java
// application/CreateProductHandler.java
package com.acme.ecommerce.products.application;

import com.acme.ecommerce.products.api.ProductPort;
import com.acme.ecommerce.products.domain.event.ProductCreatedEvent;
import com.acme.ecommerce.products.domain.model.Product;
import com.acme.ecommerce.products.infrastructure.persistence.ProductRepository;
import com.acme.ecommerce.products.infrastructure.messaging.ProductEventProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
class CreateProductHandler implements ProductPort {

    private final ProductRepository repository;
    private final ProductEventProducer eventProducer; // internally may be Outbox

    @Transactional
    @Override
    public ProductId create(CreateProductCmd cmd) {
        Product product = Product.create(cmd.getName(), cmd.getPrice(), cmd.getCurrency(), cmd.getSellerId());
        repository.save(product);

        ProductCreatedEvent event = new ProductCreatedEvent(
                product.getId(), product.getSellerId(), product.getName(), product.getPrice(), product.getCurrency(),
                OffsetDateTime.now().toString()
        );
        eventProducer.publish(event); // enqueue into outbox in the same TX

        return new ProductId(product.getId());
    }
}
```

---

# 7) Persistence adapter (impl)

Prefer **mapping** from domain → JPA entity (avoid leaking JPA into domain).

```java
// infrastructure/persistence/ProductJpaEntity.java
package com.acme.ecommerce.products.infrastructure.persistence;

import lombok.Getter;
import lombok.Setter;
import javax.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "product", schema = "products")
@Getter @Setter
class ProductJpaEntity {
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    private String name;
    private BigDecimal price;
    private String currency;
    @Column(name = "seller_id")
    private String sellerId;
}
```

```java
// infrastructure/persistence/ProductRepository.java
package com.acme.ecommerce.products.infrastructure.persistence;

import com.acme.ecommerce.products.domain.model.Product;

public interface ProductRepository {
    void save(Product product);
}
```

```java
// infrastructure/persistence/ProductRepositoryJpa.java
package com.acme.ecommerce.products.infrastructure.persistence;

import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

interface SpringProductJpaRepo extends JpaRepository<ProductJpaEntity, UUID> { }

@Repository
@RequiredArgsConstructor
class ProductRepositoryJpa implements ProductRepository {

    private final SpringProductJpaRepo jpa;
    private final ProductMapper mapper;

    @Override
    public void save(Product product) {
        jpa.save(mapper.toJpa(product));
    }
}
```

```java
// infrastructure/persistence/ProductMapper.java
package com.acme.ecommerce.products.infrastructure.persistence;

import com.acme.ecommerce.products.domain.model.Product;
import org.springframework.stereotype.Component;

@Component
class ProductMapper {
    ProductJpaEntity toJpa(Product p) {
        var e = new ProductJpaEntity();
        e.setId(p.getId());
        e.setName(p.getName());
        e.setPrice(p.getPrice());
        e.setCurrency(p.getCurrency());
        e.setSellerId(p.getSellerId());
        return e;
    }
}
```

---

# 8) Kafka + Outbox (reliable publication)

**Why**: publish **integration events** *after* DB commit, without dual-write problems.

* Create an `outbox` table per domain schema (`products.outbox`), store events as JSON with headers (`type`, `version`, `aggregateId`, `occurredAt`).
* In the use case, write to the outbox inside the **same @Transactional** boundary.
* A small **outbox publisher** (Spring @Scheduled or Debezium Outbox—POC: simple polling) reads new rows and publishes to Kafka, marking them as sent.

```java
// infrastructure/messaging/ProductEventProducer.java
package com.acme.ecommerce.products.infrastructure.messaging;

import com.acme.ecommerce.products.domain.event.ProductCreatedEvent;

public interface ProductEventProducer {
    void publish(ProductCreatedEvent event); // impl: insert into outbox
}
```

```java
// infrastructure/messaging/OutboxProductEventProducer.java
package com.acme.ecommerce.products.infrastructure.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class OutboxProductEventProducer implements ProductEventProducer {

    private final JdbcTemplate jdbc;

    @Override
    public void publish(ProductCreatedEvent e) {
        // Simplified outbox write (JSON serialization omitted for brevity)
        jdbc.update("""
            INSERT INTO products.outbox(id, aggregate_id, type, version, payload, created_at)
            VALUES (gen_random_uuid(), ?, ?, ?, to_json(?::json), now())
            """,
            e.getProductId(), "ProductCreated", 1, toJson(e)
        );
    }

    private String toJson(Object o) { /* use Jackson ObjectMapper injected */ return "{}"; }
}
```

```java
// infrastructure/messaging/OutboxPublisherJob.java
package com.acme.ecommerce.products.infrastructure.messaging;

import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class OutboxPublisherJob {

    private final KafkaTemplate<String, String> kafka;
    private final OutboxRepository outbox;

    @Scheduled(fixedDelayString = "1000")
    void publish() {
        outbox.fetchBatchToSend(100).forEach(msg -> {
            kafka.send(new ProducerRecord<>("products.v1.product-created", msg.key(), msg.payload()));
            outbox.markAsSent(msg.id());
        });
    }
}
```

**Topic naming**: `{boundedContext}.{version}.{eventName}` → e.g., `products.v1.product-created`.
**Payload**: versioned envelope `{ type, version, data, occurredAt, id }`.
**SerDe**: JSON for POC; later upgrade to Avro/Schema Registry.

---

# 9) HTTP adapter (only in `app` or inside each impl)

Expose endpoints per domain. If you prefer keeping controllers centralized, make a thin `app` controller that **only depends on the API port**.

```java
// app: com.acme.ecommerce.app.web.ProductHttp
@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
class ProductHttp {
    private final ProductPort productPort;

    @PostMapping
    ResponseEntity<?> create(@RequestBody ProductPort.CreateProductCmd cmd) {
        var id = productPort.create(cmd);
        return ResponseEntity.created(URI.create("/products/" + id.getValue())).build();
    }
}
```

---

# 10) Database strategy (PostgreSQL)

* **Schemas per domain**: `buyers`, `sellers`, `products`, `cart`.
* **No cross-schema FK constraints** (optional, but helps loose coupling). Use **ID-only refs** and validate at application level.
* **Migrations**: **Flyway** at app level, but **migration scripts per module** (each module contributes its own `db/migration` path).
* **Transactions**: keep transactions inside one domain’s use case (no multi-domain distributed transactions).

---

# 11) Enforcing boundaries from day 1

1. **Separate API vs Impl modules** (already shown).
2. **Visibility**: package-private classes; expose only ports/DTOs.
3. **Gradle**: ensure `app` depends only on `*-api`.
4. **ArchUnit** tests (powerful!):

```java
// in products-impl test
@AnalyzeClasses(packages = "com.acme.ecommerce.products")
class ArchitectureTest {

  @Test
  void implMustNotDependOnOtherImpls() {
    JavaClasses classes = new ClassFileImporter().importPackages("com.acme.ecommerce");
    noClasses()
      .that().resideInAPackage("..impl..")
      .should().dependOnClassesThat().resideInAnyPackage("..buyers.impl..","..sellers.impl..","..cart.impl..")
      .check(classes);
  }

  @Test
  void domainMustBePure() {
    JavaClasses classes = new ClassFileImporter().importPackages("com.acme.ecommerce.products.domain..");
    noClasses()
      .should().dependOnClassesThat().resideInAnyPackage(
         "org.springframework..", "javax.persistence..", "org.hibernate..")
      .check(classes);
  }
}
```

5. **ID-only references** between domains—never import another domain’s entity or repository.
6. **Events only at boundaries**: cross-domain collaboration should prefer **async events**; for sync calls, depend on **API ports** (interfaces) provided by the other domain and wired by Spring in `app`.
7. **Shared-kernel is tiny**: only primitives truly generic (e.g., `Money`, `Email`, `DomainEvent` base), no domain concepts.

---

# 12) Kafka consumers (when needed)

Example: **Cart** subscribes to `products.v1.product-created` to warm caches or enforce rules.

```java
// cart-impl/infrastructure/messaging/ProductEventsConsumer.java
@KafkaListener(topics = "products.v1.product-created", groupId = "cart")
void onProductCreated(String json) {
    // parse envelope, update read-model/cache if needed
}
```

Keep consumers **in the domain that needs the info**, not in a shared module.

---

# 13) Configuration (application.yaml)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/ecomm
    username: app
    password: app
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.default_schema: public
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      auto-offset-reset: earliest
management:
  endpoints.web.exposure.include: health,info,metrics
```

Each **impl** module can register its own `EntityManagerFactoryBuilder` or simply rely on Boot’s auto configuration and annotate repositories with the right schema/table. You can also set schema via `@Table(schema="products")`.

---

# 14) Twelve-Factor & operational notes

* **Config via env** (`SPRING_DATASOURCE_URL`, Kafka brokers, etc.).
* **Logs** to stdout, JSON if possible.
* **Health checks**: `/actuator/health`, readiness/liveness.
* **Immutability**: image per build; DB migrations applied on boot.
* **Observability**: trace request → command handler → outbox id → Kafka offset. Use correlation IDs.

---

# 15) Testing strategy

* **Unit**: domain services (pure Java), mappers.
* **Component**: use case with in-memory repo or testcontainers for Postgres/Kafka (optional for POC).
* **Contract**: if you already expose events, validate **event envelope** and schemas.
* **ArchUnit**: prevent boundary violations (shown above).

---

# 16) How this helps you split later

Because:

* Each domain is already a **deployable JAR** with an **API surface** distinct from its **impl**.
* Communication is via **ports** and **events** (Kafka topics already exist).
* Data models are **isolated by schema**; no cross-schema FKs to cut.
* Outbox already produces **integration events** you can reroute to external Kafka once you carve out a microservice.

When you split, you:

1. Move `products-impl` into its own service; keep `products-api` as a shared dependency (or publish a client).
2. Replace in-process port wiring with **HTTP/Kafka** adapters.
3. Keep topics unchanged; consumers in other modules already listen to them.

---

## TL;DR – Rules to guarantee boundaries

* **API vs Impl per domain** (Gradle modules).
* **Only ID-based cross-domain references**.
* **Events at boundaries** + **Outbox** (no dual writes).
* **No shared persistence entities**; separate schemas.
* **ArchUnit tests** to fail builds on forbidden dependencies.
* **Package-private** internals; expose only ports/DTOs.
* **Central app** wires only APIs (never impl↔impl).

If you want, I can generate a **starter repository skeleton** with the modules, Gradle files, and a working Products flow (controller → use case → JPA → outbox → Kafka) you can run locally with Docker Compose (Postgres + Kafka).
