import { motion } from "framer-motion";
import { FileText, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TermsPage = () => {
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
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Terms of Service
            </h1>
            <p className="text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </motion.div>

          {/* Beta Notice */}
          <Alert className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Beta Program Notice:</strong> CoParrent is currently in controlled beta. 
              Some features may be incomplete or change without notice. By using this service, 
              you acknowledge you are participating in a beta testing program.
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
              <h2 className="text-xl font-display font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using CoParrent ("the Service"), you agree to be bound by these 
                Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground">
                CoParrent is a co-parenting coordination platform that provides tools for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Custody schedule management and calendar coordination</li>
                <li>Secure messaging between co-parents</li>
                <li>Child information and document storage</li>
                <li>Expense tracking and sharing</li>
                <li>Activity and sports event coordination</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Important:</strong> CoParrent is a communication and organizational tool only. 
                It does not provide legal advice and is not a substitute for professional legal counsel.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials 
                and for all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Provide accurate and complete registration information</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Not share your account credentials with others</li>
                <li>Not create accounts for anyone other than yourself without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">4. Acceptable Use</h2>
              <p className="text-muted-foreground">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Harass, abuse, or threaten other users</li>
                <li>Upload false, misleading, or defamatory content</li>
                <li>Violate any applicable laws or court orders</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Interfere with the proper functioning of the Service</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We reserve the right to suspend or terminate accounts that violate these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">5. Payments and Subscriptions</h2>
              <p className="text-muted-foreground">
                Some features require a paid subscription. By subscribing, you agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Pay all applicable fees as described at the time of purchase</li>
                <li>Automatic renewal unless cancelled before the renewal date</li>
                <li>Cancellation takes effect at the end of the current billing period</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Refunds are handled on a case-by-case basis. Contact support@coparrent.com for assistance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">6. Data and Privacy</h2>
              <p className="text-muted-foreground">
                Your use of the Service is also governed by our{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. 
                We take the security of your family's information seriously and implement 
                industry-standard security measures.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">7. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The Service and its original content, features, and functionality are owned by 
                CoParrent and are protected by international copyright, trademark, and other 
                intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the fullest extent permitted by law, CoParrent shall not be liable for any 
                indirect, incidental, special, consequential, or punitive damages, including 
                without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>Legal Disclaimer:</strong> CoParrent does not provide legal advice. 
                Any information presented through the Service should not be construed as legal 
                advice. Always consult with a qualified family law attorney for legal matters.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">9. Beta Features</h2>
              <p className="text-muted-foreground">
                During the beta period, certain features may be:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
                <li>Incomplete or under active development</li>
                <li>Subject to change without prior notice</li>
                <li>Temporarily unavailable for maintenance</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Beta participants are encouraged to report bugs and provide feedback to help 
                improve the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. We will notify users of 
                significant changes via email or in-app notification. Continued use of the Service 
                after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-display font-semibold mb-4">11. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>Email:</strong>{" "}
                <a href="mailto:legal@coparrent.com" className="text-primary hover:underline">
                  legal@coparrent.com
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

export default TermsPage;
