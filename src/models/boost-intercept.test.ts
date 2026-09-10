import { describe, expect, it } from 'vitest'
import { airReachMetres, boostWindow, reachMetres, SPACE_LAYERS, spaceChance } from './boost-intercept.ts'

describe('boost-phase interception', () => {
  it('leaves a solid booster a ninety-second window and a liquid one two hundred and ten', () => {
    expect(boostWindow(180).availableSeconds).toBe(90)
    expect(boostWindow(300).availableSeconds).toBe(210)
    expect(boostWindow(60).availableSeconds).toBe(0)
  })
  it('gives Brilliant Pebbles as proposed a fair chance at a slow liquid booster and a poor one at a fast solid, and a small layer almost none', () => {
    const liquid = spaceChance(boostWindow(300), SPACE_LAYERS[0])
    const solid = spaceChance(boostWindow(180), SPACE_LAYERS[0])
    const small = spaceChance(boostWindow(180), SPACE_LAYERS[2])
    expect(reachMetres(boostWindow(300), 5_000)).toBe(1_050_000)
    expect(liquid.chance).toBeGreaterThan(solid.chance)
    expect(solid.expected).toBeGreaterThan(1)
    expect(small.chance).toBeLessThan(0.25)
    expect(spaceChance(boostWindow(60), SPACE_LAYERS[0]).chance).toBe(0)
  })
  it('puts an aircraft inside a ring of a couple of hundred kilometres', () => {
    expect(airReachMetres(boostWindow(180))).toBe(135_000)
  })
})
