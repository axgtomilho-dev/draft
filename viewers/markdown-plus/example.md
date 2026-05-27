# EXAMPLE.md

## Project 

Java, Spring, Gradle (Kotlin DSL). **REST API** with PostgreSQL (JPA/Hibernate) and Kafka, ~~bla~~.

```
src/main/kotlin/com/empresa/app/
├── order/
│   ├── Order.kt                    # JPA entity = domain object
│   ├── OrderStatus.kt              # domain enum
├── shared/
│   ├── exception/
└── Application.kt
```

---

```mermaid
pie title NETFLIX
         "Time spent looking for movie" : 90
         "Time spent watching it" : 10
```

---

```mermaid
gitGraph:
    commit "Ashish"
    branch newbranch
    checkout newbranch
    commit id:"1111"
    commit tag:"test"
    checkout main
    commit type: HIGHLIGHT
    commit
    merge newbranch
    commit
    branch b2
    commit
```

---

<img width="150" height="150" src="https://picsum.photos/100/100">

---


---

<div align="center">

[![CI](https://github.com/fastify/fastify/workflows/ci/badge.svg)](https://github.com/fastify/fastify/actions/workflows/ci.yml)
[![Package Manager CI](https://github.com/fastify/fastify/workflows/package-manager-ci/badge.svg)](https://github.com/fastify/fastify/actions/workflows/package-manager-ci.yml)
[![Web SIte](https://github.com/fastify/fastify/workflows/website/badge.svg)](https://github.com/fastify/fastify/actions/workflows/website.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/fastify/fastify/badge.svg)](https://snyk.io/test/github/fastify/fastify)
[![Coverage Status](https://coveralls.io/repos/github/fastify/fastify/badge.svg?branch=main)](https://coveralls.io/github/fastify/fastify?branch=main)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

</div>

---

## Table of Contents
<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText="Click to expand") -->
<details>
<summary>"Click to expand"</summary>

- [Why markdown?](#why-markdown)
- [Markdown basics](#markdown-basics)
- [Advanced Formatting tips](#advanced-formatting-tips)
  - [`left` alignment](#left-alignment)
  - [`right` alignment](#right-alignment)
  - [`center` alignment example](#center-alignment-example)
  - [`collapse` Sections](#collapse-sections)
  - [`additional links`](#additional-links)
  - [Badges](#badges)
- [Useful packages](#useful-packages)
- [Useful utilities](#useful-utilities)
- [How Serverless uses markdown](#how-serverless-uses-markdown)
  - [DEMO](#demo)
- [Other Markdown Resources](#other-markdown-resources)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

--- 


> [!NOTE]  
> Highlights information that users should take into account, even when skimming.

> [!TIP]
> Optional information to help a user be more successful.

> [!IMPORTANT]  
> Crucial information necessary for users to succeed.

--- 

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

---


```mermaid
mindmap
  root((AWS))

    Cloud_Concepts
      Regiões
      Availability_Zones
      Edge_Locations
      Local_Zones
      Shared_Responsibility_Model
      Well_Architected_Framework
      Well_Architected_Tool

    Segurança_e_Identidade
      IAM
        Users
        Roles
        Policies
        Identity_Center
      Cognito
      Directory_Service
      KMS
      Secrets_Manager
      Macie
      Shield
      WAF
      GuardDuty
      Inspector
      Security_Hub
      CloudHSM
      ACM
      Artifact
      CloudTrail
      Config
      VPC_Flow_Logs

    Computação
      EC2
        On_Demand
        Spot
        Reserved
        Dedicated
        Savings_Plans
      Lambda
      Elastic_Beanstalk
      App_Runner
      Fargate
      Auto_Scaling
      Batch
      Outposts

    Containers
      ECS
      EKS
      ECR

    Rede
      VPC
        Public_Subnet
        Private_Subnet
        Route_Tables
        Security_Groups
        ACLs
        NAT_Gateway
        Internet_Gateway
      Direct_Connect
      Transit_Gateway
      VPN
      Global_Accelerator
      API_Gateway

      Load_Balancers
        ELB
        ALB
        NLB
        Gateway_Load_Balancer

      DNS_CDN
        Route53
        CloudFront

    Armazenamento
      S3
        Intelligent_Tiering
        Select
        Glacier
        Glacier_Deep_Archive
      EBS
      EFS
      FSx
      Storage_Gateway
      DataSync

    Banco_de_Dados
      RDS
      Aurora
      DynamoDB
      DocumentDB
      Neptune
      ElastiCache
      Redshift

    Analytics
      Athena
      Glue
      EMR
      Kinesis
      OpenSearch
      Lake_Formation
      QuickSight

    Integração
      SQS
      SNS
      SES
      EventBridge
      Step_Functions
      MQ

    DevOps
      CloudFormation
      CDK
      CodeCommit
      CodeBuild
      CodeDeploy
      CodePipeline
      CodeStar
      Systems_Manager
      CloudShell
      Amplify
      CloudWatch
      XRay

    Migração
      Application_Migration_Service
      SMS
      DMS
      DataSync

    Machine_Learning
      SageMaker
      Rekognition
      Textract
      Transcribe
      Comprehend
      Forecast
      Personalize
      Polly
      Lex

    Governança
      Organizations
      SCPs
      Control_Tower
      RAM

    Custos
      Cost_Explorer
      Budgets
      Pricing_Calculator
      Compute_Optimizer
      Trusted_Advisor
      Health_Dashboard
      Support_Plans
```

---



---

