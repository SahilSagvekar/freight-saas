# Running Harborline live

## Environment variables

| Name | Needed | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | The **app** role (`freight_app`, no BYPASSRLS). Every tenant query uses it. |
| `ADMIN_DATABASE_URL` | yes | The table **owner**. Login, provisioning, team changes, migrations. Must differ from `DATABASE_URL`. |
| `SESSION_SECRET` | yes | 32+ random characters. `openssl rand -base64 48` |
| `APP_URL` | yes | Public `https://` address. Used in one-time links and emails. |
| `SENTRY_DSN` | no | Turns on error reporting. Works with Sentry or GlitchTip. |
| `RESEND_API_KEY`, `MAIL_FROM` | no | Turns on email (invites, password reset). Without them, links are shown on screen. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | no | Turns on subscription billing. |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated emails allowed into `/admin`. When set in production, `PLATFORM_ADMIN_TOTP_SECRET` is required too (the server refuses to start without it). |
| `PLATFORM_ADMIN_TOTP_SECRET` | with admins | Second factor for `/admin`. Create it with `npm run admin:2fa -- you@example.com`. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | recommended | Cloudflare Turnstile CAPTCHA for sign-up and the inquiry form. Set both or neither. In production, sign-up stays closed until they are set. |
| `CLIENT_IP_HEADER`, `TRUSTED_PROXY_HOPS` | depends on host | Where rate limits read the visitor's IP from. See "Rate limits and visitor IPs" below. |

In production the server **refuses to start** if a required value is missing or unsafe.

## Deploying

1. `npm run db:migrate` with `ADMIN_DATABASE_URL` set (applies migrations and the app role's privileges).
2. Start the app. Check `GET /api/health` returns `{"ok":true}`.
3. Create the first operator: `npm run tenant:create -- --name "..." --owner-name "..." --email ...` (add `--kind freight` for a freight forwarder).
   This release adds migrations 5 to 8 (inquiries, workspace kind, shipments, quotes and invoices). They only add tables and one column with a default, so existing ferry operators are unaffected.

## Backups

`.github/workflows/backup.yml` dumps the database every night, encrypts it with `BACKUP_PASSPHRASE` and uploads it
to your bucket. Add the secrets listed at the top of that file, then run it once by hand (Actions → Database backup → Run).

**A backup you have never restored is a hope, not a backup.** Do this drill after the first run and every quarter:

```bash
export BACKUP_PASSPHRASE=...        # the same one
aws s3 cp s3://YOUR_BUCKET/postgres/<latest>.dump.gpg .     # add --endpoint-url for R2/B2
createdb restore_check
scripts/restore.sh <latest>.dump.gpg postgres://localhost/restore_check
```

Then open the restored database and check that last night's bookings are there.

Keep the passphrase in a password manager, **not** in the bucket. Lose it and the backups cannot be opened.
Set a lifecycle rule on the bucket to delete dumps after 30 days.

## Monitoring

- Uptime: point any monitor (UptimeRobot, Better Stack) at `/api/health`.
- Errors: set `SENTRY_DSN`. Server and browser errors are sent without cookies, form data or query strings.

## Money: subscriptions and ticket payments

Two separate flows, deliberately:

- **Subscriptions** are charged to *your* Stripe account (the platform).
- **Ticket payments** are charged to each *operator's own* Stripe account (Stripe Connect, "Standard" accounts, direct charges), so ticket money never passes through you.

### One-time Stripe setup

1. **Products.** Create two monthly prices matching `src/lib/plans.ts` (Starter, Operator). Put their ids in `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_OPERATOR`. Put your secret key in `STRIPE_SECRET_KEY`.
2. **Webhook for subscriptions.** Developers → Webhooks → add `https://YOUR_APP/api/stripe/webhook`, listening to
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   Its signing secret is `STRIPE_WEBHOOK_SECRET`.
   The app accepts subscription events only from your own account: events arriving through the Connect endpoint are ignored unless they are ticket payments, because operators control their own Stripe accounts.
3. **Connect.** Settings → Connect: enable it, choose "Standard", and set the OAuth redirect URI to `https://YOUR_APP/api/stripe/connect/callback`. Copy the client id (`ca_…`) into `STRIPE_CONNECT_CLIENT_ID`.
4. **Webhook for operators' payments.** Add a *second* endpoint, same URL, with **"Listen to events on Connected accounts"** ticked, for
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Its signing secret is `STRIPE_CONNECT_WEBHOOK_SECRET`.
5. Use Stripe's test mode first: `4242 4242 4242 4242`, then repeat with live keys.

### What happens when someone doesn't pay

| State | What the operator can do |
| --- | --- |
| Trial (14 days, no card) | Everything. Banner shows days left. |
| Trial ended / subscription ended | Look and export only. Selling, editing and the offline sync are switched off until they subscribe. |
| Payment failed | Everything for 7 days (banner + email), then read-only. |
| Suspended by you in `/admin` | Locked out completely. |

Their data is never deleted for non-payment.

### Money that arrives after a hold expires

An online booking waiting for card payment holds its seats for 35 minutes, then `/api/cron/expire-holds` (run every 10 minutes by `.github/workflows/cron.yml`) cancels it. If the customer pays after that, the payment is **not** attached to the cancelled booking; an audit entry `payment.orphaned` is recorded and the operator should refund it in Stripe.

## Rate limits and visitor IPs

Sign-in, sign-up, password reset and the public forms are rate limited per visitor IP, and sign-in also has a limit per email address that ignores the IP (30 attempts an hour), so rotating addresses doesn't help a password guesser. A side effect is that someone who knows an email can briefly lock that person out of sign-in; that is the intended trade.

The app reads the IP from a header your host controls, never from the left-most `x-forwarded-for` entry, which any visitor can forge:

- Behind **Cloudflare**: set `CLIENT_IP_HEADER=cf-connecting-ip`.
- On **Vercel** or behind a single reverse proxy: nothing to set (the right-most `x-forwarded-for` entry is used). Hosts differ, so confirm with the check below.
- Two proxies in front of the app (for example Cloudflare then a load balancer): set `TRUSTED_PROXY_HOPS=2`.

If every visitor shows up as the same address, the setting is wrong: the limits would then be shared by everyone. Check after deploying: enter a wrong password 9 times for one email from your laptop, then try the same email from your phone on mobile data. The phone should still be allowed to try; if it is blocked too, the setting is wrong.

## Platform admin (`/admin`)

Set `PLATFORM_ADMIN_EMAILS` to your email. Sign in normally with that email and open `/admin`.

**Two-factor.** In production `/admin` also asks for a 6-digit code from an authenticator app (1Password, Google Authenticator, Authy and so on). Set it up once:

1. Run `npm run admin:2fa -- you@example.com`. It prints a setup key.
2. In your authenticator app choose "enter a setup key" and paste it. Check that the code the script prints matches what the app shows.
3. Set `PLATFORM_ADMIN_TOTP_SECRET` to the key on the server and redeploy. Keep it out of git and chat.

After a correct code the console opens for 12 hours in that browser. Signing out, signing in again or "sign out everywhere" asks for a code again. Five wrong codes lock the attempt for 15 minutes. If you lose the authenticator, create a new secret with the same script and redeploy. Without a valid secret in production the console shows a 404 and the reason is logged.

What the console shows: operators with counts and billing state; you can extend a trial, comp or un-comp an operator, suspend, and generate a one-time owner sign-in link. You cannot read bookings or passengers, and there is no impersonation. Keep sign-ups email-verified (see below) so nobody can claim an admin address before you do.

## When a setup email doesn't arrive

If sending fails, the server logs `mail: provider refused <status> <Resend's message>` (or `mail: send failed`). A `403`/`422` usually means `MAIL_FROM` uses a domain you haven't verified in Resend; `401` means a wrong `RESEND_API_KEY`. To try it without redeploying, set `RESEND_API_KEY` and `MAIL_FROM` in your terminal and run `npm run mail:test -- --to you@example.com`; it prints Resend's exact answer. After fixing it, the person can use "Forgot password" on the sign-in page. To hand someone a link directly:

```bash
npm run owner:link -- --email maya@example.com    # needs ADMIN_DATABASE_URL, SESSION_SECRET and APP_URL set
```

The link works once and expires in 72 hours. Sign-up never shows the link on screen when email is set up, so nobody can claim a workspace under an address they don't own.

## Sign-ups

`/signup` creates an operator on a 14-day trial and emails the owner a link to choose a password. In production it stays **closed unless email is configured** (`RESEND_API_KEY`, `MAIL_FROM`), because without email the address can't be verified. `ALLOW_UNVERIFIED_SIGNUP=1` overrides that; don't, unless you accept anyone can create a workspace under any address. Bot protection: Cloudflare Turnstile (set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; in production sign-up stays closed without them), plus a hidden honeypot field and per-IP/email throttles. The website inquiry form uses the same Turnstile keys; without them it falls back to the honeypot and throttles and logs a warning.

## More environment variables

| Name | What it does |
| --- | --- |
| `CRON_SECRET` | Authorises the scheduled hold-expiry call. Also a repo secret for `cron.yml`. |
| `DEMO_URL` | Where the landing page's "Try the live demo" goes. Leave unset to show "Ask for a demo". |
| `CONTACT_EMAIL` | Shown on the landing page, terms and privacy pages. |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_OPERATOR`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` | See the Stripe setup above. |

## The demo site

Run a **second deployment with its own database** and seed it there (`npm run seed` is refused on any non-local database unless you set the explicit demo flags, see the README). Point `DEMO_URL` at it. Never share a database between demo and live.
