import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, ArrowLeft, Calendar, Dumbbell } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { ActivityCard } from "@/components/sports/ActivityCard";
import { EventCard } from "@/components/sports/EventCard";
import { CreateActivityDialog } from "@/components/sports/CreateActivityDialog";
import { CreateEventDialog } from "@/components/sports/CreateEventDialog";
import { EditActivityDialog } from "@/components/sports/EditActivityDialog";
import { EditEventDialog } from "@/components/sports/EditEventDialog";
import { useSportsActivities, ChildActivity, ActivityEvent } from "@/hooks/useSportsActivities";
import { useChildren } from "@/hooks/useChildren";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SportsPage = () => {
  const { children } = useChildren();
  const {
    activities,
    events,
    loading,
    parentProfiles,
    createActivity,
    updateActivity,
    deleteActivity,
    createEvent,
    updateEvent,
    cancelEvent,
    deleteEvent,
  } = useSportsActivities();

  const [selectedActivity, setSelectedActivity] = useState<ChildActivity | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<ChildActivity | null>(null);
  const [eventToEdit, setEventToEdit] = useState<ActivityEvent | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventToCancel, setEventToCancel] = useState<string | null>(null);

  const handleDeleteActivity = async () => {
    if (activityToDelete) {
      await deleteActivity(activityToDelete);
      setActivityToDelete(null);
      if (selectedActivity?.id === activityToDelete) {
        setSelectedActivity(null);
      }
    }
  };

  const handleCancelEvent = async () => {
    if (eventToCancel) {
      await cancelEvent(eventToCancel);
      setEventToCancel(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (eventToDelete) {
      await deleteEvent(eventToDelete);
      setEventToDelete(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RoleGate requireParent restrictedMessage="Youth Sports Hub is only available to parents and guardians.">
        <PremiumFeatureGate featureName="Youth Sports Hub">
          <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedActivity && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedActivity(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div>
                  <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2">
                    <Trophy className="w-7 h-7 text-primary" />
                    {selectedActivity ? selectedActivity.name : "Youth Sports Hub"}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {selectedActivity
                      ? `${selectedActivity.child_name} • ${selectedActivity.team_name || "No team"}`
                      : "Manage sports, activities, and events"}
                  </p>
                </div>
              </div>
              {!selectedActivity && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCreateEvent(true)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                  <Button onClick={() => setShowCreateActivity(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Activity
                  </Button>
                </div>
              )}
              {selectedActivity && (
                <Button onClick={() => setShowCreateEvent(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              )}
            </div>
          </motion.div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {!selectedActivity ? (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Tabs defaultValue="events" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="events" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      Upcoming Events
                    </TabsTrigger>
                    <TabsTrigger value="activities" className="gap-2">
                      <Dumbbell className="w-4 h-4" />
                      Activities
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="events" className="space-y-4">
                    {events.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                          <p className="text-muted-foreground mb-4">
                            Schedule games, practices, and more
                          </p>
                          <Button onClick={() => setShowCreateEvent(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Schedule Event
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {events.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onEdit={() => setEventToEdit(event)}
                            onCancel={() => setEventToCancel(event.id)}
                            onDelete={() => setEventToDelete(event.id)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="activities" className="space-y-4">
                    {activities.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No activities yet</h3>
                          <p className="text-muted-foreground mb-4">
                            Add sports and activities for your children
                          </p>
                          <Button onClick={() => setShowCreateActivity(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add First Activity
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {activities.map((activity) => (
                          <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onEdit={() => setActivityToEdit(activity)}
                            onDelete={() => setActivityToDelete(activity.id)}
                            onViewEvents={() => setSelectedActivity(activity)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            ) : (
              <motion.div
                key="activity-events"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {events.filter(e => e.activity_id === selectedActivity.id).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
                      <p className="text-muted-foreground mb-4">
                        Add games, practices, and more for this activity
                      </p>
                      <Button onClick={() => setShowCreateEvent(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Schedule Event
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  events
                    .filter(e => e.activity_id === selectedActivity.id)
                    .map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEdit={() => setEventToEdit(event)}
                        onCancel={() => setEventToCancel(event.id)}
                        onDelete={() => setEventToDelete(event.id)}
                      />
                    ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Create Dialogs */}
        <CreateActivityDialog
          open={showCreateActivity}
          onOpenChange={setShowCreateActivity}
          children={children}
          onSubmit={createActivity}
        />

        <CreateEventDialog
          open={showCreateEvent}
          onOpenChange={setShowCreateEvent}
          activities={activities}
          parentProfiles={parentProfiles}
          onSubmit={createEvent}
          defaultActivityId={selectedActivity?.id}
        />

        {/* Edit Dialogs */}
        <EditActivityDialog
          open={!!activityToEdit}
          onOpenChange={(open) => !open && setActivityToEdit(null)}
          activity={activityToEdit}
          children={children}
          onSubmit={updateActivity}
        />

        <EditEventDialog
          open={!!eventToEdit}
          onOpenChange={(open) => !open && setEventToEdit(null)}
          event={eventToEdit}
          activities={activities}
          parentProfiles={parentProfiles}
          onSubmit={updateEvent}
        />

        {/* Confirmation Dialogs */}
        <AlertDialog open={!!activityToDelete} onOpenChange={() => setActivityToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Activity?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the activity and all its events.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteActivity} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!eventToCancel} onOpenChange={() => setEventToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Event?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the event as cancelled. It can still be viewed but won't appear in upcoming events.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Event</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelEvent}>
                Cancel Event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the event.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default SportsPage;
