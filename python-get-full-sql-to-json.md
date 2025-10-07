Script python que retorna um objeto json a partir de diversas queries sql, deixando bem claro e legivel as condicionais (wheres e joins) 


Perfeito! Abaixo vai um **script Python enxuto e didático** que:

* Conecta ao **Sybase ASE** via `pyodbc`
* Monta SQL **com JOINs opcionais** (customer, coverages)
* Constrói o **WHERE** de forma legível e **parametrizada** (evita SQL injection)
* Agrega linhas (1:N) em **JSON aninhado**: `contract` → `customer` (objeto) → `coverages` (array)

Você pode adaptar os campos/filtros conforme seu esquema.

---

# Script completo (pronto para copiar/colar)

```python
"""
Requisitos:
  pip install pyodbc python-dotenv
  (Opcional) configure um DSN ODBC para o Sybase ou use o DRIVER+SERVER+PORT.

Este script:
- Conecta ao Sybase
- Permite ligar/desligar JOINs (customer, coverages)
- Monta WHERE dinamicamente e com parâmetros
- Retorna JSON aninhado por contrato
"""

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import pyodbc  # DRIVER ODBC (ex.: "ODBC Driver 17 for SQL Server" com FreeTDS, ou "Adaptive Server Enterprise")


# ---------- Config de conexão ----------
def get_connection():
    """
    Ajuste para seu ambiente. Três jeitos comuns:

    1) Via DSN:
       conn_str = "DSN=MeuDSN;UID=usuario;PWD=senha"

    2) Via DRIVER+SERVER+PORT (FreeTDS ou driver ASE):
       conn_str = (
           "DRIVER={Adaptive Server Enterprise};"
           "SERVER=meu-host;"
           "PORT=5000;"
           "UID=usuario;"
           "PWD=senha;"
           "DATABASE=meu_db;"
        )

    3) FreeTDS simulando SQL Server (funciona bem com ASE):
       conn_str = (
           "DRIVER={ODBC Driver 17 for SQL Server};"
           "SERVER=meu-host,5000;"
           "UID=usuario;"
           "PWD=senha;"
           "DATABASE=meu_db;"
       )

    Importante: garanta que o driver ODBC esteja instalado no SO e configurado.
    """
    conn_str = os.getenv("SYBASE_CONN_STR", "DSN=MeuDSN;UID=usuario;PWD=senha")
    return pyodbc.connect(conn_str)
# --------------------------------------


# ---------- Filtros e opções ----------
@dataclass
class ContractFilters:
    contract_id: Optional[int] = None
    customer_name_like: Optional[str] = None  # usa LIKE '%...%'
    min_premium: Optional[float] = None
    max_premium: Optional[float] = None
    start_date: Optional[str] = None  # 'YYYY-MM-DD'
    end_date: Optional[str] = None    # 'YYYY-MM-DD'


@dataclass
class QueryOptions:
    include_customer: bool = True
    include_coverages: bool = True
    limit: Optional[int] = 100
# --------------------------------------


# ---------- Builder da query ----------
def build_query(filters: ContractFilters, opts: QueryOptions) -> Tuple[str, List[Any]]:
    """
    Monta SELECT + JOINs + WHERE + ORDER/LIMIT com parâmetros.
    Retorna (sql, params)
    """
    # Tabelas base: ajuste os nomes conforme seu esquema
    base_alias = "c"
    sql_select = [
        f"{base_alias}.contract_id",
        f"{base_alias}.contract_name",
        f"{base_alias}.premium",
        f"{base_alias}.created_at",
    ]
    joins = []
    where = []
    params: List[Any] = []

    if opts.include_customer:
        sql_select += [
            "cust.id AS customer_id",
            "cust.name AS customer_name",
            "cust.email AS customer_email",
        ]
        joins.append("LEFT JOIN customers cust ON cust.id = c.customer_id")

    if opts.include_coverages:
        # Vamos juntar coverages; depois agregamos em Python
        sql_select += [
            "cv.id AS coverage_id",
            "cv.type AS coverage_type",
            "cv.amount AS coverage_amount",
        ]
        joins.append("LEFT JOIN coverages cv ON cv.contract_id = c.contract_id")

    # WHEREs (claros e parametrizados)
    if filters.contract_id is not None:
        where.append("c.contract_id = ?")
        params.append(filters.contract_id)

    if filters.customer_name_like:
        where.append("cust.name LIKE ?")
        params.append(f"%{filters.customer_name_like}%")

    if filters.min_premium is not None:
        where.append("c.premium >= ?")
        params.append(filters.min_premium)

    if filters.max_premium is not None:
        where.append("c.premium <= ?")
        params.append(filters.max_premium)

    if filters.start_date is not None:
        where.append("c.created_at >= ?")
        params.append(filters.start_date)

    if filters.end_date is not None:
        where.append("c.created_at < DATEADD(day, 1, ?)")
        params.append(filters.end_date)

    sql = []
    sql.append("SELECT " + ", ".join(sql_select))
    sql.append("FROM contracts c")
    if joins:
        sql.extend(joins)
    if where:
        sql.append("WHERE " + " AND ".join(where))
    sql.append("ORDER BY c.contract_id")

    # LIMIT (Sybase ASE: costuma usar TOP no SELECT; mas é simples adaptar)
    # Exemplo com TOP:
    if opts.limit is not None:
        sql[0] = "SELECT TOP {} ".format(int(opts.limit)) + ", ".join(sql_select)

    return "\n".join(sql), params
# --------------------------------------


# ---------- Execução e montagem do JSON ----------
def fetch_contracts_as_json(filters: ContractFilters, opts: QueryOptions) -> List[Dict[str, Any]]:
    sql, params = build_query(filters, opts)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)

        # Agregador por contrato (1:N coverages)
        by_contract: Dict[int, Dict[str, Any]] = {}

        # Índices: cuidado com nulos em LEFT JOIN
        for row in cur.fetchall():
            # A ordem/nomes das colunas seguem de sql_select na build_query
            # Leia por índice ou por atributos (dependendo do driver)
            contract_id = row.contract_id

            if contract_id not in by_contract:
                contract_obj: Dict[str, Any] = {
                    "id": contract_id,
                    "name": row.contract_name,
                    "premium": float(row.premium) if row.premium is not None else None,
                    "created_at": str(row.created_at) if row.created_at is not None else None,
                }

                if opts.include_customer:
                    contract_obj["customer"] = {
                        "id": getattr(row, "customer_id", None),
                        "name": getattr(row, "customer_name", None),
                        "email": getattr(row, "customer_email", None),
                    }

                if opts.include_coverages:
                    contract_obj["coverages"] = []

                by_contract[contract_id] = contract_obj

            # Agregar coverages quando houver JOIN
            if opts.include_coverages and getattr(row, "coverage_id", None) is not None:
                by_contract[contract_id]["coverages"].append(
                    {
                        "id": row.coverage_id,
                        "type": row.coverage_type,
                        "amount": float(row.coverage_amount) if row.coverage_amount is not None else None,
                    }
                )

        return list(by_contract.values())


def main():
    # --- Exemplo de uso: troque filtros conforme sua necessidade ---
    filters = ContractFilters(
        contract_id=None,
        customer_name_like="Silva",
        min_premium=500.0,
        max_premium=5000.0,
        start_date="2024-01-01",
        end_date="2025-12-31",
    )
    opts = QueryOptions(include_customer=True, include_coverages=True, limit=200)

    data = fetch_contracts_as_json(filters, opts)
    print(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
```

---

## Como este script te ajuda a “enxergar” WHEREs e JOINs

* **JOINs legíveis e opcionais**
  Você controla com `QueryOptions`:

  ```python
  opts = QueryOptions(include_customer=True, include_coverages=False)
  ```

  Isso liga/desliga blocos de `JOIN` e colunas do `SELECT`.

* **WHERE parametrizado e explícito**
  Os filtros estão no `ContractFilters`. O builder converte em:

  ```sql
  WHERE c.premium >= ? AND c.created_at >= ? ...
  ```

  …com a lista `params = [500.0, '2024-01-01', ...]`.
  Fica **óbvio** (e seguro) quais condições estão ativas.

* **JSON aninhado claro**
  O SQL traz linhas “achatadas”. Em Python, o dicionário `by_contract` agrupa por `contract_id` e monta:

  ```json
  {
    "id": 123,
    "name": "...",
    "customer": {...},
    "coverages": [...]
  }
  ```

---

## Dicas rápidas

* **Performance**: se o volume for alto, prefira:

  * Paginar (`OFFSET/FETCH` se disponível, ou paginação por `contract_id`).
  * Buscar `contracts` e `coverages` em **duas queries** e montar no Python (menos duplicação de linhas por JOIN).
* **Nomes/Tipos**: ajuste nomes de tabelas/colunas (`contracts`, `customers`, `coverages`) para seu schema real.
* **Drivers ODBC**: no Linux/macOS, geralmente usa-se **FreeTDS**; no Windows, instale o driver ODBC do ASE (ou use FreeTDS com “SQL Server driver” apontando para a porta do ASE).

Se quiser, me diga os **nomes exatos das suas tabelas/colunas** e eu já te devolvo o script adaptado 1:1 pro seu cenário.
