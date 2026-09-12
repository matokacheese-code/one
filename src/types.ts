export type SaleItem = { name: string; quantity: number };

export type Sale = {
  id: string;
  order_id: string;
  ordered_at: string;
  branch_id: string | null;
  branch_name: string;
  platform: string;
  total: number;
  item_count: number;
  items: SaleItem[];
  created_at: string;
  updated_at: string;
};
