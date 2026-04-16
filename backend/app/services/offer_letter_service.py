"""
Offer Letter PDF Generator using reportlab.
Generates a formal, branded offer letter document as bytes.
"""
from io import BytesIO
from datetime import date
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# Brand color palette
BRAND_PURPLE = colors.HexColor("#6366f1")
BRAND_DARK = colors.HexColor("#1e1b4b")
LIGHT_BG = colors.HexColor("#f0f4ff")
TEXT_DARK = colors.HexColor("#1a1a2e")
TEXT_MUTED = colors.HexColor("#6b7280")
DIVIDER = colors.HexColor("#e5e7eb")


def generate_offer_letter_pdf(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    company_name: str,
    offered_salary: str,
    start_date: Optional[str] = None,
    reporting_manager: Optional[str] = None,
    location: Optional[str] = None,
) -> bytes:
    """
    Generate a professional offer letter PDF and return as bytes.

    Args:
        candidate_name: Full name of the candidate
        candidate_email: Email address of the candidate
        job_title: Title of the offered role
        company_name: Name of the hiring company
        offered_salary: Salary string (e.g. "₹12,00,000 per annum")
        start_date: Optional proposed start date string
        reporting_manager: Optional name of reporting manager
        location: Optional work location

    Returns:
        PDF bytes
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    # --- Custom Styles ---
    company_style = ParagraphStyle(
        "CompanyHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=BRAND_PURPLE,
        spaceAfter=2,
    )
    tagline_style = ParagraphStyle(
        "Tagline",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=TEXT_MUTED,
        spaceAfter=12,
    )
    doc_title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=TEXT_DARK,
        alignment=TA_CENTER,
        spaceBefore=8,
        spaceAfter=4,
    )
    doc_subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
        spaceAfter=14,
    )
    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=BRAND_PURPLE,
        spaceBefore=12,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=TEXT_DARK,
        leading=16,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
    )
    bullet_style = ParagraphStyle(
        "Bullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=TEXT_DARK,
        leading=16,
        leftIndent=12,
        spaceAfter=3,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=TEXT_MUTED,
        alignment=TA_CENTER,
        spaceBefore=14,
    )
    sig_label_style = ParagraphStyle(
        "SigLabel",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=TEXT_MUTED,
    )
    sig_name_style = ParagraphStyle(
        "SigName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=TEXT_DARK,
    )

    today = date.today().strftime("%B %d, %Y")
    start_display = start_date or "[To be communicated]"
    manager_display = reporting_manager or "[To be communicated]"
    location_display = location or "As Agreed"

    # ======================== CONTENT ========================
    story = []

    # --- Company Header ---
    story.append(Paragraph(company_name, company_style))
    story.append(Paragraph("Talent Acquisition · People & Culture", tagline_style))
    story.append(HRFlowable(width="100%", thickness=2, color=BRAND_PURPLE, spaceAfter=8))

    # --- Document Title ---
    story.append(Paragraph("OFFER OF EMPLOYMENT", doc_title_style))
    story.append(Paragraph(f"Date: {today}", doc_subtitle_style))

    story.append(Spacer(1, 6))

    # --- Greeting / Intro ---
    story.append(Paragraph(
        f"Dear <b>{candidate_name}</b>,",
        ParagraphStyle("Greeting", parent=body_style, spaceAfter=8)
    ))
    story.append(Paragraph(
        f"We are delighted to offer you the position of <b>{job_title}</b> at <b>{company_name}</b>. "
        f"After a thorough review of your qualifications and your outstanding performance throughout our "
        f"hiring process, we believe you will be a valuable addition to our team. This letter outlines "
        f"the terms and conditions of your employment.",
        body_style
    ))

    story.append(Spacer(1, 4))

    # --- Employment Details Table ---
    story.append(Paragraph("1. Employment Details", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))

    details_data = [
        ["Position", job_title],
        ["Department", "As Applicable"],
        ["Location", location_display],
        ["Reporting To", manager_display],
        ["Proposed Start Date", start_display],
        ["Employment Type", "Full-Time, Permanent"],
    ]

    details_table = Table(
        details_data,
        colWidths=[60 * mm, None],
        hAlign="LEFT",
    )
    details_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("TEXTCOLOR", (0, 0), (0, -1), BRAND_DARK),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("GRID", (0, 0), (-1, -1), 0.5, DIVIDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(details_table)

    # --- Compensation ---
    story.append(Paragraph("2. Compensation & Benefits", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))

    comp_data = [
        ["Offered Salary (CTC)", offered_salary],
        ["Pay Frequency", "Monthly"],
    ]
    comp_table = Table(
        comp_data,
        colWidths=[60 * mm, None],
        hAlign="LEFT",
    )
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BG),
        ("TEXTCOLOR", (0, 0), (0, -1), BRAND_DARK),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("GRID", (0, 0), (-1, -1), 0.5, DIVIDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(comp_table)

    story.append(Paragraph(
        "Additional benefits including health insurance, paid leave, and performance bonuses will be "
        "detailed in the Employee Handbook provided during onboarding.",
        ParagraphStyle("BenefitsNote", parent=body_style, spaceBefore=6, fontSize=9, textColor=TEXT_MUTED)
    ))

    # --- At-Will / Employment Terms ---
    story.append(Paragraph("3. General Employment Terms", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))
    story.append(Paragraph(
        "Your employment will be governed by the following general terms:",
        body_style
    ))
    terms = [
        "<b>Probationary Period:</b> Your first 90 days of employment shall constitute a "
        "probationary period during which either party may terminate the agreement with "
        "7 days' written notice.",
        "<b>Working Hours:</b> Standard working hours are 9:00 AM – 6:00 PM, Monday through Friday, "
        "totalling 45 hours per week. Reasonable overtime may be required based on business needs.",
        "<b>Leave Entitlement:</b> You are entitled to 24 days of paid annual leave, 12 days of sick "
        "leave, and applicable public holidays as per the company's leave policy.",
        "<b>Background Verification:</b> This offer is conditional upon successful completion of a "
        "background check.",
        "<b>Intellectual Property:</b> All work products, inventions, or developments created during "
        "the course of employment shall be the sole property of the company.",
    ]
    for term in terms:
        story.append(Paragraph(f"• {term}", bullet_style))

    # --- Confidentiality ---
    story.append(Paragraph("4. Confidentiality Clause", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))
    story.append(Paragraph(
        "As an employee of <b>" + company_name + "</b>, you will have access to proprietary and "
        "confidential information, including but not limited to trade secrets, client data, business "
        "strategies, financial information, and technical know-how. You agree to:",
        body_style
    ))
    conf_clauses = [
        "Maintain strict confidentiality of all such information during and after your employment.",
        "Not disclose any confidential information to unauthorized persons or use it for personal benefit.",
        "Return all company materials, data, and equipment upon termination or resignation.",
    ]
    for clause in conf_clauses:
        story.append(Paragraph(f"• {clause}", bullet_style))
    story.append(Paragraph(
        "Breach of this clause may result in immediate termination and legal action.",
        ParagraphStyle("Warning", parent=body_style, fontSize=9, textColor=TEXT_MUTED)
    ))

    # --- Code of Conduct ---
    story.append(Paragraph("5. Code of Conduct", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))
    story.append(Paragraph(
        "You are expected to uphold the company's values and standards at all times, including:",
        body_style
    ))
    conduct_items = [
        "Treating all colleagues, clients, and stakeholders with respect and professionalism.",
        "Adhering to all company policies, procedures, and applicable laws and regulations.",
        "Avoiding conflicts of interest and disclosing any that may arise during employment.",
        "Maintaining a safe, inclusive, and harassment-free workplace environment.",
        "Representing the company positively in all professional interactions.",
    ]
    for item in conduct_items:
        story.append(Paragraph(f"• {item}", bullet_style))

    # --- Non-Solicitation ---
    story.append(Paragraph("6. Non-Solicitation", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))
    story.append(Paragraph(
        "During employment and for a period of 12 months following its termination, you agree not to "
        "directly or indirectly solicit, induce, or encourage any current employee, contractor, or "
        "client of the company to terminate their relationship with the company or to engage with a "
        "competing entity.",
        body_style
    ))

    # --- Acceptance ---
    story.append(Spacer(1, 10))
    story.append(Paragraph("7. Acceptance of Offer", section_heading_style))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=6))
    story.append(Paragraph(
        "Please confirm your acceptance of this offer by replying to the offer email within "
        "<b>7 business days</b> of receiving this letter. Failure to respond within this period may "
        "result in the offer being withdrawn.",
        body_style
    ))

    # --- Signature Block ---
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=DIVIDER, spaceAfter=12))

    sig_data = [
        [
            Paragraph("For the Company", sig_label_style),
            Paragraph("Candidate Acknowledgement", sig_label_style),
        ],
        [
            Paragraph("________________________", sig_name_style),
            Paragraph("________________________", sig_name_style),
        ],
        [
            Paragraph(f"Authorised Signatory<br/>{company_name}", sig_label_style),
            Paragraph(f"{candidate_name}<br/>Date: _________________", sig_label_style),
        ],
    ]
    sig_table = Table(sig_data, colWidths=["50%", "50%"])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_table)

    # --- Footer ---
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=4))
    story.append(Paragraph(
        f"This document is confidential and intended solely for <b>{candidate_name}</b> ({candidate_email}). "
        f"Unauthorised reproduction or distribution is strictly prohibited. "
        f"© {date.today().year} {company_name}. All rights reserved.",
        footer_style
    ))

    # Build PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
