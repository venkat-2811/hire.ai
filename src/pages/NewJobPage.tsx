import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateJob, type JobDescriptionCreate } from '@/hooks/useJobs';
import { LEVEL_CONFIG, type RoleLevel } from '@/types/database';

export default function NewJobPage() {
  const { loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const createJob = useCreateJob();

  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState<RoleLevel | ''>('');
  const [description, setDescription] = useState('');
  const [minExperience, setMinExperience] = useState(0);
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>([]);
  const [goodToHaveSkills, setGoodToHaveSkills] = useState<string[]>([]);
  const [newMustHave, setNewMustHave] = useState('');
  const [newGoodToHave, setNewGoodToHave] = useState('');

  const handleAddMustHave = () => {
    if (newMustHave.trim() && !mustHaveSkills.includes(newMustHave.trim())) {
      setMustHaveSkills([...mustHaveSkills, newMustHave.trim()]);
      setNewMustHave('');
    }
  };

  const handleAddGoodToHave = () => {
    if (newGoodToHave.trim() && !goodToHaveSkills.includes(newGoodToHave.trim())) {
      setGoodToHaveSkills([...goodToHaveSkills, newGoodToHave.trim()]);
      setNewGoodToHave('');
    }
  };

  const handleRemoveMustHave = (skill: string) => {
    setMustHaveSkills(mustHaveSkills.filter(s => s !== skill));
  };

  const handleRemoveGoodToHave = (skill: string) => {
    setGoodToHaveSkills(goodToHaveSkills.filter(s => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !role || !level || !description) {
      return;
    }

    createJob.mutate({
      title,
      role: role,
      level: level as RoleLevel,
      description,
      must_have_skills: mustHaveSkills,
      good_to_have_skills: goodToHaveSkills,
      min_experience_years: minExperience,
    }, {
      onSuccess: () => {
        navigate('/jobs');
      }
    });
  };

  if (authLoading) {
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
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/jobs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create New Job</h1>
            <p className="text-muted-foreground">Define job requirements for AI-powered screening</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Job title and classification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Senior Salesforce Developer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role Type *</Label>
                    <Input
                      id="role"
                      placeholder="e.g. React Developer, Project Manager"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Experience Level *</Label>
                    <Select value={level} onValueChange={(v) => setLevel(v as RoleLevel)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label} ({config.experienceRange})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">Min. Years Experience</Label>
                    <Input
                      id="experience"
                      type="number"
                      min={0}
                      max={20}
                      value={minExperience}
                      onChange={(e) => setMinExperience(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Job Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle>Required Skills</CardTitle>
                <CardDescription>Define must-have and good-to-have skills for AI screening</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Must-Have Skills */}
                <div className="space-y-3">
                  <Label>Must-Have Skills</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a required skill..."
                      value={newMustHave}
                      onChange={(e) => setNewMustHave(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMustHave())}
                    />
                    <Button type="button" onClick={handleAddMustHave} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mustHaveSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm"
                      >
                        {skill}
                        <button type="button" onClick={() => handleRemoveMustHave(skill)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Good-to-Have Skills */}
                <div className="space-y-3">
                  <Label>Good-to-Have Skills</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a nice-to-have skill..."
                      value={newGoodToHave}
                      onChange={(e) => setNewGoodToHave(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoodToHave())}
                    />
                    <Button type="button" onClick={handleAddGoodToHave} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {goodToHaveSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-info/10 text-info text-sm"
                      >
                        {skill}
                        <button type="button" onClick={() => handleRemoveGoodToHave(skill)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/jobs">Cancel</Link>
              </Button>
              <Button type="submit" disabled={createJob.isPending}>
                {createJob.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Job'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
