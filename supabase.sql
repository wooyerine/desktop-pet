-- 리더보드 스키마 v3 — 닉네임 계정 + 동기화 코드 + 잔디밭
-- (Supabase 대시보드 > SQL Editor에서 1회 실행. v1/v2에서 업그레이드해도,
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

-- v2 → v3: 잔디밭. 기기별로 나눠 담는다
--   { '기기id': { 'YYYY-MM-DD': 집중한 분 } }
-- 기기별로 두는 이유: 같은 날 데스크탑 50분 + 노트북 25분 = 75분으로 더하려면
-- 누가 얼마를 했는지 나눠 알고 있어야 한다. 한 덩어리로 두면 나중에 올린 PC가
-- 앞의 기록을 덮어쓰거나, 합치는 순간 같은 시간을 두 번 세게 된다.
alter table public.leaderboard
  add column if not exists pomo_by_device jsonb not null default '{}'::jsonb;

-- 개수로 세던 중간 버전에서 올라오는 경우: 한 개를 25분으로 환산해 옮긴다
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leaderboard' and column_name = 'pomo_days'
  ) then
    update public.leaderboard set pomo_by_device = jsonb_build_object('legacy', (
      select coalesce(jsonb_object_agg(key, to_jsonb(((value #>> '{}')::int) * 25)), '{}'::jsonb)
      from jsonb_each(coalesce(pomo_days, '{}'::jsonb))
    ))
    where coalesce(pomo_days, '{}'::jsonb) <> '{}'::jsonb
      and coalesce(pomo_by_device, '{}'::jsonb) = '{}'::jsonb;
    alter table public.leaderboard drop column pomo_days;
  end if;
end $$;

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

-- 기기 하나가 올린 기록 정리 — 공개 키로 호출되므로 형식/개수/범위를 여기서 막는다
create or replace function public.clean_pomo(p_days jsonb)
returns jsonb
language sql
stable  -- now()를 쓰므로 immutable이면 안 된다
as $$
  select coalesce(jsonb_object_agg(key, to_jsonb(least(greatest((value #>> '{}')::numeric::int, 0), 1440))), '{}'::jsonb)
  from (
    select key, value from jsonb_each(
      case when jsonb_typeof(coalesce(p_days, 'null'::jsonb)) = 'object' then p_days else '{}'::jsonb end
    )
    where key ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(value) = 'number'
      and (value #>> '{}')::numeric >= 1      -- 0분짜리 날짜는 담지 않는다
      and key >= to_char(now() - interval '400 days', 'YYYY-MM-DD')
    order by key desc
    limit 400
  ) t;
$$;

-- 한 기기를 뺀 나머지 기기들의 날짜별 합
create or replace function public.sum_pomo(p_all jsonb, p_except text)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(day, total), '{}'::jsonb)
  from (
    select d.key as day, sum((d.value #>> '{}')::int) as total
    from jsonb_each(coalesce(p_all, '{}'::jsonb)) dev,
         lateral jsonb_each(dev.value) d
    where p_except is null or dev.key <> p_except
    group by d.key
  ) t;
$$;

-- 점수 등록/갱신: 닉네임이 비어 있으면 새로 등록(코드 해시 저장),
-- 코드가 맞으면 갱신, 레거시 행(secret_hash null)은 먼저 온 사람이 선점,
-- 남의 닉네임이면 nickname_taken.
--
-- p_device/p_pomo는 기본값이 있어서 잔디를 모르는 예전 버전 앱(5개 인자)도 그대로 동작한다.
-- 인자가 늘어나면 새 오버로드가 생겨 PostgREST가 헷갈리므로 옛 시그니처는 지운다.
drop function if exists public.upsert_score(text, text, int, int, text);
drop function if exists public.upsert_score(text, text, int, int, text, jsonb);

create or replace function public.upsert_score(
  p_nickname text, p_secret text, p_level int, p_xp int, p_pet text,
  p_device text default null, p_pomo jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_nick text := trim(p_nickname);
  v_hash text;
  v_row public.leaderboard;
  v_devices jsonb;
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

  -- 이 기기 칸만 통째로 갈아 끼운다. 그 기기의 기록은 그 기기가 정답이고,
  -- 다른 기기 칸은 건드리지 않으므로 합계에서 빠지거나 두 번 세지 않는다
  v_devices := coalesce(v_row.pomo_by_device, '{}'::jsonb);
  if p_device is not null and p_device <> '' and length(p_device) <= 64 and p_pomo is not null then
    v_devices := jsonb_set(v_devices, array[p_device], public.clean_pomo(p_pomo));
    -- 기기 수 제한 (최근에 쓴 순으로 10대)
    if (select count(*) from jsonb_object_keys(v_devices)) > 10 then
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_devices
      from (
        select key, value,
               (select max(k) from jsonb_object_keys(value) k) as last_day
        from jsonb_each(v_devices)
        order by (key = p_device) desc, last_day desc nulls last
        limit 10
      ) t;
    end if;
  end if;

  if not found then
    begin
      insert into public.leaderboard (nickname, secret_hash, level, xp, pet, pomo_by_device)
      values (v_nick, v_hash, p_level, p_xp, p_pet, v_devices)
      returning * into v_row;
    exception when unique_violation then
      return jsonb_build_object('error', 'nickname_taken');
    end;
  elsif v_row.secret_hash is null or v_row.secret_hash = v_hash then
    update public.leaderboard
      set nickname = v_nick, secret_hash = v_hash,
          level = p_level, xp = p_xp, pet = p_pet,
          pomo_by_device = v_devices,
          updated_at = now()
      where lower(nickname) = lower(v_nick)
      returning * into v_row;
  else
    return jsonb_build_object('error', 'nickname_taken');
  end if;

  return jsonb_build_object(
    'updated_at', v_row.updated_at,
    'pomo_others', public.sum_pomo(v_row.pomo_by_device, p_device)
  );
end;
$$;

-- 저장된 펫 상태 조회 (다른 PC에서 이어하기 / 시작 시 동기화)
-- p_device를 주면 그 기기를 뺀 나머지 합을 돌려준다 (앱이 자기 몫을 따로 들고 있으므로)
drop function if exists public.get_state(text, text);

create or replace function public.get_state(
  p_nickname text, p_secret text, p_device text default null
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
    'pomo_others', public.sum_pomo(v_row.pomo_by_device, p_device),
    'updated_at', v_row.updated_at
  );
end;
$$;
