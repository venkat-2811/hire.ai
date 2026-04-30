interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

export async function sendApplicationReceived(
  to: string,
  candidateName: string,
  jobTitle: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Application Received - ${jobTitle}`,
    html: `
      <h2>Thank you for your application, ${candidateName}!</h2>
      <p>We have received your application for the <strong>${jobTitle}</strong> position.</p>
      <p>Our team will review your application and get back to you soon.</p>
      <br>
      <p>Best regards,<br>Talent Scout AI Team</p>
    `,
  });
}

export async function sendAssessmentInvite(
  to: string,
  candidateName: string,
  jobTitle: string,
  assessmentLink: string,
  deadline: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Assessment Invitation - ${jobTitle}`,
    html: `
      <h2>Congratulations, ${candidateName}!</h2>
      <p>You have been shortlisted for the <strong>${jobTitle}</strong> position.</p>
      <p>Please complete the technical assessment by clicking the link below:</p>
      <p><a href="${assessmentLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Assessment</a></p>
      <p><strong>Deadline:</strong> ${deadline}</p>
      <br>
      <p>Best regards,<br>Talent Scout AI Team</p>
    `,
  });
}

export async function sendInterviewInvite(
  to: string,
  candidateName: string,
  jobTitle: string,
  interviewLink: string,
  scheduledTime?: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `AI Interview Invitation - ${jobTitle}`,
    html: `
      <h2>Great news, ${candidateName}!</h2>
      <p>You have been invited to an AI-powered interview for the <strong>${jobTitle}</strong> position.</p>
      <p>Click the link below to start your interview:</p>
      <p><a href="${interviewLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Interview</a></p>
      ${scheduledTime ? `<p><strong>Scheduled Time:</strong> ${scheduledTime}</p>` : ''}
      <br>
      <p>Best regards,<br>Talent Scout AI Team</p>
    `,
  });
}

export async function sendAcceptanceEmail(
  to: string,
  candidateName: string,
  jobTitle: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Congratulations! You've been selected - ${jobTitle}`,
    html: `
      <h2>Congratulations, ${candidateName}!</h2>
      <p>We are thrilled to inform you that you have been selected for the <strong>${jobTitle}</strong> position!</p>
      <p>Our HR team will reach out to you shortly with the next steps.</p>
      <br>
      <p>Welcome to the team!<br>Talent Scout AI</p>
    `,
  });
}

export async function sendRejectionEmail(
  to: string,
  candidateName: string,
  jobTitle: string
): Promise<void> {
  await sendEmail({
    to,
    subject: `Application Update - ${jobTitle}`,
    html: `
      <h2>Dear ${candidateName},</h2>
      <p>Thank you for your interest in the <strong>${jobTitle}</strong> position and for taking the time to apply.</p>
      <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
      <p>We encourage you to apply for future openings that match your skills and experience.</p>
      <br>
      <p>Best wishes,<br>Talent Scout AI Team</p>
    `,
  });
}
      <br>
      <p>Best wishes,<br>Talent Scout AI Team</p>
    `,
  });
}
