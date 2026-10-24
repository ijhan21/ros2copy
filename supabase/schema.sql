-- ==========================================
-- ROS2 코드 보드 (ros2copy) Supabase Schema
-- ==========================================

-- 1. tabs 테이블
create table if not exists tabs (
  id bigserial primary key,
  name text not null unique,          -- "실습 3차시", "오늘 질문"
  sort int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- 2. snippets 테이블 (외래키 cascade 제거)
create table if not exists snippets (
  id bigserial primary key,
  tab_id bigint references tabs(id),
  title text,
  path text,                          -- "~/ros2_ws/src/my_py_pkg/my_py_pkg/"
  kind text not null,                 -- python / bash / xml / yaml / text
  body text not null,
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- 3. commands 테이블
create table if not exists commands (
  id bigserial primary key,
  body text not null,                 -- 한 줄
  memo text,                          -- 선택, 한 줄 설명
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- 4. shared_files 테이블 (실습 공유 파일)
create table if not exists shared_files (
  id bigserial primary key,
  tab_id bigint references tabs(id),
  filename text not null,             -- 서버 디스크 고유 파일명
  original_name text not null,        -- 원본 업로드 파일명
  size bigint not null default 0,     -- 바이트 단위 크기
  mime_type text,                     -- MIME 타입
  memo text,                          -- 선택, 한 줄 설명
  download_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ==========================================
-- 기존 테이블 마이그레이션 DDL
-- ==========================================
-- 탭 soft delete 지원
alter table tabs add column if not exists deleted_at timestamptz;

-- 스니펫/명령어/공유파일 soft delete & 핀 지원
alter table snippets add column if not exists deleted_at timestamptz;
alter table snippets add column if not exists pinned boolean not null default false;
alter table commands add column if not exists deleted_at timestamptz;

-- 공유 파일 soft delete 컬럼
alter table shared_files add column if not exists deleted_at timestamptz;

-- 탭 삭제 시 연쇄 삭제 방지 (외래키 cascade 제거)
alter table snippets drop constraint if exists snippets_tab_id_fkey;
alter table snippets add constraint snippets_tab_id_fkey foreign key (tab_id) references tabs(id);
alter table shared_files drop constraint if exists shared_files_tab_id_fkey;
alter table shared_files add constraint shared_files_tab_id_fkey foreign key (tab_id) references tabs(id);

-- ==========================================
-- Row Level Security (RLS) 설정
-- ==========================================

alter table tabs enable row level security;
alter table snippets enable row level security;
alter table commands enable row level security;
alter table shared_files enable row level security;

-- 누구나 select 가능
create policy "누구나 tabs 조회 가능" on tabs for select using (true);
create policy "누구나 snippets 조회 가능" on snippets for select using (true);
create policy "누구나 commands 조회 가능" on commands for select using (true);
create policy "누구나 shared_files 조회 가능" on shared_files for select using (true);

-- 참고: insert / update / delete 는 서버 쪽 API에서 SUPABASE_SECRET_KEY를 사용하여 처리하므로,
-- anon 키를 통한 클라이언트 직접 수정은 원천 차단됩니다.
