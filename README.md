# CA Portal — Invoice & Document Management

STPI SOFTEX invoice generator. Upload a Deel PDF → get your GSTIN-compliant invoice.

---

## Local Development

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in .env values (see below)

python run.py
# Runs on http://localhost:5001
```

**.env values to fill:**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/ca_portal
                          # or leave as sqlite:///ca_portal.db for local dev
SECRET_KEY=any-long-random-string
PORTAL_PASSWORD=password-your-CA-will-use
OPENAI_API_KEY=sk-proj-...
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend

```bash
cd frontend
npm install

# For local dev (proxies /api to localhost:5001 automatically)
npm run dev
# Runs on http://localhost:5173
```

---

## Deploy to Production

### Backend → Render (free)

Render's free web service + [Neon](https://neon.tech) free PostgreSQL = $0/month forever.

#### Step 1 — Get a free Neon database

1. Sign up at [neon.tech](https://neon.tech) (free, no credit card)
2. Create a project → copy the **Connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

#### Step 2 — Deploy on Render

1. Push the repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint → select this repo
   - Render auto-detects `render.yaml` and sets up the free web service
3. Fill in the environment variables when prompted:
   ```
   DATABASE_URL      → paste your Neon connection string from Step 1
   PORTAL_PASSWORD   → your chosen password
   OPENAI_API_KEY    → from platform.openai.com/api-keys
   FRONTEND_URL      → https://your-app.vercel.app
   ```
   (`SECRET_KEY` is auto-generated)
4. Click **Apply**. First deploy takes ~5 min (installs system libs for WeasyPrint).
5. Note your Render URL: `https://ca-portal-backend.onrender.com`

> **Note:** Render's free web service spins down after 15 min of inactivity — first request
> after idle takes ~30s to wake up. This is fine for a personal CA portal.

#### Manual setup (without Blueprint)

If you prefer to configure manually instead of using the Blueprint:

1. New → Web Service → connect repo, set **Root Directory** to `backend`
2. Build Command: `bash build.sh`
3. Start Command: `gunicorn run:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. Add a PostgreSQL database from the dashboard and link it
5. Add environment variables as above

---

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set Root Directory to `frontend`
3. Add environment variable:
   ```
   VITE_API_URL = https://ca-portal-backend.onrender.com/api
   ```
4. Deploy. Done.
5. Share the Vercel URL with your CA.

---

## Usage Flow

1. Your CA opens the Vercel URL
2. Enters the portal password
3. Uploads the Deel invoice PDF
4. AI parses all fields automatically
5. CA reviews/edits any fields if needed
6. Clicks "Preview Invoice PDF" → reviews the generated invoice
7. Clicks "Download Invoice"
8. Invoice is ready for STPI SOFTEX upload

---

## Admin Panel

Go to `/admin` to update:
- Your name, address, GSTIN, PAN
- Bank details (IFSC, SWIFT for wire transfers)
- Invoice number prefix
- Footer notes
- Logo & signature images

---

## Future Roadmap (already structured for)

- [ ] Invoice history & tracking (add `Invoice` model to DB)
- [ ] Document vault with global search
- [ ] Auto tax calculation per FY
- [ ] Multi-client support (add `User` model, per-user settings)
- [ ] Email invoice directly to client

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Flask 3 + SQLAlchemy |
| Database | PostgreSQL (SQLite for local dev) |
| PDF Parse | OpenAI gpt-4o-mini + PyMuPDF |
| PDF Generate | WeasyPrint + Jinja2 |
| Auth | JWT (simple password) |
| Deploy | Vercel (FE) + Render (BE) |
