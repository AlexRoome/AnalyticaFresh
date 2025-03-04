// ViewMode.tsx
import React from "react";
import { useRoute } from "wouter";
import { useSidebarContext } from "../../context/SidebarContext";
import GridSwipes from "./GridSwipes";
import GridSwipesSplitSwipe from "./GridSwipesSplitSwipe";

export default function ViewMode() {
  const { isTwoPane } = useSidebarContext();
  const [match, params] = useRoute("/feasibility/:feasibilityId");
  const feasibilityId = params?.feasibilityId;

  return isTwoPane ? (
    <GridSwipesSplitSwipe feasibilityId={feasibilityId} />
  ) : (
    <GridSwipes />
  );
}
