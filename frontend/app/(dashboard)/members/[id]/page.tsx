"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  membersApi,
  paymentsApi,
  packagesApi,
  trainersApi,
} from "@/services/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, UserX } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Member, Session, MemberPackage, Package, User } from "@/types";
import Link from "next/link";

const sessionStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  scheduled: { label: "예정", className: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", className: "bg-green-100 text-green-700" },
  no_show: { label: "노쇼", className: "bg-red-100 text-red-700" },
  cancelled: { label: "취소", className: "bg-slate-100 text-slate-600" },
};

const paymentStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  paid: { label: "결제완료", className: "bg-green-100 text-green-700" },
  pending: { label: "미결제", className: "bg-yellow-100 text-yellow-700" },
  overdue: { label: "연체", className: "bg-red-100 text-red-700" },
};

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Member>>({});
  const [pkgForm, setPkgForm] = useState({
    package_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    amount_paid: "",
    payment_method: "card",
    payment_status: "paid",
  });

  const { data: member, isLoading } = useQuery<Member>({
    queryKey: ["member", id],
    queryFn: () => membersApi.getById(id).then((r) => r.data),
  });

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["member-sessions", id],
    queryFn: () => membersApi.getSessions(id).then((r) => r.data),
  });

  const { data: memberPackages } = useQuery<MemberPackage[]>({
    queryKey: ["member-packages", id],
    queryFn: () => paymentsApi.getByMember(id).then((r) => r.data),
  });

  const { data: packages } = useQuery<Package[]>({
    queryKey: ["packages"],
    queryFn: () => packagesApi.getAll().then((r) => r.data),
  });

  const { data: trainers } = useQuery<User[]>({
    queryKey: ["trainers"],
    queryFn: () => trainersApi.getAll().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Member>) => membersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      toast.success("회원 정보가 수정되었습니다");
      setEditOpen(false);
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const addPackageMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-packages", id] });
      toast.success("패키지가 추가되었습니다");
      setPackageDialogOpen(false);
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const deactivateMemberMutation = useMutation({
    mutationFn: () => membersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("회원이 비활성화되었습니다");
      router.push("/members");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const deletePackageMutation = useMutation({
    mutationFn: (packageId: string) => paymentsApi.delete(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-packages", id] });
      toast.success("패키지가 삭제되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const openEdit = () => {
    if (member) {
      setEditForm({
        name: member.name,
        phone: member.phone,
        email: member.email,
        notes: member.notes,
        trainer_id: member.trainer_id,
      });
      setEditOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(editForm);
  };

  const handlePackageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPackageMutation.mutate({
      member_id: id,
      package_id: pkgForm.package_id,
      start_date: pkgForm.start_date,
      price_paid: Number(pkgForm.amount_paid),
      payment_method: pkgForm.payment_method as MemberPackage["payment_method"],
      payment_status: pkgForm.payment_status as MemberPackage["payment_status"],
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!member) {
    return <p className="text-slate-500">회원을 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/members">
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              목록으로
            </Button>
          </Link>
          <h2 className="text-xl font-bold text-slate-900">{member.name}</h2>
          <Badge
            variant="secondary"
            className={
              member.is_active
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-500"
            }
          >
            {member.is_active ? "활성" : "비활성"}
          </Badge>
        </div>
        {member.is_active && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`${member.name} 회원을 비활성화하시겠습니까?`)) {
                deactivateMemberMutation.mutate();
              }
            }}
            disabled={deactivateMemberMutation.isPending}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          >
            <UserX className="w-4 h-4" />
            회원 비활성화
          </Button>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="packages">패키지/결제</TabsTrigger>
          <TabsTrigger value="sessions">수업 이력</TabsTrigger>
        </TabsList>

        {/* Tab 1: Basic info */}
        <TabsContent value="info" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">기본 정보</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={openEdit}
                className="gap-2"
              >
                <Pencil className="w-3 h-3" />
                수정
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <dt className="text-sm text-slate-500">이름</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {member.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">연락처</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {member.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">이메일</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {member.email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">담당 트레이너</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {member.trainer?.name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">등록일</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {format(new Date(member.created_at), "yyyy년 MM월 dd일", {
                      locale: ko,
                    })}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-slate-500">메모</dt>
                  <dd className="text-sm font-medium text-slate-900 mt-1">
                    {member.notes || "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Packages */}
        <TabsContent value="packages" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setPackageDialogOpen(true)} size="sm">
                패키지 추가
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold text-slate-600">
                      패키지명
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      시작일
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      만료일
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      잔여 세션
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      결제 금액
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      결제 상태
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!memberPackages?.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-slate-400"
                      >
                        등록된 패키지가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    memberPackages.map((mp) => {
                      const ps = paymentStatusConfig[mp.payment_status];
                      return (
                        <TableRow key={mp.id}>
                          <TableCell className="font-medium">
                            {mp.package?.name || "—"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(mp.start_date), "yyyy.MM.dd")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(mp.expiry_date), "yyyy.MM.dd")}
                          </TableCell>
                          <TableCell>{mp.sessions_remaining}회</TableCell>
                          <TableCell>
                            {mp.price_paid.toLocaleString()}원
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${ps?.className}`}
                            >
                              {ps?.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("패키지를 삭제하시겠습니까?")) {
                                  deletePackageMutation.mutate(String(mp.id));
                                }
                              }}
                              disabled={deletePackageMutation.isPending}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Sessions */}
        <TabsContent value="sessions" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-600">
                    일시
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {!sessions?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-slate-400"
                    >
                      수업 이력이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => {
                    const sc = sessionStatusConfig[session.status];
                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          {format(
                            new Date(session.scheduled_at),
                            "yyyy.MM.dd HH:mm",
                            { locale: ko }
                          )}
                        </TableCell>
                        <TableCell>{session.trainer?.name || "—"}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${sc?.className}`}
                          >
                            {sc?.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {session.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>회원 정보 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={editForm.name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>연락처</Label>
              <Input
                value={editForm.phone || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input
                type="email"
                value={editForm.email || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>담당 트레이너</Label>
              <Select
                value={editForm.trainer_id || ""}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, trainer_id: v })
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
              <Label>메모</Label>
              <Textarea
                value={editForm.notes || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>패키지 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePackageSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>패키지 *</Label>
              <Select
                value={pkgForm.package_id}
                onValueChange={(v) => setPkgForm({ ...pkgForm, package_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="패키지 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(packages || []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.total_sessions}회, {p.validity_days}일)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={pkgForm.start_date}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, start_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>결제 금액</Label>
              <Input
                type="number"
                value={pkgForm.amount_paid}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, amount_paid: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>결제 수단</Label>
              <Select
                value={pkgForm.payment_method}
                onValueChange={(v) =>
                  setPkgForm({ ...pkgForm, payment_method: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">현금</SelectItem>
                  <SelectItem value="card">카드</SelectItem>
                  <SelectItem value="transfer">계좌이체</SelectItem>
                  <SelectItem value="online_mock">온라인(목업)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>결제 상태</Label>
              <Select
                value={pkgForm.payment_status}
                onValueChange={(v) =>
                  setPkgForm({ ...pkgForm, payment_status: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">결제완료</SelectItem>
                  <SelectItem value="pending">미결제</SelectItem>
                  <SelectItem value="overdue">연체</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPackageDialogOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={addPackageMutation.isPending}>
                {addPackageMutation.isPending ? "추가 중..." : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
