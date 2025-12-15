import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface BranchCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number | null;
  companyName?: string;
  /**
   * Called after a branch is successfully created so parent can refresh data.
   */
  onCreated?: () => void;
}

export function BranchCreateDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onCreated,
}: BranchCreateDialogProps) {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
  });

  const createBranchMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) {
        throw new Error("No company selected for branch creation.");
      }

      const response = await fetchWithAuth("/api/stores", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim() || undefined,
          companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "" }));
        throw new Error(errorData.message || "Failed to create branch");
      }

      return response.json();
    },
    onSuccess: () => {
      setFormData({
        name: "",
        address: "",
        phone: "",
      });

      onOpenChange(false);
      onCreated?.();

      toast({
        title: "Branch created",
        description: "New branch has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create branch",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({
        title: "Missing information",
        description: "Branch name and address are required.",
        variant: "destructive",
      });
      return;
    }

    createBranchMutation.mutate();
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !createBranchMutation.isPending) {
      onOpenChange(false);
    } else if (nextOpen) {
      onOpenChange(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Create New Branch{companyName ? ` for ${companyName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name *</Label>
            <Input
              id="branch-name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter branch name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-address">Address *</Label>
            <Textarea
              id="branch-address"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Street, City, Postal Code"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input
              id="branch-phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+420 123 456 789"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={createBranchMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createBranchMutation.isPending || !companyId}>
            {createBranchMutation.isPending ? "Creating..." : "Create Branch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


