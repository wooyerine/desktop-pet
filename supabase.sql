-- 리더보드 스키마 v8 — 닉네임 계정 + 동기화 코드 + 잔디밭 + 꾸미기 + 업적 + 주간 랭킹
-- (v8에서 바뀐 것: total_xp / week_key / week_xp 칼럼 — 이번 주에 얻은 경험치를
--  서버가 세어 두어, 누적 레벨과 별개로 "이번 주" 랭킹을 보여 준다)
-- (v7: stats 칼럼 — 업적 통계를 서버에서 합친다)
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
--   (v1.9.6+: acc는 "glasses,scarf"처럼 쉼표로 여러 개 — clean_deco 길이 제한 64로 넉넉히)
alter table public.leaderboard
  add column if not exists deco jsonb not null default '{}'::jsonb;

-- v6 → v7: 업적 통계 { pomos, keys, early, top1, bestStreak, visitors, pomoMonths, done }
-- 기기마다 따로 세던 걸 서버에서 합친다 — 카운터는 큰 쪽, 업적/도감은 합집합
alter table public.leaderboard
  add column if not exists stats jsonb not null default '{}'::jsonb;

-- v7 → v8: 주간 랭킹. 누적 랭킹은 고레벨이 늘 위에 있어 늦게 시작한 사람은
-- 만년 하위권이다 — "이번 주에 얼마나 했나"로 겨루는 판을 하나 더 둔다.
--   total_xp: 마지막 업로드 때의 누적 경험치 (레벨+경험치를 한 수로 편 것).
--             다음 업로드와의 차이가 그 사이에 번 경험치다. null이면 아직 기준점이 없다
--             (v8 적용 전부터 있던 행) — 첫 업로드는 기준점만 잡고 주간에 더하지 않는다.
--   week_key: week_xp가 어느 주 것인지 (그 주 일요일 날짜, 한국 시간).
--   week_xp:  그 주에 번 경험치. 주가 바뀌면 0부터 다시 센다.
alter table public.leaderboard add column if not exists total_xp bigint;
alter table public.leaderboard add column if not exists week_key text;
alter table public.leaderboard add column if not exists week_xp int not null default 0;
create index if not exists leaderboard_week_idx
  on public.leaderboard (week_key, week_xp desc);

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
grant select (nickname, level, xp, pet, updated_at, deco, week_key, week_xp)
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
    and length(value #>> '{}') between 1 and 64; -- acc는 "glasses,scarf"처럼 여러 개를 쉼표로 잇는다
$$;

-- 업적 통계 정리 — 아는 키만, 형식 맞는 값만
create or replace function public.clean_stats(p jsonb)
returns jsonb
language sql
immutable
as $$
  with src as (
    select case when jsonb_typeof(coalesce(p, 'null'::jsonb)) = 'object' then p else '{}'::jsonb end as j
  ),
  num as (
    select jsonb_object_agg(k, to_jsonb(least(greatest((j -> k #>> '{}')::numeric, 0), 100000000)::int)) as v
    from src, unnest(array['pomos', 'keys', 'bestStreak']) k
    where jsonb_typeof(j -> k) = 'number'
  ),
  bool as (
    select jsonb_object_agg(k, to_jsonb((j -> k)::boolean)) as v
    from src, unnest(array['early', 'top1']) k
    where jsonb_typeof(j -> k) = 'boolean'
  ),
  vis as (
    select jsonb_build_object('visitors', coalesce(jsonb_object_agg(key, to_jsonb(least(greatest((value #>> '{}')::numeric, 0), 100000)::int)), '{}'::jsonb)) as v
    from src, jsonb_each(case when jsonb_typeof(j -> 'visitors') = 'object' then j -> 'visitors' else '{}'::jsonb end)
    where key ~ '^[a-z]{1,16}$' and jsonb_typeof(value) = 'number'
  ),
  mon as (
    select jsonb_build_object('pomoMonths', coalesce(jsonb_object_agg(key, to_jsonb(least(greatest((value #>> '{}')::numeric, 0), 100000)::int)), '{}'::jsonb)) as v
    from src, jsonb_each(case when jsonb_typeof(j -> 'pomoMonths') = 'object' then j -> 'pomoMonths' else '{}'::jsonb end)
    where key ~ '^\d{4}-\d{2}$' and jsonb_typeof(value) = 'number'
  ),
  done as (
    select jsonb_build_object('done', coalesce(jsonb_agg(distinct e), '[]'::jsonb)) as v
    from src, jsonb_array_elements_text(case when jsonb_typeof(j -> 'done') = 'array' then j -> 'done' else '[]'::jsonb end) e
    where e ~ '^[A-Za-z0-9]{1,32}$'
  )
  select coalesce((select v from num), '{}'::jsonb) || coalesce((select v from bool), '{}'::jsonb)
      || (select v from vis) || (select v from mon) || (select v from done);
$$;

-- 두 기기의 통계 합치기 — 카운터는 큰 쪽, 불리언은 or, 도감/월별은 키마다 큰 쪽, 업적은 합집합.
-- (같은 뽀모를 두 PC가 각각 세지는 않으니 더하지 않고 큰 쪽을 고른다)
create or replace function public.merge_stats(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  with sa as (select public.clean_stats(a) j), sb as (select public.clean_stats(b) j)
  select jsonb_build_object(
    'pomos', greatest(coalesce((sa.j ->> 'pomos')::int, 0), coalesce((sb.j ->> 'pomos')::int, 0)),
    'keys', greatest(coalesce((sa.j ->> 'keys')::int, 0), coalesce((sb.j ->> 'keys')::int, 0)),
    'bestStreak', greatest(coalesce((sa.j ->> 'bestStreak')::int, 0), coalesce((sb.j ->> 'bestStreak')::int, 0)),
    'early', coalesce((sa.j ->> 'early')::boolean, false) or coalesce((sb.j ->> 'early')::boolean, false),
    'top1', coalesce((sa.j ->> 'top1')::boolean, false) or coalesce((sb.j ->> 'top1')::boolean, false),
    'visitors', (select coalesce(jsonb_object_agg(key, mx), '{}'::jsonb) from (
                   select key, max((value #>> '{}')::int) mx
                   from (select * from jsonb_each(sa.j -> 'visitors') union all select * from jsonb_each(sb.j -> 'visitors')) t
                   group by key) g),
    'pomoMonths', (select coalesce(jsonb_object_agg(key, mx), '{}'::jsonb) from (
                     select key, max((value #>> '{}')::int) mx
                     from (select * from jsonb_each(sa.j -> 'pomoMonths') union all select * from jsonb_each(sb.j -> 'pomoMonths')) t
                     group by key) g),
    'done', (select coalesce(jsonb_agg(distinct e), '[]'::jsonb) from (
               select * from jsonb_array_elements_text(sa.j -> 'done') union select * from jsonb_array_elements_text(sb.j -> 'done')) u(e))
  ) from sa, sb;
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

-- 레벨 + 경험치 → 누적 경험치 한 수. pet.js의 XP_PER_LEVEL(lv) = lv × 1000 과 짝:
-- Lv.L에 닿기까지 1000 + 2000 + … + (L-1)×1000 = 1000 × L × (L-1) / 2.
-- 레벨업 공식이 또 바뀌면 여기도 맞춰야 한다 — 안 맞추면 그 뒤 첫 업로드에서
-- 모두의 주간 점수가 한 번 튄다 (누적 랭킹에는 영향 없음).
create or replace function public.total_xp(p_level int, p_xp int)
returns bigint
language sql
immutable
as $$
  select 1000::bigint * p_level * (p_level - 1) / 2 + p_xp;
$$;

-- 이번 주 열쇠 = 이번 주 일요일 날짜(한국 시간). 일요일 0시에 모두 함께 리셋된다.
-- (잔디밭의 "이번 주"도 일요일 시작이라 맞췄다. date_trunc('week')는 월요일 기준이므로 안 쓴다)
-- pet.js의 weekKeyKST()와 같은 규칙 — 앱은 이 값으로 이번 주 행만 골라 읽는다.
create or replace function public.current_week_key()
returns text
language sql
stable
as $$
  select to_char(
    (now() at time zone 'Asia/Seoul')::date
      - extract(dow from now() at time zone 'Asia/Seoul')::int,
    'YYYY-MM-DD');
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
drop function if exists public.upsert_score(text, text, int, int, text, text, jsonb, jsonb);

create or replace function public.upsert_score(
  p_nickname text, p_secret text, p_level int, p_xp int, p_pet text,
  p_device text default null, p_pomo jsonb default null, p_deco jsonb default null,
  p_stats jsonb default null
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
  v_stats jsonb;
  v_total bigint;
  v_week text := public.current_week_key();
  v_week_xp bigint;
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
  v_total := public.total_xp(p_level, p_xp);

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

  -- 업적 통계는 늘 합친다 — 어느 PC가 최신이든 업적이 사라지면 안 된다
  v_stats := case when p_stats is null then coalesce(v_row.stats, '{}'::jsonb)
                  else public.merge_stats(coalesce(v_row.stats, '{}'::jsonb), p_stats) end;

  if not found then
    begin
      insert into public.leaderboard (nickname, secret_hash, level, xp, pet, pomo_by_device, deco, stats,
                                      total_xp, week_key, week_xp)
      values (v_nick, public.hash_secret(p_secret), p_level, p_xp, p_pet, v_devices,
              public.clean_deco(p_deco), v_stats, v_total, v_week, 0)
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
    -- 이번 주 경험치: 주가 바뀌었으면 0부터, 아니면 지난 업로드 이후 늘어난 만큼 더한다.
    -- 잠들거나 잔소리로 깎인 만큼은 빼되 0 밑으로는 안 내려간다 (이번 주 "번" 점수니까).
    -- 기준점(total_xp)이 없는 행은 이번에 기준점만 찍는다 — 옛 행의 누적 전체가
    -- 이번 주 점수로 잡히면 안 된다. 앱 버전과 무관하게 서버가 세므로 옛 앱도 집계된다.
    v_week_xp := case when v_row.week_key is distinct from v_week then 0
                      else coalesce(v_row.week_xp, 0) end;
    if v_row.total_xp is not null then
      v_week_xp := greatest(0, v_week_xp + (v_total - v_row.total_xp));
    end if;
    update public.leaderboard
      set nickname = v_nick, secret_hash = v_hash,
          level = p_level, xp = p_xp, pet = p_pet,
          pomo_by_device = v_devices,
          -- 꾸미기를 모르는 옛 앱이 올리면(null) 저장돼 있던 것을 지우지 않는다
          deco = case when p_deco is null then coalesce(v_row.deco, '{}'::jsonb)
                      else public.clean_deco(p_deco) end,
          stats = v_stats,
          total_xp = v_total,
          week_key = v_week,
          week_xp = least(v_week_xp, 2000000000)::int,
          updated_at = now()
      where lower(nickname) = lower(v_nick)
      returning * into v_row;
  else
    return jsonb_build_object('error', 'nickname_taken');
  end if;

  return jsonb_build_object(
    'updated_at', v_row.updated_at,
    'pomo_others', public.sum_pomo(v_row.pomo_by_device, p_device),
    'stats', coalesce(v_row.stats, '{}'::jsonb)
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
    'stats', coalesce(v_row.stats, '{}'::jsonb),
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
revoke execute on function public.clean_stats(jsonb) from public, anon, authenticated;
revoke execute on function public.merge_stats(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.total_xp(int, int) from public, anon, authenticated;
revoke execute on function public.current_week_key() from public, anon, authenticated;
