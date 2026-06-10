import { motion } from "framer-motion";
import { Zap, FlaskConical, Truck, Clock, Shield, Star } from "lucide-react";

const bentoItems = [
  {
    icon: Zap,
    title: "272 Medical-Grade Laser Diodes",
    desc: "Full scalp coverage with clinical-grade 650nm red laser diodes for maximum hair follicle stimulation.",
    className: "col-span-2 row-span-2",
    gradient: "from-primary/10 to-secondary/5",
  },
  {
    icon: FlaskConical,
    title: "Clinically Proven",
    desc: "FDA-cleared technology backed by peer-reviewed clinical studies.",
    className: "col-span-1 row-span-1",
    gradient: "from-muted to-card",
  },
  {
    icon: Clock,
    title: "Results in 16 Weeks",
    desc: "Visible hair regrowth within 4 months of consistent use.",
    className: "col-span-1 row-span-1",
    gradient: "from-muted to-card",
  },
  {
    icon: Truck,
    title: "Free Nationwide Shipping",
    desc: "Free delivery anywhere in Cambodia with every order.",
    className: "col-span-1 row-span-1",
    gradient: "from-card to-muted",
  },
  {
    icon: Shield,
    title: "Secure Bakong KHQR",
    desc: "Pay safely with Cambodia's national payment system.",
    className: "col-span-1 row-span-1",
    gradient: "from-card to-muted",
  },
  {
    icon: Star,
    title: "99% Customer Satisfaction",
    desc: "Trusted by hundreds of customers across Cambodia who saw real results.",
    className: "col-span-2 row-span-1",
    gradient: "from-primary/10 to-secondary/5",
  },
];

export function BentoFeatures() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Why hairora</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Science-backed hair restoration combining advanced laser technology with clinically proven topicals.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[160px] gap-4">
          {bentoItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`${item.className} liquid-glass-card rounded-3xl p-6 flex flex-col justify-between bg-gradient-to-br ${item.gradient} cursor-default group border border-border`}
            >
              <div className="w-11 h-11 rounded-2xl liquid-glass flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground leading-tight mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
