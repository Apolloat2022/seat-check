# Seat Check

A phone seating chart for taking attendance. Teachers tap students as they walk in, mark the bell,
and copy the short Absent / Tardy list to enter in Skyward.

## Student privacy

Student names and seating charts are saved **only in each teacher's own browser**. They are never
sent to the server. The server only checks usernames and passwords. Each teacher should use the
app on their own device, and use **Backup and restore** in the app to keep a copy of their rosters.

## Deploy on Vercel

1. Import this repo in Vercel. Framework preset: **Other**. No build command.
2. Add the environment variable `TEACHER_ACCOUNTS` (see below), then redeploy.

## Add or remove a teacher

Run this on your computer (Node 20+):

```
node scripts/add-teacher.mjs jsmith their-password
```

It prints one line like `jsmith:1b2c…:9f8e…`. The password itself is not stored, only a hash.
`TEACHER_ACCOUNTS` holds all the lines, separated by commas:

```
jsmith:…:…,mlopez:…:…
```

Update it in Vercel → Project → Settings → Environment Variables, then redeploy.
To remove a teacher, delete their entry. To reset a password, replace their entry.

Tip: the password you type ends up in your terminal history. Clear it afterwards if the computer is shared.

## Check the login code

```
node scripts/check-login.mjs
```
