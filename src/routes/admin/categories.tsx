import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowLeft, Edit2, Trash2, Folder, Package, RefreshCw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import {
  getAllCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getProductsInCollection,
  type Collection,
} from "@/lib/productStore";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Collections - Admin" }] }),
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCollections();
      setCollections(data);

      // Load product counts for each collection
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (collection) => {
          const products = await getProductsInCollection(collection.id);
          counts[collection.id] = products.length;
        }),
      );
      setProductCounts(counts);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load collections");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const filteredCollections = useMemo(() => {
    if (!searchQuery) return collections;
    const query = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.handle.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query),
    );
  }, [collections, searchQuery]);

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCollection({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success("Collection created successfully");
      setFormData({ title: "", description: "" });
      setIsCreateDialogOpen(false);
      await loadCollections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCollection) return;
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCollection(editingCollection.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success("Collection updated successfully");
      setFormData({ title: "", description: "" });
      setEditingCollection(null);
      setIsEditDialogOpen(false);
      await loadCollections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!collectionToDelete) return;

    setIsSubmitting(true);
    try {
      await deleteCollection(collectionToDelete.id);
      toast.success("Collection deleted successfully");
      setCollectionToDelete(null);
      setIsDeleteDialogOpen(false);
      await loadCollections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete collection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    setFormData({ title: "", description: "" });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({
      title: collection.title,
      description: collection.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (collection: Collection) => {
    setCollectionToDelete(collection);
    setIsDeleteDialogOpen(true);
  };

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Collections</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadCollections} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Collection
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Collections</CardTitle>
              <CardDescription>
                Organize your products into collections. Products can belong to multiple
                collections.
              </CardDescription>
              <div className="mt-4">
                <Input
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-muted-foreground">Loading collections...</p>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Folder className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">
                    {searchQuery ? "No matching collections" : "No collections yet"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term"
                      : "Create your first collection to organize products"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={openCreateDialog} className="mt-6">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Collection
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Handle</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCollections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell className="font-medium">{collection.title}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {collection.handle}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{productCounts[collection.id] ?? 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate text-muted-foreground">
                            {collection.description || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(collection)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(collection)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
                <DialogDescription>
                  Create a new collection to organize your products.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Summer Collection"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Brief description of this collection..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? (
                    "Creating..."
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Create
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Collection</DialogTitle>
                <DialogDescription>Update collection details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Summer Collection"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Brief description of this collection..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingCollection(null);
                  }}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isSubmitting}>
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Collection</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{collectionToDelete?.title}"? This action cannot
                  be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  Products in this collection will not be deleted, but will no longer be associated
                  with this collection.
                </p>
                {collectionToDelete && productCounts[collectionToDelete.id] > 0 && (
                  <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    This collection has {productCounts[collectionToDelete.id]} product(s).
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setCollectionToDelete(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                  {isSubmitting ? "Deleting..." : "Delete Collection"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </RequireAdmin>
  );
}
