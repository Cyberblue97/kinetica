"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, AlertCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { DashboardStats, Session, MemberPackage } from "@/types";

const sessionStatusLabel: Record<string, { label: string; className: string }> =
  {
    scheduled: { label: "예정", className: "bg-blue-100 text-blue-700" },
    completed: { label: "완료", className: "bg-green-100 text-green-700" },
    no_show: { label: "노쇼", className: "bg-red-100 text-red-700" },
    cancelled: { label: "취소", className: "bg-slate-100 text-slate-600" },
  };

const paymentStatusLabel: Record<string, { label: string; className: string }> =
  {
    paid: { label: "결제완료", className: "bg-green-100 text-green-700" },
    pending: { label: "미결제", className: "bg-yellow-100 text-yellow-700" },
    overdue: { label: "연체", className: "bg-red-100 text-red-700" },
  };

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.getStats().then((r) => r.data),
  });

  const { data: todaySessions, isLoading: sessionsLoading } = useQuery<
    Session[]
  >({
    queryKey: ["dashboard-today-sessions"],
    queryFn: () => dashboardApi.getTodaySessions().then((r) => r.data),
  });

  const { data: expiringPackages, isLoading: packagesLoading } = useQuery<
    MemberPackage[]
  >({
    queryKey: ["dashboard-expiring-packages"],
    queryFn: () => dashboardApi.getExpiringPackages().then((r) => r.data),
  });

  const statCards = [
    {
      title: "오늘 수업",
      value: stats?.today_sessions_count ?? 0,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "이번 주 만료",
      value: stats?.expiring_packages_count ?? 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "미결제 회원",
      value: stats?.unpaid_members_count ?? 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "전체 활성 회원",
      value: stats?.active_members_count ?? 0,
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title} className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{title}</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className={`text-3xl font-bold mt-1 ${color}`}>
                      {value}
                    </p>
                  )}
                </div>
                <div
                  className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom sections */}
      <div className="grid grid-cols-2 gap-6">
        {/* Today sessions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              오늘 수업 목록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !todaySessions?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">
                오늘 예정된 수업이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map((session) => {
                  const status = sessionStatusLabel[session.status];
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {session.member?.name || "—"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {session.trainer?.name || "—"} ·{" "}
                          {format(new Date(session.scheduled_at), "HH:mm", {
                            locale: ko,
                          })}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${status?.className}`}
                      >
                        {status?.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring packages */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              이번 주 만료 패키지
            </CardTitle>
          </CardHeader>
          <CardContent>
            {packagesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !expiringPackages?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">
                이번 주 만료 예정 패키지가 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {expiringPackages.map((mp) => {
                  const ps = paymentStatusLabel[mp.payment_status];
                  return (
                    <div
                      key={mp.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {mp.trainer?.name || "—"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {mp.package?.name || "—"} · 만료:{" "}
                          {format(new Date(mp.end_date), "MM/dd", {
                            locale: ko,
                          })}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-500">
                          {mp.sessions_remaining}회 남음
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${ps?.className}`}
                        >
                          {ps?.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
