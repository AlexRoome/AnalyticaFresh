// /client/src/components/ui/Layout.tsx
import React from "react";
import { useRoute } from "wouter";
import { useSidebarContext } from "../../context/SidebarContext";
import Header from "./Header";
import Sidebar from "./Sidebar";
import SettingsSidebar from "./SettingsSidebar";

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

function Layout({ children, sidebar }: LayoutProps) {
  const { isOpen } = useSidebarContext();
  const [isProjectSettingsPage] = useRoute("/project-settings/:projectId");
  const [isSettingsPage] = useRoute("/settings/:feasibilityId/:subpage?");

  const sidebarWidthOpen = "15rem";
  const sidebarWidthCollapsed = "3rem";
  const currentSidebarWidth = isOpen ? sidebarWidthOpen : sidebarWidthCollapsed;

  // If we're on either a project settings page or a settings page, use the SettingsSidebar.
  const chosenSidebar =
    isProjectSettingsPage || isSettingsPage
      ? <SettingsSidebar />
      : (sidebar ? sidebar : <Sidebar />);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
      }}
    >
      <Header />
      <div
        style={{
          display: "flex",
          flex: 1,
          minWidth: 0,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            width: currentSidebarWidth,
            transition: "width 0.3s ease",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {chosenSidebar}
        </div>

        <main
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "var(--black)",
            paddingBottom: "0.5rem",
            paddingRight: "0.5rem",
            border: "1rem",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
