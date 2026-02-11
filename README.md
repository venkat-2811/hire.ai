# Talent Scout AI - AI-Powered Interview & Hiring Platform

An intelligent hiring platform that automates resume screening, generates adaptive interview questions, evaluates candidate responses, and provides explainable AI-driven hiring recommendations.

## Features

- **Semantic Resume Parsing**: AI-powered extraction of skills, experience, and qualifications from PDF/DOCX resumes
- **Explainable ATS Screening**: Transparent scoring with detailed reason codes for shortlisting decisions
- **Adaptive Question Generation**: Role-specific, JD-driven interview questions that adapt to candidate profiles
- **AI Response Evaluation**: Automated scoring of technical and behavioral responses with detailed feedback
- **Practical Assessments**: Role-specific coding/analysis tasks with AI evaluation
- **AI Voice Interview**: Speech-based AI interviews with real-time transcription
- **Basic Proctoring**: Tab switch detection, copy-paste monitoring, and integrity scoring
- **Analytics Dashboard**: Real-time hiring metrics and candidate insights

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and production builds
- **TailwindCSS** + **shadcn/ui** for styling
- **Clerk** for authentication
- **React Query** for data fetching
- **Framer Motion** for animations

### Backend
- **Python FastAPI** for REST API
- **Google Gemini** for AI services
- **Supabase** for database
- **Clerk** for JWT authentication
- **Resend** for transactional emails
- **AssemblyAI** for speech-to-text
- **Pydantic** for data validation

## Project Structure

```
talent-scout-ai/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── hooks/              # React Query hooks and auth
│   ├── integrations/       # Supabase client
│   ├── lib/                # API client and utilities
│   ├── pages/              # Page components
│   └── types/              # TypeScript types
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── auth/           # Clerk JWT verification
│   │   ├── models/         # Pydantic schemas and enums
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # AI service implementations
│   │   └── database/       # Supabase client
│   ├── requirements.txt    # Python dependencies
│   └── run.py              # Server entry point
├── supabase/               # Database migrations and edge functions
├── vercel.json             # Vercel deployment config
└── .env.example            # Frontend environment template
```

---

## Deployment Guide

### Architecture Overview

This project uses a **split deployment** model:
- **Frontend** (React/Vite) → **Vercel**
- **Backend** (FastAPI/Python) → **Railway / Render / Fly.io** (any Python host)

### Step 1: Deploy the Backend

The FastAPI backend must be deployed to a Python-compatible hosting platform.

#### Option A: Railway (Recommended)

1. Push the `backend/` folder to a separate repo or use Railway's monorepo support
2. Set the root directory to `backend/`
3. Railway will auto-detect Python and use `requirements.txt`
4. Set the start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `backend/.env.example`

#### Option B: Render

1. Create a new **Web Service** on Render
2. Set root directory to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `backend/.env.example`

#### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint | Yes |
| `CLERK_ISSUER` | Clerk issuer URL | Yes |
| `RESEND_API_KEY` | Resend API key for emails | Yes |
| `RESEND_FROM_EMAIL` | Sender email address | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI key for speech-to-text | Yes |
| `FRONTEND_URL` | Your Vercel frontend URL | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins (include your Vercel URL) | Yes |
| `PORT` | Server port (auto-set by most hosts) | No |
| `DEBUG` | Set to `false` in production | No |

### Step 2: Deploy the Frontend on Vercel

1. **Import your repository** on [vercel.com](https://vercel.com)
2. Vercel will auto-detect the Vite framework
3. **Set environment variables** in Vercel project settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Your deployed backend URL | `https://your-backend.railway.app` |
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | `eyJ...` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | `omqjtvqtawduwesbmmgm` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_test_...` |

4. **Deploy** — Vercel will run `npm run build` and serve the `dist/` folder
5. The `vercel.json` handles SPA routing (all paths → `index.html`)

### Step 3: Post-Deployment Configuration

1. **Update backend CORS**: Add your Vercel URL to `CORS_ORIGINS` env var on your backend host
2. **Update backend FRONTEND_URL**: Set to your Vercel URL (used in email links)
3. **Update Clerk**: Add your Vercel domain to Clerk's allowed redirect URLs in the Clerk dashboard
4. **Test**: Visit your Vercel URL and verify all features work

---

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Supabase account
- Google Gemini API key
- Clerk account

### 1. Clone and Install Frontend

```bash
git clone <repository-url>
cd talent-scout-ai
npm install
```

### 2. Configure Frontend Environment

Copy `.env.example` to `.env` and fill in values:

```env
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

### 3. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Backend Environment

Copy `backend/.env.example` to `backend/.env` and fill in values.

### 5. Setup Database

```bash
supabase db push
```

Or manually run the SQL migrations from `supabase/migrations/`.

### 6. Run the Application

**Start Backend:**
```bash
cd backend
python run.py
```

**Start Frontend (in a new terminal):**
```bash
npm run dev
```

Access the application at `http://localhost:8080`

## API Endpoints

### Jobs
- `GET /jobs` - List all jobs
- `POST /jobs` - Create a job
- `GET /jobs/{id}` - Get job details
- `PATCH /jobs/{id}` - Update job
- `DELETE /jobs/{id}` - Archive job

### Candidates
- `GET /candidates` - List candidates
- `POST /candidates` - Create candidate with resume
- `GET /candidates/{id}` - Get candidate details
- `GET /candidates/{id}/parsed-resume` - Get parsed resume data

### Applications (Public)
- `GET /apply/job/{id}` - Get public job details
- `POST /apply/submit` - Submit job application

### Screening
- `POST /screening/run` - Run ATS screening
- `GET /screening/candidate/{id}` - Get screening results
- `GET /screening/job/{id}` - Get screenings for a job

### Assessments
- `POST /assessments/invite` - Send assessment invitation
- `GET /assessments/{token}` - Load assessment session
- `POST /assessments/{token}/submit` - Submit assessment

### AI Interview
- `POST /ai-interview/invite` - Send interview invitation
- `GET /ai-interview/{token}` - Load interview session

### Analytics
- `GET /analytics/dashboard` - Dashboard statistics
- `GET /analytics/candidates` - Candidate analytics
- `GET /analytics/job/{id}/summary` - Job summary
- `GET /analytics/trends` - Hiring trends

## Environment Variables Summary

### Frontend (Vercel)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | Yes |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | Yes |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |

### Backend (Railway/Render)

See `backend/.env.example` for the full list.

## Development

### Running Tests
```bash
# Frontend tests
npm test

# Watch mode
npm run test:watch
```

### Code Style
- Frontend: ESLint + TypeScript
- Backend: Python type hints + Pydantic validation

## License

MIT License
