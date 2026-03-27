import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  Bell,
  Calendar,
  CheckCircle,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  FolderOpen,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  Search,
  Server,
  Shield,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
  Zap,
  Clock3,
  Scale,
  Rocket,
} from "lucide-react";
import { ProblemReportButton } from "@/components/feedback/ProblemReportButton";
import { HelpBanner, HelpCard, HelpGrid, HelpNotice, HelpPageLayout, HelpStep } from "@/components/help/HelpPage";

const CheckItem = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2">
    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
    <span className="text-sm">{children}</span>
  </div>
);

export const HelpGettingStarted = () => (
  <HelpPageLayout
    category="Getting Started"
    title="Account setup and basics"
    description="Everything you need to know to set up your CoParrent account and start coordinating with confidence."
    headerIcon={<Rocket className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Go to Dashboard", href: "/dashboard" }}
    relatedLinks={[
      { title: "Inviting a co-parent or step-parent", href: "/help/getting-started/invitations" },
      { title: "Understanding custody schedule patterns", href: "/help/scheduling/patterns" },
      { title: "Your account and billing", href: "/help/account" },
    ]}
  >
    <HelpBanner variant="primary">
      CoParrent is a coordination platform for separated or divorced parents. It provides shared calendars,
      documented messaging, expense tracking, and document storage, all designed to reduce conflict and create
      clear records.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Your first steps</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Complete your profile">
          Add your name, contact preferences, and timezone in Settings. This ensures notifications and calendar
          events display correctly.
        </HelpStep>
        <HelpStep number={2} title="Add your children">
          Go to the Children section to create profiles for each child, including school, medical information,
          and emergency contacts.
        </HelpStep>
        <HelpStep number={3} title="Set up your custody schedule">
          Use the Calendar to establish your custody pattern such as week-on/week-off or 2-2-3.
        </HelpStep>
        <HelpStep number={4} title="Invite your co-parent">
          Send an invitation so they can access shared information and communicate through the platform with
          full documentation.
        </HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Key features to explore</h2>
      <HelpGrid columns={2}>
        <HelpCard icon={Calendar} title="Calendar">
          View and manage custody schedules, request changes, and track who has the children on any given day.
        </HelpCard>
        <HelpCard icon={MessageSquare} title="Messages">
          Communicate with your co-parent in a documented, timestamped format suitable for legal records.
        </HelpCard>
        <HelpCard icon={FileText} title="Documents">
          Store and share important files like custody agreements, medical records, and school forms.
        </HelpCard>
        <HelpCard icon={DollarSign} title="Expenses">
          Track shared expenses, request reimbursements, and maintain a clear financial record.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Roles and permissions</h2>
      <p className="text-muted-foreground mb-4">CoParrent supports different roles with appropriate access levels:</p>
      <div className="space-y-3">
        <HelpCard icon={User} title="Primary Parent" variant="primary">
          Full access to all features and settings. Can invite other users and manage permissions.
        </HelpCard>
        <HelpCard icon={Users} title="Co-Parent">
          Access to shared calendars, messages, and documents. Equal partner in coordination.
        </HelpCard>
        <HelpCard icon={UserPlus} title="Step-Parent">
          Limited access as configured by a primary parent. Can help with day-to-day coordination.
        </HelpCard>
        <HelpCard icon={Shield} title="Third Party">
          View-only access for legal professionals, mediators, or therapists as needed.
        </HelpCard>
      </div>
    </section>

    <HelpNotice type="important">
      Most families complete initial setup in <strong>10-15 minutes</strong>. Adding detailed child information
      and configuring preferences may take an additional 5-10 minutes per child.
    </HelpNotice>
    <HelpNotice type="safety">
      If you are in an unsafe situation or concerned about domestic violence, please contact the National Domestic
      Violence Hotline at 1-800-799-7233. CoParrent is not a substitute for professional legal or safety advice.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpScheduling = () => (
  <HelpPageLayout
    category="Scheduling"
    title="Custody calendars and exchanges"
    description="How to set up, view, and manage your custody schedule in CoParrent."
    headerIcon={<Calendar className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Calendar", href: "/dashboard/calendar" }}
    relatedLinks={[
      { title: "How schedule change requests work", href: "/help/scheduling/change-requests" },
      { title: "Understanding custody schedule patterns", href: "/help/scheduling/patterns" },
      { title: "Court records and exports", href: "/court-records" },
    ]}
  >
    <HelpBanner variant="primary">
      The Calendar is the central hub for tracking custody arrangements. It shows which parent has the children
      on any given day, upcoming exchanges, and scheduled activities or events.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Setting up your custody schedule</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Choose a pattern">
          Common patterns include week-on/week-off, 2-2-3, 3-4-4-3, or every other weekend.
        </HelpStep>
        <HelpStep number={2} title="Set the start date">
          Choose when the pattern begins. This determines which parent has custody on which days going forward.
        </HelpStep>
        <HelpStep number={3} title="Configure exchanges">
          Set default exchange times and locations. These can be adjusted for individual days.
        </HelpStep>
        <HelpStep number={4} title="Add holidays">
          Override the regular pattern for holidays and special occasions.
        </HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Understanding the calendar view</h2>
      <p className="text-muted-foreground mb-4">The calendar uses color coding to make custody assignments instantly clear:</p>
      <HelpGrid columns={2}>
        <HelpCard icon={CheckCircle} title="Your custody days" variant="primary">
          Days with your custody are highlighted in your assigned color.
        </HelpCard>
        <HelpCard icon={CheckCircle} title="Co-parent days">
          Days with your co-parent&apos;s custody appear in their designated color.
        </HelpCard>
        <HelpCard icon={ArrowRightLeft} title="Exchange days">
          Exchange days show transition indicators, including time and location when configured.
        </HelpCard>
        <HelpCard icon={Calendar} title="Events & activities">
          Sports, appointments, and other activities appear as distinct markers.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Making schedule changes</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground mb-4">
          Use the Schedule Change Request feature to send a formal request to your co-parent. All requests and
          responses are documented for your records.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">✓ Documented</span>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">✓ Timestamped</span>
          <span className="px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full">✓ Court-ready</span>
        </div>
      </div>
    </section>

    <HelpCard icon={Clock3} title="Exchange check-ins" variant="tip">
      During custody exchanges, you can record a check-in to document the time and any notes about the exchange.
      This creates a timestamp record that can be referenced later if needed.
    </HelpCard>

    <HelpNotice type="legal">
      CoParrent helps you track and document your custody schedule, but it does not create or modify legal custody
      agreements. Always consult with your attorney for legal advice regarding custody arrangements.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpMessaging = () => (
  <HelpPageLayout
    category="Messaging"
    title="Communication and records"
    description="How to use CoParrent's messaging system for documented, respectful co-parenting communication."
    headerIcon={<MessageSquare className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Messages", href: "/dashboard/messages" }}
    relatedLinks={[
      { title: "Exporting messages and documents", href: "/help/documents/exports" },
      { title: "Court records and legal use", href: "/court-records" },
      { title: "Your privacy and security", href: "/help/privacy" },
    ]}
  >
    <HelpBanner variant="primary">
      Every message in CoParrent is timestamped and stored as a permanent record. This creates a clear,
      organized communication history that can be exported for legal purposes if needed.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Types of conversations</h2>
      <div className="space-y-3">
        <HelpCard icon={Users} title="Direct co-parent communication">
          Direct communication about scheduling, expenses, and child-related matters.
        </HelpCard>
        <HelpCard icon={Users} title="Group conversations">
          Group conversations may include step-parents or other approved family members.
        </HelpCard>
        <HelpCard icon={MessageSquare} title="Child notes">
          If enabled, children with accounts can send notes to parents within the platform.
        </HelpCard>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Court-friendly records</h2>
      <HelpGrid columns={2}>
        <HelpCard icon={CheckCircle} title="Full sender attribution">Full sender attribution on every message.</HelpCard>
        <HelpCard icon={Clock3} title="Precise timestamps">Precise timestamps in standard format.</HelpCard>
        <HelpCard icon={Search} title="Readable formatting">Removes decorative elements for clarity.</HelpCard>
        <HelpCard icon={FileText} title="PDF export">Export as PDF for printing or filing.</HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Best practices</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Stay on topic">Stick to the child-related issue at hand. Facts over feelings.</HelpStep>
        <HelpStep number={2} title="Pause before replying">
          Take time before replying. The compose area includes reminders about maintaining a constructive tone.
        </HelpStep>
        <HelpStep number={3} title="Keep children at the center">
          Frame discussions around what is best for your children.
        </HelpStep>
        <HelpStep number={4} title="Use search when needed">
          Search by keyword, date range, or sender to quickly locate agreements or discussions.
        </HelpStep>
      </div>
    </section>

    <HelpNotice type="legal">
      Messages in CoParrent may be reviewed by attorneys, judges, or mediators. Always communicate as if your
      messages will be read aloud in court.
    </HelpNotice>
    <HelpNotice type="safety">
      If you are experiencing harassment or threats through any communication channel, document everything and
      contact local authorities. CoParrent records can serve as evidence, but your safety comes first.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpDocuments = () => (
  <HelpPageLayout
    category="Documents"
    title="Storage and exports"
    description="How to upload, organize, and share important family documents in CoParrent."
    headerIcon={<FileText className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Documents", href: "/dashboard/documents" }}
    relatedLinks={[
      { title: "Exporting messages and documents", href: "/help/documents/exports" },
      { title: "Court records and legal use", href: "/court-records" },
      { title: "Your privacy and security", href: "/help/privacy" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Recommended document categories</h2>
      <HelpGrid columns={2}>
        <HelpCard icon={Scale} title="Custody & legal" variant="primary">
          Agreements, court orders, parenting plans, and legal correspondence.
        </HelpCard>
        <HelpCard icon={FileText} title="Medical records">
          Insurance cards, vaccinations, prescriptions, and specialist reports.
        </HelpCard>
        <HelpCard icon={FileText} title="School documents">
          Enrollment forms, report cards, IEPs, permission slips, and teacher communications.
        </HelpCard>
        <HelpCard icon={FolderOpen} title="Financial records">
          Tax documents, expense records, and other family records.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Uploading a document</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Go to Documents">Open the Documents section from your dashboard sidebar.</HelpStep>
        <HelpStep number={2} title="Add details">
          Add a title, description, and category to make the document easy to find.
        </HelpStep>
        <HelpStep number={3} title="Link to a child if needed">
          Optionally link the document to a specific child for better organization.
        </HelpStep>
        <HelpStep number={4} title="Share automatically">
          The document is now available to both parents in your family.
        </HelpStep>
      </div>
    </section>

    <HelpCard icon={Eye} title="Every access is logged" variant="tip">
      Every time a document is viewed or downloaded, an access log entry is created. This provides a clear record
      of who accessed what and when.
    </HelpCard>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Your documents are protected</h2>
      <div className="space-y-2">
        <CheckItem>Encrypted at rest and in transit</CheckItem>
        <CheckItem>Role-based access control</CheckItem>
        <CheckItem>Third-party users can be granted view-only access</CheckItem>
        <CheckItem>Revocable access for attorneys or professionals</CheckItem>
      </div>
    </section>

    <HelpNotice type="legal">
      Documents stored in CoParrent are for coordination purposes. Always keep original copies of important legal
      documents in a secure location.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpExpenses = () => (
  <HelpPageLayout
    category="Expenses"
    title="Tracking and reimbursements"
    description="How to log shared expenses, request reimbursements, and maintain financial records."
    headerIcon={<DollarSign className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Expenses", href: "/dashboard/expenses" }}
    relatedLinks={[
      { title: "Court records and exports", href: "/court-records" },
      { title: "Your account and billing", href: "/help/account" },
      { title: "Exporting documents", href: "/help/documents/exports" },
    ]}
  >
    <HelpBanner variant="primary">
      The Expenses feature helps you maintain a clear record of shared child-related costs, especially when custody
      agreements require splitting medical bills, activities, or school costs.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Logging an expense</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Open Expenses">Go to the Expenses section from your dashboard.</HelpStep>
        <HelpStep number={2} title="Add the basics">Enter the amount, date, and a clear description.</HelpStep>
        <HelpStep number={3} title="Pick a category">
          Select a category such as medical, school, or activities for easy tracking.
        </HelpStep>
        <HelpStep number={4} title="Attach proof">
          Upload a receipt photo if available and set the split percentage.
        </HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Common categories</h2>
      <HelpGrid columns={2}>
        <HelpCard icon={DollarSign} title="Medical">Doctor visits, therapy, dental, vision, and prescriptions.</HelpCard>
        <HelpCard icon={DollarSign} title="School">Supplies, tuition, tutoring, and educational programs.</HelpCard>
        <HelpCard icon={Trophy} title="Activities">Sports registration, camps, clubs, and lessons.</HelpCard>
        <HelpCard icon={Users} title="Childcare">Daycare, babysitting, after-school care, and summer programs.</HelpCard>
      </HelpGrid>
    </section>

    <HelpCard icon={ArrowRightLeft} title="Reimbursement requests" variant="tip">
      When you pay for a shared expense, you can request reimbursement from your co-parent with the full expense
      details, receipt, amount owed, and a documented approval or decline trail.
    </HelpCard>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">PDF expense reports</h2>
      <div className="space-y-2">
        <CheckItem>All logged expenses with dates and amounts</CheckItem>
        <CheckItem>Category breakdowns and summaries</CheckItem>
        <CheckItem>Receipt images included</CheckItem>
        <CheckItem>Running totals and outstanding balances</CheckItem>
      </div>
    </section>

    <HelpNotice type="legal">
      CoParrent expense tracking is for documentation and coordination purposes. It does not constitute financial
      or tax advice.
    </HelpNotice>
    <HelpNotice type="info">
      Keep original receipts for major expenses. While CoParrent stores receipt images, original documentation may
      be required for tax filings or legal proceedings.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpAccount = () => (
  <HelpPageLayout
    category="Account"
    title="Billing and settings"
    description="Managing your CoParrent account, subscription, and personal preferences."
    headerIcon={<User className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Settings", href: "/dashboard/settings" }}
    relatedLinks={[
      { title: "What happens when a trial ends", href: "/help/account/trial-ending" },
      { title: "Your privacy and security", href: "/help/privacy" },
      { title: "Getting started guide", href: "/help/getting-started" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Your account settings</h2>
      <p className="text-muted-foreground mb-4">Access your account settings from the dashboard to manage:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <User className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-sm">Profile information</span>
            <p className="text-xs text-muted-foreground">Name, email, timezone</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-sm">Notification preferences</span>
            <p className="text-xs text-muted-foreground">Email, push, reminders</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-sm">Privacy settings</span>
            <p className="text-xs text-muted-foreground">Access control, security</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
          <CreditCard className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-sm">Subscription & billing</span>
            <p className="text-xs text-muted-foreground">Plan, payments, invoices</p>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Subscription plans</h2>
      <p className="text-muted-foreground mb-4">CoParrent offers different subscription tiers to match your needs:</p>
      <HelpGrid columns={2}>
        <HelpCard icon={Zap} title="Free Plan">
          <p className="mb-2">Basic calendar and messaging with limited history.</p>
          <ul className="space-y-1 text-xs">
            <li>• Limited message history</li>
            <li>• Basic calendar access</li>
            <li>• Core features</li>
          </ul>
        </HelpCard>
        <HelpCard icon={Trophy} title="Power Plan" variant="primary">
          <p className="mb-2">Full access to all features including:</p>
          <ul className="space-y-1 text-xs">
            <li>• Unlimited message history</li>
            <li>• Document storage</li>
            <li>• Court exports</li>
            <li>• AI-powered tools</li>
          </ul>
        </HelpCard>
      </HelpGrid>
      <p className="text-sm text-muted-foreground mt-4">
        View current pricing and upgrade options on the <Link to="/pricing" className="text-primary hover:underline">Pricing page</Link>.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Managing your subscription</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground mb-4">From Settings, you can:</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <CheckItem>View your current plan and usage</CheckItem>
          <CheckItem>Upgrade or change your subscription</CheckItem>
          <CheckItem>Update payment methods</CheckItem>
          <CheckItem>View billing history and invoices</CheckItem>
          <CheckItem>Cancel your subscription</CheckItem>
        </div>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Notification settings</h2>
      <p className="text-muted-foreground mb-4">Control how and when CoParrent notifies you:</p>
      <HelpGrid columns={2}>
        <HelpCard icon={Bell} title="Email notifications">Get notified about new messages, change requests, and important updates.</HelpCard>
        <HelpCard icon={Bell} title="Push notifications">If the app is installed, receive instant alerts for time-sensitive items.</HelpCard>
        <HelpCard icon={Bell} title="Exchange reminders">Get reminded about upcoming custody exchanges.</HelpCard>
        <HelpCard icon={Bell} title="Schedule summaries">Receive daily or weekly summaries of your schedule.</HelpCard>
      </HelpGrid>
    </section>

    <HelpCard icon={FileText} title="Data export" variant="tip">
      You can request a full export of all your CoParrent data at any time from Settings, including messages,
      documents, expenses, and other records.
    </HelpCard>

    <HelpNotice type="info">
      Subscription charges are processed through Stripe, our payment processor. For billing questions or disputes,
      contact support or manage your subscription directly from account settings.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpPrivacy = () => (
  <HelpPageLayout
    category="Security"
    title="Privacy and protection"
    description="How CoParrent protects your data and what controls you have over your privacy."
    headerIcon={<Lock className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Settings", href: "/dashboard/settings" }}
    relatedLinks={[
      { title: "Privacy Policy", href: "/privacy" },
      { title: "Terms of Service", href: "/terms" },
      { title: "Your account settings", href: "/help/account" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">How we protect your data</h2>
      <p className="text-muted-foreground mb-4">
        CoParrent is designed for sensitive family information. We implement multiple layers of protection:
      </p>
      <HelpGrid columns={2}>
        <HelpCard icon={Lock} title="Encryption" variant="primary">
          All data is encrypted in transit (TLS 1.3) and at rest (AES-256).
        </HelpCard>
        <HelpCard icon={KeyRound} title="Access controls">
          Only users with appropriate permissions can access shared information. Server-side enforcement ensures security.
        </HelpCard>
        <HelpCard icon={Eye} title="Audit logging">
          Sensitive actions are logged for accountability. You can review who accessed what and when.
        </HelpCard>
        <HelpCard icon={Shield} title="Secure authentication">
          Strong password requirements and optional two-factor authentication protect your account.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Who can see your data</h2>
      <div className="space-y-3">
        <HelpCard icon={UserCheck} title="You" variant="primary">
          Full access to all your own data and shared resources. You control what you share and with whom.
        </HelpCard>
        <HelpCard icon={Users} title="Your co-parent">
          Access to shared calendars, messages, documents, and expenses.
        </HelpCard>
        <HelpCard icon={UserCheck} title="Step-parents">
          Limited access as configured by primary parents. You control exactly what they can see and do.
        </HelpCard>
        <HelpCard icon={Scale} title="Third parties">
          View-only access to specific records if explicitly granted. Revocable at any time.
        </HelpCard>
      </div>
      <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">CoParrent staff</strong> — access only for technical support with your
          explicit permission, and never to message content.
        </p>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Your privacy controls</h2>
      <p className="text-muted-foreground mb-4">In Settings, you can manage:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          ["Two-factor authentication", KeyRound],
          ["Trusted devices", Shield],
          ["Active sessions", Eye],
          ["Third-party access grants", Users],
          ["Data export requests", FileText],
          ["Account deletion", HelpCircle],
        ].map(([label, Icon]) => (
          <div key={label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <Icon className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>
    </section>

    <HelpCard icon={Scale} title="For legal proceedings" variant="warning">
      CoParrent data may be used in legal proceedings. If you receive a subpoena or court order requesting your
      data, contact legal counsel. You can export your own data at any time using the export feature in Settings.
    </HelpCard>

    <HelpBanner variant="warning">
      If you believe there has been unauthorized access to your account or data, contact support immediately at{" "}
      <strong>security@coparrent.com</strong>.
    </HelpBanner>
    <HelpNotice type="info">
      For complete details on how we collect, use, and protect your data, please review our full Privacy Policy.
    </HelpNotice>
    <HelpNotice type="safety">
      If you are in a domestic violence situation and concerned about your safety, contact the National Domestic
      Violence Hotline at 1-800-799-7233 or use a private/incognito browser session.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpTrialEnding = () => (
  <HelpPageLayout
    category="Account"
    title="What happens when a trial ends"
    description="Understanding your options when your CoParrent trial period ends."
    headerIcon={<Clock3 className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "View Pricing", href: "/pricing" }}
    relatedLinks={[
      { title: "Account and billing", href: "/help/account" },
      { title: "Getting started guide", href: "/help/getting-started" },
    ]}
  >
    <HelpBanner variant="success">
      When your trial ends, your data is <strong>not deleted</strong>. All messages, documents, expenses, and
      calendar history remain stored securely.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">What changes after the trial</h2>
      <p className="text-muted-foreground mb-4">Without an active subscription, some features become restricted:</p>
      <div className="space-y-3">
        <HelpCard icon={MessageSquare} title="Messages" variant="warning">
          You can view your message history but may be limited in sending new messages.
        </HelpCard>
        <HelpCard icon={FileText} title="Documents" variant="warning">
          You can view existing documents but cannot upload new ones. Downloads remain available.
        </HelpCard>
        <HelpCard icon={FolderOpen} title="Exports" variant="warning">
          Court-ready export features require a subscription.
        </HelpCard>
        <HelpCard icon={Calendar} title="Calendar">
          Basic calendar viewing remains available. Advanced features may be limited.
        </HelpCard>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">How to continue using CoParrent</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Go to Settings or Pricing">
          Navigate to Settings → Subscription or visit the Pricing page.
        </HelpStep>
        <HelpStep number={2} title="Choose your plan">Select the plan that fits your needs and budget.</HelpStep>
        <HelpStep number={3} title="Enter payment information">Complete the secure checkout process.</HelpStep>
        <HelpStep number={4} title="Instant access">Your account is immediately restored to full access.</HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">If you choose not to subscribe</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground mb-4">
          You can continue to access your data and use limited features. If you later decide to subscribe,
          everything will be exactly as you left it.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <CheckItem>Data remains stored securely</CheckItem>
          <CheckItem>Basic access continues</CheckItem>
          <CheckItem>No data loss or deletion</CheckItem>
          <CheckItem>Resubscribe anytime</CheckItem>
        </div>
      </div>
    </section>

    <HelpCard icon={CreditCard} title="Questions about billing?" variant="tip">
      If you have questions about pricing, payment options, or your subscription status, visit account settings or
      contact support.
    </HelpCard>
    <HelpNotice type="info">
      CoParrent uses Stripe for secure payment processing. Your payment information is never stored on our servers.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpScheduleChangeRequests = () => (
  <HelpPageLayout
    category="Scheduling"
    title="How schedule change requests work"
    description="Requesting and responding to custody schedule changes in CoParrent."
    headerIcon={<ArrowRightLeft className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Calendar", href: "/dashboard/calendar" }}
    relatedLinks={[
      { title: "Custody calendars and exchanges", href: "/help/scheduling" },
      { title: "Understanding schedule patterns", href: "/help/scheduling/patterns" },
      { title: "Court records", href: "/court-records" },
    ]}
  >
    <HelpBanner variant="primary">
      Schedule change requests create a documented record of proposed changes, responses, and final agreements.
      This clarity helps prevent misunderstandings and provides evidence if disputes arise later.
    </HelpBanner>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Creating a request</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Open the day in Calendar">Navigate to the day you want to change.</HelpStep>
        <HelpStep number={2} title="Describe the request">
          Explain whether you are swapping days, changing pickup time, or proposing another adjustment.
        </HelpStep>
        <HelpStep number={3} title="Include context">Add any explanation or reason for the request.</HelpStep>
        <HelpStep number={4} title="Send for review">Your co-parent receives a notification and can review it.</HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Responding to a request</h2>
      <div className="space-y-3">
        <HelpCard icon={CheckCircle} title="Approve" variant="tip">
          The change is applied and both parties are notified. The approval is documented with a timestamp.
        </HelpCard>
        <HelpCard icon={Shield} title="Decline" variant="warning">
          The original schedule remains unchanged. You can add a note explaining your decision for the record.
        </HelpCard>
        <HelpCard icon={ArrowRightLeft} title="Counter">
          Suggest a different modification as an alternative while documenting the negotiation.
        </HelpCard>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">What gets recorded</h2>
      <div className="space-y-2">
        <CheckItem>The original request with timestamp</CheckItem>
        <CheckItem>Any notes or context provided</CheckItem>
        <CheckItem>The response: approved, declined, or counter</CheckItem>
        <CheckItem>The date and time of the response</CheckItem>
      </div>
    </section>

    <HelpNotice type="important">
      Request changes as far in advance as possible, explain why you are requesting the change, respond in a timely
      manner, and keep communications focused on the children&apos;s needs.
    </HelpNotice>
    <HelpNotice type="legal">
      Schedule change requests in CoParrent are for coordination purposes and do not modify your legal custody
      agreement.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpInvitations = () => (
  <HelpPageLayout
    category="Getting Started"
    title="Inviting a co-parent or step-parent"
    description="How to add family members to your CoParrent account."
    headerIcon={<UserPlus className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Settings", href: "/dashboard/settings" }}
    relatedLinks={[
      { title: "Account setup and basics", href: "/help/getting-started" },
      { title: "Roles and permissions", href: "/help/privacy" },
      { title: "Your account settings", href: "/help/account" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Inviting your co-parent</h2>
      <HelpBanner variant="primary">
        Your co-parent is the other parent of your child(ren). They have full access to shared calendars, messages,
        documents, and expenses.
      </HelpBanner>
      <div className="space-y-4 mt-6">
        <HelpStep number={1} title="Go to Settings">Find the Co-Parent section.</HelpStep>
        <HelpStep number={2} title="Enter their email">Enter your co-parent&apos;s email address.</HelpStep>
        <HelpStep number={3} title="Send the invitation">Click send to dispatch the email.</HelpStep>
        <HelpStep number={4} title="They create their account">They receive a link to create their account.</HelpStep>
        <HelpStep number={5} title="Start coordinating">Once they accept, you are connected.</HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Inviting a step-parent</h2>
      <p className="text-muted-foreground mb-4">
        Step-parents can be added with limited access to help with day-to-day coordination. Their permissions are
        controlled by the primary parent who invited them.
      </p>
      <div className="space-y-4">
        <HelpStep number={1} title="Go to Settings">Find the Step-Parent section.</HelpStep>
        <HelpStep number={2} title="Enter their email">Enter the step-parent&apos;s email address.</HelpStep>
        <HelpStep number={3} title="Configure access">Set their access level and permissions.</HelpStep>
        <HelpStep number={4} title="Send the invitation">Dispatch the invitation email.</HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Step-parent permissions</h2>
      <p className="text-muted-foreground mb-4">When adding a step-parent, you can control their access to:</p>
      <HelpGrid columns={2}>
        <HelpCard icon={CheckCircle} title="Calendar access">View the schedule and optionally create events.</HelpCard>
        <HelpCard icon={CheckCircle} title="Message threads">View-only access or full participation.</HelpCard>
        <HelpCard icon={CheckCircle} title="Document access">View shared family documents.</HelpCard>
        <HelpCard icon={CheckCircle} title="Expense viewing">See expense history and summaries.</HelpCard>
      </HelpGrid>
      <p className="text-sm text-muted-foreground mt-4">You can adjust these permissions at any time from Settings.</p>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Adding third-party access</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground mb-4">
          In some cases, you may need to grant access to professionals like attorneys, mediators, or therapists.
          Third-party users have view-only access to specific records you choose to share.
        </p>
        <div className="space-y-3">
          <HelpStep number={1} title="Open Third-Party Access">Go to Settings → Third-Party Access.</HelpStep>
          <HelpStep number={2} title="Enter their email and role">Add the professional&apos;s email and role.</HelpStep>
          <HelpStep number={3} title="Choose what they can see">Specify which records they can access.</HelpStep>
          <HelpStep number={4} title="Send the invitation">They receive an invitation to view the shared information.</HelpStep>
        </div>
      </div>
    </section>

    <HelpCard icon={Shield} title="Revoking access" variant="warning">
      You can remove a step-parent or third-party user at any time from Settings. Their access ends immediately.
    </HelpCard>
    <div className="p-4 bg-muted/30 rounded-xl border border-border">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">Note:</strong> You cannot remove your co-parent&apos;s access.
      </p>
    </div>
    <HelpNotice type="safety">
      If you need to restrict access due to a safety concern, contact support immediately. In emergency situations,
      contact local authorities first.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpDocumentExports = () => (
  <HelpPageLayout
    category="Documents"
    title="Exporting messages and documents"
    description="How to export your CoParrent data for legal proceedings or personal records."
    headerIcon={<FolderOpen className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Documents", href: "/dashboard/documents" }}
    relatedLinks={[
      { title: "Court records and legal use", href: "/court-records" },
      { title: "Document storage", href: "/help/documents" },
      { title: "Messaging and communication", href: "/help/messaging" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Why export your data</h2>
      <p className="text-muted-foreground mb-4">
        CoParrent stores your communications and documents in a format that is useful for legal proceedings.
      </p>
      <HelpGrid columns={2}>
        <HelpCard icon={Scale} title="Court filings">Hearings, motions, and legal filings.</HelpCard>
        <HelpCard icon={FileText} title="Attorney review">Share records with legal counsel for case preparation.</HelpCard>
        <HelpCard icon={Users} title="Mediation sessions">Provide context and documentation for mediation.</HelpCard>
        <HelpCard icon={FolderOpen} title="Personal backup">Archive your records for personal reference.</HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Exporting messages</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Open the thread">Go to Messages and open the conversation you want to export.</HelpStep>
        <HelpStep number={2} title="Select export or Court View">Choose the export option or Court View mode.</HelpStep>
        <HelpStep number={3} title="Choose date range">Select the specific date range you want to include.</HelpStep>
        <HelpStep number={4} title="Download as PDF">Choose PDF format for a print-ready document.</HelpStep>
      </div>
      <HelpBanner variant="success" className="mt-4">
        Exported messages include full sender attribution, precise timestamps, and formatting for clarity in legal contexts.
      </HelpBanner>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Exporting documents</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-muted-foreground mb-4">For bulk document exports:</p>
        <div className="space-y-3">
          <HelpStep number={1} title="Go to Documents">Open the Documents section.</HelpStep>
          <HelpStep number={2} title="Select files">Use the export option to select multiple documents.</HelpStep>
          <HelpStep number={3} title="Download a ZIP">Download the selected files as a ZIP archive.</HelpStep>
        </div>
      </div>
    </section>

    <HelpCard icon={DollarSign} title="Exporting expense records">
      <p className="mb-3">Expense history can be exported as a detailed report including:</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <CheckItem>All logged expenses with dates</CheckItem>
        <CheckItem>Category breakdowns</CheckItem>
        <CheckItem>Receipt images included</CheckItem>
        <CheckItem>Running totals and balances</CheckItem>
      </div>
    </HelpCard>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Full data export</h2>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-2">Complete account export</h3>
        <p className="text-sm text-muted-foreground mb-3">You can request a complete export from Settings:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• All messages and conversations</li>
          <li>• All documents and attachments</li>
          <li>• Complete expense history</li>
          <li>• Calendar events and schedule changes</li>
          <li>• Audit logs of important actions</li>
        </ul>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Court-ready formatting</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /><span className="text-sm">Clear headers identifying the source</span></div>
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /><span className="text-sm">Timestamps in standard format</span></div>
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /><span className="text-sm">Full attribution on every entry</span></div>
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /><span className="text-sm">Page numbers for multi-page documents</span></div>
      </div>
    </section>

    <HelpNotice type="legal">
      Exported documents are for informational purposes. Consult with your attorney about proper formatting and
      authentication requirements for your jurisdiction.
    </HelpNotice>
    <HelpNotice type="info">
      We recommend exporting important records periodically for your own archives.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpSchedulePatterns = () => (
  <HelpPageLayout
    category="Scheduling"
    title="Understanding custody schedule patterns"
    description="Common custody arrangements and how to set them up in CoParrent."
    headerIcon={<Calendar className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Open Calendar", href: "/dashboard/calendar" }}
    relatedLinks={[
      { title: "Custody calendars and exchanges", href: "/help/scheduling" },
      { title: "Schedule change requests", href: "/help/scheduling/change-requests" },
      { title: "Getting started guide", href: "/help/getting-started" },
    ]}
  >
    <HelpBanner variant="primary">
      CoParrent supports a variety of custody schedules. Your schedule should match your custody agreement.
    </HelpBanner>

    <div className="space-y-4">
      <HelpCard icon={Calendar} title="Week-on / week-off">
        Each parent has the children for one full week at a time. Best for older children and fewer exchanges.
      </HelpCard>
      <HelpCard icon={Calendar} title="2-2-3 schedule">
        A two-week rotating schedule where children are never more than 2-3 days apart from either parent.
      </HelpCard>
      <HelpCard icon={Calendar} title="3-4-4-3 schedule">
        Parent A has 3 days, Parent B has 4 days, then they swap the following week.
      </HelpCard>
      <HelpCard icon={Calendar} title="Every other weekend">
        One parent has primary custody during the week while the other has every other weekend.
      </HelpCard>
      <HelpCard icon={Calendar} title="Custom schedules" variant="tip">
        You can also create schedules that do not follow standard patterns and override them for holidays.
      </HelpCard>
    </div>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Setting a pattern in CoParrent</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Open schedule settings">Go to the Calendar and open schedule settings.</HelpStep>
        <HelpStep number={2} title="Set who starts">Define who has the children first and when the pattern begins.</HelpStep>
        <HelpStep number={3} title="Add exchange defaults">Set default exchange times and locations.</HelpStep>
        <HelpStep number={4} title="Add overrides">Override the regular pattern for holidays and special days.</HelpStep>
      </div>
    </section>

    <HelpCard icon={ArrowRightLeft} title="Changing the custody pattern" variant="warning">
      If you need to change your custody pattern, both parents must agree. Use the schedule change request feature
      to propose and document any changes.
    </HelpCard>
    <HelpNotice type="legal">
      Your custody schedule in CoParrent should reflect your legal custody agreement. CoParrent does not create or
      modify legal custody arrangements.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpContact = () => (
  <HelpPageLayout
    category="Support"
    title="Contact Us"
    description="Get help from our team when you need it most."
    headerIcon={<Mail className="w-7 h-7 text-primary" />}
    relatedLinks={[
      { title: "Help Center Home", href: "/help" },
      { title: "Account & Billing", href: "/help/account" },
      { title: "Privacy & Security", href: "/help/privacy" },
    ]}
  >
    <section>
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-display font-semibold mb-2">Email Support</h2>
            <p className="text-muted-foreground mb-4">
              For questions, feedback, or issues, email our support team directly. We typically respond within one business day.
            </p>
            <a href="mailto:support@coparrent.com" className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
              support@coparrent.com
            </a>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-display font-semibold mb-2">Report a problem inside the app</h2>
        <p className="text-muted-foreground mb-4">
          If you are already signed in, you can send a structured report with the current page,
          app version, and device details attached automatically.
        </p>
        <ProblemReportButton>Open report form</ProblemReportButton>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Response times</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {[
          ["General inquiries", "1 business day", "bg-muted"],
          ["Billing questions", "1 business day", "bg-muted"],
          ["Account access issues", "Same day priority", "bg-primary/10 text-primary"],
          ["Security concerns", "Immediate priority", "bg-destructive/10 text-destructive"],
        ].map(([label, eta, tone], index) => (
          <div key={label} className={`p-4 flex justify-between items-center ${index < 3 ? "border-b border-border" : ""}`}>
            <span className="font-medium">{label}</span>
            <span className={`text-sm px-3 py-1 rounded-full ${tone}`}>{eta}</span>
          </div>
        ))}
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">What to include in your message</h2>
      <p className="text-muted-foreground mb-4">To help us assist you faster, please include:</p>
      <div className="space-y-4">
        <HelpStep number={1} title="Your account email">The email address you use to sign in to CoParrent.</HelpStep>
        <HelpStep number={2} title="Description of the issue">What you were trying to do and what happened instead.</HelpStep>
        <HelpStep number={3} title="Screenshots if applicable">Visual context helps us understand the problem faster.</HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Self-service options</h2>
      <p className="text-muted-foreground mb-4">Many common questions can be resolved through the Help Center:</p>
      <div className="grid gap-3">
        <Link to="/help/getting-started" className="block p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all group">
          <span className="font-semibold group-hover:text-primary transition-colors">Getting Started Guide</span>
          <p className="text-sm text-muted-foreground mt-1">Set up your account, invite your co-parent, add children</p>
        </Link>
        <Link to="/help/account" className="block p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all group">
          <span className="font-semibold group-hover:text-primary transition-colors">Account & Billing</span>
          <p className="text-sm text-muted-foreground mt-1">Subscription management, payment issues, plan upgrades</p>
        </Link>
        <Link to="/help/privacy" className="block p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all group">
          <span className="font-semibold group-hover:text-primary transition-colors">Privacy & Security</span>
          <p className="text-sm text-muted-foreground mt-1">Data protection, account security, export your data</p>
        </Link>
      </div>
    </section>

    <HelpNotice type="info">
      When you contact support, our team may access your account information to help resolve your issue. All support
      interactions are confidential.
    </HelpNotice>
    <HelpNotice type="safety">
      If you are in immediate danger, contact emergency services first. For domestic violence support, contact the
      National Domestic Violence Hotline at 1-800-799-7233.
    </HelpNotice>
  </HelpPageLayout>
);

export const HelpSecurity = () => (
  <HelpPageLayout
    category="Security"
    title="Security & Data Protection"
    description="How CoParrent protects your family's sensitive information."
    headerIcon={<Shield className="w-7 h-7 text-primary" />}
    primaryAction={{ label: "Go to Settings", href: "/dashboard/settings" }}
    relatedLinks={[
      { title: "Privacy Overview", href: "/help/privacy" },
      { title: "Account Settings", href: "/help/account" },
      { title: "Contact Support", href: "/help/contact" },
    ]}
  >
    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Our security philosophy</h2>
      <HelpBanner variant="primary">
        CoParrent handles sensitive family data that may be used in legal proceedings. We take this responsibility
        seriously with a defense-in-depth approach. Your data is private by default.
      </HelpBanner>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Encryption</h2>
      <HelpGrid columns={2}>
        <HelpCard icon={Lock} title="In Transit (TLS 1.3)" variant="primary">
          All data transmitted between your device and our servers is encrypted using TLS 1.3.
        </HelpCard>
        <HelpCard icon={Shield} title="At Rest (AES-256)">
          Your data is encrypted at rest using AES-256 encryption on our database infrastructure.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Access control</h2>
      <p className="text-muted-foreground mb-4">
        We enforce strict access controls to ensure only authorized users can view or modify your data:
      </p>
      <div className="space-y-3">
        <HelpCard icon={UserCheck} title="Role-based permissions">
          Parents, co-parents, step-parents, and third-party users have different access levels.
        </HelpCard>
        <HelpCard icon={Server} title="Server-side enforcement">
          Access rules are enforced at the database level, not just the interface.
        </HelpCard>
        <HelpCard icon={Eye} title="Audit logging">
          All data access is logged and available for your review.
        </HelpCard>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Authentication security</h2>
      <HelpGrid columns={1}>
        <HelpCard icon={KeyRound} title="Password requirements">
          Strong passwords are required and never stored in plain text, only secure hashes.
        </HelpCard>
        <HelpCard icon={Clock3} title="Session management">
          Sessions expire after inactivity. You can view and revoke active sessions from Settings.
        </HelpCard>
        <HelpCard icon={Shield} title="Two-factor authentication" variant="tip">
          Add an extra layer of security by enabling two-factor authentication.
        </HelpCard>
      </HelpGrid>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Protect your account</h2>
      <div className="space-y-4">
        <HelpStep number={1} title="Use a unique password">Do not reuse passwords from other sites or services.</HelpStep>
        <HelpStep number={2} title="Enable two-factor authentication">
          This is the single most effective way to protect your account.
        </HelpStep>
        <HelpStep number={3} title="Review your audit log">Check periodically for unexpected activity.</HelpStep>
        <HelpStep number={4} title="Keep your email secure">
          Your email is used for password recovery, so protect it too.
        </HelpStep>
      </div>
    </section>

    <section>
      <h2 className="text-xl font-display font-semibold mb-6">Report security issues</h2>
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6">
        <p className="text-muted-foreground mb-4">
          If you discover a security vulnerability or suspect unauthorized access, contact us immediately:
        </p>
        <a href="mailto:security@coparrent.com" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
          security@coparrent.com
        </a>
      </div>
    </section>

    <HelpNotice type="safety">
      If you are in an unsafe situation and concerned about someone accessing your account, contact support for
      assistance with securing your account or removing unauthorized access.
    </HelpNotice>
  </HelpPageLayout>
);
