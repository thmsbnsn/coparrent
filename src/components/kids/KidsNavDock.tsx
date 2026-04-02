import { CalendarDays, Gamepad2, Heart, MessageCircleMore, PhoneCall } from "lucide-react";

const items = [
  { icon: Gamepad2, label: "Play" },
  { icon: CalendarDays, label: "Today" },
  { icon: Heart, label: "Feelings" },
  { icon: PhoneCall, label: "Call" },
  { icon: MessageCircleMore, label: "Messages" },
];

export const KidsNavDock = () => (
  <div className="rounded-[2rem] border border-border bg-white/85 p-3 shadow-sm">
    <div className="grid grid-cols-5 gap-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`rounded-[1.5rem] px-3 py-4 text-center ${
            index === 0
              ? "bg-slate-950 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <item.icon className="mx-auto h-5 w-5" />
          <p className="mt-2 text-xs font-medium">{item.label}</p>
        </div>
      ))}
    </div>
  </div>
);
