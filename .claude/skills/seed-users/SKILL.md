---
name: seed-users
description: Seed dummy Indian users into the project's users table. Use this skill whenever the user wants to seed, create, generate, populate, or insert dummy/fake/test users into the database — including phrasings like "seed N users", "create test users", "add fake users", "populate users table", "I need some dummy accounts", or any variation referring to filling the users table with realistic data. This skill assumes the project layout under `Backend/app/` (account/models.py, db/config.py, utils.py) and uses the existing async SQLAlchemy session.
disable-model-invocation: true
---

# Seed Users

Seeds N realistic dummy Indian users into the `users` table using the project's existing async SQLAlchemy session, model, and password hasher.

## When to use

Trigger on any request to populate the users table with dummy / fake / test / seed data. Common phrasings include:
- "seed 5 users", "seed users"
- "create dummy users", "create test users", "create fake users"
- "add some users to the db", "populate the users table"
- "I need a few accounts to test with"

## Input

The skill takes one input — `no_of_users` (integer) — extracted from the user's natural-language request. Examples:

| User says | `no_of_users` |
|---|---|
| "seed 5 users" | 5 |
| "create 10 dummy users" | 10 |
| "populate users table with 3 fake accounts" | 3 |
| "seed users" *(no number)* | 1 *(default)* |
| "seed lots of users" *(non-integer)* | error — see below |

If the request contains no count, default to **1**. If it contains something that should be the count but isn't a valid positive integer, stop and respond:

```
Usage: seed N users (e.g. "seed 5 users")
```

## Required project files

This skill assumes the standard project layout. Read these first to ground yourself in the real schema and helpers — do not guess:

1. `Backend/app/account/models.py` — the `User` model (column names, types, defaults)
2. `Backend/app/db/config.py` — the `async_session` factory
3. `Backend/app/account/utils.py` (or wherever `hashed_password` lives — search if not there) — the `hashed_password()` helper

If any of these files are missing or named differently, stop and tell the user what you couldn't find before doing anything else.

## Workflow

### Step 1 — Read the schema
Read the three files above. Confirm the actual column names on the `User` model before generating data — do not assume. The fields below are the *expected* shape; reconcile against the real model.

### Step 2 — Generate N realistic Indian users
For each user, generate:

| Field | Value |
|---|---|
| `name` | Realistic North Indian first + last name (e.g. "Rohan Khurana", "Sneha Tandon", "Karan Mathur"). Pick ordinary, plausible names — avoid celebrity names (Shah Rukh Khan, Virat Kohli, etc.) and avoid pairing the same first/last names repeatedly. When N > 1, mix male and female first names roughly evenly so the dataset doesn't read as templated. |
| `email` | Lowercase, derived from name with a 2–3 digit numeric suffix. Format: `{first}.{last}{NN}@gmail.com` (e.g. `rahul.sharma91@gmail.com`). Use random numeric suffixes; avoid sequential ones. |
| `hashed_password` | Result of calling `hashed_password("pass123")` from the project's utils. Always the same plaintext — `pass123` — so you can log in as any seeded user. |
| `is_active` | `True` |
| `is_verified` | `False` |
| `is_admin` | `False` |
| `created_at` | Current UTC datetime (`datetime.now(timezone.utc)` or whatever the model uses) |
| `updated_at` | Same as `created_at` |

### Step 3 — Ensure email uniqueness
For each user, generate the email *upfront* with a random 2–3 digit suffix, then query the `users` table to confirm it doesn't already exist. If it collides, regenerate the entire suffix (don't patch the existing one) and re-check. Loop until unique. This keeps the generation logic in one place rather than scattered across the insert flow.

### Step 4 — Insert via the project's async session
Use the same `async_session` pattern found in `Backend/app/db/config.py`. Do not invent a new session, do not open a raw connection — match the project's pattern exactly so this script works in the same environment as the rest of the app.

### Step 5 — Print confirmation
For each successfully inserted user, print:
- `id`
- `name`
- `email`

Format as a clean table or one-per-line — readable in terminal output.

### Step 6 — Delete the temp script
After the script runs successfully, delete it. The script is throwaway — leaving it on disk clutters the workspace and risks it being committed later. Always remove it as the final step, even if seeding succeeded only partially.

## How to run it

Write a single Python script and execute it with `python` via Bash. Place the script in a temporary location (not committed) — e.g. `scripts/_seed_users.py` or just `/tmp/seed_users.py`. The script should:

- Be runnable as `python <path>` from the project root
- Use `asyncio.run(main())` since the session is async
- Take the count as a CLI arg or hardcode the requested N (whichever is simpler — this is one-off seed data)

## Notes & gotchas

- **Password is always `pass123`** (hashed). This is intentional for dev convenience. Do not change it without asking.
- **Don't commit the seed script** — it's a throwaway. Mention this to the user when you finish.
- If the `User` model has additional non-nullable columns this skill doesn't cover (phone, dob, etc.), surface them to the user and ask how to populate them rather than guessing.
- If the project uses a different timezone convention for timestamps (naive UTC vs aware), match what the model defines.
