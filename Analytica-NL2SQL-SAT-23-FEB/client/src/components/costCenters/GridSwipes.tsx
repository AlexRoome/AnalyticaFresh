import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";
import SwipeableViews from "react-swipeable-views";
import FeasibilityIndex from "./FeasibilityIndex";
import FeasibilityGrid from "./FeasibilityGrid";
import { FeasibilitySummary } from "./FeasibilitySummary";
import GanttView from "../GanttView";
// Import the Invoices component from the pages folder
import Invoices from "../../pages/Invoices";
// Import the SidebarContext to determine which view to use
import { useSidebarContext } from "../../context/SidebarContext";

export default function GridSwipes() {
  // Extract feasibilityId (ignoring the extra parameter)
  const [match, params] = useRoute("/feasibility/:feasibilityId/:subpage?");
  const feasibilityId = params?.feasibilityId;

  useEffect(() => {
    console.log("Feasibility ID is:", feasibilityId);
  }, [feasibilityId]);

  // Retrieve slideIndex and isTwoPane from SidebarContext.
  const { slideIndex, setSlideIndex, isTwoPane } = useSidebarContext();
  const [leftSwipeIndex, setLeftSwipeIndex] = useState(0);
  const [rightSwipeIndex, setRightSwipeIndex] = useState(0);

  // Create the pages array—with the Invoices component as the fifth slide.
  const pages = [
    <FeasibilityIndex feasibilityId={feasibilityId} />,
    <FeasibilityGrid feasibilityId={feasibilityId} />,
    <FeasibilitySummary feasibilityId={feasibilityId} />,
    <GanttView feasibilityId={feasibilityId} />,
    <Invoices feasibilityId={feasibilityId} />
  ];

  if (isTwoPane) {
    return (
      <div style={{ display: "flex", width: "100%", height: "95.5vh" }}>
        {/* Left Panel */}
        <div
          style={{
            width: "50%",
            height: "95.5vh",
            borderRight: "0.5rem solid transparent"
          }}
        >
          <SwipeableViews
            index={leftSwipeIndex}
            onChangeIndex={setLeftSwipeIndex}
            enableMouseEvents
            resistance
            containerStyle={{ width: "100%", height: "95.5vh" }}
          >
            {pages.map((page, idx) => (
              <div
                key={idx}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {page}
              </div>
            ))}
          </SwipeableViews>
        </div>
        {/* Right Panel */}
        <div style={{ width: "50%", height: "95.5vh" }}>
          <SwipeableViews
            index={rightSwipeIndex}
            onChangeIndex={setRightSwipeIndex}
            enableMouseEvents
            resistance
            containerStyle={{ width: "100%", height: "95.5vh" }}
          >
            {pages.map((page, idx) => (
              <div
                key={idx}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {page}
              </div>
            ))}
          </SwipeableViews>
        </div>
      </div>
    );
  }

  // Single view mode.
  return (
    <div style={{ height: "95.5vh" }}>
      <SwipeableViews
        index={slideIndex}
        onChangeIndex={setSlideIndex}
        enableMouseEvents
        resistance
        containerStyle={{ width: "100%", height: "95.5vh" }}
      >
        {pages.map((page, idx) => (
          <div
            key={idx}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {page}
          </div>
        ))}
      </SwipeableViews>
    </div>
  );
}
