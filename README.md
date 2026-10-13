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
  created_at timestamptz default now()
);

create table snippets (
  id bigserial primary key,
  tab_id bigint references tabs(id) on delete cascade,
  title text,
  path text,                          -- "~/ros2_ws/src/my_py_pkg/my_py_pkg/"
  kind text not null,                 -- python / bash / xml / yaml / text
  body text not null,
  created_at timestamptz default now()
);

create table commands (
  id bigserial primary key,
  body text not null,                 -- 한 줄
  memo text,                          -- 선택, 한 줄 설명
  pinned boolean not null default false,
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
