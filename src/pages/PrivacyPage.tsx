import { motion } from "framer-motion";
import { Shield, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PrivacyPage = () => {
  const lastUpdated = "January 16, 2026";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 lg:pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </motion.div>

          {/* Beta Notice */}
          <Alert className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Beta Program Notice:</strong> During beta, we may collect additional 
              diagnostic data to improve the service. This data is anonymized and used solely 
              for product improvement.
            </AlertDescription>
          </Alert>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="prose prose-lg dark:prose-invert max-w-none"
          >
            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground">
                At CoParrent, we understand that your family's privacy is paramount. This Privacy 
                Policy explains how we collect, use, disclose, and safeguard your information when 
                you use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg font-semibold mt-6 mb-3">Account Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Name and email address</li>
                <li>Password (encrypted)</li>
                <li>Profile information you choose to provide</li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-3">Family Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Children's names and ages (as provided by you)</li>
                <li>Custody schedules and calendar events</li>
                <li>Documents you upload</li>
                <li>Messages between co-parents</li>
                <li>Expense records</li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-3">Technical Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Device type and browser information</li>
                <li>IP address and general location</li>
                <li>Usage patterns and feature interactions</li>
                <li>Error logs for troubleshooting</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Provide and maintain the Service</li>
                <li>Process transactions and send related information</li>
                <li>Send notifications about schedule changes and messages</li>
                <li>Respond to customer service requests</li>
                <li>Improve and optimize the Service</li>
                <li>Detect and prevent fraud or abuse</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">4. Information Sharing</h2>
              <p className="text-muted-foreground">
                <strong>We do not sell your personal information.</strong> We may share information only in these circumstances:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li><strong>With your co-parent:</strong> Shared calendars, messages, and approved documents</li>
                <li><strong>Service providers:</strong> Third parties who help us operate the Service (payment processing, email delivery)</li>
                <li><strong>Legal requirements:</strong> When required by law, court order, or to protect safety</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Encryption in transit (TLS/SSL) and at rest</li>
                <li>Secure authentication with optional two-factor authentication</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls limiting who can view your data</li>
                <li>Audit logging for document access</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">6. Children's Privacy (COPPA)</h2>
              <p className="text-muted-foreground">
                CoParrent is designed for use by adults (parents/guardians). We do not knowingly 
                collect personal information directly from children under 13.
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Child accounts are created and managed by parents only</li>
                <li>Push notifications are disabled by default for child accounts</li>
                <li>No behavioral tracking or advertising is applied to child accounts</li>
                <li>Parents can delete child account data at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">7. Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li><strong>Access:</strong> Request a copy of the data we have about you</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Portability:</strong> Export your data in a standard format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise these rights, contact us at{" "}
                <a href="mailto:privacy@coparrent.com" className="text-primary hover:underline">
                  privacy@coparrent.com
                </a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">8. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your data for as long as your account is active or as needed to provide 
                services. Our retention schedule:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li><strong>Account data:</strong> Retained while account is active</li>
                <li><strong>Messages & communications:</strong> 7 years (for court documentation purposes)</li>
                <li><strong>Expense records:</strong> 7 years (tax and legal compliance)</li>
                <li><strong>Documents:</strong> Retained until you delete them or close your account</li>
                <li><strong>Audit logs:</strong> 3 years (security and compliance requirements)</li>
                <li><strong>Session data:</strong> 30 days after last activity</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                After account deletion:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
                <li>Personal data is deleted within 30 days</li>
                <li>Backups are purged within 90 days</li>
                <li>Aggregated, anonymized data may be retained for analytics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">9. California Privacy Rights (CCPA)</h2>
              <p className="text-muted-foreground">
                If you are a California resident, you have the following additional rights under the 
                California Consumer Privacy Act (CCPA):
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>
                  <strong>Right to Know:</strong> You can request disclosure of the categories and 
                  specific pieces of personal information we have collected about you
                </li>
                <li>
                  <strong>Right to Delete:</strong> You can request deletion of your personal 
                  information, subject to certain exceptions
                </li>
                <li>
                  <strong>Right to Opt-Out:</strong> We do not sell your personal information. 
                  If this changes, you will have the right to opt-out
                </li>
                <li>
                  <strong>Right to Non-Discrimination:</strong> We will not discriminate against 
                  you for exercising your CCPA rights
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise your CCPA rights, contact us at{" "}
                <a href="mailto:privacy@coparrent.com" className="text-primary hover:underline">
                  privacy@coparrent.com
                </a>{" "}
                or use the "Download My Data" feature in your account settings.
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Categories of Personal Information Collected:</strong> Identifiers (name, email), 
                commercial information (subscription data), internet activity (usage logs), and 
                professional information (legal documents you upload).
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Disclosure:</strong> We do not sell personal information to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">10. Third-Party Services</h2>
              <p className="text-muted-foreground">
                We use the following third-party services:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
                <li><strong>Resend:</strong> Transactional email delivery</li>
                <li><strong>Google:</strong> OAuth authentication (optional)</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Each provider has their own privacy policy governing their handling of your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">11. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of 
                significant changes via email or in-app notification. Your continued use of 
                the Service after changes constitutes acceptance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground">
                For privacy-related questions or concerns:
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>Email:</strong>{" "}
                <a href="mailto:privacy@coparrent.com" className="text-primary hover:underline">
                  privacy@coparrent.com
                </a>
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Support:</strong>{" "}
                <a href="mailto:support@coparrent.com" className="text-primary hover:underline">
                  support@coparrent.com
                </a>
              </p>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;
