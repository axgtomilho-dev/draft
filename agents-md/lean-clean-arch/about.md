O Clean Architecture "by the book" gera uma cerimônia enorme para cenários que raramente se materializam. Aqui vai um approach mais pragmático, pilar por pilar:

---

**1. Independência de frameworks → "Isole só o que dói"**

O objetivo real não é abstrair tudo, mas evitar que o framework dite a estrutura do seu domínio. Na prática:

Use o framework diretamente nos controllers, rotas, middlewares — isso é o papel dele. O ponto de atenção é não deixar decorators, anotações ou classes do framework vazarem para dentro da lógica de negócio. Um service no NestJS, por exemplo, pode ter o `@Injectable()` sem problema — o que não pode é ele importar `Request` do Express ou `FilterQuery` do Mongoose.

A técnica mais simples é: **seus arquivos de regra de negócio não devem importar nada do framework**. Só isso já resolve 80% do problema sem criar camadas extras.

---

**2. Testabilidade → "Dependency Injection simples + funções puras"**

Esse é o pilar que mais entrega valor real. Duas técnicas resolvem quase tudo:

**Injeção de dependência via construtor** — em vez do service instanciar o repository internamente, ele recebe pelo construtor. Isso permite trocar por mock nos testes sem precisar de interfaces formais. No TypeScript, um `type` ou o próprio tipo da classe já basta — não precisa de `IUserRepository`, `IUserRepositoryImpl`, etc.

```typescript
// Simples e testável, sem interface separada
class OrderService {
  constructor(private repo: OrderRepository, private mailer: Mailer) {}
  
  async place(order: Order) {
    // lógica pura de negócio
    await this.repo.save(order);
    await this.mailer.notify(order.userId);
  }
}
```

**Extrair lógica pura em funções** — a validação, cálculo, transformação de dados não precisa estar em classes. Uma função pura que recebe input e retorna output é a coisa mais fácil de testar que existe. Zero mock, zero setup.

```typescript
// Testável com um simples assertEquals, sem mock nenhum
function calculateDiscount(total: number, tier: CustomerTier): number {
  if (tier === 'premium' && total > 500) return total * 0.15;
  if (total > 1000) return total * 0.10;
  return 0;
}
```

---

**3. Independência de UI → "Separe orquestração de apresentação"**

Não precisa da camada formal de Use Cases. A técnica mais prática é ter **services que retornam dados crus** e deixar o controller/resolver decidir o formato de resposta.

Se o service retorna `{ user, orders }` em vez de um DTO formatado para REST, o mesmo service funciona pra REST, GraphQL, CLI ou worker Kafka. Sem camada extra — só disciplina de não fazer `res.json()` dentro do service.

---

**4. Independência de banco → "Abrace seu banco, mas atrás de um repository fino"**

Aqui está o ponto que você levantou bem. Na prática, a técnica que faz sentido é o **Repository Pattern leve** — não para trocar Postgres por Oracle, mas para:

- Trocar por mock/in-memory nos testes
- Centralizar queries em um lugar só (em vez de query espalhada nos services)
- Facilitar refatorações pontuais (ex: trocar uma query raw por um aggregation pipeline)

```typescript
// Repository fino — sem interface separada, sem DTO de mapeamento
class OrderRepository {
  constructor(private db: Collection<OrderDoc>) {}

  async findByUser(userId: string): Promise<Order[]> {
    return this.db.find({ userId }).toArray();
  }
}
```

O segredo é: **o repository pode devolver as entidades do domínio diretamente**. Não precisa de mapper entity→model→domain→dto. Se um dia precisar migrar (e a IA vai ajudar muito nisso), você refatora os repositories — que estão centralizados — e o resto do sistema não muda.

---

**5. Dependency Rule → "Estrutura de pastas com senso prático"**

Em vez das 4+ camadas do Clean Arch, uma estrutura de 2-3 níveis resolve:

```
src/
  modules/
    orders/
      order.service.ts      ← lógica de negócio
      order.repository.ts   ← acesso a dados
      order.controller.ts   ← entrada HTTP
      order.types.ts        ← tipos/interfaces do módulo
      order.helpers.ts      ← funções puras de cálculo/validação
    users/
      ...
  shared/
    utils/                  ← helpers genéricos
    types/                  ← tipos compartilhados
```

A "regra de dependência simplificada" vira: **o service não importa do controller, e helpers/types não importam de ninguém**. Pode ser reforçada com ESLint (`no-restricted-imports` ou `boundaries/element-types`) em vez de camadas formais.

---

**Resumindo a filosofia pragmática:**

O que o Clean Arch quer proteger de verdade é a **lógica de negócio**. Em vez de 4 camadas com interfaces, mappers e DTOs, aplique 3 regras simples: extraia cálculos e validações em funções puras, injete dependências de I/O pelo construtor, e não importe coisas de infraestrutura dentro dos services. Isso captura uns 80% do benefício com 20% da cerimônia.
