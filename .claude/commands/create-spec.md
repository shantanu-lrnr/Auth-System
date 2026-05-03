---
description: Create a spec file and feature branch for the next Auth System step
argument-hint: "Step number and feature name e.g. 2 Registration"
allowed-tools: Read, Write, Glob, Bash(git:*)
---

You are a senior developer building a feature for this full-stack authentication
system (FastAPI backend + React frontend). Always follow the rules in CLAUDE.md.

User input: $ARGUMENTS

## Step 1 — Check working directory is clean
Run `git status` and check for uncommitted, unstaged, or untracked files.
If any exist, stop immediately and tell the user to commit or stash changes
before proceeding. DO NOT CONTINUE until the working directory is clean.

## Step 2 — Parse the arguments
From $ARGUMENTS extract:

1. `step_number` — zero-padded to 2 digits: 2 → 02, 11 → 11

2. `feature_title` — human readable title in Title Case
   - Example: "Registration" or "Change Password"

3. `feature_slug` — git and file-safe slug
   - Lowercase, kebab-case
   - Only a-z, 0-9 and -
   - Maximum 40 characters
   - Example: registration, change-password

4. `branch_name` — format: `feature/<feature_slug>`
   - Example: `feature/registration`

If you cannot infer these from $ARGUMENTS, ask the user to clarify before proceeding.

## Step 3 — Check branch name is not taken
Run `git branch` to list existing branches.
If `branch_name` is already taken, append a number:
`feature/registration-01`, `feature/registration-02` etc.

## Step 4 — Switch to main and pull latest
Run:
```
git checkout main
git pull origin main
```

## Step 5 — Create and switch to the feature branch
Run:
```
git checkout -b <branch_name>
```

## Step 6 — Research the codebase
Read these files before writing the spec:
- `CLAUDE.md` — architecture, conventions, implemented vs stub routes
- `Backend/app/account/routers.py` — existing routes
- `Backend/app/account/models.py` — existing DB models
- `Backend/app/account/services.py` — existing business logic
- `Backend/app/account/schemas.py` — existing Pydantic schemas
- `Frontend/src/App.jsx` — existing React routes
- `Frontend/src/context/AuthContext.jsx` — auth interface pages must use
- All files in `.claude/specs/` — avoid duplicating existing specs

## Step 7 — Write the spec
Generate a spec document with this exact structure:

---
# Spec: <feature_title>

## Overview
One paragraph describing what this feature does and why it exists at this
stage of the Auth System.

## Depends on
Which previous steps / features this feature requires to be complete.

## Backend routes
Every new or modified backend route:
- `METHOD /account/path` — description — access level (public / authenticated / admin)

If no new routes: state "No new routes".

## Backend files to change
List every backend file that will be modified, with a one-line reason.

## Backend files to create
List every new backend file that will be created.

## Database changes
Any new models, columns, or constraints.
If none: state "No database changes".

## Frontend routes
Every new or modified React Router route:
- `<Route path="/path">` — maps to which page component

If no new routes: state "No new frontend routes".

## Frontend files to change
List every frontend file that will be modified, with a one-line reason.

## Frontend files to create
List every new frontend file that will be created (page or component).

## New dependencies
Any new packages (`uv add` for backend, `npm install` for frontend).
If none: state "No new dependencies".

## Rules for implementation
Specific constraints for this feature. Always include:
- Async everywhere
- Use annotated dependency for DB access 
- Password hashed
- Raise `HTTPException(status_code=..., detail="...")` for all client errors
- Frontend: function components + hooks only; Tailwind for styling; no CSS files
- Frontend: surface errors/success 
- Do not implement other stub routes unless this task explicitly targets them

## Expected behaviour
For every new or modified route, document the API contract:
- **Request**: method, path, auth required, body/query params and their types
- **Success response**: status code, response body shape
- **Error responses**: status code + `detail` string for each failure case
  (e.g. wrong credentials, expired token, duplicate email, missing fields)

Example format:
```
POST /account/reset-password
  Request:  query param `token: str`, query param `new_password: str`
  200 OK:   { "message": "Password reset successful" }
  400:      "Invalid or expired token"
  400:      "Token type mismatch"
```

## Definition of done
A specific, testable checklist. Each item must be verifiable by running the app.
---

## Step 8 — Save the spec
Save to: `.claude/specs/<step_number>-<feature_slug>.md`

## Step 9 — Report to the user
Print a short summary in this exact format:
```
Branch:    <branch_name>
Spec file: .claude/specs/<step_number>-<feature_slug>.md
Title:     <feature_title>
```

Then tell the user:
"Review the spec at `.claude/specs/<step_number>-<feature_slug>.md`
then enter Plan Mode with Shift+Tab twice to begin implementation."

Do not print the full spec in chat unless explicitly asked.