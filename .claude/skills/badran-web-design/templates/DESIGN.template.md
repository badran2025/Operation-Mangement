---
version: alpha
name: PROJECT-design
description: "FILL: canvas, ink, the single accent and its job, type families (Latin + Arabic), density, mood."
colors:
  primary: "#000000"        # FILL — the one action color
  on-primary: "#ffffff"
  primary-hover: "#000000"
  canvas: "#ffffff"         # page background
  surface-1: "#ffffff"      # cards / panels
  surface-2: "#ffffff"      # nested / hovered rows
  ink: "#000000"            # primary text
  ink-muted: "#000000"      # secondary text (AA on canvas!)
  ink-subtle: "#000000"     # placeholders, meta (AA large only)
  hairline: "#000000"       # dividers / borders
  focus: "#000000"
  success: "#000000"
  warning: "#000000"
  danger: "#000000"
  info: "#000000"
typography:
  display:  { fontFamily: FILL, fontSize: 32px, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0px }
  headline: { fontFamily: FILL, fontSize: 24px, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0px }
  title:    { fontFamily: FILL, fontSize: 18px, fontWeight: 600, lineHeight: 1.35, letterSpacing: 0px }
  body:     { fontFamily: FILL, fontSize: 15px, fontWeight: 400, lineHeight: 1.6, letterSpacing: 0px }
  body-sm:  { fontFamily: FILL, fontSize: 13px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0px }
  caption:  { fontFamily: FILL, fontSize: 12px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0px }
  button:   { fontFamily: FILL, fontSize: 14px, fontWeight: 600, lineHeight: 1, letterSpacing: 0px }
  numeric:  { fontFamily: FILL, fontSize: 28px, fontWeight: 700, lineHeight: 1, fontFeature: tnum }
rounded: { xs: 4px, sm: 6px, md: 8px, lg: 12px, xl: 16px, pill: 9999px }
spacing: { xxs: 4px, xs: 8px, sm: 12px, md: 16px, lg: 24px, xl: 32px, xxl: 48px, section: 80px }
components:
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button}", rounded: "{rounded.md}", padding: 10px 16px }
  button-secondary: { backgroundColor: "{colors.surface-1}", textColor: "{colors.ink}", border: "1px solid {colors.hairline}", rounded: "{rounded.md}", padding: 10px 16px }
  card:             { backgroundColor: "{colors.surface-1}", rounded: "{rounded.lg}", padding: "{spacing.lg}" }
  input:            { backgroundColor: "{colors.surface-1}", border: "1px solid {colors.hairline}", rounded: "{rounded.md}", padding: 10px 12px }
  badge:            { typography: "{typography.caption}", rounded: "{rounded.pill}", padding: 2px 8px }
---

## Overview
FILL — who uses it, where (phone in a branch? desktop in an office?), and the one feeling it must give.

## Colors
### Brand & Accent
### Surface
### Text
### Semantic

## Typography
### Font Family
### Hierarchy
### Principles

## Layout
### Spacing System
### Grid & Container
### Whitespace Philosophy

## Elevation & Depth

## Shapes

## Components

## Do's and Don'ts
### Do
### Don't

## Responsive Behavior
### Breakpoints
### Touch Targets
### Collapsing Strategy

## Iteration Guide

## Known Gaps
