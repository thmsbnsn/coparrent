import { Link } from "react-router-dom";
import { ExternalLink, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHILD_APP_INSTALL_PATH } from "@/lib/childAccess";

interface ChildPwaInstallOptionsProps {
  childName: string;
  hasAccount: boolean;
  loginEnabled: boolean;
}

export const ChildPwaInstallOptions = ({
  childName,
  hasAccount,
  loginEnabled,
}: ChildPwaInstallOptionsProps) => {
  const canInstallChildMode = hasAccount && loginEnabled;

  return (
    <div className="rounded-[1.75rem] border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">Install paths</p>
          <h4 className="mt-1 text-lg font-semibold">Future child app mode</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The adult app still installs from the main CoParrent entry. Child mode now has its own
            in-repo start path at <span className="font-mono">{CHILD_APP_INSTALL_PATH}</span> so a
            dedicated child PWA can launch into a child-safe shell later without a second codebase.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-sky-600 text-white hover:bg-sky-500">
              <Link to={CHILD_APP_INSTALL_PATH}>
                <Smartphone className="mr-2 h-4 w-4" />
                Open child app path
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-white">
              <Link to="/">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open main app path
              </Link>
            </Button>
          </div>

          {canInstallChildMode ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Install child mode on the device {childName} uses, then sign in with that child
              account. Quick unlock only affects repeat access on that device after a normal
              sign-in.
            </p>
          ) : (
            <p className="mt-4 text-sm text-amber-700">
              Create and enable the child account before using the dedicated child app path on a
              device.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
