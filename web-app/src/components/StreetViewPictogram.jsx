/**
 * StreetViewPictogram — animated SVG/CSS demo shown in the help modal's
 * Street View section. ~5-second loop: cursor approaches and clicks a
 * pulsing red loss shape on a mini-map, then before/after panels swap
 * in showing a tree-lined "before" street vs a barren "after" street.
 *
 * Honors prefers-reduced-motion: animation stops and only the
 * before/after panels frame is shown statically.
 *
 * The featured red blob is the silhouette of a real ~0.09-acre tree
 * loss from the dataset (24 vertices). The two smaller decorative
 * blobs are real ~0.07-acre losses too. No data props — the component
 * is self-contained and renders identically every time.
 */

const FEATURED_PATH =
  "M 71.81,53.16 L 71.00,54.00 L 66.01,51.99 L 59.33,48.40 L 49.32,45.49 L 46.48,42.08 L 44.51,35.73 L 38.75,33.23 L 31.28,31.06 L 28.82,23.13 L 22.29,21.24 L 23.08,16.26 L 26.59,14.53 L 28.24,6.00 L 28.61,6.45 L 39.20,11.78 L 46.73,19.17 L 50.41,25.56 L 59.42,27.30 L 65.37,32.89 L 76.83,36.22 L 77.71,40.10 L 75.72,50.71 L 71.81,53.16 Z"

const OTHER_PATH_1 =
  "M 64.22,6.00 L 67.62,34.95 L 75.90,44.74 L 75.81,49.73 L 74.89,48.70 L 70.73,42.37 L 50.54,43.38 L 48.69,54.00 L 33.21,49.73 L 27.64,45.98 L 24.10,41.15 L 26.98,36.71 L 29.80,26.47 L 44.82,20.68 L 44.38,18.59 L 44.40,18.63 L 52.96,21.14 L 55.08,15.21 L 60.85,13.10 L 62.80,7.62 L 64.22,6.00 Z"

const OTHER_PATH_2 =
  "M 69.02,14.48 L 76.34,21.81 L 72.90,22.88 L 68.85,26.69 L 62.12,31.36 L 66.60,41.78 L 39.17,39.24 L 40.49,51.07 L 36.41,54.00 L 23.66,50.78 L 24.04,42.19 L 36.11,39.08 L 34.03,20.47 L 36.74,18.52 L 38.81,14.81 L 46.37,15.01 L 52.08,7.73 L 57.02,6.00 L 61.17,9.38 L 69.02,14.48 Z"

function Tree({ trunkColor }) {
  return (
    <svg viewBox="0 0 30 56">
      <path d="M15 56 L15 12" stroke={trunkColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="20" rx="13" ry="11" fill="#2c5530" />
      <ellipse cx="11" cy="14" rx="9"  ry="8"  fill="#3d6e3d" />
      <ellipse cx="19" cy="13" rx="8"  ry="7"  fill="#4d8a4a" />
      <ellipse cx="14" cy="8"  rx="6"  ry="5"  fill="#5fa05a" />
    </svg>
  )
}

export default function StreetViewPictogram() {
  return (
    <div
      className="svp-stage"
      role="img"
      aria-label="Animated diagram: clicking a red shape on the map opens a before/after street view showing the trees that were lost."
    >
      {/* Phase 1: mini-map with curving streets and loss blobs */}
      <div className="svp-scene-map">
        <svg className="svp-streets" viewBox="0 0 360 220" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="#cdd2c4" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
            <path d="M -10 38 Q 70 30 140 50 T 280 46 T 380 38" />
            <path d="M 140 50 C 120 80 95 110 80 145 C 70 175 65 200 55 230" />
            <path d="M 140 50 C 160 80 195 115 215 150 C 235 180 240 210 245 235" />
            <path d="M 30 32 Q 18 18 -10 12" />
          </g>
          <g fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M -10 38 Q 70 30 140 50 T 280 46 T 380 38" />
            <path d="M 140 50 C 120 80 95 110 80 145 C 70 175 65 200 55 230" />
            <path d="M 140 50 C 160 80 195 115 215 150 C 235 180 240 210 245 235" />
            <path d="M 30 32 Q 18 18 -10 12" />
          </g>
        </svg>

        <svg className="svp-blob svp-blob--other-1" width="32" height="20" viewBox="0 0 100 60" aria-hidden="true">
          <path d={OTHER_PATH_1} />
        </svg>
        <svg className="svp-blob svp-blob--other-2" width="36" height="22" viewBox="0 0 100 60" aria-hidden="true">
          <path d={OTHER_PATH_2} />
        </svg>
        <svg className="svp-blob svp-blob--featured" width="72" height="48" viewBox="0 0 100 60" aria-hidden="true">
          <path d={FEATURED_PATH} />
        </svg>

        <svg className="svp-cursor" viewBox="0 0 24 32" aria-hidden="true">
          <path
            d="M3 2 L3 24 L9 18.5 L13 30 L17 28.5 L13 17 L21 17 Z"
            fill="#1a1a2e"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Phase 2: before/after panels */}
      <div className="svp-scene-panels" aria-hidden="true">
        <div className="svp-panel svp-panel--before">
          <div className="svp-panel-img">
            <div className="svp-sky"></div>
            <div className="svp-houses">
              <div className="svp-house svp-house--h1"></div>
              <div className="svp-house svp-house--h2"></div>
              <div className="svp-house svp-house--h3"></div>
            </div>
            <div className="svp-sidewalk"></div>
            <div className="svp-grass"></div>
            <div className="svp-road"><div className="svp-lane-line"></div></div>

            <div className="svp-tree svp-pos1 svp-s-md"><Tree trunkColor="#5a3a1c" /></div>
            <div className="svp-tree svp-pos2 svp-s-lg"><Tree trunkColor="#6b4423" /></div>
            <div className="svp-tree svp-pos3 svp-s-md"><Tree trunkColor="#5a3a1c" /></div>
            <div className="svp-tree svp-pos4 svp-s-lg"><Tree trunkColor="#6b4423" /></div>
            <div className="svp-tree svp-pos5 svp-s-sm"><Tree trunkColor="#5a3a1c" /></div>
          </div>
          <div className="svp-panel-cap">Before</div>
        </div>

        <div className="svp-panel svp-panel--after">
          <div className="svp-panel-img">
            <div className="svp-sky"></div>
            <div className="svp-houses">
              <div className="svp-house svp-house--h1"></div>
              <div className="svp-house svp-house--h2"></div>
              <div className="svp-house svp-house--h3"></div>
            </div>
            <div className="svp-sidewalk"></div>
            <div className="svp-grass"></div>
            <div className="svp-road"><div className="svp-lane-line"></div></div>

            <div className="svp-tree svp-pos1 svp-s-md"><Tree trunkColor="#5a3a1c" /></div>
            <div className="svp-tree svp-pos5 svp-s-sm"><Tree trunkColor="#5a3a1c" /></div>

            <div className="svp-stump svp-pos2"></div>
            <div className="svp-stump svp-pos3"></div>
            <div className="svp-stump svp-pos4"></div>
          </div>
          <div className="svp-panel-cap">After</div>
        </div>
      </div>
    </div>
  )
}
