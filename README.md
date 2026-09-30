# CREAW MERL Portal

Back-office portal for CREAW's monitoring, evaluation, research and learning (MERL) work. It covers the dashboard, field-submission review, the six pillars, participants, referrals, grants, organisation assessments, the reporting calendar, the audit log, and administration of users, roles, pipelines and lookup tables.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 and Zod. Read `AGENTS.md` before changing framework code, because this Next.js version differs from older releases.

## Getting started

```bash
yarn install
cp .env.example .env.local
yarn dev
```

Open <http://localhost:3000>. `/` sends you to `/dashboard` if you have a valid session and to `/login` otherwise.

## Demo credentials (mock mode)

Sign-in has two steps: the password, then a 6-digit verification code. Every active seeded user signs in with the password **`creaw-demo`** (by username or staff email) and the code **`246810`**; the mock sends no SMS or email. The login page shows these values in mock mode only. The accounts are useful for checking permission gating:

| Username          | Roles                                          | Scope       |
| ----------------- | ---------------------------------------------- | ----------- |
| `judy.mwangi`     | System Administrator                           | System-wide |
| `grace.wanjiru`   | Head of MERL                                   | All pillars |
| `lilian.otieno`   | Pillar Lead                                    | VAWG        |
| `samuel.ndegwa`   | Pillar Lead (acting), Grants & Finance Officer | WEE         |
| `otieno.were`     | Pillar Lead, Grants & Finance Officer          | WROs        |
| `cynthia.chelimo` | Case Officer, Counsellor                       | VAWG        |
| `faith.kamau`     | Data Entry                                     | VAWG        |

`mary.njoroge` (invited) and `peter.mbugua` (inactive) cannot sign in because they are not active.

Five wrong passwords lock an account for 15 minutes. "Forgot password?" walks the full reset flow: in mock mode the "Check your inbox" screen previews the email and its reset link, because none is sent. A changed password lasts until the server restarts.

## Environment

| Variable                | Default | Purpose                                                                                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORTAL_API_MODE`       | `mock`  | `mock` serves every request from an in-process repository and makes no network calls. `live` sends the same requests to the backend with `fetch`. |
| `PORTAL_API_BASE_URL`   | none    | Backend base URL. Required when `PORTAL_API_MODE=live`.                                                                                           |
| `PORTAL_API_TIMEOUT_MS` | `10000` | Per-request timeout for live mode.                                                                                                                |

All three are server-only. Switching modes changes the transport only; pages, components and Server Actions stay the same.

**Mock state is in memory.** Changes made in mock mode last only as long as the server process. Restarting `yarn dev` or `yarn start` restores the deterministic seed data and signs everyone out.

## API contract

Every response, mock or live, uses this envelope:

```json
{ "resultCode": 200, "success": true, "message": "OK", "data": {} }
```

List endpoints return this as `data`:

```json
{ "items": [], "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 }
```

Envelopes are validated with Zod in `src/lib/api/contracts.ts`. Feature modules (`src/features/*/api.ts`) are the only callers of the transport. Mutations go through authenticated, permission-checked Server Actions.

Sign-in is a two-step contract, and a live backend has to follow it. A `/auth/login` response that carries a token instead of a challenge is refused:

| Request                                           | Success `data`                                     | Failure codes                                   |
| ------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `POST /auth/login` `{ username, password }`       | `{ challengeId, maskedPhone, maskedEmail }`        | `403` wrong credentials, `423` account locked   |
| `POST /auth/otp/verify` `{ challengeId, code }`   | `{ token, user, grants, roles }`                   | `403` wrong code, `410` challenge expired       |
| `POST /auth/otp/resend` `{ challengeId }`         | none                                               | `410` challenge expired                         |
| `POST /auth/password/forgot` `{ email }`          | none; the same answer for known and unknown emails | none                                            |
| `POST /auth/password/reset` `{ token, password }` | none                                               | `410` link expired or used, `422` weak password |

The emailed reset link should open `/login?reset=<token>`. The portal shows each failure's `message` to the user.

A few rules follow from the schema in `merl-database-schema-mysql.sql`:

- Deletes are soft: they set `is_deleted`. No hard-delete path is exposed.
- A grant application moves `ACTIVE → PREPARED → REVIEWED → APPROVED`, one officer per step. Before approval, the officer who could sign the next step may instead decline it with `PATCH /grants/:id` `{ status: "DECLINED", status_description }`. The reason is required, the same maker-checker rule applies (an officer who signed an earlier step cannot decline a later one), and a declined application is final.
- Permissions are resolved as `user_role → role → role_permission → permission`, and a separate check applies pillar scope.
- Sensitive fields are masked by default. Revealing, downloading, exporting or changing them writes an audit entry.
- Server logs are structured and carry a correlation ID. They never contain credentials, tokens, contact details, identity numbers, notes, salaries or grant amounts.

## Commands

| Command          | Purpose                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `yarn dev`       | Start the development server                                        |
| `yarn test:run`  | Run the Vitest suite once (`yarn test` watches)                     |
| `yarn lint`      | Run ESLint                                                          |
| `yarn format`    | Format the codebase with Prettier (`yarn format:check` only checks) |
| `yarn typecheck` | Run the TypeScript compiler without emitting                        |
| `yarn build`     | Create the production build                                         |

## Project layout

- `src/app/(auth)`: the login route.
- `src/app/(portal)`: authenticated routes inside the shared portal shell.
- `src/features/<feature>`: each feature's typed API, schemas, Server Actions and components.
- `src/components`: portal shell, data table and shared UI patterns.
- `src/lib/api`: transport interface, mock and live transports, client and logger.
- `src/lib/mock-api`: seed data, in-memory store and request handlers for mock mode.
- `src/lib/auth`: session resolution, effective permissions, and the sign-in, verification, password-reset and logout actions.
- `docs/superpowers`: the design specification and implementation plan.
