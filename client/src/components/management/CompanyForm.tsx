import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyFormData } from "@/lib/utils/validation";

interface CompanyFormProps {
  form: UseFormReturn<CompanyFormData>;
  mode?: "create" | "edit";
}

export function CompanyForm({ form, mode = "create" }: CompanyFormProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="name">Company Name *</Label>
        <Input
          id="name"
          placeholder="Enter company name"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="registrationNumber">Registration Number (IČO) *</Label>
        <Input
          id="registrationNumber"
          placeholder="12345678"
          {...form.register("registrationNumber")}
        />
        {form.formState.errors.registrationNumber && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.registrationNumber.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="vatNumber">VAT Number (DIČ)</Label>
        <Input
          id="vatNumber"
          placeholder="CZ12345678"
          {...form.register("vatNumber")}
        />
        {form.formState.errors.vatNumber && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.vatNumber.message}</p>
        )}
      </div>
      
      <div className="col-span-2">
        <Label htmlFor="address">Full Address *</Label>
        <Textarea
          id="address"
          placeholder="Street, City, Postal Code"
          rows={2}
          {...form.register("address")}
        />
        {form.formState.errors.address && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.address.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="company@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
          placeholder="+420 123 456 789"
          {...form.register("phone")}
        />
        {form.formState.errors.phone && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
        )}
      </div>
      
      <div>
        <Label htmlFor="contactPerson">Contact Person *</Label>
        <Input
          id="contactPerson"
          placeholder="Full name"
          {...form.register("contactPerson")}
        />
        {form.formState.errors.contactPerson && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.contactPerson.message}</p>
        )}
      </div>
      
      {mode === "create" && (
        <div>
          <Label htmlFor="password">Login Password *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Set login password for this company"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.password.message}</p>
          )}
        </div>
      )}
      
      <div>
        <Label htmlFor="maxBranches">Max Branches</Label>
        <Input
          id="maxBranches"
          type="number"
          min="1"
          {...form.register("maxBranches", { valueAsNumber: true })}
        />
        {form.formState.errors.maxBranches && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.maxBranches.message}</p>
        )}
      </div>
    </div>
  );
}

