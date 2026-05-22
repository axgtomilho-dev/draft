# Diretrizes de Arquitetura — Abordagem Pragmática

> Inspirado nos princípios do Clean Architecture, mas com foco em **simplicidade, produtividade e benefícios reais** — sem a verbosidade e cerimônia desnecessárias.

## Filosofia

O Clean Architecture protege a **lógica de negócio** de dependências externas. Porém, na prática, a implementação canônica (4+ camadas, interfaces para tudo, mappers e DTOs em cada fronteira) gera um código extremamente verboso para proteger contra cenários que raramente acontecem (ex: trocar Postgres por Oracle).

Esta diretriz adota uma abordagem pragmática: **capturar ~80% dos benefícios com ~20% da cerimônia**.

### Premissas

- Troca de banco de dados, framework HTTP ou message broker são eventos raríssimos na vida de um projeto.
- Com ferramentas de IA, refatorações estruturais desse tipo são mais rápidas e seguras do que nunca.
- O valor real da abstração está na **testabilidade** e na **clareza do código**, não na portabilidade teórica.

---

## 1. Independência de Framework — "Isole só o que dói"

### O que significa na prática

Usar o framework (Spring Boot, Quarkus, etc.) diretamente nas camadas de entrada é perfeitamente aceitável. O ponto de atenção é não deixar conceitos do framework vazarem para dentro da lógica de negócio.

### Regra de ouro

**Seus arquivos de regra de negócio (services, domain) não devem importar nada do framework.**

### Aceitável

```java
// O service pode ser gerenciado pelo Spring sem problema
@Service
public class OrderService {
    // @Service é metadata de lifecycle, não altera a lógica
}
```

### Não aceitável

```java
@Service
public class OrderService {
    // ❌ HttpServletRequest é conceito de infraestrutura HTTP
    public Order createOrder(HttpServletRequest request) { ... }

    // ❌ Lançar ResponseStatusException acopla ao Spring Web
    throw new ResponseStatusException(HttpStatus.NOT_FOUND);
}
```

### Como corrigir

```java
@Service
public class OrderService {
    // ✅ Recebe dados puros, lança exceção de domínio
    public Order createOrder(CreateOrderCommand command) {
        if (!isValid(command)) {
            throw new OrderNotFoundException(command.getId());
        }
        // ...
    }
}

// O controller traduz exceções de domínio para HTTP
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handle(OrderNotFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse(ex.getMessage()));
    }
}
```

---

## 2. Testabilidade — "Injeção de dependência + funções puras"

> **Este é o pilar que mais entrega valor real.** Todas as outras diretrizes são secundárias em relação a esta.

### 2.1 Injeção de dependência via construtor

Toda dependência de I/O (banco, fila, API externa) deve ser injetada pelo construtor. Isso permite trocar por mock/fake nos testes.

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final NotificationSender notificationSender;

    // ✅ Dependências injetadas — testável com mocks simples
    public OrderService(OrderRepository orderRepository, NotificationSender notificationSender) {
        this.orderRepository = orderRepository;
        this.notificationSender = notificationSender;
    }

    public Order place(CreateOrderCommand command) {
        var order = Order.create(command);
        orderRepository.save(order);
        notificationSender.send(order.getUserId(), "Pedido criado");
        return order;
    }
}
```

### 2.2 Interfaces — use com parcimônia

**Não crie interface para tudo.** A regra é:

| Cenário | Interface? | Por quê |
|---------|-----------|---------|
| Repository (acesso a dados) | **Sim** | Permite mock nos testes e centraliza queries |
| Service chamado por controller | **Não** | O controller já depende da implementação concreta |
| Clients de APIs externas | **Sim** | Permite mock e facilita testes de integração |
| Classes utilitárias / helpers | **Não** | São funções puras, testáveis diretamente |

### 2.3 Extraia lógica pura em métodos estáticos ou no próprio domínio

Lógica que não depende de I/O deve ser isolada em métodos puros. Eles são triviais de testar — zero mock, zero setup.

```java
// ✅ Testável com um simples assertEquals
public class PricingRules {

    public static BigDecimal calculateDiscount(BigDecimal total, CustomerTier tier) {
        if (tier == CustomerTier.PREMIUM && total.compareTo(new BigDecimal("500")) > 0) {
            return total.multiply(new BigDecimal("0.15"));
        }
        if (total.compareTo(new BigDecimal("1000")) > 0) {
            return total.multiply(new BigDecimal("0.10"));
        }
        return BigDecimal.ZERO;
    }
}

// Ou diretamente na entidade de domínio
public class Order {

    public BigDecimal totalWithDiscount() {
        var discount = PricingRules.calculateDiscount(this.total, this.customerTier);
        return this.total.subtract(discount);
    }
}
```

---

## 3. Independência de UI — "Services devolvem dados, controllers formatam"

### Regra simples

O service retorna objetos de domínio ou DTOs genéricos. O controller decide o formato de resposta (JSON, headers HTTP, status code).

```java
// ✅ Service agnóstico de protocolo
@Service
public class OrderService {

    public OrderSummary getOrderSummary(String orderId) {
        // Retorna dados puros — sem ResponseEntity, sem HttpStatus
        var order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
        return OrderSummary.from(order);
    }
}

// Controller cuida da "forma" da resposta
@RestController
public class OrderController {

    @GetMapping("/orders/{id}/summary")
    public ResponseEntity<OrderSummaryResponse> getSummary(@PathVariable String id) {
        var summary = orderService.getOrderSummary(id);
        return ResponseEntity.ok(OrderSummaryResponse.from(summary));
    }
}
```

### Por que isso importa na prática

O mesmo `OrderService.getOrderSummary()` pode ser chamado por um controller REST, um consumer Kafka, um job agendado ou um teste — sem nenhuma alteração.

---

## 4. Independência de Banco — "Repository fino, sem mapper cerimonial"

### O que adotar

O **Repository Pattern leve**: uma classe por aggregate root que centraliza todas as queries. O valor real não é trocar de banco, mas sim:

- **Testes**: trocar por uma implementação in-memory ou mock
- **Manutenção**: saber onde estão todas as queries de uma entidade
- **Refatoração**: mudar uma query sem varrer o projeto inteiro

### Exemplo prático

```java
// Interface — simples e direta
public interface OrderRepository {
    Order save(Order order);
    Optional<Order> findById(String id);
    List<Order> findByUserIdAndStatus(String userId, OrderStatus status);
}

// Implementação com Spring Data JPA — sem mapper extra
@Repository
public class JpaOrderRepository implements OrderRepository {

    private final SpringDataOrderRepository springRepo;

    // ... delegações diretas
}
```

### O que NÃO fazer

Não crie camadas de mapeamento entity → model → domain → DTO para cada operação. Se a entidade JPA pode ser usada como objeto de domínio (o que é o caso em 90% dos projetos), use diretamente.

```java
// ❌ Cerimônia desnecessária na maioria dos casos
OrderJpaEntity -> OrderDomainModel -> OrderDTO -> OrderResponse

// ✅ Pragmático
@Entity Order -> OrderResponse (no controller)
```

Se um dia a entidade JPA e o objeto de domínio precisarem divergir (campos de auditoria, joins complexos, etc.), separe **naquele momento** — não antecipadamente.

---

## 5. Organização de Código — "Módulos por feature, não por camada"

### Estrutura recomendada

```
src/main/java/com/empresa/app/
├── order/
│   ├── Order.java                  ← entidade de domínio / JPA
│   ├── OrderStatus.java            ← enum de domínio
│   ├── OrderRepository.java        ← interface do repository
│   ├── JpaOrderRepository.java     ← implementação
│   ├── OrderService.java           ← lógica de negócio
│   ├── OrderController.java        ← entrada HTTP
│   ├── OrderResponse.java          ← DTO de saída
│   ├── CreateOrderCommand.java     ← DTO de entrada
│   └── PricingRules.java           ← funções puras de cálculo
├── user/
│   ├── User.java
│   ├── UserRepository.java
│   └── ...
├── shared/
│   ├── exception/                  ← exceções base
│   ├── config/                     ← configurações globais
│   └── util/                       ← helpers genéricos
└── Application.java
```

### Regra de dependência simplificada

Em vez de 4 camadas formais, aplique esta regra por módulo:

- `Service` **não importa** do `Controller`
- `Repository` (interface) **não importa** de ninguém do módulo
- Funções puras e tipos de domínio **não importam** de infraestrutura
- `shared/` **não importa** de nenhum módulo de feature

### Enforcement com ArchUnit

```java
@AnalyzeClasses(packages = "com.empresa.app")
public class ArchitectureTest {

    @ArchTest
    static final ArchRule services_nao_dependem_de_controllers =
        noClasses().that().resideInAPackage("..service..")
            .should().dependOnClassesThat().resideInAPackage("..controller..");

    @ArchTest
    static final ArchRule domain_nao_depende_de_spring_web =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAPackage("org.springframework.web..");
}
```

---

## Resumo das Regras

| # | Diretriz | Teste rápido |
|---|----------|-------------|
| 1 | Services não importam classes do framework web | Grep por `import javax.servlet` ou `import org.springframework.web` nos services |
| 2 | Dependências de I/O são injetadas via construtor | Todo `new` de repository/client dentro de service é violação |
| 3 | Services retornam dados, não ResponseEntity | Grep por `ResponseEntity` fora de controllers |
| 4 | Queries centralizadas em repositories | Grep por `EntityManager` ou `JdbcTemplate` fora de repository |
| 5 | Módulos organizados por feature | Nenhum pacote `controllers/`, `services/`, `repositories/` no top-level |

---

## Quando quebrar estas regras

Estas diretrizes são **padrões**, não dogmas. Situações legítimas para desviar:

- **POCs e protótipos**: velocidade importa mais que estrutura.
- **CRUDs simples**: se o service só delega para o repository, considere o controller chamar o repository diretamente.
- **Scripts e jobs pontuais**: não precisam da mesma estrutura de um módulo de domínio.

O critério é: **a abstração está me ajudando a testar ou entender o código, ou só está adicionando arquivos?**
