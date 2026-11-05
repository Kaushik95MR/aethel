export const STEP_KINDS = [
  { value: "pickup", label: "Pick-up", placeholder: "Bags on, bus at the kerb" },
  { value: "travel", label: "Travel", placeholder: "On the road" },
  { value: "trek", label: "Trek", placeholder: "Boots on, forest ahead" },
  { value: "activity", label: "Activity", placeholder: "Campfire and stories" },
  { value: "meal", label: "Meal", placeholder: "Hot dinner at camp" },
  { value: "stay", label: "Stay", placeholder: "Tents at base camp" },
  { value: "free_time", label: "Free time", placeholder: "Rest and explore" },
  { value: "drop_off", label: "Drop-off", placeholder: "Back in Bengaluru" },
] as const;

export type StepKind = (typeof STEP_KINDS)[number]["value"];

/** Sound scenes the trek page already knows. "Automatic" lets the site choose from the step kind and vehicle. */
export const SOUND_SCENES = [
  { value: "city", label: "City street" },
  { value: "bus", label: "Party bus" },
  { value: "forest", label: "Forest and birds" },
  { value: "summit", label: "Summit wind" },
  { value: "jeep", label: "Jeep ride" },
  { value: "camp", label: "Campfire" },
  { value: "night", label: "Quiet night" },
  { value: "morning", label: "Misty morning" },
  { value: "home", label: "Heading home" },
] as const;

export const stepLabel = (kind: string) => STEP_KINDS.find((k) => k.value === kind)?.label ?? kind;
