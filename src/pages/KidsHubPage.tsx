import { useNavigate } from "react-router-dom";
import { Stethoscope, Palette, Sparkles, ClipboardList, BookOpen, Library, ArrowRight, ShieldCheck, WandSparkles } from "lucide-react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";

interface HubCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  comingSoon?: boolean;
  badge?: string;
}

const HubCard = ({ title, description, icon: Icon, href, comingSoon, badge }: HubCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={comingSoon ? {} : { scale: 1.02 }}
      whileTap={comingSoon ? {} : { scale: 0.98 }}
    >
      <Card
        className={`cursor-pointer transition-all h-full ${
          comingSoon 
            ? "opacity-60 cursor-not-allowed" 
            : "hover:border-primary/50 hover:shadow-md"
        }`}
        onClick={() => !comingSoon && navigate(href)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {comingSoon && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              )}
              {badge && !comingSoon && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {badge}
                </span>
              )}
            </div>
          </div>
          <CardTitle className="text-lg mt-3">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center">
              <Sparkles className="h-4 w-4 mr-1.5 text-primary" />
              <span>AI-Powered</span>
            </div>
            {!comingSoon && (
              <div className="flex items-center gap-1 text-primary">
                <span>Open</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const KidsHubContent = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="space-y-3">
            <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Power plan creative toolkit
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Kids Hub</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              One place for health guidance, printable activities, chore charts, and saved creations.
              Built to be quick to use from your phone when you need an answer or activity fast.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Guided support
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Health prompts, kid-safe activity ideas, and reusable tools in one flow.
              </p>
            </div>
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <WandSparkles className="h-4 w-4 text-primary" />
                Creation tools
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate something useful, save it, and come back without starting over.
              </p>
            </div>
            <div className="rounded-2xl border bg-card/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Library className="h-4 w-4 text-primary" />
                Library ready
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Creations stay organized instead of getting lost across tabs and downloads.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <HubCard
          title="Nurse Nancy"
          description="Get age-appropriate health guidance and symptom checks for your children with our AI assistant."
          icon={Stethoscope}
          href="/dashboard/kids-hub/nurse-nancy"
        />
        <HubCard
          title="Coloring Page Creator"
          description="Generate custom coloring pages based on your child's interests and favorite themes."
          icon={Palette}
          href="/dashboard/kids-hub/coloring-pages"
        />
        <HubCard
          title="Activity Generator"
          description="Create fun activities, recipes, and crafts tailored to your child's age and interests."
          icon={BookOpen}
          href="/dashboard/kids-hub/activities"
        />
        <HubCard
          title="Chore Chart Builder"
          description="Design and print weekly chore charts to teach responsibility and build good habits."
          icon={ClipboardList}
          href="/dashboard/kids-hub/chore-chart"
        />
        <HubCard
          title="Creations Library"
          description="View all your saved activities, coloring pages, and more in one organized place."
          icon={Library}
          href="/dashboard/kids-hub/creations"
          badge="New"
        />
      </div>

      {/* Info Section */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">CoParrent Creations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                All activities, coloring pages, and other creations can be saved to your Creations Library, 
                shared with family members, and exported as beautifully branded PDFs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const KidsHubPage = () => {
  return (
    <DashboardLayout>
      {/* Role gate: block third-party and child accounts */}
      <RoleGate requireParent restrictedMessage="Kids Hub is only available to parents and guardians.">
        {/* Premium gate: require Power plan */}
        <PremiumFeatureGate featureName="Kids Hub">
          <KidsHubContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default KidsHubPage;
