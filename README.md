# Talent Scout AI - AI-Powered Interview & Hiring Platform

An intelligent hiring platform that automates resume screening, generates adaptive interview questions, evaluates candidate responses, and provides explainable AI-driven hiring recommendations.

## Features

- **Semantic Resume Parsing**: AI-powered extraction of skills, experience, and qualifications
- **Explainable ATS Screening**: Transparent scoring with detailed reason codes
- **Adaptive Question Generation**: Role-specific interview questions
- **AI Response Evaluation**: Automated scoring with detailed feedback
- **Practical Assessments**: Role-specific coding/analysis tasks
- **AI Voice Interview**: Speech-based AI interviews with transcription
- **Basic Proctoring**: Tab switch detection and integrity scoring
- **Analytics Dashboard**: Real-time hiring metrics and insights

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for development and builds
- **TailwindCSS** + **shadcn/ui** for styling
- **Clerk** for authentication
- **React Query** for data fetching

### Backend (Vercel Serverless Functions)
- **TypeScript** serverless functions
- **Google Gemini** for AI services
- **Supabase** for database & storage
- **Clerk** for JWT authentication
- **Resend** for transactional emails

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
├── api/                    # Vercel Serverless Functions
│   ├── _lib/               # Shared utilities (supabase, clerk, gemini)
│   ├── jobs.ts             # Jobs CRUD endpoints
│   ├── candidates.ts       # Candidates management
│   ├── screening.ts        # ATS screening
│   ├── analytics.ts        # Dashboard analytics
│   ├── apply.ts            # Public job applications
│   ├── assessments.ts      # Technical assessments
│   ├── interviews.ts       # Interview sessions
│   └── ai-interview.ts     # AI voice interviews
├── supabase/               # Database migrations
├── vercel.json             # Vercel deployment config
└── .env.example            # Environment variables template
```

---

## Deployment Guide (Vercel Only)

### Architecture Overview

This project is deployed **entirely on Vercel**:
- **Frontend** (React/Vite) → Vercel Static Hosting
- **Backend** (TypeScript) → Vercel Serverless Functions
- **Database** → Supabase (PostgreSQL)

### Step 1: Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations from `supabase/migrations/`
3. Create a storage bucket named `resumes` (public read access)
4. Copy your project URL and keys from Settings → API

### Step 2: Set Up Clerk

1. Create a new application at [clerk.com](https://clerk.com)
2. Enable Email/Password sign-in method
3. Copy your Publishable Key and JWKS URL
4. The JWKS URL format: `https://your-instance.clerk.accounts.dev/.well-known/jwks.json`

### Step 3: Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Vercel will auto-detect the Vite framework
4. Add the following environment variables:

#### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Yes |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `SUPABASE_URL` | Supabase project URL (for API) | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint | Yes |
| `CLERK_ISSUER` | Clerk issuer URL | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `RESEND_API_KEY` | Resend email API key | Yes |
| `FRONTEND_URL` | Your Vercel deployment URL | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI key (optional) | No |
| `RESEND_FROM_EMAIL` | Sender email address | No |

5. **Deploy** — Vercel will build and deploy automatically

### Step 4: Post-Deployment

1. **Update Clerk**: Add your Vercel domain to Clerk's allowed redirect URLs
2. **Test**: Visit your Vercel URL and verify all features work

---

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google Gemini API key
- Clerk account

### Setup

```bash
# Clone and install
git clone <repository-url>
cd talent-scout-ai
npm install

# Copy environment file
cp .env.example .env
# Fill in your values

# Run development server
npm run dev
```

Access the application at `http://localhost:5173`

**Note:** For local development, the API routes in `/api` won't work directly with Vite. You can either:
1. Deploy to Vercel for testing
2. Use `vercel dev` locally (requires Vercel CLI)

## API Endpoints

All endpoints are at `/api/*`:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/jobs` | GET, POST | List/create jobs |
| `/api/jobs/:jobId` | GET, PATCH, DELETE | Get/update/archive job |
| `/api/candidates` | GET, POST | List/create candidates |
| `/api/candidates/:candidateId` | GET, PATCH, DELETE | Get/update/delete candidate |
| `/api/candidates/:candidateId/parsed-resume` | GET | Parsed resume data |
| `/api/screening/run` | POST | Run ATS screening |
| `/api/screening/candidate/:candidateId` | GET | Screenings for candidate |
| `/api/screening/job/:jobId` | GET | Screenings for job |
| `/api/analytics/dashboard` | GET | Dashboard statistics |
| `/api/analytics/candidates` | GET | Candidate analytics |
| `/api/apply/job/:jobId` | GET | Public job details |
| `/api/apply/submit` | POST | Submit job application |
| `/api/assessments/invite` | POST | Send assessment invites |
| `/api/assessments/start/:token` | GET | Candidate starts assessment |
| `/api/assessments/:sessionId/mcq` | GET | Get MCQ questions |
| `/api/assessments/:sessionId/coding` | GET | Get coding challenges |
| `/api/assessments/:sessionId/mcq/submit` | POST | Submit MCQ answers |
| `/api/assessments/:sessionId/coding/submit` | POST | Submit coding solution |
| `/api/assessments/:sessionId/proctoring` | POST | Report proctoring event |
| `/api/assessments/:sessionId/complete` | POST | Complete assessment |
| `/api/ai-interview/invite` | POST | Send AI interview invites |
| `/api/ai-interview/start/:token` | GET | Candidate starts interview |
| `/api/ai-interview/:sessionId/question` | GET | Get current question |
| `/api/ai-interview/:sessionId/response` | POST | Submit response |
| `/api/ai-interview/:sessionId/proctoring` | POST | Report proctoring event |
| `/api/ai-interview/:sessionId/complete` | POST | Complete interview |
| `/api/interviews` | GET, POST | List/create interview sessions |

## Running Tests

```bash
npm test
npm run test:watch
```

## License

MIT License
