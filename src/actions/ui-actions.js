import {
  SELECT_TOOL,
  DESELECT_TOOL,

  // fired by tool
  TRANSFORM_TOOLTIP_DRAG_START,
  TRANSFORM_TOOLTIP_DRAG,
  TRANSFORM_TOOLTIP_DRAG_COMPLETE,

  APPLY_COLOR_SCHEME,

  OPEN_OPTIONS_DIALOG,
  CLOSE_OPTIONS_DIALOG,

  OPEN_HOTKEY_INFO_DIALOG,
  CLOSE_HOTKEY_INFO_DIALOG,

  SET_NEW_BOUNDARY_TYPE,
  SET_NEW_OBJECT_TYPE,

  SET_VIEW_ALL_MODE,
  SET_VIEW_SELECTED_MODE,
  TOGGLE_SHOW_OBJECTS,
  TOGGLE_SELECT_INNER_ROOMS,

  OPEN_BOOKABLE_ROOM_DRAWER,
  CLOSE_BOOKABLE_ROOM_DRAWER,

  SET_SNAPPING_ENABLED
} from "../constants";

export const selectTool = (toolName) => ({
  type: SELECT_TOOL,
  toolName
});

export const deselectTool = () => ({
  type: DESELECT_TOOL
});

export const transformTooltopDragStart = (initialCornerOffset) => ({
  type: TRANSFORM_TOOLTIP_DRAG_START,
  initialCornerOffset
});

export const transformTooltopDrag = (initialCornerOffset, updatedCornerOffset) => ({
  type: TRANSFORM_TOOLTIP_DRAG,
  initialCornerOffset,
  updatedCornerOffset
});

export const transformTooltopDragComplete = (initialCornerOffset, updatedCornerOffset) => ({
  type: TRANSFORM_TOOLTIP_DRAG_COMPLETE,
  initialCornerOffset,
  updatedCornerOffset
});

export function applyColorScheme (colorScheme) {
  return {
    type: APPLY_COLOR_SCHEME,
    colorScheme
  };
}

export function openOptionsDialog () {
  return {
    type: OPEN_OPTIONS_DIALOG
  };
}

export function closeOptionsDialog () {
  return {
    type: CLOSE_OPTIONS_DIALOG
  };
}

export function openHotkeyInfoDialog () {
  return {
    type: OPEN_HOTKEY_INFO_DIALOG
  };
}

export function closeHotkeyInfoDialog () {
  return {
    type: CLOSE_HOTKEY_INFO_DIALOG
  };
}

export const setNewBoundaryType = (boundaryType) => ({
  type: SET_NEW_BOUNDARY_TYPE,
  boundaryType
});

export const setNewObjectType = (objectType) => ({
  type: SET_NEW_OBJECT_TYPE,
  objectType
});

export const setViewAllMode = () => ({
  type: SET_VIEW_ALL_MODE
});

export const setViewSelectedMode = () => ({
  type: SET_VIEW_SELECTED_MODE
});

export const toggleShowObjects = (showObjects) => ({
  type: TOGGLE_SHOW_OBJECTS,
  showObjects
});

export const toggleSelectInnerRooms = (selectInnerRooms) => ({
  type: TOGGLE_SELECT_INNER_ROOMS,
  selectInnerRooms
});

export const openBookableRoomDrawer = () => ({
  type: OPEN_BOOKABLE_ROOM_DRAWER
});

export const closeBookableRoomDrawer = () => ({
  type: CLOSE_BOOKABLE_ROOM_DRAWER
});

export function setSnappingEnabled (enabled = true) {
  return {
    type: SET_SNAPPING_ENABLED,
    enabled
  };
}
