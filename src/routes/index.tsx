import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Droplets,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import {
  getReportDateRange,
  getSlotLabel,
  READING_SLOTS,
  summarizeReadings,
  validateReading,
  type GlucoseReading,
  type ReadingSlot,
  type ReportPeriod,
} from "@/lib/glucose";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sweety — Your blood glucose journal" },
      {
        name: "description",
        content: "A private, thoughtful journal for blood glucose readings and personal reports.",
      },
      { property: "og:title", content: "Sweety — Your blood glucose journal" },
      {
        property: "og:description",
        content: "A private, thoughtful journal for blood glucose readings and personal reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SweetyHome,
});

type Profile = { full_name: string; display_name: string | null; timezone: string };

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", options ?? { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function getTodayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SweetyHome() {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const [today, setToday] = useState("");
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [profile, setProfile] = useState<Profile>({ full_name: "", display_name: "", timezone: "UTC" });
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState<"journal" | "reports">("journal");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [readingDialogOpen, setReadingDialogOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<GlucoseReading | null>(null);
  const [readingDate, setReadingDate] = useState("");
  const [readingSlot, setReadingSlot] = useState<ReadingSlot>("morning");
  const [readingValue, setReadingValue] = useState("");
  const [readingError, setReadingError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GlucoseReading | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("daily");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    const date = localDateString();
    setToday(date);
    setReportDate(date);
  }, []);

  useEffect(() => {
    if (!user) {
      setReadings([]);
      return;
    }
    let active = true;
    setIsLoading(true);
    void Promise.all([
      supabase
        .from("glucose_readings")
        .select("id, reading_date, time_slot, value")
        .eq("user_id", user.id)
        .order("reading_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("full_name, display_name, timezone").eq("id", user.id).maybeSingle(),
    ]).then(([readingsResult, profileResult]) => {
      if (!active) return;
      if (readingsResult.error) {
        toast.error("Your readings couldn't be loaded. Please try again.");
      } else {
        setReadings(readingsResult.data ?? []);
      }
      if (profileResult.data) setProfile(profileResult.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const todayReadings = useMemo(
    () => readings.filter((reading) => reading.reading_date === today),
    [readings, today],
  );
  const todayMetrics = useMemo(() => summarizeReadings(todayReadings), [todayReadings]);
  const reportRange = useMemo(
    () => getReportDateRange(reportPeriod, reportDate),
    [reportDate, reportPeriod],
  );
  const reportReadings = useMemo(() => {
    if (!reportRange) return [];
    return readings.filter(
      (reading) => reading.reading_date >= reportRange.start && reading.reading_date <= reportRange.end,
    );
  }, [readings, reportRange]);
  const reportMetrics = useMemo(() => summarizeReadings(reportReadings), [reportReadings]);
  const reportDates = useMemo(() => {
    if (!reportRange) return [];
    const dates: string[] = [];
    const cursor = new Date(`${reportRange.start}T12:00:00`);
    const end = new Date(`${reportRange.end}T12:00:00`);
    while (cursor <= end) {
      dates.push(localDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [reportRange]);

  function startReading(reading?: GlucoseReading, suggestedSlot?: ReadingSlot) {
    setEditingReading(reading ?? null);
    setReadingDate(reading?.reading_date ?? today);
    setReadingSlot(
      (reading?.time_slot as ReadingSlot | undefined) ??
        suggestedSlot ??
        READING_SLOTS.find((slot) => !todayReadings.some((item) => item.time_slot === slot.id))?.id ??
        "morning",
    );
    setReadingValue(reading ? String(reading.value) : "");
    setReadingError("");
    setReadingDialogOpen(true);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: { full_name: authName.trim(), display_name: authName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Your journal is ready.");
        } else {
          setAuthNotice("Check your inbox for a confirmation link to finish creating your account.");
          setAuthPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't complete that request.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSocialSignIn(provider: "google" | "lovable") {
    setAuthError("");
    setAuthBusy(true);
    const { error } = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  }

  async function handleReadingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const errorMessage = validateReading(
      readingValue,
      readingDate,
      readingSlot,
      readings,
      today,
      editingReading?.id,
    );
    if (errorMessage) {
      setReadingError(errorMessage);
      return;
    }

    const value = Number(readingValue);
    const result = editingReading
      ? await supabase
          .from("glucose_readings")
          .update({ reading_date: readingDate, time_slot: readingSlot, value })
          .eq("id", editingReading.id)
          .eq("user_id", user.id)
      : await supabase
          .from("glucose_readings")
          .insert({ user_id: user.id, reading_date: readingDate, time_slot: readingSlot, value });

    if (result.error) {
      setReadingError(result.error.message.includes("4 readings")
        ? "You can add only 4 readings per day."
        : result.error.message.includes("unique")
          ? `You already have an ${getSlotLabel(readingSlot)} reading for this date.`
          : "This reading couldn't be saved. Please try again.");
      return;
    }
    setReadingDialogOpen(false);
    toast.success(editingReading ? "Reading updated." : "Reading saved.");
    const { data, error } = await supabase
      .from("glucose_readings")
      .select("id, reading_date, time_slot, value")
      .eq("user_id", user.id)
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Your journal may take a moment to refresh.");
    else setReadings(data ?? []);
  }

  async function handleDeleteReading() {
    if (!user || !deleteTarget) return;
    const { error } = await supabase
      .from("glucose_readings")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("That reading couldn't be deleted. Please try again.");
      return;
    }
    setReadings((current) => current.filter((reading) => reading.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Reading removed.");
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setProfileBusy(true);
    const savedProfile = {
      id: user.id,
      full_name: profile.full_name.trim(),
      display_name: profile.display_name?.trim() || null,
      timezone: profile.timezone.trim() || "UTC",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(savedProfile);
    setProfileBusy(false);
    if (error) {
      toast.error("Your profile couldn't be saved. Please try again.");
      return;
    }
    setProfile(savedProfile);
    setProfileDialogOpen(false);
    toast.success("Profile updated.");
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Sign out didn't finish. Please try again.");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Droplets className="size-5 text-primary" aria-hidden="true" />
          <span className="font-display text-xl text-foreground">sweety</span>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1fr_0.85fr]">
        <section className="flex flex-col px-6 py-6 sm:px-10 lg:px-14">
          <a href="/" className="flex w-fit items-center gap-2.5" aria-label="Sweety home">
            <Droplets className="size-6 text-primary" aria-hidden="true" />
            <span className="font-display text-2xl">sweety</span>
          </a>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">
            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-primary">A quieter way to keep track</p>
              <h1 className="font-display text-4xl leading-tight">Your readings, in one place.</h1>
              <p className="mt-3 text-muted-foreground">Sign in to your private journal, or create one to get started.</p>
            </div>

            <div className="mb-6 grid grid-cols-2 border-b border-border">
              <Button
                type="button"
                variant="ghost"
                className={`h-11 rounded-none border-b-2 ${authMode === "signin" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
                onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthNotice(""); }}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`h-11 rounded-none border-b-2 ${authMode === "signup" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
                onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthNotice(""); }}
              >
                Create account
              </Button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Your name</Label>
                  <Input id="auth-name" autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} required />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email address</Label>
                <Input id="auth-email" type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input id="auth-password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} required />
              </div>
              {authError ? <Alert variant="destructive"><AlertDescription>{authError}</AlertDescription></Alert> : null}
              {authNotice ? <Alert><Check className="size-4" aria-hidden="true" /><AlertDescription>{authNotice}</AlertDescription></Alert> : null}
              <Button className="w-full" type="submit" disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "signup" ? "Create your journal" : "Sign in"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" disabled={authBusy} onClick={() => void handleSocialSignIn("google")}>Google</Button>
              <Button variant="outline" type="button" disabled={authBusy} onClick={() => void handleSocialSignIn("lovable")}>Lovable</Button>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">Your journal is private to your account.</p>
          </div>
        </section>

        <aside className="relative hidden min-h-full overflow-hidden border-l border-border bg-accent/45 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4 text-primary" aria-hidden="true" /> A steady record, day by day</div>
          <div className="mx-auto w-full max-w-md py-16">
            <div className="mb-9 flex size-16 items-center justify-center border border-primary/20 bg-background text-primary">
              <Droplets className="size-7" aria-hidden="true" />
            </div>
            <p className="font-display text-4xl leading-snug">Small notes can make a clearer picture.</p>
            <p className="mt-5 max-w-sm leading-7 text-muted-foreground">A simple space for the numbers you want to remember, and the patterns worth bringing to your next care visit.</p>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
            <span>Made for your day-to-day</span>
            <span>mg/dL</span>
          </div>
        </aside>
      </main>
    );
  }

  const firstName = (profile.display_name || profile.full_name || user.email?.split("@")[0] || "there").split(" ")[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Sweety journal">
            <Droplets className="size-5 text-primary" aria-hidden="true" />
            <span className="font-display text-2xl">sweety</span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <Button variant={page === "journal" ? "secondary" : "ghost"} size="sm" onClick={() => setPage("journal")}>Journal</Button>
            <Button variant={page === "reports" ? "secondary" : "ghost"} size="sm" onClick={() => setPage("reports")}>Reports</Button>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Profile settings" onClick={() => setProfileDialogOpen(true)}>
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="text-xs">{firstName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => void handleSignOut()}>
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-8 sm:pt-12">
        {page === "journal" ? (
          <>
            <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-sm font-medium text-primary">{getTodayGreeting()}, {firstName}</p>
                <h1 className="font-display text-4xl leading-tight sm:text-5xl">Your daily journal</h1>
                <p className="mt-2 text-muted-foreground">{today ? formatDate(today, { weekday: "long", month: "long", day: "numeric" }) : ""}</p>
              </div>
              <Button className="self-start sm:self-auto" onClick={() => startReading()} disabled={!today || todayReadings.length >= 4}>
                <Plus aria-hidden="true" /> Add a reading
              </Button>
            </section>

            <section className="mt-9 grid border-y border-border md:grid-cols-[1.5fr_1fr]" aria-label="Today’s glucose summary">
              <div className="py-7 md:pr-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Today at a glance</p>
                    <h2 className="mt-1 font-display text-2xl">Your numbers</h2>
                  </div>
                  <CalendarDays className="mt-1 size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <Metric label="Highest" value={todayMetrics.highest} />
                  <Metric label="Lowest" value={todayMetrics.lowest} />
                  <Metric label="Average" value={todayMetrics.average} />
                  <Metric label="Readings" value={`${todayMetrics.count} / 4`} unit="" />
                </div>
                {todayMetrics.count === 0 ? (
                  <div className="mt-7 flex min-h-28 flex-col items-center justify-center border border-dashed border-border px-5 text-center">
                    <p className="font-medium">A fresh page for today</p>
                    <p className="mt-1 text-sm text-muted-foreground">Your first reading will appear here.</p>
                  </div>
                ) : null}
              </div>
              <aside className="flex flex-col justify-center border-t border-border bg-accent/35 px-6 py-6 md:border-l md:border-t-0 md:px-8">
                <p className="text-xs font-semibold uppercase text-accent-foreground">A note for your next visit</p>
                <h2 className="mt-3 font-display text-2xl">Keep the little details together.</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">A consistent record makes it easier to look back and share what you’ve noticed with your care team.</p>
                <Button variant="outline" className="mt-5 w-fit gap-2 bg-background" onClick={() => setPage("reports")}>
                  Open reports <ArrowUpRight aria-hidden="true" />
                </Button>
              </aside>
            </section>

            <section className="mt-9" aria-label="Today’s readings">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{todayReadings.length} of 4 recorded</p>
                  <h2 className="mt-1 font-display text-2xl">Today’s readings</h2>
                </div>
                {isLoading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
              </div>
              <div className="mt-4 divide-y divide-border border-y border-border">
                {READING_SLOTS.map((slot) => {
                  const reading = todayReadings.find((item) => item.time_slot === slot.id);
                  return (
                    <div className="flex min-h-16 items-center justify-between gap-4 py-3" key={slot.id}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex size-9 shrink-0 items-center justify-center ${reading ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {reading ? <Check className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}
                        </span>
                        <div>
                          <p className="font-medium">{slot.shortLabel}{slot.id === "morning" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">fasting</span> : null}</p>
                          {reading ? <p className="text-xs text-muted-foreground">{getSlotLabel(slot.id)}</p> : null}
                        </div>
                      </div>
                      {reading ? (
                        <div className="flex items-center gap-2">
                          <p className="min-w-20 text-right font-display text-xl">{reading.value}<span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span></p>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${slot.shortLabel} reading`} onClick={() => startReading(reading)}><Pencil aria-hidden="true" /></Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${slot.shortLabel} reading`} onClick={() => setDeleteTarget(reading)}><Trash2 aria-hidden="true" /></Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => startReading(undefined, slot.id)} disabled={todayReadings.length >= 4}>Add</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {readings.some((reading) => reading.reading_date !== today) ? (
              <section className="mt-10" aria-label="Recent readings">
                <div className="flex items-end justify-between gap-4">
                  <div><p className="text-sm text-muted-foreground">Your personal record</p><h2 className="mt-1 font-display text-2xl">Recent readings</h2></div>
                  <Button variant="ghost" size="sm" onClick={() => setPage("reports")}>View reports <ArrowUpRight aria-hidden="true" /></Button>
                </div>
                <div className="mt-4 divide-y divide-border border-y border-border">
                  {readings.filter((reading) => reading.reading_date !== today).slice(0, 8).map((reading) => (
                    <div key={reading.id} className="flex items-center justify-between gap-4 py-3">
                      <div><p className="font-medium">{getSlotLabel(reading.time_slot)}</p><p className="text-sm text-muted-foreground">{formatDate(reading.reading_date)}</p></div>
                      <div className="flex items-center gap-2"><span className="font-display text-lg">{reading.value}<span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span></span><Button variant="ghost" size="icon" aria-label="Edit reading" onClick={() => startReading(reading)}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon" aria-label="Delete reading" onClick={() => setDeleteTarget(reading)}><Trash2 aria-hidden="true" /></Button></div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-sm font-medium text-primary">A look back</p>
                <h1 className="font-display text-4xl leading-tight sm:text-5xl">Your reports</h1>
                <p className="mt-2 text-muted-foreground">A clear view of the readings you’ve recorded.</p>
              </div>
              <div className="w-full sm:w-52">
                <Label htmlFor="report-date" className="mb-2 block">Choose a date</Label>
                <Input id="report-date" type="date" value={reportDate} max={today} onChange={(event) => setReportDate(event.target.value)} />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">
              {([
                ["daily", "Daily"],
                ["month_to_date", "Month to date"],
                ["previous_month", "Previous month"],
              ] as const).map(([period, label]) => (
                <Button key={period} variant={reportPeriod === period ? "secondary" : "ghost"} size="sm" onClick={() => setReportPeriod(period)}>{label}</Button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm text-muted-foreground">{reportPeriod === "daily" ? "Daily report" : reportPeriod === "month_to_date" ? "Month-to-date report" : "Monthly report"}</p><h2 className="mt-1 font-display text-2xl">{reportRange ? reportPeriod === "daily" ? formatDate(reportRange.start) : `${formatDate(reportRange.start, { day: "numeric", month: "short" })} – ${formatDate(reportRange.end)}` : "Select a date"}</h2></div>
              {reportPeriod === "daily" ? <Button onClick={() => startReading(undefined, "morning")}><Plus aria-hidden="true" /> Add a reading</Button> : null}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-5 border-y border-border py-6 sm:grid-cols-4">
              <Metric label="Highest" value={reportMetrics.highest} />
              <Metric label="Lowest" value={reportMetrics.lowest} />
              <Metric label="Average" value={reportMetrics.average} />
              <Metric label="Readings" value={reportMetrics.count} unit="" />
            </div>

            {reportMetrics.count === 0 ? (
              <div className="mt-7 flex min-h-40 flex-col items-center justify-center border border-dashed border-border px-5 text-center">
                <Activity className="mb-3 size-5 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Nothing recorded for this period yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Your readings will appear here when you add them.</p>
              </div>
            ) : (
              <>
                {reportPeriod !== "daily" && reportDates.length > 1 ? (
                  <section className="mt-8" aria-label="Daily averages">
                    <h3 className="font-display text-xl">Daily averages</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Average of readings recorded each day.</p>
                    <div className="mt-5 overflow-x-auto border-b border-border pb-3">
                      <div className="flex min-w-max items-end gap-2" style={{ height: 168 }}>
                        {reportDates.map((date) => {
                          const dayMetrics = summarizeReadings(reportReadings.filter((reading) => reading.reading_date === date));
                          const height = dayMetrics.average === null ? 0 : Math.max(8, Math.round((dayMetrics.average / Math.max(1, reportMetrics.highest ?? 1)) * 112));
                          return (
                            <div key={date} className="flex w-7 flex-col items-center justify-end gap-2" title={`${formatDate(date)}: ${dayMetrics.average ?? "No readings"}`}>
                              {dayMetrics.average !== null ? <div className="w-5 bg-primary/75" style={{ height }} aria-label={`${dayMetrics.average} mg/dL`} /> : <div className="h-px w-3 bg-border" />}
                              <span className="text-[10px] text-muted-foreground">{Number(date.slice(8)) % 5 === 0 || date === reportRange?.start ? Number(date.slice(8)) : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="mt-8" aria-label="Readings in this report">
                  <h3 className="font-display text-xl">{reportPeriod === "daily" ? "Readings for the day" : "Recorded readings"}</h3>
                  <div className="mt-4 divide-y divide-border border-y border-border">
                    {[...reportReadings].sort((a, b) => a.reading_date.localeCompare(b.reading_date) || a.time_slot.localeCompare(b.time_slot)).map((reading) => (
                      <div key={reading.id} className="flex items-center justify-between gap-4 py-3">
                        <div><p className="font-medium">{getSlotLabel(reading.time_slot)}</p><p className="text-sm text-muted-foreground">{formatDate(reading.reading_date)}</p></div>
                        <div className="flex items-center gap-2"><span className="font-display text-lg">{reading.value}<span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span></span><Button variant="ghost" size="icon" aria-label={`Edit ${getSlotLabel(reading.time_slot)} reading`} onClick={() => startReading(reading)}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${getSlotLabel(reading.time_slot)} reading`} onClick={() => setDeleteTarget(reading)}><Trash2 aria-hidden="true" /></Button></div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>
        )}
      </div>

      <Dialog open={readingDialogOpen} onOpenChange={setReadingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReading ? "Edit reading" : "Add a reading"}</DialogTitle>
            <DialogDescription>Enter the value from your glucose meter.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleReadingSubmit(event)} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="reading-date">Date</Label><Input id="reading-date" type="date" value={readingDate} max={today} onChange={(event) => setReadingDate(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="reading-slot">Time of day</Label>
              <Select value={readingSlot} onValueChange={(value) => setReadingSlot(value as ReadingSlot)}>
                <SelectTrigger id="reading-slot"><SelectValue /></SelectTrigger>
                <SelectContent>{READING_SLOTS.map((slot) => <SelectItem key={slot.id} value={slot.id}>{slot.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="reading-value">Glucose value (mg/dL)</Label><Input id="reading-value" type="number" inputMode="numeric" min="40" max="600" step="1" placeholder="e.g. 105" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} required /></div>
            {readingError ? <Alert variant="destructive"><AlertDescription>{readingError}</AlertDescription></Alert> : null}
            <DialogFooter><Button variant="outline" type="button" onClick={() => setReadingDialogOpen(false)}>Cancel</Button><Button type="submit">{editingReading ? "Save changes" : "Save reading"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this reading?</AlertDialogTitle><AlertDialogDescription>This reading will be removed from your journal.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep reading</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDeleteReading(); }}>Delete reading</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Your profile</DialogTitle><DialogDescription>Personalize the name shown in your journal.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => void handleProfileSave(event)} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="profile-full-name">Full name</Label><Input id="profile-full-name" autoComplete="name" value={profile.full_name} onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-display-name">Display name</Label><Input id="profile-display-name" value={profile.display_name ?? ""} onChange={(event) => setProfile((current) => ({ ...current, display_name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="profile-timezone">Time zone</Label><Input id="profile-timezone" value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))} placeholder="e.g. America/New_York" /><p className="text-xs text-muted-foreground">Use an IANA time zone name.</p></div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setProfileDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({ label, value, unit = "mg/dL" }: { label: string; value: number | string | null; unit?: string }) {
  const numericValue = typeof value === "number" ? value : null;
  return (
    <div className="border-l border-border pl-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl">{value === null ? "—" : value}</p>
      {numericValue !== null && unit ? <p className="mt-0.5 text-xs text-muted-foreground">{unit}</p> : null}
    </div>
  );
}