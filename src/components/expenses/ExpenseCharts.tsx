import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, PieChart, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, parseISO, startOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { Expense, EXPENSE_CATEGORIES } from "@/hooks/useExpenses";

interface ExpenseChartsProps {
  expenses: Expense[];
  profileId?: string;
}

interface MonthlyCategoryDataPoint {
  month: string;
  [categoryLabel: string]: number | string;
}

interface TooltipEntry {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    fullMonth?: string;
  };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

interface PieTooltipEntry {
  name: string;
  value: number;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipEntry[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ExpenseCharts({ expenses, profileId }: ExpenseChartsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Monthly spending trend data
  const monthlyData = useMemo(() => {
    if (expenses.length === 0) return [];

    const now = new Date();
    const sixMonthsAgo = subMonths(now, 5);
    const months = eachMonthOfInterval({ start: startOfMonth(sixMonthsAgo), end: startOfMonth(now) });

    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthExpenses = expenses.filter((e) => {
        const expDate = parseISO(e.expense_date);
        return (
          expDate.getMonth() === monthStart.getMonth() &&
          expDate.getFullYear() === monthStart.getFullYear()
        );
      });

      const myTotal = monthExpenses
        .filter((e) => e.created_by === profileId)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const coParentTotal = monthExpenses
        .filter((e) => e.created_by !== profileId)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        month: format(month, "MMM"),
        fullMonth: format(month, "MMMM yyyy"),
        you: myTotal,
        coParent: coParentTotal,
        total: myTotal + coParentTotal,
      };
    });
  }, [expenses, profileId]);

  // Category breakdown data
  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((expense) => {
      const category = expense.category;
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(expense.amount);
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        name: EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category,
        value: amount,
        category,
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Monthly category comparison
  const monthlyCategoryData = useMemo(() => {
    if (expenses.length === 0) return [];

    const now = new Date();
    const threeMonthsAgo = subMonths(now, 2);
    const months = eachMonthOfInterval({ start: startOfMonth(threeMonthsAgo), end: startOfMonth(now) });

    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthExpenses = expenses.filter((e) => {
        const expDate = parseISO(e.expense_date);
        return (
          expDate.getMonth() === monthStart.getMonth() &&
          expDate.getFullYear() === monthStart.getFullYear()
        );
      });

      const result: MonthlyCategoryDataPoint = {
        month: format(month, "MMM"),
      };

      EXPENSE_CATEGORIES.slice(0, 5).forEach((cat) => {
        result[cat.label] = monthExpenses
          .filter((e) => e.category === cat.value)
          .reduce((sum, e) => sum + Number(e.amount), 0);
      });

      return result;
    });
  }, [expenses]);

  if (expenses.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground mb-1">{payload[0]?.payload?.fullMonth || label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${Number(entry.value ?? 0).toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: PieTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground">{payload[0].name}</p>
          <p className="text-sm text-primary">${payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Spending Analytics
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-6">
            {/* Spending Trend */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Monthly Spending Trend
              </h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorYou" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCoParent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="you"
                      name="You"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorYou)"
                    />
                    <Area
                      type="monotone"
                      dataKey="coParent"
                      name="Co-Parent"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCoParent)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Spending by Category
                </h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {categoryData.slice(0, 5).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1 text-xs">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Comparison */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Category Comparison (3 Months)
                </h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCategoryData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {EXPENSE_CATEGORIES.slice(0, 3).map((cat, index) => (
                        <Bar
                          key={cat.value}
                          dataKey={cat.label}
                          fill={COLORS[index]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
