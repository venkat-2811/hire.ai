import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lock, Mail, Info } from 'lucide-react';
import { toast } from 'sonner';
import { candidatesApi } from '@/lib/api';

interface EditableCandidateFields {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  portfolio_url: string;
  github_url: string;
}

interface EditCandidateModalProps {
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    portfolio_url?: string | null;
    github_url?: string | null;
    resume_parsed_data?: any;
    applied_at?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: any) => void;
}

export function EditCandidateModal({ candidate, open, onOpenChange, onUpdated }: EditCandidateModalProps) {
  const [step, setStep] = useState<'warning' | 'edit'>('warning');
  const [saving, setSaving] = useState(false);

  const [fields, setFields] = useState<EditableCandidateFields>({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    portfolio_url: '',
    github_url: '',
  });

  const [originalEmail, setOriginalEmail] = useState('');
  const emailChanged = fields.email.trim().toLowerCase() !== originalEmail.toLowerCase();

  useEffect(() => {
    if (candidate && open) {
      const f: EditableCandidateFields = {
        full_name: candidate.full_name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        location: candidate.location || '',
        portfolio_url: candidate.portfolio_url || '',
        github_url: candidate.github_url || '',
      };
      setFields(f);
      setOriginalEmail(candidate.email || '');
      setStep('warning');
    }
  }, [candidate, open]);

  const handleClose = () => {
    onOpenChange(false);
    setStep('warning');
  };

  const handleSave = async () => {
    if (!candidate) return;

    if (!fields.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!fields.email.trim()) {
      toast.error('Email is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fields.email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string | null> = {
        full_name: fields.full_name.trim(),
        email: fields.email.trim().toLowerCase(),
        phone: fields.phone.trim() || null,
        location: fields.location.trim() || null,
        portfolio_url: fields.portfolio_url.trim() || null,
        github_url: fields.github_url.trim() || null,
      };

      const updated = await candidatesApi.update(candidate.id, payload as any);
      toast.success('Candidate details updated successfully');
      onUpdated?.(updated);
      handleClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to update candidate details';
      if (msg.includes('409') || msg.toLowerCase().includes('email')) {
        toast.error('Another candidate already uses this email address');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {step === 'warning' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Before You Edit Candidate Details
              </DialogTitle>
              <DialogDescription>
                Please review these important notes before making changes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">⚠ Important</p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1.5 list-none">
                  <li>• Candidate information affects all future hiring operations.</li>
                  <li>• Changes should only be made when necessary.</li>
                  <li>• <strong>Resume data cannot be modified</strong> after application submission.</li>
                  <li>• If the email is changed, all future communications (invites, OTPs, offers) will use the updated email.</li>
                </ul>
              </div>

              <div className="rounded-lg border p-3 flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Resume data is locked</p>
                  <p className="text-xs text-muted-foreground">Parsed resume content, uploaded files, and extraction data remain unchanged after application submission.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep('edit')}>Continue Editing</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Edit Candidate Details</DialogTitle>
              <DialogDescription>
                Editing <strong>{candidate.full_name}</strong>. Resume fields are read-only.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Editable Fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ec-name">Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="ec-name"
                    value={fields.full_name}
                    onChange={(e) => setFields(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Candidate full name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ec-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ec-email"
                    type="email"
                    value={fields.email}
                    onChange={(e) => setFields(f => ({ ...f, email: e.target.value }))}
                    placeholder="candidate@example.com"
                  />
                  {emailChanged && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-2.5 flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Future emails, interview invites, OTPs, and hiring communications will be sent to this updated email address.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ec-phone">Phone</Label>
                  <Input
                    id="ec-phone"
                    value={fields.phone}
                    onChange={(e) => setFields(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ec-location">Location</Label>
                  <Input
                    id="ec-location"
                    value={fields.location}
                    onChange={(e) => setFields(f => ({ ...f, location: e.target.value }))}
                    placeholder="City, Country"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ec-portfolio">Portfolio URL</Label>
                  <Input
                    id="ec-portfolio"
                    value={fields.portfolio_url}
                    onChange={(e) => setFields(f => ({ ...f, portfolio_url: e.target.value }))}
                    placeholder="https://portfolio.example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ec-github">GitHub URL</Label>
                  <Input
                    id="ec-github"
                    value={fields.github_url}
                    onChange={(e) => setFields(f => ({ ...f, github_url: e.target.value }))}
                    placeholder="https://github.com/username"
                  />
                </div>
              </div>

              {/* Resume — locked */}
              <div className="rounded-lg border border-dashed p-3 opacity-60">
                <div className="flex items-center gap-2 mb-1.5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Resume Details (Locked)</p>
                  <Badge variant="outline" className="text-xs ml-auto">Read-only</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resume details are locked after application submission. Parsed resume content, uploaded files, and extracted data cannot be modified here.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('warning')} disabled={saving}>Back</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
