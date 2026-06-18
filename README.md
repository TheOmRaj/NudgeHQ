# NudgeHQ — Your workflow, automated.

> Built for the **ChaiCode × Corsair Hackathon** | [Live Demo](https://nudgehq.tech) | [Demo Video](https://youtube.com/watch?v=TODO)

NudgeHQ turns your inbox into an intelligent workflow engine. When an email arrives, NudgeHQ automatically creates tasks, drafts replies, blocks calendar time, and notifies your team — powered by Corsair's self-hosted integration SDK.

---

## The Problem

Every founder and operator drowns in email. You miss follow-ups, double-book meetings, lose attachments, and forget to reply. Each email needs a Todoist task, a Gmail draft, a calendar block, and a Slack nudge. You do all of that manually. Every single time.

## The Solution

NudgeHQ automates those 4 actions in one click — or automatically via real-time Gmail Pub/Sub webhooks.

---

## Features

### Core
- **4-pane dashboard** — Inbox · Email detail · Calendar · Flows
- **Real Gmail inbox** via Corsair SDK — fetches, reads, drafts, marks read
- **Real Google Calendar** — lists today's events, auto-blocks time
- **AI priority filtering** — Groq `llama-3.3-70b` batch-classifies emails as urgent/normal/low on load
- **⌘K Agent** — Groq-powered chat agent with full inbox context
- **Keyboard shortcuts** — j/k nav, r run flow, u toggle read, c agent, 1-3 views, esc

### Automation Flows
| Flow | Trigger | Actions |
|------|---------|---------|
| **Flow 1** — Inbound Email | New client email | Todoist task + Gmail draft + Calendar block + Slack notify |
| **Flow 2** — Follow-up Tracker | No reply after N days | Notion log + Calendar reminder + Gmail follow-up draft + Slack |
| **Flow 3** — Conflict Resolver | Meeting invite detected | Calendar conflict check + Notion log + Gmail reschedule draft + Slack |
| **Flow 4** — Attachment Handler | Email with attachment | Gmail fetch + Google Drive save + Slack notify |

### Bonus Tasks Completed
- ✅ AI priority filtering (Groq batch classification)
- ✅ Corsair search API (debounced, replaces client-side filter)
- ✅ Gmail Pub/Sub webhooks (real-time Flow 1 auto-trigger)
- ✅ Keyboard shortcuts (j/k, r, u, c, 1-3, esc)
- ✅ Agent chat (⌘K with Groq + inbox context)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router, Turbopack) |
| API | tRPC v11 |
| Database | Drizzle ORM + Neon PostgreSQL |
| Auth | Clerk (Google OAuth) |
| Integrations | Corsair self-hosted SDK v0.1.76 |
| AI | Groq `llama-3.3-70b-versatile` |
| Deployment | ExC (Chaicode Cloud) + Nginx + PM2 |
| Domain | nudgehq.tech (Hostinger) |

---

## Corsair Integrations

All integrations are powered by the **Corsair self-hosted SDK** with full multi-tenancy — each user connects their own OAuth account:

- **Gmail** — list, get, draft, mark read, search, Pub/Sub watch
- **Google Calendar** — list events, create events
- **Google Drive** — save attachments
- **Slack** — post notifications
- **Notion** — log follow-ups and conflicts
- **Todoist** — create tasks
- **HubSpot** — CRM integration ready

### Multi-Tenant OAuth Flow
1. New user signs in with Clerk
2. Redirected to `/connect` page
3. Connects Gmail → Google Calendar → Google Drive via OAuth
4. Tokens stored encrypted per-tenant in PostgreSQL (Corsair's DEK/KEK system)
5. All API calls scoped to `corsair.withTenant(userId)`

---

## Architecture

```
User → Clerk Auth → Dashboard
                        ↓
              tRPC (protectedProcedure)
                        ↓
           Corsair SDK (withTenant(userId))
                        ↓
        Gmail · Calendar · Drive · Slack · Notion · Todoist

Gmail Pub/Sub → /api/webhooks/gmail → Flow 1 (auto-trigger)
```

---

## Running Locally

```bash
git clone https://github.com/TheOmRaj/NudgeHQ
cd NudgeHQ
pnpm install
```

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=
CORSAIR_KEK=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GROQ_API_KEY=
SLACK_CHANNEL_ID=
SLACK_BOT_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
pnpm dev
```

Visit `http://localhost:3000/connect` to connect your Google account.

---

## Deployment

- **Server:** ExC VM (Ubuntu 24.04, 2 vCPU, 2GB RAM)
- **Process:** PM2
- **Proxy:** Nginx reverse proxy
- **SSL:** Let's Encrypt (auto-renews)

```bash
git pull && pnpm build && pm2 restart nudgehq
```

---

## Built By

**Om Raj** — [@TheOmRaj](https://github.com/TheOmRaj)  
CSE Undergraduate, Rungta College of Engineering and Technology  
ChaiCode × Corsair Hackathon 2026
