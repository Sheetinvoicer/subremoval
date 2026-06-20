export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  taxId?: string;
  paymentTerms: string;
  creditLimit: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  status: 'active' | 'inactive' | 'blocked';
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
