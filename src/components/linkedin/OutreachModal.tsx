import { useState, useEffect } from 'react';
import { X, Mail, Loader2, RotateCcw, Send, Copy, Check, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useGenerateEmail, useSendOutreachEmail } from '@/hooks/useLinkedInTalent';
import type { LinkedInCandidate } from '@/hooks/useLinkedInTalent';
import { toast } from 'sonner';

interface OutreachModalProps {
  candidate: LinkedInCandidate | null;
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  recruiterName?: string;
  linkedInAccountId?: string; // kept for backward compat, not used for email
  onClose: () => void;
  onMarkContacted?: (candidate: LinkedInCandidate) => void;
}

export function OutreachModal({
  candidate,
  jobTitle,
  companyName,
  jobDescription,
  recruiterName,
  onClose,
  onMarkContacted,
}: OutreachModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const generateEmail = useGenerateEmail();
  const sendOutreachEmail = useSendOutreachEmail();

  const name = candidate
    ? [candidate.first_name, candidate.last_name].filter(Boolean).join(' ')
    : '';

  // Auto-generate email on open
  useEffect(() => {
    if (!candidate) return;
    setRecipientEmail('');
    setEmailSent(false);
    setEmailSubject(`Opportunity for ${jobTitle} at ${companyName}`);
    handleGenerateEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.public_identifier]);

  const handleGenerateEmail = async () => {
    if (!candidate) return;
    const result = await generateEmail.mutateAsync({
      candidate,
      job_title: jobTitle,
      company_name: companyName,
      job_description: jobDescription,
      recruiter_name: recruiterName,
    });
    if (result) {
      setEmailSubject((result as any).subject || emailSubject);
      setEmailBody((result as any).body || '');
    }
  };

  const handleSendEmail = async () => {
    if (!candidate) return;
    const email = recipientEmail.trim();
    if (!email) {
      toast.error('Please enter the candidate\'s email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!emailBody.trim()) {
      toast.error('Email body cannot be empty.');
      return;
    }

    try {
      await sendOutreachEmail.mutateAsync({
        to_email: email,
        subject: emailSubject,
        body: emailBody,
        candidate_name: name,
        job_title: jobTitle,
      });
      setEmailSent(true);
      onMarkContacted?.(candidate!);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      // Show the actual backend error — e.g. "Email configuration error: SMTP_USER not configured"
      const msg = err?.message || 'Failed to send email. Check your SMTP configuration.';
      toast.error(msg, { duration: 8000 });
    }
  };

  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Email copied to clipboard!');
  };

  if (!candidate) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-foreground">Email {name}</h2>
                <p className="text-sm text-muted-foreground">
                  {jobTitle} · {companyName}
                </p>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Recipient Email */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
                <AtSign className="h-3 w-3" />
                Recipient Email <span className="text-red-400">*</span>
              </Label>
              <Input
                type="email"
                placeholder="candidate@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className={cn(
                  'text-sm',
                  recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
                    ? 'border-red-500/50 focus-visible:ring-red-500/30'
                    : ''
                )}
              />
              <p className="text-[11px] text-muted-foreground/70">
                LinkedIn profiles don't include email addresses. Paste the candidate's email from LinkedIn or another source.
              </p>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Subject
              </Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Body</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateEmail}
                  disabled={generateEmail.isPending}
                  className="h-6 text-xs gap-1 text-violet-400 hover:text-violet-300"
                >
                  {generateEmail.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Regenerate
                </Button>
              </div>

              {generateEmail.isPending ? (
                <div className="h-52 rounded-lg border border-border/50 bg-muted/20 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                    <p className="text-sm text-muted-foreground">Generating personalized email…</p>
                  </div>
                </div>
              ) : (
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="min-h-[200px] text-sm font-mono resize-none"
                  placeholder="Email body will appear here..."
                />
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={copyEmail}
                className="gap-1.5"
                disabled={!emailBody}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>

              <Button
                className={cn(
                  'flex-1 gap-1.5 text-white transition-all',
                  emailSent
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                )}
                disabled={!emailBody || !recipientEmail || sendOutreachEmail.isPending || emailSent}
                onClick={handleSendEmail}
              >
                {sendOutreachEmail.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : emailSent ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {sendOutreachEmail.isPending ? 'Sending…' : emailSent ? 'Sent!' : 'Send Email'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Email will be sent via your configured SMTP account (Hostinger).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
