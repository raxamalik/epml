import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Store, MapPin, User, Phone, TrendingUp, Edit, Trash2, Eye, Loader2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface Store {
  id: number;
  name: string;
  address: string;
  phone?: string;
  managerId?: string;
  companyId: number;
  isActive: boolean;
  revenue: number;
  customerCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

const storeFormSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  managerId: z.string().optional(),
  companyId: z.number().min(1, "Company is required"),
  isActive: z.boolean().default(true),
  revenue: z.number().default(0),
  customerCount: z.number().default(0),
  productCount: z.number().default(0),
});

type StoreFormData = z.infer<typeof storeFormSchema>;

export default function StoreManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createForm = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      companyId: 1, // Default to first company
      isActive: true,
      revenue: 0,
      customerCount: 0,
      productCount: 0,
    },
  });

  // Get current user info from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const editForm = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
  });

  // Fetch stores
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["/api/stores"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stores");
      return response.json();
    },
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      const response = await apiRequest("POST", "/api/stores", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Store Created",
        description: "Store has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update store mutation
  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StoreFormData> }) => {
      const response = await apiRequest("PUT", `/api/stores/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      setIsEditDialogOpen(false);
      setSelectedStore(null);
      editForm.reset();
      toast({
        title: "Store Updated",
        description: "Store has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/stores/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Store Deleted",
        description: "Store has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateStore = (data: StoreFormData) => {
    // Use the logged-in user's ID as company ID (since companies log in with their own credentials)
    const storeData = {
      ...data,
      companyId: currentUser?.id || 1 // Use user's ID as company ID
    };
    createStoreMutation.mutate(storeData);
  };

  const handleEditStore = (store: Store) => {
    setSelectedStore(store);
    editForm.reset({
      name: store.name,
      address: store.address,
      phone: store.phone || "",
      managerId: store.managerId ? String(store.managerId) : "",
      companyId: store.companyId,
      isActive: store.isActive,
      revenue: store.revenue,
      customerCount: store.customerCount,
      productCount: store.productCount,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateStore = (data: StoreFormData) => {
    console.log("Update form submitted with data:", data);
    console.log("Form errors:", editForm.formState.errors);
    console.log("Selected store:", selectedStore);
    
    if (selectedStore) {
      // Ensure company ID is preserved from the selected store
      // Convert empty managerId to null to satisfy foreign key constraint
      const updateData = {
        ...data,
        managerId: data.managerId && data.managerId.trim() !== "" ? data.managerId : null,
        companyId: selectedStore.companyId
      };
      console.log("Sending update data:", updateData);
      updateStoreMutation.mutate({ id: selectedStore.id, data: updateData });
    }
  };

  const handleDeleteStore = (store: Store) => {
    deleteStoreMutation.mutate(store.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading stores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Store Management</h1>
          <p className="text-slate-600 mt-1">Manage your store locations and settings</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add New Store
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Store</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateStore)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Store Name</Label>
                <Input
                  id="name"
                  {...createForm.register("name")}
                  placeholder="Enter store name"
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-red-600">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  {...createForm.register("address")}
                  placeholder="Enter store address"
                  rows={3}
                />
                {createForm.formState.errors.address && (
                  <p className="text-sm text-red-600">{createForm.formState.errors.address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  {...createForm.register("phone")}
                  placeholder="Enter phone number"
                />
              </div>



              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createStoreMutation.isPending}>
                  {createStoreMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Store"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stores List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Locations ({stores.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No stores found</h3>
              <p className="text-slate-600 mb-4">Create your first store to get started</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Store
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {stores.map((store: Store) => (
                <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                  <div className="flex items-center space-x-4">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{store.name}</h3>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {store.address}
                      </p>
                      {store.phone && (
                        <p className="text-sm text-slate-600 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {store.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold">€{store.revenue.toLocaleString()}</p>
                      <p className="text-xs text-slate-600">{store.productCount} products</p>
                      <p className="text-xs text-slate-600">{store.customerCount} customers</p>
                    </div>
                    <Badge variant={store.isActive ? "default" : "secondary"}>
                      {store.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <div className="flex space-x-2">
                      <Link href={`/pos/${store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}>
                        <Button size="sm" variant="outline" title="Open POS">
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => handleEditStore(store)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Store</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{store.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStore(store)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Store Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateStore, (errors) => {
            console.log("Form validation failed:", errors);
            console.log("Current form values:", editForm.getValues());
          })} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Store Name</Label>
              <Input
                id="edit-name"
                {...editForm.register("name")}
                placeholder="Enter store name"
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-red-600">{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                {...editForm.register("address")}
                placeholder="Enter store address"
                rows={3}
              />
              {editForm.formState.errors.address && (
                <p className="text-sm text-red-600">{editForm.formState.errors.address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone (Optional)</Label>
              <Input
                id="edit-phone"
                {...editForm.register("phone")}
                placeholder="Enter phone number"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-revenue">Revenue</Label>
                <Input
                  id="edit-revenue"
                  type="number"
                  {...editForm.register("revenue", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-products">Products</Label>
                <Input
                  id="edit-products"
                  type="number"
                  {...editForm.register("productCount", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-customers">Customers</Label>
                <Input
                  id="edit-customers"
                  type="number"
                  {...editForm.register("customerCount", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                {...editForm.register("isActive")}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active">Store is active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateStoreMutation.isPending}>
                {updateStoreMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Store"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}