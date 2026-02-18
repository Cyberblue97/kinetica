"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { packagesApi } from "@/services/api";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import type { Package } from "@/types";

const emptyForm = {
  name: "",
  total_sessions: "",
  validity_days: "",
  price: "",
};

export default function PackagesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Package | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: packages, isLoading } = useQuery<Package[]>({
    queryKey: ["packages"],
    queryFn: () => packagesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: packagesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("패키지가 추가되었습니다");
      closeDialog();
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Package> }) =>
      packagesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("패키지가 수정되었습니다");
      closeDialog();
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const deleteMutation = useMutation({
    mutationFn: packagesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success("패키지가 삭제되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (pkg: Package) => {
    setEditTarget(pkg);
    setForm({
      name: pkg.name,
      total_sessions: String(pkg.total_sessions),
      validity_days: String(pkg.validity_days),
      price: String(pkg.price),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      total_sessions: Number(form.total_sessions),
      validity_days: Number(form.validity_days),
      price: Number(form.price),
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("패키지를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <PackagePlus className="w-4 h-4" />
          패키지 추가
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-600">
                패키지명
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                총 세션수
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                유효기간 (일)
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                가격
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
            ) : !packages?.length ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-slate-400"
                >
                  등록된 패키지가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">
                    {pkg.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {pkg.total_sessions}회
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {pkg.validity_days}일
                  </TableCell>
                  <TableCell className="text-slate-900 font-medium">
                    {pkg.price.toLocaleString()}원
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(pkg)}
                        className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pkg.id)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 gap-1"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "패키지 수정" : "패키지 추가"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>패키지명 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: PT 10회권"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>총 세션수 *</Label>
              <Input
                type="number"
                min="1"
                value={form.total_sessions}
                onChange={(e) =>
                  setForm({ ...form, total_sessions: e.target.value })
                }
                placeholder="10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>유효기간 (일) *</Label>
              <Input
                type="number"
                min="1"
                value={form.validity_days}
                onChange={(e) =>
                  setForm({ ...form, validity_days: e.target.value })
                }
                placeholder="90"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>가격 (원) *</Label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="500000"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중..." : editTarget ? "저장" : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
