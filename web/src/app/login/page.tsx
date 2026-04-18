import { LoginForm } from "@/features/auth/components/login-form";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <div className={styles.stack}>
        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <div>
              <p className={`eyebrow ${styles.heroEyebrow}`}>Cobro</p>
            </div>
          </div>

          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>Accede a tu cuenta</h1>
          </div>

          <div className={styles.heroAccent} aria-hidden="true">
            <svg
              className={styles.heroAccentSvg}
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
        </section>

        <div className={styles.formZone}>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
