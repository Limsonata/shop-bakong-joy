import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "FAQ — hairora" }] }),
  component: FaqPage,
});

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

const STATIC_FAQS: Faq[] = [
  { id: "1", question: "What is hairora?", answer: "hairora is Cambodia's leading hair restoration specialist, offering clinically proven LED laser therapy and Minoxidil solutions.", category: "General", sort_order: 1 },
  { id: "2", question: "How do I pay?", answer: "We accept ABA PayWay (Bakong QR) and Cash on Delivery (COD).", category: "Payment", sort_order: 1 },
  { id: "3", question: "How long does delivery take?", answer: "Standard delivery within Phnom Penh is 1–2 business days. Provincial orders take 3–5 business days.", category: "Delivery", sort_order: 1 },
  { id: "4", question: "Can I return a product?", answer: "We accept returns within 7 days of delivery if the product is unused and in original packaging. Contact us via Telegram to initiate a return.", category: "Returns", sort_order: 1 },
  { id: "5", question: "Are your products clinically proven?", answer: "Yes. Our LED laser devices and Minoxidil formulations are backed by clinical studies showing significant hair regrowth in 3–6 months of consistent use.", category: "Products", sort_order: 1 },
  { id: "6", question: "How do I track my order?", answer: "Visit our Order Tracking page and enter your ABA reference number or order ID to see your order status.", category: "Orders", sort_order: 1 },
];

async function fetchFaqs(): Promise<Faq[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("faqs")
      .select("id, question, answer, category, sort_order")
      .eq("active", true)
      .order("sort_order");
    if (!error && data && data.length > 0) return data as Faq[];
  }
  return STATIC_FAQS;
}

function FaqPage() {
  const { data: faqs = STATIC_FAQS, isLoading } = useQuery({
    queryKey: ["faqs"],
    queryFn: fetchFaqs,
  });

  const grouped = faqs.reduce<Record<string, Faq[]>>((acc, faq) => {
    const cat = faq.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-primary/10">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
        <p className="mt-3 text-muted-foreground">
          Everything you need to know about hairora products and orders.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {category}
              </h2>
              <Accordion type="multiple" className="rounded-xl border bg-card px-4">
                {items.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-base font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
