export type UserRole = "owner" | "trainer" | "member";
export type SessionStatus = "scheduled" | "completed" | "no_show" | "cancelled";
export type PaymentMethod = "cash" | "card" | "transfer" | "online_mock";
export type PaymentStatus = "paid" | "pending" | "overdue";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  gym_id: string;
  trainer_id?: string;
}

export interface Gym {
  id: string;
  name: string;
  type: "gym" | "personal_studio";
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  is_active: boolean;
  trainer_id?: string;
  trainer?: User;
  created_at: string;
  member_packages?: MemberPackage[];
}

export interface Package {
  id: string;
  name: string;
  total_sessions: number;
  validity_days: number;
  price: number;
}

export interface MemberPackage {
  id: string;
  member_id: string;
  package_id: string;
  package?: Package;
  start_date: string;
  expiry_date: string;
  sessions_remaining: number;
  sessions_total: number;
  price_paid: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
}

export interface Session {
  id: string;
  member_package_id: string;
  member?: Member;
  trainer_id: string;
  trainer?: User;
  scheduled_at: string;
  status: SessionStatus;
  notes?: string;
}

export interface DashboardStats {
  today_sessions_count: number;
  expiring_packages_count: number;
  unpaid_members_count: number;
  active_members_count: number;
}
