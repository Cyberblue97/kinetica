"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi, paymentsApi, trainersApi } from "@/services/api";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarPlus, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import type { Session, MemberPackage, User } from "@/types";

// ── Timeline constants ──────────────────────────────────────────
const HOUR_START = 6;   // 06:00
const HOUR_END = 22;    // 22:00
const HOUR_HEIGHT = 60; // px per hour

const statusConfig: Record<string, {
  label: string;
  cardBg: string; cardBorder: string; cardText: string;
  badgeBg: string; badgeText: string;
}> = {
  scheduled: {
    label: "예정",
    cardBg: "bg-blue-50",   cardBorder: "border-blue-300",  cardText: "text-blue-900",
    badgeBg: "bg-blue-100", badgeText: "text-blue-700",
  },
  completed: {
    label: "완료",
    cardBg: "bg-emerald-50",   cardBorder: "border-emerald-300",  cardText: "text-emerald-900",
    badgeBg: "bg-emerald-100", badgeText: "text-emerald-700",
  },
  no_show: {
    label: "노쇼",
    cardBg: "bg-red-50",   cardBorder: "border-red-300",  cardText: "text-red-900",
    badgeBg: "bg-red-100", badgeText: "text-red-700",
  },
  cancelled: {
    label: "취소",
    cardBg: "bg-slate-50",   cardBorder: "border-slate-200",  cardText: "text-slate-400",
    badgeBg: "bg-slate-100", badgeText: "text-slate-400",
  },
};

type SessionForm = {
  member_id: string;
  member_package_id: string;
  trainer_id: string;
  scheduled_at: string;
  notes: string;
};

// ── Helper ──────────────────────────────────────────────────────
function sessionTopPx(session: Session): number {
  const d = new Date(session.scheduled_at);
  return (d.getHours() + d.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;
}

function sessionHeightPx(session: Session): number {
  return Math.max(((session.duration_minutes || 60) / 60) * HOUR_HEIGHT, 36);
}

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const gridRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // 카드 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  const [form, setForm] = useState<SessionForm>({
    member_id: "",
    member_package_id: "",
    trainer_id: "",
    scheduled_at: `${todayStr}T09:00`,
    notes: "",
  });

  // ── Queries ────────────────────────────────────────────────────
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

  // ── Mutations ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("수업이 예약되었습니다");
      setDialogOpen(false);
      setForm({
        member_id: "",
        member_package_id: "",
        trainer_id: "",
        scheduled_at: `${selectedDate}T09:00`,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-sessions"] });
      toast.success("상태가 변경되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-today-sessions"] });
      toast.success("수업이 삭제되었습니다");
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  // ── Handlers ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // datetime-local input은 로컬 시간 "YYYY-MM-DDTHH:mm" 형식
    // toISOString()은 UTC 변환(-9h)이 일어나므로 사용 금지 → 그대로 전송
    const localDatetime = form.scheduled_at.length === 16
      ? form.scheduled_at + ":00"
      : form.scheduled_at;
    createMutation.mutate({
      member_id: form.member_id,
      member_package_id: form.member_package_id,
      trainer_id: form.trainer_id,
      scheduled_at: localDatetime,
      notes: form.notes || undefined,
    });
  };

  const handlePackageSelect = (packageId: string) => {
    const mp = memberPackages?.find((p) => String(p.id) === packageId);
    setForm((prev) => ({
      ...prev,
      member_id: mp ? String(mp.member_id) : prev.member_id,
      member_package_id: packageId,
    }));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't open dialog if clicking on a session card
    if ((e.target as HTMLElement).closest("[data-session-card]")) return;
    const rect = gridRef.current!.getBoundingClientRect();
    const scrollTop = gridRef.current!.scrollTop;
    const y = e.clientY - rect.top + scrollTop;
    const totalMin = (y / HOUR_HEIGHT) * 60 + HOUR_START * 60;
    const snapped = Math.round(totalMin / 30) * 30; // snap to 30 min
    const clamped = Math.max(HOUR_START * 60, Math.min((HOUR_END - 1) * 60 + 30, snapped));
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    setForm((prev) => ({ ...prev, scheduled_at: `${selectedDate}T${hh}:${mm}` }));
    setDialogOpen(true);
  };

  const goDay = (delta: number) => {
    const d = delta > 0 ? addDays(new Date(selectedDate), 1) : subDays(new Date(selectedDate), 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goDay(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 min-w-[160px] text-center">
            {format(new Date(selectedDate), "yyyy년 M월 d일 (EEE)", { locale: ko })}
          </div>
          <Button variant="outline" size="icon" onClick={() => goDay(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {selectedDate !== todayStr && (
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayStr)}>
              오늘
            </Button>
          )}
        </div>
        <Button onClick={() => {
          setForm((prev) => ({ ...prev, scheduled_at: `${selectedDate}T09:00` }));
          setDialogOpen(true);
        }} className="gap-2">
          <CalendarPlus className="w-4 h-4" />
          수업 예약
        </Button>
      </div>

      {/* ── Timeline ── */}
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-1"
        ref={gridRef}
        onClick={handleTimelineClick}
        style={{ cursor: "pointer" }}
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: `${totalHeight}px`, marginLeft: "56px" }}
          >
            {/* ── Hour rows (alternating bg + border) ── */}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              />
            ))}

            {/* ── Hour markers ── */}
            {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: `${i * HOUR_HEIGHT}px` }}
              >
                <span className="absolute text-right text-[11px] text-slate-400 -mt-2 pr-3 select-none"
                  style={{ left: "-56px", width: "52px" }}>
                  {String(HOUR_START + i).padStart(2, "0")}:00
                </span>
                <div className="w-full border-t border-slate-200" />
              </div>
            ))}

            {/* ── 30-min half-hour lines ── */}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div
                key={`half-${i}`}
                className="absolute left-0 right-0 border-t border-slate-100 border-dashed pointer-events-none"
                style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
              />
            ))}

            {/* ── Empty state ── */}
            {!sessions?.length && (
              <div
                className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                style={{ top: `${(10 - HOUR_START) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT * 2}px` }}
              >
                <p className="text-sm text-slate-400">빈 시간대를 클릭해 수업을 예약하세요</p>
              </div>
            )}

            {/* ── Session cards ── */}
            {(sessions || []).map((session) => {
              const top = sessionTopPx(session);
              const height = sessionHeightPx(session);
              const sc = statusConfig[session.status] ?? statusConfig.scheduled;
              const mp = memberPackages?.find(
                (p) => String(p.id) === String(session.member_package_id)
              );
              const pkgName = mp?.package?.name;
              const timeLabel = format(new Date(session.scheduled_at), "HH:mm");

              return (
                <div
                  key={session.id}
                  data-session-card
                  className={`absolute left-2 right-3 rounded-lg border shadow-sm
                    ${sc.cardBg} ${sc.cardBorder} cursor-default`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col h-full px-2.5 py-1.5 gap-0.5">
                    {/* Top row: time + status badge + menu */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-medium ${sc.cardText} opacity-70`}>
                        {timeLabel}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sc.badgeBg} ${sc.badgeText}`}>
                          {sc.label}
                        </span>
                        {/* ⋮ 메뉴 — 모든 상태에서 표시 */}
                        <div className="relative">
                          <button
                            className={`p-0.5 rounded hover:bg-black/10 ${sc.cardText}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              setOpenMenuId(openMenuId === session.id ? null : session.id);
                            }}
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                          {openMenuId === session.id && (
                            <div
                              className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[80px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {session.status === "scheduled" && (<>
                                <button
                                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-medium"
                                  onClick={() => { statusMutation.mutate({ id: session.id, status: "completed" }); setOpenMenuId(null); }}
                                >완료</button>
                                <button
                                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-red-50 text-red-600 font-medium"
                                  onClick={() => { statusMutation.mutate({ id: session.id, status: "no_show" }); setOpenMenuId(null); }}
                                >노쇼</button>
                                <button
                                  className="w-full text-left text-xs px-3 py-1.5 hover:bg-slate-50 text-slate-500 font-medium"
                                  onClick={() => { statusMutation.mutate({ id: session.id, status: "cancelled" }); setOpenMenuId(null); }}
                                >취소</button>
                                <div className="border-t border-slate-100 my-1" />
                              </>)}
                              <button
                                className="w-full text-left text-xs px-3 py-1.5 hover:bg-red-50 text-red-500 font-medium"
                                onClick={() => {
                                  if (window.confirm("수업을 삭제하시겠습니까?")) {
                                    deleteMutation.mutate(session.id);
                                    setOpenMenuId(null);
                                  }
                                }}
                              >삭제</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Member name */}
                    <p className={`text-xs font-bold truncate leading-tight ${sc.cardText}`}>
                      {session.member?.name || "—"}
                    </p>
                    {/* Trainer · Package */}
                    {height >= 54 && (
                      <p className={`text-[11px] truncate leading-tight opacity-60 ${sc.cardText}`}>
                        {session.trainer?.name}
                        {pkgName ? ` · ${pkgName}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Session Dialog ── */}
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
                      <SelectItem key={mp.id} value={String(mp.id)}>
                        {mp.member?.name || "?"} —{" "}
                        {mp.package?.name || "패키지"} ({mp.sessions_remaining}회 남음)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>트레이너 *</Label>
              <Select
                value={form.trainer_id}
                onValueChange={(v) => setForm((prev) => ({ ...prev, trainer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="트레이너 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(trainers || []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>일시 *</Label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))
                }
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
