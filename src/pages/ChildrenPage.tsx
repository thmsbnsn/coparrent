import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Baby, Calendar, Heart, School, Phone, Droplet, AlertCircle, Pill, Users, Check, Image, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRealtimeChildren } from "@/hooks/useRealtimeChildren";
import { addChildSchema } from "@/lib/validations";
import { ChildAvatar } from "@/components/children/ChildAvatar";
import { ChildPhotoGallery } from "@/components/children/ChildPhotoGallery";
import { DeleteChildDialog } from "@/components/children/DeleteChildDialog";
import { ViewOnlyBadge } from "@/components/ui/ViewOnlyBadge";
import { PermissionButton } from "@/components/ui/PermissionButton";
import { usePermissions } from "@/hooks/usePermissions";
import type { Child } from "@/hooks/useChildren";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const GRADE_OPTIONS = [
  "Pre-K",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade (Freshman)",
  "10th Grade (Sophomore)",
  "11th Grade (Junior)",
  "12th Grade (Senior)",
  "College",
  "Not in School",
];
const calculateAge = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  // Parse date as local date (YYYY-MM-DD string without time conversion)
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Format date without timezone conversion
const formatDate = (dateString: string | null) => {
  if (!dateString) return "Not set";
  // Parse as local date to avoid timezone offset
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// Segmented control for tabs that wraps on mobile
const TabSegment = ({ 
  tabs, 
  activeTab, 
  onTabChange 
}: { 
  tabs: { id: string; label: string; icon: React.ElementType }[]; 
  activeTab: string; 
  onTabChange: (id: string) => void;
}) => (
  <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-lg w-full">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{tab.label}</span>
        </button>
      );
    })}
  </div>
);

// Info card component
const InfoCard = ({ 
  icon: Icon, 
  label, 
  value, 
  variant 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  variant?: "destructive" | "default";
}) => (
  <div className={cn(
    "p-3 sm:p-4 rounded-xl border",
    variant === "destructive" ? "bg-destructive/10 border-destructive/30" : "bg-muted/30"
  )}>
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className={cn(
        "w-4 h-4",
        variant === "destructive" ? "text-destructive" : "text-muted-foreground"
      )} />
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
    </div>
    <p className="font-medium text-sm sm:text-base">{value}</p>
  </div>
);

const ChildrenPage = () => {
  const { children, loading, addChild, updateChild, deleteChild } = useRealtimeChildren();
  const { kids_used, max_kids, canAddChild, isAtChildLimit, tier, refresh: refreshLimits } = usePlanLimits();
  const { permissions } = usePermissions();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildDob, setNewChildDob] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [editActiveTab, setEditActiveTab] = useState("basic");
  const [childToDelete, setChildToDelete] = useState<Child | null>(null);
  
  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ name: false, dob: false });
  
  // Edit form states
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editBloodType, setEditBloodType] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editMedications, setEditMedications] = useState("");
  const [editMedicalNotes, setEditMedicalNotes] = useState("");
  const [editEmergencyContact, setEditEmergencyContact] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editDoctorPhone, setEditDoctorPhone] = useState("");
  const [editSchoolName, setEditSchoolName] = useState("");
  const [editSchoolPhone, setEditSchoolPhone] = useState("");
  const [editGrade, setEditGrade] = useState("");

  const profileTabs = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "gallery", label: "Gallery", icon: Image },
    { id: "health", label: "Health", icon: Heart },
    { id: "school", label: "School", icon: School },
    { id: "emergency", label: "Emergency", icon: Phone },
  ];

  const editTabs = [
    { id: "basic", label: "Basic", icon: Users },
    { id: "health", label: "Health", icon: Heart },
    { id: "school", label: "School", icon: School },
    { id: "emergency", label: "Emergency", icon: Phone },
  ];

  // Auto-select first child when loaded
  useEffect(() => {
    if (!selectedChild && children.length > 0) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild]);

  // Validate form data
  const validateForm = () => {
    const result = addChildSchema.safeParse({
      name: newChildName,
      dateOfBirth: newChildDob || undefined,
    });
    
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setNameError(errors.name?.[0] || null);
      setDobError(errors.dateOfBirth?.[0] || null);
      return false;
    }
    
    setNameError(null);
    setDobError(null);
    return true;
  };

  // Validate on field change when touched
  useEffect(() => {
    if (touched.name || touched.dob) {
      const result = addChildSchema.safeParse({
        name: newChildName,
        dateOfBirth: newChildDob || undefined,
      });
      
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        if (touched.name) setNameError(errors.name?.[0] || null);
        if (touched.dob) setDobError(errors.dateOfBirth?.[0] || null);
      } else {
        setNameError(null);
        setDobError(null);
      }
    }
  }, [newChildName, newChildDob, touched]);

  const resetAddForm = () => {
    setNewChildName("");
    setNewChildDob("");
    setNameError(null);
    setDobError(null);
    setTouched({ name: false, dob: false });
  };

  const handleAddChild = async () => {
    setTouched({ name: true, dob: true });
    if (!validateForm()) return;
    
    setIsSaving(true);
    try {
      const child = await addChild(newChildName.trim(), newChildDob || undefined);
      if (child) {
        resetAddForm();
        setIsAddDialogOpen(false);
        setSelectedChild(child);
        refreshLimits(); // Refresh plan limits after adding
      }
    } catch (error) {
      console.error("Error adding child:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditChild = async () => {
    if (!selectedChild || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      const success = await updateChild(selectedChild.id, {
        name: editName.trim(),
        date_of_birth: editDob || null,
        blood_type: editBloodType || null,
        allergies: editAllergies ? editAllergies.split(",").map(a => a.trim()) : null,
        medications: editMedications ? editMedications.split(",").map(m => m.trim()) : null,
        medical_notes: editMedicalNotes || null,
        emergency_contact: editEmergencyContact || null,
        emergency_phone: editEmergencyPhone || null,
        doctor_name: editDoctorName || null,
        doctor_phone: editDoctorPhone || null,
        school_name: editSchoolName || null,
        school_phone: editSchoolPhone || null,
        grade: editGrade || null,
      });
      if (success) {
        setSelectedChild({
          ...selectedChild,
          name: editName.trim(),
          date_of_birth: editDob || null,
          blood_type: editBloodType || null,
          allergies: editAllergies ? editAllergies.split(",").map(a => a.trim()) : null,
          medications: editMedications ? editMedications.split(",").map(m => m.trim()) : null,
          medical_notes: editMedicalNotes || null,
          emergency_contact: editEmergencyContact || null,
          emergency_phone: editEmergencyPhone || null,
          doctor_name: editDoctorName || null,
          doctor_phone: editDoctorPhone || null,
          school_name: editSchoolName || null,
          school_phone: editSchoolPhone || null,
          grade: editGrade || null,
        });
        setIsEditDialogOpen(false);
      }
    } catch (error) {
      console.error("Error updating child:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = () => {
    if (selectedChild) {
      setEditName(selectedChild.name);
      setEditDob(selectedChild.date_of_birth || "");
      setEditBloodType(selectedChild.blood_type || "");
      setEditAllergies(selectedChild.allergies?.join(", ") || "");
      setEditMedications(selectedChild.medications?.join(", ") || "");
      setEditMedicalNotes(selectedChild.medical_notes || "");
      setEditEmergencyContact(selectedChild.emergency_contact || "");
      setEditEmergencyPhone(selectedChild.emergency_phone || "");
      setEditDoctorName(selectedChild.doctor_name || "");
      setEditDoctorPhone(selectedChild.doctor_phone || "");
      setEditSchoolName(selectedChild.school_name || "");
      setEditSchoolPhone(selectedChild.school_phone || "");
      setEditGrade(selectedChild.grade || "");
      setEditActiveTab("basic");
      setIsEditDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
          <LoadingSpinner size="lg" message="Loading children..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold">Child Information Hub</h1>
                {permissions.isViewOnly && (
                  <ViewOnlyBadge reason={permissions.viewOnlyReason || undefined} size="sm" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1">
                {permissions.isViewOnly 
                  ? "View child information (managed by parents)"
                  : "Keep important details organized and shared"}
              </p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            if (!open) resetAddForm();
            setIsAddDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <PermissionButton 
                className="w-full sm:w-auto shrink-0" 
                disabled={isAtChildLimit}
                hasPermission={permissions.canManageChildren}
                deniedMessage="Only parents can add children"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isAtChildLimit ? `Limit Reached (${max_kids})` : "Add Child"}
              </PermissionButton>
            </DialogTrigger>
            <DialogContent className="mx-4 sm:mx-auto max-w-md">
              <DialogHeader>
                <DialogTitle>Add a Child</DialogTitle>
                <DialogDescription>
                  Enter your child's information. This will be shared with your co-parent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="Child's name"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                    className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {nameError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {nameError}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={newChildDob}
                    onChange={(e) => setNewChildDob(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, dob: true }))}
                    className={dobError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {dobError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {dobError}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleAddChild} disabled={isSaving || !!nameError} className="w-full sm:w-auto">
                  {isSaving ? "Adding..." : "Add Child"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {children.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Baby className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg sm:text-xl font-display font-bold">No Children Added Yet</h2>
                  <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md px-4">
                    Add your children to keep track of their information and share it with your co-parent.
                  </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Child
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Child List - Vertical on all screens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-4 xl:col-span-3"
            >
              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/30 border-b space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Your Children
                    </CardTitle>
                    <Badge variant={isAtChildLimit ? "destructive" : "secondary"} className="text-xs">
                      {kids_used}/{max_kids}
                    </Badge>
                  </div>
                  <Progress value={(kids_used / max_kids) * 100} className="h-1.5" />
                  {isAtChildLimit && (
                    <p className="text-xs text-muted-foreground">
                      {tier === "free" ? "Upgrade to Power for up to 6 children" : "Maximum reached"}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-2">
                  <div className="flex flex-col gap-1.5">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedChild(child)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all w-full text-left",
                          selectedChild?.id === child.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-transparent hover:border-border hover:bg-muted/50"
                        )}
                      >
                        <ChildAvatar
                          childId={child.id}
                          name={child.name}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{child.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {calculateAge(child.date_of_birth) !== null
                              ? `${calculateAge(child.date_of_birth)} years old`
                              : "Age not set"}
                          </p>
                        </div>
                        {selectedChild?.id === child.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Child Profile - Main content */}
            <div className="lg:col-span-8 xl:col-span-9">
              <AnimatePresence mode="wait">
                {selectedChild ? (
                  <motion.div
                    key={selectedChild.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className="overflow-hidden">
                      {/* Profile Header - Enhanced with larger avatar */}
                      <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <ChildAvatar
                            childId={selectedChild.id}
                            name={selectedChild.name}
                            size="xl"
                            editable
                            className="mx-auto sm:mx-0"
                          />
                          <div className="flex-1 min-w-0 text-center sm:text-left">
                            <h2 className="text-xl sm:text-2xl font-display font-bold truncate">
                              {selectedChild.name}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                              {selectedChild.date_of_birth
                                ? `Born ${formatDate(selectedChild.date_of_birth)} • ${calculateAge(selectedChild.date_of_birth)} years old`
                                : "Date of birth not set"}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button 
                                onClick={openEditDialog} 
                                className="flex-1 sm:flex-none"
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit Profile
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setChildToDelete(selectedChild)}
                                className="flex-1 sm:flex-none text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile Content with Segmented Tabs */}
                      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                        <TabSegment
                          tabs={profileTabs}
                          activeTab={activeTab}
                          onTabChange={setActiveTab}
                        />

                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                          >
                            {activeTab === "overview" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <InfoCard icon={Calendar} label="Date of Birth" value={formatDate(selectedChild.date_of_birth)} />
                                <InfoCard 
                                  icon={Baby} 
                                  label="Age" 
                                  value={calculateAge(selectedChild.date_of_birth) !== null
                                    ? `${calculateAge(selectedChild.date_of_birth)} years old`
                                    : "Not set"} 
                                />
                                <InfoCard icon={Droplet} label="Blood Type" value={selectedChild.blood_type || "Not set"} />
                                <InfoCard icon={School} label="School" value={selectedChild.school_name || "Not set"} />
                              </div>
                            )}

                            {activeTab === "gallery" && (
                              <ChildPhotoGallery
                                childId={selectedChild.id}
                                childName={selectedChild.name}
                              />
                            )}

                            {activeTab === "health" && (
                              <div className="space-y-3 sm:space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                  <InfoCard icon={Droplet} label="Blood Type" value={selectedChild.blood_type || "Not set"} variant="destructive" />
                                  <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Heart className="w-4 h-4 text-muted-foreground" />
                                      <h4 className="text-xs font-medium text-muted-foreground">Doctor</h4>
                                    </div>
                                    <p className="font-medium text-sm sm:text-base">{selectedChild.doctor_name || "Not set"}</p>
                                    {selectedChild.doctor_phone && (
                                      <p className="text-xs sm:text-sm text-muted-foreground">{selectedChild.doctor_phone}</p>
                                    )}
                                  </div>
                                </div>
                                
                                {selectedChild.allergies && selectedChild.allergies.length > 0 && (
                                  <div className="p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertCircle className="w-4 h-4 text-destructive" />
                                      <h4 className="text-xs font-medium text-destructive">Allergies</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedChild.allergies.map((allergy, i) => (
                                        <Badge key={i} variant="destructive" className="text-xs">
                                          {allergy}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {selectedChild.medications && selectedChild.medications.length > 0 && (
                                  <div className="p-3 sm:p-4 rounded-xl bg-warning/10 border border-warning/30">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Pill className="w-4 h-4 text-warning" />
                                      <h4 className="text-xs font-medium">Current Medications</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedChild.medications.map((med, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs bg-warning/20">
                                          {med}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {selectedChild.medical_notes && (
                                  <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Medical Notes</h4>
                                    <p className="text-sm">{selectedChild.medical_notes}</p>
                                  </div>
                                )}

                                {!selectedChild.blood_type && !selectedChild.allergies?.length && !selectedChild.medications?.length && (
                                  <Card className="border-dashed">
                                    <CardContent className="p-4 text-center">
                                      <p className="text-sm text-muted-foreground">
                                        No health information added yet. Click "Edit Profile" to add details.
                                      </p>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            )}

                            {activeTab === "school" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <School className="w-4 h-4 text-muted-foreground" />
                                    <h4 className="text-xs font-medium text-muted-foreground">School</h4>
                                  </div>
                                  <p className="font-medium text-sm sm:text-base">{selectedChild.school_name || "Not set"}</p>
                                  {selectedChild.school_phone && (
                                    <p className="text-xs sm:text-sm text-muted-foreground">{selectedChild.school_phone}</p>
                                  )}
                                </div>
                                <InfoCard icon={Calendar} label="Grade" value={selectedChild.grade || "Not set"} />
                              </div>
                            )}

                            {activeTab === "emergency" && (
                              <div className="space-y-3 sm:space-y-4">
                                <div className="p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Phone className="w-4 h-4 text-destructive" />
                                    <h4 className="font-medium text-destructive text-sm sm:text-base">Emergency Contact</h4>
                                  </div>
                                  <p className="font-medium text-sm sm:text-base">{selectedChild.emergency_contact || "Not set"}</p>
                                  {selectedChild.emergency_phone && (
                                    <p className="text-lg sm:text-xl font-bold mt-1">{selectedChild.emergency_phone}</p>
                                  )}
                                </div>
                                
                                {selectedChild.doctor_name && (
                                  <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Heart className="w-4 h-4 text-muted-foreground" />
                                      <h4 className="text-xs font-medium text-muted-foreground">Primary Doctor</h4>
                                    </div>
                                    <p className="font-medium text-sm sm:text-base">{selectedChild.doctor_name}</p>
                                    {selectedChild.doctor_phone && (
                                      <p className="text-lg sm:text-xl font-bold mt-1">{selectedChild.doctor_phone}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <Users className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <h3 className="font-medium text-base sm:text-lg">Select a child</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Choose from the list to view their profile
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Child Profile</DialogTitle>
            <DialogDescription>
              Update your child's information. All changes are shared with your co-parent.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <TabSegment
              tabs={editTabs}
              activeTab={editActiveTab}
              onTabChange={setEditActiveTab}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={editActiveTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {editActiveTab === "basic" && (
                  <>
                    {selectedChild && (
                      <div className="flex justify-center">
                        <ChildAvatar
                          childId={selectedChild.id}
                          name={editName || selectedChild.name}
                          size="xl"
                          editable
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        placeholder="Child's name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-dob">Date of Birth</Label>
                      <Input
                        id="edit-dob"
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {editActiveTab === "health" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-blood-type">Blood Type</Label>
                      <Select value={editBloodType} onValueChange={setEditBloodType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood type" />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOOD_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-allergies">Allergies (comma-separated)</Label>
                      <Input
                        id="edit-allergies"
                        placeholder="e.g., Peanuts, Penicillin, Bee stings"
                        value={editAllergies}
                        onChange={(e) => setEditAllergies(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-medications">Current Medications (comma-separated)</Label>
                      <Input
                        id="edit-medications"
                        placeholder="e.g., Inhaler, Allergy medication"
                        value={editMedications}
                        onChange={(e) => setEditMedications(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-medical-notes">Medical Notes</Label>
                      <Textarea
                        id="edit-medical-notes"
                        placeholder="Any additional medical information..."
                        value={editMedicalNotes}
                        onChange={(e) => setEditMedicalNotes(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-doctor-name">Doctor Name</Label>
                        <Input
                          id="edit-doctor-name"
                          placeholder="Dr. Smith"
                          value={editDoctorName}
                          onChange={(e) => setEditDoctorName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-doctor-phone">Doctor Phone</Label>
                        <Input
                          id="edit-doctor-phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={editDoctorPhone}
                          onChange={(e) => setEditDoctorPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {editActiveTab === "school" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-school-name">School Name</Label>
                      <Input
                        id="edit-school-name"
                        placeholder="School name"
                        value={editSchoolName}
                        onChange={(e) => setEditSchoolName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-school-phone">School Phone</Label>
                        <Input
                          id="edit-school-phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={editSchoolPhone}
                          onChange={(e) => setEditSchoolPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-grade">Grade</Label>
                        <Select value={editGrade} onValueChange={setEditGrade}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADE_OPTIONS.map((grade) => (
                              <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {editActiveTab === "emergency" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-emergency-contact">Emergency Contact Name</Label>
                      <Input
                        id="edit-emergency-contact"
                        placeholder="Contact name"
                        value={editEmergencyContact}
                        onChange={(e) => setEditEmergencyContact(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-emergency-phone">Emergency Phone</Label>
                      <Input
                        id="edit-emergency-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={editEmergencyPhone}
                        onChange={(e) => setEditEmergencyPhone(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleEditChild} disabled={isSaving || !editName.trim()} className="w-full sm:w-auto">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Child Dialog */}
      <DeleteChildDialog
        open={!!childToDelete}
        onOpenChange={(open) => !open && setChildToDelete(null)}
        child={childToDelete}
        onConfirm={async (childId) => {
          const success = await deleteChild(childId);
          if (success && selectedChild?.id === childId) {
            setSelectedChild(children.find(c => c.id !== childId) || null);
          }
          return success;
        }}
      />
    </DashboardLayout>
  );
};

export default ChildrenPage;
