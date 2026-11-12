import React, { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  Clock3,
  Droplets,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import { useAuth } from './context/AuthContext';
import { readingsApi } from './api/readings';
import { reportsApi, type ComprehensiveReport } from './api/reports';
import {
  READING_SLOTS,
  formatDate,
  localDateString,
  summarizeReadings,
  getSlotLabel,
  type GlucoseReading,
  type ReadingSlot
} from './lib/glucose';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Alert, AlertDescription } from './components/ui/alert';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { ReadingDialog } from './components/ReadingDialog';
import { DeleteDialog } from './components/DeleteDialog';
import { ProfileDialog } from './components/ProfileDialog';
import { TrendChart } from './components/TrendChart';

export function App() {
  const { user, ready, login, register, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'journal' | 'reports'>('journal');
  const [today, setToday] = useState('');
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  // Pagination for readings list
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReadings, setTotalReadings] = useState(0);

  // Auth form states
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Dialog states
  const [readingDialogOpen, setReadingDialogOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<GlucoseReading | null>(null);
  const [targetSlot, setTargetSlot] = useState<ReadingSlot | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<GlucoseReading | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Reports state
  const [reportDate, setReportDate] = useState('');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'month_to_date' | 'previous_month'>('daily');
  const [comprehensiveReport, setComprehensiveReport] = useState<ComprehensiveReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    const localToday = localDateString();
    setToday(localToday);
    setReportDate(localToday);
  }, []);

  // Fetch readings whenever user logs in or page changes
  const fetchReadings = async (pageNumber = 1) => {
    if (!user) return;
    try {
      setLoadingReadings(true);
      const res = await readingsApi.list({ page: pageNumber, limit: 30 });
      setReadings(res.data);
      setPage(res.pagination.page);
      setTotalPages(res.pagination.totalPages);
      setTotalReadings(res.pagination.total);
    } catch (err: any) {
      toast.error(err.message || "Could not load readings.");
    } finally {
      setLoadingReadings(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchReadings(1);
    } else {
      setReadings([]);
    }
  }, [user]);

  // Fetch report data when switching to reports or changing date
  const fetchReport = async (date: string) => {
    if (!user || !date) return;
    try {
      setLoadingReport(true);
      const data = await reportsApi.getReport(date);
      setComprehensiveReport(data);
    } catch (err: any) {
      toast.error(err.message || "Could not generate report.");
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'reports' && reportDate) {
      void fetchReport(reportDate);
    }
  }, [user, activeTab, reportDate]);

  // Filter today's readings from current state
  const todayReadings = useMemo(() => {
    return readings.filter((r) => r.reading_date === today);
  }, [readings, today]);

  const todayMetrics = useMemo(() => summarizeReadings(todayReadings), [todayReadings]);

  // Determine active report metrics
  const activeReportMetrics = useMemo(() => {
    if (!comprehensiveReport) {
      return { highest: null, lowest: null, average: null, count: 0 };
    }
    if (reportPeriod === 'daily') return comprehensiveReport.daily;
    if (reportPeriod === 'month_to_date') return comprehensiveReport.month_to_date;
    return comprehensiveReport.previous_month;
  }, [comprehensiveReport, reportPeriod]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);

    try {
      if (authMode === 'signup') {
        await register(authName.trim(), authEmail.trim(), authPassword);
        toast.success('Account created successfully.');
      } else {
        await login(authEmail.trim(), authPassword);
        toast.success('Signed in successfully.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveReading = async (readingData: {
    reading_date: string;
    time_slot: string;
    value_mg_dl: number;
  }) => {
    if (editingReading) {
      await readingsApi.update(editingReading.id, readingData);
      toast.success('Reading updated.');
    } else {
      await readingsApi.create(readingData);
      toast.success('Reading saved.');
    }
    await fetchReadings(page);
    if (activeTab === 'reports') {
      await fetchReport(reportDate);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await readingsApi.delete(deleteTarget.id);
      toast.success('Reading removed.');
      setDeleteTarget(null);
      await fetchReadings(page);
      if (activeTab === 'reports') {
        await fetchReport(reportDate);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete reading.');
    }
  };

  const openAddReading = (slot?: ReadingSlot) => {
    setEditingReading(null);
    setTargetSlot(slot);
    setReadingDialogOpen(true);
  };

  const openEditReading = (reading: GlucoseReading) => {
    setEditingReading(reading);
    setTargetSlot(undefined);
    setReadingDialogOpen(true);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
          <Droplets className="size-6 text-primary" aria-hidden="true" />
          <span className="font-display text-2xl text-foreground font-semibold">sweety</span>
        </div>
      </main>
    );
  }

  // Unauthenticated screen
  if (!user) {
    return (
      <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
          <Toaster position="top-right" richColors />
          <div className="flex items-center gap-2.5">
            <Droplets className="size-6 text-primary" aria-hidden="true" />
            <span className="font-display text-2xl font-bold tracking-tight">sweety</span>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-col justify-center py-10">
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-wider uppercase text-primary">A quiet space for health</p>
              <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Your readings, in one place.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to your private blood glucose journal, or create an account to begin tracking.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 border-b border-border">
              <Button
                type="button"
                variant="ghost"
                className={`h-11 rounded-none border-b-2 font-medium ${
                  authMode === 'signin'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`h-11 rounded-none border-b-2 font-medium ${
                  authMode === 'signup'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
              >
                Create account
              </Button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">Full name</Label>
                  <Input
                    id="auth-name"
                    placeholder="e.g. Jane Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="auth-email">Email address</Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {authError && (
                <Alert variant="destructive">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <Button className="w-full h-10" type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create your journal' : 'Sign in'}
              </Button>

              <div className="mt-4 pt-4 border-t border-border text-center">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthEmail('demo@sweety.app');
                    setAuthPassword('Demo@1234');
                  }}
                >
                  Fill demo credentials (demo@sweety.app)
                </button>
              </div>
            </form>
          </div>

          <p className="text-xs text-muted-foreground">
            Sweety Blood Glucose Tracker &middot; End-to-end private health records.
          </p>
        </section>

        <aside className="relative hidden border-l border-border bg-accent/40 p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Activity className="size-4 text-primary" aria-hidden="true" />
            <span>Consistent, calm care records</span>
          </div>

          <div className="mx-auto w-full max-w-md py-12">
            <div className="mb-8 flex size-14 items-center justify-center rounded-xl border border-primary/20 bg-background text-primary shadow-xs">
              <Droplets className="size-7" aria-hidden="true" />
            </div>
            <h2 className="font-display text-4xl leading-tight">
              Small notes reveal the clearest pictures.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              A private, focused space to track your fasting and mealtime glucose levels, helping you and your physician observe meaningful patterns.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span>Standard glucose unit: <strong>mg/dL</strong></span>
            <span>Clinical validation rules enforced</span>
          </div>
        </aside>
      </main>
    );
  }

  const displayName =
    user.profile?.display_name ||
    user.profile?.full_name ||
    user.name ||
    user.email.split('@')[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Droplets className="size-6 text-primary" aria-hidden="true" />
            <span className="font-display text-2xl font-bold tracking-tight">sweety</span>
          </div>

          <nav className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
            <Button
              variant={activeTab === 'journal' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('journal')}
            >
              Journal
            </Button>
            <Button
              variant={activeTab === 'reports' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('reports')}
            >
              Reports
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              title="Profile Settings"
              onClick={() => setProfileDialogOpen(true)}
            >
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="text-xs font-semibold">
                  {displayName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        {activeTab === 'journal' ? (
          <>
            {/* Journal Header */}
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-primary">
                  {greeting()}, {displayName}
                </p>
                <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your daily journal</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {today ? formatDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                </p>
              </div>
              <Button
                className="self-start sm:self-auto gap-1.5"
                onClick={() => openAddReading()}
                disabled={todayReadings.length >= 4}
              >
                <Plus className="size-4" aria-hidden="true" /> Add reading
              </Button>
            </section>

            {/* Today Summary Banner */}
            <section className="mt-8 grid border-y border-border py-6 md:grid-cols-[1.5fr_1fr]" aria-label="Today summary">
              <div className="md:pr-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today at a glance</p>
                    <h2 className="mt-0.5 font-display text-2xl font-medium">Your numbers</h2>
                  </div>
                  <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MetricCard label="Highest" value={todayMetrics.highest} />
                  <MetricCard label="Lowest" value={todayMetrics.lowest} />
                  <MetricCard label="Average" value={todayMetrics.average} />
                  <MetricCard label="Readings" value={`${todayMetrics.count} / 4`} unit="" />
                </div>
              </div>

              <aside className="mt-6 flex flex-col justify-center border-t border-border bg-accent/30 p-5 md:mt-0 md:border-l md:border-t-0 md:pl-8">
                <p className="text-xs font-semibold uppercase text-accent-foreground">Doctor visit ready</p>
                <h3 className="mt-1 font-display text-xl font-medium">Clear trends over time</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Keeping all 4 slots updated provides high-confidence statistical summaries for clinical consultations.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-fit gap-1 text-xs"
                  onClick={() => setActiveTab('reports')}
                >
                  View full reports <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Button>
              </aside>
            </section>

            {/* Today Slots List */}
            <section className="mt-8" aria-label="Today reading slots">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {todayReadings.length} of 4 recorded today
                  </p>
                  <h2 className="mt-0.5 font-display text-2xl font-medium">Today’s schedule</h2>
                </div>
              </div>

              <div className="mt-4 divide-y divide-border border-y border-border">
                {READING_SLOTS.map((slot) => {
                  const reading = todayReadings.find((r) => r.time_slot === slot.id);
                  return (
                    <div
                      key={slot.id}
                      className="flex min-h-16 items-center justify-between gap-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                            reading ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {reading ? <Check className="size-4" /> : <Clock3 className="size-4" />}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {slot.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reading ? 'Recorded' : 'Not recorded yet'}
                          </p>
                        </div>
                      </div>

                      {reading ? (
                        <div className="flex items-center gap-2">
                          <p className="min-w-20 text-right font-display text-xl font-medium">
                            {reading.value_mg_dl ?? reading.value}
                            <span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span>
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit reading"
                            onClick={() => openEditReading(reading)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete reading"
                            onClick={() => setDeleteTarget(reading)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAddReading(slot.id)}
                          disabled={todayReadings.length >= 4}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Recent Readings List with Pagination */}
            <section className="mt-12" aria-label="Recent readings history">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Historical entries ({totalReadings} total)
                  </p>
                  <h2 className="mt-0.5 font-display text-2xl font-medium">Journal history</h2>
                </div>
              </div>

              {readings.length === 0 ? (
                <div className="mt-6 flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
                  <Activity className="size-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No readings recorded yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Click "Add reading" to record your first entry.</p>
                </div>
              ) : (
                <>
                  <div className="mt-4 divide-y divide-border border-y border-border">
                    {readings.map((reading) => (
                      <div
                        key={reading.id}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">{getSlotLabel(reading.time_slot)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(reading.reading_date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-medium">
                            {reading.value_mg_dl ?? reading.value}
                            <span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span>
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditReading(reading)}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(reading)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => void fetchReadings(page - 1)}
                        >
                          <ChevronLeft className="size-4" /> Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPages}
                          onClick={() => void fetchReadings(page + 1)}
                        >
                          Next <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          /* Reports View */
          <section aria-label="Clinical reports engine">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-primary">Clinical insights</p>
                <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your reports</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Statistical breakdown across daily, month-to-date, and previous-month intervals.
                </p>
              </div>

              <div className="w-full sm:w-56">
                <Label htmlFor="report-anchor-date" className="text-xs mb-1 block">
                  Reference Date
                </Label>
                <Input
                  id="report-anchor-date"
                  type="date"
                  value={reportDate}
                  max={today}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
            </div>

            {/* Period selector */}
            <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">
              {(
                [
                  ['daily', 'Daily'],
                  ['month_to_date', 'Month to date'],
                  ['previous_month', 'Previous month']
                ] as const
              ).map(([period, label]) => (
                <Button
                  key={period}
                  variant={reportPeriod === period ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setReportPeriod(period)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Period Range Header */}
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {reportPeriod === 'daily'
                    ? 'Selected Day Report'
                    : reportPeriod === 'month_to_date'
                    ? 'Month to Date Report'
                    : 'Previous Full Month Report'}
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-medium">
                  {comprehensiveReport
                    ? reportPeriod === 'daily'
                      ? comprehensiveReport.daily.formatted_range
                      : reportPeriod === 'month_to_date'
                      ? comprehensiveReport.month_to_date.formatted_range
                      : comprehensiveReport.previous_month.formatted_range
                    : 'Loading report...'}
                </h2>
              </div>

              {reportPeriod === 'daily' && (
                <Button onClick={() => openAddReading()} size="sm" className="gap-1">
                  <Plus className="size-4" /> Add reading
                </Button>
              )}
            </div>

            {/* Report Stats Summary Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-6 sm:grid-cols-4">
              <MetricCard label="Highest" value={activeReportMetrics.highest} />
              <MetricCard label="Lowest" value={activeReportMetrics.lowest} />
              <MetricCard label="Average" value={activeReportMetrics.average} />
              <MetricCard label="Total Readings" value={activeReportMetrics.count} unit="" />
            </div>

            {/* Empty State vs Rich Data */}
            {activeReportMetrics.count === 0 ? (
              <div className="mt-8 flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
                <Activity className="size-6 text-muted-foreground mb-2" />
                <p className="font-medium text-foreground">No readings found for this period</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Readings will automatically appear here once logged for this date range.
                </p>
              </div>
            ) : (
              <div className="mt-8 space-y-8">
                {/* Trend Chart Bonus Feature */}
                {reportPeriod !== 'daily' && comprehensiveReport && (
                  <TrendChart
                    data={
                      reportPeriod === 'month_to_date'
                        ? comprehensiveReport.month_to_date.daily_averages || []
                        : comprehensiveReport.previous_month.daily_averages || []
                    }
                    title={`${reportPeriod === 'month_to_date' ? 'Month to Date' : 'Previous Month'} Trend`}
                  />
                )}

                {/* Readings List for Daily Report */}
                {reportPeriod === 'daily' && comprehensiveReport?.daily.readings && (
                  <div>
                    <h3 className="font-display text-xl font-medium">Readings for {comprehensiveReport.daily.formatted_range}</h3>
                    <div className="mt-3 divide-y divide-border border-y border-border">
                      {comprehensiveReport.daily.readings.map((reading) => (
                        <div
                          key={reading.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div>
                            <p className="font-medium text-sm">{getSlotLabel(reading.time_slot)}</p>
                            <p className="text-xs text-muted-foreground">{reading.time_slot}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg font-medium">
                              {reading.value_mg_dl ?? reading.value}
                              <span className="ml-1 text-xs font-sans text-muted-foreground">mg/dL</span>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditReading(reading)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(reading)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Dialogs */}
      <ReadingDialog
        open={readingDialogOpen}
        onOpenChange={setReadingDialogOpen}
        editingReading={editingReading}
        existingReadings={readings}
        today={today}
        defaultSlot={targetSlot}
        defaultDate={activeTab === 'reports' ? reportDate : today}
        onSubmit={handleSaveReading}
      />

      <DeleteDialog
        reading={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />
    </main>
  );
}

function MetricCard({
  label,
  value,
  unit = 'mg/dL'
}: {
  label: string;
  value: number | string | null;
  unit?: string;
}) {
  const isNumber = typeof value === 'number';
  return (
    <div className="border-l-2 border-border pl-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-foreground">
        {value === null ? '—' : value}
      </p>
      {isNumber && unit ? (
        <p className="text-[11px] text-muted-foreground">{unit}</p>
      ) : null}
    </div>
  );
}

export default App;

