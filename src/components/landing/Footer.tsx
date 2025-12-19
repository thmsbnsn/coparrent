import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";

const footerLinks = {
  Product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "For Law Offices", href: "/signup?type=lawoffice" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Careers", href: "/careers" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Security", href: "/security" },
  ],
};

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Logo size="lg" className="mb-6 [&_span]:text-primary-foreground [&_.text-gradient]:text-accent" />
            <p className="text-primary-foreground/70 max-w-sm mb-6">
              Helping co-parents communicate clearly, stay organized, and put their children first. 
              Built with families and family law professionals in mind.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4 text-primary-foreground/80">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-primary-foreground/60 hover:text-primary-foreground transition-colors text-sm"
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
        <div className="mt-16 pt-8 border-t border-primary-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} CoParrent. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-primary-foreground/50 hover:text-primary-foreground transition-colors text-sm">
              Status
            </a>
            <a href="#" className="text-primary-foreground/50 hover:text-primary-foreground transition-colors text-sm">
              Help Center
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
