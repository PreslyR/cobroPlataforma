"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ScrollAwareActionBarProps = {
  children: ReactNode;
};

const SCROLL_DELTA_THRESHOLD = 12;
const TOP_RESET_THRESHOLD = 24;

export function ScrollAwareActionBar({
  children,
}: ScrollAwareActionBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const commitScrollState = () => {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollYRef.current;

      if (Math.abs(delta) < SCROLL_DELTA_THRESHOLD) {
        return;
      }

      if (nextScrollY <= TOP_RESET_THRESHOLD) {
        setIsVisible(true);
      } else if (delta > 0) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      lastScrollYRef.current = nextScrollY;
    };

    const handleScroll = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        commitScrollState();
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className={`deep-action-bar${isVisible ? "" : " deep-action-bar-hidden"}`}>
      {children}
    </div>
  );
}
