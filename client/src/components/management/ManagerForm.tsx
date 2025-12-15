import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagerFormData } from "@/lib/utils/validation";

interface Store {
  id: number;
  name: string;
}

interface ManagerFormProps {
  form: UseFormReturn<ManagerFormData>;
  stores?: Store[];
  mode?: "create" | "edit";
  hideStoreSelect?: boolean;
}

export function ManagerForm({ form, stores = [], mode = "create", hideStoreSelect = false }: ManagerFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            placeholder="Enter first name"
            {...form.register("firstName")}
          />
          {form.formState.errors.firstName && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            placeholder="Enter last name"
            {...form.register("lastName")}
          />
          {form.formState.errors.lastName && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter email address"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
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

      {!hideStoreSelect && stores.length > 0 && (
        <div>
          <Label htmlFor="storeId">Store</Label>
          <Select
            value={form.watch("storeId")?.toString() || "none"}
            onValueChange={(value) => form.setValue("storeId", value === "none" ? undefined : parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a store (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No store assigned</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id.toString()}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === "create" && (
        <div>
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter password (min 6 characters)"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.password.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

