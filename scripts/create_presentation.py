#!/usr/bin/env python3
"""
Generates a 14-slide widescreen (16:9) PowerPoint presentation on:
'Revamping SME Operations Through Embedded Fintech: A Managerial Finance Case Study of Performance Automotive Engineering (Pvt) Ltd, Sri Lanka'
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ── COLOR PALETTE ─────────────────────────────────────────────────────────────
DARK_BG     = RGBColor(9, 13, 22)      # #090D16
CARD_BG     = RGBColor(19, 28, 49)     # #131C31
CARD_BORDER = RGBColor(51, 65, 85)     # #334155
CYAN        = RGBColor(6, 182, 212)    # #06B6D4 (Brand Primary)
EMERALD     = RGBColor(16, 185, 129)   # #10B981 (Cash / Success)
AMBER       = RGBColor(245, 158, 11)   # #F59E0B (Warning / WIP)
RED         = RGBColor(239, 68, 68)    # #EF4444 (Risk / Debt)
PURPLE      = RGBColor(139, 92, 246)   # #8B5CF6 (Parts / Margins)
WHITE       = RGBColor(248, 250, 252)  # #F8FAFC
TEXT_MUTED  = RGBColor(148, 163, 184)  # #94A3B8
DARK_PILL   = RGBColor(30, 41, 59)     # #1E293B

FONT_HEADING = "Helvetica"
FONT_BODY    = "Arial"

# ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
def apply_slide_bg(slide):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = DARK_BG

def add_header(slide, speaker_tag, title_text, subtitle_text):
    # Speaker Tag Pill
    tx_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8.0), Inches(0.35))
    tf = tx_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p0 = tf.paragraphs[0]
    p0.text = speaker_tag.upper()
    p0.font.name = FONT_HEADING
    p0.font.size = Pt(10)
    p0.font.bold = True
    p0.font.color.rgb = CYAN
    
    # Title
    p1 = tf.add_paragraph()
    p1.text = title_text
    p1.font.name = FONT_HEADING
    p1.font.size = Pt(22)
    p1.font.bold = True
    p1.font.color.rgb = WHITE
    p1.space_before = Pt(4)
    
    # Subtitle
    p2 = tf.add_paragraph()
    p2.text = subtitle_text
    p2.font.name = FONT_BODY
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_MUTED
    p2.space_before = Pt(3)

def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = border_color
    shape.line.width = Pt(1.2)
    return shape

def add_bullet_list(tf, items, font_size=13, space_after=10):
    for i, (title, desc, color) in enumerate(items):
        p = tf.add_paragraph() if i > 0 else tf.paragraphs[0]
        p.space_after = Pt(space_after)
        
        # Bullet / Header
        r1 = p.add_run()
        r1.text = f"•  {title}: "
        r1.font.name = FONT_HEADING
        r1.font.size = Pt(font_size)
        r1.font.bold = True
        r1.font.color.rgb = color if color else WHITE
        
        # Description
        r2 = p.add_run()
        r2.text = desc
        r2.font.name = FONT_BODY
        r2.font.size = Pt(font_size - 1)
        r2.font.color.rgb = TEXT_MUTED

def set_speaker_notes(slide, notes_text):
    # Note: python-pptx notes_slide produces XML schema incompatibilities with Apple Keynote.
    # Speaker notes are provided in the companion PRESENTATION_GUIDE.md.
    pass

# ── PRESENTATION BUILDER ──────────────────────────────────────────────────────
def create_deck(output_pptx):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]
    
    asset_dir = '/Users/nilan/Desktop/MazdaBuddy/walkthrough'
    diagram_dir = f'{asset_dir}/slides_assets'
    
    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s1)
    
    # Background decorative card
    add_card(s1, Inches(1.0), Inches(1.0), Inches(11.333), Inches(5.5), bg_color=CARD_BG, border_color=CYAN)
    
    tb = s1.shapes.add_textbox(Inches(1.5), Inches(1.4), Inches(10.333), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "MANAGERIAL FINANCE  |  CASE STUDY & FINTECH STRATEGY"
    p.font.name = FONT_HEADING
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = CYAN
    
    p = tf.add_paragraph()
    p.text = "Revamping SME Operations\nThrough Embedded Fintech"
    p.font.name = FONT_HEADING
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.space_before = Pt(14)
    p.space_after = Pt(12)
    
    p = tf.add_paragraph()
    p.text = "Financial Discipline, Working Capital Acceleration & Market Advantage for Sri Lankan Workshops"
    p.font.name = FONT_BODY
    p.font.size = Pt(15)
    p.font.color.rgb = TEXT_MUTED
    
    # Metadata Pill Box
    add_card(s1, Inches(1.5), Inches(4.8), Inches(10.333), Inches(1.2), bg_color=DARK_PILL, border_color=CARD_BORDER)
    tb_meta = s1.shapes.add_textbox(Inches(1.7), Inches(4.9), Inches(10.0), Inches(1.0))
    tf_m = tb_meta.text_frame
    
    p = tf_m.paragraphs[0]
    p.text = "CASE SME: Performance Automotive Engineering (Pvt) Ltd, Piliyandala  •  SOLUTION: AutoPulse Platform"
    p.font.name = FONT_HEADING
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    
    p = tf_m.add_paragraph()
    p.text = "PRESENTERS: Group B15  •  DURATION: 12 Minutes (4 Speakers + Live Demonstration Video)"
    p.font.name = FONT_BODY
    p.font.size = Pt(11)
    p.font.color.rgb = WHITE
    p.space_before = Pt(4)
    
    set_speaker_notes(s1, 
        "SPEAKER 1 (0:00 - 0:30):\n"
        "Good morning everyone. We are Group B15. Today we present how an embedded Fintech solution can transform "
        "a specialized automotive engineering workshop in Sri Lanka from a traditional manual operation into a "
        "financially disciplined, high-visibility business with an enduring competitive advantage.")

    # =========================================================================
    # SLIDE 2: THE SME PROFILE (Speaker 1)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s2)
    add_header(s2, "Speaker 1  |  0:30 - 1:15", "The SME Profile: Performance Automotive Engineering",
               "A high-value precision automotive workshop in Piliyandala, Western Province, Sri Lanka")
    
    # Left Column: Key Operational Cues
    add_card(s2, Inches(0.8), Inches(1.5), Inches(6.0), Inches(5.4))
    tb_cues = s2.shapes.add_textbox(Inches(1.1), Inches(1.7), Inches(5.4), Inches(5.0))
    tf_c = tb_cues.text_frame
    tf_c.word_wrap = True
    
    cues_s2 = [
        ("Specialized Niche", "Not a basic lube-bay or generic service shop; focuses on advanced performance tuning, ECU remapping, engine reliability & diagnostics.", CYAN),
        ("Scale & Capacity", "Services 40+ vehicles per month with a tight team of 5 skilled technicians and engineers.", WHITE),
        ("Governance Structure", "Co-ownership model; owners actively work on vehicle builds while managing day-to-day administrative tasks.", WHITE),
        ("Customer Retention", "High client trust, enthusiast loyalty, and strong word-of-mouth reputation in the local automotive community.", EMERALD),
        ("Financial Dilemma", "High technical value created on the shop floor, but captured inefficiently due to manual, paper-based administration.", AMBER),
    ]
    add_bullet_list(tf_c, cues_s2, font_size=12, space_after=12)
    
    # Right Column: Screenshot of Workshop Identity & Settings
    img_path = f"{asset_dir}/12-settings.png"
    if os.path.exists(img_path):
        s2.shapes.add_picture(img_path, Inches(7.1), Inches(1.5), width=Inches(5.4))
    
    set_speaker_notes(s2,
        "SPEAKER 1 (0:30 - 1:15):\n"
        "First, let me introduce the enterprise. Performance Automotive Engineering is based in Piliyandala. "
        "Unlike generic servicing garages, this workshop specializes in high-value performance tuning, electronic diagnostics, "
        "and custom reliability builds. Currently, it handles 40+ vehicles a month with a lean team of five. "
        "The technical expertise is exceptional, and client relationships are personal and dedicated. "
        "However, as we will see, high mechanical craftsmanship does not automatically translate into financial efficiency.")

    # =========================================================================
    # SLIDE 3: SRI LANKAN MACRO & SME FINANCIAL REALITY (Speaker 1)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s3)
    add_header(s3, "Speaker 1  |  1:15 - 2:00", "The Sri Lankan SME Context: Macro Volatility & Capital Strain",
               "Why traditional informal management is no longer sustainable in Sri Lanka's current economic climate")
    
    # 3 Metric Cards across the screen
    cards_data = [
        ("Import Restrictions & Parts Inflation", "Severe currency fluctuation and import barriers in Sri Lanka mean spare parts costs fluctuate wildly. Carrying dead stock or mispricing parts leads directly to unrecoverable margin losses.", RED, Inches(0.8)),
        ("Prohibitive Cost of Debt (>18-24%)", "With commercial borrowing rates historically high in Sri Lanka, SME workshops cannot rely on bank overdrafts. Working capital must be self-generated from rapid receivables and lean inventory.", AMBER, Inches(4.8)),
        ("The 'Informal Management' Trap", "Most Sri Lankan auto workshops rely on memory, pocket notebooks, and delayed verbal billing. Over 30% of unbilled minor parts and labour hours are quietly lost each month.", CYAN, Inches(8.8))
    ]
    
    for title, text, col, left in cards_data:
        add_card(s3, left, Inches(1.5), Inches(3.7), Inches(4.5), border_color=col)
        tb = s3.shapes.add_textbox(left + Inches(0.2), Inches(1.8), Inches(3.3), Inches(4.0))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT_HEADING
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = col
        p.space_after = Pt(12)
        
        p2 = tf.add_paragraph()
        p2.text = text
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = WHITE
        p2.line_spacing = 1.2
        
    # Transition Banner at Bottom
    add_card(s3, Inches(0.8), Inches(6.2), Inches(11.733), Inches(0.8), bg_color=DARK_PILL, border_color=CARD_BORDER)
    tb_b = s3.shapes.add_textbox(Inches(1.0), Inches(6.3), Inches(11.3), Inches(0.6))
    tf_b = tb_b.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = "TRANSITION: Chathura will now examine the operational bottlenecks and the Fintech solution."
    p_b.font.name = FONT_HEADING
    p_b.font.size = Pt(11)
    p_b.font.bold = True
    p_b.font.color.rgb = CYAN
    
    set_speaker_notes(s3,
        "SPEAKER 1 (1:15 - 2:00):\n"
        "In Sri Lanka today, auto workshops operate under intense macro pressures: rapid parts price inflation, currency swings, "
        "and steep financing costs. Workshops can no longer afford to operate on loose memory and pocketbooks. "
        "Every rupee tied up in unbilled labour or forgotten stock damages cash flow. "
        "To explain the operational bottlenecks and how we designed a Fintech intervention, I hand over to Chathura.")

    # =========================================================================
    # SLIDE 4: THE OPERATIONAL & FINANCIAL BLINDSPOT (Speaker 2)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s4)
    add_header(s4, "Speaker 2 (Chathura)  |  2:00 - 2:45", "The Operational Reality: Paper-Based Administrative Blindspots",
               "The disconnect between high technical skill on the floor and zero visibility in the back-office")
    
    # Left Card: Traditional Friction
    add_card(s4, Inches(0.8), Inches(1.5), Inches(5.7), Inches(5.4))
    tb_l = s4.shapes.add_textbox(Inches(1.1), Inches(1.7), Inches(5.1), Inches(5.0))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True
    
    p = tf_l.paragraphs[0]
    p.text = "THE 4 MAJOR ADMINISTRATIVE BREAKDOWNS"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RED
    p.space_after = Pt(14)
    
    cues_s4 = [
        ("Manual Paper Job Cards", "Work instructions scribbled on paper grease-sheets; prone to being misplaced, torn, or incomplete.", RED),
        ("Telephone Call Tracking", "Customers constantly call for updates, interrupting technicians and halting billable hours.", AMBER),
        ("Delayed End-of-Job Billing", "Invoices manually hand-written at collection; parts prices guessed from memory, discounts unrecorded.", RED),
        ("Total Financial Blindness", "The owner cannot tell at any given moment: What is unbilled WIP? Who owes money? Are we profitable?", WHITE)
    ]
    add_bullet_list(tf_l, cues_s4, font_size=12, space_after=14)
    
    # Right Card: Financial Consequence Table
    add_card(s4, Inches(6.8), Inches(1.5), Inches(5.7), Inches(5.4))
    tb_r = s4.shapes.add_textbox(Inches(7.1), Inches(1.7), Inches(5.1), Inches(5.0))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    
    p_r = tf_r.paragraphs[0]
    p_r.text = "MANAGERIAL FINANCE CONSEQUENCES"
    p_r.font.name = FONT_HEADING
    p_r.font.size = Pt(13)
    p_r.font.bold = True
    p_r.font.color.rgb = AMBER
    p_r.space_after = Pt(14)
    
    consequences = [
        ("Revenue Leakage", "5% to 8% of consumables (fluids, clips, seals) never make it onto the invoice.", TEXT_MUTED),
        ("Delayed Cash Conversion", "Customers take days or weeks to settle hand-written bills without digital payment links.", TEXT_MUTED),
        ("Distorted Unit Economics", "Management cannot distinguish whether profit came from high-margin labour or low-margin parts.", TEXT_MUTED),
        ("Tax & Audit Vulnerability", "Zero audit trail for Sri Lankan tax authorities; annual accounts assembled in chaos at year-end.", TEXT_MUTED)
    ]
    for h, d, c in consequences:
        p_item = tf_r.add_paragraph()
        p_item.text = f"⚠  {h}: {d}"
        p_item.font.name = FONT_BODY
        p_item.font.size = Pt(11)
        p_item.font.color.rgb = WHITE
        p_item.space_after = Pt(12)
        
    set_speaker_notes(s4,
        "SPEAKER 2 (2:00 - 2:45):\n"
        "Thank you. When we examined Performance Automotive, we saw that their technical side was thriving, "
        "but their administration was completely trapped in paper. "
        "When a car arrives, details are written on a manual card. Progress is shared through phone calls. "
        "At delivery, someone calculates an invoice on paper. "
        "The real problem is not just messiness—it is lack of visibility. The co-owners could not see live work-in-progress, "
        "what parts were fitted, what remained unbilled, or whether the current month was actually cash positive.")

    # =========================================================================
    # SLIDE 5: THE SRI LANKAN FINTECH PARADOX (Speaker 2)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s5)
    add_header(s5, "Speaker 2 (Chathura)  |  2:45 - 3:30", "The Fintech Paradox for Sri Lankan SMEs",
               "Why off-the-shelf banking and enterprise fintech often fails small automotive workshops")
    
    # 2 Comparison Columns: Traditional Fintech vs The Real SME Need
    add_card(s5, Inches(0.8), Inches(1.5), Inches(5.7), Inches(5.4), border_color=RED)
    tb_barriers = s5.shapes.add_textbox(Inches(1.1), Inches(1.7), Inches(5.1), Inches(5.0))
    tf_b = tb_barriers.text_frame
    tf_b.word_wrap = True
    
    p = tf_b.paragraphs[0]
    p.text = "TRADITIONAL FINTECH / ERP BARRIERS"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = RED
    p.space_after = Pt(12)
    
    barriers = [
        ("POS Hardware Costs", "POS terminal rentals (LKR 3,000–5,000/mo) + merchant transaction fees (2.5% to 3.5%) eat into slim parts margins.", RED),
        ("Complex Bank Onboarding", "Lengthy KYC, corporate guarantees, and merchant approval cycles from commercial banks.", TEXT_MUTED),
        ("Rigid Accounting Software", "QuickBooks/Xero require accounting knowledge, separate manual data entry, and lack garage workflow.", TEXT_MUTED),
        ("Capex Friction", "Upfront software licenses ($500–$2,000/yr) are prohibitive for a 5-person workshop in Sri Lanka.", RED)
    ]
    add_bullet_list(tf_b, barriers, font_size=11.5, space_after=10)
    
    # Right Column: The Lightweight Embedded Fintech Mandate
    add_card(s5, Inches(6.8), Inches(1.5), Inches(5.7), Inches(5.4), border_color=EMERALD)
    tb_need = s5.shapes.add_textbox(Inches(7.1), Inches(1.7), Inches(5.1), Inches(5.0))
    tf_n = tb_need.text_frame
    tf_n.word_wrap = True
    
    p = tf_n.paragraphs[0]
    p.text = "WHAT AUTO-WORKSHOPS ACTUALLY NEED"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(12)
    
    needs = [
        ("Zero Capex Architecture", "Cloud-native web app running on existing smartphones and workshop laptops — zero new hardware.", EMERALD),
        ("Embedded in Daily Workflow", "Fintech must happen automatically as a byproduct of mechanics logging parts and completing jobs.", CYAN),
        ("LankaQR & Direct Settlement", "Bypasses expensive card interchange fees; utilizes Sri Lanka's low-cost national LankaQR rails.", EMERALD),
        ("Statutory Native (1 Apr – 31 Mar)", "Calculations must automatically map to Sri Lanka's Inland Revenue fiscal requirements.", CYAN)
    ]
    add_bullet_list(tf_n, needs, font_size=11.5, space_after=10)
    
    set_speaker_notes(s5,
        "SPEAKER 2 (2:45 - 3:30):\n"
        "Many ask: why don't SMEs simply adopt digital banking and POS terminals? "
        "In Sri Lanka, traditional fintech presents steep barriers: terminal monthly rentals, 2.5% merchant transaction fees, "
        "and months of bank paperwork. Furthermore, generic accounting packages like QuickBooks require a full-time clerk to re-type data. "
        "For an SME with five employees, digitalization must be lightweight, zero-capex, and embedded right into their daily mechanical workflow.")

    # =========================================================================
    # SLIDE 6: INTRODUCING AUTOPULSE (Speaker 2)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s6)
    add_header(s6, "Speaker 2 (Chathura)  |  3:30 - 4:30", "The Solution: AutoPulse Connected Fintech Platform",
               "Unifying shop-floor vehicle workflows, real-time inventory, and embedded managerial finance")
    
    # Left Column: Platform Capabilities
    add_card(s6, Inches(0.8), Inches(1.5), Inches(4.5), Inches(5.4))
    tb_ap = s6.shapes.add_textbox(Inches(1.0), Inches(1.7), Inches(4.1), Inches(5.0))
    tf_ap = tb_ap.text_frame
    tf_ap.word_wrap = True
    
    p = tf_ap.paragraphs[0]
    p.text = "THE UNIFIED WORKFLOW"
    p.font.name = FONT_HEADING
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.space_after = Pt(12)
    
    ap_cues = [
        ("SmartScan Check-In", "On-device OCR recognizes license plate instantly; retrieves vehicle service history in seconds.", WHITE),
        ("Digital Kanban Board", "Tracks status: Pending -> In Progress -> Waiting Parts -> Completed.", CYAN),
        ("Automated Invoicing", "Job card automatically compiles parts and labor into a compliant digital invoice on completion.", EMERALD),
        ("Omnichannel Settlement", "One-click invoice dispatch via WhatsApp and SMS with payment links.", AMBER),
        ("Live Financial Dashboard", "Real-time P&L, debtors, creditors, and bank balances without manual bookkeeping.", EMERALD)
    ]
    add_bullet_list(tf_ap, ap_cues, font_size=11, space_after=10)
    
    # Right Column: Ecosystem Architecture Diagram
    diag_path = f"{diagram_dir}/diagram_ecosystem.png"
    if os.path.exists(diag_path):
        s6.shapes.add_picture(diag_path, Inches(5.6), Inches(1.5), width=Inches(6.9))
        
    set_speaker_notes(s6,
        "SPEAKER 2 (3:30 - 4:30):\n"
        "Our answer to this problem is AutoPulse — a purpose-built platform that connects workshop operations to an embedded financial core. "
        "From the moment a vehicle enters, license plates are scanned, digital job cards track progress, parts are deducted live, "
        "and an invoice is generated automatically upon completion. "
        "The owners gain complete operational visibility, but the true transformative power is in Managerial Finance. "
        "I now hand over to Speaker 3 to dive deep into the financial features.")

    # =========================================================================
    # SLIDE 7: CASH CONVERSION CYCLE & WORKING CAPITAL (Speaker 3)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s7)
    add_header(s7, "Speaker 3  |  4:30 - 5:15", "Managerial Finance: Compressing the Cash Conversion Cycle (CCC)",
               "Mathematical framework: Accelerating cash flow from 65 days down to 17 days")
    
    # Top Card: Formula & Metrics
    add_card(s7, Inches(0.8), Inches(1.5), Inches(11.733), Inches(1.0), bg_color=DARK_PILL, border_color=CYAN)
    tb_f = s7.shapes.add_textbox(Inches(1.0), Inches(1.55), Inches(11.3), Inches(0.9))
    tf_f = tb_f.text_frame
    p = tf_f.paragraphs[0]
    p.text = "THE CCC FORMULA:  Cash Conversion Cycle  =  Days Inventory Outstanding (DIO) + Days Sales Outstanding (DSO) − Days Payables Outstanding (DPO)"
    p.font.name = FONT_HEADING
    p.font.size = Pt(11.5)
    p.font.bold = True
    p.font.color.rgb = WHITE
    
    p2 = tf_f.add_paragraph()
    p2.text = "Traditional Workshop: DIO (30d) + DSO (20d) + WIP (15d) = ~65 Days  vs  AutoPulse Fintech: DIO (12d) + DSO (2d) + WIP (3d) = ~17 Days"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(11)
    p2.font.color.rgb = EMERALD
    p2.space_before = Pt(3)
    
    # Left Column: CCC Diagram
    diag_ccc = f"{diagram_dir}/diagram_ccc.png"
    if os.path.exists(diag_ccc):
        s7.shapes.add_picture(diag_ccc, Inches(0.8), Inches(2.7), width=Inches(7.2))
        
    # Right Column: Managerial Finance Takeaways
    add_card(s7, Inches(8.3), Inches(2.7), Inches(4.2), Inches(4.2))
    tb_ccc = s7.shapes.add_textbox(Inches(8.5), Inches(2.9), Inches(3.8), Inches(3.8))
    tf_ccc = tb_ccc.text_frame
    tf_ccc.word_wrap = True
    
    p = tf_ccc.paragraphs[0]
    p.text = "WORKING CAPITAL IMPACT"
    p.font.name = FONT_HEADING
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(10)
    
    ccc_points = [
        ("Trapped Cash Released", "Accelerating receivables and WIP frees ~LKR 1.5M to 2.0M in liquid operating cash.", EMERALD),
        ("Zero Overdraft Need", "Self-funded cash flow eliminates reliance on high-interest (20%+) emergency loans.", WHITE),
        ("Eliminated Unbilled WIP", "Mechanics cannot deliver a vehicle without the system registering every fitted part.", CYAN),
        ("Debtors Ageing Alert", "Real-time aging buckets identify overdue customer balances before they turn into bad debts.", AMBER)
    ]
    add_bullet_list(tf_ccc, ccc_points, font_size=11, space_after=10)
    
    set_speaker_notes(s7,
        "SPEAKER 3 (4:30 - 5:15):\n"
        "Let's look at the financial engine of AutoPulse. In managerial finance, the Cash Conversion Cycle measures how quickly "
        "invested cash returns to the business. In a traditional workshop, money is locked up for over two months: "
        "spare parts sit on shelves for 30 days, jobs linger on the floor for 15 days, and receivables take 20 days to collect. "
        "With AutoPulse, live job tracking compresses work-in-progress to 3 days, and instant WhatsApp billing with LankaQR reduces collection to 2 days. "
        "The overall cycle drops from 65 days to 17 days—freeing up to 2 million rupees in liquid working capital!")

    # =========================================================================
    # SLIDE 8: INVENTORY MANAGEMENT & CAPITAL LOCKUP (Speaker 3)
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s8)
    add_header(s8, "Speaker 3  |  5:15 - 6:00", "Inventory Optimization: Stopping Working Capital Leaks",
               "Treating parts as invested working capital, not unmonitored physical metal on a shelf")
    
    # Left Column: Screenshot of Inventory Table
    img_inv = f"{asset_dir}/inventory_with_items.png"
    if os.path.exists(img_inv):
        s8.shapes.add_picture(img_inv, Inches(0.8), Inches(1.5), width=Inches(6.6))
        
    # Right Column: Managerial Finance Rules That Bite
    add_card(s8, Inches(7.6), Inches(1.5), Inches(4.9), Inches(5.4))
    tb_inv = s8.shapes.add_textbox(Inches(7.8), Inches(1.7), Inches(4.5), Inches(5.0))
    tf_inv = tb_inv.text_frame
    tf_inv.word_wrap = True
    
    p = tf_inv.paragraphs[0]
    p.text = "INVENTORY FINANCE PRINCIPLES"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.space_after = Pt(12)
    
    inv_rules = [
        ("Parts Are Not Expenses", "Purchasing parts swaps Cash for Stock asset; cost is recognized only when fitted to a customer's job card.", WHITE),
        ("Minimum Stock Levels (MOL)", "Automated threshold alerts prevent stockouts of critical consumables (filters, brake pads, synthetic oil).", EMERALD),
        ("Stopping Silent Cash Bleed", "Workshops restock without recording cash outflows; AutoPulse auto-reconciles stock count to ledger balance.", AMBER),
        ("Zero Negative Stock", "Strict database constraints (stock >= 0) ensure no mechanic can fit a part that was never checked into inventory.", WHITE),
        ("Holding Cost Reduction", "Reduces dead capital lockup by 40%, directly lowering carrying and obsolescence costs.", EMERALD)
    ]
    add_bullet_list(tf_inv, inv_rules, font_size=11, space_after=10)
    
    set_speaker_notes(s8,
        "SPEAKER 3 (5:15 - 6:00):\n"
        "A critical rule in managerial finance that small workshops get wrong: buying parts is not an expense. "
        "It is exchanging liquid cash for inventory stock. Cost of Goods Sold only occurs when the part is fitted to a vehicle. "
        "Before AutoPulse, mechanics would buy parts from local vendors, fit them, and fail to log the purchase—creating negative inventory "
        "and untracked cash leakages. AutoPulse enforces physical-to-financial reconciliation: every part has a cost price, selling price, "
        "and minimum order level alert. This stops capital from rotting away as obsolete stock on the shelf.")

    # =========================================================================
    # SLIDE 9: ACCRUAL ACCOUNTING & MARGIN DECOMPOSITION (Speaker 3)
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s9)
    add_header(s9, "Speaker 3  |  6:00 - 6:45", "Revenue Composition: Labour vs Parts Margin Decomposition",
               "Why revenue must come from authoritative invoices, and why margin separation matters")
    
    # Left Column: Margins Diagram
    diag_margins = f"{diagram_dir}/diagram_margins.png"
    if os.path.exists(diag_margins):
        s9.shapes.add_picture(diag_margins, Inches(0.8), Inches(1.5), width=Inches(6.8))
        
    # Right Column: Strategic Financial Insights
    add_card(s9, Inches(7.8), Inches(1.5), Inches(4.7), Inches(5.4))
    tb_m = s9.shapes.add_textbox(Inches(8.0), Inches(1.7), Inches(4.3), Inches(5.0))
    tf_m = tb_m.text_frame
    tf_m.word_wrap = True
    
    p = tf_m.paragraphs[0]
    p.text = "STRATEGIC MARGIN INSIGHTS"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(12)
    
    margin_cues = [
        ("Labour Is Pure Time Sold", "Yields ~82% gross margin; this is the core profit driver of engineering expertise.", CYAN),
        ("Parts Are Pass-Through Goods", "Yields ~28% gross margin; carries carrying risk, warranty risk, and supplier price volatility.", PURPLE),
        ("The 'Free Labour' Trap Broken", "Workshops often discount labour to justify costly parts; AutoPulse separates both on the invoice.", AMBER),
        ("Accrual Principle Enforced", "Revenue is recognized upon job completion, while cash settlement is a separate event on its own date.", WHITE),
        ("Zero Discrepancy Books", "Double-entry rules ensure debits equal credits at all times across all ledger accounts.", EMERALD)
    ]
    add_bullet_list(tf_m, margin_cues, font_size=11, space_after=10)
    
    set_speaker_notes(s9,
        "SPEAKER 3 (6:00 - 6:45):\n"
        "Examining revenue composition reveals a fundamental managerial finance truth: labour and parts are completely different economic animals. "
        "Labour is billable engineering time, yielding an 82% gross margin. Parts are resold goods yielding only 28%. "
        "Many workshops make the mistake of discounting labour when parts get expensive, effectively giving away their highest-margin asset! "
        "AutoPulse decomposes every invoice into labour, parts, and line discounts. "
        "Because it operates on the accrual basis, revenue is recognized on job completion and settlement on payment—providing pure financial clarity.")

    # =========================================================================
    # SLIDE 10: SRI LANKAN STATUTORY REPORTING & AUDIT PACK (Speaker 3)
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s10)
    add_header(s10, "Speaker 3  |  6:45 - 8:00", "Statutory Compliance: Sri Lankan Fiscal Year Audit Pack",
               "Automating statutory compliance (1 April – 31 March) without hiring an expensive accountant")
    
    # Top Left: Statutory Diagram
    diag_stat = f"{diagram_dir}/diagram_statutory.png"
    if os.path.exists(diag_stat):
        s10.shapes.add_picture(diag_stat, Inches(0.8), Inches(1.5), width=Inches(7.2))
        
    # Right Column: The 5 Automated Statements
    add_card(s10, Inches(8.2), Inches(1.5), Inches(4.3), Inches(4.1))
    tb_stat = s10.shapes.add_textbox(Inches(8.4), Inches(1.7), Inches(3.9), Inches(3.7))
    tf_s = tb_stat.text_frame
    tf_s.word_wrap = True
    
    p = tf_s.paragraphs[0]
    p.text = "THE STATUTORY PACK"
    p.font.name = FONT_HEADING
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.space_after = Pt(8)
    
    stat_items = [
        ("Financial Performance", "P&L on accrual basis; separate labour & parts.", WHITE),
        ("Financial Position", "Balance sheet verified off Trial Balance.", WHITE),
        ("Statement of Cash Flows", "Operating, investing, and financing flows.", WHITE),
        ("Changes in Equity", "Retained earnings b/f and stated capital.", WHITE),
        ("Trial Balance & Ledger", "Zero-variance audit trail for tax authorities.", EMERALD),
    ]
    add_bullet_list(tf_s, stat_items, font_size=10.5, space_after=6)
    
    # Bottom Callout Card: Academic Quote
    add_card(s10, Inches(0.8), Inches(5.8), Inches(11.733), Inches(1.2), bg_color=DARK_PILL, border_color=EMERALD)
    tb_q = s10.shapes.add_textbox(Inches(1.0), Inches(5.9), Inches(11.3), Inches(1.0))
    tf_q = tb_q.text_frame
    tf_q.word_wrap = True
    
    p = tf_q.paragraphs[0]
    p.text = '"In most SMEs, profit, cash, receivables, payables, and inventory live in someone\'s head or scattered across notebooks. ' \
             'AutoPulse enforces real financial discipline. It manages cash on purpose, not by accident, and makes decisions on facts, not feelings."'
    p.font.name = FONT_HEADING
    p.font.size = Pt(11)
    p.font.italic = True
    p.font.color.rgb = WHITE
    
    p2 = tf_q.add_paragraph()
    p2.text = "— Group B15 Core Managerial Finance Thesis  •  Enterprise control without the overhead of an in-house finance team."
    p2.font.name = FONT_BODY
    p2.font.size = Pt(10)
    p2.font.bold = True
    p2.font.color.rgb = EMERALD
    p2.space_before = Pt(3)
    
    set_speaker_notes(s10,
        "SPEAKER 3 (6:45 - 8:00):\n"
        "Finally, on regulatory compliance: in Sri Lanka, the corporate financial year runs strictly from 1 April to 31 March. "
        "AutoPulse is built around this exact fiscal calendar. It produces a complete statutory audit pack at the click of a button: "
        "P&L, Balance Sheet, Cash Flow, Statement of Equity, and a fully balanced Trial Balance. "
        "In most SMEs, profit and cash live in someone's head and drift away from reality. AutoPulse delivers true financial discipline: "
        "managing cash on purpose, making decisions on facts, and running the workshop with the control of a corporate CFO—without hiring one! "
        "I now hand over to our final speaker to summarize the strategic competitive advantage.")

    # =========================================================================
    # SLIDE 11: COMPETITIVE ADVANTAGE & CUSTOMER MOAT (Speaker 4)
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s11)
    add_header(s11, "Speaker 4  |  8:00 - 8:45", "Strategic Advantage: Customer Retention & Communication Moat",
               "How fintech touchpoints and transparent customer tracking build high switching costs")
    
    # Left Column: Customer Screenshot
    img_cust = f"{asset_dir}/08-customers.png"
    if os.path.exists(img_cust):
        s11.shapes.add_picture(img_cust, Inches(0.8), Inches(1.5), width=Inches(6.6))
        
    # Right Column: The Competitive Moat Cues
    add_card(s11, Inches(7.6), Inches(1.5), Inches(4.9), Inches(5.4))
    tb_c = s11.shapes.add_textbox(Inches(7.8), Inches(1.7), Inches(4.5), Inches(5.0))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True
    
    p = tf_c.paragraphs[0]
    p.text = "THE 4 STRATEGIC MOATS"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.space_after = Pt(12)
    
    moat_points = [
        ("Radical Transparency", "Live customer job status portal eliminates owner anxiety; clients see work in progress in real time.", EMERALD),
        ("Frictionless WhatsApp Billing", "Direct WhatsApp invoice delivery with LankaQR payment details leads to 85% same-day settlements.", CYAN),
        ("The Customer Data Asset", "Complete vehicle service history, mileage logs, and past repair registries create unbeatable switching barriers.", WHITE),
        ("Supplier Credit Negotiation", "Transparent payables tracking gives the workshop bargaining power for favorable credit terms.", AMBER)
    ]
    add_bullet_list(tf_c, moat_points, font_size=11.5, space_after=12)
    
    set_speaker_notes(s11,
        "SPEAKER 4 (8:00 - 8:45):\n"
        "As my colleagues have shown, we are not trying to turn Performance Automotive into a bank. "
        "Instead, we have embedded fintech directly into their mechanical workflow. "
        "When an invoice is ready, a single tap sends it directly to the customer's WhatsApp with digital payment details. "
        "Customers can track their car's repair status live on their phones, completely eliminating telephone friction. "
        "More importantly, storing customer vehicle registries in one central database creates a powerful data moat—giving the workshop "
        "an unassailable advantage over traditional paper-based competitors.")

    # =========================================================================
    # SLIDE 12: FINANCIAL ROI, RESILIENCE & SCALABILITY (Speaker 4)
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s12)
    add_header(s12, "Speaker 4  |  8:45 - 9:30", "Business Resilience, ROI & Long-Term Scalability",
               "Quantifying the financial return on investment and organizational peace of mind")
    
    # 3 ROI Cards
    roi_data = [
        ("Administrative Cost Savings", "Saves 15+ hours per week of manual paperwork, phone coordination, and billing reconciliations.", "LKR 100,000+ / mo", "Equivalent to a full-time accountant saved", CYAN, Inches(0.8)),
        ("Working Capital Acceleration", "Compressing CCC from 65 to 17 days frees up trapped capital from unbilled WIP and parts holding.", "LKR 1.5M - 2.0M", "Self-funded liquidity for workshop expansion", EMERALD, Inches(4.8)),
        ("Disaster-Proof Cloud Asset", "Eliminates risk of lost physical invoices or notebook destruction. Bank-grade encrypted multi-tenant cloud.", "100% Redundant", "Multi-device access from phone or PC", AMBER, Inches(8.8))
    ]
    
    for title, desc, metric, metric_desc, col, left in roi_data:
        add_card(s12, left, Inches(1.5), Inches(3.7), Inches(5.4), border_color=col)
        tb = s12.shapes.add_textbox(left + Inches(0.2), Inches(1.7), Inches(3.3), Inches(5.0))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT_HEADING
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = col
        p.space_after = Pt(10)
        
        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.name = FONT_BODY
        p_desc.font.size = Pt(11)
        p_desc.font.color.rgb = TEXT_MUTED
        p_desc.space_after = Pt(20)
        
        # Metric Highlight Box
        p_m = tf.add_paragraph()
        p_m.text = metric
        p_m.font.name = FONT_HEADING
        p_m.font.size = Pt(20)
        p_m.font.bold = True
        p_m.font.color.rgb = WHITE
        p_m.space_after = Pt(4)
        
        p_sub = tf.add_paragraph()
        p_sub.text = metric_desc
        p_sub.font.name = FONT_BODY
        p_sub.font.size = Pt(10)
        p_sub.font.color.rgb = col
        
    set_speaker_notes(s12,
        "SPEAKER 4 (8:45 - 9:30):\n"
        "From a managerial finance perspective, the return on investment is immediate and substantial. "
        "Operationally, AutoPulse saves over 15 hours a week in paperwork—equivalent to over 100,000 rupees a month in bookkeeping costs. "
        "Financially, releasing up to 2 million rupees in trapped working capital allows the owners to expand their toolsets and service bays without debt. "
        "And because the entire system is hosted securely in the cloud, the workshop's entire operational memory is protected against disaster.")

    # =========================================================================
    # SLIDE 13: SUMMARY & VIDEO INTRODUCTION (Speaker 4)
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s13)
    add_header(s13, "Speaker 4  |  9:30 - 10:00", "Summary & Transition to Practical Demonstration",
               "Turning passionate technicians into disciplined, data-driven business leaders")
    
    # Left Card: Core Takeaways
    add_card(s13, Inches(0.8), Inches(1.5), Inches(6.0), Inches(5.4))
    tb_sum = s13.shapes.add_textbox(Inches(1.1), Inches(1.7), Inches(5.4), Inches(5.0))
    tf_sum = tb_sum.text_frame
    tf_sum.word_wrap = True
    
    p = tf_sum.paragraphs[0]
    p.text = "EXECUTIVE SUMMARY FOR MANAGERIAL FINANCE"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.space_after = Pt(14)
    
    takeaways = [
        ("Embedded, Not Imposed", "Fintech succeeds in SMEs when it is invisible—built into grease-monkey workflows, not added as extra bureaucracy.", EMERALD),
        ("Liquidity Over Paper Profit", "Compressing the Cash Conversion Cycle guarantees real bank liquidity to withstand Sri Lanka's economic shocks.", WHITE),
        ("Statutory Peace of Mind", "Automatic alignment with the 1 April – 31 March fiscal year ensures audit readiness at zero marginal cost.", CYAN),
        ("Scalable Market Advantage", "Data assets, customer transparency, and digital speed transform an SME workshop into a modern market leader.", AMBER)
    ]
    add_bullet_list(tf_sum, takeaways, font_size=11.5, space_after=12)
    
    # Right Card: Video Cue Card
    add_card(s13, Inches(7.1), Inches(1.5), Inches(5.4), Inches(5.4), border_color=EMERALD)
    tb_vcue = s13.shapes.add_textbox(Inches(7.4), Inches(1.7), Inches(4.8), Inches(5.0))
    tf_vcue = tb_vcue.text_frame
    tf_vcue.word_wrap = True
    
    p = tf_vcue.paragraphs[0]
    p.text = "UP NEXT: 2-MINUTE DEMONSTRATION VIDEO"
    p.font.name = FONT_HEADING
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.space_after = Pt(16)
    
    p2 = tf_vcue.add_paragraph()
    p2.text = "▶  Owner Perspective:\nHear directly from the co-owner on how real-time visibility transformed operational peace of mind.\n\n" \
              "▶  Customer Onboarding Drama:\nObserve a real vehicle intake, live status tracking, and the delight of transparent digital billing.\n\n" \
              "▶  Fintech in Action:\nWatch instant WhatsApp invoice generation and seamless customer collection."
    p2.font.name = FONT_BODY
    p2.font.size = Pt(12)
    p2.font.color.rgb = WHITE
    p2.line_spacing = 1.3
    
    set_speaker_notes(s13,
        "SPEAKER 4 (9:30 - 10:00):\n"
        "To conclude our managerial finance analysis: AutoPulse proves that SMEs in Sri Lanka don't need expensive bank POS systems "
        "or complex ERPs to achieve financial excellence. By embedding fintech into daily vehicle workflows, Performance Automotive has turned "
        "operational blindspots into a formidable market advantage. "
        "Now, to show you how this looks and feels on the workshop floor, let us share a short two-minute video featuring the workshop owner's testimony "
        "and a customer onboarding experience. Over to the video.")

    # =========================================================================
    # SLIDE 14: VIDEO SHOWCASE SLIDE (10:00 - 12:00)
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    apply_slide_bg(s14)
    add_header(s14, "Video Showcase  |  10:00 - 12:00", "Practical Demonstration: AutoPulse in Action",
               "Featuring owner testimony, customer onboarding drama, and customer satisfaction")
    
    # Large Video Player Placeholder Card
    add_card(s14, Inches(1.5), Inches(1.5), Inches(10.333), Inches(4.8), bg_color=CARD_BG, border_color=CYAN)
    
    tb_vid = s14.shapes.add_textbox(Inches(2.0), Inches(2.3), Inches(9.333), Inches(3.2))
    tf_vid = tb_vid.text_frame
    tf_vid.word_wrap = True
    
    p = tf_vid.paragraphs[0]
    p.text = "▶  VIDEO DEMONSTRATION"
    p.font.name = FONT_HEADING
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.alignment = PP_ALIGN.CENTER
    p.font.color.rgb = CYAN
    
    p2 = tf_vid.add_paragraph()
    p2.text = "AutoPulse Demo: Owner Interview & Customer Onboarding Journey"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(15)
    p2.font.alignment = PP_ALIGN.CENTER
    p2.font.color.rgb = WHITE
    p2.space_before = Pt(10)
    
    p3 = tf_vid.add_paragraph()
    p3.text = "Duration: 2 Minutes  •  Media: walkthrough/autopulse-demo.mp4"
    p3.font.name = FONT_BODY
    p3.font.size = Pt(12)
    p3.font.alignment = PP_ALIGN.CENTER
    p3.font.color.rgb = TEXT_MUTED
    p3.space_before = Pt(8)
    
    # Q&A Footer Card
    add_card(s14, Inches(1.5), Inches(6.5), Inches(10.333), Inches(0.6), bg_color=DARK_PILL, border_color=CARD_BORDER)
    tb_qa = s14.shapes.add_textbox(Inches(1.7), Inches(6.55), Inches(10.0), Inches(0.5))
    tf_qa = tb_qa.text_frame
    p_qa = tf_qa.paragraphs[0]
    p_qa.text = "GROUP B15  •  THANK YOU  •  QUESTIONS & MANAGERIAL FINANCE DISCUSSION"
    p_qa.font.name = FONT_HEADING
    p_qa.font.size = Pt(11)
    p_qa.font.bold = True
    p_qa.font.alignment = PP_ALIGN.CENTER
    p_qa.font.color.rgb = EMERALD
    
    set_speaker_notes(s14,
        "FINAL CUE (10:00 - 12:00):\n"
        "[Play Video]\n"
        "After video concludes:\n"
        "'Thank you for your time. Group B15 is now happy to answer any questions regarding our Managerial Finance analysis "
        "and Fintech implementation for Performance Automotive Engineering.'")
    
    prs.save(output_pptx)
    print(f"Presentation saved successfully to: {output_pptx}")

if __name__ == '__main__':
    out_file = '/Users/nilan/Desktop/MazdaBuddy/Performance_Automotive_Fintech_Managerial_Finance.pptx'
    create_deck(out_file)
