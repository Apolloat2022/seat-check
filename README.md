# Seat Check

A phone seating chart for taking attendance. Teachers tap students as they walk in, mark the bell,
and copy the short Absent / Tardy list to enter in Skyward.

## Who can sign in

Anyone with an **@annaisd.org** school Google account. Teachers tap **Sign in with Google** and stay
signed in for 30 days. There are no accounts to create.

## Student privacy

Student names and seating charts are saved **only in each teacher's own browser**. They are never
sent to the server. The server only learns the teacher's school email from Google.
Each teacher should use the app on their own device and use **Backup and restore** to keep a copy.

## Setup

### 1. Google (one time)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project named "Seat Check".
2. **APIs & Services → OAuth consent screen**: choose **External**, app name "Seat Check", add your email. Publish the app.
3. **Credentials → Create credentials → OAuth client ID**: type **Web application**.
   Authorized redirect URI: `https://seat-check-smoky.vercel.app/auth/callback`
   (add one for any custom domain too).
4. Copy the **Client ID** and **Client Secret**.

If the district blocks outside apps, district IT has to allow Seat Check in the Google Workspace
admin console before teachers can sign in.

### 2. Vercel environment variables (Production)

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `SESSION_SECRET` | a long random string: `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"` |
| `ALLOWED_DOMAIN` | optional, defaults to `annaisd.org` |

Redeploy after changing them. Changing `SESSION_SECRET` signs everyone out.

## Check the login code

```
node scripts/check-login.mjs
```
