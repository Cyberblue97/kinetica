"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paymentsApi } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import type { MemberPackage } from "@/types";

const paymentMethodConfig: Record<
  string,
  { label: string; className: string }
> = {
  cash: { label: "현금", className: "bg-slate-100 text-slate-700" },
  card: { label: "카드", className: "bg-blue-100 text-blue-700" },
  transfer: { label: "계좌이체", className: "bg-yellow-100 text-yellow-700" },
  online_mock: {
    label: "온라인(목업)",
    className: "bg-purple-100 text-purple-700",
  },
};

const paymentStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  paid: { label: "결제완료", className: "bg-green-100 text-green-700" },
  pending: { label: "미결제", className: "bg-yellow-100 text-yellow-700" },
  overdue: { label: "연체", className: "bg-red-100 text-red-700" },
};

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: allPayments, isLoading } = useQuery<MemberPackage[]>({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.getAll().then((r) => r.data),
  });

  const payments =
    statusFilter === "all"
      ? allPayments
      : allPayments?.filter((p) => p.payment_status === statusFilter);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const thisMonthIncome =
    payments
      ?.filter((p) => {
        const d = new Date(p.start_date);
        return p.payment_status === "paid" && d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, p) => sum + p.price_paid, 0) ?? 0;

  const unpaidCount =
    allPayments?.filter((p) => p.payment_status !== "paid").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 font-medium">이번 달 수입</p>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {thisMonthIncome.toLocaleString()}원
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 font-medium">미결제 건수</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-red-600 mt-1">
                {unpaidCount}건
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 font-medium">
          결제 상태 필터
        </span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="paid">결제완료</SelectItem>
            <SelectItem value="pending">미결제</SelectItem>
            <SelectItem value="overdue">연체</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-600">
                회원명
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                패키지명
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                금액
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                결제 수단
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                결제 상태
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                결제일
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !payments?.length ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-slate-400"
                >
                  결제 기록이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const method = paymentMethodConfig[payment.payment_method];
                const status = paymentStatusConfig[payment.payment_status];
                return (
                  <TableRow key={payment.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      {payment.member?.name || "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {payment.package?.name || "—"}
                    </TableCell>
                    <TableCell className="text-slate-900 font-medium">
                      {payment.price_paid.toLocaleString()}원
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${method?.className}`}
                      >
                        {method?.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${status?.className}`}
                      >
                        {status?.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {format(new Date(payment.start_date), "yyyy.MM.dd", {
                        locale: ko,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
