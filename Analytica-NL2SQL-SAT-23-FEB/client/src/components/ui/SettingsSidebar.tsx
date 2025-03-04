import React, { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useSidebarContext } from "../../context/SidebarContext";
import { BsEyeglasses } from "react-icons/bs";
import { CiUser } from "react-icons/ci";
import { LuSunMedium } from "react-icons/lu";
import { IoMoonOutline } from "react-icons/io5";
import { supabase } from "../../supabaseClient";
import "./PageStyles.css";
import { MdArrowCircleLeft } from "react-icons/md"; // New icon

const settingsLinks = [
  { label: "General & Localisation", path: "/settings/general-localisation" },
  { label: "Feasibility & Calculations", path: "/settings/feasibility-calculations" },
  { label: "Financing & Joint Ventures", path: "/settings/financing-joint-ventures" },
  { label: "Taxation & Compliance", path: "/settings/taxation-compliance" },
  { label: "Analysis & Reporting", path: "/settings/analysis-reporting" },
  { label: "Collaboration & Integration", path: "/settings/collaboration-integration" },
];

export default function SettingsSidebar() {
  const { isOpen, setIsOpen } = useSidebarContext();

  // Use Wouter's navigation + route matching
  const [, setLocation] = useLocation();
  const [feasMatch, feasParams] = useRoute("/feasibility/:feasibilityId");
  // New: extract feasibilityId from settings route
  const [settingsMatch, settingsParams] = useRoute("/settings/:feasibilityId/:subpage?");

  // Start fully open if isOpen is true at page load
  const [isSidebarFullyOpen, setIsSidebarFullyOpen] = useState(isOpen);

  // Controls whether the user popup is shown
  const [showUserPopup, setShowUserPopup] = useState(false);

  // If the user icon was clicked while collapsed,
  // we open the sidebar first, then show the popup.
  const [pendingOpenUserPopup, setPendingOpenUserPopup] = useState(false);

  // Ref for the popup so we can detect clicks outside
  const popupRef = useRef<HTMLDivElement>(null);

  // We'll store the user's session and single profile row here
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // If the sidebar closes, hide text labels immediately
  useEffect(() => {
    if (!isOpen) {
      setIsSidebarFullyOpen(false);
    }
  }, [isOpen]);

  function handleTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
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
    function handleClickOutside(event: MouseEvent) {
      if (
        showUserPopup &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setShowUserPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserPopup]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setLocation("/login");
  }

  function handleSettingsIconClick() {
    const feasibilityId = feasParams?.feasibilityId || settingsParams?.feasibilityId;
    if (feasibilityId) {
      setLocation(`/feasibility/${feasibilityId}`);
    } else {
      console.warn("No feasibilityId found in route, not navigating.");
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
      <div
        className={isOpen ? "sidebar-topbar-expanded" : "sidebar-topbar-collapsed"}
      />
      <div
        className="sidebarMain"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          position: "relative",
        }}
      >
        <div>
          {topLinks.map((item, idx) => (
            <div
              key={idx}
              className="sidebarTopLink"
              onClick={item.onClick ? item.onClick : undefined}
              style={{ cursor: item.onClick ? "pointer" : "default" }}
            >
              {item.icon}
            </div>
          ))}
        </div>
        {isSidebarFullyOpen && (
          <div style={{ flex: 1, overflowY: "auto", marginTop: "1rem" }}>
            <div style={{ padding: "1rem" }}>
              {settingsLinks.map((link) => {
                const fid =
                  feasParams?.feasibilityId || settingsParams?.feasibilityId;
                const newPath = fid
                  ? `/settings/${fid}${link.path.replace("/settings", "")}`
                  : link.path;
                return (
                  <div
                    key={link.path}
                    style={{
                      cursor: "pointer",
                      marginBottom: "0.5rem",
                    }}
                    onClick={() => setLocation(newPath)}
                  >
                    {link.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
          {/* Replaced Settings Icon with MdArrowCircleLeft */}
          <div
            className="sidebarTopLink"
            onClick={handleSettingsIconClick}
            style={{ cursor: "pointer", marginBottom: "0.5rem" }}
          >
            <MdArrowCircleLeft
              className="sidebarTopLinkIcon"
              style={{
                transform: "scale(1.5)",
                transformOrigin: "center",
              }}
            />
          </div>
          <div
            className="sidebarTopLink"
            onClick={handleUserIconClick}
            style={{ cursor: "pointer" }}
          >
            <CiUser
              className="sidebarTopLinkIcon"
              style={{
                transform: "scale(1.5)",
                transformOrigin: "center",
              }}
            />
          </div>
        </div>
        {showUserPopup && (
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
              {profile
                ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
                : "No name"}
            </div>
            <div style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              {session?.user?.email ?? "No email"}
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.4rem",
                marginBottom: "0.75rem",
                justifyContent: "flex-start",
              }}
            >
              <div style={{ cursor: "pointer" }}>
                <LuSunMedium />
              </div>
              <div style={{ cursor: "pointer" }}>
                <IoMoonOutline />
              </div>
            </div>
            <hr style={{ margin: "0.5rem 0" }} />
            <div style={{ margin: "0.3rem 0", cursor: "pointer" }}>
              Your profile
            </div>
            <div style={{ margin: "0.3rem 0", cursor: "pointer" }}>
              Terms & policies
            </div>
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
  );
}
