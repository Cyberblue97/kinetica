"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainersApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, UserX } from "lucide-react";
import type { User, TrainerCreate } from "@/types";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
};

export default function TrainersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: trainers, isLoading } = useQuery<User[]>({
    queryKey: ["trainers"],
    queryFn: () => trainersApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: TrainerCreate) => trainersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      toast.success("트레이너 계정이 생성되었습니다");
      closeDialog();
    },
    onError: (err: unknown) => {
      const msg =
        (
          err as {
            response?: { data?: { detail?: string } };
          }
        )?.response?.data?.detail || "오류가 발생했습니다";
      toast.error(msg);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => trainersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      toast.success("트레이너가 비활성화되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
    });
  };

  const handleDeactivate = (trainer: User) => {
    if (confirm(`${trainer.name} 트레이너를 비활성화하시겠습니까?`)) {
      deactivateMutation.mutate(String(trainer.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          트레이너 추가
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-600">
                이름
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                이메일
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                연락처
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                상태
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
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !trainers?.length ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-slate-400"
                >
                  등록된 트레이너가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              trainers.map((trainer) => (
                <TableRow
                  key={trainer.id}
                  className={
                    trainer.is_active
                      ? "hover:bg-slate-50"
                      : "bg-slate-50 opacity-60"
                  }
                >
                  <TableCell className="font-medium text-slate-900">
                    {trainer.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {trainer.email}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {trainer.phone || "-"}
                  </TableCell>
                  <TableCell>
                    {trainer.is_active ? (
                      <Badge
                        variant="outline"
                        className="text-green-700 border-green-200 bg-green-50"
                      >
                        활성
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-slate-500 border-slate-200 bg-slate-100"
                      >
                        비활성
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {trainer.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(trainer)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 gap-1"
                        disabled={deactivateMutation.isPending}
                      >
                        <UserX className="w-3 h-3" />
                        비활성화
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>트레이너 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="홍길동"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>이메일 *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="trainer@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>비밀번호 * (6자 이상)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="비밀번호"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>연락처</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "생성 중..." : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
