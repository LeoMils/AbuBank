---
name: system-discovery
description: Map existing mechanisms, runtime entry points, and data flow BEFORE proposing or writing anything. Finds dead/duplicate/dormant/unwired code. Use at the start of any recovery cycle or when scoping a change.
---

# System Discovery

Discover before you build. This repo is over-built — the default assumption is that a
mechanism for your task ALREADY EXISTS. Find it before proposing a new one.

## Purpose
Produce an evidence-cited map of how a capability actually works at runtime, and surface
dead / duplicate / dormant / unwired code — so changes connect to reality instead of adding
a parallel system.

## Trigger
Start of a recovery cycle; scoping any non-trivial change; "how does X work?"; suspected duplication.

## Inputs
- A capability or area (e.g. "calendar create", "voice TTS", "family reasoning").
- The repo (read-only).

## Evidence classes
CODE only (this skill reads source and traces wiring; it does not run the product).

## Process (ordered)
1. Locate every module that plausibly implements the capability (Grep/Glob by name + behavior).
2. Identify the RUNTIME entry point and follow the call chain to the user-visible effect.
3. Mark which implementations are actually reachable from runtime vs test-only vs orphaned.
4. Map data flow (source of truth → loaders → consumers) and persistence.
5. List duplicates (≥2 modules answering the same turn) and name the ONE authoritative path.
6. List dead exports (no reachable call site), dormant features (behind a flag), and unwired code.
7. Cite `file:line` for every claim.

## Tools
Glob, Grep, Read. (No Edit/Write.)

## Forbidden
- Editing ANY file (discovery is strictly read-only).
- Proposing a new module before proving no existing one fits.
- Claiming reachability without a traced call site.

## Output schema
```
{ capability, runtimeEntryPoint, callChain[], authoritativePath,
  duplicates[{file,why}], deadExports[{file,symbol}], dormant[], unwired[],
  dataFlow, persistence, untestedRuntimePaths[], citations[] }
```

## Stop conditions
- Discovery requires an edit to proceed → stop and report (do not edit).

## Completion criteria
Every implementation of the capability is classified reachable/test-only/orphan, the
authoritative runtime path is named, and every claim is `file:line`-cited.

## Context policy
Isolated context when fanning out across many files; otherwise current context.
