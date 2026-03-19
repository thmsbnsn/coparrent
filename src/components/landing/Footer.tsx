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
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Logo size="lg" className="mb-5 text-white" />
            <p className="text-white/60 max-w-sm text-sm leading-relaxed">
              The co-parenting platform built for clarity, documentation,
              and peace of mind. Trusted by families who need calmer coordination.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-xs uppercase tracking-widest mb-4 text-white/80">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-white/50 hover:text-white transition-colors text-sm"
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
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-white/40">
              © {new Date().getFullYear()} CoParrent. All rights reserved.
            </p>
            {showVersion && (
              <span className="text-xs text-white/25 font-mono">
                v{APP_VERSION}
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
