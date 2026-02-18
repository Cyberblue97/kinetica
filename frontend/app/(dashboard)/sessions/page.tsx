"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi, paymentsApi, trainersApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Session, MemberPackage, User } from "@/types";

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "예정", className: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", className: "bg-green-100 text-green-700" },
  no_show: { label: "노쇼", className: "bg-red-100 text-red-700" },
  cancelled: { label: "취소", className: "bg-slate-100 text-slate-600" },
};

type SessionForm = {
  member_package_id: string;
  trainer_id: string;
  scheduled_at: string;
  notes: string;
};

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SessionForm>({
    member_package_id: "",
    trainer_id: "",
    scheduled_at: `${todayStr}T09:00`,
    notes: "",
  });

  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ["sessions", selectedDate],
    queryFn: () => sessionsApi.getAll(selectedDate).then((r) => r.data),
  });

  const { data: memberPackages } = useQuery<MemberPackage[]>({
    queryKey: ["all-member-packages"],
    queryFn: () => paymentsApi.getAll().then((r) => r.data),
  });

  const { data: trainers } = useQuery<User[]>({
    queryKey: ["trainers"],
    queryFn: () => trainersApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("수업이 예약되었습니다");
      setDialogOpen(false);
      setForm({
        member_package_id: "",
        trainer_id: "",
        scheduled_at: `${todayStr}T09:00`,
        notes: "",
      });
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      sessionsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("상태가 변경되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      member_package_id: form.member_package_id,
      trainer_id: form.trainer_id,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      notes: form.notes || undefined,
    });
  };

  const handlePackageSelect = (packageId: string) => {
    const mp = memberPackages?.find((p) => p.id === packageId);
    setForm((prev) => ({
      ...prev,
      member_package_id: packageId,
      trainer_id: mp?.trainer_id || prev.trainer_id,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium text-slate-600 whitespace-nowrap">
            날짜 선택
          </Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <CalendarPlus className="w-4 h-4" />
          수업 예약
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-600">
                시간
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                회원명
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                트레이너
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                상태
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                노트
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                액션
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !sessions?.length ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-slate-400"
                >
                  해당 날짜에 예정된 수업이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const sc = statusConfig[session.status];
                return (
                  <TableRow key={session.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      {format(new Date(session.scheduled_at), "HH:mm", {
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {session.member?.name || "—"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {session.trainer?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${sc?.className}`}
                      >
                        {sc?.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 max-w-[200px] truncate">
                      {session.notes || "—"}
                    </TableCell>
                    <TableCell>
                      {session.status === "scheduled" && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                            onClick={() =>
                              statusMutation.mutate({
                                id: session.id,
                                status: "completed",
                              })
                            }
                          >
                            완료
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                            onClick={() =>
                              statusMutation.mutate({
                                id: session.id,
                                status: "no_show",
                              })
                            }
                          >
                            노쇼
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50 text-xs h-7"
                            onClick={() =>
                              statusMutation.mutate({
                                id: session.id,
                                status: "cancelled",
                              })
                            }
                          >
                            취소
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>수업 예약</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>회원 / 패키지 *</Label>
              <Select
                value={form.member_package_id}
                onValueChange={handlePackageSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="패키지 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(memberPackages || [])
                    .filter((mp) => mp.sessions_remaining > 0)
                    .map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.member?.name || "?"} —{" "}
                        {mp.package?.name || "패키지"} ({mp.sessions_remaining}
                        회 남음)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>트레이너 *</Label>
              <Select
                value={form.trainer_id}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, trainer_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="트레이너 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(trainers || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>일시 *</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>노트</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "예약 중..." : "예약"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
