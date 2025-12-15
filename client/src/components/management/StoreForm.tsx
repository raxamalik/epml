import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StoreFormData } from "@/lib/utils/validation";

interface StoreFormProps {
  form: UseFormReturn<StoreFormData>;
  mode?: "create" | "edit";
}

export function StoreForm({ form, mode = "create" }: StoreFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Store Name *</Label>
        <Input
          id="name"
          placeholder="Enter store name"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="address">Address *</Label>
        <Textarea
          id="address"
          placeholder="Enter store address"
          rows={2}
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.address.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          placeholder="Enter phone number"
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
        )}
      </div>

      {mode === "create" && (
        <>
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Store Owner Account (Optional)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Create a store owner account for this store. Leave blank if you don't want to create one now.
            </p>
            
            <div>
              <Label htmlFor="ownerEmail">Store Owner Email</Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="Enter store owner email"
                {...form.register("ownerEmail")}
              />
              {form.formState.errors.ownerEmail && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.ownerEmail.message}</p>
              )}
            </div>

            <div className="mt-4">
              <Label htmlFor="ownerPassword">Store Owner Password</Label>
              <Input
                id="ownerPassword"
                type="password"
                placeholder="Enter password (min 6 characters)"
                {...form.register("ownerPassword")}
              />
              {form.formState.errors.ownerPassword && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.ownerPassword.message}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

