import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sopheaktra M.",
    location: "Phnom Penh",
    rating: 5,
    text: "After 3 months using the LED cap with Morr F5, I can see real regrowth. The delivery was fast and payment with Bakong was super easy.",
    avatar: "SM",
    highlight: "Real regrowth in 3 months",
  },
  {
    name: "Dara C.",
    location: "Siem Reap",
    rating: 5,
    text: "I was skeptical at first but hairora's products actually work. My hair feels thicker and I have less shedding. Highly recommend!",
    avatar: "DC",
    highlight: "Less shedding, thicker hair",
  },
  {
    name: "Vibol K.",
    location: "Battambang",
    rating: 5,
    text: "The LED laser cap is so comfortable. I use it during my morning routine — only 30 minutes every other day. Great results after 16 weeks!",
    avatar: "VK",
    highlight: "Great results in 16 weeks",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What customers say</h2>
          <p className="text-muted-foreground mt-3">Real results from real people across Cambodia</p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              drag
              dragConstraints={{ top: -20, bottom: 20, left: -20, right: 20 }}
              dragElastic={0.1}
              whileHover={{ y: -6 }}
              whileDrag={{ scale: 1.04, zIndex: 10 }}
              className="liquid-glass-card rounded-3xl p-6 cursor-grab active:cursor-grabbing relative select-none border border-border"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                {t.highlight}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
