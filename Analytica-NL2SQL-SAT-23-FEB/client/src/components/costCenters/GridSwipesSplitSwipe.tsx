import React, { useState } from "react";
import SwipeableViews from "react-swipeable-views";
import FeasibilityIndex from "./FeasibilityIndex";
import FeasibilityGrid from "./FeasibilityGrid";

interface GridSwipesSplitSwipeProps {
  feasibilityId: string;
}

export default function GridSwipesSplitSwipe({ feasibilityId }: GridSwipesSplitSwipeProps) {
  // Each panel maintains its own swipe index.
  const [leftSwipeIndex, setLeftSwipeIndex] = useState(0);
  const [rightSwipeIndex, setRightSwipeIndex] = useState(0);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "95.5vh",
        margin: 0,
        padding: 0,
        backgroundColor: "black", // Ensure the overall background is black
      }}
    >
      {/* Left Panel: Fixed at 50% width with a black border on the right */}
      <div
        style={{
          width: "50%",
          height: "95.5vh",
          borderRight: "1px solid black",
          margin: 0,
          padding: 0,
          backgroundColor: "black",
        }}
      >
        <SwipeableViews
          index={leftSwipeIndex}
          onChangeIndex={setLeftSwipeIndex}
          enableMouseEvents
          resistance
          containerStyle={{
            width: "100%",
            height: "95.5vh",
            backgroundColor: "black",
          }}
          style={{ backgroundColor: "black" }}
          slideStyle={{ backgroundColor: "black", margin: 0 }}
        >
          <div
            style={{
              width: "100%",
              height: "95.5vh",
              display: "flex",
              flexDirection: "column",
              margin: 0,
              padding: 0,
              backgroundColor: "black",
            }}
          >
            <FeasibilityIndex feasibilityId={feasibilityId} />
          </div>
          {/* Add more slides for the left panel if needed */}
        </SwipeableViews>
      </div>

      {/* Right Panel: Fixed at 50% width */}
      <div
        style={{
          width: "50%",
          height: "95.5vh",
          margin: 0,
          padding: 0,
          backgroundColor: "black",
        }}
      >
        <SwipeableViews
          index={rightSwipeIndex}
          onChangeIndex={setRightSwipeIndex}
          enableMouseEvents
          resistance
          containerStyle={{
            width: "100%",
            height: "95.5vh",
            backgroundColor: "black",
          }}
          style={{ backgroundColor: "black" }}
          slideStyle={{ backgroundColor: "black", margin: 0 }}
        >
          <div
            style={{
              width: "100%",
              height: "95.5vh",
              display: "flex",
              flexDirection: "column",
              margin: 0,
              padding: 0,
              backgroundColor: "black",
            }}
          >
            <FeasibilityGrid feasibilityId={feasibilityId} />
          </div>
          {/* Add more slides for the right panel if needed */}
        </SwipeableViews>
      </div>
    </div>
  );
}
