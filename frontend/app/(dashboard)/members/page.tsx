"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { membersApi, trainersApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";
import type { Member, User } from "@/types";

export default function MembersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    trainer_id: "",
  });

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: () => membersApi.getAll().then((r) => r.data),
  });

  const { data: trainers } = useQuery<User[]>({
    queryKey: ["trainers"],
    queryFn: () => trainersApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: membersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("회원이 추가되었습니다");
      setDialogOpen(false);
      setForm({ name: "", phone: "", email: "", notes: "", trainer_id: "" });
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const filtered = (members || []).filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      notes: form.notes || undefined,
      trainer_id: form.trainer_id || undefined,
    });
  };

  const totalRemaining = (m: Member) =>
    (m.member_packages || []).reduce((sum, p) => sum + p.sessions_remaining, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="이름 또는 연락처 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          회원 추가
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
                연락처
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                담당 트레이너
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                상태
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                잔여 세션
              </TableHead>
              <TableHead className="font-semibold text-slate-600">
                액션
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-slate-400"
                >
                  {search ? "검색 결과가 없습니다" : "등록된 회원이 없습니다"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => (
                <TableRow key={member.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">
                    {member.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {member.phone}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {member.trainer?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        member.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                      }
                    >
                      {member.is_active ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {totalRemaining(member)}회
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/members/${member.id}`)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      상세보기
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>회원 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">연락처 *</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer">담당 트레이너</Label>
              <Select
                value={form.trainer_id}
                onValueChange={(v) => setForm({ ...form, trainer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="트레이너 선택 (선택사항)" />
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
              <Label htmlFor="notes">메모</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
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
                {createMutation.isPending ? "추가 중..." : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
