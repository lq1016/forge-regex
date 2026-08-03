# 邮箱密码认证设计（替代魔法链接）

**日期：** 2026-07-30  
**状态：** 已实现并上线  
**范围：** 中国版 / 英文版统一；项目未正式上线，不做旧用户迁移。

## 目标

- 去掉邮件魔法链接登录。
- 用户用**邮箱 + 自设密码**注册 / 登录。
- 注册与找回密码时，邮箱只发送**验证码**（用户在站内填写）。
- 登录态继续用现有 `forge-session` JWT Cookie，配额 / Pro / 分享逻辑不变。

## 非目标

- OAuth（Google / 微信扫码登录）本期不做。
- 多设备会话列表、强制下线不做。
- 邮箱枚举防护做到「通用文案 + 限频」即可，不做完美防探测。

## 用户流程

### 注册

1. 打开登录弹窗 → 「注册」
2. 填写：邮箱、密码、确认密码
3. 提交 → 服务端校验格式与强度 → 发送 6 位验证码邮件 → 进入「输入验证码」步
4. 用户填验证码 → 校验通过 → 写入 `users`（已验证）→ `setSession` → 关闭弹窗并刷新额度

### 登录

1. 「登录」：邮箱 + 密码
2. 校验通过 → `setSession`（若有 Pro 订阅则同步 `forge-pro`）
3. 密码错误：通用错误「邮箱或密码不正确」；限频防爆破

### 忘记密码

1. 「忘记密码」：填邮箱 → 发验证码
2. 验证码 + 新密码 + 确认 → 更新 `password_hash` → 自动登录（或回到登录页，推荐自动登录）

## 数据模型（SQLite）

```sql
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,          -- 'register' | 'reset'
  code_hash TEXT NOT NULL,        -- 只存哈希
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email_purpose
  ON auth_codes(email, purpose);
```

- 密码：Node `crypto.scrypt` 或 `bcrypt`（优先项目已有依赖；无则用 scrypt 免新包）。
- 验证码：6 位数字，TTL **10 分钟**，单码最多试 **5** 次，同邮箱同 purpose **每小时最多发 5 封**。

## API

| 方法 | 路径 | 作用 |
|------|------|------|
| POST | `/api/auth/register` | `{ email, password }` → 发注册码（不直接建未验证用户，或建 pending；推荐**验证成功后再 insert users**） |
| POST | `/api/auth/verify-register` | `{ email, code, password }` → 建用户 + session |
| POST | `/api/auth/login` | `{ email, password }` → session |
| POST | `/api/auth/forgot` | `{ email }` → 发重置码（邮箱不存在也返回 ok） |
| POST | `/api/auth/reset` | `{ email, code, password }` → 改密 + session |
| GET | `/api/auth/me` | 保持 |
| POST | `/api/auth/logout` | 保持 |

删除 / 停用：

- `POST /api/auth/request`（魔法链接）
- `POST /api/auth/verify`（token 消费）
- `/auth/verify` 页面（或改成简单「请从应用内登录」说明页）
- `data/magic-tokens.json` 相关逻辑

## UI（AuthButton）

- Tab 或切换：**登录 | 注册**
- 登录页：邮箱、密码、忘记密码链接
- 注册页：邮箱、密码、确认密码 → 下一步验证码
- 验证码步：6 位输入、重发（倒计时 60s）
- 文案中英跟现有 `i18n` / `copy`

## 安全

- Cookie 规则不变（httpOnly / lax / secure in prod）。
- 密码最少 8 位。
- 登录失败限频：每邮箱 + IP 滑动窗口。
- 验证码与密码均不明文落库、不打日志。

## 兼容

- Pro：登录成功后仍按邮箱查 `subscriptions` / `current_period_end` 并 `setProCookie`。
- 支付开通 Pro 仍按邮箱，与密码无关。
- 未上线：无需迁移魔法链接用户。

## 验收

1. 新邮箱可注册 → 收码 → 设密成功并登录。
2. 同邮箱再注册被拒绝。
3. 正确密码可登录；错误密码失败。
4. 忘记密码可改密并用新密码登录。
5. 无 `RESEND_API_KEY` 时开发模式把验证码打日志 / 可选返回（仅非生产）。
6. 魔法链接入口不可用。
