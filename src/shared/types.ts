export interface Booking {
  id: string;
  name: string;
  revenue: number;
  passThroughTax: number;
  bookingDate: string;
  startDate: string;
  endDate: string;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  label: string;
  revenue: number;
  netRevenue: number;
}

export interface MonthExpense {
  id: string;
  year: number;
  month: number;
  cleaning: number;
  support: number;
  tax: number;
  misc: number;
}
