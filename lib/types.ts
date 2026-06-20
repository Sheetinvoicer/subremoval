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
  aiInsights?: {
    creditScore: number;
    paymentBehavior: string;
    recommendedLimits: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AIRecommendation {
  type: 'credit' | 'discount' | 'payment_terms' | 'follow_up';
  message: string;
  confidence: number;
  action: string;
}
