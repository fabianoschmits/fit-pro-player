export function neighborIndexOf(list, id) {
  const index = list.findIndex(ex => ex.id === id)
  return index < 0 ? 0 : index
}

export function cycleNeighborIndex(length, index, dir) {
  if (length < 2) return index
  return (index + dir + length) % length
}
