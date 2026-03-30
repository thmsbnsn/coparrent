import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

interface ReportRequest {
  family_id?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

interface ParticipantProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface FamilyAdultRow {
  profile_id: string | null;
  role: string | null;
  profiles?: ParticipantProfileRow | ParticipantProfileRow[] | null;
}

interface ExpenseRow {
  id: string;
  created_by: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  split_percentage: number;
  notes: string | null;
  receipt_path: string | null;
  creator?: ParticipantProfileRow | ParticipantProfileRow[] | null;
  child?: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface ReimbursementExpenseRow {
  id: string;
  description: string;
  family_id: string | null;
}

interface ReimbursementRow {
  id: string;
  expense_id: string;
  requester_id: string;
  recipient_id: string;
  amount: number;
  status: string;
  message: string | null;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
  expense?: ReimbursementExpenseRow | ReimbursementExpenseRow[] | null;
  requester?: ParticipantProfileRow | ParticipantProfileRow[] | null;
}

interface ReportParticipant {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  split_percentage: number;
  notes: string | null;
  receipt_path: string | null;
  creator?: ReportParticipant | null;
  child?: { id: string; name: string } | null;
}

interface ReimbursementRequest {
  id: string;
  amount: number;
  status: string;
  message: string | null;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
  expense?: { description: string } | null;
  requester?: ReportParticipant | null;
}

interface ReportData {
  expenses: Expense[];
  reimbursementRequests: ReimbursementRequest[];
  reportingParent: ReportParticipant;
  otherParent: ReportParticipant | null;
  dateRange: { start: string; end: string };
  children: { id: string; name: string }[];
}

const ACTIVE_PARENT_ROLES = ["parent", "guardian"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  medical: "Medical/Health",
  education: "Education/School",
  childcare: "Childcare",
  clothing: "Clothing",
  activities: "Activities/Sports",
  food: "Food/Groceries",
  transportation: "Transportation",
  entertainment: "Entertainment",
  other: "Other",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const asSingle = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const uniqueIds = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return "";

  return String(text).replace(/[&<>"'`=/]/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;",
      "`": "&#x60;",
      "=": "&#x3D;",
    };

    return replacements[char] || char;
  });
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return escapeHtml(dateStr);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return escapeHtml(dateStr);
  }
}

function formatCurrency(amount: number): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function generateHTML(data: ReportData): string {
  const { expenses, reimbursementRequests, reportingParent, otherParent, dateRange, children } = data;

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const reportingParentExpenses = expenses.filter(
    (expense) => expense.creator?.id === reportingParent.id,
  );
  const otherParentExpenses = expenses.filter(
    (expense) => expense.creator?.id !== reportingParent.id,
  );
  const reportingParentTotal = reportingParentExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );
  const otherParentTotal = otherParentExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((expense) => {
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + Number(expense.amount);
  });

  const approvedReimbursements = reimbursementRequests.filter(
    (request) => request.status === "approved" || request.status === "paid",
  );
  const pendingReimbursements = reimbursementRequests.filter((request) => request.status === "pending");
  const rejectedReimbursements = reimbursementRequests.filter((request) => request.status === "rejected");

  const safeReportingParentName = escapeHtml(
    reportingParent.full_name || reportingParent.email || "Unknown",
  );
  const safeOtherParentName = escapeHtml(
    otherParent?.full_name || otherParent?.email || "No other active parent or guardian",
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">
  <title>CoParrent Expense Report</title>
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
    <h1>CoParrent Expense Report</h1>
    <div class="subtitle">Shared child-related expenses</div>
    <div class="date-range">${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Parents or Guardians</h2>
    <div class="parties-grid">
      <div class="party-box">
        <h4>Report Generated By</h4>
        <div class="name">${safeReportingParentName}</div>
      </div>
      <div class="party-box">
        <h4>Other Active Parent/Guardian</h4>
        <div class="name">${safeOtherParentName}</div>
      </div>
    </div>
    ${children.length > 0 ? `
    <div style="margin-top: 15px;">
      <h4 style="color: #666; font-size: 10pt; margin-bottom: 8px;">CHILDREN</h4>
      <div class="children-list">
        ${children.map((child) => `<span class="child-badge">${escapeHtml(child.name)}</span>`).join("")}
      </div>
    </div>
    ` : ""}
  </div>

  <div class="section">
    <h2 class="section-title">Financial Summary</h2>
    <div class="summary-grid">
      <div class="summary-box highlight">
        <div class="label">Total Expenses</div>
        <div class="value">${formatCurrency(totalExpenses)}</div>
      </div>
      <div class="summary-box">
        <div class="label">${safeReportingParentName} Expenses</div>
        <div class="value">${formatCurrency(reportingParentTotal)}</div>
      </div>
      <div class="summary-box">
        <div class="label">${safeOtherParentName} Expenses</div>
        <div class="value">${formatCurrency(otherParentTotal)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Expenses by Category</h2>
    <div class="category-breakdown">
      ${Object.entries(categoryTotals)
        .sort(([, left], [, right]) => right - left)
        .map(([category, total]) => `
          <div class="category-item">
            <span>${escapeHtml(CATEGORY_LABELS[category] || category)}</span>
            <span class="amount">${formatCurrency(total)}</span>
          </div>
        `)
        .join("")}
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
        ${expenses.map((expense) => `
          <tr>
            <td>${formatDate(expense.expense_date)}</td>
            <td>
              ${escapeHtml(expense.description)}
              ${expense.receipt_path ? '<span class="receipt-indicator">[Receipt]</span>' : ""}
            </td>
            <td>${escapeHtml(CATEGORY_LABELS[expense.category] || expense.category)}</td>
            <td>${escapeHtml(expense.child?.name) || "-"}</td>
            <td>${escapeHtml(expense.creator?.full_name || expense.creator?.email) || "-"}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(expense.amount)}</td>
          </tr>
        `).join("")}
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
        ${reimbursementRequests.map((request) => `
          <tr>
            <td>${formatDate(request.created_at)}</td>
            <td>${escapeHtml(request.expense?.description) || "Unknown"}</td>
            <td>${escapeHtml(request.requester?.full_name || request.requester?.email) || "-"}</td>
            <td style="text-align: right;" class="amount">${formatCurrency(request.amount)}</td>
            <td>
              <span class="status-badge status-${escapeHtml(request.status)}">${escapeHtml(request.status.toUpperCase())}</span>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ` : '<div class="no-data">No reimbursement requests in this period</div>'}
  </div>

  <div class="footer">
    <p>This report was generated on ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</p>
    <p style="margin-top: 5px;">Generated by CoParrent</p>
    <p style="margin-top: 10px; font-size: 8pt; color: #999;">
      This document reflects expense and reimbursement records stored for the selected family in CoParrent.
    </p>
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        corsHeaders,
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const accessToken = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return jsonResponse(
        { error: "Invalid authentication token", code: "INVALID_TOKEN" },
        corsHeaders,
        401,
      );
    }

    const body = (await req.json()) as ReportRequest;
    const familyId = body.family_id?.trim() ?? "";
    const startDate = body.dateRange?.start ?? "";
    const endDate = body.dateRange?.end ?? "";

    if (!familyId) {
      return jsonResponse(
        { error: "family_id is required", code: "FAMILY_ID_REQUIRED" },
        corsHeaders,
        400,
      );
    }

    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
      return jsonResponse(
        { error: "Invalid date range", code: "INVALID_DATE_RANGE" },
        corsHeaders,
        400,
      );
    }

    if (new Date(`${startDate}T00:00:00.000Z`) > new Date(`${endDate}T23:59:59.999Z`)) {
      return jsonResponse(
        { error: "Invalid date range", code: "INVALID_DATE_RANGE" },
        corsHeaders,
        400,
      );
    }

    const { data: callerMembership, error: membershipError } = await supabaseAdmin
      .from("family_members")
      .select("profile_id, role, status")
      .eq("family_id", familyId)
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .maybeSingle<{ profile_id: string | null; role: string | null; status: string | null }>();

    if (membershipError) {
      throw membershipError;
    }

    if (!callerMembership?.profile_id) {
      return jsonResponse(
        { error: "You are not authorized for this family", code: "FAMILY_ACCESS_DENIED" },
        corsHeaders,
        403,
      );
    }

    if (!ACTIVE_PARENT_ROLES.includes((callerMembership.role ?? "") as typeof ACTIVE_PARENT_ROLES[number])) {
      return jsonResponse(
        { error: "Only parents or guardians can generate expense reports", code: "FAMILY_ROLE_REQUIRED" },
        corsHeaders,
        403,
      );
    }

    const { data: familyAdults, error: adultsError } = await supabaseAdmin
      .from("family_members")
      .select(`
        profile_id,
        role,
        profiles!family_members_profile_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq("family_id", familyId)
      .eq("status", "active")
      .in("role", [...ACTIVE_PARENT_ROLES]);

    if (adultsError) {
      throw adultsError;
    }

    const participants = ((familyAdults ?? []) as FamilyAdultRow[])
      .map((adult) => {
        const profile = asSingle(adult.profiles);
        if (!adult.profile_id || !profile) {
          return null;
        }

        return {
          id: adult.profile_id,
          full_name: profile.full_name,
          email: profile.email,
          role: adult.role ?? null,
        } as ReportParticipant;
      })
      .filter((participant): participant is ReportParticipant => participant !== null);

    const reportingParent =
      participants.find((participant) => participant.id === callerMembership.profile_id) ?? null;

    if (!reportingParent) {
      return jsonResponse(
        { error: "Unable to resolve the caller profile for this family", code: "FAMILY_PROFILE_REQUIRED" },
        corsHeaders,
        403,
      );
    }

    const otherParent = participants.find((participant) => participant.id !== reportingParent.id) ?? null;
    const parentProfileIds = participants.map((participant) => participant.id);

    const { data: expenseRows, error: expenseError } = await supabaseAdmin
      .from("expenses")
      .select(`
        id,
        created_by,
        category,
        amount,
        description,
        expense_date,
        split_percentage,
        notes,
        receipt_path,
        creator:profiles!fk_created_by (
          id,
          full_name,
          email
        ),
        child:children (
          id,
          name
        )
      `)
      .eq("family_id", familyId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });

    if (expenseError) {
      throw expenseError;
    }

    const expenses = ((expenseRows ?? []) as ExpenseRow[]).map((expense) => {
      const creator = asSingle(expense.creator);
      const child = asSingle(expense.child);

      return {
        id: expense.id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        expense_date: expense.expense_date,
        split_percentage: expense.split_percentage,
        notes: expense.notes,
        receipt_path: expense.receipt_path,
        creator: creator
          ? {
              id: creator.id,
              full_name: creator.full_name,
              email: creator.email,
              role: null,
            }
          : null,
        child: child
          ? {
              id: child.id,
              name: child.name,
            }
          : null,
      } satisfies Expense;
    });

    const reportRangeStart = `${startDate}T00:00:00.000Z`;
    const reportRangeEnd = `${endDate}T23:59:59.999Z`;

    const { data: reimbursementRows, error: reimbursementError } = await supabaseAdmin
      .from("reimbursement_requests")
      .select(`
        id,
        expense_id,
        requester_id,
        recipient_id,
        amount,
        status,
        message,
        response_message,
        created_at,
        responded_at,
        expense:expenses (
          id,
          description,
          family_id
        ),
        requester:profiles!fk_requester (
          id,
          full_name,
          email
        )
      `)
      .gte("created_at", reportRangeStart)
      .lte("created_at", reportRangeEnd)
      .order("created_at", { ascending: false });

    if (reimbursementError) {
      throw reimbursementError;
    }

    const reimbursementRequests = ((reimbursementRows ?? []) as ReimbursementRow[])
      .map((request) => {
        const expense = asSingle(request.expense);
        const requester = asSingle(request.requester);
        return { request, expense, requester };
      })
      .filter(
        ({ request, expense }) =>
          expense?.family_id === familyId &&
          parentProfileIds.includes(request.requester_id) &&
          parentProfileIds.includes(request.recipient_id),
      )
      .map(({ request, expense, requester }) => ({
        id: request.id,
        amount: request.amount,
        status: request.status,
        message: request.message,
        response_message: request.response_message,
        created_at: request.created_at,
        responded_at: request.responded_at,
        expense: expense ? { description: expense.description } : null,
        requester: requester
          ? {
              id: requester.id,
              full_name: requester.full_name,
              email: requester.email,
              role: null,
            }
          : null,
      } satisfies ReimbursementRequest));

    const { data: parentChildLinks, error: parentChildError } = await supabaseAdmin
      .from("parent_children")
      .select("child_id")
      .in("parent_id", parentProfileIds);

    if (parentChildError) {
      throw parentChildError;
    }

    const childIds = uniqueIds((parentChildLinks ?? []).map((row) => row.child_id));
    let children: Array<{ id: string; name: string }> = [];

    if (childIds.length > 0) {
      const { data: childRows, error: childError } = await supabaseAdmin
        .from("children")
        .select("id, name")
        .in("id", childIds)
        .order("name", { ascending: true });

      if (childError) {
        throw childError;
      }

      children = (childRows ?? []) as Array<{ id: string; name: string }>;
    }

    console.log("[generate-expense-report] Generating report", {
      userId: authData.user.id,
      familyId,
      reportingProfileId: reportingParent.id,
      expenseCount: expenses.length,
      reimbursementCount: reimbursementRequests.length,
      childCount: children.length,
      dateRange: { start: startDate, end: endDate },
    });

    const html = generateHTML({
      expenses,
      reimbursementRequests,
      reportingParent,
      otherParent,
      dateRange: { start: startDate, end: endDate },
      children,
    });

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-expense-report] Error:", errorMessage);
    return jsonResponse(
      { error: "Failed to generate report", code: "INTERNAL_ERROR" },
      corsHeaders,
      500,
    );
  }
});
