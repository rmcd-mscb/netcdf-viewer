/**
 * Computes a slice notation string for displaying sample data indices.
 * For example, a shape of [10, 20, 30] with 10 samples might return "[0:2, 0:5, 0:1]"
 *
 * @param shape - Array dimensions
 * @param sampleCount - Number of sample values (default 10)
 * @returns Slice notation string like "[0:2, 0:5]" or empty string if no shape
 */
export function getSampleSlice(shape: number[] | undefined, sampleCount: number = 10): string {
  if (!shape || shape.length === 0) {
    return '';
  }
  let remaining = sampleCount;
  const slices: string[] = [];
  for (let i = 0; i < shape.length; ++i) {
    if (remaining <= 0) {
      slices.push('0:1');
      continue;
    }
    let thisDim = 1;
    for (let j = i + 1; j < shape.length; ++j) {
      thisDim *= shape[j];
    }
    const count = Math.min(shape[i], Math.ceil(remaining / thisDim));
    slices.push(`0:${count}`);
    remaining = Math.floor(remaining / count);
  }
  return `[${slices.join(', ')}]`;
}
