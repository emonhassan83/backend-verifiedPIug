// Convert bytes to MB with 2 decimal points
export const bytesToMB = (bytes: number): number => {
  return parseFloat((bytes / (1024 * 1024)).toFixed(2));
};
