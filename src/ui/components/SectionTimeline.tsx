/**
 * SectionTimeline
 *
 * A full-width horizontal bar displaying musical sections as coloured blocks.
 * Clicking a block seeks playback to that section's start.
 * Integrates fill/groove/transition/intro/outro detection from sectionAnalyzer.
 */

import { SECTION_COLORS, sectionLabel } from "../../analysis/sectionAnalyzer";
import type { Section } from "../../analysis/sectionAnalyzer";
import type { PlayabilityMap } from "../../analysis/playabilityEngine";

interface SectionTimelineProps {
  sections: Section[];
  playabilityMap: PlayabilityMap;
  totalMeasures: number;
  onSeekToMeasure: (measure: number) => void;
}

const PlayabilityBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <span
      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow"
      title={`${count} problème(s) de jouabilité`}
    >
      {count > 9 ? "!" : count}
    </span>
  );
};

export const SectionTimeline = ({
  sections,
  playabilityMap,
  totalMeasures,
  onSeekToMeasure,
}: SectionTimelineProps) => {
  if (sections.length === 0 || totalMeasures === 0) return null;

  // Count playability issues per section
  const issuesInSection = (sec: Section): number => {
    let count = 0;
    for (let m = sec.startMeasure; m <= sec.endMeasure; m++) {
      if (playabilityMap[m]) count += playabilityMap[m].issues.length;
    }
    return count;
  };

  return (
    <div className="flex items-stretch gap-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80 text-xs">
      {/* Label */}
      <div className="flex shrink-0 items-center px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 border-r border-zinc-800">
        Sections
      </div>

      {/* Blocks */}
      {sections.map((sec, i) => {
        const { hex, label } = SECTION_COLORS[sec.type];
        const widthPct = (sec.measureCount / totalMeasures) * 100;
        const issueCount = issuesInSection(sec);

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeekToMeasure(sec.startMeasure)}
            className="relative flex items-center justify-center overflow-hidden border-r border-zinc-800/50 py-1.5 transition hover:brightness-125"
            style={{
              width:           `${widthPct}%`,
              minWidth:        sec.measureCount === 1 ? "16px" : "24px",
              backgroundColor: `${hex}22`,
              borderBottom:    `3px solid ${hex}`,
            }}
            title={`${label} — mesure ${sec.startMeasure + 1} à ${sec.endMeasure + 1} (${sec.measureCount}m)\nConfiance: ${Math.round(sec.confidence * 100)}%`}
          >
            <PlayabilityBadge count={issueCount} />
            {/* Only show label if block is wide enough */}
            {widthPct > 4 && (
              <span
                className="truncate text-[9px] font-semibold leading-none"
                style={{ color: hex }}
              >
                {sec.measureCount >= 3 ? sectionLabel(sec) : SECTION_COLORS[sec.type].label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
