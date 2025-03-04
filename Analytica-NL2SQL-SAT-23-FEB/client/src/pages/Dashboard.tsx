import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import "./Dashboard.css";

// Import the plus icon
import { AiOutlinePlus } from "react-icons/ai";

// Import AskChatGPT
import AskChatGPT from "../components/AskChatGPT";

// Import the random gradient function
import { getRandomGradient } from "../components/costCenters/utils/gradientUtils";

// Import the separate Header
import Header from "../components/ui/Header";

// Import your Supabase client
import { supabase } from "../supabaseClient";

// 1) Helper function to format Supabase dates into "DD Month YYYY"
function formatDateToDDMonthYYYY(isoString: string) {
  if (!isoString) return "";
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) return isoString;

  const day = String(dateObj.getDate()).padStart(2, "0");
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return `${day} ${month} ${year}`;
}

// 2) Helper function to format the time as "h:mmam/pm" (e.g. "3:15pm")
function formatTimeAMPM(isoString: string) {
  if (!isoString) return "";
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) return isoString;

  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12; // convert 0-23 -> 1-12
  const paddedMinutes = String(minutes).padStart(2, "0");
  return `${hours}:${paddedMinutes}${ampm}`;
}

export default function Dashboard() {
  // Added navigate from useLocation so we can programmatically go to new feasibility
  const [location, navigate] = useLocation();

  // Management data: the first item is our special "create" card,
  // but we keep the exact text "Project Address", "Project Title", "Project Date"
  const managementData = [
    // First item: create card
    { id: "create", address: "Project Address", title: "Project Title", date: "Project Date" },
    // Then the normal items
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
    { address: "Project Address", title: "Project Title", date: "Project Date" },
  ];

  // We'll attach a single-time background to each management card
  const [managementCards, setManagementCards] = useState<
    Array<{
      id?: string;
      address: string;
      title: string;
      date: string;
      updatedDateTime?: string | null;
      background: string;
    }>
  >([]);

  // Feasibility data starts empty; we prepend one "create" card after fetch
  const [feasibilityCards, setFeasibilityCards] = useState<
    Array<{
      id: string;
      address: string;
      title: string;
      date: string;
      updatedDateTime?: string | null;
      background: string;
    }>
  >([]);

  // buildingMetricsRows for the first table
  const buildingMetricsRows = Array.from({ length: 20 }, (_, i) => ({
    projectName: `Project Name ${i + 1}`,
    siteArea: 100 + i * 50,
    totalApts: 10 + i,
    totalStoreys: 1 + i,
    nsa: 500 + i * 20,
    avgSize: 70 + i,
    ratio: (0.5 + i * 0.1).toFixed(2),
    commercial: i % 2 === 0 ? 0 : 80,
    basement: 300 + i * 10,
  }));

  // costMetricsRows for the second table
  const costMetricsRows = Array.from({ length: 20 }, (_, i) => ({
    item: `Cost Item ${i + 1}`,
    col1: `Data A${i + 1}`,
    col2: `Data B${i + 1}`,
    col3: `Data C${i + 1}`,
    col4: `Data D${i + 1}`,
    col5: `Data E${i + 1}`,
    col6: `Data F${i + 1}`,
    col7: `Data G${i + 1}`,
    col8: `Data H${i + 1}`,
  }));

  // 2) Function to smoothly scroll to the ChatGPT section
  function scrollToChatGPT() {
    const chatGPTEl = document.getElementById("chatgptSection");
    if (chatGPTEl) {
      chatGPTEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  useEffect(() => {
    (window as any).scrollToChatGPT = scrollToChatGPT;
    return () => {
      delete (window as any).scrollToChatGPT;
    };
  }, []);

  // 3) On mount, parse window.location.search for ?scroll=chatgpt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scroll") === "chatgpt") {
      scrollToChatGPT();
    }
  }, []);

  // Check the Supabase session
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      console.log("Supabase session data:", data);
    })();
  }, []);

  // Assign random background to each management card, once
  useEffect(() => {
    const cardsWithBG = managementData.map((item) => {
      return {
        ...item,
        id: item.id || "",
        updatedDateTime: null,
        background: getRandomGradient(),
      };
    });
    setManagementCards(cardsWithBG);
  }, []);

  // Fetch the user's feasibilities from supabase, prepend the "create" card.
  useEffect(() => {
    (async () => {
      const { data: feas, error } = await supabase
        .from("feasibilities")
        .select("*");

      if (error) {
        console.error("Error fetching feasibilities:", error);
      } else if (feas) {
        // Transform them
        let dynamicFeas = feas.map((f: any) => ({
          id: f.id,
          address: f.address || "Project Address",
          title: f.title || "Project Title",
          date: formatDateToDDMonthYYYY(
            f.updated_at?.slice(0, 10) || "Project Date"
          ),
          updatedDateTime: f.updated_at,
        }));

        // Sort by updatedDateTime DESC so most recent is first
        dynamicFeas.sort((a: any, b: any) => {
          if (!a.updatedDateTime && !b.updatedDateTime) return 0;
          if (!a.updatedDateTime) return 1;
          if (!b.updatedDateTime) return -1;
          return new Date(b.updatedDateTime).getTime() - new Date(a.updatedDateTime).getTime();
        });

        // Insert a "create" card at the front
        dynamicFeas.unshift({
          id: "create",
          address: "Project Address",
          title: "Project Title",
          date: "Project Date",
          updatedDateTime: null,
        });

        // Assign random gradient to each
        const feasWithBG = dynamicFeas.map((item: any) => ({
          ...item,
          background: getRandomGradient(),
        }));

        setFeasibilityCards(feasWithBG);
      }
    })();
  }, []);

  // Only change: function to create a new feasibility, then navigate to it
  async function handleCreateFeasibility() {
    try {
      // Insert a new feasibility row with placeholder data + "Neometro" as company_id
      const { data, error } = await supabase
        .from("feasibilities")
        .insert({
          address: "Project Address",
          title: "Project Title",
          company_id: "Neometro",
        })
        .select("*")
        .single();

      if (error) {
        console.error("Error creating feasibility:", error);
        return;
      }

      // Navigate to the newly created feasibility
      if (data && data.id) {
        navigate(`/feasibility/${data.id}`);
      }
    } catch (err) {
      console.error("Unexpected error creating feasibility:", err);
    }
  }

  return (
    <div className="dashboardContainer">
      <Header />

      <div className="dashboardMain">
        {/* MANAGEMENT SECTION */}
        <section className="dashboardSection">
          <h2>Management</h2>
          <div className="cardGrid">
            {managementCards.map((item, idx) => {
              // Special "create" card if item.id === "create"
              if (item.id === "create") {
                return (
                  <Link
                    href="/management/new"
                    key="management-new"
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="projectCard fade-in-card"
                      style={{
                        background: item.background,
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div className="projectCardInfo">
                        <div className="projectAddress">{item.address}</div>
                        <div className="projectTitle">{item.title}</div>
                      </div>
                      <div className="projectDate">{item.date}</div>

                      <AiOutlinePlus
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          fontSize: "4rem",
                          color: "#fff",
                          opacity: 0.9,
                        }}
                      />
                    </div>
                  </Link>
                );
              }

              // Normal card
              return (
                <div
                  key={idx}
                  className="projectCard fade-in-card"
                  style={{
                    background: item.background,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div className="projectCardInfo">
                    <div className="projectAddress">{item.address}</div>
                    <div className="projectTitle">{item.title}</div>
                  </div>
                  <div className="projectDate">
                    {formatDateToDDMonthYYYY(item.date)}
                    {/* Add the time under the date (bottom left) */}
                    <div style={{ textAlign: "left" }}>
                      {item.updatedDateTime ? formatTimeAMPM(item.updatedDateTime) : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FEASIBILITY SECTION */}
        <section className="dashboardSection">
          <h2>Feasibility</h2>
          <div className="cardGrid">
            {feasibilityCards.map((item) => {
              // If it's our special "create" card => handleCreateFeasibility
              if (item.id === "create") {
                return (
                  <div
                    key="feas-create"
                    className="projectCard fade-in-card"
                    style={{
                      background: item.background,
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                    onClick={handleCreateFeasibility}
                  >
                    <div className="projectCardInfo">
                      <div className="projectAddress">{item.address}</div>
                      <div className="projectTitle">{item.title}</div>
                    </div>
                    <div className="projectDate">
                      {item.date}
                      <div style={{ textAlign: "left" }}>
                        {item.updatedDateTime ? formatTimeAMPM(item.updatedDateTime) : ""}
                      </div>
                    </div>

                    <AiOutlinePlus
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: "4rem",
                        color: "#fff",
                        opacity: 0.9,
                      }}
                    />
                  </div>
                );
              }

              // Normal feasibility card
              return (
                <Link
                  href={`/feasibility/${item.id}`}
                  key={item.id}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="projectCard fade-in-card"
                    style={{
                      background: item.background,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="projectCardInfo">
                      <div className="projectAddress">{item.address}</div>
                      <div className="projectTitle">{item.title}</div>
                    </div>
                    <div className="projectDate">
                      {formatDateToDDMonthYYYY(item.date)}
                      <div style={{ textAlign: "left" }}>
                        {item.updatedDateTime ? formatTimeAMPM(item.updatedDateTime) : ""}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ margin: "0 2rem 2rem" }}>
        <button
          onClick={scrollToChatGPT}
          className="invisibleChatGPTBtn"
          style={{ padding: "0.5rem 1rem" }}
        >
          Scroll to ChatGPT
        </button>
      </div>

      <section className="askChatGPTSection">
        <section id="chatgptSection">
          <AskChatGPT />
        </section>
      </section>

      <section className="apartmentTableSection">
        <h2>Building Metric Database</h2>
        <div
          className="tenRowScrollContainer"
          style={{ width: "100%", overflowX: "auto" }}
        >
          {/* Ensure the table is 100% width */}
          <table className="apartmentTable" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Site Area</th>
                <th>Total Apartments</th>
                <th>Total Storeys</th>
                <th>NSA</th>
                <th>Average Size</th>
                <th>NSA / Site Area</th>
                <th>Commercial</th>
                <th>Basement</th>
              </tr>
            </thead>
            <tbody>
              {buildingMetricsRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.projectName}</td>
                  <td>{row.siteArea}</td>
                  <td>{row.totalApts}</td>
                  <td>{row.totalStoreys}</td>
                  <td>{row.nsa}</td>
                  <td>{row.avgSize}</td>
                  <td>{row.ratio}</td>
                  <td>{row.commercial}</td>
                  <td>{row.basement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="secondTableSection">
        <h2>Deep Cost Analysis</h2>
        <div className="tenRowScrollContainer" style={{ overflowX: "auto" }}>
          <table className="secondProjectTable">
            <thead>
              <tr>
                <th>Item</th>
                <th>Col 1</th>
                <th>Col 2</th>
                <th>Col 3</th>
                <th>Col 4</th>
                <th>Col 5</th>
                <th>Col 6</th>
                <th>Col 7</th>
                <th>Col 8</th>
              </tr>
            </thead>
            <tbody>
              {costMetricsRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.item}</td>
                  <td>{row.col1}</td>
                  <td>{row.col2}</td>
                  <td>{row.col3}</td>
                  <td>{row.col4}</td>
                  <td>{row.col5}</td>
                  <td>{row.col6}</td>
                  <td>{row.col7}</td>
                  <td>{row.col8}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/**
 * Returns a single JSON object combining the two table arrays:
 * - "buildingMetrics" from buildingMetricsRows
 * - "costMetrics" from costMetricsRows 
 */
export function getCombinedTableData() {
  const buildingMetricsRows = Array.from({ length: 20 }, (_, i) => ({
    projectName: `Project Name ${i + 1}`,
    siteArea: 100 + i * 50,
    totalApts: 10 + i,
    totalStoreys: 1 + i,
    nsa: 500 + i * 20,
    avgSize: 70 + i,
    ratio: (0.5 + i * 0.1).toFixed(2),
    commercial: i % 2 === 0 ? 0 : 80,
    basement: 300 + i * 10,
  }));

  const costMetricsRows = Array.from({ length: 20 }, (_, i) => ({
    item: `Cost Item ${i + 1}`,
    col1: `Data A${i + 1}`,
    col2: `Data B${i + 1}`,
    col3: `Data C${i + 1}`,
    col4: `Data D${i + 1}`,
    col5: `Data E${i + 1}`,
    col6: `Data F${i + 1}`,
    col7: `Data G${i + 1}`,
    col8: `Data H${i + 1}`,
  }));

  return {
    buildingMetrics: buildingMetricsRows,
    costMetrics: costMetricsRows,
  };
}
