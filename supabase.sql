-- 리더보드 스키마 v6 — 닉네임 계정 + 동기화 코드 + 잔디밭 + 꾸미기
-- (v6에서 바뀐 것: deco 칼럼 — 착용 중인 꾸미기 한 벌을 저장해
--  랭킹에서 "친구 책상 구경"을 보여 주고, 다른 PC와 꾸미기를 동기화한다)
-- (Supabase 대시보드 > SQL Editor에서 1회 실행. 옛 버전에서 업그레이드해도,
--  새 프로젝트에 처음 실행해도 동작한다)
--
-- 닉네임이 곧 계정: lower(nickname) 고유, 비밀(동기화 코드)은 해시로 저장.
-- 쓰기는 아래 RPC 함수로만 가능하고, 함수 안에서 코드를 검증한다.
--
-- v4에서 고친 것 — 동기화 코드가 털릴 수 있던 구멍 두 개:
--   1) 읽기 정책이 테이블 전체였다. 공개 키로 secret_hash까지 조회됐다.
--      → 컬럼 단위 권한으로 랭킹에 필요한 칸만 읽게 한다.
--   2) 솔트 없는 SHA-256이라 코드 규칙(8자, 31자 알파벳)만 알면
--      GPU로 전수 대입이 몇 분이면 끝났다. → bcrypt로 바꾼다.
--      기존 행은 그 사람이 다음에 접속해 코드를 맞히는 순간 자동 승급된다
--      (해시만 갖고는 원본 코드를 알 수 없으니 한꺼번에 못 바꾼다).

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

-- v5 → v6: 착용 중인 꾸미기 { desk, acc, skin, deskStyle, kb }
alter table public.leaderboard
  add column if not exists deco jsonb not null default '{}'::jsonb;

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

-- 읽을 수 있는 "칸"을 랭킹에 필요한 것만으로 좁힌다.
-- RLS 정책은 행 단위라 컬럼을 못 가린다 — secret_hash(계정 비밀)와
-- pomo_by_device(기기 목록)는 공개 키로 조회되면 안 되므로 권한에서 뺀다.
-- 아래 RPC들은 security definer라 소유자 권한으로 돌아 그대로 동작한다.
revoke all on public.leaderboard from anon, authenticated;
grant select (nickname, level, xp, pet, updated_at, deco)
  on public.leaderboard to anon, authenticated;

-- 동기화 코드 해시 — 새로 만드는 건 bcrypt(솔트 자동 포함)
create or replace function public.hash_secret(p_secret text)
returns text
language sql
volatile  -- gen_salt()가 매번 다른 값을 낸다
set search_path = public, extensions
as $$
  select extensions.crypt(p_secret, extensions.gen_salt('bf', 10));
$$;

-- 검증 — 아직 승급 전인 레거시 SHA-256 행도 받아 준다
create or replace function public.verify_secret(p_secret text, p_hash text)
returns boolean
language sql
stable
set search_path = public, extensions
as $$
  select case
    when p_hash is null or p_secret is null then false
    when left(p_hash, 1) = '$' then p_hash = extensions.crypt(p_secret, p_hash)
    else p_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  end;
$$;

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

-- 꾸미기 정리 — 공개 키로 호출되므로 아는 키만, 짧은 문자열 값만 받는다
create or replace function public.clean_deco(p_deco jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(
    case when jsonb_typeof(coalesce(p_deco, 'null'::jsonb)) = 'object' then p_deco else '{}'::jsonb end
  )
  where key in ('desk', 'acc', 'skin', 'deskStyle', 'kb')
    and jsonb_typeof(value) = 'string'
    and length(value #>> '{}') between 1 and 16;
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
-- p_device/p_pomo/p_deco는 기본값이 있어서 예전 버전 앱(인자가 적은 호출)도 그대로 동작한다.
-- 인자가 늘어나면 새 오버로드가 생겨 PostgREST가 헷갈리므로 옛 시그니처는 지운다.
drop function if exists public.upsert_score(text, text, int, int, text);
drop function if exists public.upsert_score(text, text, int, int, text, jsonb);
drop function if exists public.upsert_score(text, text, int, int, text, text, jsonb);

create or replace function public.upsert_score(
  p_nickname text, p_secret text, p_level int, p_xp int, p_pet text,
  p_device text default null, p_pomo jsonb default null, p_deco jsonb default null
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
     -- 펫을 추가하면 여기도 늘려야 한다. 빠뜨리면 그 펫을 고른 사람은
     -- 점수 업로드가 bad_input으로 조용히 막힌다 (pet.js의 PET_DEFS와 짝)
     or p_pet not in ('cat', 'dog', 'rabbit', 'hamster', 'otter') then
    return jsonb_build_object('error', 'bad_input');
  end if;

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
      insert into public.leaderboard (nickname, secret_hash, level, xp, pet, pomo_by_device, deco)
      values (v_nick, public.hash_secret(p_secret), p_level, p_xp, p_pet, v_devices,
              public.clean_deco(p_deco))
      returning * into v_row;
    exception when unique_violation then
      return jsonb_build_object('error', 'nickname_taken');
    end;
  elsif v_row.secret_hash is null or public.verify_secret(p_secret, v_row.secret_hash) then
    -- 비어 있거나 아직 SHA-256인 행은 이번 접속에 bcrypt로 승급한다
    v_hash := case
      when v_row.secret_hash is null or left(v_row.secret_hash, 1) <> '$'
        then public.hash_secret(p_secret)
      else v_row.secret_hash
    end;
    update public.leaderboard
      set nickname = v_nick, secret_hash = v_hash,
          level = p_level, xp = p_xp, pet = p_pet,
          pomo_by_device = v_devices,
          -- 꾸미기를 모르는 옛 앱이 올리면(null) 저장돼 있던 것을 지우지 않는다
          deco = case when p_deco is null then coalesce(v_row.deco, '{}'::jsonb)
                      else public.clean_deco(p_deco) end,
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
    where lower(nickname) = lower(trim(p_nickname));
  -- 코드가 틀렸는지 없는 닉네임인지 구분해 주지 않는다 (계정 존재 여부도 정보다)
  if not found or not public.verify_secret(p_secret, v_row.secret_hash) then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object(
    'nickname', v_row.nickname,
    'level', v_row.level,
    'xp', v_row.xp,
    'pet', v_row.pet,
    'deco', coalesce(v_row.deco, '{}'::jsonb),
    'pomo_others', public.sum_pomo(v_row.pomo_by_device, p_device),
    'updated_at', v_row.updated_at
  );
end;
$$;

-- 앱이 부르는 건 upsert_score / get_state 둘뿐이다. 나머지 도우미 함수는
-- security definer 안에서만 쓰이므로 밖에서 부를 수 있게 열어 둘 이유가 없다.
-- public까지 회수해야 한다 — 함수 실행은 기본이 PUBLIC 허용이라
-- anon/authenticated만 지우면 그대로 호출된다. 소유자로 도는
-- security definer 함수들은 이 회수와 무관하게 계속 부를 수 있다.
revoke execute on function public.hash_secret(text) from public, anon, authenticated;
revoke execute on function public.verify_secret(text, text) from public, anon, authenticated;
revoke execute on function public.clean_pomo(jsonb) from public, anon, authenticated;
revoke execute on function public.clean_deco(jsonb) from public, anon, authenticated;
revoke execute on function public.sum_pomo(jsonb, text) from public, anon, authenticated;
