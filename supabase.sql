-- 리더보드 테이블 (Supabase 대시보드 > SQL Editor에서 1회 실행)
create table if not exists public.leaderboard (
  device_id uuid primary key,
  nickname text not null,
  level int not null default 1,
  xp int not null default 0,
  pet text not null default 'cat',
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

-- 친구들끼리 쓰는 캐주얼 리더보드: 누구나 읽고, 자기 device_id 행을 갱신
create policy "누구나 읽기" on public.leaderboard
  for select using (true);
create policy "누구나 등록" on public.leaderboard
  for insert with check (true);
create policy "누구나 갱신" on public.leaderboard
  for update using (true);
