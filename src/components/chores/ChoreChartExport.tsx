import jsPDF from "jspdf";
import { addDays, format } from "date-fns";
import { Child } from "@/hooks/useChildren";
import type { ChoreItem, ChoreList, Weekday } from "@/hooks/useChoreCharts";

interface ExportPayload {
  choreList: ChoreList;
  chores: ChoreItem[];
  children: Child[];
  selectedChildId: string | null;
  weekStart: Date;
}

const WEEKDAY_KEYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const buildPrintableHtml = ({
  choreList,
  chores,
  children,
  selectedChildId,
  weekStart,
}: ExportPayload) => {
  const child = children.find((item) => item.id === selectedChildId);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const rows = chores
    .map((chore) => {
      const cells = days
        .map((day, index) => {
          const dayKey = WEEKDAY_KEYS[index];
          return `<td>${dayKey && chore.days_active.includes(dayKey) ? "□" : ""}</td>`;
        })
        .join("");

      return `<tr><td>${chore.title}</td>${cells}</tr>`;
    })
    .join("");

  return `
    <html>
      <head>
        <title>${choreList.household_label} chore chart</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d4d4d8; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f4f4f5; }
        </style>
      </head>
      <body>
        <h1>${choreList.household_label} chore chart</h1>
        <p>Week of ${format(weekStart, "MMMM d, yyyy")}</p>
        <p>${child ? `Child: ${child.name}` : "All assigned children"}</p>
        <table>
          <thead>
            <tr>
              <th>Chore</th>
              ${days.map((day) => `<th>${format(day, "EEE d")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
};

export const generateChoreChartPDF = ({
  choreList,
  chores,
  children,
  selectedChildId,
  weekStart,
}: ExportPayload) => {
  const child = children.find((item) => item.id === selectedChildId);
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(choreList.household_label, 14, 20);
  doc.setFontSize(11);
  doc.text(`Week of ${format(weekStart, "MMMM d, yyyy")}`, 14, 28);
  doc.text(child ? `Child: ${child.name}` : "Child: all assigned", 14, 35);

  let y = 48;
  chores.forEach((chore, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${chore.title}`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Days: ${chore.days_active.map((day) => day.toUpperCase()).join(", ") || "None"}`,
      20,
      y + 7
    );
    if (chore.description) {
      const lines = doc.splitTextToSize(chore.description, 170);
      doc.text(lines, 20, y + 14);
      y += 14 + lines.length * 6;
    } else {
      y += 18;
    }
  });

  doc.save(`chore-chart-${format(weekStart, "yyyy-MM-dd")}.pdf`);
};

export const openChoreChartPrint = (payload: ExportPayload) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildPrintableHtml(payload));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};
