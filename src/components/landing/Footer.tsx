import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import { APP_VERSION, getEnvironment } from "@/lib/version";

/**
 * Footer - Professional, Structured
 * 
 * Design Intent:
 * - Clean, organized link structure
 * - Trustworthy, not cluttered
 * - Consistent with authority-driven brand
 */

/**
 * Footer links - all routes must resolve (verified by route audit)
 * 
 * REGRESSION PREVENTION:
 * - All links here are tested in tests/e2e/route-audit.spec.ts
 * - Adding a link? Add it to src/lib/routes.ts FOOTER_LINKS first
 * 
 * @see src/lib/routes.ts for route registry
 */
const footerLinks = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
  ],
  Support: [
    { label: "Help Center", href: "/help" },
    { label: "Contact", href: "/help/contact" }, // Fixed: was /contact (404)
    { label: "About", href: "/about" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Security", href: "/help/security" }, // Fixed: was /security (404)
  ],
};

export const Footer = () => {
  const env = getEnvironment();
  const showVersion = env !== "production";

  return (
    <footer className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(221_70%_12%)_0%,hsl(221_66%_10%)_48%,hsl(218_68%_9%)_100%)] text-primary-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(33,176,254,0.16),transparent_34%)]" />
      <div className="page-shell-public relative px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Logo size="lg" className="mb-5 text-white" />
            <p className="max-w-sm text-sm leading-relaxed text-white/68">
              The co-parenting platform built for clarity, documentation,
              and peace of mind. Trusted by families who need calmer coordination.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-display font-semibold uppercase tracking-widest text-white/82">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-white/56 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <p className="text-sm text-white/44">
              © {new Date().getFullYear()} CoParrent. All rights reserved.
            </p>
            {showVersion && (
              <span className="text-xs font-mono text-white/28">
                v{APP_VERSION}
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
