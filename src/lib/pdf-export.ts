import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { JobDescription, Candidate, Profile, AssessmentDetails, InterviewDetails } from './api';

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
        doc.text('HireAI', 14, 20);

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
        profile?: Profile
    ) => {
        const doc = new jsPDF();
        const companyName = profile?.company_name || 'Your Company';

        // Header
        doc.setFontSize(22);
        doc.setTextColor(30, 64, 175);
        doc.text('HireAI', 14, 20);

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
        doc.text(`Applied: ${new Date(candidate.created_at).toLocaleDateString()}`, 14, 55);

        doc.line(14, 59, 196, 59);

        let startY = 68;

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

        const fileName = `${candidate.full_name.replace(/\s+/g, '_')}_Report.pdf`;
        doc.save(fileName);
    }
};
