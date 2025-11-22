import { useState, useEffect } from "react";
import React from "react";
import { Plus, Search, Building2, Users, MapPin, Phone, Mail, Calendar, Filter, MoreHorizontal, Edit, Trash2, Eye, UserPlus, Settings, BarChart3, Send } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Company {
  id: number;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
  isActive: boolean;
  licenseStatus: string;
  maxBranches: number;
  branchCount: number;
  userCount: number;
  createdAt: string;
}

export default function CompanyManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [editFormData, setEditFormData] = useState({
    name: "",
    registrationNumber: "",
    vatNumber: "",
    address: "",
    email: "",
    phone: "",
    contactPerson: "",
    password: "",
    maxBranches: 1,
  });
  const [formData, setFormData] = useState({
    name: "",
    registrationNumber: "",
    vatNumber: "",
    address: "",
    email: "",
    phone: "",
    contactPerson: "",
    password: "",
    maxBranches: 1,
  });

  const { toast } = useToast();

  // Fetch real companies from database
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load companies on component mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      } else {
        console.error('Failed to fetch companies');
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Real company creation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: typeof formData) => {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create company' }));
        throw new Error(errorData.message || 'Failed to create company');
      }
      
      return response.json();
    },
    onSuccess: (newCompany) => {
      // Add the new company to the list immediately
      setCompanies(prev => [...prev, newCompany]);
      toast({
        title: "Success", 
        description: "Company created successfully!",
      });
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        registrationNumber: "",
        vatNumber: "",
        address: "",
        email: "",
        phone: "",
        contactPerson: "",
        password: "",
        maxBranches: 1,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         company.registrationNumber.includes(searchQuery) ||
                         company.vatNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "active" && company.isActive) ||
                         (filterStatus === "inactive" && !company.isActive) ||
                         (filterStatus === company.licenseStatus);
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateCompany = () => {
    createCompanyMutation.mutate(formData);
  };

  const handleViewDetails = (company: Company) => {
    setSelectedCompany(company);
    setIsViewDialogOpen(true);
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setEditFormData({
      name: company.name,
      registrationNumber: company.registrationNumber,
      vatNumber: company.vatNumber,
      address: company.address,
      email: company.email,
      phone: company.phone,
      contactPerson: company.contactPerson,
      password: "",
      maxBranches: company.maxBranches,
    });
    setIsEditDialogOpen(true);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { id: number; updates: typeof editFormData }) => {
      const response = await fetch(`/api/companies/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update company');
      }
      
      return response.json();
    },
    onSuccess: (updatedCompany) => {
      setCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Company updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update company: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateCompany = () => {
    if (selectedCompany) {
      updateCompanyMutation.mutate({ 
        id: selectedCompany.id, 
        updates: editFormData 
      });
    }
  };

  const handleDeactivateCompany = async (company: Company) => {
    if (confirm(`Are you sure you want to ${company.isActive ? 'deactivate' : 'activate'} ${company.name}?`)) {
      try {
        const response = await fetch(`/api/companies/${company.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: !company.isActive }),
        });
        
        if (response.ok) {
          const updatedCompany = await response.json();
          setCompanies(prev => prev.map(c => c.id === company.id ? updatedCompany : c));
          toast({
            title: "Success",
            description: `Company ${company.isActive ? 'deactivated' : 'activated'} successfully!`,
          });
        } else {
          throw new Error('Failed to update company status');
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update company status",
          variant: "destructive",
        });
      }
    }
  };

  const inviteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await apiRequest("POST", `/api/companies/${companyId}/invite`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation Sent!",
        description: `Company activation invitation sent successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete company' }));
        throw new Error(errorData.message || 'Failed to delete company');
      }
      
      return response.json();
    },
    onSuccess: (_, deletedCompanyId) => {
      // Remove the company from the list immediately
      setCompanies(prev => prev.filter(company => company.id !== deletedCompanyId));
      toast({
        title: "Success", 
        description: "Company deleted successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = (company: Company) => {
    if (confirm(`Send activation invitation to ${company.name} at ${company.email}?`)) {
      inviteCompanyMutation.mutate(company.id);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    if (confirm(`Are you sure you want to delete ${company.name}? This action cannot be undone.`)) {
      deleteCompanyMutation.mutate(company.id);
    }
  };

  const handleInviteManager = (company: Company) => {
    const email = prompt(`Enter manager email for ${company.name}:`);
    if (email) {
      toast({
        title: "Invitation Sent!",
        description: `Manager invitation sent to ${email} for ${company.name}`,
      });
    }
  };

  const handleManageBranches = async (company: Company) => {
    setSelectedCompany(company);
    try {
      const response = await fetch(`/api/companies/${company.id}/stores`);
      if (response.ok) {
        const branchData = await response.json();
        setBranches(branchData);
      } else {
        setBranches([]);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranches([]);
    }
    setIsBranchDialogOpen(true);
  };

  const getStatusBadge = (company: Company) => {
    if (!company.isActive) {
      return (
        <Badge className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700 hover:from-red-200 hover:to-pink-200">
          Inactive
        </Badge>
      );
    }
    
    switch (company.licenseStatus) {
      case "active":
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 hover:from-green-200 hover:to-emerald-200">
            Active
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700 hover:from-yellow-200 hover:to-orange-200">
            Suspended
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-700 dark:to-gray-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600">
            {company.licenseStatus}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Page Header with Gradient */}
        <div className="mb-8 relative">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-bold">Company Management</h1>
                </div>
                <p className="text-blue-100 text-lg">
                  Manage companies, licenses, and company settings with enterprise-grade controls
                </p>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">System Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{companies.length} Companies</span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/10 rounded-full blur-xl"></div>
                  <div className="relative bg-white/20 backdrop-blur-sm rounded-2xl p-6">
                    <BarChart3 className="h-12 w-12 text-white/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Search and Filters Card */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input
                  placeholder="Search companies by name, IČO, or DIČ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-lg border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 h-12 border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-700/60">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-200 border-0">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Company
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardContent>
      </Card>

        {/* Create Company Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              
              <div>
                <Label htmlFor="registrationNumber">Registration Number (IČO) *</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="12345678"
                />
              </div>
              
              <div>
                <Label htmlFor="vatNumber">VAT Number (DIČ)</Label>
                <Input
                  id="vatNumber"
                  value={formData.vatNumber}
                  onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  placeholder="CZ12345678"
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="address">Full Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Postal Code"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="company@example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+420 123 456 789"
                />
              </div>
              
              <div>
                <Label htmlFor="contactPerson">Contact Person *</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Login Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set login password for this company"
                />
              </div>
              
              <div>
                <Label htmlFor="maxBranches">Max Branches</Label>
                <Input
                  id="maxBranches"
                  type="number"
                  min="1"
                  value={formData.maxBranches}
                  onChange={(e) => setFormData({ ...formData, maxBranches: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCompany}
                disabled={createCompanyMutation.isPending}
              >
                {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Company Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Company Details</DialogTitle>
            </DialogHeader>
            {selectedCompany && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Company Name</Label>
                  <p className="text-sm">{selectedCompany.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Registration Number</Label>
                  <p className="text-sm">{selectedCompany.registrationNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">VAT Number</Label>
                  <p className="text-sm">{selectedCompany.vatNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <Badge variant={selectedCompany.isActive ? "default" : "secondary"}>
                    {selectedCompany.licenseStatus}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-gray-600">Address</Label>
                  <p className="text-sm">{selectedCompany.address}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Email</Label>
                  <p className="text-sm">{selectedCompany.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Phone</Label>
                  <p className="text-sm">{selectedCompany.phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Contact Person</Label>
                  <p className="text-sm">{selectedCompany.contactPerson}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Max Branches</Label>
                  <p className="text-sm">{selectedCompany.maxBranches}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Company Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editName">Company Name</Label>
                <Input
                  id="editName"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editRegNumber">Registration Number</Label>
                <Input
                  id="editRegNumber"
                  value={editFormData.registrationNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, registrationNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editVatNumber">VAT Number</Label>
                <Input
                  id="editVatNumber"
                  value={editFormData.vatNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, vatNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="editAddress">Address</Label>
                <Textarea
                  id="editAddress"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editContactPerson">Contact Person</Label>
                <Input
                  id="editContactPerson"
                  value={editFormData.contactPerson}
                  onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editPassword">Login Password</Label>
                <Input
                  id="editPassword"
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="Leave empty to keep current password"
                />
              </div>
              <div>
                <Label htmlFor="editMaxBranches">Max Branches</Label>
                <Input
                  id="editMaxBranches"
                  type="number"
                  min="1"
                  value={editFormData.maxBranches}
                  onChange={(e) => setEditFormData({ ...editFormData, maxBranches: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateCompany}
                disabled={updateCompanyMutation.isPending}
              >
                {updateCompanyMutation.isPending ? "Updating..." : "Update Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modern Companies Table */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 border-b border-slate-200 dark:border-slate-600">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Companies ({filteredCompanies.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border-b-2 border-slate-300 dark:border-slate-500">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Company</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Registration</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Contact</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Branches</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Users</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 py-4">Created</TableHead>
                  <TableHead className="w-[70px] font-semibold text-slate-700 dark:text-slate-200 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company, index) => (
                  <TableRow 
                    key={company.id} 
                    className={`border-b border-slate-200 dark:border-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-800'}`}
                  >
                    <TableCell className="py-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{company.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-blue-500" />
                          {company.address.split(',')[0]}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">IČO: {company.registrationNumber}</div>
                        {company.vatNumber && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">DIČ: {company.vatNumber}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <div className="text-sm flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Mail className="h-3 w-3 text-purple-500" />
                          {company.email}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-green-500" />
                          {company.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(company)}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 px-2 py-1 rounded-full">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {company.branchCount}/{company.maxBranches}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-full">
                          <Users className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{company.userCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3 w-3 text-indigo-500" />
                        {company.createdAt}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900 rounded-full transition-all duration-200">
                            <MoreHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(company)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Company
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleManageBranches(company)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Manage Branches
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendInvitation(company)}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Invitation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteCompany(company)}
                          className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Company
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Branch Management Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Branches - {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Current branches: {branches.length} / {selectedCompany?.maxBranches}
              </p>
              <Button size="sm">Add New Branch</Button>
            </div>
            
            {branches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch: any) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>{branch.address}</TableCell>
                      <TableCell>{branch.phone}</TableCell>
                      <TableCell>
                        <Badge variant={branch.isActive ? "default" : "secondary"}>
                          {branch.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>${branch.revenue || 0}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No branches found for this company</p>
                <p className="text-sm text-muted-foreground">Add a new branch to get started</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      </div>
    </div>
  );
}