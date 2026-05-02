import { Suspense } from "react";
import { getDashboardToday } from "@/features/dashboard/lib/api";
import {
  DashboardDueTodayFallback,
  DashboardDueTodaySection,
  DashboardHeroCopy,
  DashboardHeroCopyFallback,
  DashboardHeroSummary,
  DashboardHeroSummaryFallback,
  DashboardMetricsFallback,
  DashboardMetricsSection,
  DashboardOverdueFallback,
  DashboardOverdueSection,
} from "./home-sections";
import styles from "./home.module.css";

type SearchParams = Promise<{
  date?: string | string[];
}>;

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampDateInputValue(value: string, maxValue: string) {
  return value > maxValue ? maxValue : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const dashboardPromise = getDashboardToday({ date });

  return (
    <main className={`page-shell ${styles.pageShellHome}`} id="top">
      <section className={styles.homeHeroBand}>
        <div className={styles.homeHero}>
          <Suspense fallback={<DashboardHeroCopyFallback />}>
            <DashboardHeroCopy dashboardPromise={dashboardPromise} />
          </Suspense>

          <div className={styles.homeHeroAccent} aria-hidden="true">
            <svg
              className={styles.homeHeroAccentSvg}
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#fdd925"
                fillOpacity="1"
                d="M0,288L60,288C120,288,240,288,360,250.7C480,213,600,139,720,138.7C840,139,960,213,1080,218.7C1200,224,1320,160,1380,128L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
              />
            </svg>
          </div>
        </div>
      </section>

      <Suspense fallback={<DashboardHeroSummaryFallback today={today} />}>
        <DashboardHeroSummary dashboardPromise={dashboardPromise} today={today} />
      </Suspense>

      <Suspense fallback={<DashboardMetricsFallback />}>
        <DashboardMetricsSection dashboardPromise={dashboardPromise} />
      </Suspense>

      <section className={styles.homeToolbarPanel}>
        <div className={styles.homeToolbarHeading}>
          <p className="eyebrow">Fecha de corte</p>
          <p className={styles.homeToolbarCopy}>Ajusta el dia de consulta.</p>
        </div>

        <form className={styles.homeToolbarGrid}>
          <label className={styles.homeControlField}>
            <span className={styles.homeControlLabel}>Fecha de corte</span>
            <input
              className={styles.homeControlInput}
              type="date"
              name="date"
              defaultValue={date}
              max={today}
            />
          </label>
          <button className={styles.homeControlButton} type="submit">
            Actualizar
          </button>
        </form>
      </section>

      <Suspense fallback={<DashboardDueTodayFallback />}>
        <DashboardDueTodaySection
          dashboardPromise={dashboardPromise}
          date={date}
        />
      </Suspense>

      <Suspense fallback={<DashboardOverdueFallback />}>
        <DashboardOverdueSection
          dashboardPromise={dashboardPromise}
          date={date}
        />
      </Suspense>
    </main>
  );
}
