import jsPDF from 'jspdf';
import type {
    ProfitAndLoss, AssetSchedule, BalanceSheet, LedgerEntry, TrialBalance, CashFlow, JournalEntry,
} from './finance';
import { round2 } from './finance';
import { describePeriod, formatRange } from './fiscal';

/**
 * The audit pack: the statements a Sri Lankan private company's auditor works
 * from, in the order they expect them.
 *
 * Lives outside the component so it can be generated and inspected in Node.
 * jsPDF never paginates on its own — anything drawn past the page height is
 * discarded silently — so every block reserves its space before drawing.
 */

/** The statements a user can pick from. Order here is the order they print. */
export const STATEMENTS = [
    { key: 'income', title: 'Statement of Financial Performance', blurb: 'Revenue, cost of sales, expenses and profit' },
    { key: 'expenses', title: 'Schedule of Operating Expenses', blurb: 'Every cost category, reconciled to the income statement' },
    { key: 'assets', title: 'Fixed Asset Register', blurb: 'What you own and its depreciation' },
    { key: 'position', title: 'Statement of Financial Position', blurb: 'The balance sheet — assets, liabilities and equity' },
    { key: 'equity', title: 'Statement of Changes in Equity', blurb: 'How retained earnings moved over the period' },
    { key: 'cashflow', title: 'Cash Flow Report', blurb: 'Cash actually received and paid, and what is left' },
    { key: 'trial', title: 'Trial Balance', blurb: 'Every account, debits against credits' },
    { key: 'debtors', title: 'Trade Debtors', blurb: 'Unpaid invoices, aged' },
    { key: 'ledger', title: 'Ledger Report', blurb: 'Cash book, bank book, debtors, creditors and every other account' },
] as const;

export type StatementKey = typeof STATEMENTS[number]['key'];

/**
 * One accent colour per statement, used on its heading rule and number chip so
 * a reader flicking through a long pack can find a section by its colour.
 * Deliberately muted: this is a document an auditor reads, not a dashboard.
 * The Finances picker uses the same hues so the two agree.
 */
export const STATEMENT_COLOURS: Record<StatementKey, [number, number, number]> = {
    income:   [11, 107, 125],   // teal — the trading result
    expenses: [166, 84, 42],    // burnt orange — money going out
    assets:   [92, 78, 140],    // violet — what is owned
    position: [30, 74, 120],    // navy — the balance sheet
    equity:   [46, 104, 92],    // deep green — owners' funds
    cashflow: [24, 118, 110],   // sea green — cash actually moved
    trial:    [90, 90, 100],    // graphite — the underlying books
    debtors:  [150, 106, 30],   // amber — money owed in
    ledger:   [70, 78, 90],     // slate — the detail
};

export interface AuditPackInput {
    company: { name: string; address?: string | null; phone?: string | null };
    startISO: string;
    endISO: string;
    pl: ProfitAndLoss;
    schedules: AssetSchedule[];
    balance: BalanceSheet;
    debtors: { invoiceNumber: string; customer: string; date: string; amount: number; daysOld: number }[];
    ledger: LedgerEntry[];
    journal: JournalEntry[];
    trial: TrialBalance;
    cash: CashFlow;
    /** Set when the tenant has not filled in the balance-sheet inputs. */
    positionsIncomplete: boolean;
    /** Which statements to print. Defaults to all of them. */
    sections?: StatementKey[];
}

/** Never print "Invalid Date" in a document going to an auditor. */
const dmy = (iso: string): string => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
};

const money = (v: number) =>
    (v < 0 ? '(' : '') + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ')' : '');

export function buildAuditPack(input: AuditPackInput): jsPDF {
    const wanted = new Set<StatementKey>(input.sections ?? STATEMENTS.map(s => s.key));
    const show = (k: StatementKey) => wanted.has(k);
    let sectionNo = 0;
    const doc = new jsPDF();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const L = 18, R = W - 18;
    const AMT = R;            // right edge for figures
    const AMT2 = R - 34;      // second money column, for sub-totals
    let y = 0;

    const ensure = (needed: number) => {
        if (y + needed <= H - 22) return;
        doc.addPage();
        y = 22;
    };

    /** Subtitle under a heading — the dating convention the statement requires. */
    const dateline = (text: string) => {
        doc.setFont('helvetica', 'italic').setFontSize(8.2).setTextColor(105);
        doc.text(text, L, y);
        y += 5;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    };

    const longDate = (iso: string) => {
        const d = new Date(`${iso}T00:00:00`);
        return isNaN(d.getTime()) ? '—' : formatRange(d, d).split(' – ')[0];
    };
    const asAt = `as at ${longDate(input.endISO)}`;
    const forPeriod = `for the period ${formatRange(new Date(`${input.startISO}T00:00:00`), new Date(`${input.endISO}T00:00:00`))}`;

    const heading = (text: string, key?: StatementKey) => {
        ensure(20);
        y += 4;
        const [hr, hg, hb] = key ? STATEMENT_COLOURS[key] : [20, 20, 20];

        // Number in a filled chip, title beside it, rule underneath in the same
        // hue — enough to identify a section at a glance without shouting.
        doc.setFillColor(hr, hg, hb);
        doc.roundedRect(L, y - 4.3, 6.6, 6, 1, 1, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255);
        doc.text(String(++sectionNo), L + 3.3, y + 0.1, { align: 'center' });

        doc.setFontSize(11).setTextColor(hr, hg, hb);
        doc.text(text.toUpperCase(), L + 9.4, y);
        y += 2.4;
        doc.setDrawColor(hr, hg, hb).setLineWidth(0.5).line(L, y, R, y);
        y += 6;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    };

    /** One statement line. `col` picks the money column so sub-totals indent. */
    const line = (label: string, value?: number, opts: {
        bold?: boolean; indent?: number; col?: number; rule?: 'none' | 'single' | 'double';
    } = {}) => {
        ensure(7);
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal').setFontSize(9);
        doc.setTextColor(opts.bold ? 20 : 55);
        doc.text(label, L + (opts.indent ?? 0), y);
        if (value !== undefined) doc.text(money(value), opts.col ?? AMT, y, { align: 'right' });
        y += 5.4;
        if (opts.rule && opts.rule !== 'none') {
            const x = (opts.col ?? AMT) - 30;
            doc.setDrawColor(120).setLineWidth(0.3).line(x, y - 3.6, opts.col ?? AMT, y - 3.6);
            if (opts.rule === 'double') doc.line(x, y - 2.4, opts.col ?? AMT, y - 2.4);
            y += 1.5;
        }
    };

    const note = (text: string) => {
        doc.setFont('helvetica', 'italic').setFontSize(7.8).setTextColor(110);
        const lines = doc.splitTextToSize(text, R - L);
        ensure(lines.length * 3.6 + 3);
        doc.text(lines, L, y);
        y += lines.length * 3.6 + 3;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    };

    // ---- cover -------------------------------------------------------------
    y = 30;
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15);
    doc.text(input.company.name.toUpperCase(), W / 2, y, { align: 'center', maxWidth: R - L });
    y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90);
    if (input.company.address) { doc.text(input.company.address, W / 2, y, { align: 'center' }); y += 5; }
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(15);
    doc.text('FINANCIAL STATEMENTS', W / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(70);
    doc.text(describePeriod(input.startISO, input.endISO), W / 2, y, { align: 'center' });
    y += 12;

    doc.setDrawColor(200).setLineWidth(0.3).line(L, y, R, y);
    y += 8;

    note('Prepared from the records held in AutoPulse. These statements are management '
        + 'accounts prepared for audit purposes; they have not been audited. Figures derived from '
        + 'job cards and invoices are traceable to source documents in the system. Bank, cash, '
        + 'payables, loan and capital figures are as entered by management.');

    if (input.positionsIncomplete) {
        ensure(16);
        doc.setFillColor(253, 246, 231).setDrawColor(200, 160, 60).setLineWidth(0.4);
        doc.rect(L, y, R - L, 13, 'FD');
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(140, 90, 20);
        doc.text('INCOMPLETE — opening balances have not been entered.', L + 4, y + 5.5);
        doc.setFont('helvetica', 'normal').setFontSize(7.8);
        doc.text('Bank, cash, loan and capital figures are shown as nil. The statements still articulate, '
            + 'but they do not yet show the real position.', L + 4, y + 10);
        y += 18;
        doc.setTextColor(40);
    }

    const pl = input.pl;
    const cats = Object.entries(pl.expensesByCategory).sort((a, b) => b[1] - a[1]);

    // ---- profit and loss ----------------------------------------------------
    if (show('income')) {
    heading('Statement of Financial Performance', 'income');
    dateline(forPeriod);
    line('Revenue', undefined, { bold: true });
    line('Labour', pl.revenueLabour, { indent: 6, col: AMT2 });
    line('Parts and materials', pl.revenueParts, { indent: 6, col: AMT2 });
    if (pl.discounts > 0) line('Less: discounts allowed', -pl.discounts, { indent: 6, col: AMT2, rule: 'single' });
    line('Total revenue', pl.revenueTotal, { bold: true, indent: 6 });
    y += 2;
    line('Cost of sales', undefined, { bold: true });
    line('Parts consumed, at cost', -pl.costOfParts, { indent: 6, col: AMT2, rule: 'single' });
    line('Gross profit', pl.grossProfit, { bold: true, indent: 6 });
    line(`Gross margin  ${pl.grossMarginPct.toFixed(1)}%`, undefined, { indent: 6 });
    y += 2;

    line('Other income', pl.revenueOther, { bold: true, indent: 6 });
    y += 2;
    line('Operating expenses', undefined, { bold: true });
    if (cats.length === 0) line('None recorded', undefined, { indent: 6 });
    for (const [cat, amt] of cats) line(cat, -amt, { indent: 6, col: AMT2 });
    if (pl.depreciation > 0) line('Depreciation', -pl.depreciation, { indent: 6, col: AMT2 });
    line('Total operating expenses', -(pl.operatingExpenses + pl.depreciation), { indent: 6, rule: 'single' });
    y += 1;
    line('Net profit for the period', pl.netProfit, { bold: true, indent: 6, rule: 'double' });
    }

    // ---- expense schedule ---------------------------------------------------
    // Reconciles to the operating expense total in section 1, depreciation
    // included — a schedule that does not tie back to the statement it supports
    // is the first thing an auditor will query.
    if (show('expenses')) {
    heading('Schedule of Operating Expenses', 'expenses');
    dateline(forPeriod);
    if (cats.length === 0 && pl.depreciation === 0) {
        line('No operating expenses recorded in the period.');
    } else {
        const grandTotal = pl.operatingExpenses + pl.depreciation;
        for (const [cat, amt] of cats) {
            const pct = grandTotal > 0 ? (amt / grandTotal) * 100 : 0;
            line(`${cat}  (${pct.toFixed(1)}%)`, amt, { indent: 4 });
        }
        if (pl.depreciation > 0) {
            const pct = grandTotal > 0 ? (pl.depreciation / grandTotal) * 100 : 0;
            line(`Depreciation  (${pct.toFixed(1)}%)  — non-cash`, pl.depreciation, { indent: 4 });
        }
        line('Total, per the income statement', grandTotal, { bold: true, indent: 4, rule: 'double' });
    }
    }

    // ---- fixed assets -------------------------------------------------------
    if (show('assets')) {
    heading('Fixed Asset Register and Depreciation Schedule', 'assets');
    dateline(asAt);
    if (input.schedules.length === 0) {
        line('No fixed assets recorded.');
    } else {
        ensure(10);
        doc.setFont('helvetica', 'bold').setFontSize(7.6).setTextColor(20);
        doc.text('ASSET', L, y);
        doc.text('ACQUIRED', L + 62, y);
        doc.text('COST', L + 92, y, { align: 'right' });
        doc.text('CHARGE', L + 122, y, { align: 'right' });
        doc.text('ACCUM. DEP.', L + 152, y, { align: 'right' });
        doc.text('NBV', AMT, y, { align: 'right' });
        y += 1.5;
        doc.setDrawColor(150).setLineWidth(0.3).line(L, y, R, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(45);

        let tCost = 0, tCharge = 0, tAccum = 0, tNbv = 0;
        for (const s of input.schedules) {
            ensure(6);
            doc.text(doc.splitTextToSize(s.asset.name, 58)[0], L, y);
            doc.text(dmy(s.asset.purchase_date), L + 62, y);
            doc.text(money(Number(s.asset.cost_lkr)), L + 92, y, { align: 'right' });
            doc.text(money(s.chargeForPeriod), L + 122, y, { align: 'right' });
            doc.text(money(s.accumulated), L + 152, y, { align: 'right' });
            doc.text(money(s.netBookValue), AMT, y, { align: 'right' });
            y += 5;
            tCost += Number(s.asset.cost_lkr); tCharge += s.chargeForPeriod;
            tAccum += s.accumulated; tNbv += s.netBookValue;
        }
        ensure(8);
        doc.setDrawColor(150).line(L, y - 1, R, y - 1);
        y += 3;
        doc.setFont('helvetica', 'bold').setTextColor(20);
        doc.text('Total', L, y);
        doc.text(money(tCost), L + 92, y, { align: 'right' });
        doc.text(money(tCharge), L + 122, y, { align: 'right' });
        doc.text(money(tAccum), L + 152, y, { align: 'right' });
        doc.text(money(tNbv), AMT, y, { align: 'right' });
        y += 6;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
        note('Depreciation is charged on the straight-line basis over the useful life stated for each asset.');
    }
    }

    // ---- balance sheet ------------------------------------------------------
    const b = input.balance;
    if (show('position')) {
    heading('Statement of Financial Position', 'position');
    dateline(asAt);
    line('Assets', undefined, { bold: true });
    line('Non-current — fixed assets at net book value', b.fixedAssetsNbv, { indent: 6, col: AMT2 });
    line('Current — stock of parts, at cost', b.stock, { indent: 6, col: AMT2 });
    line('Current — trade debtors', b.debtors, { indent: 6, col: AMT2 });
    const cashCaveat = input.cash.openingAssumed ? '  (movements only — no opening balance entered)' : '';
    line(`Current — bank${cashCaveat}`, b.bank, { indent: 6, col: AMT2 });
    line('Current — cash in hand', b.cash, { indent: 6, col: AMT2, rule: 'single' });
    line('Total assets', b.totalAssets, { bold: true, indent: 6 });
    y += 2;
    line('Liabilities', undefined, { bold: true });
    line('Trade payables', b.payables, { indent: 6, col: AMT2 });
    line('Loans and borrowings', b.loans, { indent: 6, col: AMT2, rule: 'single' });
    line('Total liabilities', b.totalLiabilities, { bold: true, indent: 6 });
    y += 2;
    line('Equity', undefined, { bold: true });
    line('Stated capital', b.shareCapital, { indent: 6, col: AMT2 });
    line('Retained earnings brought forward', b.retainedEarningsBf, { indent: 6, col: AMT2 });
    line('Profit for the period', b.profitForYear, { indent: 6, col: AMT2, rule: 'single' });
    line('Retained earnings carried forward', b.retainedEarningsCf, { indent: 6, col: AMT2 });
    line('Total equity', b.totalEquity, { bold: true, indent: 6 });
    y += 2;
    line('Total liabilities and equity', b.totalLiabilities + b.totalEquity, { bold: true, indent: 6, rule: 'double' });

    if (!b.balances) {
        y += 2;
        doc.setTextColor(170, 40, 40);
        line(`Unexplained difference`, b.difference, { bold: true, indent: 6 });
        doc.setTextColor(40);
        note('The statement does not balance. This normally means a bank, cash, payables, loan or '
            + 'opening reserves figure has not been entered, or that opening retained earnings do not '
            + 'agree with the prior period. It is shown rather than suppressed so it can be resolved.');
    }
    }

    // ---- changes in equity --------------------------------------------------
    if (show('equity')) {
    heading('Statement of Changes in Equity', 'equity');
    dateline(forPeriod);
    line('Balance brought forward', b.shareCapital + b.retainedEarningsBf, { indent: 6 });
    line('Profit for the period', b.profitForYear, { indent: 6, rule: 'single' });
    line('Balance carried forward', b.totalEquity, { bold: true, indent: 6, rule: 'double' });
    }

    // ---- cash flow ----------------------------------------------------------
    if (show('cashflow')) {
        const c = input.cash;
        heading('Cash Flow Report', 'cashflow');
        dateline(forPeriod);
        note('Prepared on the direct method: every line is money that actually moved through '
            + 'the bank or the till, so each traces back to a transaction. Profit and cash are '
            + 'not the same thing — a profitable month can still leave less in the bank.');

        line('Cash and bank at the start', c.opening, { bold: true, indent: 4 });
        if (c.openingAssumed) {
            note('No opening bank or cash figure was entered, so the start has been taken as nil '
                + 'and the closing figure below is the movement for the period, not the real balance.');
        }
        y += 1;
        line('Received', undefined, { bold: true });
        line('From customers, settling invoices', c.receiptsFromCustomers, { indent: 6, col: AMT2 });
        line('Other income', c.otherReceipts, { indent: 6, col: AMT2, rule: 'single' });
        line('Total received', round2(c.receiptsFromCustomers + c.otherReceipts), { bold: true, indent: 6 });
        y += 1;
        line('Paid out', undefined, { bold: true });
        line('Operating expenses', -c.paymentsForExpenses, { indent: 6, col: AMT2 });
        line('Suppliers, settling bills', -c.paymentsToSuppliers, { indent: 6, col: AMT2 });
        line('Purchase of fixed assets', -c.assetPurchases, { indent: 6, col: AMT2, rule: 'single' });
        line('Total paid out', -round2(c.paymentsForExpenses + c.paymentsToSuppliers + c.assetPurchases),
            { bold: true, indent: 6 });
        y += 1;
        line('Net movement in cash', c.netMovement, { bold: true, indent: 4, rule: 'single' });
        line('Cash and bank at the end', c.closing, { bold: true, indent: 4, rule: 'double' });
    }

    // ---- trial balance ------------------------------------------------------
    if (show('trial')) {
        const t = input.trial;
        heading('Trial Balance', 'trial');
    dateline(asAt);
        note('Every account in the books, on the accrual basis. Debits and credits are equal '
            + 'when the double entry is complete — that equality is what makes an error visible.');
        ensure(9);
        doc.setFont('helvetica', 'bold').setFontSize(7.6).setTextColor(20);
        doc.text('CODE', L, y);
        doc.text('ACCOUNT', L + 18, y);
        doc.text('DEBIT', L + 132, y, { align: 'right' });
        doc.text('CREDIT', AMT, y, { align: 'right' });
        y += 1.5;
        doc.setDrawColor(150).setLineWidth(0.3).line(L, y, R, y);
        y += 4.5;
        for (const row of t.rows) {
            ensure(5.5);
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(50);
            doc.text(row.account.code, L, y);
            doc.text(doc.splitTextToSize(row.account.name, 108)[0], L + 18, y);
            if (row.debit) doc.text(money(row.debit), L + 132, y, { align: 'right' });
            if (row.credit) doc.text(money(row.credit), AMT, y, { align: 'right' });
            y += 4.8;
        }
        ensure(10);
        doc.setDrawColor(150).line(L, y - 1, R, y - 1);
        y += 3.5;
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(20);
        doc.text('Total', L, y);
        doc.text(money(t.totalDebits), L + 132, y, { align: 'right' });
        doc.text(money(t.totalCredits), AMT, y, { align: 'right' });
        y += 6;
        if (!t.balanced) {
            doc.setTextColor(170, 40, 40);
            line('Out of balance by', t.outOfBalance, { bold: true });
            doc.setTextColor(40);
        }
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    }

    // ---- debtors ------------------------------------------------------------
    if (show('debtors')) {
    heading('Trade Debtors — Unpaid Invoices', 'debtors');
    dateline(asAt);
    if (input.debtors.length === 0) {
        line('No unpaid invoices at the period end.');
    } else {
        for (const d of input.debtors) {
            ensure(6);
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(45);
            doc.text(d.invoiceNumber, L, y);
            doc.text(doc.splitTextToSize(d.customer, 60)[0], L + 34, y);
            doc.text(dmy(d.date), L + 100, y);
            doc.text(`${d.daysOld}d`, L + 132, y, { align: 'right' });
            doc.text(money(d.amount), AMT, y, { align: 'right' });
            y += 5;
        }
        y += 1;
        line('Total debtors', input.debtors.reduce((t, d) => t + d.amount, 0), { bold: true, rule: 'double' });
    }
    }

    // ---- ledger -------------------------------------------------------------
    if (show('ledger')) {
    heading('Ledger Report', 'ledger');
    dateline(forPeriod);
    note('Every transaction in the period, grouped into its book. No rows are omitted.');

    // Grouped into the books an accountant asks for by name, rather than one
    // undifferentiated list. Everything that is not cash, bank, debtors or
    // creditors falls under Others, split by account so each can be read on
    // its own.
    const books: { title: string; entries: JournalEntry[] }[] = (() => {
        const inPeriod = input.journal.filter(e => {
            const d = new Date(e.date);
            return d >= new Date(`${input.startISO}T00:00:00`) && d <= new Date(`${input.endISO}T23:59:59`);
        });
        const touches = (e: JournalEntry, code: string) => e.lines.some(l => l.account.code === code);

        const cash = inPeriod.filter(e => touches(e, '1310'));
        const bank = inPeriod.filter(e => touches(e, '1300'));
        const debtors = inPeriod.filter(e => touches(e, '1200'));
        const creditors = inPeriod.filter(e => touches(e, '2000'));
        const claimed = new Set([...cash, ...bank, ...debtors, ...creditors].map(e => e.id));

        // Others, split by the account each remaining entry debits.
        const others = new Map<string, JournalEntry[]>();
        for (const e of inPeriod) {
            if (claimed.has(e.id)) continue;
            const primary = e.lines.find(l => l.amount > 0)?.account.name ?? 'Other';
            others.set(primary, [...(others.get(primary) ?? []), e]);
        }

        return [
            { title: 'Cash Book', entries: cash },
            { title: 'Bank Book', entries: bank },
            { title: 'Trade Debtors', entries: debtors },
            { title: 'Trade Creditors', entries: creditors },
            ...[...others.entries()].sort((a, b) => a[0].localeCompare(b[0]))
                .map(([name, entries]) => ({ title: `Others — ${name}`, entries })),
        ];
    })();

    for (const book of books) {
        ensure(16);
        y += 3;
        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30);
        doc.text(book.title, L, y);
        doc.setFont('helvetica', 'normal').setFontSize(7.6).setTextColor(130);
        doc.text(`${book.entries.length} entr${book.entries.length === 1 ? 'y' : 'ies'}`, AMT, y, { align: 'right' });
        y += 2;
        doc.setDrawColor(200).setLineWidth(0.25).line(L, y, R, y);
        y += 4.5;

        if (book.entries.length === 0) {
            doc.setFont('helvetica', 'italic').setFontSize(7.6).setTextColor(140);
            doc.text('No entries in this period.', L + 2, y);
            y += 5;
            doc.setFont('helvetica', 'normal').setTextColor(40);
            continue;
        }

        ensure(7);
        doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(90);
        doc.text('DATE', L + 2, y);
        doc.text('NARRATIVE', L + 24, y);
        doc.text('ACCOUNT', L + 104, y);
        doc.text('DEBIT', L + 152, y, { align: 'right' });
        doc.text('CREDIT', AMT, y, { align: 'right' });
        y += 4;

        let bDr = 0, bCr = 0;
        for (const e of book.entries) {
            for (const l of e.lines) {
                ensure(4.6);
                doc.setFont('helvetica', 'normal').setFontSize(7.4).setTextColor(55);
                doc.text(dmy(e.date), L + 2, y);
                doc.text(doc.splitTextToSize(e.narrative, 78)[0], L + 24, y);
                doc.text(doc.splitTextToSize(l.account.name, 46)[0], L + 104, y);
                if (l.amount > 0) { doc.text(money(l.amount), L + 152, y, { align: 'right' }); bDr += l.amount; }
                else { doc.text(money(-l.amount), AMT, y, { align: 'right' }); bCr += -l.amount; }
                y += 4.2;
            }
        }
        ensure(7);
        doc.setDrawColor(200).line(L + 100, y - 0.5, R, y - 0.5);
        y += 3;
        doc.setFont('helvetica', 'bold').setFontSize(7.6).setTextColor(30);
        doc.text('Book total', L + 104, y);
        doc.text(money(round2(bDr)), L + 152, y, { align: 'right' });
        doc.text(money(round2(bCr)), AMT, y, { align: 'right' });
        y += 5;
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    }
    }

    // ---- signature + footers ----------------------------------------------
    // A long ledger routinely ends near the foot of a page, so the approval
    // block often starts a fresh one. Statutory accounts carry an approval page
    // anyway, so it is given a heading and a statement rather than being left as
    // two stray rules on an otherwise empty sheet.
    ensure(46);
    y += 12;
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(20);
    doc.text('APPROVAL', L, y);
    y += 2;
    doc.setDrawColor(20).setLineWidth(0.4).line(L, y, R, y);
    y += 7;

    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60);
    const approval = doc.splitTextToSize(
        'These financial statements were approved by the board of directors and signed on its '
        + 'behalf. They are management accounts prepared from the records held in AutoPulse and '
        + 'have not been audited.', R - L);
    doc.text(approval, L, y);
    y += approval.length * 4.4 + 14;

    doc.setDrawColor(60).setLineWidth(0.3);
    doc.line(L, y, L + 62, y);
    doc.line(R - 62, y, R, y);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(70);
    doc.text('Director', L, y + 5);
    doc.text('Date', R - 62, y + 5);

    // The company name is left-aligned against a centred period and a
    // right-aligned page number. A long name ran straight under the centre text,
    // so it is clipped to the space actually available before the centre block
    // begins, with an ellipsis if it does not fit.
    const pages = doc.getNumberOfPages();
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    const periodText = describePeriod(input.startISO, input.endISO);
    const centreHalf = doc.getTextWidth(periodText) / 2;
    const nameSpace = (W / 2 - centreHalf) - L - 6;   // 6mm of clear air

    let footerName = input.company.name;
    if (doc.getTextWidth(footerName) > nameSpace) {
        while (footerName.length > 1 && doc.getTextWidth(footerName + '…') > nameSpace) {
            footerName = footerName.slice(0, -1);
        }
        footerName = footerName.trimEnd() + '…';
    }

    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(140);
        if (nameSpace > 12) doc.text(footerName, L, H - 10);
        doc.text(periodText, W / 2, H - 10, { align: 'center' });
        doc.text(`Page ${p} of ${pages}`, R, H - 10, { align: 'right' });
    }

    return doc;
}
