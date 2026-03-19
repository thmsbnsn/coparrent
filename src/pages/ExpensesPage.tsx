/**
 * @page-role Overview
 * @summary-pattern Expense totals + pending reimbursements + category breakdown
 * @ownership Creator attribution via resolver; neutral language throughout
 * @court-view Court Report generator creates print-safe financial summary
 * 
 * LAW 1: Overview role - summary-first with action dialogs for add/reimburse
 * LAW 2: getTotals() summary displayed before expense list
 * LAW 3: Uses resolvePersonName for neutral "Added by" attribution
 * LAW 6: Court Report is first-class - prominent header action
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  DollarSign, Plus, Search, Calendar, Filter,
  Receipt, CheckCircle, XCircle, Clock, Download,
  Trash2, Send, Eye, FileText, Users, TrendingUp, AlertCircle
} from "lucide-react";
import { resolveChildName, resolvePersonName } from "@/lib/displayResolver";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { FeatureErrorBoundary } from "@/components/ui/FeatureErrorBoundary";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { ExpenseCharts } from "@/components/expenses/ExpenseCharts";
import { ViewOnlyBadge } from "@/components/ui/ViewOnlyBadge";
import { PermissionButton } from "@/components/ui/PermissionButton";
import { useExpenses, EXPENSE_CATEGORIES, Expense, ReimbursementRequest } from "@/hooks/useExpenses";
import { useChildren } from "@/hooks/useChildren";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { addExpenseSchema } from "@/lib/validations";

function ExpensesPageContent() {
  const { 
    expenses, 
    reimbursementRequests,
    loading, 
    profile,
    addExpense, 
    deleteExpense,
    requestReimbursement,
    respondToReimbursement,
    uploadReceipt,
    getSignedReceiptUrl,
    getTotals,
  } = useExpenses();
  const { children } = useChildren();
  const { permissions } = usePermissions();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // Add expense dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [category, setCategory] = useState("other");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [childId, setChildId] = useState("");
  const [splitPercentage, setSplitPercentage] = useState("50");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    amount?: string;
    description?: string;
    expenseDate?: string;
    notes?: string;
  }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reimbursement dialog
  const [reimbursementExpense, setReimbursementExpense] = useState<Expense | null>(null);
  const [reimbursementAmount, setReimbursementAmount] = useState("");
  const [reimbursementMessage, setReimbursementMessage] = useState("");

  // Response dialog
  const [respondingTo, setRespondingTo] = useState<ReimbursementRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState("");

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Receipt viewer
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  
  // Court report generator
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const totals = getTotals();

  // Validate expense form
  const validateExpenseForm = () => {
    const result = addExpenseSchema.safeParse({
      amount,
      description,
      expenseDate,
      category,
      notes: notes || undefined,
    });
    
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        amount: fieldErrors.amount?.[0],
        description: fieldErrors.description?.[0],
        expenseDate: fieldErrors.expenseDate?.[0],
        notes: fieldErrors.notes?.[0],
      });
      return false;
    }
    
    setErrors({});
    return true;
  };

  // Real-time validation
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      const result = addExpenseSchema.safeParse({
        amount,
        description,
        expenseDate,
        category,
        notes: notes || undefined,
      });
      
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        setErrors(prev => ({
          ...prev,
          ...(touched.amount && { amount: fieldErrors.amount?.[0] }),
          ...(touched.description && { description: fieldErrors.description?.[0] }),
          ...(touched.expenseDate && { expenseDate: fieldErrors.expenseDate?.[0] }),
          ...(touched.notes && { notes: fieldErrors.notes?.[0] }),
        }));
      } else {
        setErrors({});
      }
    }
  }, [amount, description, expenseDate, notes, touched, category]);

  const resetForm = () => {
    setCategory("other");
    setAmount("");
    setDescription("");
    setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
    setChildId("");
    setSplitPercentage("50");
    setNotes("");
    setReceiptFile(null);
    setErrors({});
    setTouched({});
    setIsAddOpen(false);
  };

  const handleAddExpense = async () => {
    setTouched({ amount: true, description: true, expenseDate: true, notes: true });
    if (!validateExpenseForm()) return;

    setIsSaving(true);
    try {
      let receiptPath: string | undefined;
      
      if (receiptFile) {
        const path = await uploadReceipt(receiptFile);
        if (path) receiptPath = path;
      }

      const { error } = await addExpense({
        category,
        amount: parseFloat(amount),
        description,
        expense_date: expenseDate,
        child_id: childId && childId !== "none" ? childId : undefined,
        receipt_path: receiptPath,
        split_percentage: parseFloat(splitPercentage),
        notes: notes || undefined,
      });

      if (error) throw new Error(error);
      
      toast.success("Expense added");
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to add expense");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestReimbursement = async () => {
    if (!reimbursementExpense || !reimbursementAmount) return;

    const { error } = await requestReimbursement(
      reimbursementExpense.id,
      parseFloat(reimbursementAmount),
      reimbursementMessage || undefined
    );

    if (error) {
      toast.error(error);
    } else {
      toast.success("Reimbursement request sent");
      setReimbursementExpense(null);
      setReimbursementAmount("");
      setReimbursementMessage("");
    }
  };

  const handleRespondToRequest = async (status: 'approved' | 'rejected' | 'paid') => {
    if (!respondingTo) return;

    const { error } = await respondToReimbursement(
      respondingTo.id,
      status,
      responseMessage || undefined
    );

    if (error) {
      toast.error(error);
    } else {
      toast.success(`Request ${status}`);
      setRespondingTo(null);
      setResponseMessage("");
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteId) return;

    const { error } = await deleteExpense(deleteId);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Expense deleted");
    }
    setDeleteId(null);
  };

  const handleViewReceipt = async (path: string) => {
    const url = await getSignedReceiptUrl(path);
    if (url) {
      setViewingReceipt(url);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Split %', 'Child', 'Added By', 'Notes'];
    const rows = filteredExpenses.map(e => [
      format(parseISO(e.expense_date), 'yyyy-MM-dd'),
      EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label ?? 'Other',
      e.description,
      e.amount.toFixed(2),
      e.split_percentage,
      resolveChildName(e.child?.name),
      resolvePersonName(e.creator?.full_name, e.creator?.email),
      e.notes || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Expenses exported");
  };

  const generateCourtReport = async () => {
    setIsGeneratingReport(true);
    
    try {
      // Get profile details
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, email, co_parent_id')
        .eq('id', profile?.id)
        .maybeSingle();
      
      let coParentData = null;
      if (profileData?.co_parent_id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', profileData.co_parent_id)
          .maybeSingle();
        coParentData = data;
      }

      // Filter expenses by date range
      const startDate = parseISO(reportStartDate);
      const endDate = parseISO(reportEndDate);
      
      const filteredForReport = expenses.filter(e => {
        const expDate = parseISO(e.expense_date);
        return expDate >= startDate && expDate <= endDate;
      });

      // Filter reimbursements by date range
      const filteredReimbursements = reimbursementRequests.filter(r => {
        const reqDate = parseISO(r.created_at);
        return reqDate >= startDate && reqDate <= endDate;
      });

      const reportData = {
        expenses: filteredForReport,
        reimbursementRequests: filteredReimbursements,
        profile: profileData || { full_name: null, email: null },
        coParent: coParentData,
        dateRange: { start: reportStartDate, end: reportEndDate },
        children: children.map(c => ({ id: c.id, name: c.name })),
      };

      const { data: htmlContent, error } = await supabase.functions.invoke('generate-expense-report', {
        body: reportData,
      });

      if (error) throw error;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Auto-trigger print dialog after content loads
        printWindow.onload = () => {
          printWindow.print();
        };
        
        toast.success("Report generated - use browser print to save as PDF");
      } else {
        toast.error("Please allow popups to generate the report");
      }
      
      setIsReportDialogOpen(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error("Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !searchQuery || 
      expense.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || expense.category === filterCategory;
    
    let matchesMonth = true;
    if (filterMonth !== "all") {
      const expenseDate = parseISO(expense.expense_date);
      const [year, month] = filterMonth.split('-').map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      matchesMonth = isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    }

    return matchesSearch && matchesCategory && matchesMonth;
  });

  // Get unique months for filter
  const uniqueMonths = [...new Set(expenses.map(e => 
    format(parseISO(e.expense_date), 'yyyy-MM')
  ))].sort().reverse();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'paid':
        return <Badge className="bg-green-600"><DollarSign className="h-3 w-3 mr-1" />Paid</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <PremiumFeatureGate featureName="Expense Tracking">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-7 w-7 text-[#21B0FE]" />
                Shared Expenses
              </h1>
              {permissions.isViewOnly && (
                <ViewOnlyBadge reason={permissions.viewOnlyReason || undefined} />
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {permissions.isViewOnly 
                ? "View shared expense records"
                : "Track costs, request reimbursements, and export reports"}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
              <DialogTrigger asChild>
                <PermissionButton 
                  variant="outline" 
                  className="border-primary/50 text-primary hover:bg-primary/10"
                  hasPermission={permissions.canManageExpenses}
                  deniedMessage="Only parents can generate court reports"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Court Report
                </PermissionButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Generate Court Report
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Generate a professional, court-ready expense report with all transactions, 
                    reimbursement history, and financial summaries.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Report includes:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>All expenses in date range</li>
                      <li>Category breakdown with totals</li>
                      <li>Reimbursement request history</li>
                      <li>Financial summary by parent</li>
                      <li>Receipt indicators</li>
                    </ul>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={generateCourtReport}
                    disabled={isGeneratingReport}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isGeneratingReport ? "Generating..." : "Generate & Print"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Dialog open={isAddOpen} onOpenChange={(open) => {
              if (!open) resetForm();
              setIsAddOpen(open);
            }}>
              <DialogTrigger asChild>
                <PermissionButton 
                  className="bg-[#21B0FE] hover:bg-[#21B0FE]/90"
                  hasPermission={permissions.canManageExpenses}
                  deniedMessage="Only parents can add expenses"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </PermissionButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Expense</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, amount: true }))}
                          className={`pl-10 ${errors.amount ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                      </div>
                      {errors.amount && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.amount}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, expenseDate: true }))}
                        className={errors.expenseDate ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {errors.expenseDate && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.expenseDate}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input
                      placeholder="What was this expense for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                      className={errors.description ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.description}
                      </p>
                    )}
                  </div>

                  {children.length > 0 && (
                    <div className="space-y-2">
                      <Label>Related Child (optional)</Label>
                      <Select value={childId} onValueChange={setChildId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a child" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Split Percentage (your share)</Label>
                    <Select value={splitPercentage} onValueChange={setSplitPercentage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50/50</SelectItem>
                        <SelectItem value="60">60/40</SelectItem>
                        <SelectItem value="70">70/30</SelectItem>
                        <SelectItem value="80">80/20</SelectItem>
                        <SelectItem value="100">100% (no split)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Receipt (optional)</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Any additional details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, notes: true }))}
                      className={errors.notes ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.notes && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.notes}
                      </p>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button 
                    onClick={handleAddExpense}
                    disabled={isSaving || !!errors.amount || !!errors.description}
                    className="bg-[#21B0FE] hover:bg-[#21B0FE]/90"
                  >
                    {isSaving ? "Saving..." : "Add Expense"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card className="bg-gradient-to-br from-[#21B0FE]/10 to-transparent border-[#21B0FE]/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Your Expenses
              </div>
              <div className="text-2xl font-bold text-[#21B0FE]">${totals.myTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Co-Parent Expenses
              </div>
              <div className="text-2xl font-bold text-purple-600">${totals.coParentTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="h-4 w-4" />
                Pending to You
              </div>
              <div className="text-2xl font-bold text-yellow-600">${totals.pendingToMe.toFixed(2)}</div>
              {totals.pendingRequestsToMe.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.pendingRequestsToMe.length} request(s)
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                Total Tracked
              </div>
              <div className="text-2xl font-bold text-green-600">${totals.grandTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Charts */}
        <ExpenseCharts expenses={expenses} profileId={profile?.id} />

        {/* Pending Requests */}
        {totals.pendingRequestsToMe.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Pending Reimbursement Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {totals.pendingRequestsToMe.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="font-medium">
                        ${Number(request.amount).toFixed(2)} requested by {request.requester?.full_name || request.requester?.email}
                      </p>
                      {request.message && (
                        <p className="text-sm text-muted-foreground">{request.message}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => setRespondingTo({ ...request, status: 'rejected' } as ReimbursementRequest)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleRespondToRequest('approved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              {uniqueMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {format(parseISO(`${month}-01`), 'MMMM yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Expenses List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading expenses...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <DollarSign className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {expenses.length === 0 ? "No Expenses Yet" : "No matching expenses"}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {expenses.length === 0 
                  ? "Start tracking shared expenses to request reimbursements and export reports."
                  : "Try adjusting your filters."}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {filteredExpenses.map((expense, index) => {
                const isMyExpense = expense.created_by === profile?.id;
                const category = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                const pendingRequest = reimbursementRequests.find(
                  r => r.expense_id === expense.id && r.status === 'pending'
                );

                return (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl font-bold">${Number(expense.amount).toFixed(2)}</span>
                              <Badge variant="secondary">{category?.label}</Badge>
                              {expense.child && (
                                <Badge variant="outline">{expense.child.name}</Badge>
                              )}
                              {!isMyExpense && (
                                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30">
                                  Co-parent
                                </Badge>
                              )}
                            </div>
                            <p className="text-foreground">{expense.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(expense.expense_date), 'MMM d, yyyy')}
                              </span>
                              <span>Split: {expense.split_percentage}%</span>
                              {expense.receipt_path && (
                                <button
                                  onClick={() => handleViewReceipt(expense.receipt_path!)}
                                  className="flex items-center gap-1 text-[#21B0FE] hover:underline"
                                >
                                  <Receipt className="h-3 w-3" />
                                  View Receipt
                                </button>
                              )}
                            </div>
                            {expense.notes && (
                              <p className="text-sm text-muted-foreground mt-1 italic">{expense.notes}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            {isMyExpense && (
                              <>
                                {pendingRequest ? (
                                  getStatusBadge('pending')
                                ) : expense.split_percentage < 100 && profile?.co_parent_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReimbursementExpense(expense);
                                      const owedAmount = Number(expense.amount) * (1 - Number(expense.split_percentage) / 100);
                                      setReimbursementAmount(owedAmount.toFixed(2));
                                    }}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Request
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(expense.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Show request status for co-parent expenses */}
                            {!isMyExpense && pendingRequest && (
                              <div className="text-right">
                                {getStatusBadge(pendingRequest.status)}
                                <p className="text-xs text-muted-foreground mt-1">
                                  ${Number(pendingRequest.amount).toFixed(2)} requested
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Reimbursement Request Dialog */}
        <Dialog open={!!reimbursementExpense} onOpenChange={() => setReimbursementExpense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Reimbursement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount to request</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    value={reimbursementAmount}
                    onChange={(e) => setReimbursementAmount(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on {100 - (reimbursementExpense?.split_percentage || 50)}% co-parent share
                </p>
              </div>
              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  placeholder="Add a note about this request..."
                  value={reimbursementMessage}
                  onChange={(e) => setReimbursementMessage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReimbursementExpense(null)}>Cancel</Button>
              <Button onClick={handleRequestReimbursement} className="bg-[#21B0FE] hover:bg-[#21B0FE]/90">
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receipt Viewer Dialog */}
        <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
            </DialogHeader>
            {viewingReceipt && (
              <div className="flex justify-center">
                <img 
                  src={viewingReceipt} 
                  alt="Receipt" 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. Any pending reimbursement requests will also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </PremiumFeatureGate>
    </DashboardLayout>
  );
}

export default function ExpensesPage() {
  return (
    <FeatureErrorBoundary featureName="Expenses">
      <ExpensesPageContent />
    </FeatureErrorBoundary>
  );
}
