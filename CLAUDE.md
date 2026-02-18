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

## 프로젝트 구조

```
kinetica/
  backend/
    main.py              # FastAPI 앱 진입점 (lifespan으로 테이블 자동 생성)
    config.py            # pydantic-settings 설정
    requirements.txt     # PyJWT, passlib[bcrypt]==bcrypt 3.2.2 고정
    models/
      database.py        # SQLAlchemy 비동기 모델 (6개 테이블)
      schemas.py         # Pydantic v2 스키마
    routers/
      auth.py            # POST /auth/register, /auth/login, GET /auth/me
      members.py         # CRUD /members
      sessions.py        # CRUD /sessions (날짜 필터)
      payments.py        # CRUD /payments (member_packages)
      packages.py        # CRUD /packages
      dashboard.py       # GET /dashboard, /dashboard/today, /dashboard/expiring
    services/
      auth.py            # PyJWT 생성/검증, bcrypt, get_current_user dependency
  frontend/
    app/
      (auth)/login/      # 로그인 페이지
      (dashboard)/       # 보호된 페이지들 (사이드바 레이아웃)
        page.tsx         # 대시보드
        members/         # 회원 목록 + [id] 상세
        sessions/        # 수업 스케줄
        payments/        # 결제 기록
        packages/        # 패키지 관리
    contexts/
      AuthContext.tsx    # JWT 토큰 + 유저 상태 관리
    services/
      api.ts             # axios 인스턴스 + 모든 API 함수
    types/index.ts       # 공유 TypeScript 타입
```

---

## 데이터 모델 (6개 테이블)

| 테이블 | 설명 |
|--------|------|
| gyms | 헬스장/스튜디오 |
| users | 오너/트레이너 계정 (JWT 인증) |
| members | 고객 회원 |
| packages | 패키지 상품 정의 (PT 10회권 등) |
| member_packages | 회원이 구매한 패키지 인스턴스 (결제 정보 포함) |
| sessions | 개별 수업 세션 |

---

## 역할 기반 접근 제어

- **오너(owner)**: 헬스장 전체 데이터 조회/수정 가능
- **트레이너(trainer)**: 담당 회원(`trainer_id` 일치)만 조회 가능
- 모든 라우터에서 `get_current_user` dependency로 JWT 검증

---

## API 엔드포인트 요약

```
POST /auth/register         — 첫 오너 계정 + 헬스장 자동 생성 (JSON body)
POST /auth/login            — JWT 반환 (JSON body: email, password)
GET  /auth/me               — 현재 유저 정보

GET/POST        /members        — 회원 목록/추가
GET/PUT/DELETE  /members/{id}   — 회원 상세/수정/비활성화

GET/POST        /sessions       — 수업 목록/예약 (?date=YYYY-MM-DD)
PUT/DELETE      /sessions/{id}  — 상태 변경/삭제 (완료 시 sessions_remaining 차감)

GET/POST  /payments         — 결제 목록/패키지 구매
PUT       /payments/{id}    — 결제 상태 수정

GET/POST/PUT/DELETE /packages — 패키지 상품 CRUD

GET /dashboard              — 통계 (오늘 수업수, 만료 예정, 미결제, 활성회원)
GET /dashboard/today        — 오늘 수업 목록
GET /dashboard/expiring     — 이번 주 만료 패키지 목록
```

---

## 알려진 이슈 & 해결됨

| 이슈 | 원인 | 해결 |
|------|------|------|
| bcrypt 오류 | passlib과 최신 bcrypt 호환성 문제 | `bcrypt==3.2.2` 고정 |
| DB 연결 실패 | WSL2에서 `localhost` ≠ Windows | `.env`에 `172.24.64.1` 사용 |
| DB 연결 끊김 | `pg_hba.conf`에 WSL 서브넷 미허용 | `172.24.0.0/8` 추가 |
| 로그인 422 오류 | 프론트가 form-encoded 전송, 백엔드는 JSON 기대 | `api.ts` JSON으로 수정 |
| 대시보드 404 | 프론트·백엔드 엔드포인트 이름 불일치 | `api.ts` URL 수정 |

---

## 향후 확장 계획

| Phase | 기능 |
|-------|------|
| Phase 2 | 카카오톡 알림, 토스페이먼츠 PG 연동, 데이터 내보내기 |
| Phase 3 | 회원 게이미피케이션 (출석 포인트, 배지, 랭킹) |
| Phase 4 | AI 논문 요약 (트레이너용, Claude API) |
| Phase 5 | AI 음식 사진 칼로리/영양소 추정 (Vision API) |
| Phase 6 | React Native 모바일 앱 |

## 배포 (향후)

- Backend → Railway
- Frontend → Vercel
- DB → Railway PostgreSQL 또는 Neon
