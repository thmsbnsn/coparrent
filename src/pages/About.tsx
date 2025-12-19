import { motion } from "framer-motion";
import { Heart, Scale, Users, Shield } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

const values = [
  {
    icon: Heart,
    title: "Children First",
    description: "Every feature we build is designed with one goal: helping parents focus on their children's well-being.",
  },
  {
    icon: Scale,
    title: "Fairness & Neutrality",
    description: "We don't take sides. Our platform treats both parents equally and helps maintain balanced communication.",
  },
  {
    icon: Users,
    title: "Collaboration",
    description: "Great co-parenting requires teamwork. We make it easier to coordinate, share, and stay on the same page.",
  },
  {
    icon: Shield,
    title: "Privacy & Security",
    description: "Your family's information is sacred. We use bank-level encryption and never sell your data.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 lg:pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="max-w-3xl mx-auto text-center mb-20">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-display font-bold mb-6"
            >
              Built for families, by people who understand
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              ClearNest was created to help co-parents reduce conflict, stay organized, 
              and give their children the stable, loving environment they deserve.
            </motion.p>
          </div>

          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-3xl mx-auto mb-24"
          >
            <h2 className="text-2xl font-display font-bold mb-6">Our Story</h2>
            <div className="prose prose-lg text-muted-foreground">
              <p>
                Co-parenting after separation is one of life's greatest challenges. 
                Between coordinating schedules, sharing important information, and maintaining 
                clear communication, it's easy to feel overwhelmed.
              </p>
              <p className="mt-4">
                We built ClearNest because we believe technology should make co-parenting 
                easier, not harder. Our platform is designed to be calm, neutral, and focused 
                on what matters most: your children.
              </p>
              <p className="mt-4">
                Whether you're navigating a recent separation or looking to improve an 
                existing arrangement, ClearNest provides the tools you need to co-parent 
                with confidence and clarity.
              </p>
            </div>
          </motion.div>

          {/* Values */}
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-center mb-12">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex gap-4 p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
