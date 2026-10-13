-- ==========================================
-- ROS2 코드 보드 (ros2copy) Supabase Schema
-- ==========================================

-- 1. tabs 테이블
create table if not exists tabs (
  id bigserial primary key,
  name text not null unique,          -- "실습 3차시", "오늘 질문"
  sort int not null default 0,
  created_at timestamptz default now()
);

-- 2. snippets 테이블
create table if not exists snippets (
  id bigserial primary key,
  tab_id bigint references tabs(id) on delete cascade,
  title text,
  path text,                          -- "~/ros2_ws/src/my_py_pkg/my_py_pkg/"
  kind text not null,                 -- python / bash / xml / yaml / text
  body text not null,
  created_at timestamptz default now()
);

-- 3. commands 테이블
create table if not exists commands (
  id bigserial primary key,
  body text not null,                 -- 한 줄
  memo text,                          -- 선택, 한 줄 설명
  pinned boolean not null default false,
  created_at timestamptz default now()
);

-- ==========================================
-- Row Level Security (RLS) 설정
-- ==========================================

alter table tabs enable row level security;
alter table snippets enable row level security;
alter table commands enable row level security;

-- 누구나 select 가능
create policy "누구나 tabs 조회 가능" on tabs for select using (true);
create policy "누구나 snippets 조회 가능" on snippets for select using (true);
create policy "누구나 commands 조회 가능" on commands for select using (true);

-- 참고: insert / update / delete 는 서버 쪽 API에서 SUPABASE_SERVICE_ROLE_KEY를 사용하여 처리하므로,
-- anon 키를 통한 클라이언트 직접 수정은 원천 차단됩니다.
