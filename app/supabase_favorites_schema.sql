-- 즐겨찾기를 회원별(user_id)로 저장하기 위한 테이블. Supabase SQL Editor에서 실행하세요.
-- RLS를 켜서 본인 데이터만 조회/수정 가능하게 한다.

create table if not exists fav_channels (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  thumbnail text,
  subscribers bigint not null default 0,
  saved_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists fav_videos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  thumbnail text,
  channel_title text,
  saved_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists fav_keywords (
  keyword text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, keyword)
);

alter table fav_channels enable row level security;
alter table fav_videos enable row level security;
alter table fav_keywords enable row level security;

create policy "own fav_channels" on fav_channels for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own fav_videos" on fav_videos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own fav_keywords" on fav_keywords for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
