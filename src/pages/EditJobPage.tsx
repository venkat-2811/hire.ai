import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth, useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useJob } from '@/hooks/useJobs';
import { toast } from 'sonner';
import { LEVEL_CONFIG } from '@/types/database';

export default function EditJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useRequireAuth();
  const { getToken } = useAuth();
  const { data: job, isLoading } = useJob(jobId || '');

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState('');
  const [goodToHaveSkills, setGoodToHaveSkills] = useState('');
  const [minExperience, setMinExperience] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setTitle(job.title || '');
      setRole(job.role || '');
      setLevel(job.level || '');
      setDescription(job.description || '');
      setMustHaveSkills((job.must_have_skills || []).join(', '));
      setGoodToHaveSkills((job.good_to_have_skills || []).join(', '));
      setMinExperience(String(job.min_experience_years || 0));
    }
  }, [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !role || !level) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          role,
          level,
          description,
          must_have_skills: mustHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
          good_to_have_skills: goodToHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
          min_experience_years: parseInt(minExperience) || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update job');
      }

      toast.success('Job updated successfully');
      navigate(`/jobs/${jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update a job');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl lg:text-3xl font-bold"
          >
            Edit Job
          </motion.h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Update the job posting information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Senior Frontend Developer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., Frontend Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level *</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Job description..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mustHave">Must Have Skills (comma-separated)</Label>
                <Input
                  id="mustHave"
                  value={mustHaveSkills}
                  onChange={(e) => setMustHaveSkills(e.target.value)}
                  placeholder="e.g., React, TypeScript, Node.js"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goodToHave">Good to Have Skills (comma-separated)</Label>
                <Input
                  id="goodToHave"
                  value={goodToHaveSkills}
                  onChange={(e) => setGoodToHaveSkills(e.target.value)}
                  placeholder="e.g., GraphQL, AWS, Docker"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Minimum Experience (years)</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  value={minExperience}
                  onChange={(e) => setMinExperience(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Save Changes</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
