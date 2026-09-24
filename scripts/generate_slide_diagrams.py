import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Set dark theme matching AutoPulse styling
plt.style.use('dark_background')
BG_COLOR = '#090D16'
CARD_BG = '#131C31'
TEXT_COLOR = '#F8FAFC'
MUTED_TEXT = '#94A3B8'
CYAN = '#06B6D4'
EMERALD = '#10B981'
AMBER = '#F59E0B'
RED = '#EF4444'
PURPLE = '#8B5CF6'

# 1. Cash Conversion Cycle (CCC) Comparison
def make_ccc_diagram(outfile):
    fig, ax = plt.subplots(figsize=(10, 4.5), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    
    # Titles & labels
    ax.text(0.5, 0.95, "Cash Conversion Cycle (CCC): Traditional vs AutoPulse Fintech", 
            fontsize=15, weight='bold', color=TEXT_COLOR, ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.88, "Impact on Working Capital, Unbilled Work-in-Progress (WIP) and Cash Liquidity", 
            fontsize=10, color=MUTED_TEXT, ha='center', transform=ax.transAxes)
    
    # Traditional
    ax.text(0.05, 0.72, "Traditional SME Workshop (Manual / Paper)", fontsize=12, weight='bold', color='#EF4444', transform=ax.transAxes)
    
    # Bars for Traditional: Inventory 30d, WIP 15d, Receivables 20d -> Total 65d
    y_trad = 0.58
    ax.barh(y_trad, 30, left=0, height=0.08, color='#B91C1C', label='Inventory Holding (30 days)')
    ax.barh(y_trad, 15, left=30, height=0.08, color='#D97706', label='Manual Job WIP (15 days)')
    ax.barh(y_trad, 20, left=45, height=0.08, color='#DC2626', label='Receivables Collection (20 days)')
    ax.text(67, y_trad, "CCC: ~65 Days (Capital Locked)", color='#EF4444', weight='bold', fontsize=11, va='center')
    
    # AutoPulse
    ax.text(0.05, 0.42, "AutoPulse Fintech Solution (Real-Time Digital)", fontsize=12, weight='bold', color=CYAN, transform=ax.transAxes)
    
    # Bars for AutoPulse: Inventory 12d, WIP 3d, Receivables 2d -> Total 17d
    y_auto = 0.28
    ax.barh(y_auto, 12, left=0, height=0.08, color='#0284C7', label='Optimized Inventory (12 days)')
    ax.barh(y_auto, 3, left=12, height=0.08, color=CYAN, label='Live Digital WIP (3 days)')
    ax.barh(y_auto, 2, left=15, height=0.08, color=EMERALD, label='Instant WhatsApp / LankaQR (2 days)')
    ax.text(19, y_auto, "CCC: ~17 Days (74% Faster Liquidity!)", color=EMERALD, weight='bold', fontsize=11, va='center')
    
    # Bottom callouts
    box_props = dict(boxstyle='round,pad=0.5', facecolor=CARD_BG, edgecolor='#334155', linewidth=1)
    ax.text(0.18, 0.08, "Working Capital Freed:\n~LKR 1.2M - 2.0M", fontsize=10, weight='bold', color=EMERALD, ha='center', bbox=box_props, transform=ax.transAxes)
    ax.text(0.50, 0.08, "WIP Visibility:\nReal-Time Customer Portal", fontsize=10, weight='bold', color=CYAN, ha='center', bbox=box_props, transform=ax.transAxes)
    ax.text(0.82, 0.08, "Debt Default Risk:\nReduced by 85%", fontsize=10, weight='bold', color=AMBER, ha='center', bbox=box_props, transform=ax.transAxes)
    
    ax.set_xlim(-2, 100)
    ax.set_ylim(0, 1)
    ax.axis('off')
    
    plt.tight_layout()
    plt.savefig(outfile, dpi=200, bbox_inches='tight', facecolor=BG_COLOR)
    plt.close()
    print(f"Saved {outfile}")

# 2. Revenue Composition & Margin Structure
def make_margin_diagram(outfile):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.5), facecolor=BG_COLOR)
    for ax in (ax1, ax2): ax.set_facecolor(BG_COLOR)
    
    # Donut Chart: Revenue Mix
    labels = ['Labour Services\n(58%)', 'Parts Replacement\n(37%)', 'Other / Tuning\n(5%)']
    sizes = [58, 37, 5]
    colors = [CYAN, PURPLE, AMBER]
    
    wedges, texts, autotexts = ax1.pie(sizes, labels=labels, autopct='%1.0f%%', pctdistance=0.75,
                                       startangle=140, colors=colors, textprops=dict(color=TEXT_COLOR, fontsize=10))
    for at in autotexts: at.set_color('#090D16'); at.set_weight('bold')
    
    centre_circle = plt.Circle((0,0), 0.55, fc=BG_COLOR)
    ax1.add_artist(centre_circle)
    ax1.text(0, 0, "Revenue\nBreakdown", ha='center', va='center', color=CYAN, weight='bold', fontsize=12)
    ax1.set_title("Auto Workshop Revenue Split", color=TEXT_COLOR, fontsize=13, weight='bold', pad=15)
    
    # Bar Chart: Gross Margins
    categories = ['Labour Services', 'Spare Parts', 'Blended Margin']
    margins = [82, 28, 60]
    bar_colors = [CYAN, PURPLE, EMERALD]
    
    bars = ax2.bar(categories, margins, color=bar_colors, width=0.5, edgecolor='#334155')
    ax2.set_ylabel("Gross Profit Margin (%)", color=MUTED_TEXT, fontsize=10)
    ax2.set_ylim(0, 100)
    ax2.grid(axis='y', linestyle='--', alpha=0.2, color='#64748B')
    ax2.tick_params(colors=MUTED_TEXT, labelsize=9)
    ax2.set_title("Gross Profit Margin by Stream", color=TEXT_COLOR, fontsize=13, weight='bold', pad=15)
    
    for bar in bars:
        h = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2., h + 2, f"{h}%", ha='center', va='bottom', color=TEXT_COLOR, weight='bold', fontsize=11)
        
    ax2.text(0.5, -0.22, "Key Managerial Insight: Labour yields ~82% gross margin (time sold),\nwhile parts yield ~28% (goods resold). Accrual tracking separates both!",
             ha='center', va='top', color=MUTED_TEXT, fontsize=9, style='italic', transform=ax2.transAxes)
    
    plt.tight_layout()
    plt.savefig(outfile, dpi=200, bbox_inches='tight', facecolor=BG_COLOR)
    plt.close()
    print(f"Saved {outfile}")

# 3. Sri Lankan Statutory Framework (1 Apr - 31 Mar)
def make_statutory_diagram(outfile):
    fig, ax = plt.subplots(figsize=(10, 4.5), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    
    ax.text(0.5, 0.95, "Sri Lankan Fiscal Year Accounting & Audit Architecture", 
            fontsize=15, weight='bold', color=TEXT_COLOR, ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.88, "Mandatory 1 April – 31 March Financial Cycle Built Directly into AutoPulse", 
            fontsize=10, color=MUTED_TEXT, ha='center', transform=ax.transAxes)
            
    # Timeline
    ax.plot([0.1, 0.9], [0.72, 0.72], color=CYAN, linewidth=3, transform=ax.transAxes)
    ax.scatter([0.1, 0.5, 0.9], [0.72, 0.72, 0.72], color=[EMERALD, AMBER, CYAN], s=120, zorder=5, transform=ax.transAxes)
    
    ax.text(0.1, 0.78, "1 APRIL\nOpening Position\n(Bank, Stock, Capital)", color=EMERALD, weight='bold', fontsize=10, ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.78, "30 SEPTEMBER\nMid-Year Review\n(Interim Tax / Stock Reconcile)", color=AMBER, weight='bold', fontsize=10, ha='center', transform=ax.transAxes)
    ax.text(0.9, 0.78, "31 MARCH\nFiscal Year End\n(Full Statutory Audit Pack)", color=CYAN, weight='bold', fontsize=10, ha='center', transform=ax.transAxes)
    
    # 5 Statements Cards
    cards = [
        ("1. Statement of\nFinancial Performance", "P&L on accrual basis;\nLabour vs Parts split", CYAN),
        ("2. Statement of\nFinancial Position", "Balance sheet verified\noff Trial Balance", EMERALD),
        ("3. Statement of\nCash Flows", "Operating, Investing\n& Financing cash", AMBER),
        ("4. Statement of\nChanges in Equity", "Retained profit b/f &\nStated Share Capital", PURPLE),
        ("5. Trial Balance\n& General Ledger", "Zero-variance double\nentry audit trail", '#EC4899')
    ]
    
    x_positions = [0.1, 0.28, 0.5, 0.72, 0.9]
    for (title, desc, col), x in zip(cards, x_positions):
        box = patches.FancyBboxPatch((x - 0.08, 0.12), 0.16, 0.40,
                                     boxstyle="round,pad=0.03", fc=CARD_BG, ec=col, lw=1.5,
                                     transform=ax.transAxes)
        ax.add_patch(box)
        ax.text(x, 0.43, title, color=col, weight='bold', fontsize=9, ha='center', transform=ax.transAxes)
        ax.text(x, 0.24, desc, color=MUTED_TEXT, fontsize=8, ha='center', transform=ax.transAxes)
        
    ax.axis('off')
    plt.tight_layout()
    plt.savefig(outfile, dpi=200, bbox_inches='tight', facecolor=BG_COLOR)
    plt.close()
    print(f"Saved {outfile}")

# 4. Embedded Fintech Ecosystem
def make_ecosystem_diagram(outfile):
    fig, ax = plt.subplots(figsize=(10, 4.5), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    
    ax.text(0.5, 0.95, "AutoPulse: Embedded Fintech Architecture for Automotive SMEs", 
            fontsize=15, weight='bold', color=TEXT_COLOR, ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.88, "Zero Capex | Cloud-Native | Replaces Fragmented POS, Notebooks & Accounting", 
            fontsize=10, color=MUTED_TEXT, ha='center', transform=ax.transAxes)
            
    # Three tiers:
    # 1. Operational Front (Check-in, Kanban, Customer Portal)
    # 2. Embedded Fintech Engine (Auto-Invoice, LankaQR, Inventory Valuation)
    # 3. Managerial Finance & Statutory (Double-entry, Working Capital, Audit Pack)
    
    tiers = [
        ("OPERATIONAL FRONTEND", ["SmartScan OCR Check-in", "Digital Kanban Board", "Live Customer Portal"], CYAN, 0.20),
        ("EMBEDDED FINTECH ENGINE", ["Auto Invoicing on Completion", "LankaQR / Direct Bank Settlement", "JIT Inventory & Minimum Order Alert"], AMBER, 0.50),
        ("MANAGERIAL FINANCE CORE", ["Live Cash Flow & Working Capital", "Debtors / Creditors Ageing", "Statutory Audit Pack (1 Apr - 31 Mar)"], EMERALD, 0.80)
    ]
    
    for title, items, color, x in tiers:
        box = patches.FancyBboxPatch((x - 0.13, 0.15), 0.26, 0.62,
                                     boxstyle="round,pad=0.03", fc=CARD_BG, ec=color, lw=2,
                                     transform=ax.transAxes)
        ax.add_patch(box)
        ax.text(x, 0.70, title, color=color, weight='bold', fontsize=10, ha='center', transform=ax.transAxes)
        
        y_item = 0.56
        for it in items:
            ibox = patches.FancyBboxPatch((x - 0.115, y_item - 0.05), 0.23, 0.10,
                                         boxstyle="round,pad=0.02", fc='#1E293B', ec='#475569', lw=1,
                                         transform=ax.transAxes)
            ax.add_patch(ibox)
            ax.text(x, y_item, it, color=TEXT_COLOR, fontsize=8.5, weight='medium', ha='center', va='center', transform=ax.transAxes)
            y_item -= 0.14
            
    # Connecting Arrows
    ax.annotate('', xy=(0.37, 0.45), xytext=(0.33, 0.45), xycoords='axes fraction',
                arrowprops=dict(facecolor=CYAN, edgecolor=CYAN, arrowstyle="->", lw=2.5))
    ax.annotate('', xy=(0.67, 0.45), xytext=(0.63, 0.45), xycoords='axes fraction',
                arrowprops=dict(facecolor=AMBER, edgecolor=AMBER, arrowstyle="->", lw=2.5))
                
    ax.text(0.5, 0.06, "Outcome: Complete Financial Discipline Without Hiring an In-House Finance Officer",
            fontsize=10, weight='bold', color=EMERALD, ha='center', transform=ax.transAxes)
            
    ax.axis('off')
    plt.tight_layout()
    plt.savefig(outfile, dpi=200, bbox_inches='tight', facecolor=BG_COLOR)
    plt.close()
    print(f"Saved {outfile}")

if __name__ == '__main__':
    out_dir = '/Users/nilan/Desktop/MazdaBuddy/walkthrough/slides_assets'
    make_ccc_diagram(f'{out_dir}/diagram_ccc.png')
    make_margin_diagram(f'{out_dir}/diagram_margins.png')
    make_statutory_diagram(f'{out_dir}/diagram_statutory.png')
    make_ecosystem_diagram(f'{out_dir}/diagram_ecosystem.png')
