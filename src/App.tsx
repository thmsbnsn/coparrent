import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FamilyProvider } from "@/contexts/FamilyContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { PWAUpdatePrompt } from "@/components/pwa/PWAUpdatePrompt";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProblemReportProvider } from "@/components/feedback/ProblemReportContext";

const Index = lazy(() => import("./pages/Index"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const ChildAppPage = lazy(() => import("./pages/ChildAppPage"));
const ChildAccessSetupPage = lazy(() => import("./pages/ChildAccessSetupPage"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const HelpGettingStarted = lazy(() => import("./pages/help/HelpGettingStarted"));
const HelpScheduling = lazy(() => import("./pages/help/HelpScheduling"));
const HelpMessaging = lazy(() => import("./pages/help/HelpMessaging"));
const HelpDocuments = lazy(() => import("./pages/help/HelpDocuments"));
const HelpExpenses = lazy(() => import("./pages/help/HelpExpenses"));
const HelpAccount = lazy(() => import("./pages/help/HelpAccount"));
const HelpPrivacy = lazy(() => import("./pages/help/HelpPrivacy"));
const HelpTrialEnding = lazy(() => import("./pages/help/HelpTrialEnding"));
const HelpScheduleChangeRequests = lazy(() => import("./pages/help/HelpScheduleChangeRequests"));
const HelpInvitations = lazy(() => import("./pages/help/HelpInvitations"));
const HelpDocumentExports = lazy(() => import("./pages/help/HelpDocumentExports"));
const HelpSchedulePatterns = lazy(() => import("./pages/help/HelpSchedulePatterns"));
const HelpContact = lazy(() => import("./pages/help/HelpContact"));
const HelpSecurity = lazy(() => import("./pages/help/HelpSecurity"));
const CourtRecordsPage = lazy(() => import("./pages/CourtRecordsPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const LawOfficeLogin = lazy(() => import("./pages/LawOfficeLogin"));
const LawOfficeSignup = lazy(() => import("./pages/LawOfficeSignup"));
const LawOfficeDashboard = lazy(() => import("./pages/LawOfficeDashboard"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GameDashboard = lazy(() => import("./pages/GameDashboard"));
const GameFlappyPage = lazy(() => import("./pages/GameFlappyPage"));
const GameLobbyPage = lazy(() => import("./pages/GameLobbyPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ChildrenPage = lazy(() => import("./pages/ChildrenPage"));
const MessagingHubPage = lazy(() => import("./pages/MessagingHubPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AddFamilyPage = lazy(() => import("./pages/AddFamilyPage"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const UnifiedLawLibraryPage = lazy(() => import("./pages/UnifiedLawLibraryPage"));
const LawArticleDetailPage = lazy(() => import("./pages/LawArticleDetailPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const SportsPage = lazy(() => import("./pages/SportsPage"));
const GiftsPage = lazy(() => import("./pages/GiftsPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const KidsDashboard = lazy(() => import("./pages/KidsDashboard"));
const KidsFlappyPage = lazy(() => import("./pages/KidsFlappyPage"));
const KidsPortalPage = lazy(() => import("./pages/KidsPortalPage"));
const KidCenterPage = lazy(() => import("./pages/KidCenterPage"));
const KidsHubPage = lazy(() => import("./pages/KidsHubPage"));
const NurseNancyPage = lazy(() => import("./pages/NurseNancyPage"));
const ColoringPagesPage = lazy(() => import("./pages/ColoringPagesPage"));
const ActivitiesPage = lazy(() => import("./pages/ActivitiesPage"));
const CreationsLibraryPage = lazy(() => import("./pages/CreationsLibraryPage"));
const OfflinePage = lazy(() => import("./pages/OfflinePage"));
const PWADiagnosticsPage = lazy(() => import("./pages/PWADiagnosticsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

const queryClient = new QueryClient();
const routeFallback = <LoadingSpinner fullScreen message="Loading page..." />;

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <FamilyProvider>
            <Toaster />
            <Sonner />
            <OfflineIndicator />
            <PWAInstallPrompt />
            <PWAUpdatePrompt />
            <BrowserRouter>
            <ProblemReportProvider>
            <CookieConsentBanner />
            <Suspense fallback={routeFallback}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<RouteErrorBoundary routeName="Home"><Index /></RouteErrorBoundary>} />
                <Route path="/pricing" element={<RouteErrorBoundary routeName="Pricing"><Pricing /></RouteErrorBoundary>} />
                <Route path="/about" element={<RouteErrorBoundary routeName="About"><About /></RouteErrorBoundary>} />
                <Route path="/features" element={<RouteErrorBoundary routeName="Features"><FeaturesPage /></RouteErrorBoundary>} />
                <Route path="/child-app" element={<RouteErrorBoundary routeName="Child App"><ChildAppPage /></RouteErrorBoundary>} />
                <Route path="/help" element={<RouteErrorBoundary routeName="Help"><HelpCenter /></RouteErrorBoundary>} />
                <Route path="/help/getting-started" element={<RouteErrorBoundary routeName="Help - Getting Started"><HelpGettingStarted /></RouteErrorBoundary>} />
                <Route path="/help/getting-started/invitations" element={<RouteErrorBoundary routeName="Help - Invitations"><HelpInvitations /></RouteErrorBoundary>} />
                <Route path="/help/scheduling" element={<RouteErrorBoundary routeName="Help - Scheduling"><HelpScheduling /></RouteErrorBoundary>} />
                <Route path="/help/scheduling/change-requests" element={<RouteErrorBoundary routeName="Help - Change Requests"><HelpScheduleChangeRequests /></RouteErrorBoundary>} />
                <Route path="/help/scheduling/patterns" element={<RouteErrorBoundary routeName="Help - Patterns"><HelpSchedulePatterns /></RouteErrorBoundary>} />
                <Route path="/help/messaging" element={<RouteErrorBoundary routeName="Help - Messaging"><HelpMessaging /></RouteErrorBoundary>} />
                <Route path="/help/documents" element={<RouteErrorBoundary routeName="Help - Documents"><HelpDocuments /></RouteErrorBoundary>} />
                <Route path="/help/documents/exports" element={<RouteErrorBoundary routeName="Help - Exports"><HelpDocumentExports /></RouteErrorBoundary>} />
                <Route path="/help/expenses" element={<RouteErrorBoundary routeName="Help - Expenses"><HelpExpenses /></RouteErrorBoundary>} />
                <Route path="/help/account" element={<RouteErrorBoundary routeName="Help - Account"><HelpAccount /></RouteErrorBoundary>} />
                <Route path="/help/account/trial-ending" element={<RouteErrorBoundary routeName="Help - Trial Ending"><HelpTrialEnding /></RouteErrorBoundary>} />
                <Route path="/help/privacy" element={<RouteErrorBoundary routeName="Help - Privacy"><HelpPrivacy /></RouteErrorBoundary>} />
                <Route path="/help/security" element={<RouteErrorBoundary routeName="Help - Security"><HelpSecurity /></RouteErrorBoundary>} />
                <Route path="/help/contact" element={<RouteErrorBoundary routeName="Help - Contact"><HelpContact /></RouteErrorBoundary>} />
                <Route path="/court-records" element={<RouteErrorBoundary routeName="Court Records"><CourtRecordsPage /></RouteErrorBoundary>} />
                <Route path="/terms" element={<RouteErrorBoundary routeName="Terms"><TermsPage /></RouteErrorBoundary>} />
                <Route path="/privacy" element={<RouteErrorBoundary routeName="Privacy"><PrivacyPage /></RouteErrorBoundary>} />
                <Route path="/blog" element={<RouteErrorBoundary routeName="Blog"><BlogPage /></RouteErrorBoundary>} />
                <Route path="/blog/:slug" element={<RouteErrorBoundary routeName="Blog Post"><BlogPostPage /></RouteErrorBoundary>} />
                
                {/* Auth Routes */}
                <Route path="/login" element={<RouteErrorBoundary routeName="Login"><Login /></RouteErrorBoundary>} />
                <Route path="/signup" element={<RouteErrorBoundary routeName="Signup"><Signup /></RouteErrorBoundary>} />
                <Route path="/auth/callback" element={<RouteErrorBoundary routeName="Auth Callback"><AuthCallback /></RouteErrorBoundary>} />
                <Route path="/forgot-password" element={<RouteErrorBoundary routeName="Forgot Password"><ForgotPassword /></RouteErrorBoundary>} />
                <Route path="/reset-password" element={<RouteErrorBoundary routeName="Reset Password"><ResetPassword /></RouteErrorBoundary>} />
                <Route path="/payment-success" element={<RouteErrorBoundary routeName="Payment Success"><PaymentSuccess /></RouteErrorBoundary>} />
                <Route path="/accept-invite" element={<RouteErrorBoundary routeName="Accept Invite"><AcceptInvite /></RouteErrorBoundary>} />
                
                {/* Law Office Portal Routes */}
                <Route path="/law-office/login" element={<RouteErrorBoundary routeName="Law Office Login"><LawOfficeLogin /></RouteErrorBoundary>} />
                <Route path="/law-office/signup" element={<RouteErrorBoundary routeName="Law Office Signup"><LawOfficeSignup /></RouteErrorBoundary>} />
                <Route path="/law-office" element={<Navigate to="/law-office/dashboard" replace />} />
                <Route path="/law-office/dashboard" element={<ProtectedRoute><RouteErrorBoundary routeName="Law Office Dashboard"><LawOfficeDashboard /></RouteErrorBoundary></ProtectedRoute>} />
                
                {/* Child Account Dashboard (Kids only) */}
                <Route path="/kids/portal" element={<ProtectedRoute><RouteErrorBoundary routeName="Kids Portal"><KidsPortalPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/kids/games/flappy-plane" element={<ProtectedRoute><RouteErrorBoundary routeName="Kids Game"><KidsFlappyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/kids" element={<ProtectedRoute><RouteErrorBoundary routeName="Kids Dashboard"><KidsDashboard /></RouteErrorBoundary></ProtectedRoute>} />
                
                {/* Protected Routes (Parent/Guardian) */}
                <Route path="/onboarding" element={<ProtectedRoute><RouteErrorBoundary routeName="Onboarding"><Onboarding /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><RouteErrorBoundary routeName="Dashboard"><Dashboard /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/games" element={<ProtectedRoute><RouteErrorBoundary routeName="Games"><GameDashboard /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/games/flappy-plane" element={<ProtectedRoute><RouteErrorBoundary routeName="Toy Plane Dash"><GameFlappyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/games/flappy-plane/lobby" element={<ProtectedRoute><RouteErrorBoundary routeName="Toy Plane Dash Lobby"><GameLobbyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/games/flappy-plane/lobby/:sessionId" element={<ProtectedRoute><RouteErrorBoundary routeName="Toy Plane Dash Lobby"><GameLobbyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/calendar" element={<ProtectedRoute><RouteErrorBoundary routeName="Calendar"><CalendarPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/children" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Children"><ChildrenPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/messages" element={<ProtectedRoute><RouteErrorBoundary routeName="Messages"><MessagingHubPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/messages-legacy" element={<Navigate to="/dashboard/messages" replace />} />
                <Route path="/dashboard/documents" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Documents"><DocumentsPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/settings" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Settings"><SettingsPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/settings/child-access/:childId" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Child Access Setup"><ChildAccessSetupPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/families/new" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Add Family"><AddFamilyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/notifications" element={<ProtectedRoute><RouteErrorBoundary routeName="Notifications"><NotificationsPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/law-library" element={<ProtectedRoute><RouteErrorBoundary routeName="Law Library"><UnifiedLawLibraryPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/law-library/resources" element={<ProtectedRoute><RouteErrorBoundary routeName="Law Library"><UnifiedLawLibraryPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/law-library/:slug" element={<ProtectedRoute><RouteErrorBoundary routeName="Law Article"><LawArticleDetailPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/journal" element={<ProtectedRoute><RouteErrorBoundary routeName="Journal"><JournalPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/expenses" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Expenses"><ExpensesPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/sports" element={<ProtectedRoute><RouteErrorBoundary routeName="Sports"><SportsPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/gifts" element={<ProtectedRoute><RouteErrorBoundary routeName="Gifts"><GiftsPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kid-center" element={<ProtectedRoute><RouteErrorBoundary routeName="Kid Center"><KidCenterPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Kids Hub"><KidsHubPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub/nurse-nancy" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Nurse Nancy"><NurseNancyPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub/coloring-pages" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Coloring Pages"><ColoringPagesPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub/chore-chart" element={<Navigate to="/dashboard/kids-hub" replace />} />
                <Route path="/dashboard/kids-hub/activities" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Activities"><ActivitiesPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub/creations" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Creations Library"><CreationsLibraryPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/kids-hub/*" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Kids Hub"><KidsHubPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/audit" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Audit Log"><AuditLogPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/blog" element={<ProtectedRoute><RouteErrorBoundary routeName="Blog"><BlogPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/blog/:slug" element={<ProtectedRoute><RouteErrorBoundary routeName="Blog Post"><BlogPostPage /></RouteErrorBoundary></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireParent><RouteErrorBoundary routeName="Admin"><AdminDashboard /></RouteErrorBoundary></ProtectedRoute>} />
                {/* Offline Route */}
                <Route path="/offline" element={<RouteErrorBoundary routeName="Offline"><OfflinePage /></RouteErrorBoundary>} />
                
                {/* PWA Diagnostics (Internal QA) */}
                <Route path="/pwa-diagnostics" element={<ProtectedRoute><RouteErrorBoundary routeName="PWA Diagnostics"><PWADiagnosticsPage /></RouteErrorBoundary></ProtectedRoute>} />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ProblemReportProvider>
            </BrowserRouter>
            </FamilyProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
