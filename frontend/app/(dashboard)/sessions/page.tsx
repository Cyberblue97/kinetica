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
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, User, Dumbbell, FileText } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import type { Session, MemberPackage, User } from "@/types";

// ── Timeline constants ──────────────────────────────────────────
const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_HEIGHT = 60; // px per hour

const statusConfig: Record<string, {
  label: string;
  cardBg: string; cardBorder: string; cardText: string;
  badgeBg: string; badgeText: string;
}> = {
  scheduled: {
    label: "예정",
    cardBg: "bg-blue-50",    cardBorder: "border-blue-300",    cardText: "text-blue-900",
    badgeBg: "bg-blue-100",  badgeText: "text-blue-700",
  },
  completed: {
    label: "완료",
    cardBg: "bg-emerald-50",   cardBorder: "border-emerald-300",   cardText: "text-emerald-900",
    badgeBg: "bg-emerald-100", badgeText: "text-emerald-700",
  },
  no_show: {
    label: "노쇼",
    cardBg: "bg-red-50",    cardBorder: "border-red-300",    cardText: "text-red-900",
    badgeBg: "bg-red-100",  badgeText: "text-red-700",
  },
  cancelled: {
    label: "취소",
    cardBg: "bg-slate-50",    cardBorder: "border-slate-200",    cardText: "text-slate-400",
    badgeBg: "bg-slate-100",  badgeText: "text-slate-400",
  },
};

type SessionForm = {
  member_id: string;
  member_package_id: string;
  trainer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string;
};

function sessionTopPx(session: Session): number {
  const d = new Date(session.scheduled_at);
  return (d.getHours() + d.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;
}

function sessionHeightPx(session: Session): number {
  return Math.max(((session.duration_minutes || 60) / 60) * HOUR_HEIGHT, 28);
}

// ── Duration options ────────────────────────────────────────────
const DURATION_OPTIONS = [
  { value: 30, label: "30분", sub: "0.5세션" },
  { value: 60, label: "60분", sub: "1세션" },
];

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const gridRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [form, setForm] = useState<SessionForm>({
    member_id: "",
    member_package_id: "",
    trainer_id: "",
    scheduled_at: `${todayStr}T09:00`,
    duration_minutes: 60,
    notes: "",
  });

  // ① 현재 시간 1분마다 갱신
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ③ 현재 시간대로 자동 스크롤 (오늘 날짜일 때만)
  useEffect(() => {
    if (!gridRef.current || selectedDate !== todayStr) return;
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h >= HOUR_START && h < HOUR_END) {
      const scrollTo = Math.max(0, (h + m / 60 - HOUR_START - 1.5) * HOUR_HEIGHT);
      gridRef.current.scrollTop = scrollTo;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-today-sessions"] });
  };

  const createMutation = useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => {
      invalidateSessions();
      toast.success("수업이 예약되었습니다");
      setBookingOpen(false);
      setForm({
        member_id: "", member_package_id: "", trainer_id: "",
        scheduled_at: `${selectedDate}T09:00`, duration_minutes: 60, notes: "",
      });
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      sessionsApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      invalidateSessions();
      toast.success("상태가 변경되었습니다");
      // 상세 모달 내 세션 상태 동기화
      setDetailSession((prev) => prev ? { ...prev, status: status as Session["status"] } : null);
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      invalidateSessions();
      toast.success("수업이 삭제되었습니다");
      setDetailSession(null);
    },
    onError: () => toast.error("오류가 발생했습니다"),
  });

  // ── Handlers ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const localDatetime = form.scheduled_at.length === 16
      ? form.scheduled_at + ":00"
      : form.scheduled_at;
    createMutation.mutate({
      member_id: form.member_id,
      member_package_id: form.member_package_id,
      trainer_id: form.trainer_id,
      scheduled_at: localDatetime,
      duration_minutes: form.duration_minutes,
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
    if ((e.target as HTMLElement).closest("[data-session-card]")) return;
    const rect = gridRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top + gridRef.current!.scrollTop;
    const totalMin = (y / HOUR_HEIGHT) * 60 + HOUR_START * 60;
    const snapped = Math.round(totalMin / 30) * 30;
    const clamped = Math.max(HOUR_START * 60, Math.min((HOUR_END - 1) * 60 + 30, snapped));
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    setForm((prev) => ({ ...prev, scheduled_at: `${selectedDate}T${hh}:${mm}` }));
    setBookingOpen(true);
  };

  const goDay = (delta: number) => {
    const d = delta > 0 ? addDays(new Date(selectedDate), 1) : subDays(new Date(selectedDate), 1);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  // ① 현재 시간선 위치
  const nowTop = (() => {
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h < HOUR_START || h >= HOUR_END) return null;
    return (h + m / 60 - HOUR_START) * HOUR_HEIGHT;
  })();

  // ⑤ 상세 모달에서 패키지명
  const detailPkg = detailSession
    ? memberPackages?.find((p) => String(p.id) === String(detailSession.member_package_id))
    : null;

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
          setBookingOpen(true);
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
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="relative" style={{ height: `${totalHeight}px`, marginLeft: "56px" }}>

            {/* ── Hour rows ── */}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div key={i}
                className={`absolute left-0 right-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              />
            ))}

            {/* ── Hour markers ── */}
            {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
              <div key={i} className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: `${i * HOUR_HEIGHT}px` }}>
                <span className="absolute text-right text-[11px] text-slate-400 -mt-2 pr-3 select-none"
                  style={{ left: "-56px", width: "52px" }}>
                  {String(HOUR_START + i).padStart(2, "0")}:00
                </span>
                <div className="w-full border-t border-slate-200" />
              </div>
            ))}

            {/* ── 30-min lines ── */}
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <div key={`h-${i}`}
                className="absolute left-0 right-0 border-t border-slate-100 border-dashed pointer-events-none"
                style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
              />
            ))}

            {/* ① 현재 시간선 */}
            {selectedDate === todayStr && nowTop !== null && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: `${nowTop}px` }}>
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!sessions?.length && (
              <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                style={{ top: `${(10 - HOUR_START) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT * 2}px` }}>
                <p className="text-sm text-slate-400">빈 시간대를 클릭해 수업을 예약하세요</p>
              </div>
            )}

            {/* ── Session cards ── */}
            {(sessions || []).map((session) => {
              const top = sessionTopPx(session);
              const height = sessionHeightPx(session);
              const sc = statusConfig[session.status] ?? statusConfig.scheduled;
              const timeLabel = format(new Date(session.scheduled_at), "HH:mm");
              const mp = memberPackages?.find((p) => String(p.id) === String(session.member_package_id));

              return (
                <div key={session.id} data-session-card
                  className={`absolute left-2 right-3 rounded-lg border shadow-sm
                    ${sc.cardBg} ${sc.cardBorder} cursor-pointer hover:brightness-[0.97] transition-all`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={(e) => { e.stopPropagation(); setDetailSession(session); }}
                >
                  <div className="flex flex-col h-full px-2.5 py-1.5 gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-medium ${sc.cardText} opacity-70`}>
                        {timeLabel} · {session.duration_minutes}분
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sc.badgeBg} ${sc.badgeText}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className={`text-xs font-bold truncate leading-tight ${sc.cardText}`}>
                      {session.member?.name || "—"}
                    </p>
                    {height >= 54 && (
                      <p className={`text-[11px] truncate leading-tight opacity-60 ${sc.cardText}`}>
                        {session.trainer?.name}
                        {mp?.package?.name ? ` · ${mp.package.name}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ⑤ Session Detail Modal ── */}
      <Dialog open={!!detailSession} onOpenChange={(o) => { if (!o) setDetailSession(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailSession && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                  ${statusConfig[detailSession.status]?.badgeBg}
                  ${statusConfig[detailSession.status]?.badgeText}`}>
                  {statusConfig[detailSession.status]?.label}
                </span>
              )}
              수업 상세
            </DialogTitle>
          </DialogHeader>
          {detailSession && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold">{detailSession.member?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Dumbbell className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{detailSession.trainer?.name}</span>
                {detailPkg?.package?.name && (
                  <span className="text-slate-400">· {detailPkg.package.name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {format(new Date(detailSession.scheduled_at), "yyyy년 M월 d일 HH:mm", { locale: ko })}
                </span>
                <span className="text-slate-400">({detailSession.duration_minutes}분)</span>
              </div>
              {detailSession.notes && (
                <div className="flex items-start gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-xs">{detailSession.notes}</span>
                </div>
              )}

              {/* Status actions */}
              {detailSession.status === "scheduled" && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="outline"
                    className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => statusMutation.mutate({ id: detailSession.id, status: "completed" })}>
                    완료
                  </Button>
                  <Button size="sm" variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => statusMutation.mutate({ id: detailSession.id, status: "no_show" })}>
                    노쇼
                  </Button>
                  <Button size="sm" variant="outline"
                    className="flex-1 text-slate-500 border-slate-200 hover:bg-slate-50"
                    onClick={() => statusMutation.mutate({ id: detailSession.id, status: "cancelled" })}>
                    취소
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 mr-auto"
              onClick={() => {
                if (window.confirm("수업을 삭제하시겠습니까?")) {
                  deleteMutation.mutate(detailSession!.id);
                }
              }}>
              삭제
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDetailSession(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Booking Dialog ── */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>수업 예약</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>회원 / 패키지 *</Label>
              <Select value={form.member_package_id} onValueChange={handlePackageSelect}>
                <SelectTrigger><SelectValue placeholder="패키지 선택" /></SelectTrigger>
                <SelectContent>
                  {(memberPackages || []).filter((mp) => mp.sessions_remaining > 0).map((mp) => (
                    <SelectItem key={mp.id} value={String(mp.id)}>
                      {mp.member?.name || "?"} — {mp.package?.name || "패키지"} ({mp.sessions_remaining}회 남음)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>트레이너 *</Label>
              <Select value={form.trainer_id} onValueChange={(v) => setForm((p) => ({ ...p, trainer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="트레이너 선택" /></SelectTrigger>
                <SelectContent>
                  {(trainers || []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>일시 *</Label>
              <input type="datetime-local" value={form.scheduled_at} required
                onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* ② 수업 시간 선택 */}
            <div className="space-y-2">
              <Label>수업 시간</Label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors
                      ${form.duration_minutes === opt.value
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    onClick={() => setForm((p) => ({ ...p, duration_minutes: opt.value }))}>
                    {opt.label}
                    <span className={`block text-[11px] font-normal mt-0.5
                      ${form.duration_minutes === opt.value ? "text-blue-100" : "text-slate-400"}`}>
                      {opt.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>노트</Label>
              <Textarea value={form.notes} rows={2}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBookingOpen(false)}>취소</Button>
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
