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
import { Plus, User, MapPin, Phone, Mail, Edit, Trash2, Eye, Loader2, Shield, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

interface Manager {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  companyId: number;
  storeId?: number;
  createdAt: string;
  updatedAt: string;
  store?: {
    id: number;
    name: string;
  };
}

const managerFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(["manager", "store_owner"]).default("manager"),
  isActive: z.boolean().default(true),
  storeId: z.number().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

type ManagerFormData = z.infer<typeof managerFormSchema>;

export default function ManagerManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user info from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const createForm = useForm<ManagerFormData>({
    resolver: zodResolver(managerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "manager",
      isActive: true,
      password: "",
    },
  });

  const editForm = useForm<ManagerFormData>({
    resolver: zodResolver(managerFormSchema.omit({ password: true })),
  });

  // Fetch managers
  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["/api/managers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/managers");
      return response.json();
    },
  });

  // Fetch stores for dropdown
  const { data: stores = [] } = useQuery({
    queryKey: ["/api/stores"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stores");
      return response.json();
    },
  });

  // Create manager mutation
  const createManagerMutation = useMutation({
    mutationFn: async (data: ManagerFormData) => {
      const managerData = {
        ...data,
        companyId: currentUser?.id || 1, // Use logged-in company ID
      };
      const response = await apiRequest("POST", "/api/managers", managerData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Manager Created",
        description: "Manager has been created successfully.",
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

  // Update manager mutation
  const updateManagerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ManagerFormData> }) => {
      const response = await apiRequest("PUT", `/api/managers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsEditDialogOpen(false);
      setSelectedManager(null);
      editForm.reset();
      toast({
        title: "Manager Updated",
        description: "Manager has been updated successfully.",
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

  // Delete manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/managers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      toast({
        title: "Manager Deleted",
        description: "Manager has been deleted successfully.",
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

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/managers/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      toast({
        title: "Status Updated",
        description: "Manager status has been updated successfully.",
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

  const handleCreateManager = (data: ManagerFormData) => {
    // Automatically set role to "manager" since we removed it from the form
    const managerData = {
      ...data,
      role: "manager" as const
    };
    createManagerMutation.mutate(managerData);
  };

  const handleEditManager = (manager: Manager) => {
    setSelectedManager(manager);
    editForm.reset({
      firstName: manager.firstName || "",
      lastName: manager.lastName || "",
      email: manager.email || "",
      phone: manager.phone || "",
      role: manager.role as "manager" | "store_owner",
      isActive: manager.isActive,
      storeId: manager.storeId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateManager = (data: ManagerFormData) => {
    if (selectedManager) {
      const updateData = {
        ...data,
        role: "manager" as const,
        companyId: selectedManager.companyId
      };
      updateManagerMutation.mutate({ id: selectedManager.id, data: updateData });
    }
  };

  const handleDeleteManager = (manager: Manager) => {
    deleteManagerMutation.mutate(manager.id);
  };

  const handleToggleActive = (manager: Manager) => {
    toggleActiveMutation.mutate({ id: manager.id, isActive: !manager.isActive });
  };

  const getStatusBadge = (manager: Manager) => {
    if (manager.isActive) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      manager: "bg-blue-100 text-blue-800",
      store_owner: "bg-purple-100 text-purple-800",
    };
    return (
      <Badge variant="secondary" className={roleColors[role as keyof typeof roleColors]}>
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading managers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Management</h1>
          <p className="text-muted-foreground mt-2">Manage your team members and store managers</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Manager
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Manager</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateManager)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    {...createForm.register("firstName")}
                    placeholder="Enter first name"
                  />
                  {createForm.formState.errors.firstName && (
                    <p className="text-sm text-red-600">{createForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...createForm.register("lastName")}
                    placeholder="Enter last name"
                  />
                  {createForm.formState.errors.lastName && (
                    <p className="text-sm text-red-600">{createForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...createForm.register("email")}
                  placeholder="Enter email address"
                />
                {createForm.formState.errors.email && (
                  <p className="text-sm text-red-600">{createForm.formState.errors.email.message}</p>
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

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...createForm.register("password")}
                  placeholder="Enter password"
                />
                {createForm.formState.errors.password && (
                  <p className="text-sm text-red-600">{createForm.formState.errors.password.message}</p>
                )}
              </div>



              <div className="space-y-2">
                <Label htmlFor="storeId">Assign to Store (Optional)</Label>
                <Select onValueChange={(value) => createForm.setValue("storeId", parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store: any) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createManagerMutation.isPending}>
                  {createManagerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Manager"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Managers ({managers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {managers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No managers found</h3>
              <p className="text-muted-foreground mb-6">Start by adding your first manager to the system.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manager
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {managers.map((manager: Manager) => (
                <div
                  key={manager.id}
                  className="flex items-center justify-between p-6 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{manager.firstName} {manager.lastName}</h3>
                        {getStatusBadge(manager)}
                        {getRoleBadge(manager.role)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {manager.email}
                        </div>
                        {manager.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {manager.phone}
                          </div>
                        )}
                        {manager.store && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {manager.store.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(manager)}
                      disabled={toggleActiveMutation.isPending}
                    >
                      {manager.isActive ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditManager(manager)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Manager</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{manager.firstName} {manager.lastName}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteManager(manager)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Manager Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Manager</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateManager)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  {...editForm.register("firstName")}
                  placeholder="Enter first name"
                />
                {editForm.formState.errors.firstName && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  {...editForm.register("lastName")}
                  placeholder="Enter last name"
                />
                {editForm.formState.errors.lastName && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                {...editForm.register("email")}
                placeholder="Enter email address"
              />
              {editForm.formState.errors.email && (
                <p className="text-sm text-red-600">{editForm.formState.errors.email.message}</p>
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



            <div className="space-y-2">
              <Label htmlFor="edit-storeId">Assign to Store (Optional)</Label>
              <Select 
                value={editForm.watch("storeId")?.toString()} 
                onValueChange={(value) => editForm.setValue("storeId", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store: any) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateManagerMutation.isPending}>
                {updateManagerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Manager"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}