import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2,
  Mail,
  Phone,
  Globe,
  Github,
  FileText,
  Calendar,
} from 'lucide-react';
import { useCandidate } from '@/hooks/useCandidates';

export default function CandidateDetailsPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  const { data: candidate, isLoading } = useCandidate(candidateId || '');

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!candidate) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Candidate not found</p>
              <Button asChild className="mt-4">
                <Link to="/candidates">Back to Candidates</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/candidates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl lg:text-3xl font-bold"
            >
              {candidate.full_name}
            </motion.h1>
            <p className="text-muted-foreground">{candidate.email}</p>
          </div>
        </div>

        {/* Candidate Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span>{candidate.email}</span>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{candidate.phone}</span>
                  </div>
                )}
                {candidate.portfolio_url && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {candidate.portfolio_url}
                    </a>
                  </div>
                )}
                {candidate.github_url && (
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {candidate.github_url}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resume Link */}
            {(candidate.resume_url || candidate.resume_text) && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {candidate.resume_url ? (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open uploaded resume
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Uploaded resume is noted, but no file URL is available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Raw Resume Text */}
            {candidate.resume_text && !candidate.resume_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Resume Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-auto">
                    {candidate.resume_text}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Resume</p>
                    <Badge variant={candidate.resume_parsed_data ? 'default' : 'secondary'}>
                      {candidate.resume_parsed_data ? 'Parsed' : 'Not Parsed'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Applied</p>
                    <p className="font-medium">{new Date(candidate.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Consent</p>
                  <Badge variant={candidate.consent_given ? 'default' : 'destructive'}>
                    {candidate.consent_given ? 'Given' : 'Not Given'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
