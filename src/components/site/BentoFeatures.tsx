import { motion } from "framer-motion";
import { Zap, FlaskConical, Truck, Clock, Shield, Star } from "lucide-react";

const bentoItems = [
  {
    icon: Zap,
    title: "Premium Fabrics",
    desc: "Carefully sourced cotton, linen, and knit blends designed for comfort and durability in everyday wear.",
    className: "col-span-2 row-span-2",
    gradient: "from-primary/10 to-secondary/5",
  },
  {
    icon: FlaskConical,
    title: "Made to Move",
    desc: "Tailored cuts and flexible fabrics built for everyday movement.",
    className: "col-span-1 row-span-1",
    gradient: "from-muted to-card",
  },
  {
    icon: Clock,
    title: "New Drops Weekly",
    desc: "Fresh styles added to the collection every week.",
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
    title: "Cash on Delivery",
    desc: "Pay safely when your order arrives at your door.",
    className: "col-span-1 row-span-1",
    gradient: "from-card to-muted",
  },
  {
    icon: Star,
    title: "99% Customer Satisfaction",
    desc: "Trusted by hundreds of shoppers across Cambodia who love the fit and quality.",
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Why VESTRA</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Considered clothing design combining premium fabrics with everyday comfort.
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
