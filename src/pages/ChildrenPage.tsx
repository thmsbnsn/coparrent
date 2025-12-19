import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Baby, Calendar, Heart, School, Phone, Droplet, AlertCircle, Pill } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useChildren, Child } from "@/hooks/useChildren";
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

const calculateAge = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Not set";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const ChildrenPage = () => {
  const { children, loading, addChild, updateChild } = useChildren();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildDob, setNewChildDob] = useState("");
  
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

  const handleAddChild = async () => {
    if (newChildName.trim()) {
      const child = await addChild(newChildName.trim(), newChildDob || undefined);
      if (child) {
        setNewChildName("");
        setNewChildDob("");
        setIsAddDialogOpen(false);
        setSelectedChild(child);
      }
    }
  };

  const handleEditChild = async () => {
    if (selectedChild && editName.trim()) {
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
      setIsEditDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading children...</div>
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
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold">Child Information Hub</h1>
            <p className="text-muted-foreground mt-1">Keep important details organized and shared</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Child
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Child</DialogTitle>
                <DialogDescription>
                  Enter your child's information. This will be shared with your co-parent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Child's name"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={newChildDob}
                    onChange={(e) => setNewChildDob(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddChild} disabled={!newChildName.trim()}>
                  Add Child
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {children.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4"
          >
            <Baby className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-xl font-display font-bold">No Children Added Yet</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Add your children to keep track of their information and share it with your co-parent.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Child
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Child Selector */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex gap-3 overflow-x-auto pb-2"
            >
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all whitespace-nowrap",
                    selectedChild?.id === child.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {child.avatar_url ? (
                      <img src={child.avatar_url} alt={child.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      child.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {calculateAge(child.date_of_birth) !== null
                        ? `${calculateAge(child.date_of_birth)} years old`
                        : "Age not set"}
                    </p>
                  </div>
                </button>
              ))}
            </motion.div>

            {/* Child Profile */}
            {selectedChild && (
              <motion.div
                key={selectedChild.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Profile Header */}
                <div className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-semibold">
                        {selectedChild.avatar_url ? (
                          <img
                            src={selectedChild.avatar_url}
                            alt={selectedChild.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          selectedChild.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-bold">{selectedChild.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedChild.date_of_birth
                            ? `Born ${formatDate(selectedChild.date_of_birth)} • ${calculateAge(selectedChild.date_of_birth)} years old`
                            : "Date of birth not set"}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={openEditDialog}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                </div>

                {/* Profile Tabs */}
                <Tabs defaultValue="overview" className="p-6">
                  <TabsList className="mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="health">Health</TabsTrigger>
                    <TabsTrigger value="school">School</TabsTrigger>
                    <TabsTrigger value="emergency">Emergency</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">Date of Birth</h4>
                        </div>
                        <p className="font-medium">{formatDate(selectedChild.date_of_birth)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Baby className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">Age</h4>
                        </div>
                        <p className="font-medium">
                          {calculateAge(selectedChild.date_of_birth) !== null
                            ? `${calculateAge(selectedChild.date_of_birth)} years old`
                            : "Not set"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Droplet className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">Blood Type</h4>
                        </div>
                        <p className="font-medium">{selectedChild.blood_type || "Not set"}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <School className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">School</h4>
                        </div>
                        <p className="font-medium">{selectedChild.school_name || "Not set"}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="health">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Droplet className="w-4 h-4 text-destructive" />
                            <h4 className="text-sm font-medium text-muted-foreground">Blood Type</h4>
                          </div>
                          <p className="font-medium text-lg">{selectedChild.blood_type || "Not set"}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-4 h-4 text-destructive" />
                            <h4 className="text-sm font-medium text-muted-foreground">Doctor</h4>
                          </div>
                          <p className="font-medium">{selectedChild.doctor_name || "Not set"}</p>
                          {selectedChild.doctor_phone && (
                            <p className="text-sm text-muted-foreground">{selectedChild.doctor_phone}</p>
                          )}
                        </div>
                      </div>
                      
                      {selectedChild.allergies && selectedChild.allergies.length > 0 && (
                        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            <h4 className="text-sm font-medium text-destructive">Allergies</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedChild.allergies.map((allergy, i) => (
                              <span key={i} className="px-2 py-1 bg-destructive/20 text-destructive rounded text-sm">
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedChild.medications && selectedChild.medications.length > 0 && (
                        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="w-4 h-4 text-warning" />
                            <h4 className="text-sm font-medium">Current Medications</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedChild.medications.map((med, i) => (
                              <span key={i} className="px-2 py-1 bg-warning/20 rounded text-sm">
                                {med}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedChild.medical_notes && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Medical Notes</h4>
                          <p className="text-sm">{selectedChild.medical_notes}</p>
                        </div>
                      )}

                      {!selectedChild.blood_type && !selectedChild.allergies?.length && !selectedChild.medications?.length && (
                        <div className="p-4 rounded-lg bg-accent/20 border border-accent/30 text-center">
                          <p className="text-sm text-muted-foreground">
                            No health information added yet. Click "Edit Profile" to add details.
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="school">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <School className="w-4 h-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium text-muted-foreground">School</h4>
                          </div>
                          <p className="font-medium">{selectedChild.school_name || "Not set"}</p>
                          {selectedChild.school_phone && (
                            <p className="text-sm text-muted-foreground">{selectedChild.school_phone}</p>
                          )}
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium text-muted-foreground">Grade</h4>
                          </div>
                          <p className="font-medium">{selectedChild.grade || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="emergency">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Phone className="w-4 h-4 text-destructive" />
                          <h4 className="font-medium text-destructive">Emergency Contact</h4>
                        </div>
                        <p className="font-medium">{selectedChild.emergency_contact || "Not set"}</p>
                        {selectedChild.emergency_phone && (
                          <p className="text-lg font-bold mt-1">{selectedChild.emergency_phone}</p>
                        )}
                      </div>
                      
                      {selectedChild.doctor_name && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-4 h-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium text-muted-foreground">Primary Doctor</h4>
                          </div>
                          <p className="font-medium">{selectedChild.doctor_name}</p>
                          {selectedChild.doctor_phone && (
                            <p className="text-lg font-bold mt-1">{selectedChild.doctor_phone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Child Profile</DialogTitle>
            <DialogDescription>
              Update your child's information. All changes are shared with your co-parent.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="py-4">
            <TabsList className="mb-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="school">School</TabsTrigger>
              <TabsTrigger value="emergency">Emergency</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
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
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
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
            </TabsContent>

            <TabsContent value="school" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-school-name">School Name</Label>
                <Input
                  id="edit-school-name"
                  placeholder="School name"
                  value={editSchoolName}
                  onChange={(e) => setEditSchoolName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Input
                    id="edit-grade"
                    placeholder="e.g., 3rd Grade"
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-4">
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
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditChild} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ChildrenPage;
