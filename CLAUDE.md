# Kinetica — CRM for Gyms & PT Studios

헬스장/PT샵 사장·트레이너를 위한 비즈니스 운영 플랫폼.

## 실행 명령어

### 백엔드 (WSL에서 실행)
```bash
cd /mnt/c/Users/Security/Desktop/WorkSpace/kinetica/backend
source venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs (Swagger UI)
```

**처음 세팅할 때만:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # .env 편집 후 DB URL, SECRET_KEY 입력
```

### 프론트엔드 (Windows PowerShell/CMD)
```bash
cd C:\Users\Security\Desktop\WorkSpace\kinetica\frontend
npm run dev
# → http://localhost:3000
```

### PostgreSQL
- Windows에 설치됨 (pgAdmin으로 관리)
- DB명: `kinetica` (pgAdmin에서 생성)
- WSL → Windows PostgreSQL 연결 시 `localhost` 대신 Windows 호스트 IP 사용

---

## 환경 변수

### backend/.env
```
DATABASE_URL=postgresql+asyncpg://postgres:<비밀번호>@172.24.64.1:5432/kinetica
SECRET_KEY=<랜덤 문자열>
```

> WSL2 IP(`172.24.64.1`)는 Windows 재부팅 시 바뀔 수 있음.
> 바뀌면 WSL에서 확인: `cat /etc/resolv.conf | grep nameserver`

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## WSL2 ↔ Windows PostgreSQL 연결 설정 (최초 1회)

`C:\Program Files\PostgreSQL\<버전>\data\pg_hba.conf` 맨 아래에 추가:
```
host    all    all    172.24.0.0/8    scram-sha-256
```
저장 후 Windows 서비스에서 PostgreSQL 재시작.

---

## 첫 계정 생성

`http://localhost:8000/docs` → `POST /auth/register` → Try it out:
```json
{
  "name": "홍길동",
  "email": "owner@test.com",
  "password": "test1234",
  "gym_name": "내 헬스장",
  "gym_type": "gym"
}
```
이후 `http://localhost:3000/login`에서 해당 이메일/비밀번호로 로그인.

---

## 기술 스택

### 백엔드
| 패키지 | 버전 | 용도 |
|--------|------|------|
| FastAPI | 0.129.0 | 웹 프레임워크 |
| uvicorn | 0.30.0 | ASGI 서버 |
| SQLAlchemy[asyncio] | 2.0.36 | ORM (비동기) |
| asyncpg | 0.29.0 | PostgreSQL 드라이버 |
| alembic | 1.13.3 | DB 마이그레이션 |
| PyJWT[crypto] | 2.11.0 | JWT 인증 |
| passlib[bcrypt] | 1.7.4 | 비밀번호 해싱 |
| bcrypt | 3.2.2 | **고정** (호환성 문제) |
| pydantic-settings | 2.5.2 | 설정 관리 |
| pydantic[email] | 2.9.2 | 스키마 검증 |

### 프론트엔드
| 패키지 | 버전 | 용도 |
|--------|------|------|
| Next.js | 16.1.6 | React 프레임워크 |
| React | 19.2.3 | UI 라이브러리 |
| TanStack Query | 5.90.21 | 서버 상태 관리 |
| Axios | 1.13.5 | HTTP 클라이언트 |
| Tailwind CSS | 4 | 스타일링 |
| Radix UI | 1.4.3 | 헤드리스 UI (Shadcn 기반) |
| React Hook Form | 7.71.1 | 폼 상태 관리 |
| Zod | 4.3.6 | 스키마 검증 |
| date-fns | 4.1.0 | 날짜 처리 |
| lucide-react | 0.574.0 | 아이콘 |
| sonner | 2.0.7 | 토스트 알림 |

---

## 프로젝트 구조

```
kinetica/
  backend/
    main.py                 # FastAPI 앱 (lifespan 자동 테이블 생성, 7개 라우터)
    config.py               # pydantic-settings (DB URL, SECRET_KEY)
    requirements.txt
    .env.example
    models/
      database.py           # SQLAlchemy 비동기 모델 (6개 테이블)
      schemas.py            # Pydantic v2 요청/응답 스키마
    routers/
      auth.py               # POST /auth/register, /auth/login, GET /auth/me
      members.py            # CRUD /members + /members/{id}/sessions, packages
      sessions.py           # CRUD /sessions (날짜 필터, 상태 변경 시 세션 자동 차감)
      payments.py           # CRUD /payments (member_packages)
      packages.py           # CRUD /packages (오너 전용)
      dashboard.py          # GET /dashboard, /dashboard/today, /dashboard/expiring
      trainers.py           # CRUD /trainers (목록/생성/수정/비활성화, 오너 전용)
    services/
      auth.py               # PyJWT 생성/검증, bcrypt, get_current_user dependency
  frontend/
    app/
      layout.tsx            # Root layout
      providers.tsx         # React Query + Auth 제공자
      globals.css
      (auth)/
        layout.tsx
        login/page.tsx      # 로그인 페이지
      (dashboard)/
        layout.tsx          # 사이드바 + 인증 보호 (미로그인 → /login 리다이렉트)
        page.tsx            # 대시보드 (통계 카드 + 오늘 수업 + 만료 예정)
        members/
          page.tsx          # 회원 목록 (검색, 추가 다이얼로그, 잔여 세션 표시)
          [id]/page.tsx     # 회원 상세 (탭: 기본정보, 패키지/결제, 수업이력)
                           # 헤더: 회원 비활성화 버튼
                           # 패키지/결제 탭: 패키지 삭제 버튼
        sessions/page.tsx   # 수업 스케줄 (날짜 필터, 상태 변경, 예약 다이얼로그)
        payments/page.tsx   # 결제 기록 (통계, 상태 필터, 결제 테이블)
        packages/page.tsx   # 패키지 관리 (CRUD, 오너만)
        trainers/page.tsx   # 트레이너 관리 (목록, 추가, 비활성화, 오너만)
    contexts/
      AuthContext.tsx        # useAuth 훅 (JWT + 유저 상태, localStorage 자동 복원)
    services/
      api.ts                # Axios 인스턴스 + 모든 API 함수
    types/
      index.ts              # 공유 TypeScript 타입
    lib/
      utils.ts              # cn() Tailwind 유틸
    components/
      ui/                   # Shadcn UI 컴포넌트 (button, input, dialog, table 등)
```

---

## 데이터 모델 (6개 테이블)

| 테이블 | 설명 | 주요 필드 |
|--------|------|---------|
| **gyms** | 헬스장/스튜디오 | id, name, type(gym/personal_studio), address, phone, is_active |
| **users** | 오너/트레이너 계정 | id, gym_id, email, hashed_password, name, role(owner/trainer/member), phone, is_active |
| **members** | 회원/고객 | id, gym_id, trainer_id, name, email, phone, birth_date, notes, is_active |
| **packages** | 패키지 상품 | id, gym_id, name, description, total_sessions, price, validity_days, is_active |
| **member_packages** | 회원이 구매한 패키지 | id, member_id, package_id, sessions_total, sessions_remaining, price_paid, payment_method, payment_status, start_date, expiry_date |
| **sessions** | 개별 수업 세션 | id, member_id, trainer_id, member_package_id, scheduled_at, duration_minutes, status, notes |

### Enum 타입
- **UserRole**: owner, trainer, member
- **GymType**: gym, personal_studio
- **SessionStatus**: scheduled, completed, no_show, cancelled
- **PaymentMethod**: cash, card, transfer, online_mock
- **PaymentStatus**: paid, pending, overdue

---

## 역할 기반 접근 제어 (RBAC)

- **오너(owner)**: 헬스장 전체 데이터 조회/수정 가능. 패키지 CRUD 전용 권한.
- **트레이너(trainer)**: 담당 회원(`trainer_id` 일치)만 조회 가능
- 모든 라우터에서 `get_current_user` dependency로 JWT 검증

---

## API 엔드포인트 전체 목록

```
# 인증
POST /auth/register         — 첫 오너 계정 + 헬스장 자동 생성 (JSON body)
POST /auth/login            — JWT 반환 (JSON body: email, password)
GET  /auth/me               — 현재 유저 정보

# 회원
GET/POST        /members             — 회원 목록/추가
GET/PUT/DELETE  /members/{id}        — 회원 상세/수정/비활성화
GET             /members/{id}/sessions  — 회원의 수업 이력
GET             /members/{id}/packages  — 회원의 패키지/결제 이력

# 수업
GET/POST        /sessions            — 수업 목록/예약 (?date=YYYY-MM-DD)
PUT/DELETE      /sessions/{id}       — 상태 변경/삭제
                                       완료 시 sessions_remaining 자동 차감
                                       완료된 세션 삭제 시 sessions_remaining 복구

# 결제
GET/POST           /payments         — 결제 목록/패키지 구매
GET/PUT/DELETE     /payments/{id}    — 결제 상세/상태 수정/삭제 (DELETE: 오너 전용)

# 패키지 (오너 전용)
GET/POST/PUT/DELETE /packages        — 패키지 상품 CRUD

# 트레이너 (오너 전용: POST/PUT/DELETE)
GET    /trainers                     — 트레이너 목록 (활성+비활성 전체)
POST   /trainers                     — 트레이너 계정 생성 (같은 gym_id 자동 설정)
PUT    /trainers/{id}                — 트레이너 정보 수정 (name, phone, is_active)
DELETE /trainers/{id}                — 트레이너 비활성화 (is_active=False, 삭제 아님)

# 대시보드
GET /dashboard                       — 통계 (오늘 수업수, 만료 예정, 미결제, 활성회원)
GET /dashboard/today                 — 오늘 수업 목록
GET /dashboard/expiring              — 이번 주 만료 예정 패키지 목록

# 기타
GET /health                          — 헬스 체크
```

---

## 주요 비즈니스 로직

1. **세션 완료 시 자동 차감**: `PUT /sessions/{id}` status → "completed" → `sessions_remaining` -1
2. **세션 삭제 시 복구**: 완료된 세션 삭제 시 `sessions_remaining` +1
3. **패키지 만료 계산**: `expiry_date = start_date + validity_days`
4. **DB 초기화**: `lifespan` 콜백으로 앱 시작 시 테이블 자동 생성

---

## async SQLAlchemy 관계 로딩 규칙

> **`db.refresh(obj, ["관계명"])`은 relationship 로딩 불가** — scalar 필드만 갱신됨.
> async context에서 lazy load 시도 시 `MissingGreenlet` 오류 발생.

**올바른 패턴:**
```python
# ❌ 잘못된 방식
await db.refresh(obj, ["member", "package"])

# ✅ JOIN 없이 relationship 로딩
await db.execute(
    select(Model).where(Model.id == obj.id)
    .options(selectinload(Model.관계필드))
)

# ✅ JOIN 결과로 relationship 로딩 (JOIN + selectinload 혼용 금지)
select(Model).join(Related).options(contains_eager(Model.관계필드))
```

JOIN + selectinload 동시 사용 시 충돌 → `contains_eager` 사용.
---

## 향후 확장 계획

| Phase | 기능 |
|-------|------|
| Phase 2 | 카카오톡 알림, 토스페이먼츠 PG 연동, 데이터 내보내기 |
| Phase 3 | 회원 게이미피케이션 (출석 포인트, 배지, 랭킹) |
| Phase 4 | AI 논문 요약 (트레이너용, Claude API) |
| Phase 5 | AI 음식 사진 칼로리/영양소 추정 (Vision API) |
| Phase 6 | React Native 모바일 앱 |
