# Talent Scout AI - AI-Powered Interview & Hiring Platform

An intelligent hiring platform that automates resume screening, generates adaptive interview questions, evaluates candidate responses, and provides explainable AI-driven hiring recommendations.

## Features

- **Semantic Resume Parsing**: AI-powered extraction of skills, experience, and qualifications from PDF/DOCX resumes
- **Explainable ATS Screening**: Transparent scoring with detailed reason codes for shortlisting decisions
- **Adaptive Question Generation**: Role-specific, JD-driven interview questions that adapt to candidate profiles
- **AI Response Evaluation**: Automated scoring of technical and behavioral responses with detailed feedback
- **Practical Assessments**: Role-specific coding/analysis tasks with AI evaluation
- **Basic Proctoring**: Tab switch detection, copy-paste monitoring, and integrity scoring
- **Analytics Dashboard**: Real-time hiring metrics and candidate insights

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** + **shadcn/ui** for styling
- **React Query** for data fetching
- **Framer Motion** for animations

### Backend
- **Python FastAPI** for REST API
- **OpenAI GPT-4** for AI services
- **Supabase** for database and auth
- **Pydantic** for data validation

## Project Structure

```
talent-scout-ai/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── hooks/              # React Query hooks for API
│   ├── lib/                # API client and utilities
│   ├── pages/              # Page components
│   └── types/              # TypeScript types
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── models/         # Pydantic schemas and enums
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # AI service implementations
│   │   └── database/       # Supabase client
│   ├── requirements.txt    # Python dependencies
│   └── run.py              # Server entry point
└── supabase/               # Database migrations
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Supabase account
- OpenAI API key

### 1. Clone and Install Frontend

```bash
git clone <repository-url>
cd talent-scout-ai

# Install frontend dependencies
npm install
```

### 2. Configure Frontend Environment

Create `.env` file in the root directory:

```env
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_API_URL=http://localhost:8000
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

Create `backend/.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Application Settings
UPLOAD_DIR=./uploads
VECTOR_STORE_PATH=./vector_store

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 5. Setup Database

Run the Supabase migration to create required tables:

```bash
# Using Supabase CLI
supabase db push
```

Or manually run the SQL migration from `supabase/migrations/`.

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

Access the application at `http://localhost:5173`

## API Endpoints

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create a job
- `GET /api/jobs/{id}` - Get job details
- `PUT /api/jobs/{id}` - Update job
- `DELETE /api/jobs/{id}` - Archive job

### Candidates
- `GET /api/candidates` - List candidates
- `POST /api/candidates` - Create candidate with resume
- `GET /api/candidates/{id}` - Get candidate details
- `GET /api/candidates/{id}/resume` - Get parsed resume data

### Screening
- `POST /api/screening/run` - Run ATS screening
- `GET /api/screening/candidate/{id}` - Get screening results

### Interviews
- `GET /api/interviews` - List interview sessions
- `POST /api/interviews` - Create interview session
- `POST /api/interviews/{id}/start` - Start interview (generate questions)
- `POST /api/interviews/{id}/response` - Submit response
- `POST /api/interviews/{id}/complete` - Complete and evaluate

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/candidates` - Candidate analytics
- `GET /api/analytics/trends` - Hiring trends

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI services | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon/public key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `VITE_API_URL` | Backend API URL | Yes |

## Development

### Running Tests
```bash
# Frontend tests
npm test

# Backend tests
cd backend
pytest
```

### Code Style
- Frontend: ESLint + Prettier
- Backend: Black + isort

## License

MIT License
