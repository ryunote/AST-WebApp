import { computeConvergence } from '@/lib/convergence'

describe('computeConvergence', () => {
  // ─── no_data を返すケース ────────────────────────────────────────────────────

  describe('no_data を返すケース', () => {
    it('CV-01: aiPrediction=null → "no_data"', () => {
      expect(computeConvergence(null, 'positive')).toBe('no_data')
    })

    it('CV-02: aiPrediction=undefined → "no_data"', () => {
      expect(computeConvergence(undefined, 'positive')).toBe('no_data')
    })

    it('CV-03: sentiment=null → "no_data"', () => {
      expect(computeConvergence('up', null)).toBe('no_data')
    })

    it('CV-04: sentiment=undefined → "no_data"', () => {
      expect(computeConvergence('up', undefined)).toBe('no_data')
    })

    it('CV-05: aiPrediction="down", sentiment="neutral" → "no_data"', () => {
      expect(computeConvergence('down', 'neutral')).toBe('no_data')
    })

    it('CV-06: aiPrediction="up", sentiment="neutral" → "no_data" (neutral always wins)', () => {
      expect(computeConvergence('up', 'neutral')).toBe('no_data')
    })
  })

  // ─── bullish を返すケース ────────────────────────────────────────────────────

  describe('bullish を返すケース', () => {
    it('CV-07: aiPrediction="up", sentiment="positive" → "bullish"', () => {
      expect(computeConvergence('up', 'positive')).toBe('bullish')
    })
  })

  // ─── bearish を返すケース ────────────────────────────────────────────────────

  describe('bearish を返すケース', () => {
    it('CV-08: aiPrediction="down", sentiment="negative" → "bearish"', () => {
      expect(computeConvergence('down', 'negative')).toBe('bearish')
    })
  })

  // ─── divergent を返すケース ──────────────────────────────────────────────────

  describe('divergent を返すケース', () => {
    it('CV-09: aiPrediction="up", sentiment="negative" → "divergent"', () => {
      expect(computeConvergence('up', 'negative')).toBe('divergent')
    })

    it('CV-10: aiPrediction="down", sentiment="positive" → "divergent"', () => {
      expect(computeConvergence('down', 'positive')).toBe('divergent')
    })
  })
})
