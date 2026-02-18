import axios from "axios";
import type { Member, MemberPackage, Package, Session } from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: string;
  gym_name?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: RegisterData) => api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

export const membersApi = {
  getAll: () => api.get<Member[]>("/members"),
  getById: (id: string) => api.get<Member>(`/members/${id}`),
  create: (data: Partial<Member>) => api.post<Member>("/members", data),
  update: (id: string, data: Partial<Member>) =>
    api.put<Member>(`/members/${id}`, data),
  delete: (id: string) => api.delete(`/members/${id}`),
  getSessions: (id: string) => api.get<Session[]>(`/members/${id}/sessions`),
};

export const sessionsApi = {
  getAll: (date?: string) =>
    api.get<Session[]>("/sessions", { params: date ? { date } : undefined }),
  getById: (id: string) => api.get<Session>(`/sessions/${id}`),
  create: (data: Partial<Session>) => api.post<Session>("/sessions", data),
  update: (id: string, data: Partial<Session>) =>
    api.put<Session>(`/sessions/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.put(`/sessions/${id}`, { status }),
};

export const paymentsApi = {
  getAll: (status?: string) =>
    api.get<MemberPackage[]>("/payments", {
      params: status ? { payment_status: status } : undefined,
    }),
  getByMember: (memberId: string) =>
    api.get<MemberPackage[]>(`/members/${memberId}/packages`),
  create: (data: Record<string, unknown>) =>
    api.post<MemberPackage>("/payments", data),
  update: (id: string, data: Partial<MemberPackage>) =>
    api.put<MemberPackage>(`/payments/${id}`, data),
};

export const packagesApi = {
  getAll: () => api.get<Package[]>("/packages"),
  create: (data: Partial<Package>) => api.post<Package>("/packages", data),
  update: (id: string, data: Partial<Package>) =>
    api.put<Package>(`/packages/${id}`, data),
  delete: (id: string) => api.delete(`/packages/${id}`),
};

export const dashboardApi = {
  getStats: () => api.get("/dashboard"),
  getTodaySessions: () => api.get("/dashboard/today"),
  getExpiringPackages: () => api.get("/dashboard/expiring"),
};

export const trainersApi = {
  getAll: () => api.get<import("@/types").User[]>("/trainers"),
};

export default api;
