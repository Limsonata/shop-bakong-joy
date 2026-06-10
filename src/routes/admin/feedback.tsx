import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Star, Check, X, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { getAllFeedback, approveFeedback, deleteFeedback, type Feedback } from "@/lib/feedbackStore";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({ meta: [{ title: "Feedback - Admin" }] }),
  component: FeedbackAdmin,
});

function FeedbackAdmin() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    try {
      setItems(await getAllFeedback());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string, approved: boolean) => {
    const ok = await approveFeedback(id, approved);
    if (ok) {
      toast.success(approved ? "Approved — now visible on homepage" : "Hidden from homepage");
      setItems((prev) => prev.map((f) => f.id === id ? { ...f, approved } : f));
    } else {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteFeedback(id);
    if (ok) {
      toast.success("Deleted");
      setItems((prev) => prev.filter((f) => f.id !== id));
    } else {
      toast.error("Failed to delete");
    }
  };

  const pending = items.filter((f) => !f.approved);
  const approved = items.filter((f) => f.approved);

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Customer Feedback</h1>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading feedback...</p>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No feedback submitted yet. It will appear here once customers share their experience.
              </CardContent>
            </Card>
          ) : (
            <>
              {pending.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Pending review ({pending.length})
                  </h2>
                  <div className="space-y-3">
                    {pending.map((f) => (
                      <FeedbackCard
                        key={f.id}
                        feedback={f}
                        onApprove={() => handleApprove(f.id, true)}
                        onHide={() => handleApprove(f.id, false)}
                        onDelete={() => handleDelete(f.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {approved.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Published on homepage ({approved.length})
                  </h2>
                  <div className="space-y-3">
                    {approved.map((f) => (
                      <FeedbackCard
                        key={f.id}
                        feedback={f}
                        onApprove={() => handleApprove(f.id, true)}
                        onHide={() => handleApprove(f.id, false)}
                        onDelete={() => handleDelete(f.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </RequireAdmin>
  );
}

function FeedbackCard({
  feedback: f,
  onApprove,
  onHide,
  onDelete,
}: {
  feedback: Feedback;
  onApprove: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {f.name}
            {f.location && <span className="font-normal text-muted-foreground">· {f.location}</span>}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
              f.approved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}>
              {f.approved ? "Published" : "Pending"}
            </span>
          </CardTitle>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!f.approved ? (
            <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={onApprove}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1" onClick={onHide}>
              <X className="h-3.5 w-3.5" /> Hide
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {f.highlight && (
          <p className="text-xs font-medium text-primary">"{f.highlight}"</p>
        )}
        <p className="text-sm text-muted-foreground">{f.text}</p>
        <p className="text-xs text-muted-foreground pt-1">
          {new Date(f.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
