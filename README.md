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
# Runs on http://localhost:5000
```

**.env values to fill:**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/ca_portal
                          # or leave as sqlite:///ca_portal.db for local dev
SECRET_KEY=any-long-random-string
PORTAL_PASSWORD=password-your-CA-will-use
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend

```bash
cd frontend
npm install

# For local dev (proxies /api to localhost:5000 automatically)
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Deploy to Production

### Backend → Railway

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the `backend/` folder (or set Root Directory to `backend`)
4. Add a PostgreSQL plugin in Railway
5. Set environment variables:
   ```
   DATABASE_URL        → (Railway auto-fills this from the Postgres plugin)
   SECRET_KEY          → generate with: python -c "import secrets; print(secrets.token_hex(32))"
   PORTAL_PASSWORD     → your chosen password
   ANTHROPIC_API_KEY   → from console.anthropic.com
   FRONTEND_URL        → https://your-app.vercel.app
   ```
6. Deploy. Railway auto-detects the Procfile.
7. Note your Railway URL: `https://your-app.railway.app`

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set Root Directory to `frontend`
3. Add environment variable:
   ```
   VITE_API_URL = https://your-app.railway.app/api
   ```
4. Deploy. Done.
5. Share the Vercel URL with your CA.

---

## Usage Flow

1. Your CA opens the Vercel URL
2. Enters the portal password
3. Uploads the Deel invoice PDF
4. Claude AI parses all fields automatically
5. CA reviews/edits any fields if needed
6. Clicks "Generate & Download Invoice PDF"
7. Invoice is ready for STPI SOFTEX upload

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
| PDF Parse | Anthropic Claude API |
| PDF Generate | WeasyPrint + Jinja2 |
| Auth | JWT (simple password) |
| Deploy | Vercel (FE) + Railway (BE) |
