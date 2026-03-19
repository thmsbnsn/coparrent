// Edge function to generate court-ready expense reports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  split_percentage: number;
  notes: string | null;
  receipt_path: string | null;
  creator?: { full_name: string | null; email: string | null };
  child?: { name: string };
}

interface ReimbursementRequest {
  id: string;
  amount: number;
  status: string;
  message: string | null;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
  expense?: Expense;
  requester?: { full_name: string | null; email: string | null };
}

interface ReportData {
  expenses: Expense[];
  reimbursementRequests: ReimbursementRequest[];
  profile: { full_name: string | null; email: string | null };
  coParent: { full_name: string | null; email: string | null } | null;
  dateRange: { start: string; end: string };
  children: { id: string; name: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical/Health',
  education: 'Education/School',
  childcare: 'Childcare',
  clothing: 'Clothing',
  activities: 'Activities/Sports',
  food: 'Food/Groceries',
  transportation: 'Transportation',
  entertainment: 'Entertainment',
  other: 'Other',
};

// HTML escape function to prevent XSS
function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  const str = String(text);
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return escapeHtml(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return escapeHtml(dateStr);
  }
}

function formatCurrency(amount: number): string {
  const num = Number(amount);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

function generateHTML(data: ReportData): string {
  const { expenses, reimbursementRequests, profile, coParent, dateRange, children } = data;
  
  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const myExpenses = expenses.filter(e => e.creator?.email === profile.email);
  const coParentExpenses = expenses.filter(e => e.creator?.email !== profile.email);
  const myTotal = myExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const coParentTotal = coParentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  });
  
  // Reimbursement summary
  const approvedReimbursements = reimbursementRequests.filter(r => r.status === 'approved' || r.status === 'paid');
  const pendingReimbursements = reimbursementRequests.filter(r => r.status === 'pending');
  const rejectedReimbursements = reimbursementRequests.filter(r => r.status === 'rejected');

  // Escape all user-controlled data
  const safeProfileName = escapeHtml(profile.full_name || profile.email || 'Unknown');
  const safeCoParentName = escapeHtml(coParent?.full_name || coParent?.email || 'Not linked');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">
  <title>Co-Parenting Expense Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #21B0FE;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24pt;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .header .subtitle {
      color: #666;
      font-size: 12pt;
    }
    .header .date-range {
      color: #21B0FE;
      font-weight: 600;
      margin-top: 10px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14pt;
      color: #21B0FE;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .party-box {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
    }
    .party-box h4 {
      color: #666;
      font-size: 10pt;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .party-box .name {
      font-size: 12pt;
      font-weight: 600;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .summary-box.highlight {
      background: linear-gradient(135deg, #21B0FE 0%, #0ea5e9 100%);
      color: white;
    }
    .summary-box .label {
      font-size: 9pt;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .summary-box .value {
      font-size: 18pt;
      font-weight: 700;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 10px 8px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      color: #666;
    }
    tr:hover {
      background: #fafafa;
    }
    .amount {
      font-weight: 600;
      color: #059669;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 500;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .status-paid { background: #059669; color: white; }
    .category-breakdown {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .category-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 9pt;
    }
    .receipt-indicator {
      color: #21B0FE;
      font-size: 9pt;
    }
    .children-list {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .child-badge {
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10pt;
    }
    .no-data {
      color: #999;
      font-style: italic;
      padding: 20px;
      text-align: center;
    }
    @media print {
      body {
        padding: 20px;
      }
      .summary-box.highlight {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Co-Parenting Expense Report</h1>
    <div class="subtitle">Shared Child-Related Expenses</div>
    <div class="date-range">${formatDate(dateRange.start)} — ${formatDate(dateRange.end)}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Parties Involved</h2>
    <div class="parties-grid">
      <div class="party-box">
        <h4>Parent 1 (Report Generator)</h4>
        <div class="name">${safeProfileName}</div>
      </div>
      <div class="party-box">
        <h4>Parent 2 (Co-Parent)</h4>
        <div class="name">${safeCoParentName}</div>
      </div>
    </div>
    
    ${children.length > 0 ? `
    <div style="margin-top: 15px;">
      <h4 style="color: #666; font-size: 10pt; margin-bottom: 8px;">CHILDREN</h4>
      <div class="children-list">
        ${children.map(c => `<span class="child-badge">${escapeHtml(c.name)}</span>`).join('')}
      </div>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2 class="section-title">Financial Summary</h2>
    <div class="summary-grid">
      <div class="summary-box highlight">
        <div class="label">Total Expenses</div>
        <div class="value">${formatCurrency(totalExpenses)}</div>
      </div>
      <div class="summary-box">
        <div class="label">${safeProfileName} Expenses</div>
        <div class="value">${formatCurrency(myTotal)}</div>
      </div>
      <div class="summary-box">
        <div class="label">${safeCoParentName} Expenses</div>
        <div class="value">${formatCurrency(coParentTotal)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Expenses by Category</h2>
    <div class="category-breakdown">
      ${Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, total]) => `
          <div class="category-item">
            <span>${escapeHtml(CATEGORY_LABELS[cat] || cat)}</span>
            <span class="amount">${formatCurrency(total)}</span>
          </div>
        `).join('')}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Detailed Expense Log (${expenses.length} entries)</h2>
    ${expenses.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Child</th>
          <th>Added By</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map(e => `
          <tr>
            <td>${formatDate(e.expense_date)}</td>
            <td>
              ${escapeHtml(e.description)}
              ${e.receipt_path ? '<span class="receipt-indicator">📎</span>' : ''}
            </td>
            <td>${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</td>
            <td>${escapeHtml(e.child?.name) || '—'}</td>
            <td>${escapeHtml(e.creator?.full_name || e.creator?.email) || '—'}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(e.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: 600; background: #f0f9ff;">
          <td colspan="5">TOTAL</td>
          <td style="text-align: right;" class="amount">${formatCurrency(totalExpenses)}</td>
        </tr>
      </tfoot>
    </table>
    ` : '<div class="no-data">No expenses recorded in this period</div>'}
  </div>

  <div class="section">
    <h2 class="section-title">Reimbursement History (${reimbursementRequests.length} requests)</h2>
    
    <div class="summary-grid" style="margin-bottom: 15px;">
      <div class="summary-box">
        <div class="label">Approved/Paid</div>
        <div class="value">${approvedReimbursements.length}</div>
      </div>
      <div class="summary-box">
        <div class="label">Pending</div>
        <div class="value">${pendingReimbursements.length}</div>
      </div>
      <div class="summary-box">
        <div class="label">Rejected</div>
        <div class="value">${rejectedReimbursements.length}</div>
      </div>
    </div>
    
    ${reimbursementRequests.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Date Requested</th>
          <th>Expense</th>
          <th>Requester</th>
          <th style="text-align: right;">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${reimbursementRequests.map(r => `
          <tr>
            <td>${formatDate(r.created_at)}</td>
            <td>${escapeHtml(r.expense?.description) || 'Unknown'}</td>
            <td>${escapeHtml(r.requester?.full_name || r.requester?.email) || '—'}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(r.amount)}</td>
            <td>
              <span class="status-badge status-${escapeHtml(r.status)}">${escapeHtml(r.status.toUpperCase())}</span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<div class="no-data">No reimbursement requests in this period</div>'}
  </div>

  <div class="footer">
    <p>This report was generated on ${new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    })}</p>
    <p style="margin-top: 5px;">Generated by CoParrent • Court-Ready Documentation</p>
    <p style="margin-top: 10px; font-size: 8pt; color: #999;">
      This document is provided for informational purposes. All expenses listed have been self-reported 
      by the parties involved. Receipt attachments are indicated with 📎 and stored securely.
    </p>
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[generate-expense-report] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[generate-expense-report] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile to verify access
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, co_parent_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.log('[generate-expense-report] Profile not found:', profileError?.message);
      return new Response(
        JSON.stringify({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const data: ReportData = await req.json();
    
    // Validate required fields
    if (!data.dateRange?.start || !data.dateRange?.end) {
      return new Response(
        JSON.stringify({ error: 'Invalid date range', code: 'INVALID_INPUT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate expenses array
    if (!Array.isArray(data.expenses)) {
      data.expenses = [];
    }

    // Validate reimbursement requests array
    if (!Array.isArray(data.reimbursementRequests)) {
      data.reimbursementRequests = [];
    }

    // Validate children array
    if (!Array.isArray(data.children)) {
      data.children = [];
    }

    // Log metadata only (no sensitive data)
    console.log('[generate-expense-report] Generating report:', {
      userId: user.id,
      profileId: profile.id,
      expenseCount: data.expenses.length,
      reimbursementCount: data.reimbursementRequests.length,
      childCount: data.children.length,
      dateRange: data.dateRange,
    });
    
    const html = generateHTML(data);
    
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-expense-report] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to generate report', code: 'INTERNAL_ERROR' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
