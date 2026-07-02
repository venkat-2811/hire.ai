import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { JobDescription, Candidate, Profile, AssessmentDetails, InterviewDetails, ManualInterviewDetails, ATSScreeningResult } from './api';

export const PDFExportService = {
    generateJobReport: (
        job: JobDescription,
        candidates: Candidate[],
        profile?: Profile
    ) => {
        const doc = new jsPDF();
        const companyName = profile?.company_name || 'Your Company';

        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 64, 175); // Primary blue
        doc.text('Rekshift', 14, 20);

        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text(`|  ${companyName}`, 38, 20);

        doc.setFontSize(18);
        doc.setTextColor(20);
        doc.text(`Job Analytics Report: ${job.title}`, 14, 35);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Role: ${job.role} - Level: ${job.level}`, 14, 43);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 49);

        doc.line(14, 53, 196, 53);

        // Candidates Table
        doc.setFontSize(14);
        doc.setTextColor(20);
        doc.text('Candidate Overview', 14, 65);

        const tableData = candidates.map(c => [
            c.full_name,
            c.email,
            c.resume_parsed_data ? 'Parsed' : 'Raw/None',
            new Date(c.created_at).toLocaleDateString()
        ]);

        autoTable(doc, {
            startY: 70,
            head: [['Candidate Name', 'Email', 'Resume Status', 'Applied Date']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [30, 64, 175] }
        });

        const fileName = `${job.title.replace(/\s+/g, '_')}_Report.pdf`;
        doc.save(fileName);
    },

    generateCandidateReport: (
        candidate: Candidate,
        assessment: AssessmentDetails | null,
        interview: InterviewDetails | null,
        screening: ATSScreeningResult | null,
        manualInterview: ManualInterviewDetails | null,
        profile?: Profile
    ) => {
        const doc = new jsPDF();
        const companyName = profile?.company_name || 'Your Company';

        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 64, 175);
        doc.text('Rekshift', 14, 20);

        doc.setFontSize(14);
        doc.setTextColor(100);
        doc.text(`|  ${companyName}`, 38, 20);

        doc.setFontSize(18);
        doc.setTextColor(20);
        doc.text(`Candidate Report: ${candidate.full_name}`, 14, 35);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Email: ${candidate.email}`, 14, 43);
        if (candidate.phone) doc.text(`Phone: ${candidate.phone}`, 14, 49);
        const appliedDate = (candidate.applied_at || candidate.created_at);
        doc.text(`Applied: ${appliedDate ? new Date(appliedDate).toLocaleDateString() : 'N/A'}`, 14, 55);

        doc.line(14, 59, 196, 59);

        let startY = 68;

        // Candidate Profile
        autoTable(doc, {
            startY,
            head: [['Field', 'Value']],
            body: [
                ['Full Name', candidate.full_name || ''],
                ['Email', candidate.email || ''],
                ['Phone', candidate.phone || ''],
                ['Location', (candidate as any).location || ''],
                ['Main Skillset', (candidate as any).mainSkillset || ''],

                ['Portfolio', (candidate as any).portfolio_url || ''],
                ['GitHub', (candidate as any).github_url || ''],
                ['Consent Given', String(!!candidate.consent_given)],
            ],
            theme: 'striped',
            headStyles: { fillColor: [30, 64, 175] },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 135 },
            },
        });

        startY = (doc as any).lastAutoTable.finalY + 12;

        // Resume Parsed Data
        if (candidate.resume_parsed_data) {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('Resume (Parsed)', 14, startY);
            startY += 6;

            const parsed = candidate.resume_parsed_data as any;
            const skills = Array.isArray(parsed?.skills) ? parsed.skills.join(', ') : '';
            const summary = typeof parsed?.summary === 'string' ? parsed.summary : '';
            const expYears = parsed?.total_experience_years ?? '';
            const certifications = Array.isArray(parsed?.certifications) ? parsed.certifications.join(', ') : '';

            autoTable(doc, {
                startY,
                head: [['Section', 'Details']],
                body: [
                    ['Skills', skills],
                    ['Experience (Years)', String(expYears)],
                    ['Summary', summary],
                    ['Certifications', certifications],
                ],
                theme: 'grid',
                headStyles: { fillColor: [30, 64, 175] },
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 135 },
                },
            });

            startY = (doc as any).lastAutoTable.finalY + 12;
        }

        // Resume Text Snippet
        if (candidate.resume_text && startY < 270) {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }
            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('Resume (Text Snippet)', 14, startY);
            startY += 6;

            doc.setFontSize(9);
            doc.setTextColor(60);
            const raw = typeof candidate.resume_text === 'string'
                ? candidate.resume_text
                : JSON.stringify(candidate.resume_text);
            const snippet = String(raw).slice(0, 1200);
            const lines = doc.splitTextToSize(snippet, 180);
            doc.text(lines, 14, startY);
            startY += (lines.length * 4) + 10;
        }

        // ATS Screening
        if (screening) {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('ATS Screening', 14, startY);

            autoTable(doc, {
                startY: startY + 5,
                head: [['Metric', 'Value']],
                body: [
                    ['Overall Score', `${(screening as any).overall_score ?? 'N/A'}%`],
                    ['Shortlisted', String((screening as any).shortlisted ?? '')],
                    ['Skills Score', (screening as any).skill_relevance_score != null ? `${(screening as any).skill_relevance_score}%` : 'N/A'],
                    ['Experience Score', (screening as any).experience_score != null ? `${(screening as any).experience_score}%` : 'N/A'],
                    ['Education Score', (screening as any).education_score != null ? `${(screening as any).education_score}%` : 'N/A'],
                    ['Credibility Score', (screening as any).credibility_score != null ? `${(screening as any).credibility_score}%` : 'N/A'],
                    ['Reason', String((screening as any).shortlist_reason ?? '')],
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 64, 175] },
                styles: { fontSize: 9 },
            });

            startY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Assessment Section
        if (assessment) {
            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('Assessment Results', 14, startY);

            autoTable(doc, {
                startY: startY + 5,
                head: [['Metric', 'Score']],
                body: [
                    ['MCQ Score', assessment.mcq_score !== null ? `${assessment.mcq_score}%` : 'N/A'],
                    ['Coding Score', assessment.coding_score !== null ? `${assessment.coding_score}%` : 'N/A'],
                    ['SQL Score', assessment.sql_score !== null && assessment.sql_score !== undefined ? `${assessment.sql_score}%` : 'N/A'],
                    ['Total Score', assessment.total_score !== null ? `${assessment.total_score}%` : 'N/A']
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 64, 175] }
            });
            startY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Interview Section
        if (interview && interview.final_evaluation) {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('AI Interview Evaluation', 14, startY);

            autoTable(doc, {
                startY: startY + 5,
                head: [['Overall Score', 'Technical', 'Communication', 'Recommendation']],
                body: [[
                    `${interview.final_evaluation.overall_score}%`,
                    `${interview.final_evaluation.technical_score}%`,
                    `${interview.final_evaluation.communication_score}%`,
                    (interview.final_evaluation.recommendation || 'N/A').replace(/_/g, ' ').toUpperCase()
                ]],
                theme: 'striped',
                headStyles: { fillColor: [30, 64, 175] }
            });

            startY = (doc as any).lastAutoTable.finalY + 15;

            if (interview.final_evaluation.strengths?.length) {
                doc.setFontSize(12);
                doc.text('Strengths:', 14, startY);
                startY += 6;
                doc.setFontSize(10);
                interview.final_evaluation.strengths.forEach((s) => {
                    const textContent = typeof s === 'string' ? s : JSON.stringify(s);
                    const lines = doc.splitTextToSize(`• ${textContent}`, 180);
                    doc.text(lines, 14, startY);
                    startY += (lines.length * 5);
                });
                startY += 5;
            }

            if (interview.final_evaluation.weaknesses?.length) {
                if (startY > 260) {
                    doc.addPage();
                    startY = 20;
                }
                doc.setFontSize(12);
                doc.text('Areas To Improve:', 14, startY);
                startY += 6;
                doc.setFontSize(10);
                interview.final_evaluation.weaknesses.forEach((w) => {
                    const textContent = typeof w === 'string' ? w : JSON.stringify(w);
                    const lines = doc.splitTextToSize(`• ${textContent}`, 180);
                    doc.text(lines, 14, startY);
                    startY += (lines.length * 5);
                });
            }
        }

        // Manual Interview Section
        if (manualInterview) {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(20);
            doc.text('Manual Interview Evaluation', 14, startY);

            autoTable(doc, {
                startY: startY + 5,
                head: [['Field', 'Value']],
                body: [
                    ['Interview Mode', manualInterview.interview_mode || 'manual'],
                    ['Score', manualInterview.manual_interview_score != null ? `${manualInterview.manual_interview_score}%` : 'N/A'],
                    ['Feedback', manualInterview.manual_interview_feedback || ''],
                    ['Notes', manualInterview.manual_interview_notes || ''],
                    ['Interview Date', manualInterview.manual_interview_at ? new Date(manualInterview.manual_interview_at).toLocaleDateString() : ''],
                    ['Status', manualInterview.interview_status || ''],
                ],
                theme: 'striped',
                headStyles: { fillColor: [30, 64, 175] },
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 135 },
                },
            });
        }

        const fileName = `${candidate.full_name.replace(/\s+/g, '_')}_Report.pdf`;
        doc.save(fileName);
    },

    generateOfferLetterBase64: (
        candidateName: string,
        jobTitle: string,
        companyName: string,
        offeredSalary: string,
        startDate?: string,
        reportingManager?: string,
        location?: string
    ): string => {
        const doc = new jsPDF();
        
        // Brand Setup
        const brandColor: [number, number, number] = [79, 70, 229]; // Indigo-600
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(...brandColor);
        doc.text(companyName, 14, 25);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Talent Acquisition · People & Culture', 14, 32);
        
        doc.setDrawColor(...brandColor);
        doc.setLineWidth(0.8);
        doc.line(14, 38, 196, 38);
        
        // Title
        doc.setFontSize(18);
        doc.setTextColor(20);
        doc.text('OFFER OF EMPLOYMENT', 105, 52, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(`Date: ${today}`, 105, 60, { align: 'center' });
        
        // Greeting
        let startY = 75;
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.setFont('helvetica', 'bold');
        doc.text(`Dear ${candidateName},`, 14, startY);
        
        startY += 8;
        doc.setFont('helvetica', 'normal');
        const introText = `We are delighted to offer you the position of ${jobTitle} at ${companyName}. After a thorough review of your qualifications and your outstanding performance throughout our hiring process, we believe you will be a valuable addition to our team. This letter outlines the terms and conditions of your employment.`;
        const splitIntro = doc.splitTextToSize(introText, 180);
        doc.text(splitIntro, 14, startY);
        startY += (splitIntro.length * 6) + 5;
        
        // Section: Employment Details
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandColor);
        doc.text('1. Employment Details', 14, startY);
        startY += 5;
        
        doc.setDrawColor(200);
        doc.setLineWidth(0.2);
        doc.line(14, startY, 196, startY);
        startY += 5;
        
        autoTable(doc, {
            startY: startY,
            body: [
                ['Position', jobTitle],
                ['Department', 'As Applicable'],
                ['Location', location || 'As Agreed'],
                ['Reporting To', reportingManager || '[To be communicated]'],
                ['Proposed Start Date', startDate || '[To be communicated]'],
                ['Employment Type', 'Full-Time, Permanent']
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4, textColor: [30, 30, 30] },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [240, 244, 255] as [number, number, number], cellWidth: 50 },
                1: { cellWidth: 130 } // 130 instead of 132 for better margin
            },
            margin: { left: 14, right: 14 }
        });
        
        startY = (doc as any).lastAutoTable.finalY + 10;
        
        // Section: Compensation
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandColor);
        doc.text('2. Compensation & Benefits', 14, startY);
        startY += 5;
        doc.line(14, startY, 196, startY);
        startY += 5;
        
        autoTable(doc, {
            startY: startY,
            body: [
                ['Offered Salary (CTC)', offeredSalary],
                ['Pay Frequency', 'Monthly']
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4, textColor: [30, 30, 30] },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [240, 244, 255] as [number, number, number], cellWidth: 50 },
                1: { cellWidth: 130 }
            },
            margin: { left: 14, right: 14 }
        });
        
        startY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text('Additional benefits including health insurance, paid leave, and performance bonuses will be detailed in the Employee Handbook provided during onboarding.', 14, startY, { maxWidth: 180 });
        startY += 15;
        
        // Ensure space for terms
        if (startY > 230) {
            doc.addPage();
            startY = 20;
        }
        
        // Terms
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...brandColor);
        doc.text('3. General Employment Terms', 14, startY);
        startY += 5;
        doc.line(14, startY, 196, startY);
        startY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(20);
        const terms = [
            "Probationary Period: Your first 90 days of employment shall constitute a probationary period.",
            "Working Hours: Standard working hours are 9:00 AM – 6:00 PM, Monday through Friday.",
            "Leave Entitlement: You are entitled to paid annual leave, sick leave, and public holidays as per policy.",
            "Confidentiality: You agree to maintain strict confidentiality of all company proprietary information."
        ];
        
        terms.forEach(term => {
            const split = doc.splitTextToSize(`• ${term}`, 180);
            doc.text(split, 14, startY);
            startY += (split.length * 5) + 2;
        });
        
        startY += 12;
        
        // Signature Block
        // Avoid page break inside signature
        if (startY > 240) {
             doc.addPage();
             startY = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...brandColor);
        doc.text('4. Acceptance of Offer', 14, startY);
        startY += 5;
        doc.line(14, startY, 196, startY);
        startY += 6;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(20);
        doc.text("Please confirm your acceptance of this offer by replying to the offer email within 7 business days.", 14, startY, { maxWidth: 180 });
        startY += 25;
        
        doc.line(14, startY, 196, startY);
        
        startY += 5;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text('For the Company', 14, startY);
        doc.text('Candidate Acknowledgement', 110, startY);
        
        startY += 15;
        doc.setFontSize(10);
        doc.setTextColor(20);
        doc.text('________________________', 14, startY);
        doc.text('________________________', 110, startY);
        
        startY += 5;
        doc.text(`Authorised Signatory\n${companyName}`, 14, startY);
        doc.text(`${candidateName}\nDate: _________________`, 110, startY);
        
        // Footer (Bottom of page always)
        doc.setFontSize(8);
        doc.setTextColor(150);
        const footerY = 285;
        doc.text(`This document is confidential. © ${new Date().getFullYear()} ${companyName}. All rights reserved.`, 105, footerY, { align: 'center' });
        
        // Extract base64 without the 'data:application/pdf;base64,' prefix
        const dataUri = doc.output('datauristring');
        return dataUri.split(',')[1];
    }
};
