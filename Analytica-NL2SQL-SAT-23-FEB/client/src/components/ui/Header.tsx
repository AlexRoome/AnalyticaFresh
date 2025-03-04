// /client/src/components/ui/Header.tsx
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { FaSearch } from "react-icons/fa";
import "../../pages/Dashboard.css";

export default function Header() {
  const [loc, setLoc] = useLocation();

  // Keep existing Insight click logic
  function handleInsightClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (loc.startsWith("/dashboard")) {
      (window as any).scrollToChatGPT?.();
    } else {
      setLoc("/dashboard?scroll=chatgpt");
    }
  }

  // State to track if the header is collapsed
  const [collapsed, setCollapsed] = useState(false);

  // A ref to track a timer that triggers the collapse after a delay
  const scrollTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        // If user has scrolled more than 100px
        // we start (or reset) a timer that will collapse the header in 1.5s
        if (scrollTimer.current) {
          clearTimeout(scrollTimer.current);
        }
        scrollTimer.current = setTimeout(() => {
          setCollapsed(true);
        }, 1500); // 1.5 seconds, adjust as you like
      } else {
        // If back near top, we immediately uncollapse
        setCollapsed(false);
        // also clear any existing timer
        if (scrollTimer.current) {
          clearTimeout(scrollTimer.current);
          scrollTimer.current = null;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      // Clear any leftover timer when the component unmounts
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }
    };
  }, []);

  // Conditionally apply a collapsed class
  const navClassName = collapsed
    ? "dashboardNav dashboardNav--collapsed"
    : "dashboardNav";

  return (
    <nav className={navClassName}>
      <div className="dashboardBrand">Analytica</div>
      <ul className="dashboardLinks">
        <li>
          <a href="/dashboard">Dashboard</a>
        </li>
        <li>
          <a href="/feasibility">Feasibility</a>
        </li>
        <li>
          <a href="/management">Management</a>
        </li>
        <li>
          <a href="/programme">Programme</a>
        </li>
        <li>
          <a href="#" onClick={handleInsightClick}>
            Insight
          </a>
        </li>
      </ul>
      <div className="dashboardActions">
        {/* Magnifying glass icon with hover rotation/bounce */}
        <FaSearch className="searchIcon" />
      </div>
    </nav>
  );
}
