import { createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowUpRight, CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sweety — Blood Glucose Journal" },
      {
        name: "description",
        content: "A private place to record blood glucose readings and see daily and monthly patterns.",
      },
      { property: "og:title", content: "Sweety — Blood Glucose Journal" },
      {
        property: "og:description",
        content: "A private place to record blood glucose readings and see daily and monthly patterns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SweetyHome,
});

function SweetyHome() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="Sweety home">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl">sweety</span>
          </a>
          <span className="text-sm text-muted-foreground">Your private glucose journal</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">A little more in tune</p>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">Your daily log</h1>
            <p className="mt-3 text-muted-foreground">A clearer picture, one reading at a time.</p>
          </div>
          <Button className="gap-2 self-start sm:self-auto">
            <Plus aria-hidden="true" /> Add a reading
          </Button>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-[1.35fr_0.8fr]" aria-label="Daily glucose summary">
          <div className="border-y border-border py-7 md:pr-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl">Today at a glance</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your readings will appear here.</p>
              </div>
              <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Highest", "—"],
                ["Lowest", "—"],
                ["Average", "—"],
                ["Readings", "0 / 4"],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-border pl-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 font-display text-2xl">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex min-h-36 flex-col items-center justify-center border border-dashed border-border px-5 text-center">
              <p className="font-medium">A fresh page for today</p>
              <p className="mt-1 text-sm text-muted-foreground">When you add a reading, it will show up here.</p>
            </div>
          </div>

          <aside className="bg-accent/50 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-foreground">Your rhythm</p>
            <h2 className="mt-3 font-display text-2xl">Small notes, useful patterns.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Look back over the month and bring a clearer record to your next care visit.
            </p>
            <Button variant="outline" className="mt-6 gap-2 bg-background">
              View monthly report <ArrowUpRight aria-hidden="true" />
            </Button>
          </aside>
        </section>

        <section className="mt-10 border-t border-border pt-6" aria-label="Reading times">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl">Today’s readings</h2>
            <span className="text-sm text-muted-foreground">0 of 4 recorded</span>
          </div>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {[
              ["Morning", "Fasting"],
              ["After breakfast", ""],
              ["After lunch", ""],
              ["After dinner", ""],
            ].map(([slot, detail]) => (
              <div className="flex items-center justify-between gap-3 py-4" key={slot}>
                <div>
                  <p className="font-medium">{slot}</p>
                  {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
                </div>
                <span className="text-sm text-muted-foreground">Not recorded</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}