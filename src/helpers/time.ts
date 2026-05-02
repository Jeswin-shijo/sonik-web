export function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

export function isUsableDuration(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function selectedDurationLabel(progress: number) {
  return progress > 0 ? '--:--' : '0:00';
}

export function getDurationLabel(duration?: string) {
  if (!duration || duration.includes('NaN')) {
    return '--:--';
  }

  return duration;
}
