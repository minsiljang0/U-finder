-- 슈퍼파인더 관리용 MCP가 쓰는 테이블. Supabase SQL Editor에 붙여넣고 실행하세요.

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists dev_notes (
  id bigint generated always as identity primary key,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists known_issues (
  feature text primary key,
  status text not null,
  note text not null,
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id bigint generated always as identity primary key,
  subject text not null,
  status text not null default 'pending',
  note text,
  updated_at timestamptz not null default now()
);
