import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Store, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function QuickActions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Fetch companies for super_admin to select from
  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    enabled: user?.role === "super_admin" && storeDialogOpen,
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: { name: string; address: string; companyId?: number }) => {
      await apiRequest("POST", "/api/stores", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setStoreDialogOpen(false);
      setStoreName("");
      setStoreAddress("");
      setSelectedCompanyId("");
      toast({
        title: "Store created successfully",
        description: "Your new store has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error creating store",
        description: "There was an error creating the store. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateStore = () => {
    if (!storeName.trim()) {
      toast({
        title: "Store name required",
        description: "Please enter a store name.",
        variant: "destructive",
      });
      return;
    }
    
    // For super_admin, require company selection
    if (user?.role === "super_admin" && !selectedCompanyId) {
      toast({
        title: "Company required",
        description: "Please select a company for this store.",
        variant: "destructive",
      });
      return;
    }
    
    const storeData: { name: string; address: string; companyId?: number } = {
      name: storeName,
      address: storeAddress,
    };
    
    // Include companyId for super_admin
    if (user?.role === "super_admin" && selectedCompanyId) {
      storeData.companyId = parseInt(selectedCompanyId);
    }
    
    createStoreMutation.mutate(storeData);
  };

  const actions = [
    {
      title: "Add New User",
      icon: UserPlus,
      onClick: () => setLocation("/users"),
      roles: ["super_admin"],
    },
    {
      title: "Create Store",
      icon: Store,
      onClick: () => setStoreDialogOpen(true),
      roles: ["super_admin", "store_owner"],
    },
    {
      title: "View Analytics",
      icon: BarChart3,
      onClick: () => setLocation("/analytics"),
      roles: ["store_owner", "manager"],
    },
    {
      title: "System Settings",
      icon: Settings,
      onClick: () => setLocation("/settings"),
      roles: ["super_admin", "store_owner", "manager"],
    },
  ];

  const availableActions = actions.filter(action => 
    user?.role && action.roles.includes(user.role)
  );

  return (
    <>
      <Card className="border-0 bg-white/60 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableActions.map((action, index) => {
            const gradients = [
              "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
              "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700",
              "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700",
              "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
            ];
            
            return (
              <Button
                key={action.title}
                onClick={action.onClick}
                className={`w-full justify-start text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${gradients[index % gradients.length]}`}
              >
                <action.icon className="mr-3 h-4 w-4" />
                {action.title}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {user?.role === "super_admin" && (
              <div>
                <Label htmlFor="companySelect">Company *</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger id="companySelect">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company: any) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter store name"
              />
            </div>
            <div>
              <Label htmlFor="storeAddress">Address (Optional)</Label>
              <Input
                id="storeAddress"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Enter store address"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateStore}
                disabled={createStoreMutation.isPending}
              >
                {createStoreMutation.isPending ? "Creating..." : "Create Store"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
