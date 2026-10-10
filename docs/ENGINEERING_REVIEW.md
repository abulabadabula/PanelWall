# PanelWall — engineering review status

**Status: preliminary software/code review only. This application is not currently a verified design certificate or a substitute for an independent structural engineering check.**

This review is scoped to the source currently in this repository. It is not a clause-by-clause certification of every equation. Before project use, validate the equations against the licensed, project-adopted editions of the standards and the BRANZ guide, then benchmark the calculation engine against independently hand-checked examples.

## Changes in this review branch

- The wall section strain-compatibility N–M calculation now records whether an axial-equilibrium root was bracketed and converged. A failed solve cannot silently produce a passing moment utilisation.
- The member section check uses an axial force from the same in-plane seismic action case used for the combined moment and shear, rather than silently falling back to the gravity-only axial force.
- The member N–M check is included in the in-plane checks feeding the overall summary.
- Missing connection or foundation results fail closed instead of being treated as successful.
- Basic input validation and a BRANZ low-axial-load scope warning have been added.
- In-plane and out-of-plane flexural surface crack-width calculations are now shown in a dedicated calculation section and in both PDF report variants. Concrete properties are shared; each direction reports cracking moments, transformed cracked inertia, effective inertia, reinforcement stress, crack width and utilisation.
- SLS crack checks require a user-entered governing moment and axial force to reach a confirmed result. Auto-derived actions remain labelled as screening estimates; the project-specific crack-width limit and pre-cracking shrinkage steel stress are editable.
- The OOP part period and ductility fields now feed the seismic action calculation; non-tabulated ductility values use a conservative response-factor step and trigger a scope warning.
- The connection input now exposes whether the shear plane is intentionally roughened, and welded/bolted choices are explicitly reported as unsupported by the current dowel/grout calculation. Boundary-element presence is editable rather than fixed to its default.
- Ignored OOP inputs (part/building importance and building period) and an unused effective-length override were removed from the input screen to avoid suggesting that they affected results. The building response/return-period assumptions still require project-specific selection.
- The overall status is deliberately **PRELIMINARY — ENGINEERING REVIEW REQUIRED** until the critical verification gaps below are addressed and validated.
- A minimal Vite project manifest/HTML entry and regression tests have been added.

## Verification matrix

| Topic | Present implementation | Required action before relying on results |
|---|---|---|
| Geometry/material/input validation | Basic positive-value checks and selected scope warnings | Add field-specific unit/range checks, detailing/cover/spacing geometry checks, and versioned code assumptions |
| Gravity, wind and earthquake actions | Several load inputs and action derivations exist | Build and report a complete, sign-aware AS/NZS 1170.0 ULS/SLS combination envelope; include reversed wind/seismic actions and check simultaneous actions consistently |
| In-plane force analysis | Gravity, wall inertia, diaphragm actions, lintel eccentricity and shear are combined in a simplified model | Independently verify tributary loads, action factors, force signs, eccentricity datum and combinations against project-specific load paths |
| In-plane N–M | Strain-compatibility solver and separate local boundary-element interaction model exist | Verify the section strain convention, reinforcement locations, compression-block parameters, strength-reduction factors, tension/compression sign convention and full interaction curve against hand calculations |
| In-plane shear and detailing | Simplified NZS 3101 wall shear equations, minimum reinforcement and spacing checks exist | Verify the chosen equations, limits, axial-force input, boundary-zone treatment and ductility/detailing requirements against the adopted NZS 3101 edition/amendments |
| Out-of-plane strength and stability | Support-factor coefficients, flexure, shear, P–Delta and four slenderness/stability checks exist | Independently re-derive and benchmark each formula, coefficient, unit and scope condition; in particular verify effective lengths and the P–Delta stiffness model |
| Deflection/serviceability | A calculated P–Delta displacement is reported | Implement separate service-load deflection/drift checks with specified limits and appropriate cracked/long-term stiffness; do not treat the current ULS displacement as an SLS pass |
| Crack width | NZS 3101 Cl. 2.4.4.6 Eqs. 2-7 to 2-9 are implemented as a flexural surface-crack screening calculation in both directions; Cl. 6.8.3 Eq. 6-2 / Eq. 6-2a is used for a preliminary effective-inertia estimate | Independently validate transformed-section stresses, reinforcement geometry and applicable wall scope; supply governing SLS N/M actions, project crack-width criterion and justified f_s,c; add restraint-induced thermal/shrinkage cracking, crack-spacing/detailing and full exposure/serviceability rules |
| Fire | A simplified fire calculation exists | Independently validate the thermal model, material reduction, restraint condition, fire design load combination and required rating against the adopted fire design basis |
| Lintel bearing/local effects | Bearing and a boundary-element N–M model exist | Verify local bearing, splitting, strut-and-tie/load transfer, confinement, tie detailing and realistic bearing eccentricity; verify the interaction model against independently computed points |
| Wall–foundation connection | Indicative dowel tension/shear, friction, grout bond, bearing and embedment checks exist | Add/verify concrete breakout, splitting, pry-out, dowel bending, edge distance, group effects, development, construction tolerance, tension–shear interaction and cyclic/seismic detailing |
| Foundation | Simplified bearing-pressure, sliding and uplift screens exist for two directions | Add foundation ULS/SLS combinations, footing flexure, one-way and punching shear, reinforcement/development, load transfer into soil, settlement and geotechnical bearing assumptions; check both axes and uplift/contact-pressure cases |
| Reporting and status | The UI/report displays calculation outputs | Keep individual check status distinct from overall design completeness; show assumptions, governing combinations, equation references, warnings, units and calculation-engine version |

## Critical engineering cautions

1. The BRANZ guide is specifically a low-axial-load design guide. The normalized axial load and the guide’s other geometric, support and connection limitations must be checked against the original guide for every design.
2. The application’s currently calculated action totals are not yet a demonstrated substitute for a complete sign-aware load-combination envelope. An overall result based on a single positive N, M and V can miss reversed or differently combined governing cases.
3. The crack-control module now calculates flexural surface crack widths using NZS 3101 Cl. 2.4.4.6, and an effective-inertia estimate using Cl. 6.8.3. However, automatic SLS actions are screening estimates only. A confirmed crack result requires user-entered governing serviceability axial force and moment for each direction; the effective-inertia equation was developed for beams/slabs without significant axial load, so wall-panel applicability must be justified or replaced by a rational cracked-section analysis.
4. Foundation and dowel checks in this code are screening calculations. They do not capture all relevant concrete and geotechnical failure modes.
5. The calculation engine contains formula blocks based on NZS 1170.5:2004 and historically revised NZS 3101 clauses. Confirm every reference against the licensed standard and its applicable amendments; do not assume the comment proves the implementation is compliant.
6. The interface intentionally does not show an overall DESIGN PASS while these verification items remain incomplete. A passing individual utilisation ratio is not an engineering sign-off.

## Reference basis to verify

- G. J. Beattie, BRANZ, *Design Guide: Slender Precast Concrete Panels with Low Axial Load* (2007), including its scope/limitations, panel actions, stability, connections and appendices.
- NZS 3101.1&2:2006, including amendments applicable to the project. The crack-control implementation uses the consolidated amendment forms of Cl. 5.2.3 Eq. 5-1 for E_c, Cl. 5.2.4 Eq. 5-3 and Cl. 5.2.5 Eq. 5-4 for f_r, Cl. 2.4.4.6 Eqs. 2-7 to 2-9 for flexural crack width, and Cl. 6.8.3 Eqs. 6-2 and 6-2a for a preliminary effective inertia.
- AS/NZS 1170.0 (combinations and general principles), AS/NZS 1170.1 (permanent and imposed actions), AS/NZS 1170.2 (wind actions), and NZS 1170.5 (earthquake actions).
- MBIE B1/VM1, Second Edition, effective 28 July 2025. As of 10 October 2026, the published transition period for the previous B1 verification-method edition ended on 31 July 2026; confirm the consent-specific compliance pathway and references before use. See https://www.building.govt.nz/building-code-compliance/b-stability/b1-structure/b1-acceptable-solutions-and-verification-methods.

Do not distribute a calculation report as a verified design until a suitably qualified New Zealand structural engineer has reviewed the assumptions, code versions, calculations, detailing and foundation/connection design.
