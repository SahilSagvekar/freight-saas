# Running Harborline live

## Environment variables

| Name | Needed | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | The **app** role (`freight_app`, no BYPASSRLS). Every tenant query uses it. |
| `ADMIN_DATABASE_URL` | yes | The table **owner**. Login, provisioning, team changes, migrations. Must differ from `DATABASE_URL`. |
| `SESSION_SECRET` | yes | 32+ random characters. `openssl rand -base64 48` |
| `APP_URL` | yes | Public `https://` address. Used in one-time links and emails. |
| `SENTRY_DSN` | no | Turns on error reporting. Works with Sentry or GlitchTip. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Turns on email (invites, password reset) over SMTP. `SMTP_HOST` and `MAIL_FROM` are the minimum; port defaults to 587. Without them, links are shown on screen. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | no | Turns on subscription billing. |
| `PLATFORM_ADMIN_EMAILS` | no | Comma-separated emails allowed into `/admin`. |

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

## Platform admin (`/admin`)

Set `PLATFORM_ADMIN_EMAILS` to your email. Sign in normally with that email and open `/admin`. You see operators with counts and billing state; you can extend a trial, comp or un-comp an operator, suspend, and generate a one-time owner sign-in link. You cannot read bookings or passengers, and there is no impersonation. Keep sign-ups email-verified (see below) so nobody can claim an admin address before you do.

## When a setup email doesn't arrive

If sending fails, the server logs `mail: send failed <the mail server's reply>`. Typical causes: a wrong `SMTP_USER`/`SMTP_PASS` (most providers need an app password, not your normal one), a wrong port (587 for STARTTLS, 465 with `SMTP_SECURE=true`), or a `MAIL_FROM` your provider doesn't allow (use the address you log in with). To try it without redeploying, set the `SMTP_*` variables and `MAIL_FROM` in your terminal and run `npm run mail:test -- --to you@example.com`; it prints the server's exact answer. After fixing it, the person can use "Forgot password" on the sign-in page. To hand someone a link directly:

```bash
npm run owner:link -- --email maya@example.com    # needs ADMIN_DATABASE_URL, SESSION_SECRET and APP_URL set
```

The link works once and expires in 72 hours. Sign-up never shows the link on screen when email is set up, so nobody can claim a workspace under an address they don't own.

## Sign-ups

`/signup` creates an operator on a 14-day trial and emails the owner a link to choose a password. In production it stays **closed unless email is configured** (`SMTP_HOST`, `MAIL_FROM`), because without email the address can't be verified. `ALLOW_UNVERIFIED_SIGNUP=1` overrides that; don't, unless you accept anyone can create a workspace under any address. There is no CAPTCHA yet: a hidden honeypot field and per-IP/email throttles are the only bot protection.

## More environment variables

| Name | What it does |
| --- | --- |
| `CRON_SECRET` | Authorises the scheduled hold-expiry call. Also a repo secret for `cron.yml`. |
| `DEMO_URL` | Where the landing page's "Try the live demo" goes. Leave unset to show "Ask for a demo". |
| `CONTACT_EMAIL` | Shown on the landing page, terms and privacy pages. |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_OPERATOR`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET` | See the Stripe setup above. |

## The demo site

Run a **second deployment with its own database** and seed it there (`npm run seed` is refused on any non-local database unless you set the explicit demo flags, see the README). Point `DEMO_URL` at it. Never share a database between demo and live.

## Automatic deploys (push to `main` goes live)

`.github/workflows/ci.yml` runs lint, typecheck, tests and a build on every push and pull request. For pushes to
`main` that pass, a second job connects to the server over SSH and runs `scripts/deploy.sh`, which:

1. fetches the exact commit that was tested and resets the server checkout to it,
2. runs `npm ci` and `npm run build`,
3. applies database migrations (`src/db/migrate.ts`, using `.env`),
4. reloads the app with `pm2 reload`, then waits for `/api/health` to answer.

If any step fails, the previous code is rebuilt and reloaded and the GitHub job fails. Database changes are not
undone, so write migrations that old code can live with (add columns and tables; do not rename or drop in the same release).

### One-time setup

On the server (as the user that owns `~/freight-saas`):

```bash
ssh-keygen -t ed25519 -N "" -C "github-deploy" -f ~/.ssh/gh_deploy
# Lock the key to the deploy script: it can run nothing else.
echo "command=\"/bin/bash $HOME/freight-saas/scripts/deploy.sh\",no-port-forwarding,no-agent-forwarding,no-pty,no-X11-forwarding $(cat ~/.ssh/gh_deploy.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/gh_deploy                     # copy this private key into the DEPLOY_SSH_KEY secret, then:
shred -u ~/.ssh/gh_deploy ~/.ssh/gh_deploy.pub
echo "SERVER_IP $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"   # DEPLOY_KNOWN_HOSTS value
```

In GitHub: Settings → Environments → New environment `production` (optionally add yourself as a required reviewer
to approve each deploy), then add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the server's IP address |
| `DEPLOY_USER` | the SSH user that owns `~/freight-saas` |
| `DEPLOY_SSH_KEY` | the private key printed above, including the BEGIN and END lines |
| `DEPLOY_KNOWN_HOSTS` | the `SERVER_IP ssh-ed25519 AAAA...` line printed above |

Deploy by hand with `bash scripts/deploy.sh` (add `FORCE=1` to redeploy the same commit). The log is `~/deploy.log`.
To stop automatic deploys, delete the `deploy` job or disable the workflow in the Actions tab.
