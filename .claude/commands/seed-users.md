---
description: Create the dummy user in the database
argument-hint: <no_of_users>
allowed-tools: Read, Bash(python:*)
---

Read Backend/app/account/models.py to understand the users table 
schema and read Backend/app/db/config.py to get the async_session.

User input: $ARGUMENTS

Extract from $ARGUMENTS:
- no_of_users — integer


If this argument is missing:- consider no_of_users = 1
    
And if this is not a valid integer, stop and say:
"Usage: /seed-users <no_of_users>
Example: /seed-users 2"

Then write and run a Python script using Bash that:

1. Generates a realistic random Indian user using your 
   own knowledge of common Indian names across regions:
   - name: a realistic Indian first + last name
   - email: derived from the name with a random 2-3 digit 
     number suffix (e.g. rahul.sharma91@gmail.com)
   - hashed_password: "pass123" hashed with hashed_password() function in utils.py
   - is_active: default to True
   - is_verified: default to False
   - is_admin: default to False
   - created_at: current datetime
   - updated_at: current datetime

2. Checks if the generated email already exists in the 
   users table. If it does, regenerate until unique.

3. Inserts the user into the database using the same 
   async_session pattern found in config.py.

4. Prints confirmation:
   - id
   - name
   - email