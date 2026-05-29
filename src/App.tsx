import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import ContactPage from "./pages/ContactPage";
import PricingPage from "./pages/PricingPage";
import DashboardPage from "./pages/DashboardPage";
import CandidatesPage from "./pages/CandidatesPage";
import NewCandidatePage from "./pages/NewCandidatePage";
import CandidateDetailsPage from "./pages/CandidateDetailsPage";
import JobsPage from "./pages/JobsPage";
import ArchivedJobsPage from "./pages/ArchivedJobsPage";
import NewJobPage from "./pages/NewJobPage";
import JobDetailsPage from "./pages/JobDetailsPage";
import EditJobPage from "./pages/EditJobPage";
import InterviewsPage from "./pages/InterviewsPage";
import InterviewSessionPage from "./pages/InterviewSessionPage";
import ProfilePage from "./pages/ProfilePage";
import OnboardingPage from "./pages/OnboardingPage";
import ApplyPage from "./pages/ApplyPage";
import AssessmentPage from "./pages/AssessmentPage";
import AIInterviewPage from "./pages/AIInterviewPage";
import ResultsDashboardPage from "./pages/ResultsDashboardPage";
import BillingPage from "./pages/BillingPage";
import OfferAcceptancePage from "./pages/OfferAcceptancePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = (error && typeof error === 'object' && 'status' in error) ? (error as any).status : undefined;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/sign-in/*" element={<AuthPage />} />
            <Route path="/sign-up/*" element={<AuthPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/new" element={<NewCandidatePage />} />
            <Route path="/candidates/:candidateId" element={<CandidateDetailsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/archived" element={<ArchivedJobsPage />} />
            <Route path="/jobs/new" element={<NewJobPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
            <Route path="/jobs/:jobId/edit" element={<EditJobPage />} />
            <Route path="/interviews" element={<InterviewsPage />} />
            <Route path="/interviews/:sessionId" element={<InterviewSessionPage />} />
            <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/apply/:jobId" element={<ApplyPage />} />
            <Route path="/assessment/:token" element={<AssessmentPage />} />
            <Route path="/ai-interview/:token" element={<AIInterviewPage />} />
            <Route path="/results" element={<ResultsDashboardPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/offer-acceptance" element={<OfferAcceptancePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
