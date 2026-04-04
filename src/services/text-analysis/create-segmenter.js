export function createSegmenter (segmentit) {
  const {
    ChsNameOptimizer,
    ChsNameTokenizer,
    DatetimeOptimizer,
    DictOptimizer,
    DictTokenizer,
    EmailOptimizer,
    ForeignTokenizer,
    PunctuationTokenizer,
    Segment,
    SingleTokenizer,
    pangu,
    panguExtend1,
    panguExtend2,
    names
  } = segmentit

  const segmenter = new Segment()

  segmenter.use([
    ChsNameTokenizer,
    DictTokenizer,
    ForeignTokenizer,
    PunctuationTokenizer,
    SingleTokenizer,
    EmailOptimizer,
    DatetimeOptimizer,
    DictOptimizer,
    ChsNameOptimizer
  ])

  segmenter.loadDict([
    pangu,
    panguExtend1,
    panguExtend2,
    names
  ])

  return segmenter
}
