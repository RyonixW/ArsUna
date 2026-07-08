const recognizedItemOrder = [
  15,
  14,
  13,
  12,
  11,
  10,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  19,
  18,
  17,
  16,
]

export const sampleList = recognizedItemOrder.map((itemNumber) => ({
  codeBarres: `29000000000${String(itemNumber).padStart(2, '0')}`,
  quantite: 1,
}))
