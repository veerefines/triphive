import { describe, expect, it } from 'vitest'
import { isHiveMention, stripHiveMention } from './mention'

describe('isHiveMention', () => {
  it('detects @Hive anywhere, any case', () => {
    expect(isHiveMention('@Hive find food near Dawki')).toBe(true)
    expect(isHiveMention('hey @hive, any cafes?')).toBe(true)
    expect(isHiveMention('what do you think @HIVE')).toBe(true)
  })

  it('ignores plain mentions of hive and lookalike handles', () => {
    expect(isHiveMention('the hive is busy')).toBe(false)
    expect(isHiveMention('@Hiveminds unite')).toBe(false)
    expect(isHiveMention('mail me at me@hive.com')).toBe(false)
    expect(isHiveMention('')).toBe(false)
  })
})

describe('stripHiveMention', () => {
  it('removes the handle and tidies punctuation and spaces', () => {
    expect(stripHiveMention('@Hive find food near Dawki')).toBe('find food near Dawki')
    expect(stripHiveMention('hey @hive, any cafes?')).toBe('hey any cafes?')
    expect(stripHiveMention('  @Hive   @hive  ')).toBe('')
  })

  it('leaves text without a mention unchanged except trimming', () => {
    expect(stripHiveMention(' plain text ')).toBe('plain text')
  })
})
