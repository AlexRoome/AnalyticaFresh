import React, { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { SidebarProvider } from "./context/SidebarContext";
import { RowDataProvider } from "./context/RowDataContext";
import { GstModeProvider } from "./context/GstModeContext";
import { CashflowModeProvider } from "./context/CashflowModeContext";
import { CashflowProfileProvider } from "./context/CashflowProfileContext";
import Layout from "./components/ui/Layout";

import GridSwipes from "./components/costCenters/GridSwipes";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ManagementCosts from "./pages/ManagementCosts";

import InvoiceUploadManager from "./components/costCenters/InvoiceUploadManager";

import SettingsAnalysisReporting from "./pages/SettingsAnalysisReporting";
import SettingsCollaborationIntegration from "./pages/SettingsCollaborationIntegration";
import SettingsFeasibilityCalculations from "./pages/SettingsFeasibilityCalculations";
import SettingsFinancingJointVentures from "./pages/SettingsFinancingJointVentures";
import SettingsGeneralLocalisation from "./pages/SettingsGeneralLocalisation";
import SettingsTaxationCompliance from "./pages/SettingsTaxationCompliance";

import { supabase } from "./supabaseClient";

import { GanttProvider } from "./context/GanttContext";
import { LeftNavBarProvider } from "./context/LeftNavBarContext";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profiles, setProfiles] = useState([]);

  // Check for an existing session on load.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // Fetch the current user's profile if logged in.
  useEffect(() => {
    async function fetchProfiles() {
      try {
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", session.user.id);
          if (error) throw error;
          setProfiles(data || []);
        } else {
          setProfiles([]);
        }
      } catch (err) {
        console.error("Error fetching profiles:", err);
      }
    }
    fetchProfiles();
  }, [session]);

  return (
    <GstModeProvider>
      <CashflowModeProvider>
        <CashflowProfileProvider>
          <GanttProvider>
            <SidebarProvider>
              <LeftNavBarProvider>
                <RowDataProvider>
                  <Switch>
                    {/* Routes WITHOUT Layout */}
                    <Route path="/home">
                      <Home />
                    </Route>
                    <Route path="/login">
                      <Login />
                    </Route>
                    <Route path="/signup">
                      <Signup />
                    </Route>
                    <Route path="/dashboard">
                      <Dashboard />
                    </Route>
                    {/* Routes WITH Layout */}
                    <Route>
                      <Layout>
                        <Switch>
                          {/* Consolidated feasibility route with inline routing logic */}
                          <Route path="/feasibility/:feasibilityId/:subpage?">
                            {(params) => {
                              const { feasibilityId, subpage } = params || {};
                              const validGridPages = [
                                "index",
                                "grid",
                                "summary",
                                "programme",
                                "invoices",
                              ];
                              if (!subpage || validGridPages.includes(subpage)) {
                                return <GridSwipes />;
                              } else {
                                return (
                                  <ManagementCosts
                                    feasibilityId={feasibilityId}
                                    disciplineName={subpage}
                                  />
                                );
                              }
                            }}
                          </Route>
                          <Route path="/invoice-upload">
                            <InvoiceUploadManager />
                          </Route>
                          {/* Settings Routes */}
                          <Route path="/settings/:feasibilityId/analysis-reporting">
                            {(params) => (
                              <SettingsAnalysisReporting
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                          <Route path="/settings/:feasibilityId/collaboration-integration">
                            {(params) => (
                              <SettingsCollaborationIntegration
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                          <Route path="/settings/:feasibilityId/feasibility-calculations">
                            {(params) => (
                              <SettingsFeasibilityCalculations
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                          <Route path="/settings/:feasibilityId/financing-joint-ventures">
                            {(params) => (
                              <SettingsFinancingJointVentures
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                          <Route path="/settings/:feasibilityId/general-localisation">
                            {(params) => (
                              <SettingsGeneralLocalisation
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                          <Route path="/settings/:feasibilityId/taxation-compliance">
                            {(params) => (
                              <SettingsTaxationCompliance
                                feasibilityId={params.feasibilityId}
                              />
                            )}
                          </Route>
                        </Switch>
                      </Layout>
                    </Route>
                  </Switch>
                </RowDataProvider>
              </LeftNavBarProvider>
            </SidebarProvider>
          </GanttProvider>
        </CashflowProfileProvider>
      </CashflowModeProvider>
    </GstModeProvider>
  );
}
