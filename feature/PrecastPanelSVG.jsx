// src/features/design/modules/PrecastPanelSVG.jsx
import React, { useId, useMemo } from 'react';

/* ----------------------------------------------------------------------------
DEFAULT INPUTS SOURCE
PrecastPanelConfig.js → DEFAULT_INPUTS is the single source of truth for
input names, units and default values. It is shared by:
  - PrecastPanel.jsx            (UI input model)
  - PrecastPanelCalculation.js  (calculation engine)
  - PrecastPanelSVG.jsx         (this diagram)
so the diagram always stays aligned with the UI and the calculation engine.
---------------------------------------------------------------------------- */
import { DEFAULT_INPUTS } from './PrecastPanelConfig';

/* ============================================================================
HELPERS
========================================================================== */
const safe = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const positive = (value, fallback = 0) =>
  Math.max(0, safe(value, fallback));

const clamp = (value, min, max) =>
  Math.min(Math.max(safe(value), min), max);

const fmt = (value, digits = 2, fallback = '-') => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
};

const mm = value => safe(value) * 1000;

/* ============================================================================
RESULTS ADAPTER  (PrecastPanelCalculation output  →  SVG display model)
========================================================================== */
const buildSVGResults = (rawResults = {}, input = {}) => {
  const engine = rawResults || {};
  const inPlane = engine.inPlane || {};
  const outOfPlane = engine.outOfPlane || {};
  const summary = engine.summary || {};
  const checks = inPlane.checks || {};
  const hasEngineData = Boolean(engine.inPlane || engine.outOfPlane);

  /* ---- In-plane geometry ------------------------------------------------- */
  const geometry = inPlane.geometry || {};
  const b = positive(geometry.b, positive(input.wallWidth, 3));
  const h = positive(geometry.h, positive(input.wallHeight, 4));
  const t = positive(geometry.t, positive(input.wallThickness, 0.15));

  /* ---- In-plane section actions ------------------------------------------ */
  const sectionActions = inPlane.sectionActions || {};
  const N = safe(sectionActions.NseismicCompression);
  const M = safe(sectionActions.Mtotal);
  const V = safe(sectionActions.Vtotal);

  const gravity = inPlane.gravity || {};
  const seismic = inPlane.seismic || {};

  /* ---- Reinforcement ------------------------------------------------------ */
  const reinforcement = inPlane.reinforcement || {};
  const vSpace = positive(input.VbarSpace);
  const vCount = vSpace > 0
    ? Math.floor(b * 1000 / vSpace) + 1
    : positive(input.verticalBarCount, 4);

  /* ---- Out-of-plane actions ----------------------------------------------- */
  const Ma = safe(outOfPlane.Ma);
  const M_prime = safe(outOfPlane.M_prime);
  const WE = safe(outOfPlane.WE);
  const WindPressure = safe(outOfPlane.WindPressure, positive(input.wwf));
  const delta_u = safe(outOfPlane.delta_u);

  const magnification = Ma > 0 && Number.isFinite(M_prime) && M_prime > 0
    ? M_prime / Ma
    : 1;

  const hroofEff = safe(
    outOfPlane.hroofValidation ? outOfPlane.hroofValidation.hroofEffective : undefined,
    positive(input.hroof)
  );
  const hroof_mm = hroofEff * 1000;
  const Pcr = hroof_mm > 0
    ? (0.75 * 48 * safe(outOfPlane.Ec) * safe(outOfPlane.Icr)) / (5 * hroof_mm * hroof_mm)
    : 0;

  /* ---- Slenderness --------------------------------------------------------- */
  const slendernessInfo = inPlane.slenderness || {};
  const slenderness = safe(slendernessInfo.outOfPlaneSlenderness, t > 0 ? h / t : 0);

  /* ---- Foundation geometry -------------------------------------------------- */
  const footingLength = positive(outOfPlane.footingWidth) > 0
    ? positive(outOfPlane.footingWidth) / 1000
    : positive(input.footingLength, 3.0);
  const footingThickness = positive(input.tf) > 0
    ? positive(input.tf) / 1000
    : positive(input.footingThickness, 0.40);

  /* ---- Governing utilisation ratio ------------------------------------------- */
  const urEntries = [
    { key: 'UR1', label: 'Mid-height flexure (P-Δ)', ur: Number(outOfPlane.UR1) },
    { key: 'UR2', label: 'Base moment', ur: Number(outOfPlane.UR2) },
    { key: 'UR3', label: 'Fire', ur: Number(outOfPlane.UR3) },
    { key: 'UR4', label: 'Shear', ur: Number(outOfPlane.UR4) },
    { key: 'UR5', label: 'Foundation bearing', ur: Number(outOfPlane.UR5) },
    { key: 'UR6', label: 'Footing flexure', ur: Number(outOfPlane.UR6) }
  ].filter(item => Number.isFinite(item.ur));

  const governing = urEntries.length > 0
    ? urEntries.reduce((max, item) => (item.ur > max.ur ? item : max), urEntries[0])
    : null;

  const interactionPass = hasEngineData ? checks.interactionPass === true : true;
  const shearPass = hasEngineData ? checks.shearPass === true : true;
  const oopFlexurePass = hasEngineData
    ? Number.isFinite(outOfPlane.UR1) && outOfPlane.UR1 <= 1
    : true;
  const oopStabilityPass = oopFlexurePass;
  const overallPass = hasEngineData ? summary.overallPass === true : true;

  return {
    engine,
    meta: engine.meta,
    geometry: { b, h, t, tMm: t * 1000, Ag: geometry.Ag, I: geometry.I, Zg: geometry.Zg },
    reinforcement: {
      vCount,
      hSpacing: positive(input.HbarSpace, positive(input.horizontalBarSpacing, 200)),
      cover: positive(input.cover, 30),
      boundaryWidthMm: positive(input.boundaryWidth) * 1000,
      AsDistributed: reinforcement.AsDistributed,
      AsBoundary: reinforcement.AsBoundary,
      boundarySteelTensionCapacity: reinforcement.boundarySteelTensionCapacity
    },
    actions: {
      gravity: {
        NService: safe(gravity.Ngravity),
        Gwall: safe(gravity.Gwall),
        GlineTotal: safe(gravity.GlineTotal),
        QlineTotal: safe(gravity.QlineTotal),
        gLineLoad: safe(gravity.gLineLoad),
        qLineLoad: safe(gravity.qLineLoad)
      },
      seismic: {
        baseShear: safe(seismic.Vseismic),
        Mseismic: safe(seismic.Mseismic),
        Cd: safe(seismic.Cd)
      },
      wind: { pressure: WindPressure },
      section: {
        inPlane: { N, M, V },
        outOfPlane: { M: M_prime, Ma, seismicPressure: WE, windPressure: WindPressure }
      }
    },
    inPlane: {
      ...inPlane,
      actions: { N, M, V },
      pmInteraction: {
        ratio: safe(inPlane.interaction ? inPlane.interaction.interactionRatio : undefined),
        check: { pass: interactionPass }
      },
      shear: {
        ratio: safe(inPlane.shear ? inPlane.shear.shearRatio : undefined),
        check: { pass: shearPass }
      }
    },
    outOfPlane: {
      ...outOfPlane,
      actions: { M: M_prime, Ma, seismicPressure: WE, windPressure: WindPressure },
      stability: {
        M2: M_prime,
        slenderness,
        magnification,
        deltaElastic: delta_u,
        Pcr,
        stabilityCheck: { pass: oopStabilityPass }
      },
      flexure: {
        phiMn: safe(outOfPlane.phiMn),
        check: { pass: oopFlexurePass }
      }
    },
    lintel: {
      bearing: {
        P: safe(input.lintelReaction),
        e: safe(input.lintelEccentricity),
        ratio: safe(inPlane.bearing ? inPlane.bearing.bearingRatio : undefined),
        pass: hasEngineData ? checks.bearingPass === true : true
      }
    },
    foundation: { footingLength, footingThickness },
    summary: { ...summary, governing, overallPass }
  };
};

/* ============================================================================
MAIN COMPONENT
========================================================================== */
const PrecastPanelSVG = ({
  inputs = {},
  results: rawResults = {},
  width = '100%',
  height = 'auto',
  showDimensions = true,
  showLoads = true,
  showReinforcement = true,
  showResults = true,
  showLabels = true,
  showFoundation = true,
  showLintel = true,
  compact = false,
  className = '',
  style = {}
}) => {
  /* Unified input model — same DEFAULT_INPUTS as PrecastPanel.jsx */
  const input = { ...DEFAULT_INPUTS, ...(inputs || {}) };

  /* Normalise the calculation-engine results into the display model. */
  const results = buildSVGResults(rawResults, input);

  /* --------------------------------------------------------------------------
  Geometry & Results Extraction
  ------------------------------------------------------------------------ */
  const geometry = results.geometry || {};
  const wallWidth = positive(geometry.b, positive(input.wallWidth, 3));
  const wallHeight = positive(geometry.h, positive(input.wallHeight, 4));
  const wallThickness = positive(geometry.t, positive(input.wallThickness, 0.15));
  const wallThicknessMm = positive(geometry.tMm, mm(wallThickness));

  const reinforcement = results.reinforcement || {};
  const verticalBarCount = positive(reinforcement.vCount, positive(input.verticalBarCount, 4));
  const horizontalBarSpacing = positive(reinforcement.hSpacing, positive(input.horizontalBarSpacing, 200));

  const actions = results.actions || {};
  const gravity = actions.gravity || {};
  const seismic = actions.seismic || {};
  const wind = actions.wind || {};
  const sectionActions = actions.section || {};

  const inPlaneActions = results.inPlane?.actions || sectionActions.inPlane || {};
  const outOfPlaneActions = results.outOfPlane?.actions || sectionActions.outOfPlane || {};

  const inPlaneN = safe(inPlaneActions.N);
  const inPlaneM = safe(inPlaneActions.M);
  const inPlaneV = safe(inPlaneActions.V);

  const oopM = safe(results.outOfPlane?.stability?.M2, outOfPlaneActions.M);
  const windPressure = safe(wind.pressure, input.windPressure);

  /* NEW — fire load values consumed by the fire graphic (OOP right side) */
  const firePressure = safe(input.wf);
  const fireDuration = safe(input.th);

  const seismicInPlaneShear = safe(seismic.baseShear, inPlaneV);
  const seismicOutOfPlanePressure = safe(outOfPlaneActions.seismicPressure, 0);

  const stability = results.outOfPlane?.stability || {};
  const slenderness = safe(stability.slenderness, mm(wallHeight) / Math.max(mm(wallThickness), 1e-9));
  const magnification = safe(stability.magnification, 1);
  const deltaElastic = safe(stability.deltaElastic, 0);

  const lintel = results.lintel?.bearing || {};
  const lintelReaction = safe(lintel.P, input.lintelReaction);
  const lintelEccentricity = safe(input.lintelEccentricity, 0.30);

  const foundation = results.foundation || {};
  const footingLength = positive(foundation.footingLength, positive(input.footingLength, wallWidth));
  const footingThickness = positive(foundation.footingThickness, positive(input.footingThickness, 0.40));

  const summary = results.summary || {};
  const governing = summary.governing || null;
  const governingUR = governing ? safe(governing.ur) : 0;
  const overallPass = summary.overallPass !== undefined ? summary.overallPass : true;

  /* ==========================================================================
  SVG GEOMETRY
  ========================================================================== */
  const viewBox = compact ? { width: 1480, height: 660 } : { width: 1680, height: 660 };

  const drawing = useMemo(() => {
    const leftA = compact ? 195 : 225;
    const panelW = compact ? 420 : 470;
    const rightA = leftA + panelW;
    const gap = compact ? 220 : 260;
    const leftB = rightA + gap;
    const top = compact ? 100 : 95;
    const groundY = compact ? 475 : 500;
    const maxWallHeightPx = groundY - top;
    const maxWallWidthPx = panelW;
    const scaleX = maxWallWidthPx / Math.max(wallWidth, 0.1);
    const scaleY = maxWallHeightPx / Math.max(wallHeight, 0.1);
    const scale = Math.min(scaleX, scaleY);
    const wallW = wallWidth * scale;
    const wallH = wallHeight * scale;
    const wallX = leftA + (maxWallWidthPx - wallW) / 2;
    const wallY = groundY - wallH;
    const wallT = Math.max(10, wallThickness * scale);
    const footingScale = Math.max(scale, 90);
    const footingW = Math.min(Math.max(wallW + 80, 200), panelW + 60);
    const footingH = Math.max(35, footingThickness * footingScale);
    const footingX = wallX + wallW / 2 - footingW / 2;
    return { leftA, rightA, leftB, panelW, shiftX: leftB - leftA, top, groundY, scale, wallW, wallH, wallX, wallY, wallT, footingW, footingH, footingX };
  }, [compact, wallWidth, wallHeight, wallThickness, footingThickness]);

  const reactId = useId().replace(/:/g, '');
  const ids = {
    arrow: `pp-arrow-${reactId}`,
    arrowSmall: `pp-arrow-small-${reactId}`,
    tick: `pp-tick-${reactId}`,
    load: `pp-load-${reactId}`,
    moment: `pp-moment-${reactId}`,
    seismic: `pp-seismic-${reactId}`,
    wind: `pp-wind-${reactId}`,
    fire: `pp-fire-${reactId}` /* NEW — fire load arrow marker */
  };

  const { leftA, rightA, leftB, panelW, shiftX, wallX, wallY, wallW, wallH, wallT, groundY, footingX, footingW, footingH } = drawing;

  const wallCentreX = wallX + wallW / 2;
  const wallCentreY = wallY + wallH * 0.45;
  const wallRightX = wallX + wallW;
  const wallBottomY = wallY + wallH;
  const footingBottomY = groundY + footingH;
  const panelACentreX = (leftA + rightA) / 2;
  const panelBCentreX = leftB + panelW / 2;

  /* ==========================================================================
  HELPERS & SUB-COMPONENTS
  ========================================================================== */
  const Text = ({ x, y, children, size = 14, weight = 500, anchor = 'start', fill = '#202124', italic = false }) => (
    <text x={x} y={y} textAnchor={anchor} style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", fontSize: size, fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', fill, dominantBaseline: 'middle' }}>
      {children}
    </text>
  );

  const DimText = ({ x, y, children, anchor = 'middle' }) => (
    <Text x={x} y={y} anchor={anchor} size={13} weight={500} fill="#4b5563" italic>{children}</Text>
  );

  const ResultText = ({ x, y, label, value, unit, pass }) => (
    <g>
      <Text x={x} y={y} size={12} fill="#4b5563">{label}</Text>
      <Text x={x} y={y + 17} size={14} weight={700} fill={pass === false ? '#b91c1c' : '#166534'}>{value} {unit}</Text>
    </g>
  );

  const LoadArrow = ({ x1, y1, x2, y2, marker = ids.load, label = undefined, labelX = undefined, labelY = undefined, labelAnchor = 'middle', stroke = '#2563eb' }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" markerEnd={`url(#${marker})`} />
      {label && (
        <Text x={labelX !== undefined ? labelX : (x1 + x2) / 2} y={labelY !== undefined ? labelY : (y1 + y2) / 2} size={12} weight={600} fill={stroke} anchor={labelAnchor}>
          {label}
        </Text>
      )}
    </g>
  );

  const MomentSymbol = ({ x, y, direction = 'right', label, value, flipped = false }) => {
    const path = direction === 'right'
      ? `M ${x - 24} ${y + 28} C ${x - 5} ${y + 42}, ${x + 25} ${y + 18}, ${x + 22} ${y - 4}`
      : `M ${x + 24} ${y + 28} C ${x + 5} ${y + 42}, ${x - 25} ${y + 18}, ${x - 22} ${y - 4}`;
    const curve = (<path d={path} fill="none" stroke="#7c3aed" strokeWidth="2.5" markerEnd={`url(#${ids.moment})`} />);
    return (
      <g>
        {flipped ? (<g transform={`rotate(180 ${x} ${y + 14})`}>{curve}</g>) : curve}
        {label && (<Text x={x} y={y + 50} anchor="middle" size={12} weight={600} fill="#6d28d9">{label}</Text>)}
        {value !== undefined && (<Text x={x} y={y + 66} anchor="middle" size={11} fill="#6d28d9">{fmt(value, 2)} kN·m</Text>)}
      </g>
    );
  };

  /* ==========================================================================
  CORE ELEMENTS + VIEW COMPONENTS
  ========================================================================== */
  const boundaryWidthMm = positive(reinforcement.boundaryWidthMm, mm(input.boundaryWidth));
  const boundaryWidthPx = Math.max(15, boundaryWidthMm / 1000 * drawing.scale);

  const reinforcementElements = [];
  if (showReinforcement) {
    const coverPx = Math.max(3, positive(reinforcement.cover, positive(input.cover, 30)) / 1000 * drawing.scale);
    const verticalCount = clamp(Math.round(verticalBarCount), 2, 18);
    for (let i = 0; i < verticalCount; i += 1) {
      const ratio = verticalCount === 1 ? 0.5 : i / (verticalCount - 1);
      const x = wallX + coverPx + ratio * Math.max(wallW - 2 * coverPx, 2);
      reinforcementElements.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={wallY + 10}
          x2={x}
          y2={wallBottomY - 10}
          stroke="#dc2626"
          strokeWidth={i === 0 || i === verticalCount - 1 ? 2.5 : 1.3}
          opacity="0.78"
        />
      );
    }
    const horizontalCount = clamp(
      Math.floor(mm(wallHeight) / Math.max(horizontalBarSpacing, 1)),
      2,
      20
    );
    for (let i = 1; i < horizontalCount; i += 1) {
      const ratio = i / horizontalCount;
      const y = wallY + ratio * wallH;
      reinforcementElements.push(
        <line
          key={`h-${i}`}
          x1={wallX + 8}
          y1={y}
          x2={wallRightX - 8}
          y2={y}
          stroke="#dc2626"
          strokeWidth="1"
          opacity="0.40"
        />
      );
    }
  }

  const lintelW = Math.max(120, boundaryWidthPx + 50);
  const lintelX = wallRightX + 6;
  const lintelCx = lintelX;

  /* --------------------------------------------------------------------------
  IN-PLANE WALL COMPONENT
  ------------------------------------------------------------------------ */
  const InPlaneWallGraphic = ({ xOffset = 0, yOffset = 0 }) => (
    <g transform={`translate(${xOffset},${yOffset})`}>
      {showFoundation && (
        <>
          <rect
            x={footingX}
            y={groundY}
            width={footingW}
            height={footingH}
            fill={`url(#concrete-${reactId})`}
            stroke="#1f2937"
            strokeWidth="2"
          />
          <line
            x1={footingX}
            y1={groundY + footingH / 2}
            x2={footingX + footingW}
            y2={groundY + footingH / 2}
            stroke="#9ca3af"
            strokeDasharray="4 4"
          />
          {showLabels && (
            <Text x={footingX + footingW / 2} y={footingBottomY + 28} anchor="middle" size={12} fill="#4b5563">
              Foundation / footing
            </Text>
          )}
        </>
      )}
      <rect
        x={wallX}
        y={wallY}
        width={wallW}
        height={wallH}
        fill={`url(#concrete-${reactId})`}
        stroke="#111827"
        strokeWidth="2.5"
      />
      {showReinforcement && (
        <>
          {reinforcementElements}
          <rect x={wallX} y={wallY} width={boundaryWidthPx} height={wallH} fill="none" stroke="#991b1b" strokeWidth="2" strokeDasharray="6 4" />
          <rect x={wallRightX - boundaryWidthPx} y={wallY} width={boundaryWidthPx} height={wallH} fill="none" stroke="#991b1b" strokeWidth="2" strokeDasharray="6 4" />
        </>
      )}
      {showLabels && (
        <Text x={wallX - 8} y={wallBottomY + 22} size={11} anchor="end" fill="#4b5563">
          Base support
        </Text>
      )}
    </g>
  );

  /* --------------------------------------------------------------------------
  IN-PLANE DIMENSIONS COMPONENT
  ------------------------------------------------------------------------ */
  const InPlaneDimensionsGraphic = ({ xOffset = 0, yOffset = 0 }) => {
    if (!showDimensions) return null;
    return (
      <g transform={`translate(${xOffset},${yOffset})`}>
        <line
          x1={wallX - 120}
          y1={wallY}
          x2={wallX - 120}
          y2={wallBottomY}
          stroke="#4b5563"
          strokeWidth="1"
          markerStart={`url(#${ids.tick})`}
          markerEnd={`url(#${ids.tick})`}
        />
        <line x1={wallX - 120} y1={wallY} x2={wallX - 100} y2={wallY} stroke="#9ca3af" strokeDasharray="3 3" />
        <line x1={wallX - 120} y1={wallBottomY} x2={wallX - 5} y2={wallBottomY} stroke="#9ca3af" strokeDasharray="3 3" />
        <DimText x={wallX - 142} y={wallY + wallH / 2}>
          H = {fmt(wallHeight, 2)} m
        </DimText>
        <line
          x1={wallX}
          y1={footingBottomY + 42}
          x2={wallRightX}
          y2={footingBottomY + 42}
          stroke="#4b5563"
          strokeWidth="1"
          markerStart={`url(#${ids.tick})`}
          markerEnd={`url(#${ids.tick})`}
        />
        <line x1={wallX} y1={wallBottomY + 3} x2={wallX} y2={footingBottomY + 47} stroke="#9ca3af" strokeDasharray="3 3" />
        <line x1={wallRightX} y1={wallBottomY + 3} x2={wallRightX} y2={footingBottomY + 47} stroke="#9ca3af" strokeDasharray="3 3" />
        <DimText x={wallCentreX} y={footingBottomY + 61}>
          W = {fmt(wallWidth, 2)} m
        </DimText>
      </g>
    );
  };

  /* --------------------------------------------------------------------------
  IN-PLANE LOAD COMPONENT
  ------------------------------------------------------------------------ */
  const InPlaneLoadsGraphic = ({ xOffset = 0, yOffset = 0 }) => {
    if (!showLoads) return null;
    return (
      <g transform={`translate(${xOffset},${yOffset})`}>
        {showLintel && lintelReaction > 0 && (
          <g>
            <rect x={lintelX} y={wallY} width={lintelW} height="26" fill="#e5e7eb" stroke="#111827" strokeWidth="2" />
            <LoadArrow
              x1={lintelCx}
              y1={wallY - 48}
              x2={lintelCx}
              y2={wallY - 6}
              marker={ids.load}
              label={`Lintel R = ${fmt(lintelReaction, 1)} kN`}
              labelX={lintelCx + 58}
              labelY={wallY - 42}
              stroke="#2563eb"
            />
            {showLabels && (
              <Text x={lintelCx} y={wallY + 44} size={10} fill="#374151" anchor="middle">
                e = {fmt(lintelEccentricity, 2)} m
              </Text>
            )}
          </g>
        )}

        {gravity.NService > 0 && (
          <g>
            <line x1={wallX} y1={wallY} x2={wallRightX} y2={wallY} stroke="#1d4ed8" strokeWidth="3" />
            {Array.from({ length: clamp(Math.round(wallW / 55), 4, 14) }).map((_, i, arr) => {
              const x = wallX + (i + 0.5) * wallW / arr.length;
              return (
                <line
                  key={`topload-${i}`}
                  x1={x}
                  y1={wallY - 26}
                  x2={x}
                  y2={wallY - 5}
                  stroke="#2563eb"
                  strokeWidth="1.6"
                  markerEnd={`url(#${ids.load})`}
                />
              );
            })}
            {showLabels && (
              <Text x={wallCentreX} y={wallY + 18} anchor="middle" size={12} fill="#1d4ed8">
                Gravity / roof load
              </Text>
            )}
          </g>
        )}

        {Math.abs(inPlaneN) > 0 && (
          <g>
            <line
              x1={wallCentreX}
              y1={Math.max(wallY - 75, 16)}
              x2={wallCentreX}
              y2={wallY - 40}
              stroke="#1d4ed8"
              strokeWidth="2.5"
              markerEnd={`url(#${ids.arrow})`}
            />
            <Text x={wallCentreX + 12} y={Math.max(wallY - 78, 12)} size={12} weight={600} fill="#1d4ed8">
              N* = {fmt(inPlaneN, 1)} kN
            </Text>
          </g>
        )}

        {Math.abs(seismicInPlaneShear) > 0 && (
          <g>
            <LoadArrow
              x1={wallX - 90}
              y1={wallY}
              x2={wallX - 10}
              y2={wallY}
              marker={ids.seismic}
              stroke="#ea580c"
            />
            <Text x={wallX - 12} y={wallY + 18} size={12} weight={600} fill="#ea580c" anchor="end">
              SEISMIC V*
            </Text>
            <Text x={wallX - 12} y={wallY + 34} size={11} fill="#c2410c" anchor="end">
              {fmt(seismicInPlaneShear, 2)} kN
            </Text>
          </g>
        )}

        {Math.abs(inPlaneM) > 0 && (
          <MomentSymbol
            x={wallCentreX}
            y={wallCentreY - 30}
            direction="left"
            flipped
            label="IN-PLANE M*"
            value={inPlaneM}
          />
        )}

        <LoadArrow
          x1={wallX + 10}
          y1={wallBottomY + 52}
          x2={wallX + 10}
          y2={wallBottomY + 8}
          marker={ids.load}
          label="Tension / uplift"
          labelX={wallX - 50}
          labelY={wallBottomY + 66}
          labelAnchor="start"
          stroke="#dc2626"
        />
        <LoadArrow
          x1={wallRightX - 10}
          y1={wallBottomY + 8}
          x2={wallRightX - 10}
          y2={wallBottomY + 52}
          marker={ids.load}
          label="Compression"
          labelX={wallRightX + 50}
          labelY={wallBottomY + 66}
          labelAnchor="end"
          stroke="#16a34a"
        />
        <LoadArrow
          x1={wallCentreX - 42}
          y1={wallBottomY + 30}
          x2={wallCentreX + 42}
          y2={wallBottomY + 30}
          marker={ids.load}
          label={`V = ${fmt(inPlaneV, 1)} kN`}
          labelX={wallCentreX}
          labelY={wallBottomY + 46}
          stroke="#4f46e5"
        />
      </g>
    );
  };

  /* ==========================================================================
  OOP CROSS-SECTION GEOMETRY (Parameterized)
  ========================================================================== */
  const oopGeo = useMemo(() => {
    const wH = drawing.wallH;
    const wY = drawing.wallY;
    const gY = drawing.groundY;
    const sc = drawing.scale;
    const wT = Math.max(Math.round(wallThickness * sc), 18);
    const fT = Math.max(Math.round(footingThickness * sc), 20);
    const fL = Math.max(Math.round(footingLength * sc * 0.35), 100);
    const hfT = Math.max(Math.round(footingThickness * sc * 0.4), 12);
    const sT = Math.max(Math.round(footingThickness * sc * 0.4), 12);
    const sL = fL + 100;
    const bT = 22;
    const bW = wT + 40;
    const rT = 15;
    const rL = Math.max(Math.round(wallWidth * sc * 0.12), 80);
    const rOffset = 30;
    // Centering logic
    const totalW = wT + sL;
    const offsetX = Math.max((panelW - totalW) / 2, 120);
    const wX = offsetX;
    const fX = wX + wT;
    const hfX = fX;
    const sX = fX;
    const rX = wX + wT;
    const bX = wX + wT / 2 - bW / 2;
    const clX = wX + wT / 2;
    return { sc, wH, wT, wX, wY, fT, fL, fX, hfT, hfX, sT, sL, sX, rT, rL, rX, rY: wY + rOffset, bT, bW, bX, clX, gY };
  }, [compact, wallHeight, wallThickness, footingThickness, footingLength, wallWidth, drawing, panelW]);

  /* --------------------------------------------------------------------------
  OUT-OF-PLANE WALL COMPONENT
  ------------------------------------------------------------------------ */
  const OutOfPlaneWallGraphic = ({ xOffset = 0, yOffset = 0 }) => (
    <g transform={`translate(${xOffset},${yOffset})`}>
      <rect x={oopGeo.bX} y={oopGeo.gY} width={oopGeo.bW} height={oopGeo.bT} fill="#f5f5f5" stroke="#222" strokeWidth="2" />
      <rect x={oopGeo.fX} y={oopGeo.gY - oopGeo.fT} width={oopGeo.fL} height={oopGeo.fT} fill="#f5f5f5" stroke="#222" strokeWidth="2" />
      <rect x={oopGeo.wX} y={oopGeo.wY} width={oopGeo.wT} height={oopGeo.wH} fill="#f5f5f5" stroke="#222" strokeWidth="2" />
      <rect x={oopGeo.hfX} y={oopGeo.gY - oopGeo.fT - oopGeo.hfT} width={oopGeo.fL} height={oopGeo.hfT} fill="#e8e8e8" stroke="#666" strokeWidth="1" strokeDasharray="2 2" />
      <rect x={oopGeo.sX} y={oopGeo.gY - oopGeo.fT - oopGeo.hfT - oopGeo.sT} width={oopGeo.sL} height={oopGeo.sT} fill="#f5f5f5" stroke="#222" strokeWidth="2" />
      <rect x={oopGeo.rX} y={oopGeo.rY} width={oopGeo.rL} height={oopGeo.rT} fill="#e0e0e0" stroke="#222" strokeWidth="1.5" />
      <line x1={oopGeo.clX} y1={oopGeo.gY} x2={oopGeo.clX} y2={oopGeo.wY} stroke="#cc0000" strokeWidth="1.5" strokeDasharray="4 2" />
      {showLabels && (
        <>
          <Text x={oopGeo.wX + oopGeo.wT / 2} y={oopGeo.gY + oopGeo.bT + 20} anchor="middle" size={11} fill="#4b5563">
            Base support
          </Text>
          <Text x={oopGeo.rX + oopGeo.rL / 2} y={oopGeo.rY - 8} anchor="middle" size={10} fill="#4b5563">
            Roof / floor slab
          </Text>
          <Text x={oopGeo.sX + oopGeo.sL / 2} y={oopGeo.gY - oopGeo.fT - oopGeo.hfT - oopGeo.sT + oopGeo.sT + 14} anchor="middle" size={10} fill="#4b5563">
            Slab on grade
          </Text>
        </>
      )}
    </g>
  );

  /* --------------------------------------------------------------------------
  OUT-OF-PLANE DIMENSIONS COMPONENT
  ------------------------------------------------------------------------ */
  const OutOfPlaneDimensionsGraphic = ({ xOffset = 0, yOffset = 0 }) => {
    if (!showDimensions) return null;
    return (
      <g transform={`translate(${xOffset},${yOffset})`}>
        <line
          x1={oopGeo.wX - 240}
          y1={oopGeo.wY}
          x2={oopGeo.wX - 240}
          y2={oopGeo.gY}
          stroke="#555"
          strokeWidth="1"
          markerStart={`url(#${ids.tick})`}
          markerEnd={`url(#${ids.tick})`}
        />
        <DimText x={oopGeo.wX - 240} y={oopGeo.wY + oopGeo.wH / 2} anchor="middle">
          H = {fmt(wallHeight, 2)} m
        </DimText>
        <line x1={oopGeo.wX - 240} y1={oopGeo.wY} x2={oopGeo.wX} y2={oopGeo.wY} stroke="#9ca3af" strokeDasharray="2 2" />
        <line x1={oopGeo.wX - 240} y1={oopGeo.gY} x2={oopGeo.wX} y2={oopGeo.gY} stroke="#9ca3af" strokeDasharray="2 2" />
        <line
          x1={oopGeo.wX}
          y1={oopGeo.wY - 25}
          x2={oopGeo.wX + oopGeo.wT}
          y2={oopGeo.wY - 25}
          stroke="#555"
          strokeWidth="1"
          markerStart={`url(#${ids.arrowSmall})`}
          markerEnd={`url(#${ids.arrowSmall})`}
        />
        <DimText x={oopGeo.wX + oopGeo.wT / 2} y={oopGeo.wY - 35} anchor="middle">
          tw = {fmt(wallThicknessMm, 0)} mm
        </DimText>
        <line x1={oopGeo.wX} y1={oopGeo.wY - 22} x2={oopGeo.wX} y2={oopGeo.wY} stroke="#9ca3af" strokeDasharray="2 2" />
        <line x1={oopGeo.wX + oopGeo.wT} y1={oopGeo.wY - 22} x2={oopGeo.wX + oopGeo.wT} y2={oopGeo.wY} stroke="#9ca3af" strokeDasharray="2 2" />
        <line
          x1={oopGeo.fX + oopGeo.fL + 20}
          y1={oopGeo.gY - oopGeo.fT}
          x2={oopGeo.fX + oopGeo.fL + 20}
          y2={oopGeo.gY}
          stroke="#555"
          strokeWidth="1"
          markerStart={`url(#${ids.arrowSmall})`}
          markerEnd={`url(#${ids.arrowSmall})`}
        />
        <DimText x={oopGeo.fX + oopGeo.fL + 40} y={oopGeo.gY - oopGeo.fT / 2} anchor="start">
          tf = {fmt(footingThickness, 2)} m
        </DimText>
        <line x1={oopGeo.fX + oopGeo.fL} y1={oopGeo.gY - oopGeo.fT} x2={oopGeo.fX + oopGeo.fL + 25} y2={oopGeo.gY - oopGeo.fT} stroke="#9ca3af" strokeDasharray="2 2" />
        <line x1={oopGeo.fX + oopGeo.fL} y1={oopGeo.gY} x2={oopGeo.fX + oopGeo.fL + 25} y2={oopGeo.gY} stroke="#9ca3af" strokeDasharray="2 2" />
        <line
          x1={oopGeo.fX}
          y1={oopGeo.gY + 20}
          x2={oopGeo.fX + oopGeo.fL}
          y2={oopGeo.gY + 20}
          stroke="#555"
          strokeWidth="1"
          markerStart={`url(#${ids.tick})`}
          markerEnd={`url(#${ids.tick})`}
        />
        <DimText x={oopGeo.fX + oopGeo.fL / 2} y={oopGeo.gY + 40} anchor="middle">
          Lf = {fmt(footingLength, 2)} m
        </DimText>
        <line x1={oopGeo.fX} y1={oopGeo.gY} x2={oopGeo.fX} y2={oopGeo.gY + 25} stroke="#9ca3af" strokeDasharray="2 2" />
        <line x1={oopGeo.fX + oopGeo.fL} y1={oopGeo.gY} x2={oopGeo.fX + oopGeo.fL} y2={oopGeo.gY + 25} stroke="#9ca3af" strokeDasharray="2 2" />
      </g>
    );
  };

  /* --------------------------------------------------------------------------
  OUT-OF-PLANE LOAD COMPONENT
  ------------------------------------------------------------------------ */
  const OutOfPlaneLoadsGraphic = ({ xOffset = 0, yOffset = 0 }) => {
    if (!showLoads) return null;

    /* NEW — FIRE LOAD + CANTILEVER DEFLECTION CURVE geometry ------------------
       During fire the top support may be lost → Fixed–Free (cantilever) action.
       The fire deflection curve is therefore a cantilever shape (zero slope at
       base, maximum deflection at the free top), unlike the bow-shaped
       (simply-supported) P-Δ curve used for the wind & seismic case.       */
    const fireArrowX1 = oopGeo.wX + oopGeo.wT + 228;
    const fireArrowX2 = fireArrowX1 + 43;
    const fireCurveBaseX = oopGeo.wX + oopGeo.wT + 310;
    const fireCurveTopY = oopGeo.rY + oopGeo.rT;
    const fireCurveH = Math.max(oopGeo.gY - fireCurveTopY, 1);
    const fireCurveDelta = 30;
    const fireCurvePath = `M ${fireCurveBaseX} ${oopGeo.gY} C ${fireCurveBaseX} ${oopGeo.gY - 0.55 * fireCurveH}, ${fireCurveBaseX + 0.8 * fireCurveDelta} ${fireCurveTopY + 0.30 * fireCurveH}, ${fireCurveBaseX + fireCurveDelta} ${fireCurveTopY}`;

    return (
      <g transform={`translate(${xOffset},${yOffset})`}>
        {seismicOutOfPlanePressure > 0 && (
          <g>
            {Array.from({ length: clamp(Math.round(oopGeo.wH / 50), 4, 12) }).map((_, i, arr) => {
              const y = oopGeo.wY + (i + 0.5) * oopGeo.wH / arr.length;
              return (
                <line
                  key={`oop-seis-${i}`}
                  x1={oopGeo.wX - 150}
                  y1={y}
                  x2={oopGeo.wX - 105}
                  y2={y}
                  stroke="#ea580c"
                  strokeWidth="1.7"
                  markerEnd={`url(#${ids.seismic})`}
                />
              );
            })}
            <Text x={oopGeo.wX - 155} y={oopGeo.wY + oopGeo.wH * 0.30 - 14} anchor="end" size={12} weight={600} fill="#c2410c">
              SEISMIC
            </Text>
            <Text x={oopGeo.wX - 155} y={oopGeo.wY + oopGeo.wH * 0.30 + 5} anchor="end" size={11} fill="#c2410c">
              {fmt(seismicOutOfPlanePressure, 2)} kPa
            </Text>
          </g>
        )}

        {windPressure > 0 && (
          <g>
            {Array.from({ length: clamp(Math.round(oopGeo.wH / 50), 4, 12) }).map((_, i, arr) => {
              const y = oopGeo.wY + (i + 0.5) * oopGeo.wH / arr.length;
              return (
                <line
                  key={`oop-wind-${i}`}
                  x1={oopGeo.wX - 55}
                  y1={y}
                  x2={oopGeo.wX - 10}
                  y2={y}
                  stroke="#0891b2"
                  strokeWidth="1.7"
                  markerEnd={`url(#${ids.wind})`}
                />
              );
            })}
            <Text x={oopGeo.wX - 60} y={oopGeo.wY + oopGeo.wH * 0.30 - 14} anchor="end" size={12} weight={600} fill="#0e7490">
              WIND
            </Text>
            <Text x={oopGeo.wX - 60} y={oopGeo.wY + oopGeo.wH * 0.30 + 5} anchor="end" size={11} fill="#0e7490">
              {fmt(windPressure, 2)} kPa
            </Text>
          </g>
        )}

        {Math.abs(deltaElastic) > 0 && (
          <path
            d={`M ${oopGeo.wX + oopGeo.wT + 4} ${oopGeo.gY} C ${oopGeo.wX + oopGeo.wT + 25} ${oopGeo.gY - (oopGeo.gY - oopGeo.rY) * 0.25}, ${oopGeo.wX + oopGeo.wT + 25} ${oopGeo.gY - (oopGeo.gY - oopGeo.rY) * 0.75}, ${oopGeo.wX + oopGeo.wT + 4} ${oopGeo.rY + oopGeo.rT}`}
            fill="none"
            stroke="#9333ea"
            strokeWidth="2.5"
            strokeDasharray="7 5"
          />
        )}

        <g>
          <Text x={oopGeo.wX + oopGeo.wT + 40} y={oopGeo.wY + oopGeo.wH * 0.45} size={12} weight={600} fill="#6d28d9">
            OOP M′ = {fmt(oopM, 2)} kN·m/m
          </Text>
          {Math.abs(deltaElastic) > 0 && (
            <>
              <Text x={oopGeo.wX + oopGeo.wT + 40} y={oopGeo.wY + oopGeo.wH * 0.45 + 20} size={12} weight={600} fill="#7e22ce">
                P-Δ
              </Text>
              <Text x={oopGeo.wX + oopGeo.wT + 40} y={oopGeo.wY + oopGeo.wH * 0.45 + 38} size={11} fill="#7e22ce">
                Δ = {fmt(deltaElastic, 1)} mm
              </Text>
            </>
          )}
        </g>

        {/* ------------------------------------------------------------------
            NEW — FIRE LOAD + CANTILEVER DEFLECTION CURVE (Fixed–Free)
            · wf pressure arrows on the right of the wall (thermal bowing,
              away from the fire source)
            · cantilever deflection curve: fixed at base, free at top
        ------------------------------------------------------------------ */}
        {firePressure > 0 && (
          <g>
            {/* Fire pressure arrows */}
            {Array.from({ length: clamp(Math.round(oopGeo.wH / 50), 4, 12) }).map((_, i, arr) => {
              const y = oopGeo.wY + (i + 0.5) * oopGeo.wH / arr.length;
              return (
                <line
                  key={`oop-fire-${i}`}
                  x1={fireArrowX1}
                  y1={y}
                  x2={fireArrowX2}
                  y2={y}
                  stroke="#dc2626"
                  strokeWidth="1.7"
                  markerEnd={`url(#${ids.fire})`}
                />
              );
            })}

            {/* Fire load labels */}
            <Text x={fireArrowX1 - 2} y={oopGeo.wY - 26} anchor="start" size={12} weight={600} fill="#b91c1c">
              FIRE wf = {fmt(firePressure, 2)} kPa
            </Text>
            <Text x={fireArrowX1 - 2} y={oopGeo.wY - 10} anchor="start" size={11} fill="#b91c1c">
              duration th = {fmt(fireDuration, 1)} hr
            </Text>

            {/* Undeflected vertical reference line */}
            <line
              x1={fireCurveBaseX}
              y1={oopGeo.gY}
              x2={fireCurveBaseX}
              y2={fireCurveTopY}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Cantilever deflection curve — fixed at base, free at top */}
            <path
              d={fireCurvePath}
              fill="none"
              stroke="#dc2626"
              strokeWidth="2.5"
              strokeDasharray="7 5"
            />

            {/* Fixed support symbol at base */}
            <line x1={fireCurveBaseX - 13} y1={oopGeo.gY} x2={fireCurveBaseX + 13} y2={oopGeo.gY} stroke="#b91c1c" strokeWidth="2" />
            {[-11, -4, 3, 10].map(dx => (
              <line
                key={`fire-hatch-${dx}`}
                x1={fireCurveBaseX + dx}
                y1={oopGeo.gY}
                x2={fireCurveBaseX + dx - 6}
                y2={oopGeo.gY + 8}
                stroke="#b91c1c"
                strokeWidth="1"
              />
            ))}

            {/* Top deflection marker */}
            <line
              x1={fireCurveBaseX}
              y1={fireCurveTopY - 14}
              x2={fireCurveBaseX + fireCurveDelta}
              y2={fireCurveTopY - 14}
              stroke="#b91c1c"
              strokeWidth="1"
              strokeDasharray="3 3"
              markerEnd={`url(#${ids.fire})`}
            />
            <Text x={fireCurveBaseX + fireCurveDelta / 2} y={fireCurveTopY - 24} anchor="middle" size={10} weight={600} fill="#b91c1c">
              Δfire
            </Text>

            {/* Caption */}
            <Text x={fireCurveBaseX + 14} y={oopGeo.gY + 20} anchor="middle" size={10.5} weight={600} fill="#b91c1c">
              Fire deflection — cantilever
            </Text>
          </g>
        )}
      </g>
    );
  };

  /* ==========================================================================
  RENDER
  ========================================================================== */
  return (
    <div className={className} style={{ width, height, overflow: 'hidden', ...style }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Precast concrete panel structural design diagram">
        <defs>
          <marker id={ids.arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#333" />
          </marker>
          <marker id={ids.arrowSmall} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
          </marker>
          <marker id={ids.tick} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <line x1="2" y1="8" x2="8" y2="2" stroke="#555" strokeWidth="1.5" />
          </marker>
          <marker id={ids.load} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
          </marker>
          <marker id={ids.seismic} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ea580c" />
          </marker>
          <marker id={ids.wind} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0891b2" />
          </marker>
          <marker id={ids.moment} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
          </marker>
          {/* NEW — fire arrow marker */}
          <marker id={ids.fire} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
          </marker>
          <pattern id={`ground-${reactId}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <line x1="0" y1="16" x2="16" y2="0" stroke="#9ca3af" strokeWidth="1" />
          </pattern>
          <pattern id={`concrete-${reactId}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#f7f7f7" />
            <circle cx="2" cy="3" r="0.7" fill="#d1d5db" />
            <circle cx="7" cy="7" r="0.7" fill="#d1d5db" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={viewBox.width} height={viewBox.height} fill="#ffffff" />

        {/* Title header (disabled)
        {showLabels && (
          <g>
            <Text x="40" y="10" size={19} weight={700}>PRECAST CONCRETE PANEL</Text>
            <Text x="40" y="51" size={12} fill="#6b7280">Structural design diagram — in-plane and out-of-plane load cases shown separately</Text>
          </g>
        )}
        */}

        {/* PANEL HEADINGS */}
        {showLabels && (
          <g>
            <rect x={leftA - 20} y={viewBox.height - 30} width={panelW + 40} height={26} rx="4" fill="#eff6ff" />
            <Text x={panelACentreX} y={viewBox.height - 14} anchor="middle" size={13} weight={700} fill="#1d4ed8">IN-PLANE LOAD CASE</Text>
            <rect x={leftB - 20} y={viewBox.height - 30} width={panelW + 40} height={26} rx="4" fill="#ecfeff" />
            <Text x={panelBCentreX} y={viewBox.height - 14} anchor="middle" size={13} weight={700} fill="#0e7490">OUT-OF-PLANE LOAD CASE</Text>
            <line x1={(rightA + leftB) / 2} y1="68" x2={(rightA + leftB) / 2} y2={viewBox.height - 40} stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="6 5" />
          </g>
        )}

        {/* Ground hatch (disabled)
        {showFoundation && (
          <g>
            <rect x={0} y={groundY + footingH + 12} width={viewBox.width} height={viewBox.height - groundY - footingH - 12} fill={`url(#ground-${reactId})`} opacity="0.50" />
            <line x1="60" y1={groundY + footingH + 12} x2={viewBox.width - 60} y2={groundY + footingH + 12} stroke="#6b7280" strokeWidth="1.5" />
          </g>
        )}
        */}

        {/* PANEL A — IN-PLANE */}
        <g transform="translate(0,0)">
          <InPlaneWallGraphic />
          <InPlaneDimensionsGraphic />
          <InPlaneLoadsGraphic />
        </g>

        {/* PANEL B — OUT-OF-PLANE CROSS-SECTION */}
        <g transform={`translate(${shiftX + 300},0)`}>
          <OutOfPlaneWallGraphic />
          <OutOfPlaneDimensionsGraphic />
          <OutOfPlaneLoadsGraphic />
        </g>

        {/* Slenderness info box (disabled)
        {showLabels && (
          <g>
            <rect x={leftB + panelW + 30} y={groundY + footingH + 95} width="160" height="70" rx="5" fill="#f9fafb" stroke="#d1d5db" />
            <Text x={leftB + panelW + 43} y={groundY + footingH + 112} size={11} weight={700} fill="#374151">GEOMETRY / SLENDERNESS</Text>
            <Text x={leftB + panelW + 43} y={groundY + footingH + 131} size={11} fill="#4b5563">H/t = {fmt(slenderness, 1)}</Text>
            <Text x={leftB + panelW + 43} y={groundY + footingH + 148} size={11} fill="#4b5563">K = {fmt(positive(input.effectiveLengthFactor, 1), 2)}</Text>
          </g>
        )}
        */}

        {/* In-plane action summary box (disabled)
        {showResults && (
          <g>
            <rect x={leftA - 15} y={groundY + footingH + 95} width={panelW + 30} height="150" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
            <Text x={leftA} y={groundY + footingH + 116} size={13} weight={700} fill="#111827">IN-PLANE ACTION SUMMARY</Text>
            <line x1={leftA} y1={groundY + footingH + 128} x2={leftA + panelW} y2={groundY + footingH + 128} stroke="#e5e7eb" />
            <ResultText x={leftA} y={groundY + footingH + 147} label="In-plane N*" value={fmt(inPlaneN, 1)} unit="kN" pass={results.inPlane?.pmInteraction?.check?.pass} />
            <ResultText x={leftA + (panelW + 30) / 3} y={groundY + footingH + 147} label="In-plane V*" value={fmt(inPlaneV, 1)} unit="kN" pass={results.inPlane?.shear?.check?.pass} />
            <ResultText x={leftA + 2 * (panelW + 30) / 3} y={groundY + footingH + 147} label="In-plane M*" value={fmt(inPlaneM, 1)} unit="kN·m" pass={results.inPlane?.pmInteraction?.check?.pass} />
            <rect x={leftA} y={groundY + footingH + 195} width={panelW} height="18" rx="9" fill={results.inPlane?.pmInteraction?.check?.pass === false || results.inPlane?.shear?.check?.pass === false ? '#fee2e2' : '#dcfce7'} />
            <Text x={leftA + panelW / 2} y={groundY + footingH + 204} anchor="middle" size={10} weight={700} fill={results.inPlane?.pmInteraction?.check?.pass === false || results.inPlane?.shear?.check?.pass === false ? '#991b1b' : '#166534'}>
              IN-PLANE CHECKS {results.inPlane?.pmInteraction?.check?.pass === false || results.inPlane?.shear?.check?.pass === false ? 'REQUIRE REVIEW' : 'PASS'}
            </Text>
          </g>
        )}
        */}

        {/* Out-of-plane action summary box (disabled)
        {showResults && (
          <g>
            <rect x={leftB - 15} y={groundY + footingH + 95} width={panelW + 30} height="150" rx="6" fill="#ffffff" stroke={overallPass ? '#86efac' : '#fca5a5'} strokeWidth="1.5" />
            <Text x={leftB} y={groundY + footingH + 116} size={13} weight={700} fill="#111827">OUT-OF-PLANE ACTION SUMMARY</Text>
            <line x1={leftB} y1={groundY + footingH + 128} x2={leftB + panelW} y2={groundY + footingH + 128} stroke="#e5e7eb" />
            <ResultText x={leftB} y={groundY + footingH + 147} label="OOP M₂" value={fmt(oopM, 2)} unit="kN·m/m" pass={results.outOfPlane?.flexure?.check?.pass} />
            <ResultText x={leftB + (panelW + 30) / 3} y={groundY + footingH + 147} label="Pcr" value={fmt(stability.Pcr, 1)} unit="kN" pass={results.outOfPlane?.stability?.stabilityCheck?.pass} />
            <ResultText x={leftB + 2 * (panelW + 30) / 3} y={groundY + footingH + 147} label="Magnification" value={fmt(magnification, 2)} unit="×" pass={stability.stabilityCheck?.pass} />
            <rect x={leftB} y={groundY + footingH + 195} width={panelW} height="18" rx="9" fill={overallPass ? '#dcfce7' : '#fee2e2'} />
            <Text x={leftB + panelW / 2} y={groundY + footingH + 204} anchor="middle" size={10} weight={700} fill={overallPass ? '#166534' : '#991b1b'}>
              GOVERNING UR = {fmt(governingUR, 2)} — {overallPass ? 'PASS' : 'REVIEW'}
            </Text>
          </g>
        )}
        */}

        {/* Legend (disabled)
        {showLabels && (
          <g>
            <line x1="40" y1={viewBox.height - 24} x2="70" y2={viewBox.height - 24} stroke="#2563eb" strokeWidth="2" /> <Text x="78" y={viewBox.height - 24} size={10} fill="#4b5563">Gravity / axial</Text>
            <line x1="248" y1={viewBox.height - 24} x2="278" y2={viewBox.height - 24} stroke="#ea580c" strokeWidth="2" /> <Text x="286" y={viewBox.height - 24} size={10} fill="#4b5563">Seismic (in-plane V*, out-of-plane pressure)</Text>
            <line x1="620" y1={viewBox.height - 24} x2="650" y2={viewBox.height - 24} stroke="#0891b2" strokeWidth="2" /> <Text x="658" y={viewBox.height - 24} size={10} fill="#4b5563">Wind (out-of-plane)</Text>
            <line x1="850" y1={viewBox.height - 24} x2="880" y2={viewBox.height - 24} stroke="#7c3aed" strokeWidth="2" strokeDasharray="5 3" /> <Text x="888" y={viewBox.height - 24} size={10} fill="#4b5563">Moment / P-Δ</Text>
            <line x1="1060" y1={viewBox.height - 24} x2="1090" y2={viewBox.height - 24} stroke="#dc2626" strokeWidth="2" /> <Text x="1098" y={viewBox.height - 24} size={10} fill="#4b5563">Reinforcement</Text>
          </g>
        )}
        */}

        {/* Footer (disabled)
        {showLabels && (<Text x="40" y={viewBox.height - 6} size={10} fill="#9ca3af">Diagrammatic representation — not to scale. Actions and results are taken from the calculation engine.</Text>)}
        */}
      </svg>
    </div>
  );
};

export default PrecastPanelSVG;