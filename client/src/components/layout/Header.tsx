import { useState, useRef, useEffect, useCallback } from "react";
import { usePaneles } from "../../hooks/usePaneles";
import type { PanelCategoriaCompleto } from "@shared";
import AlertaBanner from "./AlertaBanner";
import HeaderTop from "./HeaderTop";
import HeaderNav from "./HeaderNav";
import CategoryDropdown from "./CategoryDropdown";
import styles from "./Header.module.css";

interface HeaderProps {
  variant?: "full" | "light";
}

export default function Header({ variant = "full" }: HeaderProps) {
  const { paneles, config, loading } = usePaneles();
  const [panelActivo, setPanelActivo] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsTouch("ontouchstart" in window);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled((prev) => {
        if (prev) {
          return window.scrollY > 20;
        }

        return window.scrollY > 80;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const abrir = useCallback((id: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setPanelActivo(id);
  }, []);

  const cerrarConDelay = useCallback((delay = 200) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setPanelActivo(null);
    }, delay);
  }, []);

  const cancelarCierre = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const panel =
    paneles.find((p: PanelCategoriaCompleto) => p.id === panelActivo) ?? null;

  return (
    <header className={styles.header} ref={headerRef}>
      <AlertaBanner config={config} />

      <HeaderTop
        config={config}
        loadingConfig={loading}
        scrolled={scrolled}
        paneles={paneles}
      />

      {variant === "full" && paneles.length > 0 && (
        <div
          className={styles.navGroup}
          onMouseEnter={() => !isTouch && cancelarCierre()}
          onMouseLeave={() => !isTouch && cerrarConDelay()}
        >
          <HeaderNav
            paneles={paneles}
            panelActivo={panelActivo}
            isTouch={isTouch}
            onAbrir={abrir}
            config={config}
            scrolled={scrolled}
          />

          {panel && (
            <div className={styles.dropdown}>
              <CategoryDropdown panel={panel} />
            </div>
          )}
        </div>
      )}

      {panelActivo && (
        <div className={styles.backdrop} onClick={() => setPanelActivo(null)} />
      )}
    </header>
  );
}
