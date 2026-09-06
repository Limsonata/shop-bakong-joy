import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Star, PenLine, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getApprovedFeedback, submitFeedback } from "@/lib/feedbackStore";

const STATIC_FALLBACK = [
  {
    id: "s1",
    name: "Sopheaktra M.",
    location: "Phnom Penh",
    rating: 5,
    text: "The quality is amazing for the price. Fabric feels premium and the fit is exactly true to size. Delivery was fast and paying on arrival was so easy.",
    highlight: "True to size, premium fabric",
  },
  {
    id: "s2",
    name: "Dara C.",
    location: "Siem Reap",
    rating: 5,
    text: "I was skeptical at first but VESTRA's pieces actually hold up after multiple washes. My go-to for everyday basics now. Highly recommend!",
    highlight: "Holds up wash after wash",
  },
  {
    id: "s3",
    name: "Vibol K.",
    location: "Battambang",
    rating: 5,
    text: "The oversized tee is so comfortable I wear it everywhere. New drops every week keep me coming back. Great fit and fast shipping!",
    highlight: "Comfortable, great fit",
  },
];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="cursor-pointer"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= (hovered || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState("");

  const { data: realFeedback } = useQuery({
    queryKey: ["feedback", "approved"],
    queryFn: getApprovedFeedback,
  });

  const items = realFeedback && realFeedback.length > 0 ? realFeedback : STATIC_FALLBACK;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error("Please select a rating"); return; }
    setIsSubmitting(true);
    try {
      await submitFeedback({ name, location, rating, text, highlight });
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      setSubmitted(true);
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormOpen(false);
    setSubmitted(false);
    setName(""); setLocation(""); setText(""); setHighlight(""); setRating(5);
  };

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
          {items.map((t, i) => (
            <motion.div
              key={t.id}
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
              {t.highlight && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                  {t.highlight}
                </div>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                  {t.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  {t.location && <p className="text-xs text-muted-foreground">{t.location}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Share CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          {!formOpen && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full gap-2"
              onClick={() => setFormOpen(true)}
            >
              <PenLine className="w-4 h-4" />
              Share your experience
            </Button>
          )}
        </motion.div>

        {/* Feedback Form */}
        <AnimatePresence>
          {formOpen && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="mt-10 max-w-xl mx-auto liquid-glass-card rounded-3xl p-8 border border-border relative"
            >
              <button
                onClick={resetForm}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {submitted ? (
                <div className="text-center py-6 space-y-4">
                  <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">Thank you!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your feedback has been submitted and will appear here once reviewed.
                  </p>
                  <Button variant="outline" className="rounded-full" onClick={resetForm}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-6">Share your experience</h3>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <StarPicker value={rating} onChange={setRating} />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fb-name">Your name</Label>
                        <Input
                          id="fb-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Sopheaktra M."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fb-location">City</Label>
                        <Input
                          id="fb-location"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Phnom Penh"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fb-highlight">One-line highlight <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input
                        id="fb-highlight"
                        value={highlight}
                        onChange={(e) => setHighlight(e.target.value)}
                        placeholder="e.g. Real regrowth in 3 months"
                        maxLength={60}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fb-text">Your review</Label>
                      <Textarea
                        id="fb-text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Tell us about your experience with VESTRA..."
                        rows={4}
                        required
                        minLength={20}
                      />
                    </div>

                    <Button type="submit" className="w-full rounded-full" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit review"}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
