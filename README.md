# Správa rezervací

REST API pro správu rezervací místností. Semestrální projekt kombinující TDD (BTDD/KTDD) a DevOps.

## Obsah

- [Doména a funkce](#doména-a-funkce)
- [Architektura](#architektura)
- [Spuštění lokálně](#spuštění-lokálně)
- [Testování](#testování)
- [CI/CD pipeline](#cicd-pipeline)
- [Kontejnerizace](#kontejnerizace)
- [Kubernetes nasazení](#kubernetes-nasazení)
- [Prostředí](#prostředí)
- [Bezpečnost a secrets](#bezpečnost-a-secrets)
- [Testovací strategie](#testovací-strategie)

---

## Doména a funkce

Aplikace umožňuje správu rezervací místností s těmito entitami:

- **User** — uživatel s rolí `USER` nebo `ADMIN`
- **Room** — místnost s kapacitou a hodinovou cenou
- **Reservation** — rezervace místnosti pro uživatele v daném čase

### Business pravidla

| # | Pravidlo | Popis |
|---|----------|-------|
| 1 | Kolize časů | Nelze vytvořit rezervaci překrývající se s jinou |
| 2 | Stavový přechod | Zrušení rezervace nelze po jejím skončení |
| 3 | Omezení rolí | Místnost může vytvořit pouze `ADMIN` |
| 4 | Výpočet ceny | Cena = zaokrouhlené hodiny × cena za hodinu |
| 5 | Idempotence | Již zrušenou rezervaci nelze znovu zrušit |

### REST API endpointy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/users` | Vytvoření uživatele |
| POST | `/rooms` | Vytvoření místnosti (vyžaduje header `x-user-role: ADMIN`) |
| POST | `/reservations` | Vytvoření rezervace |
| DELETE | `/reservations/:id` | Zrušení rezervace |

---

## Architektura

```
┌─────────────────────────────────────────────┐
│                  Klient                      │
│            (HTTP požadavky)                  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│              Controller vrstva               │
│   UsersController  RoomsController           │
│   ReservationsController                     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│               Service vrstva                 │
│   UsersService  RoomsService                 │
│   ReservationsService  ← business logika     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│             Repository vrstva                │
│              TypeORM + PostgreSQL            │
└─────────────────────────────────────────────┘
```

### Technologický stack

| Vrstva | Technologie |
|--------|------------|
| Backend | NestJS (TypeScript) |
| Databáze | PostgreSQL 16 + TypeORM |
| Testy | Jest + Supertest |
| Coverage | Istanbul (Jest) |
| CI/CD | GitHub Actions |
| Kontejnery | Docker + docker-compose |
| Orchestrace | Kubernetes (minikube) |
| Registry | GitHub Container Registry (ghcr.io) |

---

## Spuštění lokálně

### Předpoklady
- Node.js 20+
- Docker Desktop

### Možnost 1: Docker Compose (doporučeno)

```bash
git clone https://github.com/stepankobrle/tdd_devops_sprava_rezervaci
cd tdd_devops_sprava_rezervaci
docker-compose up --build
```

Aplikace bude dostupná na `http://localhost:3000`.

### Možnost 2: Lokálně bez Dockeru

```bash
# 1. Spusť databázi
docker-compose up db

# 2. Vytvoř .env soubor
cp .env.example .env  # nebo ručně dle sekce níže

# 3. Instalace závislostí
npm install

# 4. Spuštění v dev módu
npm run start:dev
```

### Proměnné prostředí (.env)

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rezervace
```

---

## Testování

```bash
# Unit testy
npm run test

# Unit testy + coverage report
npm run test:cov

# Integrační testy (vyžaduje běžící PostgreSQL)
npm run test:e2e
```

### Coverage výsledky

Coverage report se generuje do složky `coverage/` a je dostupný jako artefakt v CI pipeline.

Nastavené thresholdy:
- Lines: ≥ 70 %
- Branches: ≥ 50 %

---

## CI/CD pipeline

Pipeline se spouští automaticky při každém `git push`.

```
git push
    ↓
Job 1: Build & Test
    - npm run build
    - npm run lint (ESLint)
    - npm run test:cov (unit testy + coverage)
    - npm run test:e2e (integrační testy s PostgreSQL)
    - upload coverage artefaktu
    ↓
Job 2: Docker Build & Push  [pouze větve main / feature/testy]
    - sestavení Docker image
    - publikace na ghcr.io
    ↓
Job 3: Deploy - Staging  [pouze větve main / feature/testy]
    - kubectl apply k8s manifesty
    - nasazení do namespace staging
```

Konfigurace: [.github/workflows/ci.yml](.github/workflows/ci.yml)

---

## Kontejnerizace

### Dockerfile

Multi-stage build pro minimální velikost produkčního image:

- **Fáze builder** — instaluje všechny závislosti, kompiluje TypeScript
- **Fáze production** — pouze produkční závislosti + zkompilovaný kód
- Non-root uživatel (`node`)
- Healthcheck každých 30 sekund

```bash
# Sestavení image
docker build -t rezervace-app:latest .

# Spuštění kontejneru
docker run -p 3000:3000 rezervace-app:latest
```

### Docker Compose

Spustí aplikaci + PostgreSQL databázi:

```bash
docker-compose up --build   # první spuštění
docker-compose up           # další spuštění (bez rebuild)
docker-compose down         # zastavení
docker-compose down -v      # zastavení + smazání dat
```

---

## Kubernetes nasazení

### Předpoklady

```bash
# Instalace minikube a kubectl
winget install Kubernetes.minikube
winget install Kubernetes.kubectl

# Spuštění clusteru
minikube start
```

### Struktura k8s/

```
k8s/
├── namespace-staging.yaml      # namespace staging
├── namespace-production.yaml   # namespace production
├── secret.yaml                 # DB hesla (base64)
├── configmap.yaml              # konfigurace (DB host, port)
├── service.yaml                # ClusterIP service
├── ingress.yaml                # HTTP přístup zvenčí
├── staging/
│   └── deployment.yaml         # 1 replika, menší limity
└── production/
    └── deployment.yaml         # 2 repliky, větší limity
```

### Nasazení do staging

```bash
# Sestavení image uvnitř minikube
minikube docker-env | Invoke-Expression  # Windows PowerShell
docker build -t rezervace-app:latest .

# Vytvoření namespace
kubectl apply -f k8s/namespace-staging.yaml

# Nasazení zdrojů
kubectl apply -f k8s/secret.yaml -n staging
kubectl apply -f k8s/configmap.yaml -n staging
kubectl apply -f k8s/service.yaml -n staging
kubectl apply -f k8s/staging/deployment.yaml

# Ověření
kubectl get pods -n staging
```

### Přístup k aplikaci (port-forward)

```bash
kubectl port-forward service/rezervace-service 3000:80 -n staging
# Aplikace dostupná na http://localhost:3000
```

---

## Prostředí

| | Staging | Production |
|-|---------|-----------|
| Namespace | `staging` | `production` |
| Repliky | 1 | 2 |
| RAM limit | 256 Mi | 512 Mi |
| CPU limit | 500 m | 1000 m |
| Účel | testování nových verzí | reálný provoz |
| Nasazení | automatické (CD pipeline) | ruční / přes main větev |

### Rozdíly konfigurace

- **Staging** — nižší resource limits, 1 replika, nasazuje se automaticky při každém push
- **Production** — vyšší resource limits, 2 repliky pro dostupnost při výpadku jedné instance

---

## Bezpečnost a secrets

### Co není v repozitáři
- Plaintext hesla — `.env` je v `.gitignore`
- Produkční credentials

### Jak jsou secrets spravovány

**Lokální vývoj:** proměnné prostředí přes `.env` soubor (v `.gitignore`)

**Kubernetes:** `k8s/secret.yaml` obsahuje hodnoty zakódované pomocí base64 (ne zašifrované — v produkci by se secret vytvářel přímo v clusteru příkazem):
```bash
kubectl create secret generic rezervace-secret \
  --from-literal=DB_PASSWORD=heslo \
  -n staging
```

**CI/CD pipeline:** secret `KUBECONFIG` uložen v GitHub Actions Secrets (Settings → Secrets → Actions)

---

## Testovací strategie

### Unit testy (`src/**/*.spec.ts`)

Testují business logiku izolovaně — závislosti jsou mockované.

| Soubor | Co testuje |
|--------|-----------|
| `reservations.service.spec.ts` | Kolize časů, stavové přechody, výpočet ceny, idempotence |
| `rooms.service.spec.ts` | Omezení rolí (ADMIN vs USER) |
| `users.service.spec.ts` | Vytvoření uživatele |

**Mocking:**
- `TypeORM Repository` — nahrazen mock objektem (`jest.fn()`)
- `Date.now()` — mockován přes `jest.spyOn` pro testování časových pravidel

### Integrační testy (`test/**/*.e2e-spec.ts`)

Testují celý stack Controller → Service → databáze s reálnou PostgreSQL.

| Soubor | Co testuje |
|--------|-----------|
| `reservations.e2e-spec.ts` | Kompletní flow rezervace přes HTTP |
| `app.e2e-spec.ts` | Základní dostupnost API |

### Proč takto

- **Unit testy** jsou rychlé a testují hraniční stavy business logiky
- **Integrační testy** ověří že celý stack funguje dohromady (SQL dotazy, validace, HTTP kódy)
- **Mocking Date.now()** umožňuje deterministicky testovat časově závislá pravidla
