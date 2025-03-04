// /client/src/components/ui/Sidebar.tsx
import React, { useEffect, useState, useMemo, useRef, useContext } from "react";
import { useLocation } from "wouter";
import { useSidebarContext } from "../../context/SidebarContext";
import { useRowDataContext } from "../../context/RowDataContext";
import { HEADINGS } from "../../components/costCenters/HeadingsData";
import { BsEyeglasses } from "react-icons/bs";
import { CiUser } from "react-icons/ci";
import { CiSettings } from "react-icons/ci";
import { LuSunMedium } from "react-icons/lu";
import { IoMoonOutline } from "react-icons/io5";
import { BsReverseLayoutSidebarReverse } from "react-icons/bs";
import { CiChat1 } from "react-icons/ci"; // Chat Icon import
import { VscSettings } from "react-icons/vsc"; // Icon used for LeftNavBar toggle
import { supabase } from "../../supabaseClient";
import { useGstMode } from "../../context/GstModeContext";
import { useCashflowMode } from "../../context/CashflowModeContext";
import ChatPopup from "./ChatPopup"; // ChatPopup import
import LeftNavBar from "../ui/LeftNavBar"; // LeftNavBar import
import { useLeftNavBarContext } from "../../context/LeftNavBarContext";
import "./PageStyles.css";

// Helper function to filter sub-rows for a given heading.
function getSubRowsForHeading(rowData, headingIndex) {
  return rowData.filter(
    (row) => row.headingIndex === headingIndex && !row.isHeading
  );
}

export default function Sidebar() {
  const { isOpen, setIsOpen, slideIndex, setSlideIndex, isTwoPane, setIsTwoPane } =
    useSidebarContext();
  
  // Using the hook directly is now safe because the context has a default value
  const { rowData } = useRowDataContext();
  const [location, setLocation] = useLocation();
  const match = location.match(/^\/feasibility\/([^/]+)/);
  const feasibilityId = match ? match[1] : null;

  // Determine if we are on the main feasibility route (i.e. URL exactly "/feasibility/feasibility_id")
  const isFeasibilityMain = /^\/feasibility\/[^/]+$/.test(location);

  // Sidebar local state.
  const [isSidebarFullyOpen, setIsSidebarFullyOpen] = useState(isOpen);
  const [openDropdowns, setOpenDropdowns] = useState(HEADINGS.map(() => false));
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [pendingOpenUserPopup, setPendingOpenUserPopup] = useState(false);
  const popupRef = useRef(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showChatPopup, setShowChatPopup] = useState(false);

  // Use our LeftNavBar context.
  const { showLeftNavBar, setShowLeftNavBar } = useLeftNavBarContext();

  // State for left nav settings (if needed)
  const [leftNavSettings, setLeftNavSettings] = useState({
    calculationType: "Lump Sum",
    taxation: false,
    programme: "(None)",
  });

  // GST mode context.
  const { gstMode, setGstMode } = useGstMode();
  useEffect(() => {
    if (!gstMode || (typeof gstMode === "string" && gstMode.trim() === "")) {
      setGstMode("excl");
    }
  }, [gstMode, setGstMode]);

  // Cashflow mode context.
  const { cashflowMode, setCashflowMode } = useCashflowMode();

  // Get the dark mode state and toggle function
  const { isDarkMode, toggleDarkMode } = useSidebarContext();

  // Apply dark mode class to body element when isDarkMode changes
  useEffect(() => {
    // Apply dark mode to body element
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!isOpen) {
      setIsSidebarFullyOpen(false);
    }
  }, [isOpen]);

  function handleTransitionEnd(e) {
    if (e.propertyName === "width" && isOpen) {
      setIsSidebarFullyOpen(true);
      if (pendingOpenUserPopup) {
        setShowUserPopup(true);
        setPendingOpenUserPopup(false);
      }
    }
  }

  useEffect(() => {
    async function loadSessionAndProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentSession = sessionData.session;
      setSession(currentSession);
      if (currentSession?.user?.id) {
        const { data: rows, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", currentSession.user.id);
        if (!error && rows && rows.length > 0) {
          setProfile(rows[0]);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    }
    loadSessionAndProfile();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showUserPopup &&
        popupRef.current &&
        !popupRef.current.contains(event.target)
      ) {
        setShowUserPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserPopup]);

  function toggleDropdown(index) {
    setOpenDropdowns((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setLocation("/login");
  }

  // Updated: When the settings icon is clicked, route to SettingsGeneralLocalisation.
  function handleSettingsIconClick() {
    if (feasibilityId) {
      setLocation(`/settings/${feasibilityId}/general-localisation`);
    } else {
      setLocation("/settings/abc123/general-localisation");
    }
  }

  function handleUserIconClick() {
    if (!isOpen) {
      setIsOpen(true);
      setPendingOpenUserPopup(true);
    } else {
      setShowUserPopup((prev) => !prev);
      setPendingOpenUserPopup(false);
    }
  }

  const sidebarWidthOpen = "15rem";
  const sidebarWidthCollapsed = "3rem";
  const containerClass = isOpen ? "sidebarExpanded" : "sidebarCollapsed";

  const topLinks = [
    {
      icon: (
        <BsEyeglasses
          className="sidebarTopLinkIcon"
          style={{ transform: "scale(1.5)", transformOrigin: "center" }}
        />
      ),
      onClick: () => setIsOpen(!isOpen),
    },
  ];

  return (
    <>
      <div
        className={containerClass}
        style={{
          width: isOpen ? sidebarWidthOpen : sidebarWidthCollapsed,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className={isOpen ? "sidebar-topbar-expanded" : "sidebar-topbar-collapsed"} />

        <div
          className="sidebarMain"
          style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}
        >
          {/* TOP icons */}
          <div>
            {topLinks.map((item, idx) => (
              <div key={idx} className="sidebarTopLink" onClick={item.onClick} style={{ cursor: "pointer" }}>
                {item.icon}
              </div>
            ))}
          </div>

          {isSidebarFullyOpen && (
            <div style={{ flex: 1, overflowY: "auto", marginTop: "1rem" }}>
              {/* Slide navigation */}
              <div style={{ padding: "1rem" }}>
                <div
                  style={{
                    cursor: "pointer",
                    fontWeight: slideIndex === 0 ? "bold" : "normal",
                    marginBottom: "0.5rem",
                  }}
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (feasibilityId) {
                      setSlideIndex(0);
                      setLocation(`/feasibility/${feasibilityId}/index`);
                    }
                  }}
                >
                  Feasibility Index
                </div>
                <div
                  style={{
                    cursor: "pointer",
                    fontWeight: slideIndex === 1 ? "bold" : "normal",
                    marginBottom: "0.5rem",
                  }}
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (feasibilityId) {
                      setSlideIndex(1);
                      setLocation(`/feasibility/${feasibilityId}/grid`);
                    }
                  }}
                >
                  Feasibility Grid
                </div>
                <div
                  style={{
                    cursor: "pointer",
                    fontWeight: slideIndex === 2 ? "bold" : "normal",
                    marginBottom: "0.5rem",
                  }}
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (feasibilityId) {
                      setSlideIndex(2);
                      setLocation(`/feasibility/${feasibilityId}/summary`);
                    }
                  }}
                >
                  Feasibility Summary
                </div>
                <div
                  style={{
                    cursor: "pointer",
                    fontWeight: slideIndex === 3 ? "bold" : "normal",
                    marginBottom: "0.5rem",
                  }}
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (feasibilityId) {
                      setSlideIndex(3);
                      setLocation(`/feasibility/${feasibilityId}/programme`);
                    }
                  }}
                >
                  Programme
                </div>
                <div
                  style={{
                    cursor: "pointer",
                    fontWeight: slideIndex === 4 ? "bold" : "normal",
                    marginBottom: "0.5rem",
                  }}
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (feasibilityId) {
                      setSlideIndex(4);
                      setLocation(`/feasibility/${feasibilityId}/invoices`);
                    }
                  }}
                >
                  Invoices
                </div>
              </div>

              {/* Dropdowns for HEADINGS */}
              {HEADINGS.map((heading, index) => {
                const subRows = getSubRowsForHeading(rowData, index);
                const isOpenThisHeading = openDropdowns[index];
                const dropdownClass = isOpenThisHeading ? "sidebar-dropdownContentsOpen" : "sidebar-dropdownContents";
                const headingClass = isOpenThisHeading
                  ? "sidebar-dropdownHeader sidebar-dropdownHeaderOpen"
                  : "sidebar-dropdownHeader";

                return (
                  <div key={index}>
                    <div className={headingClass} onClick={() => toggleDropdown(index)}>
                      <span className="sidebar-heading-arrow">{isOpenThisHeading ? "▾" : "▸"}</span>
                      {heading}
                    </div>
                    <div className={dropdownClass}>
                      {subRows.map((row, i) => (
                        <div
                          key={i}
                          className="sidebar-dropdownContentsRow"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (feasibilityId) {
                              setLocation(`/feasibility/${feasibilityId}/${row.Column1}`);
                            } else {
                              setLocation(`/${row.Column1}`);
                            }
                          }}
                        >
                          {row.Column1}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* BOTTOM ICONS (excluding toggles) */}
          <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
            {/* LeftNavBar Toggle Button (above the Chat icon) */}
            {feasibilityId && isFeasibilityMain && (
              <div
                className="sidebarTopLink"
                onClick={() => setShowLeftNavBar((prev) => !prev)}
                style={{ cursor: "pointer", marginBottom: "0.5rem" }}
                title="Toggle LeftNavBar"
              >
                <VscSettings
                  className="sidebarTopLinkIcon"
                  style={{ transform: "scale(1.5)", transformOrigin: "center" }}
                />
              </div>
            )}

            {/* Chat Icon */}
            <div
              className="sidebarTopLink"
              onClick={() => setShowChatPopup(true)}
              style={{ cursor: "pointer", marginBottom: "0.5rem" }}
              title="Chat"
            >
              <CiChat1
                className="sidebarTopLinkIcon"
                style={{ transform: "scale(1.5)", transformOrigin: "center" }}
              />
            </div>

            {/* Two Panel Toggle Icon */}
            <div
              className="sidebarTopLink"
              onClick={() => setIsTwoPane(!isTwoPane)}
              style={{ cursor: "pointer", marginBottom: "0.5rem" }}
              title="Toggle Two Panel View"
            >
              <BsReverseLayoutSidebarReverse
                className="sidebarTopLinkIcon"
                style={{ transform: "scale(1.2)", transformOrigin: "center" }}
              />
            </div>

            {/* Settings Icon */}
            <div
              className="sidebarTopLink"
              onClick={handleSettingsIconClick}
              style={{ cursor: "pointer", marginBottom: "0.5rem" }}
            >
              <CiSettings
                className="sidebarTopLinkIcon"
                style={{ transform: "scale(1.5)", transformOrigin: "center" }}
              />
            </div>

            {/* User Icon */}
            <div className="sidebarTopLink" onClick={handleUserIconClick} style={{ cursor: "pointer" }}>
              <CiUser
                className="sidebarTopLinkIcon"
                style={{ transform: "scale(1.5)", transformOrigin: "center" }}
              />
            </div>
          </div>

          {isSidebarFullyOpen && showUserPopup && (
            <div
              ref={popupRef}
              style={{
                position: "absolute",
                bottom: "4.5rem",
                left: isOpen ? "1rem" : "-2rem",
                width: "13rem",
                background: "#2e2e2e",
                color: "#fff",
                borderRadius: "0.5rem",
                padding: "1rem",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                zIndex: 9999,
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: "bold" }}>
                {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}` : "No name"}
              </div>
              <div style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                {session?.user?.email ?? "No email"}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", justifyContent: "flex-start" }}>
                <div 
                  style={{ 
                    cursor: "pointer", 
                    opacity: isDarkMode ? 0.5 : 1,
                    backgroundColor: isDarkMode ? "transparent" : "rgba(0, 0, 0, 0.1)",
                    padding: "4px",
                    borderRadius: "4px"
                  }} 
                  onClick={toggleDarkMode}
                >
                  <LuSunMedium />
                </div>
                <div 
                  style={{ 
                    cursor: "pointer", 
                    opacity: isDarkMode ? 1 : 0.5,
                    backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    padding: "4px",
                    borderRadius: "4px"
                  }}
                  onClick={toggleDarkMode}
                >
                  <IoMoonOutline />
                </div>
              </div>
              <hr style={{ margin: "0.5rem 0" }} />
              <div style={{ margin: "0.3rem 0", cursor: "pointer" }}>Your profile</div>
              <div style={{ margin: "0.3rem 0", cursor: "pointer" }}>Terms & policies</div>
              <div
                style={{ margin: "0.3rem 0", cursor: "pointer" }}
                onClick={handleLogout}
              >
                Log out
              </div>
            </div>
          )}
        </div>
      </div>
      {showChatPopup && (
        <ChatPopup isOpen={showChatPopup} onClose={() => setShowChatPopup(false)} />
      )}
    </>
  );
}
