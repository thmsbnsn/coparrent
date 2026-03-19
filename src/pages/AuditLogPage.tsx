import { motion } from "framer-motion";
import { Shield, History } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { useRealtimeChildren } from "@/hooks/useRealtimeChildren";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const AuditLogPage = () => {
  const { children, loading: childrenLoading } = useRealtimeChildren();
  const { isThirdParty, loading: roleLoading } = useFamilyRole();

  if (childrenLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" message="Loading..." />
        </div>
      </DashboardLayout>
    );
  }

  // Third-party users cannot access audit logs
  if (isThirdParty) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground max-w-md">
            Audit logs are only available to parents. If you believe this is an
            error, please contact the primary parent.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <History className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold">
              Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Court-defensible record of all child data access and modifications
            </p>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />
                What is logged?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• When a child's profile is viewed in detail</li>
                <li>• When a child's information is created, updated, or deleted</li>
                <li>• Activity events (sports, practices) are created, updated, or viewed</li>
                <li>• Calendar events are scheduled, modified, or viewed</li>
                <li>• Messages are sent, edited, or viewed</li>
                <li>• Documents are uploaded, updated, or viewed</li>
                <li>• Expenses are recorded, modified, or viewed</li>
                <li>• Gift lists and items are created, updated, or managed</li>
                <li>• Chores are assigned, completed, or modified</li>
                <li>• Family member roles and permissions are changed</li>
                <li>• User profiles are updated</li>
                <li>• Notifications are sent</li>
                <li>• Who performed each action and when</li>
                <li>• Changes made (before/after values for updates)</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Audit Log Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>
                All access and modifications to child records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogTable children={children} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogPage;
