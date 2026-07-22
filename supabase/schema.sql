-- forge-regex 数据库 Schema
-- 在 Supabase SQL Editor 中执行

-- 用户表
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  stripe_customer_id text,
  subscription_status text default 'free' check (subscription_status in ('free', 'premium')),
  created_at timestamptz default now()
);

-- 每日使用配额表
create table if not exists usage (
  id bigint primary key generated always as identity,
  user_id uuid references users(id) on delete cascade,
  date date not null default current_date,
  count int not null default 0,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- 匿名用户配额（按 IP）
create table if not exists anonymous_usage (
  id bigint primary key generated always as identity,
  ip_hash text not null,
  date date not null default current_date,
  count int not null default 0,
  created_at timestamptz default now(),
  unique (ip_hash, date)
);

-- 索引
create index if not exists idx_usage_user_date on usage(user_id, date);
create index if not exists idx_anonymous_usage_ip_date on anonymous_usage(ip_hash, date);
