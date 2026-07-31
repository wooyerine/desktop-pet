-- 리더보드 스키마 v2 — 닉네임 계정 + 동기화 코드
-- (Supabase 대시보드 > SQL Editor에서 1회 실행. v1에서 업그레이드해도,
--  새 프로젝트에 처음 실행해도 동작한다)
--
-- 닉네임이 곧 계정: lower(nickname) 고유, 비밀(동기화 코드)은 해시로 저장.
-- 쓰기는 아래 RPC 함수로만 가능하고, 함수 안에서 코드를 검증한다.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.leaderboard (
  nickname text not null,
  secret_hash text,
  level int not null default 1,
  xp int not null default 0,
  pet text not null default 'cat',
  updated_at timestamptz not null default now()
);

-- v1 → v2 업그레이드 (새 설치에서는 no-op)
alter table public.leaderboard add column if not exists secret_hash text;
alter table public.leaderboard drop column if exists device_id;

-- 닉네임 중복 정리: 닉네임(대소문자 무시)별 최고 진행도 행만 남긴다
delete from public.leaderboard a
using public.leaderboard b
where lower(a.nickname) = lower(b.nickname)
  and (a.level, a.xp, a.updated_at, a.ctid) < (b.level, b.xp, b.updated_at, b.ctid);

create unique index if not exists leaderboard_nickname_key
  on public.leaderboard (lower(nickname));

alter table public.leaderboard enable row level security;

-- 랭킹은 누구나 읽지만, insert/update 정책은 없다 → 쓰기는 RPC로만
drop policy if exists "누구나 읽기" on public.leaderboard;
drop policy if exists "누구나 등록" on public.leaderboard;
drop policy if exists "누구나 갱신" on public.leaderboard;
create policy "누구나 읽기" on public.leaderboard
  for select using (true);

-- 점수 등록/갱신: 닉네임이 비어 있으면 새로 등록(코드 해시 저장),
-- 코드가 맞으면 갱신, 레거시 행(secret_hash null)은 먼저 온 사람이 선점,
-- 남의 닉네임이면 nickname_taken.
create or replace function public.upsert_score(
  p_nickname text, p_secret text, p_level int, p_xp int, p_pet text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_nick text := trim(p_nickname);
  v_hash text;
  v_row public.leaderboard;
begin
  if v_nick is null or v_nick = '' or length(v_nick) > 12 then
    return jsonb_build_object('error', 'bad_nickname');
  end if;
  if p_secret is null or length(p_secret) < 8 then
    return jsonb_build_object('error', 'bad_secret');
  end if;
  if p_level is null or p_level < 1 or p_xp is null or p_xp < 0
     or p_pet not in ('cat', 'dog', 'rabbit') then
    return jsonb_build_object('error', 'bad_input');
  end if;
  v_hash := encode(digest(p_secret, 'sha256'), 'hex');

  select * into v_row from public.leaderboard
    where lower(nickname) = lower(v_nick);

  if not found then
    begin
      insert into public.leaderboard (nickname, secret_hash, level, xp, pet)
      values (v_nick, v_hash, p_level, p_xp, p_pet)
      returning * into v_row;
    exception when unique_violation then
      return jsonb_build_object('error', 'nickname_taken');
    end;
  elsif v_row.secret_hash is null or v_row.secret_hash = v_hash then
    update public.leaderboard
      set nickname = v_nick, secret_hash = v_hash,
          level = p_level, xp = p_xp, pet = p_pet, updated_at = now()
      where lower(nickname) = lower(v_nick)
      returning * into v_row;
  else
    return jsonb_build_object('error', 'nickname_taken');
  end if;

  return jsonb_build_object('updated_at', v_row.updated_at);
end;
$$;

-- 저장된 펫 상태 조회 (다른 PC에서 이어하기 / 시작 시 동기화)
create or replace function public.get_state(
  p_nickname text, p_secret text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.leaderboard;
begin
  if p_secret is null or p_secret = '' then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_row from public.leaderboard
    where lower(nickname) = lower(trim(p_nickname))
      and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object(
    'nickname', v_row.nickname,
    'level', v_row.level,
    'xp', v_row.xp,
    'pet', v_row.pet,
    'updated_at', v_row.updated_at
  );
end;
$$;
