import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Search, Shield, ArrowLeft, RefreshCw, Loader2, Users, Scale, ClipboardCheck, Database, Activity, Bell, Ticket } from "lucide-react";
import { resolveDisplayValue } from "@/lib/displayResolver";
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
import { AdminLawLibraryManager } from "@/components/admin/AdminLawLibraryManager";
import { ProductionChecklist } from "@/components/admin/ProductionChecklist";
import { SeedDataPanel } from "@/components/admin/SeedDataPanel";
import { MigrationDryRunPanel } from "@/components/admin/MigrationDryRunPanel";
import { AdminPushTester } from "@/components/admin/AdminPushTester";
import { AdminAccessCodeManager } from "@/components/admin/AdminAccessCodeManager";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  free_premium_access: boolean;
  access_reason: string | null;
  created_at: string;
  stripe_status?: string | null;
  stripe_subscription_end?: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserProfile | null;
    newValue: boolean;
  }>({ open: false, user: null, newValue: false });
  const [editingReason, setEditingReason] = useState<{ id: string; value: string } | null>(null);
  const [activeTab, setActiveTab] = useState("users");

  // Check if user is admin using secure server-side RPC
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        // Use the secure is_admin() RPC function instead of client-side query
        const { data, error } = await supabase.rpc("is_admin");
        
        if (error) {
          console.error("Admin check error:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const queryParams = `?action=list${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`;
      const response = await supabase.functions.invoke(`admin-manage-users${queryParams}`, {
        method: "POST",
        body: {},
      });

      if (response.error) throw response.error;
      
      setUsers(response.data?.users || []);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, searchQuery, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  // Update user access
  const updateUserAccess = async (profile: UserProfile, freeAccess: boolean, reason?: string) => {
    setUpdating(profile.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-users?action=update-access", {
        method: "POST",
        body: {
          profile_id: profile.id,
          free_premium_access: freeAccess,
          access_reason: reason ?? profile.access_reason,
        },
      });

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === profile.id 
          ? { ...u, free_premium_access: freeAccess, access_reason: reason ?? u.access_reason }
          : u
      ));

      toast({
        title: "Success",
        description: `${freeAccess ? "Granted" : "Revoked"} premium access for ${profile.email}`,
      });
    } catch (error: unknown) {
      console.error("Error updating access:", error);
      toast({
        title: "Error",
        description: "Failed to update user access",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
      setConfirmDialog({ open: false, user: null, newValue: false });
    }
  };

  const handleToggle = (profile: UserProfile, newValue: boolean) => {
    setConfirmDialog({ open: true, user: profile, newValue });
  };

  const handleReasonSave = async (profile: UserProfile, reason: string) => {
    setUpdating(profile.id);
    try {
      const { error } = await supabase.functions.invoke("admin-manage-users?action=update-access", {
        method: "POST",
        body: {
          profile_id: profile.id,
          free_premium_access: profile.free_premium_access,
          access_reason: reason,
        },
      });

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.id === profile.id ? { ...u, access_reason: reason } : u
      ));
      setEditingReason(null);

      toast({
        title: "Success",
        description: "Access reason updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update access reason",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  // Loading state
  if (authLoading || isAdmin === null) {
    return <LoadingSpinner fullScreen message="Checking access..." />;
  }

  // Not authenticated or not admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">Manage users and content</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="law-library" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Law Library
            </TabsTrigger>
            <TabsTrigger value="access-codes" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Access Codes
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Production
            </TabsTrigger>
            <TabsTrigger value="seed" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Seed Data
            </TabsTrigger>
            <TabsTrigger value="migration" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Migration
            </TabsTrigger>
            <TabsTrigger value="push" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Push
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      Toggle free premium access for promotional or partner accounts
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={fetchUsers} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={fetchUsers} disabled={loading}>
                    Search
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Stripe Status</TableHead>
                          <TableHead>Free Access</TableHead>
                          <TableHead>Access Reason</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((profile) => (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.email}</TableCell>
                            <TableCell>{resolveDisplayValue(profile.full_name, "Not set")}</TableCell>
                            <TableCell>
                              {profile.stripe_status === "active" ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : profile.stripe_status === "inactive" ? (
                                <Badge variant="secondary">Inactive</Badge>
                              ) : (
                                <Badge variant="outline">None</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={profile.free_premium_access}
                                  onCheckedChange={(checked) => handleToggle(profile, checked)}
                                  disabled={updating === profile.id}
                                />
                                {updating === profile.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {editingReason?.id === profile.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={editingReason.value}
                                    onChange={(e) => setEditingReason({ id: profile.id, value: e.target.value })}
                                    className="h-8 text-sm"
                                    maxLength={255}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleReasonSave(profile, editingReason.value)}
                                    disabled={updating === profile.id}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingReason(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className="cursor-pointer hover:underline text-sm truncate block"
                                  onClick={() => setEditingReason({ id: profile.id, value: profile.access_reason || "" })}
                                  title={profile.access_reason || "Click to add reason"}
                                >
                                  {profile.access_reason || <span className="text-muted-foreground italic">Add reason...</span>}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(profile.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="law-library">
            <AdminLawLibraryManager />
          </TabsContent>

          <TabsContent value="access-codes">
            <AdminAccessCodeManager />
          </TabsContent>

          <TabsContent value="checklist">
            <ProductionChecklist />
          </TabsContent>

          <TabsContent value="seed">
            <SeedDataPanel />
          </TabsContent>

          <TabsContent value="migration">
            <MigrationDryRunPanel />
          </TabsContent>

          <TabsContent value="push">
            <AdminPushTester />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, user: null, newValue: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.newValue ? "Grant Premium Access?" : "Revoke Premium Access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.newValue
                ? `This will give ${confirmDialog.user?.email} full premium access without requiring a Stripe subscription.`
                : `This will revoke free premium access for ${confirmDialog.user?.email}. They will need an active Stripe subscription for premium features.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.user && updateUserAccess(confirmDialog.user, confirmDialog.newValue)}
            >
              {confirmDialog.newValue ? "Grant Access" : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
