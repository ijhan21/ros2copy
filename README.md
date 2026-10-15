# ROS2 코드 보드 (ros2copy)

ROS2 강의 중 수강생이 실시간으로 코드를 대조하고 복사할 수 있는 강의용 코드 보드입니다.

---

## 1. 테이블 생성 SQL

Supabase SQL Editor에서 실행합니다.

```sql
create table tabs (
  id bigserial primary key,
  name text not null unique,          -- "실습 3차시", "오늘 질문"
  sort int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table snippets (
  id bigserial primary key,
  tab_id bigint references tabs(id),  -- cascade 제거
  title text,
  path text,                          -- "~/ros2_ws/src/my_py_pkg/my_py_pkg/"
  kind text not null,                 -- python / bash / xml / yaml / text
  body text not null,
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table commands (
  id bigserial primary key,
  body text not null,                 -- 한 줄
  memo text,                          -- 선택, 한 줄 설명
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- RLS 활성화 및 조회 정책
alter table tabs enable row level security;
alter table snippets enable row level security;
alter table commands enable row level security;

create policy "누구나 tabs 조회 가능" on tabs for select using (true);
create policy "누구나 snippets 조회 가능" on snippets for select using (true);
create policy "누구나 commands 조회 가능" on commands for select using (true);
```

---

## 2. 환경변수 목록

`.env.example` 파일을 참조하여 Vercel 및 로컬 환경변수를 설정합니다.

| 환경변수명 | 설명 | 비고 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 대시보드 Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명(Anon) 공개 키 | Supabase 대시보드 Settings > API |
| `SUPABASE_SECRET_KEY` | Supabase 시크릿(Service Role) 키 | 서버 전용, 절대 브라우저 노출 금지 |
| `BOARD_PASSWORD` | 강사 화면(`/올리기`) 등록 및 관리용 암호 | 강사 본인만 아는 임의 문자열 |

---

## 3. Vercel 배포 순서

1. GitHub에 `ros2copy` 저장소를 생성하고 푸시합니다.
2. Vercel 대시보드에서 `Add New...` > `Project`를 누르고 `ros2copy` 저장소를 가져옵니다.
3. `Environment Variables` 항목에 위의 4개 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `BOARD_PASSWORD`)를 입력합니다.
4. `Deploy` 버튼을 누르면 배포가 완료됩니다. (총 4번 클릭)

---

## 4. 강사가 수업 중 쓰는 법

1. 브라우저에서 `/올리기`로 접속하고 암호를 입력해 해당 차시 탭을 고릅니다.
2. 본문 상자에 코드를 붙여넣고 `Ctrl+Enter`를 치면 학생 화면 상단에 즉시 게시됩니다.
3. 실행할 CLI 명령어는 화면 맨 아래에 입력하고 `Enter`만 치면 전송됩니다.

---

## 5. Supabase 멈춤 방지 (Vercel Cron & Server Ping)

`vercel.json`에 정의된 매일 새벽 3시 `/api/ping` 예약 작업 및 서버 내부 일 1회 핑은 Supabase 무료 플랜의 7일 미사용 자동 정지(Pause)를 막는 설정입니다. 이 설정을 지우면 일주일 뒤 사이트가 죽습니다.

---

## 6. hanslab 서버 운영 및 SSE 스트리밍

- 주소: `https://rokey.hanslabai.p-e.kr` (Nginx Proxy Manager 앞단)
- 서버 백엔드가 Supabase를 메모리에 캐시하여 수강생 동시 접속 시 Supabase 트래픽 고갈을 방지합니다.
- 수강생 클라이언트는 `GET /api/stream` SSE로 실시간 갱신을 수신합니다.
- 15초마다 `: keepalive` 주석을 전송하여 연결을 유지하며, Nginx의 `X-Accel-Buffering: no` 및 버퍼링 비활성화로 지연 없이 전달됩니다.
- 한 탭의 본문 합이 256KB를 초과할 경우 본문을 분리하여 `GET /api/snippets/:id`로 온디맨드 로드합니다.
- 연결 끊김 시 1초, 2초, 4초... 최대 30초 지수 백오프로 재연결하며, 3회 연속 실패 시 30초 폴링으로 자동 전환됩니다.

### Docker 컨테이너 운영

- 컨테이너 빌드 및 실행: `docker compose up -d --build`
- 로그 확인: `docker compose logs -f`
- 상태 및 헬스체크 확인: `docker compose ps`
- 컨테이너 중지: `docker compose down`
- 재부팅 시 자동 시작: `restart: unless-stopped` 설정 및 호스트 `docker.service`로 자동 시작 보장

